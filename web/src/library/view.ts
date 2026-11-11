import type { Book, Collection } from "@shelfmark/shared";
import { useDeferredValue, useEffect, useMemo } from "react";
import { useBooks } from "../books/store";
import { useSearchQuery } from "../layout/search";
import type { ColumnId, LibraryColumn } from "./columns";
import { applyFilters, compileView, type Filters } from "./filters";
import { clampPage, DEFAULT_PAGE_SIZE, pageCount, pageSlice, type PageSize } from "./pagination";
import type { Layout } from "./prefs";
import { warmSearch } from "./search";
import { sortBooks, type Sorting } from "./sort";
import {
  forgetPage,
  pageFor,
  samePageBasis,
  useLibraryFilters,
  useLibraryPage,
  useLibraryPrefs,
  type PageBasis,
} from "./state";

/**
 * What the Library holds right now: the open collection's books after the
 * search, the filters and the sort (`rows`, every page of them), and the
 * page on show (`pageRows`, what the table and the covers render).
 */
export interface LibraryView {
  /** The open collection. */
  collection: Collection;
  /** How many books each collection holds, for the tabs. */
  counts: Readonly<Record<Collection, number>>;
  /** Every book in the open collection, in the server's order (oldest first). */
  books: readonly Book[];
  /** How many books the open collection has, before search and filters. */
  total: number;
  /** The books the search and filters let through, in the current order, on every page. */
  rows: readonly Book[];
  /** The page on show, from 1; never past the last one, so a list that shrinks lands on its new last page. */
  page: number;
  /** How many pages `rows` makes: 1 when it fits on one page, or is empty. */
  pageCount: number;
  pageSize: PageSize;
  /** The page's rows: what the table and the covers render. */
  pageRows: readonly Book[];
  /** What the page number belongs to; turning the page records it with the number (state.ts `setPage`). */
  pageBasis: PageBasis;
  sorting: Sorting;
  filters: Filters;
  /** The search text the rows reflect (it can trail the box by a frame while typing). */
  query: string;
  /** Whether the search or a filter leaves books out. */
  narrowed: boolean;
}

export interface ViewState {
  collection: Collection;
  query: string;
  filters: Filters;
  sorting: Sorting;
  /** Default 10. */
  pageSize?: PageSize;
  /** Default 1; clamped to the pages there are. */
  page?: number;
}

/** The books of one collection. */
export function booksIn(books: readonly Book[], collection: Collection): readonly Book[] {
  return books.filter((book) => book.collection === collection);
}

/** The columns a wishlist row never fills (a wishlist book has no shelf, condition or acquisition). */
const WISHLIST_EMPTY: ReadonlySet<ColumnId> = new Set<ColumnId>(["shelf", "condition", "acquiredOn", "acquiredFrom"]);

/** Whether a collection shows this column at all. */
export function columnApplies(id: ColumnId, collection: Collection): boolean {
  return collection === "owned" || !WISHLIST_EMPTY.has(id);
}

/** The columns that make sense for a collection, in the order given. */
export function columnsIn(collection: Collection, columns: readonly LibraryColumn[]): readonly LibraryColumn[] {
  return columns.filter((column) => columnApplies(column.id, collection));
}

/** How many books each collection holds. */
export function collectionCounts(books: readonly Book[]): Record<Collection, number> {
  const counts: Record<Collection, number> = { owned: 0, wishlist: 0 };
  for (const book of books) counts[book.collection] += 1;
  return counts;
}

/**
 * The view from scratch: the collection's books, sorted, then searched and filtered
 * (filtering keeps the order, so the page sorts once per sort change and
 * only filters while the owner types).
 */
export function deriveView(books: readonly Book[], state: ViewState): LibraryView {
  const inCollection = booksIn(books, state.collection);
  const sorted = sortBooks(inCollection, state.sorting);
  const rows = applyFilters(sorted, state.filters, state.query);
  const pageSize = state.pageSize ?? DEFAULT_PAGE_SIZE;
  const pages = pageCount(rows.length, pageSize);
  const page = clampPage(state.page ?? 1, pages);
  return {
    collection: state.collection,
    counts: collectionCounts(books),
    books: inCollection,
    total: inCollection.length,
    rows,
    page,
    pageCount: pages,
    pageSize,
    pageRows: pageSlice(rows, page, pageSize),
    pageBasis: {
      collection: state.collection,
      query: state.query,
      filters: state.filters,
      sorting: state.sorting,
      pageSize,
    },
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

  const { collection } = prefs;
  const counts = useMemo(() => collectionCounts(books), [books]);
  const inCollection = useMemo(() => booksIn(books, collection), [books, collection]);
  useEffect(() => warmSearch(inCollection), [inCollection]);
  const sorted = useMemo(() => sortBooks(inCollection, prefs.sorting), [inCollection, prefs.sorting]);
  const rows = useMemo(() => applyFilters(sorted, filters, query), [sorted, filters, query]);

  // The page: the one last turned to while nothing it belongs to changed, else 1; past the end, the last.
  const { pageSize, sorting } = prefs;
  const pageBasis = useMemo<PageBasis>(
    () => ({ collection, query, filters, sorting, pageSize }),
    [collection, query, filters, sorting, pageSize],
  );
  const choice = useLibraryPage();
  // A page whose list has changed is forgotten, not kept for when the list comes back.
  useEffect(() => {
    if (choice !== null && !samePageBasis(choice.basis, pageBasis)) forgetPage();
  }, [choice, pageBasis]);
  const pages = pageCount(rows.length, pageSize);
  const page = clampPage(pageFor(choice, pageBasis), pages);
  const pageRows = useMemo(() => pageSlice(rows, page, pageSize), [rows, page, pageSize]);

  return useMemo(
    () => ({
      collection,
      counts,
      books: inCollection,
      total: inCollection.length,
      rows,
      page,
      pageCount: pages,
      pageSize,
      pageRows,
      pageBasis,
      sorting,
      filters,
      query,
      narrowed: compileView(filters, query) !== null,
    }),
    [collection, counts, inCollection, rows, page, pages, pageSize, pageRows, pageBasis, sorting, filters, query],
  );
}
