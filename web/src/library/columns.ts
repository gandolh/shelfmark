import {
  CONDITIONS,
  FORMATS,
  LIBRARY_COLUMN_IDS,
  METADATA_SOURCES,
  STATUSES,
  type Book,
  type LibraryColumnId,
} from "@shelfmark/shared";

/**
 * The Library's columns: one per book field, each with the kind that decides
 * its filter (corpus/wiki/library-table.md) and how it sorts. The table
 * (BookTable), the filters, the sort, the column picker and the export all
 * read these definitions; none of them knows a field by name.
 *
 * Not here: `id` (an internal number), `collection` (the Owned and Wishlist
 * tabs above the table choose it; `columnApplies` in view.ts drops the columns
 * a wishlist book never fills) and `createdAt`/`updatedAt` under their own
 * names ("Added", "Changed").
 */

export type ColumnKind = "text" | "pick" | "number" | "date" | "yesno";

/** Every column's id, in the table's default order: the shared list, so a saved view (brief 27) names the same columns. */
export const COLUMN_IDS = LIBRARY_COLUMN_IDS;

export type ColumnId = LibraryColumnId;

interface ColumnBase {
  id: ColumnId;
  /** Its name in the column picker, the filter list, a chip and the export: "Publisher". */
  label: string;
  /** The table's header, when it differs from the label ("Book" over the cover, title and author). */
  header: string;
  /** Width in px before the owner drags it, and the narrowest it can be dragged to. */
  size: number;
  minSize: number;
  /** Numbers line up on the right. */
  align: "start" | "end";
  /** In the table until the owner hides it: book, publisher, year, shelf, status, added. */
  defaultVisible: boolean;
  /** What a cell shows and a CSV writes: "Reading", "12 Oct 2025", "RON 59.90". Empty when unset. */
  text: (book: Book) => string;
  /** The caption's words for each direction: "oldest first" / "newest first". */
  directions: readonly [asc: string, desc: string];
}

export interface TextColumn extends ColumnBase {
  kind: "text";
  /** The text a filter searches; `null` when unset. */
  value: (book: Book) => string | null;
  /** What it sorts by, when not the value (authors by `authorSort`). */
  sortKey?: (book: Book) => string | null;
  /** ISBNs and barcodes: hyphens and spaces don't count, on either side. */
  compact?: boolean;
}

export interface PickColumn extends ColumnBase {
  kind: "pick";
  /** The values a book has (none, one, or several for tags). */
  values: (book: Book) => readonly string[];
  /** How a value reads: "unread" → "Unread". */
  optionLabel: (value: string) => string;
  /** A fixed order (status, format, condition); otherwise values sort by their labels. */
  order?: readonly string[];
}

export interface NumberColumn extends ColumnBase {
  kind: "number";
  value: (book: Book) => number | null;
  /** The filter's fields are in major units: a price is stored in bani and typed in lei. */
  scale?: number;
}

export interface DateColumn extends ColumnBase {
  kind: "date";
  /** The calendar day, `YYYY-MM-DD` (a timestamp's local day); what the filter compares. */
  value: (book: Book) => string | null;
  /** The full timestamp, so two books added the same day keep their order. */
  sortKey?: (book: Book) => string | null;
}

export interface YesNoColumn extends ColumnBase {
  kind: "yesno";
  value: (book: Book) => boolean;
}

export type LibraryColumn = TextColumn | PickColumn | NumberColumn | DateColumn | YesNoColumn;

// --- Formatting -------------------------------------------------------------------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** A timestamp's calendar day where the owner is: `2026-10-14T23:30:00Z` is the 15th in Bucharest. */
export function localDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `2016-03-01` → "1 Mar 2016"; the year left off when it is `currentYear`. */
export function formatDay(day: string, currentYear?: number): string {
  const [year, month, date] = day.split("-").map(Number);
  const name = month === undefined ? undefined : MONTHS[month - 1];
  if (year === undefined || name === undefined || date === undefined || Number.isNaN(date)) return day;
  return year === currentYear ? `${date} ${name}` : `${date} ${name} ${year}`;
}

/** When a book was added, as the mock-up writes it: "Today", "Yesterday", "12 Oct", "3 Mar 2025". */
export function formatAdded(iso: string, now: Date = new Date()): string {
  const day = localDay(iso);
  const today = localDay(now.toISOString());
  if (day === today) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (day === localDay(yesterday.toISOString())) return "Yesterday";
  return formatDay(day, now.getFullYear());
}

/** 5990 bani, RON → "RON 59.90". */
export function formatPrice(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
}

let languageNames: Intl.DisplayNames | null | undefined;

/** `ro` → "Romanian"; an unknown code stays as it is, upper-cased. */
export function languageName(code: string): string {
  if (languageNames === undefined) {
    try {
      languageNames = new Intl.DisplayNames(["en"], { type: "language" });
    } catch {
      languageNames = null;
    }
  }
  try {
    const name = languageNames?.of(code);
    if (name && name.toLowerCase() !== code.toLowerCase()) return name;
  } catch {
    // An invalid code: fall through.
  }
  return code.toUpperCase();
}

const STATUS_LABELS: Record<string, string> = { unread: "Unread", reading: "Reading", read: "Read", abandoned: "Abandoned" };
const FORMAT_LABELS: Record<string, string> = { hardcover: "Hardcover", paperback: "Paperback", other: "Other" };
const CONDITION_LABELS: Record<string, string> = { new: "New", good: "Good", worn: "Worn", damaged: "Damaged" };
const SOURCE_LABELS: Record<string, string> = {
  openlibrary: "Open Library",
  biblacad: "Romanian Academy Library",
  bcucluj: "BCU Cluj",
  bcutimisoara: "BCU Timișoara",
  cip: "CIP lists",
  googlebooks: "Google Books",
  manual: "By hand",
  import: "Import",
};

function labelFrom(labels: Record<string, string>): (value: string) => string {
  return (value) => labels[value] ?? value;
}

function one(value: string | null): readonly string[] {
  return value === null || value === "" ? [] : [value];
}

const TEXT_DIRECTIONS = ["A to Z", "Z to A"] as const;
const NUMBER_DIRECTIONS = ["lowest first", "highest first"] as const;
const DATE_DIRECTIONS = ["oldest first", "newest first"] as const;
const ORDER_DIRECTIONS = ["in order", "reversed"] as const;
const YESNO_DIRECTIONS = ["no first", "yes first"] as const;

// --- The columns --------------------------------------------------------------------

const base = { minSize: 64, align: "start", defaultVisible: false } as const;

function text(def: Omit<TextColumn, "kind" | "minSize" | "align" | "defaultVisible" | "directions" | "text"> & Partial<TextColumn>): TextColumn {
  return { ...base, directions: TEXT_DIRECTIONS, text: (book) => def.value(book) ?? "", ...def, kind: "text" };
}

function pick(def: Omit<PickColumn, "kind" | "minSize" | "align" | "defaultVisible" | "directions" | "text"> & Partial<PickColumn>): PickColumn {
  return {
    ...base,
    directions: def.order ? ORDER_DIRECTIONS : TEXT_DIRECTIONS,
    text: (book) => def.values(book).map(def.optionLabel).join(", "),
    ...def,
    kind: "pick",
  };
}

function number(def: Omit<NumberColumn, "kind" | "minSize" | "align" | "defaultVisible" | "directions" | "text"> & Partial<NumberColumn>): NumberColumn {
  return {
    ...base,
    align: "end",
    directions: NUMBER_DIRECTIONS,
    text: (book) => {
      const value = def.value(book);
      return value === null ? "" : String(value);
    },
    ...def,
    kind: "number",
  };
}

function date(def: Omit<DateColumn, "kind" | "minSize" | "align" | "defaultVisible" | "directions" | "text"> & Partial<DateColumn>): DateColumn {
  return {
    ...base,
    directions: DATE_DIRECTIONS,
    text: (book) => {
      const value = def.value(book);
      return value === null ? "" : formatDay(value);
    },
    ...def,
    kind: "date",
  };
}

function yesno(def: Omit<YesNoColumn, "kind" | "minSize" | "align" | "defaultVisible" | "directions" | "text"> & Partial<YesNoColumn>): YesNoColumn {
  return { ...base, directions: YESNO_DIRECTIONS, text: (book) => (def.value(book) ? "Yes" : "No"), ...def, kind: "yesno" };
}

/** Every column, in the table's default order. */
export const COLUMNS: readonly LibraryColumn[] = [
  text({
    id: "book",
    label: "Title",
    header: "Book",
    size: 320,
    minSize: 220,
    defaultVisible: true,
    value: (book) => book.title,
  }),
  text({
    id: "authors",
    label: "Author",
    header: "Author",
    size: 200,
    value: (book) => (book.authors.length > 0 ? book.authors.join(", ") : null),
    // "Cărtărescu, Mircea": by last name, as a shop shelves them.
    sortKey: (book) => book.authorSort ?? book.authors[0] ?? null,
  }),
  text({ id: "subtitle", label: "Subtitle", header: "Subtitle", size: 200, value: (book) => book.subtitle }),
  text({
    id: "publisher",
    label: "Publisher",
    header: "Publisher",
    size: 150,
    defaultVisible: true,
    value: (book) => book.publisher,
  }),
  number({
    id: "year",
    label: "Year",
    header: "Year",
    size: 80, // "Year" and its sort arrow whole
    minSize: 56,
    defaultVisible: true,
    directions: DATE_DIRECTIONS,
    value: (book) => book.publishedYear,
  }),
  pick({
    id: "shelf",
    label: "Shelf",
    header: "Shelf",
    size: 150,
    defaultVisible: true,
    values: (book) => one(book.shelf),
    optionLabel: (value) => value,
  }),
  pick({
    id: "status",
    label: "Status",
    header: "Status",
    size: 112, // "Abandoned" whole

    defaultVisible: true,
    values: (book) => [book.status],
    optionLabel: labelFrom(STATUS_LABELS),
    order: STATUSES,
  }),
  date({
    id: "added",
    label: "Added",
    header: "Added",
    size: 110,
    defaultVisible: true,
    value: (book) => localDay(book.createdAt),
    sortKey: (book) => book.createdAt,
    text: (book) => formatAdded(book.createdAt),
  }),
  text({ id: "isbn", label: "ISBN", header: "ISBN", size: 140, compact: true, value: (book) => book.isbn13 }),
  text({ id: "barcode", label: "Barcode", header: "Barcode", size: 140, compact: true, value: (book) => book.barcode }),
  number({
    id: "pages",
    label: "Pages",
    header: "Pages",
    size: 72,
    directions: ["shortest first", "longest first"],
    value: (book) => book.pages,
  }),
  pick({
    id: "language",
    label: "Language",
    header: "Language",
    size: 110,
    values: (book) => one(book.language),
    optionLabel: languageName,
  }),
  text({
    id: "series",
    label: "Series",
    header: "Series",
    size: 160,
    value: (book) => book.series,
    // "Dune 2" before "Dune 10": the number joins the name, and the collation is numeric.
    sortKey: (book) => (book.series === null ? null : `${book.series} ${book.seriesNumber ?? ""}`.trim()),
  }),
  text({
    id: "seriesNumber",
    label: "Number in series",
    header: "No.",
    size: 64,
    minSize: 56,
    align: "end",
    value: (book) => book.seriesNumber,
  }),
  text({ id: "description", label: "Description", header: "Description", size: 260, value: (book) => book.description }),
  text({
    id: "subjects",
    label: "Subjects",
    header: "Subjects",
    size: 200,
    value: (book) => (book.subjects.length > 0 ? book.subjects.join(", ") : null),
  }),
  pick({
    id: "format",
    label: "Format",
    header: "Format",
    size: 110,
    values: (book) => one(book.format),
    optionLabel: labelFrom(FORMAT_LABELS),
    order: FORMATS,
  }),
  pick({
    id: "condition",
    label: "Condition",
    header: "Condition",
    size: 100,
    values: (book) => one(book.condition),
    optionLabel: labelFrom(CONDITION_LABELS),
    order: CONDITIONS,
  }),
  yesno({ id: "signed", label: "Signed", header: "Signed", size: 80, value: (book) => book.signed }),
  number({
    id: "rating",
    label: "Rating",
    header: "Rating",
    size: 72,
    value: (book) => book.rating,
    text: (book) => (book.rating === null ? "" : `${book.rating}/5`),
  }),
  pick({
    id: "tags",
    label: "Tags",
    header: "Tags",
    size: 180,
    values: (book) => book.tags,
    optionLabel: (value) => value,
  }),
  text({ id: "notes", label: "Notes", header: "Notes", size: 240, value: (book) => book.notes }),
  date({ id: "acquiredOn", label: "Acquired", header: "Acquired", size: 110, value: (book) => book.acquiredOn }),
  text({ id: "acquiredFrom", label: "Acquired from", header: "Acquired from", size: 160, value: (book) => book.acquiredFrom }),
  number({
    id: "price",
    label: "Price",
    header: "Price",
    size: 110,
    scale: 100,
    directions: ["cheapest first", "dearest first"],
    value: (book) => book.priceMinor,
    text: (book) => (book.priceMinor === null ? "" : formatPrice(book.priceMinor, book.currency)),
  }),
  pick({
    id: "currency",
    label: "Currency",
    header: "Currency",
    size: 90,
    values: (book) => [book.currency],
    optionLabel: (value) => value,
  }),
  yesno({ id: "cover", label: "Cover", header: "Cover", size: 80, value: (book) => book.hasCover }),
  pick({
    id: "source",
    label: "Details from",
    header: "Details from",
    size: 130,
    values: (book) => [book.metadataSource],
    optionLabel: labelFrom(SOURCE_LABELS),
    order: METADATA_SOURCES,
  }),
  date({
    id: "changed",
    label: "Changed",
    header: "Changed",
    size: 110,
    value: (book) => localDay(book.updatedAt),
    sortKey: (book) => book.updatedAt,
    text: (book) => formatAdded(book.updatedAt),
  }),
];

const BY_ID = new Map<string, LibraryColumn>(COLUMNS.map((column) => [column.id, column]));

/** The book column leads the table and can be neither hidden nor moved. */
export const BOOK_COLUMN_ID: ColumnId = "book";

export function isColumnId(id: unknown): id is ColumnId {
  return typeof id === "string" && BY_ID.has(id);
}

export function columnById(id: ColumnId): LibraryColumn {
  const column = BY_ID.get(id);
  if (!column) throw new Error(`No column ${id}`);
  return column;
}

/** What "Every book, every field" and "What you see now" write to a cell: typed for a spreadsheet. */
export function exportValue(column: LibraryColumn, book: Book): string | number | boolean | null {
  switch (column.kind) {
    case "text":
      return column.value(book);
    case "pick": {
      const values = column.values(book);
      return values.length === 0 ? null : values.map(column.optionLabel).join(", ");
    }
    case "number": {
      const value = column.value(book);
      return value === null ? null : value / (column.scale ?? 1);
    }
    case "date":
      // The calendar day for a date; the full timestamp for "Added" and "Changed".
      return column.sortKey?.(book) ?? column.value(book);
    case "yesno":
      return column.value(book);
  }
}
