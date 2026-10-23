import { savedViewListSchema, savedViewSchema, type SavedView, type SavedViewState } from "@shelfmark/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { databasePath, openDb } from "../db/open.js";
import { startSignedInApp, type SignedInTestApp } from "../testing/testApp.js";

let t: SignedInTestApp;

beforeEach(async () => {
  t = await startSignedInApp();
});

afterEach(async () => {
  await t.close();
});

type Response = Awaited<ReturnType<SignedInTestApp["inject"]>>;

function expectError(res: Response, status: number, code: string): string {
  expect(res.statusCode).toBe(status);
  const body = res.json() as { error: { code: string; message: string } };
  expect(Object.keys(body)).toEqual(["error"]);
  expect(body.error.code).toBe(code);
  expect(typeof body.error.message).toBe("string");
  return body.error.message;
}

const UNREAD_LIVING_ROOM: SavedViewState = {
  collection: "owned",
  filters: {
    status: { kind: "pick", values: ["unread"] },
    shelf: { kind: "pick", values: ["Living room · A1"] },
  },
  sorting: [{ id: "book", desc: false }],
  columns: ["authors", "shelf", "status"],
};

async function create(name: string, state: SavedViewState = UNREAD_LIVING_ROOM): Promise<SavedView> {
  const res = await t.inject({ method: "POST", url: "/api/views", payload: { name, state } });
  expect(res.statusCode).toBe(201);
  return savedViewSchema.parse(res.json());
}

async function list(): Promise<SavedView[]> {
  const res = await t.inject({ method: "GET", url: "/api/views" });
  expect(res.statusCode).toBe(200);
  return savedViewListSchema.parse(res.json()).views;
}

describe("GET /api/views", () => {
  it("answers { views: [] } before any is saved", async () => {
    const res = await t.inject({ method: "GET", url: "/api/views" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ views: [] });
  });

  it("lists the views by position, each as it was saved", async () => {
    const unread = await create("Unread", { ...UNREAD_LIVING_ROOM, filters: { status: { kind: "pick", values: ["unread"] } } });
    const living = await create("Unread, living room");
    expect(await list()).toEqual([unread, living]);
    expect(living).toMatchObject({ name: "Unread, living room", state: UNREAD_LIVING_ROOM, position: 1 });
  });

  it("drops a column that no longer exists instead of failing the view", async () => {
    const view = await create("Old");
    const db = openDb(databasePath(t.dataDir));
    try {
      const state = { ...UNREAD_LIVING_ROOM, columns: ["authors", "loanedTo"], sorting: [{ id: "loanedTo", desc: true }] };
      db.prepare("UPDATE saved_views SET state = ? WHERE id = ?").run(JSON.stringify(state), view.id);
    } finally {
      db.close();
    }
    const [read] = await list();
    expect(read?.state.columns).toEqual(["authors"]);
    expect(read?.state.sorting).toEqual([]);
  });
});

describe("POST /api/views", () => {
  it("saves a view, trimming its name", async () => {
    const res = await t.inject({ method: "POST", url: "/api/views", payload: { name: "  Wishlist, by year ", state: { ...UNREAD_LIVING_ROOM, collection: "wishlist" } } });
    expect(res.statusCode).toBe(201);
    expect(savedViewSchema.parse(res.json())).toMatchObject({ name: "Wishlist, by year", position: 0, state: { collection: "wishlist" } });
  });

  it("answers 409 for a name another view has, in any case, and saves nothing", async () => {
    await create("Unread");
    const res = await t.inject({ method: "POST", url: "/api/views", payload: { name: "unread ", state: UNREAD_LIVING_ROOM } });
    expect(expectError(res, 409, "conflict")).toBe("There is already a view called “Unread”.");
    expect(await list()).toHaveLength(1);
  });

  it.each([
    ["no name", { state: UNREAD_LIVING_ROOM }, /^name: /],
    ["a blank name", { name: "  ", state: UNREAD_LIVING_ROOM }, /^name: a view needs a name/],
    ["no state", { name: "A" }, /^state: /],
    ["an unknown column", { name: "A", state: { ...UNREAD_LIVING_ROOM, columns: ["loanedTo"] } }, /^state\.columns\.0: /],
    ["the book column", { name: "A", state: { ...UNREAD_LIVING_ROOM, columns: ["book"] } }, /^state\.columns: the book column/],
    ["a column twice", { name: "A", state: { ...UNREAD_LIVING_ROOM, columns: ["year", "year"] } }, /^state\.columns: lists a column twice/],
    ["a sort by an unknown column", { name: "A", state: { ...UNREAD_LIVING_ROOM, sorting: [{ id: "nope", desc: true }] } }, /^state\.sorting\.0\.id: /],
    ["a filter on an unknown column", { name: "A", state: { ...UNREAD_LIVING_ROOM, filters: { nope: { kind: "yesno", value: true } } } }, /^state\.filters/],
    ["a malformed filter", { name: "A", state: { ...UNREAD_LIVING_ROOM, filters: { year: { kind: "number", min: "1990" } } } }, /^state\.filters\.year/],
    ["a wrong collection", { name: "A", state: { ...UNREAD_LIVING_ROOM, collection: "loaned" } }, /^state\.collection: /],
    ["an unknown key", { name: "A", state: UNREAD_LIVING_ROOM, query: "dune" }, /query/],
  ])("refuses %s with a 400 naming the field", async (_, payload, message) => {
    const res = await t.inject({ method: "POST", url: "/api/views", payload });
    expect(expectError(res, 400, "validation")).toMatch(message);
    expect(await list()).toEqual([]);
  });
});

describe("PATCH /api/views/:id", () => {
  it("renames a view", async () => {
    const view = await create("Unread");
    const res = await t.inject({ method: "PATCH", url: `/api/views/${view.id}`, payload: { name: "To read" } });
    expect(res.statusCode).toBe(200);
    expect(savedViewSchema.parse(res.json())).toMatchObject({ id: view.id, name: "To read", state: view.state });
  });

  it("overwrites a view with the current state", async () => {
    const view = await create("Unread");
    const state: SavedViewState = { ...UNREAD_LIVING_ROOM, filters: { status: { kind: "pick", values: ["unread", "reading"] } } };
    const res = await t.inject({ method: "PATCH", url: `/api/views/${view.id}`, payload: { state } });
    expect(res.statusCode).toBe(200);
    expect((await list())[0]?.state).toEqual(state);
  });

  it("moves a view in the menu", async () => {
    await create("A");
    await create("B");
    const c = await create("C");
    const res = await t.inject({ method: "PATCH", url: `/api/views/${c.id}`, payload: { position: 0 } });
    expect(res.statusCode).toBe(200);
    expect((await list()).map((view) => `${view.position} ${view.name}`)).toEqual(["0 C", "1 A", "2 B"]);
  });

  it("answers 409 when the new name is another view's", async () => {
    await create("Unread");
    const other = await create("Read");
    const res = await t.inject({ method: "PATCH", url: `/api/views/${other.id}`, payload: { name: "UNREAD" } });
    expectError(res, 409, "conflict");
    expect((await list()).map((view) => view.name)).toEqual(["Unread", "Read"]);
  });

  it("answers 404 for no such view, 400 for a bad patch", async () => {
    const view = await create("Unread");
    expectError(await t.inject({ method: "PATCH", url: "/api/views/999", payload: { name: "X" } }), 404, "not_found");
    expectError(await t.inject({ method: "PATCH", url: "/api/views/abc", payload: { name: "X" } }), 404, "not_found");
    expectError(await t.inject({ method: "PATCH", url: `/api/views/${view.id}`, payload: { position: -1 } }), 400, "validation");
    expectError(await t.inject({ method: "PATCH", url: `/api/views/${view.id}`, payload: { colour: "red" } }), 400, "validation");
  });
});

describe("DELETE /api/views/:id", () => {
  it("deletes a view, then answers 404 for it", async () => {
    const view = await create("Unread");
    const res = await t.inject({ method: "DELETE", url: `/api/views/${view.id}` });
    expect(res.statusCode).toBe(204);
    expect(await list()).toEqual([]);
    expectError(await t.inject({ method: "DELETE", url: `/api/views/${view.id}` }), 404, "not_found");
  });
});
