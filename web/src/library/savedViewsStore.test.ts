import type { SavedView, SavedViewState } from "@shelfmark/shared";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../api";
import { createViewsStore, type ViewsSource } from "./savedViewsStore";

const STATE: SavedViewState = { collection: "owned", filters: {}, sorting: [{ id: "added", desc: true }], columns: ["publisher"] };

function view(id: number, name: string, position: number): SavedView {
  return { id, name, state: STATE, position, createdAt: "2026-10-23T09:00:00.000Z", updatedAt: "2026-10-23T09:00:00.000Z" };
}

function source(overrides: Partial<ViewsSource> = {}): ViewsSource {
  return {
    list: vi.fn(async () => [view(2, "Read", 1), view(1, "Unread", 0)]),
    create: vi.fn(async ({ name }) => view(3, name, 2)),
    patch: vi.fn(async (id, patch) => ({ ...view(id, patch.name ?? "Unread", 0), state: patch.state ?? STATE })),
    remove: vi.fn(async () => undefined),
    ...overrides,
  };
}

const names = (store: ReturnType<typeof createViewsStore>) => store.getState().views.map((v) => `${v.position} ${v.name}`);

describe("createViewsStore", () => {
  it("fetches once per session and keeps the views by position", async () => {
    const api = source();
    const store = createViewsStore(api);
    expect(store.getState().status).toBe("loading");
    store.ensureLoaded();
    store.ensureLoaded();
    await store.refresh();
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(store.getState().status).toBe("ready");
    expect(names(store)).toEqual(["0 Unread", "1 Read"]);
  });

  it("adds a saved view last, and puts an updated one in its place", async () => {
    const store = createViewsStore(source());
    await store.refresh();
    await store.create({ name: "Living room", state: STATE });
    expect(names(store)).toEqual(["0 Unread", "1 Read", "2 Living room"]);
    await store.patch(1, { name: "To read" });
    expect(names(store)).toEqual(["0 To read", "1 Read", "2 Living room"]);
  });

  it("refetches after a move, since the others shift too", async () => {
    const api = source();
    const store = createViewsStore(api);
    await store.refresh();
    await store.patch(2, { position: 0 });
    expect(api.list).toHaveBeenCalledTimes(2);
  });

  it("fetches the list again when a view it changes was deleted elsewhere, and only once it has a list", async () => {
    const gone = new ApiError(404, "not_found", "There is no such view.");
    const api = source({ patch: vi.fn().mockRejectedValue(gone) });
    const store = createViewsStore(api);
    store.refreshIfLoaded();
    expect(api.list).not.toHaveBeenCalled();
    await store.refresh();
    await expect(store.patch(1, { name: "To read" })).rejects.toBe(gone);
    expect(api.list).toHaveBeenCalledTimes(2);
    store.refreshIfLoaded();
    expect(api.list).toHaveBeenCalledTimes(3);
  });

  it("takes a deleted view out and moves the rest up; one already gone counts as deleted", async () => {
    const store = createViewsStore(
      source({ remove: vi.fn().mockRejectedValueOnce(new ApiError(404, "not_found", "There is no such view.")) }),
    );
    await store.refresh();
    await store.remove(1);
    expect(names(store)).toEqual(["0 Read"]);
  });

  it("passes a 409 on to the dialog and changes nothing", async () => {
    const taken = new ApiError(409, "conflict", "There is already a view called “Unread”.");
    const store = createViewsStore(source({ create: vi.fn().mockRejectedValue(taken) }));
    await store.refresh();
    await expect(store.create({ name: "unread", state: STATE })).rejects.toBe(taken);
    expect(names(store)).toEqual(["0 Unread", "1 Read"]);
  });

  it("says when the first fetch failed, retries, and keeps a list a later refresh fails to replace", async () => {
    const list = vi
      .fn<ViewsSource["list"]>()
      .mockRejectedValueOnce(new ApiError(0, "network", "Shelfmark can't be reached."))
      .mockResolvedValueOnce([view(1, "Unread", 0)])
      .mockRejectedValueOnce(new ApiError(0, "network", "Shelfmark can't be reached."));
    const store = createViewsStore(source({ list }));
    await store.refresh();
    expect(store.getState()).toMatchObject({ status: "error", views: [] });
    await store.refresh();
    expect(store.getState()).toMatchObject({ status: "ready", error: null });
    await store.refresh();
    expect(store.getState().status).toBe("ready");
    expect(names(store)).toEqual(["0 Unread"]);
  });

  it("forgets the list on reset and drops an answer from before it", async () => {
    let answer: (views: SavedView[]) => void = () => undefined;
    const store = createViewsStore(source({ list: () => new Promise((resolve) => (answer = resolve)) }));
    store.ensureLoaded();
    store.reset();
    answer([view(1, "Unread", 0)]);
    await Promise.resolve();
    expect(store.getState()).toMatchObject({ status: "loading", views: [] });
  });
});
