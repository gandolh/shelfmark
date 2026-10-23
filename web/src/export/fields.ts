import type { Book } from "@shelfmark/shared";
import { exportValue, type LibraryColumn } from "../library/columns";
import { columnsIn, exportColumns, type LibraryView } from "../library/view";

/**
 * How the Library's books become a table of cells for a spreadsheet. Built on
 * the Library's column definitions (library/columns.ts), so no field is known
 * by name here except the three that hold several values.
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

function table(books: readonly Book[], columns: readonly LibraryColumn[], typedDates: boolean): ExportTable {
  return {
    header: columns.map((column) => column.label),
    rows: books.map((book) => columns.map((column) => cellOf(column, book, typedDates))),
    dateFormats: columns.map(dateFormat),
  };
}

/** "What you see now": the filtered, sorted rows, the visible columns in order (Author added after the title if hidden). */
export function viewTable(view: LibraryView, typedDates: boolean): ExportTable {
  return table(view.rows, exportColumns(view.columns), typedDates);
}

/** "Every book, every field": all the open collection's books, all the columns it fills, in the table's default order. */
export function everythingTable(view: LibraryView, columns: readonly LibraryColumn[], typedDates: boolean): ExportTable {
  return table(view.books, columnsIn(view.collection, columns), typedDates);
}
