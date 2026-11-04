import type { Collection } from "@shelfmark/shared";
import { useSyncExternalStore } from "react";
import type { ColumnId } from "./columns";
import type { Filter, Filters } from "./filters";
import { browserStorage, readPrefs, writePrefs, type Layout, type LibraryPrefs } from "./prefs";
import { withoutIds, type Selection, type SelectionScope } from "./selection";
import type { Sorting } from "./sort";

/**
 * The Library's state that outlives the page: the prefs (saved per layout,
 * read once per session), the filters, the page and the row selection (this
 * session only). Opening a book unmounts the page; coming Back finds them as
 * they were left, as the search text is in layout/search.ts.
 */

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  for (const listener of listeners) listener();
}

// --- Prefs ------------------------------------------------------------------------

const prefs: Partial<Record<Layout, LibraryPrefs>> = {};
const saveTimers: Partial<Record<Layout, ReturnType<typeof setTimeout>>> = {};
// A column being dragged wider changes the prefs every frame; one write
// after it settles is enough.
const SAVE_DELAY = 300;

export function getPrefs(layout: Layout): LibraryPrefs {
  let current = prefs[layout];
  if (!current) {
    current = readPrefs(browserStorage(), layout);
    prefs[layout] = current;
  }
  return current;
}

function save(layout: Layout): void {
  delete saveTimers[layout];
  const current = prefs[layout];
  if (current) writePrefs(browserStorage(), layout, current);
}

/** Change a layout's prefs; saved shortly after. */
export function updatePrefs(layout: Layout, update: (current: LibraryPrefs) => LibraryPrefs): void {
  const current = getPrefs(layout);
  const next = update(current);
  if (next === current) return;
  prefs[layout] = next;
  notify();
  clearTimeout(saveTimers[layout]);
  saveTimers[layout] = setTimeout(() => save(layout), SAVE_DELAY);
}

// A change still waiting when the tab goes away is written then.
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    for (const layout of Object.keys(saveTimers) as Layout[]) {
      clearTimeout(saveTimers[layout]);
      save(layout);
    }
  });
}

/** The layout's prefs; re-renders when they change. */
export function useLibraryPrefs(layout: Layout): LibraryPrefs {
  return useSyncExternalStore(subscribe, () => getPrefs(layout));
}

// --- Filters ------------------------------------------------------------------------

let filters: Filters = {};

export function getFilters(): Filters {
  return filters;
}

/** Set one column's filter; `null` removes it. */
export function setFilter(id: ColumnId, filter: Filter | null): void {
  const next: Partial<Record<ColumnId, Filter>> = { ...filters };
  if (filter) next[id] = filter;
  else delete next[id];
  filters = next;
  notify();
}

export function clearFilters(): void {
  if (Object.keys(filters).length === 0) return;
  filters = {};
  notify();
}

/** Replace every filter at once: a saved view being applied (savedViews.ts). */
export function setFilters(next: Filters): void {
  if (next === filters) return;
  filters = next;
  notify();
}

/** The filters; re-renders when they change. */
export function useLibraryFilters(): Filters {
  return useSyncExternalStore(subscribe, getFilters);
}

// --- Page ---------------------------------------------------------------------------

/**
 * What a page number belongs to: the tab, the search text, the filters, the
 * sort and the page size it was turned on. Filters and sort are compared by
 * identity: every change replaces them (as does applying a saved view), and
 * nothing else does, so the same objects mean nothing changed.
 */
export interface PageBasis {
  readonly collection: Collection;
  readonly query: string;
  readonly filters: Filters;
  readonly sorting: Sorting;
  readonly pageSize: number;
}

export interface PageChoice {
  readonly page: number;
  readonly basis: PageBasis;
}

let pageChoice: PageChoice | null = null;

export function samePageBasis(a: PageBasis, b: PageBasis): boolean {
  return (
    a.collection === b.collection &&
    a.query === b.query &&
    a.filters === b.filters &&
    a.sorting === b.sorting &&
    a.pageSize === b.pageSize
  );
}

/**
 * The page asked for while `basis` holds; page 1 once any of it changed. So
 * a new search, a filter, a sort, a page size, a tab or a saved view starts
 * on page 1 without each of them having to say so, and Back from a book
 * finds the page it left. view.ts forgets a page whose basis has gone
 * (`forgetPage`), so going to the Wishlist and back, or clearing a search,
 * doesn't bring an old page back either.
 */
export function pageFor(choice: PageChoice | null, basis: PageBasis): number {
  return choice !== null && samePageBasis(choice.basis, basis) ? choice.page : 1;
}

/** Turn to a page of the list `basis` describes (view.ts's `pageBasis`). */
export function setPage(page: number, basis: PageBasis): void {
  if (pageChoice !== null && pageChoice.page === page && samePageBasis(pageChoice.basis, basis)) return;
  pageChoice = { page, basis };
  notify();
}

/** Drop the page last turned to: the list it belonged to is gone. */
export function forgetPage(): void {
  if (pageChoice === null) return;
  pageChoice = null;
  notify();
}

export function getPageChoice(): PageChoice | null {
  return pageChoice;
}

/** The page last turned to, with what it belongs to; re-renders when it changes. */
export function useLibraryPage(): PageChoice | null {
  return useSyncExternalStore(subscribe, getPageChoice);
}

// --- Selection ------------------------------------------------------------

/**
 * The ticked books, what they cover (the page, or every page after "Select
 * all"), and the list and page they were ticked on. The selection belongs to
 * that list: a sort, a filter, the search, the tab, a page size or a saved
 * view lets it go, as does a turn of the page unless the owner chose "Select
 * all". So a bulk change never reaches a book the owner can't see
 * (selection.ts). Opening a book and coming Back keeps it, as it keeps the page.
 */
export interface SelectionChoice {
  readonly books: Selection;
  readonly scope: SelectionScope;
  readonly basis: PageBasis;
  readonly page: number;
}

let selection: SelectionChoice | null = null;

/** The selection in force on page `page` of the list `basis` describes; `null` once it no longer applies. */
export function selectionFor(choice: SelectionChoice | null, basis: PageBasis, page: number): SelectionChoice | null {
  if (choice === null || !samePageBasis(choice.basis, basis)) return null;
  return choice.scope === "all" || choice.page === page ? choice : null;
}

export function getSelection(): SelectionChoice | null {
  return selection;
}

/** Tick `books` on page `page` of the list `basis` describes (selection.ts makes the set); none ticked lets go. */
export function setSelection(books: Selection, basis: PageBasis, page: number, scope: SelectionScope = "page"): void {
  if (books.size === 0) {
    clearSelection();
    return;
  }
  const old = selection;
  if (old !== null && old.books === books && old.scope === scope && old.page === page && samePageBasis(old.basis, basis)) return;
  selection = { books, scope, basis, page };
  notify();
}

/** A bulk delete took these books out of the selection. */
export function dropFromSelection(ids: readonly number[]): void {
  if (selection === null) return;
  const books = withoutIds(selection.books, ids);
  if (books === selection.books) return;
  selection = books.size === 0 ? null : { ...selection, books };
  notify();
}

/** The bulk bar's Clear, "Clear selection", or a selection that no longer applies. */
export function clearSelection(): void {
  if (selection === null) return;
  selection = null;
  notify();
}

/** The selection with where it was made; re-renders when it changes. */
export function useLibrarySelection(): SelectionChoice | null {
  return useSyncExternalStore(subscribe, getSelection);
}
