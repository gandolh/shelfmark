import { LIBRARY_COLUMN_IDS } from "@shelfmark/shared";
import { afterEach, describe, expect, it } from "vitest";
import { defaultPrefs, type Layout } from "./prefs";
import {
  NO_SELECTION,
  isSelected,
  pageTicks,
  reachedBooks,
  selectAllState,
  selectedBooks,
  selectionLine,
  summarizeSelection,
  toggleAll,
  toggleBook,
  withBooks,
  withoutIds,
} from "./selection";
import {
  clearFilters,
  clearSelection,
  dropFromSelection,
  getPrefs,
  getSelection,
  selectionFor,
  setSelection,
  updatePrefs,
} from "./state";
import { book } from "./test-books";
import { deriveView, type ViewState } from "./view";

const state = (overrides: Partial<ViewState> = {}): ViewState => ({
  collection: "owned",
  query: "",
  filters: {},
  sorting: [{ id: "book", desc: false }],
  ...overrides,
});

const library = [
  book({ title: "Solenoid", shelf: "Living room · A1" }),
  book({ title: "Orbitor", shelf: "Living room · A1" }),
  book({ title: "Nostalgia", shelf: "Study · C2" }),
  book({ title: "Levantul", shelf: "Living room · A1", status: "read" }),
  book({ title: "Dune", collection: "wishlist" }),
];
const titles = (books: readonly { title: string }[]) => books.map((b) => b.title);
const onShelfA1 = state({ filters: { shelf: { kind: "pick", values: ["Living room · A1"] } } });

// 23 owned books, "Shelf 01" to "Shelf 23" in title order: three pages of 10, 10 and 3.
const shelf = Array.from({ length: 23 }, (_, i) => book({ title: `Shelf ${String(i + 1).padStart(2, "0")}` }));
const paged = state({ pageSize: 10 });

afterEach(() => {
  clearSelection();
  clearFilters();
  for (const layout of ["desktop", "phone"] as Layout[]) updatePrefs(layout, () => defaultPrefs(layout));
});

describe("the header's box", () => {
  it("ticks the page on show, not every page", () => {
    const view = deriveView(shelf, { ...paged, page: 2 });
    const selection = toggleAll(NO_SELECTION, view.pageRows);
    expect(titles(selectedBooks(selection, shelf))).toEqual(titles(shelf.slice(10, 20)));
    expect(selectAllState(selection, view.pageRows)).toBe("all");
    expect(selectAllState(selection, view.rows)).toBe("some");
  });

  it("ticks only what the search lets through on the page", () => {
    const view = deriveView(library, state({ query: "orb" }));
    expect(titles(selectedBooks(toggleAll(NO_SELECTION, view.pageRows), library))).toEqual(["Orbitor"]);
  });

  it("unticks the page once it all is", () => {
    const rows = deriveView(library, onShelfA1).pageRows;
    const all = toggleAll(NO_SELECTION, rows);
    expect(selectedBooks(all, library)).toHaveLength(3);
    expect(selectedBooks(toggleAll(all, rows), library)).toEqual([]);
  });

  it("is none, some or all of the page", () => {
    const rows = deriveView(library, onShelfA1).pageRows;
    expect(selectAllState(NO_SELECTION, rows)).toBe("none");
    expect(selectAllState(toggleBook(NO_SELECTION, rows[0]!), rows)).toBe("some");
    expect(selectAllState(NO_SELECTION, [])).toBe("none");
  });
});

describe("what a bulk change reaches", () => {
  it("is the ticked books on the page, never one off it", () => {
    const page1 = deriveView(shelf, paged);
    const page2 = deriveView(shelf, { ...paged, page: 2 });
    // Ticks left over from page 1 (however they got there) don't come along on page 2.
    const selection = withBooks(withBooks(NO_SELECTION, page1.pageRows, true), page2.pageRows.slice(0, 2), true);
    expect(titles(reachedBooks(selection, "page", page2))).toEqual(["Shelf 11", "Shelf 12"]);
    expect(titles(selectedBooks(pageTicks(selection, page2.pageRows), shelf))).toEqual(["Shelf 11", "Shelf 12"]);
  });

  it("is every book in the list after Select all, and none the filters leave out", () => {
    const view = deriveView(library, onShelfA1);
    const everything = withBooks(NO_SELECTION, view.rows, true);
    expect(titles(reachedBooks(everything, "all", view))).toEqual(["Levantul", "Orbitor", "Solenoid"]);

    const pages = deriveView(shelf, { ...paged, page: 3 });
    const all = withBooks(NO_SELECTION, pages.rows, true);
    expect(reachedBooks(all, "all", pages)).toHaveLength(23);
    expect(reachedBooks(all, "page", pages)).toHaveLength(3);
  });
});

describe("the line above the list", () => {
  it("offers the page, then every page, then Clear", () => {
    const view = deriveView(shelf, paged);
    expect(selectionLine(NO_SELECTION, "page", view)).toBeNull();
    expect(selectionLine(toggleBook(NO_SELECTION, view.pageRows[0]!), "page", view)).toEqual({
      kind: "page",
      page: 10,
    });
    const page = toggleAll(NO_SELECTION, view.pageRows);
    expect(selectionLine(page, "page", view)).toEqual({ kind: "more", page: 10, total: 23 });
    const all = withBooks(NO_SELECTION, view.rows, true);
    expect(selectionLine(all, "all", view)).toEqual({ kind: "all", total: 23 });
  });

  it("says every book is ticked when the list fits on the page", () => {
    const view = deriveView(library, onShelfA1);
    expect(selectionLine(toggleAll(NO_SELECTION, view.pageRows), "page", view)).toEqual({ kind: "all", total: 3 });
  });

  it("is gone when a change took every ticked book out of the list", () => {
    const view = deriveView(library, onShelfA1);
    const elsewhere = withBooks(NO_SELECTION, [library[2]!], true);
    expect(selectionLine(elsewhere, "all", view)).toBeNull();
    expect(selectionLine(elsewhere, "page", view)).toBeNull();
  });
});

describe("the selection", () => {
  it("is let go when the page, the sort, a filter, the search, the tab or the size changes", () => {
    const view = deriveView(shelf, { ...paged, page: 2 });
    setSelection(toggleAll(NO_SELECTION, view.pageRows), view.pageBasis, view.page);
    const choice = getSelection();
    expect(selectionFor(choice, view.pageBasis, 2)).toBe(choice);
    // Back from a book: the same list, the same page.
    expect(selectionFor(choice, deriveView(shelf, { ...paged, page: 2 }).pageBasis, 2)).toBe(choice);

    expect(selectionFor(choice, view.pageBasis, 3)).toBeNull();
    for (const changed of [
      { ...paged, sorting: [{ id: "year" as const, desc: true }] },
      { ...paged, filters: { status: { kind: "pick" as const, values: ["read"] } } },
      { ...paged, query: "shelf" },
      { ...paged, collection: "wishlist" as const },
      { ...paged, pageSize: 25 as const },
    ]) {
      expect(selectionFor(choice, deriveView(shelf, changed).pageBasis, 2)).toBeNull();
    }
  });

  it("outlives a turn of the page after Select all, and nothing else", () => {
    const view = deriveView(shelf, paged);
    setSelection(withBooks(NO_SELECTION, view.rows, true), view.pageBasis, view.page, "all");
    const choice = getSelection();
    expect(selectionFor(choice, view.pageBasis, 3)).toBe(choice);
    expect(selectionFor(choice, deriveView(shelf, { ...paged, query: "shelf" }).pageBasis, 1)).toBeNull();
  });

  it("lets go when nothing is ticked, and when a delete took every ticked book", () => {
    const view = deriveView(library, onShelfA1);
    setSelection(NO_SELECTION, view.pageBasis, view.page);
    expect(getSelection()).toBeNull();

    const [a, b] = view.pageRows;
    setSelection(withBooks(NO_SELECTION, [a!, b!], true), view.pageBasis, view.page);
    dropFromSelection([a!.id]);
    expect([...getSelection()!.books.keys()]).toEqual([b!.id]);
    dropFromSelection([b!.id]);
    expect(getSelection()).toBeNull();
  });

  it("is not a column: saved views, the column picker and the layout never hold it", () => {
    const view = deriveView(library, state());
    setSelection(toggleBook(NO_SELECTION, library[0]!), view.pageBasis, view.page);
    expect(Object.keys(getPrefs("desktop").columnVisibility)).not.toContain("select");
    expect(getPrefs("desktop").columnOrder).toEqual(defaultPrefs("desktop").columnOrder);
    expect(LIBRARY_COLUMN_IDS).not.toContain("select");
  });

  it("doesn't select a new book that took a deleted one's id", () => {
    const old = book({ id: 900, title: "Gone", createdAt: "2026-01-01T09:00:00.000Z" });
    const selection = withBooks(NO_SELECTION, [old], true);
    const reused = book({ id: 900, title: "New", createdAt: "2026-10-23T09:00:00.000Z" });
    expect(isSelected(selection, reused)).toBe(false);
    expect(selectedBooks(selection, [reused])).toEqual([]);
  });

  it("drops what a delete took, and stays the same object when nothing changes", () => {
    const [a, b] = library;
    const selection = withBooks(NO_SELECTION, [a!, b!], true);
    expect(withBooks(selection, [a!], true)).toBe(selection);
    expect(withoutIds(selection, [999])).toBe(selection);
    expect([...withoutIds(selection, [a!.id]).keys()]).toEqual([b!.id]);
  });

  it("counts the selected books and those owned", () => {
    expect(summarizeSelection([library[0]!, library[2]!, library[4]!])).toEqual({ count: 3, owned: 2 });
    expect(summarizeSelection([])).toEqual({ count: 0, owned: 0 });
  });
});
