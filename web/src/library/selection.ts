import type { Book } from "@shelfmark/shared";

/**
 * Row selection: the books ticked in the table, or long-pressed in
 * the covers, for the bulk bar. Kept by id with the `createdAt` each had
 * when ticked, so a new book that takes a deleted one's id (SQLite reuses the
 * highest) is not selected by accident.
 *
 * The ticks belong to the page on show: the header's box ticks that page,
 * and a bulk change reaches only the ticked books on it, unless the owner
 * chose "Select all", which ticks every book the search and filters let
 * through, on every page (`SelectionScope`). state.ts keeps the selection
 * with the list and the page it was made on and lets it go when either
 * changes, so a bulk change never reaches a book the owner can't see.
 */
export type Selection = ReadonlyMap<number, string>;

export const NO_SELECTION: Selection = new Map();

export function isSelected(selection: Selection, book: Pick<Book, "id" | "createdAt">): boolean {
  return selection.get(book.id) === book.createdAt;
}

/** The selection with these books ticked (`true`) or not; the same object when that changes nothing. */
export function withBooks(selection: Selection, books: readonly Book[], selected: boolean): Selection {
  let next: Map<number, string> | null = null;
  for (const book of books) {
    if (isSelected(selection, book) === selected) continue;
    next ??= new Map(selection);
    if (selected) next.set(book.id, book.createdAt);
    else next.delete(book.id);
  }
  return next ?? selection;
}

/** One book ticked or unticked. */
export function toggleBook(selection: Selection, book: Book): Selection {
  return withBooks(selection, [book], !isSelected(selection, book));
}

/** The selection less these ids: the books a bulk delete took out. */
export function withoutIds(selection: Selection, ids: readonly number[]): Selection {
  if (!ids.some((id) => selection.has(id))) return selection;
  const next = new Map(selection);
  for (const id of ids) next.delete(id);
  return next;
}

export type SelectAllState = "none" | "some" | "all";

/** The header's box: whether the rows given (the page on show) are all, some or none of them selected. */
export function selectAllState(selection: Selection, rows: readonly Book[]): SelectAllState {
  let count = 0;
  for (const row of rows) if (isSelected(selection, row)) count += 1;
  return count === 0 ? "none" : count === rows.length ? "all" : "some";
}

/** The header's box pressed: every row given (the page on show) selected, or, when they all were, none of them. */
export function toggleAll(selection: Selection, rows: readonly Book[]): Selection {
  return withBooks(selection, rows, selectAllState(selection, rows) !== "all");
}

/** The selected books still in the list, in its order. */
export function selectedBooks(selection: Selection, books: readonly Book[]): Book[] {
  return selection.size === 0 ? [] : books.filter((book) => isSelected(selection, book));
}

export interface SelectionSummary {
  /** How many books are selected. */
  count: number;
  /** How many of them are owned: a shelf change applies to these only. */
  owned: number;
}

export function summarizeSelection(selected: readonly Book[]): SelectionSummary {
  return { count: selected.length, owned: selected.filter((book) => book.collection === "owned").length };
}

// --- The page, and "Select all" ---------------------------------------------------------

/** What the ticks cover: the page on show, or, once the owner chose "Select all", every page of the list. */
export type SelectionScope = "page" | "all";

/** The page on show and the list it is cut from: view.ts's `pageRows` and `rows`. */
export interface SelectionList {
  readonly pageRows: readonly Book[];
  /** Every book the search and filters let through, on every page. */
  readonly rows: readonly Book[];
}

/**
 * The books a bulk change reaches, and the bar counts: the ticked books on
 * the page on show, or, after "Select all", the ticked books in the list.
 * Never a book off the page unless the owner chose "Select all".
 */
export function reachedBooks(selection: Selection, scope: SelectionScope, list: SelectionList): Book[] {
  return selectedBooks(selection, scope === "all" ? list.rows : list.pageRows);
}

/** The ticks on the page only: what a tick builds on, so nothing off the page comes along. */
export function pageTicks(selection: Selection, pageRows: readonly Book[]): Selection {
  return withBooks(NO_SELECTION, selectedBooks(selection, pageRows), true);
}

/**
 * The line above the list, Gmail's way:
 * - `page`: some of the page is ticked. Covers offers the rest of the page
 *   (the table has its header box for that).
 * - `more`: the whole page is ticked and the list runs past it: offer every page.
 * - `all`: every book in the list is ticked, after "Select all" or on a list
 *   of one page: offer Clear.
 * `null` when nothing is ticked.
 */
export type SelectionLine =
  | { kind: "page"; page: number }
  | { kind: "more"; page: number; total: number }
  | { kind: "all"; total: number };

export function selectionLine(selection: Selection, scope: SelectionScope, list: SelectionList): SelectionLine | null {
  if (scope === "all") {
    const total = reachedBooks(selection, scope, list).length;
    return total > 0 ? { kind: "all", total } : null;
  }
  const page = list.pageRows.length;
  const state = selectAllState(selection, list.pageRows);
  if (state === "none") return null;
  if (state === "some") return { kind: "page", page };
  return list.rows.length > page ? { kind: "more", page, total: list.rows.length } : { kind: "all", total: page };
}
