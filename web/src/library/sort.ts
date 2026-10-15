import type { Book } from "@shelfmark/shared";
import { columnById, isColumnId, type ColumnId, type LibraryColumn } from "./columns";

/**
 * Sorting (corpus/wiki/library-table.md): a header click sorts by that
 * column, a shift-click adds it as the next key. Text sorts the Romanian way
 * ("ă" after "a", "ș" and "ş" alike, "Vol. 2" before "Vol. 10"), authors by
 * their sort name, and an empty value sorts last whichever way the column
 * runs. Ties fall back to the newest first, so the order never wobbles.
 */

export interface SortKey {
  id: ColumnId;
  desc: boolean;
}

export type Sorting = readonly SortKey[];

/** "14 books, newest first". */
export const DEFAULT_SORTING: Sorting = [{ id: "added", desc: true }];

export const collator = new Intl.Collator("ro", { sensitivity: "base", numeric: true });

/** Dates and numbers start newest and highest first, as a file list does; text starts A to Z. */
export function firstSortDesc(column: LibraryColumn): boolean {
  return column.kind === "date" || column.kind === "number";
}

type Key = string | number | null;

function sortKey(column: LibraryColumn, book: Book): Key {
  switch (column.kind) {
    case "text": {
      const value = (column.sortKey ?? column.value)(book);
      return value === null || value.trim() === "" ? null : value;
    }
    case "pick": {
      const values = column.values(book);
      if (values.length === 0) return null;
      if (column.order) {
        const index = column.order.indexOf(values[0] ?? "");
        return index === -1 ? column.order.length : index;
      }
      return values.map(column.optionLabel).join(", ");
    }
    case "number":
      return column.value(book);
    case "date":
      return (column.sortKey ?? column.value)(book);
    case "yesno":
      return column.value(book) ? 1 : 0;
  }
}

function plain(a: Key, b: Key): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return a === b ? 0 : (a ?? "") < (b ?? "") ? -1 : 1;
}

function collated(a: Key, b: Key): number {
  return collator.compare(String(a), String(b));
}

function comparatorFor(column: LibraryColumn): (a: Key, b: Key) => number {
  // Timestamps and calendar days compare as plain strings: same format, same zone.
  if (column.kind === "text" || (column.kind === "pick" && !column.order)) return collated;
  return plain;
}

/** Newest first, then the higher id: the last word on any tie. */
function newestFirst(a: Book, b: Book): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  return b.id - a.id;
}

/**
 * The books in the given order, as a new array. Keys are read once per book
 * before sorting, so a 3,000-book sort runs the collator and not the column
 * accessors in its comparisons.
 */
export function sortBooks(books: readonly Book[], sorting: Sorting): Book[] {
  const keys = (sorting.length > 0 ? sorting : DEFAULT_SORTING).filter((key) => isColumnId(key.id));
  const columns = keys.map((key) => columnById(key.id));
  const compares = columns.map(comparatorFor);
  const decorated = books.map((book) => ({ book, keys: columns.map((column) => sortKey(column, book)) }));

  decorated.sort((a, b) => {
    for (let i = 0; i < keys.length; i += 1) {
      const x = a.keys[i] ?? null;
      const y = b.keys[i] ?? null;
      if (x === null || y === null) {
        if (x === y) continue;
        return x === null ? 1 : -1; // empty last, either way
      }
      const order = compares[i]?.(x, y) ?? 0;
      if (order !== 0) return keys[i]?.desc ? -order : order;
    }
    return newestFirst(a.book, b.book);
  });
  return decorated.map((entry) => entry.book);
}

/**
 * A header click. Without `multi`, the column becomes the only key (its first
 * direction, or the other one when it already leads alone). With `multi`
 * (shift-click), the column joins as the next key, flips when it is there,
 * and leaves on the third click, unless it is the only key left.
 */
export function toggleSort(sorting: Sorting, id: ColumnId, multi = false): Sorting {
  const column = columnById(id);
  const first = firstSortDesc(column);
  const index = sorting.findIndex((key) => key.id === id);
  const current = sorting[index];

  if (!multi) {
    if (current && sorting.length === 1) return [{ id, desc: !current.desc }];
    return [{ id, desc: current ? current.desc : first }];
  }
  if (!current) return [...sorting, { id, desc: first }];
  if (current.desc === first || sorting.length === 1) {
    return sorting.map((key) => (key.id === id ? { id, desc: !key.desc } : key));
  }
  return sorting.filter((key) => key.id !== id);
}

/** How a column's name reads inside a sentence: "title", but "ISBN". */
function nameInSentence(column: LibraryColumn): string {
  return column.label === column.label.toUpperCase() ? column.label : column.label.toLowerCase();
}

/** A direction as a control shows it: "A to Z", "Newest first". */
export function directionLabel(column: LibraryColumn, desc: boolean): string {
  const words = column.directions[desc ? 1 : 0];
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The caption's half about order: "newest first", "by title", "by title, Z to A",
 * "by year, oldest first", "by shelf, then title".
 */
export function describeSort(sorting: Sorting): string {
  const keys = (sorting.length > 0 ? sorting : DEFAULT_SORTING).filter((key) => isColumnId(key.id));
  const [lead, ...rest] = keys;
  if (!lead) return describeSort(DEFAULT_SORTING);
  const column = columnById(lead.id);
  if (rest.length > 0) {
    return `by ${keys.map((key) => nameInSentence(columnById(key.id))).join(", then ")}`;
  }
  if (column.id === "added") return lead.desc ? "newest first" : "oldest first";
  const plainOrder = column.kind === "text" || column.kind === "pick";
  if (plainOrder && lead.desc === firstSortDesc(column)) return `by ${nameInSentence(column)}`;
  return `by ${nameInSentence(column)}, ${column.directions[lead.desc ? 1 : 0]}`;
}
