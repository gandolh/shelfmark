import type { Book, SavedFilter } from "@shelfmark/shared";
import { columnById, formatDay, isColumnId, type ColumnId, type LibraryColumn, type PickColumn } from "./columns";
import { compactIsbn, compileSearch, fold } from "./search";
import { collator } from "./sort";

/**
 * A filter per column, by the column's kind (corpus/wiki/library-table.md):
 *
 * - text: contains (blind to case and diacritics), is empty, is not empty
 * - pick-list: any of the chosen values, from the values the books have
 * - number and date: a range, either end open
 * - yes/no: yes or no (no filter is "any")
 *
 * Every active filter has to hold; within a pick-list, any chosen value does.
 */

export type { TextOp } from "@shelfmark/shared";

/**
 * One column's filter: the shared `SavedFilter` (shared/src/views.ts), so a
 * saved view holds exactly what the panel sets.
 *
 * - `text`: `op` and the typed text
 * - `pick`: the chosen values; `NO_VALUE` stands for the books with none ("No shelf")
 * - `number`: `min` and `max`, in the column's stored units (a price in bani)
 * - `date`: `from` and `to`, calendar days `YYYY-MM-DD`, both ends included
 * - `yesno`: `value`
 */
export type Filter = SavedFilter;

export type Filters = Readonly<Partial<Record<ColumnId, Filter>>>;

/** A pick-list's option for the books without a value. */
export const NO_VALUE = "";

/** An empty filter for a column, the panel's starting point. */
export function emptyFilter(column: LibraryColumn): Filter {
  switch (column.kind) {
    case "text":
      return { kind: "text", op: "contains", text: "" };
    case "pick":
      return { kind: "pick", values: [] };
    case "number":
      return { kind: "number", min: null, max: null };
    case "date":
      return { kind: "date", from: null, to: null };
    case "yesno":
      return { kind: "yesno", value: true };
  }
}

/** Whether a filter narrows anything: "contains" with nothing typed does not. */
export function isActive(filter: Filter | undefined): filter is Filter {
  if (!filter) return false;
  switch (filter.kind) {
    case "text":
      return filter.op !== "contains" || filter.text.trim() !== "";
    case "pick":
      return filter.values.length > 0;
    case "number":
      return filter.min !== null || filter.max !== null;
    case "date":
      return filter.from !== null || filter.to !== null;
    case "yesno":
      return true;
  }
}

/** The active filters, as `[column, filter]` pairs in the columns' order. */
export function activeFilters(filters: Filters): [LibraryColumn, Filter][] {
  const entries: [LibraryColumn, Filter][] = [];
  for (const [id, filter] of Object.entries(filters)) {
    if (isColumnId(id) && isActive(filter) && columnById(id).kind === filter.kind) entries.push([columnById(id), filter]);
  }
  return entries;
}

function textMatcher(column: LibraryColumn & { kind: "text" }, filter: Filter & { kind: "text" }): (book: Book) => boolean {
  const isBlank = (value: string | null) => value === null || value.trim() === "";
  if (filter.op === "empty") return (book) => isBlank(column.value(book));
  if (filter.op === "notEmpty") return (book) => !isBlank(column.value(book));
  const prepare = column.compact ? (text: string) => fold(compactIsbn(text)) : fold;
  const needle = prepare(filter.text.trim());
  return (book) => {
    const value = column.value(book);
    return value !== null && prepare(value).includes(needle);
  };
}

/** One filter as a test on a book. */
export function compileFilter(column: LibraryColumn, filter: Filter): (book: Book) => boolean {
  if (column.kind === "text" && filter.kind === "text") return textMatcher(column, filter);
  if (column.kind === "pick" && filter.kind === "pick") {
    const chosen = new Set(filter.values);
    const wantsNone = chosen.has(NO_VALUE);
    return (book) => {
      const values = column.values(book);
      if (values.length === 0) return wantsNone;
      return values.some((value) => chosen.has(value));
    };
  }
  if (column.kind === "number" && filter.kind === "number") {
    const { min, max } = filter;
    return (book) => {
      const value = column.value(book);
      return value !== null && (min === null || value >= min) && (max === null || value <= max);
    };
  }
  if (column.kind === "date" && filter.kind === "date") {
    const { from, to } = filter;
    return (book) => {
      const value = column.value(book);
      return value !== null && (from === null || value >= from) && (to === null || value <= to);
    };
  }
  if (column.kind === "yesno" && filter.kind === "yesno") {
    return (book) => column.value(book) === filter.value;
  }
  return () => true; // a filter saved for another kind of column narrows nothing
}

/**
 * The search and every active filter as one test, `null` when nothing
 * narrows. `except` leaves one column's filter out: a pick-list counts its
 * options among the books the other filters let through.
 */
export function compileView(filters: Filters, query: string, except?: ColumnId): ((book: Book) => boolean) | null {
  const tests = activeFilters(filters)
    .filter(([column]) => column.id !== except)
    .map(([column, filter]) => compileFilter(column, filter));
  const search = compileSearch(query);
  if (search) tests.unshift(search);
  if (tests.length === 0) return null;
  return (book) => tests.every((test) => test(book));
}

/** The books the search and filters let through, in the order given. */
export function applyFilters(books: readonly Book[], filters: Filters, query = ""): readonly Book[] {
  const test = compileView(filters, query);
  return test ? books.filter(test) : books;
}

export interface PickOption {
  value: string;
  label: string;
  /** Books with this value among those the search and the other filters let through. */
  count: number;
}

/**
 * A pick-list's options: every value the owned books have (so a new shelf is
 * there as soon as one book uses it, and a chosen value never vanishes),
 * counted within the current view minus this column's own filter. "No
 * shelf" comes last, when some book has none.
 */
export function pickOptions(column: PickColumn, books: readonly Book[], filters: Filters, query: string): PickOption[] {
  const counts = new Map<string, number>();
  const test = compileView(filters, query, column.id);
  let anyEmpty = false;
  let emptyInView = 0;
  for (const book of books) {
    const values = column.values(book);
    const inView = !test || test(book);
    if (values.length === 0) {
      anyEmpty = true;
      if (inView) emptyInView += 1;
    }
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + (inView ? 1 : 0));
  }

  const options = [...counts].map(([value, count]) => ({ value, label: column.optionLabel(value), count }));
  const { order } = column;
  if (order) {
    const rank = (value: string) => {
      const index = order.indexOf(value);
      return index === -1 ? order.length : index;
    };
    options.sort((a, b) => rank(a.value) - rank(b.value) || collator.compare(a.label, b.label));
  } else {
    options.sort((a, b) => collator.compare(a.label, b.label));
  }
  if (anyEmpty) options.push({ value: NO_VALUE, label: `No ${column.label.toLowerCase()}`, count: emptyInView });
  return options;
}

/** The lowest and highest value the books have, for a range's placeholders. */
export function valueRange(column: LibraryColumn, books: readonly Book[]): { min: number | string; max: number | string } | null {
  if (column.kind !== "number" && column.kind !== "date") return null;
  let min: number | string | null = null;
  let max: number | string | null = null;
  for (const book of books) {
    const value = column.value(book);
    if (value === null) continue;
    if (min === null || value < min) min = value;
    if (max === null || value > max) max = value;
  }
  return min === null || max === null ? null : { min, max };
}

function formatNumber(column: LibraryColumn, value: number): string {
  const scale = column.kind === "number" ? (column.scale ?? 1) : 1;
  const major = value / scale;
  return scale === 1 ? String(major) : major.toFixed(2).replace(/\.00$/, "");
}

function listOf(labels: string[]): string {
  if (labels.length <= 2) return labels.join(", ");
  return `${labels[0]}, ${labels[1]} and ${labels.length - 2} more`;
}

/** A filter's value in words, without the column: "Bedroom, Study · B1", "is empty", "2000 to 2010". */
export function filterSummary(column: LibraryColumn, filter: Filter): string {
  switch (filter.kind) {
    case "text":
      if (filter.op === "empty") return "is empty";
      if (filter.op === "notEmpty") return "is not empty";
      return `contains “${filter.text.trim()}”`;
    case "pick": {
      const label = (value: string) =>
        value === NO_VALUE ? `no ${column.label.toLowerCase()}` : column.kind === "pick" ? column.optionLabel(value) : value;
      return listOf(filter.values.map(label));
    }
    case "number": {
      const { min, max } = filter;
      if (min !== null && max !== null) {
        return min === max ? formatNumber(column, min) : `${formatNumber(column, min)} to ${formatNumber(column, max)}`;
      }
      if (min !== null) return `at least ${formatNumber(column, min)}`;
      return `at most ${formatNumber(column, max ?? 0)}`;
    }
    case "date": {
      const { from, to } = filter;
      if (from !== null && to !== null) return from === to ? formatDay(from) : `${formatDay(from)} to ${formatDay(to)}`;
      if (from !== null) return `from ${formatDay(from)}`;
      return `until ${formatDay(to ?? "")}`;
    }
    case "yesno":
      return filter.value ? "yes" : "no";
  }
}

/** What a chip says: "Shelf: Bedroom, Study · B1", "Notes is empty", "Title contains “road”". */
export function describeFilter(column: LibraryColumn, filter: Filter): string {
  const summary = filterSummary(column, filter);
  return filter.kind === "text" ? `${column.label} ${summary}` : `${column.label}: ${summary}`;
}
