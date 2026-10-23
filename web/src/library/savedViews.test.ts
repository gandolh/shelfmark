import { readSavedViewState, savedViewStateSchema, type SavedView, type SavedViewState } from "@shelfmark/shared";
import { afterEach, describe, expect, it } from "vitest";
import type { Filters } from "./filters";
import { defaultPrefs, type Layout, type LibraryPrefs } from "./prefs";
import {
  applyView,
  currentStateOf,
  currentViewState,
  forgetView,
  getLastViewId,
  keptFilters,
  matchingView,
  prefsWithView,
  rememberView,
  sameViewState,
  shownColumns,
  updatedViewState,
} from "./savedViews";
import { clearFilters, getFilters, getPrefs, setFilter, updatePrefs } from "./state";
import { book } from "./test-books";
import { deriveView } from "./view";

const desktop = defaultPrefs("desktop");

function view(id: number, name: string, state: SavedViewState, position = id - 1): SavedView {
  return { id, name, state, position, createdAt: "2026-10-23T09:00:00.000Z", updatedAt: "2026-10-23T09:00:00.000Z" };
}

/** What the server keeps and answers: checked on the way in, read back leniently. */
function throughServer(state: SavedViewState): SavedViewState {
  return readSavedViewState(JSON.parse(JSON.stringify(savedViewStateSchema.parse(state))));
}

const UNREAD_LIVING_ROOM: Filters = {
  status: { kind: "pick", values: ["unread"] },
  shelf: { kind: "pick", values: ["Living room · A1", "Living room · A2"] },
};

afterEach(() => {
  clearFilters();
  for (const layout of ["desktop", "phone"] as Layout[]) updatePrefs(layout, () => defaultPrefs(layout));
});

describe("currentViewState", () => {
  it("holds the tab, the active filters, the sort and the shown columns without the book column", () => {
    const prefs: LibraryPrefs = { ...desktop, collection: "wishlist", sorting: [{ id: "year", desc: true }] };
    const state = currentViewState(prefs, {
      ...UNREAD_LIVING_ROOM,
      notes: { kind: "text", op: "contains", text: "   " }, // narrows nothing
      year: { kind: "text", op: "contains", text: "1990" }, // a filter for another kind of column
    });
    expect(state).toEqual({
      collection: "wishlist",
      filters: UNREAD_LIVING_ROOM,
      sorting: [{ id: "year", desc: true }],
      columns: ["publisher", "year", "shelf", "status", "added"],
    });
    expect(savedViewStateSchema.safeParse(state).success).toBe(true);
  });

  it("keeps a filter as the panel means it: trimmed text, each value once", () => {
    expect(
      keptFilters({
        notes: { kind: "text", op: "contains", text: "  signed by " },
        isbn: { kind: "text", op: "empty", text: "left over" },
        tags: { kind: "pick", values: ["Poetry", "Poetry", "Essays"] },
      }),
    ).toEqual({
      notes: { kind: "text", op: "contains", text: "signed by" },
      isbn: { kind: "text", op: "empty", text: "" },
      tags: { kind: "pick", values: ["Poetry", "Essays"] },
    });
  });
});

describe("prefsWithView", () => {
  it("shows exactly the view's columns, in its order, after the book; the switch and the widths stay", () => {
    const prefs: LibraryPrefs = { ...defaultPrefs("phone"), view: "covers", columnSizing: { publisher: 200 } };
    const next = prefsWithView(prefs, {
      collection: "wishlist",
      filters: {},
      sorting: [{ id: "book", desc: false }],
      columns: ["status", "authors", "tags"],
    });
    expect(shownColumns(next)).toEqual(["status", "authors", "tags"]);
    expect(next.columnOrder[0]).toBe("book");
    expect(next.columnVisibility.book).toBe(true);
    expect(next.columnVisibility.publisher).toBe(false);
    expect(new Set(next.columnOrder).size).toBe(prefs.columnOrder.length);
    expect(next).toMatchObject({ collection: "wishlist", view: "covers", sorting: [{ id: "book", desc: false }], columnSizing: { publisher: 200 } });
  });

  it("sorts newest first when every sort key the view had is gone", () => {
    expect(prefsWithView(desktop, { collection: "owned", filters: {}, sorting: [], columns: [] }).sorting).toEqual([{ id: "added", desc: true }]);
  });
});

describe("sameViewState", () => {
  const state = currentViewState(desktop, UNREAD_LIVING_ROOM);

  it("matches its own state, whatever order the pick-list values were ticked in", () => {
    expect(sameViewState(state, throughServer(state))).toBe(true);
    const reticked: SavedViewState = { ...state, filters: { ...state.filters, shelf: { kind: "pick", values: ["Living room · A2", "Living room · A1"] } } };
    expect(sameViewState(state, reticked)).toBe(true);
  });

  it("tells a changed tab, filter, sort or column apart", () => {
    expect(sameViewState(state, { ...state, collection: "wishlist" })).toBe(false);
    expect(sameViewState(state, { ...state, filters: { status: { kind: "pick", values: ["unread"] } } })).toBe(false);
    expect(sameViewState(state, { ...state, filters: { ...state.filters, signed: { kind: "yesno", value: true } } })).toBe(false);
    expect(sameViewState(state, { ...state, sorting: [{ id: "added", desc: false }] })).toBe(false);
    expect(sameViewState(state, { ...state, columns: ["publisher", "year"] })).toBe(false);
    expect(sameViewState(state, { ...state, columns: ["publisher", "year"] }, { columns: false })).toBe(true);
  });

  it("reads a sort with nothing usable left as the default sort, as the page does", () => {
    expect(sameViewState({ ...state, sorting: [] }, { ...state, sorting: [{ id: "added", desc: true }] })).toBe(true);
  });
});

describe("matchingView", () => {
  const state = currentViewState(desktop, UNREAD_LIVING_ROOM);
  const views = [view(1, "Unread", currentViewState(desktop, { status: UNREAD_LIVING_ROOM.status })), view(2, "Unread, living room", state)];

  it("finds the view the page is on; in the covers view the columns don't count", () => {
    expect(matchingView(views, state, "table")?.name).toBe("Unread, living room");
    const fewerColumns: SavedViewState = { ...state, columns: ["year"] };
    expect(matchingView(views, fewerColumns, "table")).toBeUndefined();
    expect(matchingView(views, fewerColumns, "covers")?.name).toBe("Unread, living room");
  });

  it("keeps a view's columns when it is updated from the covers view", () => {
    const current: SavedViewState = { ...state, columns: ["year"], filters: {} };
    expect(updatedViewState(views[1] as SavedView, current, "covers")).toEqual({ ...current, columns: state.columns });
    expect(updatedViewState(views[1] as SavedView, current, "table")).toEqual(current);
  });
});

describe("applyView", () => {
  const books = [
    book({ title: "Solenoid", shelf: "Living room · A1", status: "unread" }),
    book({ title: "Orbitor", shelf: "Living room · A2", status: "unread" }),
    book({ title: "Nostalgia", shelf: "Living room · A1", status: "read" }),
    book({ title: "Levantul", shelf: "Bedroom", status: "unread" }),
    book({ title: "Dune", shelf: null, status: "unread", collection: "wishlist" }),
  ];
  const rowsOf = (layout: Layout) => {
    const prefs = getPrefs(layout);
    return deriveView(books, { ...prefs, query: "", filters: getFilters() }).rows.map((b) => b.title);
  };

  it("saved on the desktop, shows the same rows on a phone", () => {
    updatePrefs("desktop", (p) => ({ ...p, sorting: [{ id: "book", desc: false }] }));
    setFilter("status", UNREAD_LIVING_ROOM.status ?? null);
    setFilter("shelf", UNREAD_LIVING_ROOM.shelf ?? null);
    const onDesktop = rowsOf("desktop");
    expect(onDesktop).toEqual(["Orbitor", "Solenoid"]);
    const saved = view(7, "Unread, living room", throughServer(currentStateOf("desktop")));

    // The phone: its own prefs (covers, newest first), and a session with no filters yet.
    clearFilters();
    expect(rowsOf("phone")).toHaveLength(4);
    applyView("phone", saved);
    expect(rowsOf("phone")).toEqual(onDesktop);
    expect(getPrefs("phone").view).toBe("covers");
    expect(shownColumns(getPrefs("phone"))).toEqual(saved.state.columns);
    expect(matchingView([saved], currentStateOf("phone"), "covers")?.id).toBe(7);
  });

  it("opens the view's tab and keeps its filters (a tab change from the page would clear them)", () => {
    const wishlist = view(3, "Wishlist without shelf", {
      collection: "wishlist",
      filters: { shelf: { kind: "pick", values: [""] } },
      sorting: [{ id: "book", desc: false }],
      columns: [],
    });
    applyView("desktop", wishlist);
    expect(getPrefs("desktop").collection).toBe("wishlist");
    expect(getFilters()).toEqual(wishlist.state.filters);
    expect(rowsOf("desktop")).toEqual(["Dune"]);
  });

  it("stops matching when a filter changes, and matches again once updated", () => {
    const saved = view(4, "Unread", throughServer(currentViewState(desktop, { status: UNREAD_LIVING_ROOM.status })));
    applyView("desktop", saved);
    expect(matchingView([saved], currentStateOf("desktop"), "table")?.name).toBe("Unread");

    setFilter("shelf", { kind: "pick", values: ["Bedroom"] });
    expect(matchingView([saved], currentStateOf("desktop"), "table")).toBeUndefined();

    const updated = { ...saved, state: throughServer(updatedViewState(saved, currentStateOf("desktop"), "table")) };
    expect(matchingView([updated], currentStateOf("desktop"), "table")?.name).toBe("Unread");
  });
});

describe("the view the page was last on", () => {
  it("is the one applied, saved or updated, until it is deleted", () => {
    applyView("desktop", view(5, "Unread", currentViewState(desktop, {})));
    expect(getLastViewId()).toBe(5);
    rememberView(9);
    expect(getLastViewId()).toBe(9);
    forgetView(8); // another view: nothing changes
    expect(getLastViewId()).toBe(9);
    forgetView(9);
    expect(getLastViewId()).toBeNull();
  });
});
