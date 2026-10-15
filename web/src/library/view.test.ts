import { describe, expect, it } from "vitest";
import { columnById, exportValue, formatAdded } from "./columns";
import { applyFilters, type Filters } from "./filters";
import { defaultPrefs } from "./prefs";
import { searchBooks } from "./search";
import { DEFAULT_SORTING, sortBooks } from "./sort";
import { book, syntheticLibrary } from "./test-books";
import { deriveView, exportColumns, visibleColumns, type ViewState } from "./view";

const defaults = defaultPrefs("desktop");
const state = (overrides: Partial<ViewState> = {}): ViewState => ({
  query: "",
  filters: {},
  sorting: DEFAULT_SORTING,
  columnOrder: defaults.columnOrder,
  columnVisibility: defaults.columnVisibility,
  ...overrides,
});

describe("deriveView", () => {
  const books = [
    book({ title: "Solenoid", shelf: "Bedroom", createdAt: "2026-01-03T00:00:00.000Z" }),
    book({ title: "Dune", shelf: "Study · B1", collection: "wishlist", createdAt: "2026-01-04T00:00:00.000Z" }),
    book({ title: "Orbitor", shelf: "Bedroom", createdAt: "2026-01-02T00:00:00.000Z" }),
    book({ title: "Nostalgia", shelf: "Study · B1", createdAt: "2026-01-01T00:00:00.000Z" }),
  ];

  it("holds the owned books only, newest first", () => {
    const view = deriveView(books, state());
    expect(view.total).toBe(3);
    expect(view.rows.map((b) => b.title)).toEqual(["Solenoid", "Orbitor", "Nostalgia"]);
    expect(view.narrowed).toBe(false);
  });

  it("holds the rows after search, filters and sort", () => {
    const view = deriveView(
      books,
      state({ filters: { shelf: { kind: "pick", values: ["Bedroom"] } }, sorting: [{ id: "book", desc: false }] }),
    );
    expect(view.rows.map((b) => b.title)).toEqual(["Orbitor", "Solenoid"]);
    expect(view.narrowed).toBe(true);
    expect(deriveView(books, state({ query: "orb" })).rows.map((b) => b.title)).toEqual(["Orbitor"]);
  });

  it("holds the shown columns in order", () => {
    const view = deriveView(
      books,
      state({
        columnOrder: ["book", "shelf", "publisher", ...defaults.columnOrder.filter((id) => !["book", "shelf", "publisher"].includes(id))],
        columnVisibility: { ...defaults.columnVisibility, year: false, notes: true },
      }),
    );
    expect(view.columns.map((column) => column.id)).toEqual(["book", "shelf", "publisher", "status", "added", "notes"]);
  });
});

describe("exportColumns", () => {
  it("writes the book column's author out after the title", () => {
    const columns = visibleColumns(defaults.columnOrder, defaults.columnVisibility);
    expect(exportColumns(columns).map((column) => column.label)).toEqual([
      "Title",
      "Author",
      "Publisher",
      "Year",
      "Shelf",
      "Status",
      "Added",
    ]);
    const withAuthor = visibleColumns(defaults.columnOrder, { ...defaults.columnVisibility, authors: true });
    expect(exportColumns(withAuthor)).toBe(withAuthor);
  });

  it("gives typed cell values", () => {
    const solenoid = book({ title: "Solenoid", authors: ["Mircea Cărtărescu"], priceMinor: 5990, status: "reading", signed: true });
    expect(exportValue(columnById("book"), solenoid)).toBe("Solenoid");
    expect(exportValue(columnById("authors"), solenoid)).toBe("Mircea Cărtărescu");
    expect(exportValue(columnById("price"), solenoid)).toBe(59.9);
    expect(exportValue(columnById("status"), solenoid)).toBe("Reading");
    expect(exportValue(columnById("signed"), solenoid)).toBe(true);
    expect(exportValue(columnById("shelf"), solenoid)).toBeNull();
    expect(columnById("price").text(solenoid)).toBe("RON\u00a059.90"); // a no-break space keeps the code with the amount
  });
});

describe("formatAdded", () => {
  const now = new Date(2026, 9, 15, 12);
  it("says today, yesterday, a day this year, or a day with its year", () => {
    expect(formatAdded(new Date(2026, 9, 15, 8).toISOString(), now)).toBe("Today");
    expect(formatAdded(new Date(2026, 9, 14, 23).toISOString(), now)).toBe("Yesterday");
    expect(formatAdded(new Date(2026, 9, 12, 9).toISOString(), now)).toBe("12 Oct");
    expect(formatAdded(new Date(2025, 2, 3, 9).toISOString(), now)).toBe("3 Mar 2025");
  });
});

describe("3,000 books", () => {
  const library = syntheticLibrary(3000);
  const time = (run: () => unknown) => {
    const start = performance.now();
    run();
    return performance.now() - start;
  };

  it("searches and filters in under 50 ms", () => {
    // Best of five, so a busy test machine's hiccup doesn't count against the code.
    const best = (run: () => unknown) => Math.min(...Array.from({ length: 5 }, () => time(run)));

    // The page sorts once per sort change; typing and filtering only filter the sorted list.
    const sortTime = best(() => sortBooks(library, DEFAULT_SORTING));
    const titleSortTime = best(() => sortBooks(library, [{ id: "book", desc: false }, { id: "authors", desc: false }]));
    const sorted = sortBooks(library, DEFAULT_SORTING);

    // The first search folds every book's text once; the page does that ahead, while idle.
    const cold = time(() => applyFilters(sorted, {}, "c"));
    const typing = ["c", "ca", "car", "cart", "carta", "cartar", "cartarescu", "cartarescu v"];
    const keystrokes = typing.map((query) => best(() => applyFilters(sorted, {}, query)));

    const shelf: Filters = { shelf: { kind: "pick", values: ["Bedroom", "Study · B1"] } };
    const both: Filters = { ...shelf, year: { kind: "number", min: 1990, max: 2010 } };
    const toggles = [shelf, both, {}].map((filters) => best(() => applyFilters(sorted, filters, "cartarescu")));
    const full = best(() => deriveView(library, state({ query: "humanitas", filters: both })));

    console.info(
      `3,000 books: sort newest ${sortTime.toFixed(1)} ms, title+author ${titleSortTime.toFixed(1)} ms; ` +
        `first search (cold) ${cold.toFixed(1)} ms; keystrokes ${keystrokes.map((t) => t.toFixed(1)).join("/")} ms; ` +
        `filter toggles ${toggles.map((t) => t.toFixed(1)).join("/")} ms; whole view from scratch ${full.toFixed(1)} ms`,
    );
    for (const t of [...keystrokes, ...toggles, full]) expect(t).toBeLessThan(50);
    expect(searchBooks(library, "cartarescu").length).toBeGreaterThan(0);
  });
});
