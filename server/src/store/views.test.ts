import type { SavedViewState } from "@shelfmark/shared";
import { afterEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "../db/open.js";
import { createViewStore, viewNameKey, ViewNameTaken } from "./views.js";

const opened: Db[] = [];
afterEach(() => {
  for (const db of opened.splice(0)) db.close();
});

function setup(times: string[] = []) {
  const db = openDb(":memory:");
  opened.push(db);
  let tick = 0;
  const now = () => new Date(times[tick++] ?? "2026-10-23T09:00:00.000Z");
  return { db, store: createViewStore(db, now) };
}

const UNREAD: SavedViewState = {
  collection: "owned",
  filters: { status: { kind: "pick", values: ["unread"] } },
  sorting: [{ id: "added", desc: true }],
  columns: ["publisher", "year", "shelf", "status", "added"],
};

const LIVING_ROOM: SavedViewState = {
  ...UNREAD,
  filters: { ...UNREAD.filters, shelf: { kind: "pick", values: ["Living room · A1", "Living room · A2"] } },
  sorting: [{ id: "book", desc: false }],
};

describe("createViewStore", () => {
  it("saves a view last in the menu, and lists the views by position", () => {
    const { store } = setup(["2026-10-23T09:00:00.000Z", "2026-10-23T09:05:00.000Z"]);
    const unread = store.create({ name: "Unread", state: UNREAD });
    const living = store.create({ name: "Unread, living room", state: LIVING_ROOM });

    expect(unread).toEqual({
      id: unread.id,
      name: "Unread",
      state: UNREAD,
      position: 0,
      createdAt: "2026-10-23T09:00:00.000Z",
      updatedAt: "2026-10-23T09:00:00.000Z",
    });
    expect(living.position).toBe(1);
    expect(store.list().map((view) => view.name)).toEqual(["Unread", "Unread, living room"]);
    expect(store.get(living.id)).toEqual(living);
    expect(store.get(999)).toBeUndefined();
  });

  it("refuses a name another view has, whatever its case", () => {
    const { store } = setup();
    store.create({ name: "Unread", state: UNREAD });
    expect(() => store.create({ name: "unread", state: LIVING_ROOM })).toThrow(ViewNameTaken);
    expect(() => store.create({ name: "UNREAD", state: LIVING_ROOM })).toThrow(/already a view called “Unread”/);
    expect(store.list()).toHaveLength(1);
  });

  it("folds Romanian letters for the name key, as tags do", () => {
    expect(viewNameKey(" Știință ")).toBe(viewNameKey("știință"));
    expect(viewNameKey("Ştiinţă")).not.toBe(viewNameKey("Știință")); // cedilla and comma below stay two spellings, as for tags
  });

  it("renames, keeps its own name in another case, and refuses another view's", () => {
    const { store } = setup(["2026-10-23T09:00:00.000Z", "2026-10-23T09:00:00.000Z", "2026-10-23T10:00:00.000Z"]);
    const unread = store.create({ name: "Unread", state: UNREAD });
    const living = store.create({ name: "Living room", state: LIVING_ROOM });

    expect(store.patch(unread.id, { name: "unread" })).toMatchObject({ name: "unread", updatedAt: "2026-10-23T10:00:00.000Z" });
    expect(() => store.patch(living.id, { name: "Unread" })).toThrow(ViewNameTaken);
    expect(store.get(living.id)?.name).toBe("Living room");
  });

  it("overwrites a view's state", () => {
    const { store } = setup();
    const view = store.create({ name: "Unread", state: UNREAD });
    expect(store.patch(view.id, { state: LIVING_ROOM })?.state).toEqual(LIVING_ROOM);
    expect(store.get(view.id)?.state).toEqual(LIVING_ROOM);
  });

  it("moves a view to a place in the menu and keeps the positions 0, 1, 2…", () => {
    const { store } = setup();
    const [a, b, c] = ["A", "B", "C"].map((name) => store.create({ name, state: UNREAD }));
    if (!a || !b || !c) throw new Error("not created");

    store.patch(c.id, { position: 0 });
    expect(store.list().map((view) => [view.name, view.position])).toEqual([
      ["C", 0],
      ["A", 1],
      ["B", 2],
    ]);
    store.patch(c.id, { position: 99 }); // past the end is the end
    expect(store.list().map((view) => view.name)).toEqual(["A", "B", "C"]);
    store.patch(a.id, { position: 1 });
    expect(store.list().map((view) => view.name)).toEqual(["B", "A", "C"]);
  });

  it("answers undefined for a patch of no such view, and leaves an empty patch's times alone", () => {
    const { store } = setup(["2026-10-23T09:00:00.000Z", "2026-10-23T11:00:00.000Z"]);
    const view = store.create({ name: "Unread", state: UNREAD });
    expect(store.patch(999, { name: "Gone" })).toBeUndefined();
    expect(store.patch(view.id, {})).toEqual(view);
  });

  it("deletes a view and moves the ones after it up", () => {
    const { store } = setup();
    const [a, b] = ["A", "B", "C"].map((name) => store.create({ name, state: UNREAD }));
    if (!a || !b) throw new Error("not created");
    expect(store.remove(a.id)).toBe(true);
    expect(store.remove(a.id)).toBe(false);
    expect(store.list().map((view) => [view.name, view.position])).toEqual([
      ["B", 0],
      ["C", 1],
    ]);
    // The name is free again.
    expect(store.create({ name: "a", state: UNREAD }).position).toBe(2);
  });

  it("drops a column that no longer exists when it reads a view back", () => {
    const { db, store } = setup();
    const view = store.create({ name: "Old", state: UNREAD });
    // A view saved by a version that had a "loanedTo" column, since taken away.
    const old = {
      collection: "owned",
      filters: { loanedTo: { kind: "text", op: "notEmpty", text: "" }, status: { kind: "pick", values: ["unread"] } },
      sorting: [
        { id: "loanedTo", desc: false },
        { id: "book", desc: false },
      ],
      columns: ["publisher", "loanedTo", "year"],
    };
    db.prepare("UPDATE saved_views SET state = ? WHERE id = ?").run(JSON.stringify(old), view.id);

    expect(store.get(view.id)?.state).toEqual({
      collection: "owned",
      filters: { status: { kind: "pick", values: ["unread"] } },
      sorting: [{ id: "book", desc: false }],
      columns: ["publisher", "year"],
    });
    expect(store.list()[0]?.state.columns).toEqual(["publisher", "year"]);
  });
});
