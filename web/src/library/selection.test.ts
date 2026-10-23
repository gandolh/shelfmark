import { LIBRARY_COLUMN_IDS } from "@shelfmark/shared";
import { afterEach, describe, expect, it } from "vitest";
import { defaultPrefs, type Layout } from "./prefs";
import {
  NO_SELECTION,
  isSelected,
  selectAllState,
  selectedBooks,
  summarizeSelection,
  toggleAll,
  toggleBook,
  withBooks,
  withoutIds,
} from "./selection";
import { clearFilters, clearSelection, getFilters, getPrefs, getSelection, setFilter, setSelection, updatePrefs } from "./state";
import { book } from "./test-books";
import { deriveView, type ViewState } from "./view";

const prefs = defaultPrefs("desktop");
const state = (overrides: Partial<ViewState> = {}): ViewState => ({
  collection: "owned",
  query: "",
  filters: {},
  sorting: [{ id: "book", desc: false }],
  columnOrder: prefs.columnOrder,
  columnVisibility: prefs.columnVisibility,
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

afterEach(() => {
  clearSelection();
  clearFilters();
  for (const layout of ["desktop", "phone"] as Layout[]) updatePrefs(layout, () => defaultPrefs(layout));
});

describe("select all", () => {
  it("selects the rows the filters show, not every book", () => {
    const view = deriveView(library, onShelfA1);
    const selection = toggleAll(NO_SELECTION, view.rows);
    // What the bulk bar sends: the shown rows, and none the filter hides.
    expect(titles(selectedBooks(selection, library))).toEqual(["Solenoid", "Orbitor", "Levantul"]);
    expect(selectAllState(selection, view.rows)).toBe("all");
    expect(selectAllState(selection, deriveView(library, state()).rows)).toBe("some");
  });

  it("selects only what the search lets through too", () => {
    const view = deriveView(library, state({ query: "orb" }));
    expect(titles(selectedBooks(toggleAll(NO_SELECTION, view.rows), library))).toEqual(["Orbitor"]);
  });

  it("unselects the shown rows once they all are, and keeps the hidden ones", () => {
    const nostalgia = library[2]!;
    const before = withBooks(NO_SELECTION, [nostalgia], true);
    const rows = deriveView(library, onShelfA1).rows;
    const all = toggleAll(before, rows);
    expect(selectedBooks(all, library)).toHaveLength(4);
    expect(titles(selectedBooks(toggleAll(all, rows), library))).toEqual(["Nostalgia"]);
  });

  it("is none, some or all of the rows on show", () => {
    const rows = deriveView(library, onShelfA1).rows;
    expect(selectAllState(NO_SELECTION, rows)).toBe("none");
    expect(selectAllState(toggleBook(NO_SELECTION, rows[0]!), rows)).toBe("some");
    expect(selectAllState(NO_SELECTION, [])).toBe("none");
  });
});

describe("the selection", () => {
  it("survives sorting, filtering, searching and switching tab until cleared", () => {
    const rows = deriveView(library, onShelfA1).rows;
    setSelection(toggleAll(getSelection(), rows));
    const selection = getSelection();

    updatePrefs("desktop", (p) => ({ ...p, sorting: [{ id: "year", desc: true }] }));
    setFilter("status", { kind: "pick", values: ["read"] });
    updatePrefs("desktop", (p) => ({ ...p, collection: "wishlist" }));
    clearFilters();
    expect(getSelection()).toBe(selection);

    // Sorted the other way, the same books are selected; filtered to read books, two of them are out of sight.
    expect(getFilters()).toEqual({});
    const resorted = deriveView(library, state({ sorting: [{ id: "book", desc: true }] }));
    expect(resorted.rows.filter((b) => isSelected(selection, b)).map((b) => b.title)).toEqual(["Solenoid", "Orbitor", "Levantul"]);
    const narrowed = deriveView(library, state({ filters: { status: { kind: "pick", values: ["read"] } } }));
    expect(summarizeSelection(selectedBooks(selection, library), narrowed.rows)).toEqual({ count: 3, hidden: 2, owned: 3 });

    clearSelection();
    expect(getSelection().size).toBe(0);
  });

  it("is not a column: saved views, the column picker and the layout never hold it", () => {
    setSelection(toggleBook(getSelection(), library[0]!));
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

  it("counts the selected books, those out of sight and those owned", () => {
    const selection = withBooks(NO_SELECTION, [library[0]!, library[2]!, library[4]!], true);
    const rows = deriveView(library, onShelfA1).rows;
    expect(summarizeSelection(selectedBooks(selection, library), rows)).toEqual({ count: 3, hidden: 2, owned: 2 });
    expect(summarizeSelection([], rows)).toEqual({ count: 0, hidden: 0, owned: 0 });
  });
});
