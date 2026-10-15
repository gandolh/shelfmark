import type { Book } from "@shelfmark/shared";
import { useDeferredValue, useEffect, useMemo } from "react";
import { useBooks } from "../books/store";
import { useSearchQuery } from "../layout/search";
import { BOOK_COLUMN_ID, columnById, type ColumnId, type LibraryColumn } from "./columns";
import { applyFilters, compileView, type Filters } from "./filters";
import type { Layout } from "./prefs";
import { warmSearch } from "./search";
import { sortBooks, type Sorting } from "./sort";
import { useLibraryFilters, useLibraryPrefs } from "./state";

/**
 * What the Library holds right now: the owned books after the search, the
 * filters and the sort (the rows both views show), and the table's shown
 * columns in order. Brief 11's "What you see now" export writes exactly
 * these: `view.rows`, one line each, with `view.columns` (or
 * `exportColumns(view.columns)`), each cell from `exportValue(column, book)`
 * or `column.text(book)` (columns.ts) under `column.label`.
 */
export interface LibraryView {
  /** Every owned book, in the server's order (oldest first): "Every book, every field" exports these. */
  owned: readonly Book[];
  /** How many owned books there are, before search and filters. */
  total: number;
  /** The owned books the search and filters let through, in the current order. */
  rows: readonly Book[];
  /** The table's shown columns, in order; the book column (cover, title, author) first. */
  columns: readonly LibraryColumn[];
  sorting: Sorting;
  filters: Filters;
  /** The search text the rows reflect (it can trail the box by a frame while typing). */
  query: string;
  /** Whether the search or a filter leaves books out. */
  narrowed: boolean;
}

export interface ViewState {
  query: string;
  filters: Filters;
  sorting: Sorting;
  columnOrder: readonly ColumnId[];
  columnVisibility: Readonly<Record<ColumnId, boolean>>;
}

/** v1 shows the owned books only; the wishlist brief adds the other collection. */
export function ownedBooks(books: readonly Book[]): readonly Book[] {
  return books.filter((book) => book.collection === "owned");
}

/** The shown columns in the saved order. */
export function visibleColumns(
  order: readonly ColumnId[],
  visibility: Readonly<Record<ColumnId, boolean>>,
): readonly LibraryColumn[] {
  const shown = order.filter((id) => id === BOOK_COLUMN_ID || visibility[id]);
  return [...new Set(shown)].map(columnById);
}

/**
 * The columns a spreadsheet of the view wants: the table's, with the book
 * column's author written out as an Author column right after the title,
 * unless Author is already shown.
 */
export function exportColumns(columns: readonly LibraryColumn[]): readonly LibraryColumn[] {
  if (columns.some((column) => column.id === "authors")) return columns;
  return columns.flatMap((column) => (column.id === BOOK_COLUMN_ID ? [column, columnById("authors")] : [column]));
}

/**
 * The view from scratch: owned books, sorted, then searched and filtered
 * (filtering keeps the order, so the page sorts once per sort change and
 * only filters while the owner types).
 */
export function deriveView(books: readonly Book[], state: ViewState): LibraryView {
  const owned = ownedBooks(books);
  const sorted = sortBooks(owned, state.sorting);
  return {
    owned,
    total: owned.length,
    rows: applyFilters(sorted, state.filters, state.query),
    columns: visibleColumns(state.columnOrder, state.columnVisibility),
    sorting: state.sorting,
    filters: state.filters,
    query: state.query,
    narrowed: compileView(state.filters, state.query) !== null,
  };
}

/** The view for a layout, from the books, the search box, the filters and the prefs. */
export function useLibraryView(layout: Layout): LibraryView {
  const { books } = useBooks();
  const prefs = useLibraryPrefs(layout);
  const filters = useLibraryFilters();
  // Typing stays instant; the rows catch up a frame later if they must.
  const query = useDeferredValue(useSearchQuery());

  const owned = useMemo(() => ownedBooks(books), [books]);
  useEffect(() => warmSearch(owned), [owned]);
  const sorted = useMemo(() => sortBooks(owned, prefs.sorting), [owned, prefs.sorting]);
  const rows = useMemo(() => applyFilters(sorted, filters, query), [sorted, filters, query]);
  const columns = useMemo(
    () => visibleColumns(prefs.columnOrder, prefs.columnVisibility),
    [prefs.columnOrder, prefs.columnVisibility],
  );

  return useMemo(
    () => ({
      owned,
      total: owned.length,
      rows,
      columns,
      sorting: prefs.sorting,
      filters,
      query,
      narrowed: compileView(filters, query) !== null,
    }),
    [owned, rows, columns, prefs.sorting, filters, query],
  );
}
