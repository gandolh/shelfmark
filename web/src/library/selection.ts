import type { Book } from "@shelfmark/shared";

/**
 * Row selection (brief 26): the books ticked in the table, or long-pressed in
 * the covers, for the bulk bar. Kept by id with the `createdAt` each had
 * when ticked, so a new book that takes a deleted one's id (SQLite reuses the
 * highest) is not selected by accident.
 *
 * The selection lives in state.ts for the session. Sorting, filtering,
 * searching and switching tab leave it alone, so a selected book can be out
 * of sight (`SelectionSummary.hidden` counts those); only Clear lets go, and
 * a deleted book drops out.
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

/** The header's box: whether the rows on show are all, some or none of them selected. */
export function selectAllState(selection: Selection, rows: readonly Book[]): SelectAllState {
  let count = 0;
  for (const row of rows) if (isSelected(selection, row)) count += 1;
  return count === 0 ? "none" : count === rows.length ? "all" : "some";
}

/**
 * The header's box pressed: every row on show (what the search and filters
 * let through) selected, or, when they all were, none of them. A selected
 * book out of sight stays selected either way.
 */
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
  /** How many of them the page doesn't show now: the search, a filter or the other tab hides them. */
  hidden: number;
  /** How many of them are owned: a shelf change applies to these only. */
  owned: number;
}

export function summarizeSelection(selected: readonly Book[], rows: readonly Book[]): SelectionSummary {
  if (selected.length === 0) return { count: 0, hidden: 0, owned: 0 };
  const shown = new Set(rows.map((row) => row.id));
  return {
    count: selected.length,
    hidden: selected.filter((book) => !shown.has(book.id)).length,
    owned: selected.filter((book) => book.collection === "owned").length,
  };
}
