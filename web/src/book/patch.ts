import type { Book, BookPatch, Collection, Condition, Format, Status } from "@shelfmark/shared";
import { parseIsbn } from "@shelfmark/shared";
import { splitAuthors, joinAuthors } from "../add/form";
import { isbnProblem } from "../add/words";
import { formatLei, parseLei } from "./money";

/**
 * The edit form as plain values, and the one `PATCH` it makes. Every field is
 * typed text, a list or a choice; `buildPatch` turns the values into only the
 * fields the owner changed (the server refuses unknown keys, and sending the
 * whole book would rewrite `authorSort` and the dates). Pure, for the tests.
 */

export interface EditValues {
  title: string;
  subtitle: string;
  authors: string;
  publisher: string;
  publishedYear: string;
  pages: string;
  language: string;
  series: string;
  seriesNumber: string;
  isbn13: string;
  subjects: string[];
  description: string;
  collection: Collection;
  shelf: string | null;
  status: Status;
  rating: number | null;
  format: Format | null;
  condition: Condition | null;
  signed: boolean;
  acquiredOn: string;
  acquiredFrom: string;
  /** In lei, as typed: "49.90". */
  price: string;
  tags: string[];
  notes: string;
}

export type EditField = keyof EditValues;
export type EditErrors = Partial<Record<EditField, string>>;

/** The form's values for a stored book. */
export function valuesOf(book: Book): EditValues {
  return {
    title: book.title,
    subtitle: book.subtitle ?? "",
    authors: joinAuthors(book.authors),
    publisher: book.publisher ?? "",
    publishedYear: book.publishedYear === null ? "" : String(book.publishedYear),
    pages: book.pages === null ? "" : String(book.pages),
    language: book.language ?? "",
    series: book.series ?? "",
    seriesNumber: book.seriesNumber ?? "",
    isbn13: book.isbn13 ?? "",
    subjects: [...book.subjects],
    description: book.description ?? "",
    collection: book.collection,
    shelf: book.shelf,
    status: book.status,
    rating: book.rating,
    format: book.format,
    condition: book.condition,
    signed: book.signed,
    acquiredOn: book.acquiredOn ?? "",
    acquiredFrom: book.acquiredFrom ?? "",
    price: book.priceMinor === null ? "" : formatLei(book.priceMinor),
    tags: [...book.tags],
    notes: book.notes ?? "",
  };
}

/** Spaces collapsed and trimmed; blank is `null`. */
export function tidy(text: string): string | null {
  const t = text.trim().replace(/\s+/g, " ");
  return t === "" ? null : t;
}

/** Trimmed only: a description and notes keep their line breaks. */
function tidyLong(text: string): string | null {
  const t = text.trim();
  return t === "" ? null : t;
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((item, i) => item === b[i]);
}

/** Case-insensitively new to a list. */
export function addToList(list: readonly string[], entry: string): string[] {
  const t = tidy(entry);
  if (t === null || list.some((item) => item.toLowerCase() === t.toLowerCase())) return [...list];
  return [...list, t];
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A real calendar day, not just the right shape. */
export function isDate(text: string): boolean {
  const m = DATE.exec(text);
  if (!m) return false;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

export type PatchResult = { ok: true; patch: BookPatch } | { ok: false; errors: EditErrors };

/**
 * The patch from `values` against the `baseline` the form started from: a
 * field is sent only when its text differs from the baseline and its tidied
 * value differs from what the book holds; blank sends `null`, which clears.
 * A field nobody touched is never checked, so an odd stored value can't block
 * saving something else.
 */
export function buildPatch(book: Book, baseline: EditValues, values: EditValues): PatchResult {
  const patch: BookPatch = {};
  const errors: EditErrors = {};
  const touched = <K extends EditField>(key: K): boolean => {
    const a = baseline[key];
    const b = values[key];
    return Array.isArray(a) && Array.isArray(b) ? !sameList(a as string[], b as string[]) : a !== b;
  };

  const text = (key: "subtitle" | "publisher" | "series" | "seriesNumber" | "acquiredFrom") => {
    if (!touched(key)) return;
    const next = tidy(values[key]);
    if (next !== book[key]) patch[key] = next;
  };
  const long = (key: "description" | "notes") => {
    if (!touched(key)) return;
    const next = tidyLong(values[key]);
    if (next !== book[key]) patch[key] = next;
  };
  const whole = (key: "publishedYear" | "pages", max: number, problem: string) => {
    if (!touched(key)) return;
    const t = values[key].trim();
    if (t === "") {
      if (book[key] !== null) patch[key] = null;
      return;
    }
    const n = /^\d+$/.test(t) ? Number(t) : Number.NaN;
    if (!(n >= 1 && n <= max)) errors[key] = problem;
    else if (n !== book[key]) patch[key] = n;
  };
  const list = (key: "subjects" | "tags") => {
    if (touched(key) && !sameList(values[key], book[key])) patch[key] = values[key];
  };
  const choice = <K extends "shelf" | "status" | "rating" | "format" | "condition" | "signed" | "collection">(key: K) => {
    // Choices share their names and types with the book's fields.
    if (touched(key) && (values[key] as unknown) !== (book[key] as unknown)) (patch as Record<string, unknown>)[key] = values[key];
  };

  if (touched("title")) {
    const title = tidy(values.title);
    if (title === null) errors.title = "A book needs a title.";
    else if (title !== book.title) patch.title = title;
  }
  text("subtitle");
  if (touched("authors")) {
    const authors = splitAuthors(values.authors);
    if (!sameList(authors, book.authors)) patch.authors = authors;
  }
  text("publisher");
  whole("publishedYear", 9999, "Digits only, such as 2021.");
  whole("pages", 100_000, "Digits only, such as 218.");
  if (touched("language")) {
    const code = values.language.trim().toLowerCase();
    if (code === "") {
      if (book.language !== null) patch.language = null;
    } else if (!/^[a-z]{2}$/.test(code)) errors.language = "Two letters, such as ro or en.";
    else if (code !== book.language) patch.language = code;
  }
  text("series");
  text("seriesNumber");
  if (touched("isbn13")) {
    if (values.isbn13.trim() === "") {
      if (book.isbn13 !== null) patch.isbn13 = null;
    } else {
      const parsed = parseIsbn(values.isbn13);
      if (!parsed.ok) errors.isbn13 = isbnProblem(values.isbn13, parsed.reason);
      else if (parsed.isbn13 !== book.isbn13) patch.isbn13 = parsed.isbn13;
    }
  }
  list("subjects");
  long("description");
  choice("collection");
  if (touched("shelf") && values.shelf !== book.shelf) patch.shelf = values.shelf;
  choice("status");
  choice("rating");
  choice("format");
  choice("condition");
  choice("signed");
  if (touched("acquiredOn")) {
    const t = values.acquiredOn.trim();
    if (t === "") {
      if (book.acquiredOn !== null) patch.acquiredOn = null;
    } else if (!isDate(t)) errors.acquiredOn = "Use a real date, such as 2026-03-14.";
    else if (t !== book.acquiredOn) patch.acquiredOn = t;
  }
  text("acquiredFrom");
  if (touched("price")) {
    const bani = parseLei(values.price);
    if (bani === "invalid") errors.price = "Lei with up to two decimals, such as 49.90.";
    else if (bani !== book.priceMinor) patch.priceMinor = bani;
  }
  list("tags");
  long("notes");

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, patch };
}

/** The first field with a problem, in the order the form shows them. */
export const FIELD_ORDER: readonly EditField[] = [
  "title",
  "subtitle",
  "authors",
  "publisher",
  "publishedYear",
  "pages",
  "language",
  "series",
  "seriesNumber",
  "isbn13",
  "acquiredOn",
  "price",
];

export function firstError(errors: EditErrors): EditField | null {
  return FIELD_ORDER.find((field) => errors[field] !== undefined) ?? null;
}
