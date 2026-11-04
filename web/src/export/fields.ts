import type { Book, Collection } from "@shelfmark/shared";
import { COLUMNS, exportValue, type LibraryColumn } from "../library/columns";

/**
 * How the library becomes a table of cells for a spreadsheet: every book,
 * owned and wishlist, every field. Built on the Library's column definitions
 * (library/columns.ts), so no field is known by name here except the three
 * that hold several values.
 */

/** What a cell holds: a date is a real date (its time of day only for Added and Changed). */
export type ExportCell = string | number | boolean | Date | null;

export interface ExportTable {
  header: string[];
  rows: ExportCell[][];
  /** Per column: what a date cell shows, when it is one. */
  dateFormats: (string | null)[];
}

export const DAY_FORMAT = "yyyy-mm-dd";
export const TIMESTAMP_FORMAT = "yyyy-mm-dd hh:mm";

/** Authors, subjects and tags: the values a book holds several of, joined the same way. */
const MULTI: Partial<Record<LibraryColumn["id"], (book: Book) => readonly string[]>> = {
  authors: (book) => book.authors,
  subjects: (book) => book.subjects,
  tags: (book) => book.tags,
};

/**
 * A date or timestamp as a spreadsheet date. A spreadsheet date has no time
 * zone, so the day is midnight UTC and a timestamp is the owner's wall-clock
 * time written as if it were UTC.
 */
export function spreadsheetDate(value: string): Date | null {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (day) return new Date(Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3])));
  const stamp = new Date(value);
  if (Number.isNaN(stamp.getTime())) return null;
  return new Date(
    Date.UTC(stamp.getFullYear(), stamp.getMonth(), stamp.getDate(), stamp.getHours(), stamp.getMinutes(), stamp.getSeconds()),
  );
}

/** One cell. Dates stay `YYYY-MM-DD` / ISO text unless `typedDates` asks for real dates. */
export function cellOf(column: LibraryColumn, book: Book, typedDates: boolean): ExportCell {
  const multi = MULTI[column.id];
  if (multi) {
    const values = multi(book);
    return values.length === 0 ? null : values.join("; ");
  }
  const value = exportValue(column, book);
  if (typedDates && column.kind === "date" && typeof value === "string") return spreadsheetDate(value) ?? value;
  return value;
}

function dateFormat(column: LibraryColumn): string | null {
  if (column.kind !== "date") return null;
  // "Added" and "Changed" carry a timestamp (they sort by it); the others a day.
  return column.sortKey ? TIMESTAMP_FORMAT : DAY_FORMAT;
}

/** The glossary's words for the two collections. */
const COLLECTION_LABELS: Record<Collection, string> = { owned: "Owned", wishlist: "Wishlist" };

/**
 * "Export library": every book whatever the Library shows, owned and
 * wishlist alike, with a Collection column first so the two can be told
 * apart, then every column in the table's default order. The books keep the
 * order they are given in (the server's, oldest first).
 */
export function libraryTable(books: readonly Book[], typedDates: boolean, columns: readonly LibraryColumn[] = COLUMNS): ExportTable {
  return {
    header: ["Collection", ...columns.map((column) => column.label)],
    rows: books.map((book) => [COLLECTION_LABELS[book.collection], ...columns.map((column) => cellOf(column, book, typedDates))]),
    dateFormats: [null, ...columns.map(dateFormat)],
  };
}
