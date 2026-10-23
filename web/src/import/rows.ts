import {
  draftMetadataSource,
  parseIsbn,
  type Book,
  type BookCreate,
  type Collection,
  type LookupResponse,
  type MetadataSource,
} from "@shelfmark/shared";
import { isApiError } from "../api";
import { unguard } from "./csv";
import {
  firstLast,
  isbnText,
  parseCondition,
  parseCurrency,
  parseDate,
  parseFormat,
  parseLanguage,
  parsePages,
  parsePrice,
  parseRating,
  parseSigned,
  parseStatus,
  parseYear,
  splitList,
  type ImportFieldId,
  type Mapping,
} from "./fields";

/** The rows of an import: built from the file, flagged against the library, filled by lookups, sent to the server. */

export type LookupState = "none" | "found" | "not_found" | "failed";

/** What a row carries besides its title, authors and ISBN: the `BookCreate` fields, only those the file gave. */
export type RowDetails = Omit<BookCreate, "title" | "authors" | "isbn13" | "collection" | "metadataSource">;

export interface ImportRow {
  /** The row's line in the file's table, the header being line 1. */
  line: number;
  title: string;
  authors: string[];
  /** The ISBN as the file had it, digits only; empty when it had none. */
  isbnText: string;
  /** The ISBN-13 when `isbnText` is a valid ISBN-10 or -13. */
  isbn13: string | null;
  details: RowDetails;
  lookup: LookupState;
  source: MetadataSource;
}

export type RowFlag = "in-library" | "in-file" | "invalid-isbn" | "needs-lookup" | "not-found" | "lookup-failed" | "empty";

const ISBN_COLUMN_LIMIT = 20;

function dedupe(items: readonly string[]): string[] {
  return [...new Set(items)];
}

function compact<T extends object>(object: T): T {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined && value !== "")) as T;
}

/** The text cells of one row, per field, in column order. */
function cellsByField(cells: readonly string[], mapping: Mapping): Map<ImportFieldId, string[]> {
  const byField = new Map<ImportFieldId, string[]>();
  mapping.forEach((field, column) => {
    if (field === null) return;
    const text = unguard(cells[column] ?? "").trim();
    if (text === "") return;
    byField.set(field, [...(byField.get(field) ?? []), text]);
  });
  return byField;
}

/** One row of the file as an import row; `null` for a row with nothing mapped in it. */
export function buildRow(cells: readonly string[], mapping: Mapping, line: number): ImportRow | null {
  const by = cellsByField(cells, mapping);
  if (by.size === 0) return null;
  const first = (field: ImportFieldId) => by.get(field)?.[0];
  const firstOf = <T>(field: ImportFieldId, parse: (text: string) => T | undefined): T | undefined => {
    for (const text of by.get(field) ?? []) {
      const value = parse(text);
      if (value !== undefined) return value;
    }
    return undefined;
  };

  const authors = dedupe([
    ...(by.get("authors") ?? []).flatMap((cell) => splitList(cell, /;/)),
    ...(by.get("authorsComma") ?? []).flatMap((cell) => splitList(cell, /[;,]/)),
    ...(by.get("authorsLastFirst") ?? []).flatMap((cell) => splitList(cell, /;/).map(firstLast)),
  ]);

  // A valid ISBN wins over an invalid one, wherever it is (Goodreads has two columns).
  const isbns = (by.get("isbn") ?? []).map(isbnText).filter((text) => text !== "" && text.length <= ISBN_COLUMN_LIMIT);
  const valid = isbns.find((text) => parseIsbn(text).ok);
  const chosen = valid ?? isbns[0] ?? "";
  const parsed = chosen === "" ? null : parseIsbn(chosen);

  const details = compact<RowDetails>({
    subtitle: first("subtitle"),
    publisher: first("publisher"),
    publishedYear: firstOf("year", parseYear),
    pages: firstOf("pages", parsePages),
    language: firstOf("language", parseLanguage),
    series: first("series"),
    seriesNumber: first("seriesNumber"),
    description: first("description"),
    subjects: dedupe((by.get("subjects") ?? []).flatMap((cell) => splitList(cell, /;/))),
    format: firstOf("format", parseFormat),
    condition: firstOf("condition", parseCondition),
    shelf: first("shelf"),
    signed: firstOf("signed", parseSigned),
    status: firstOf("status", parseStatus),
    rating: firstOf("rating", parseRating),
    notes: first("notes"),
    acquiredOn: firstOf("acquiredOn", parseDate),
    acquiredFrom: first("acquiredFrom"),
    priceMinor: firstOf("price", parsePrice),
    currency: firstOf("currency", parseCurrency),
    tags: dedupe((by.get("tags") ?? []).flatMap((cell) => splitList(cell, /[;,]/))),
  });
  if (details.subjects?.length === 0) delete details.subjects;
  if (details.tags?.length === 0) delete details.tags;

  return {
    line,
    title: first("title") ?? "",
    authors,
    isbnText: chosen,
    isbn13: parsed?.ok ? parsed.isbn13 : null,
    details,
    lookup: "none",
    source: "import",
  };
}

/** The rows under the header, blank ones skipped. `table[0]` is the header. */
export function buildRows(table: readonly (readonly string[])[], mapping: Mapping): ImportRow[] {
  const rows: ImportRow[] = [];
  table.slice(1).forEach((cells, index) => {
    const row = buildRow(cells, mapping, index + 2);
    if (row) rows.push(row);
  });
  return rows;
}

// --- Flags ----------------------------------------------------------------------

/**
 * Each row's flags. A row is "in your library" when its ISBN is on an owned
 * book, or on a book of the collection being imported into; "repeated" when an
 * earlier row of the file has the same ISBN.
 */
export function flagRows(rows: readonly ImportRow[], books: readonly Book[], collection: Collection): RowFlag[][] {
  const known = new Set(
    books.filter((b) => b.isbn13 !== null && (b.collection === "owned" || b.collection === collection)).map((b) => b.isbn13),
  );
  const seen = new Set<string>();
  return rows.map((row) => {
    const flags: RowFlag[] = [];
    if (row.isbn13 !== null) {
      if (known.has(row.isbn13)) flags.push("in-library");
      else if (seen.has(row.isbn13)) flags.push("in-file");
      seen.add(row.isbn13);
    } else if (row.isbnText !== "") flags.push("invalid-isbn");
    if (row.title === "") {
      if (row.lookup === "not_found") flags.push("not-found");
      else if (row.lookup === "failed") flags.push("lookup-failed");
      else if (row.isbn13 !== null) flags.push("needs-lookup");
      else if (row.isbnText === "") flags.push("empty");
    }
    return flags;
  });
}

const DUPLICATE: readonly RowFlag[] = ["in-library", "in-file"];

export function isDuplicate(flags: readonly RowFlag[]): boolean {
  return flags.some((flag) => DUPLICATE.includes(flag));
}

/** Ticked at first: rows that are neither duplicates, invalid ISBNs, nor empty. A row that needs a lookup is ticked: the lookup runs on ticked rows. */
export function tickedByDefault(flags: readonly RowFlag[]): boolean {
  return flags.every((flag) => flag === "needs-lookup");
}

/** A row can be saved when it has a title. */
export function hasTitle(row: ImportRow): boolean {
  return row.title !== "";
}

// --- Lookups --------------------------------------------------------------------

/** The rows to look up: ticked, no title, a valid ISBN, not asked yet. */
export function lookupTargets(rows: readonly ImportRow[], ticked: ReadonlySet<number>): number[] {
  return rows.flatMap((row, index) => (ticked.has(index) && row.title === "" && row.isbn13 !== null && row.lookup === "none" ? [index] : []));
}

/** The row with a lookup's draft filled in, only where the file left a field empty. No title in the answer counts as not found. */
export function applyLookup(row: ImportRow, response: LookupResponse): ImportRow {
  const draft = response.draft;
  if (draft === null || draft.title === null || draft.title.trim() === "") return { ...row, lookup: "not_found" };
  const fill = <K extends keyof RowDetails>(key: K, value: RowDetails[K] | null | undefined | []) => {
    if (row.details[key] === undefined && value !== null && value !== undefined && !(Array.isArray(value) && value.length === 0)) {
      details[key] = value as RowDetails[K];
    }
  };
  const details: RowDetails = { ...row.details };
  fill("subtitle", draft.subtitle);
  fill("publisher", draft.publisher);
  fill("publishedYear", draft.publishedYear);
  fill("pages", draft.pages);
  fill("language", draft.language);
  fill("description", draft.description);
  fill("subjects", draft.subjects);
  return {
    ...row,
    title: draft.title,
    authors: row.authors.length > 0 ? row.authors : draft.authors,
    details,
    lookup: "found",
    source: draftMetadataSource(draft.sources),
  };
}

export interface LookupRun {
  /** Rows answered (found or not) or failed. */
  done: number;
  /** Set when the run ended on an error that would repeat (no network, signed out). */
  stoppedBy: "signal" | "error" | null;
  error?: unknown;
}

/**
 * Looks the rows up one at a time, in order, each only after the last has
 * answered. Stops between rows when `signal` aborts; an answer that fails is
 * marked failed and the run goes on, except for no network or a signed-out
 * session, which would fail every row after it.
 */
export async function runLookups(
  rows: readonly ImportRow[],
  indices: readonly number[],
  lookup: (isbn13: string, signal: AbortSignal) => Promise<LookupResponse>,
  signal: AbortSignal,
  onRow: (index: number, row: ImportRow) => void,
): Promise<LookupRun> {
  let done = 0;
  for (const index of indices) {
    if (signal.aborted) return { done, stoppedBy: "signal" };
    const row = rows[index];
    if (!row || row.isbn13 === null) continue;
    try {
      onRow(index, applyLookup(row, await lookup(row.isbn13, signal)));
      done++;
    } catch (error) {
      if (signal.aborted) return { done, stoppedBy: "signal" };
      if (isApiError(error, "network") || isApiError(error, "signed_out")) return { done, stoppedBy: "error", error };
      onRow(index, { ...row, lookup: "failed" });
      done++;
    }
  }
  return { done, stoppedBy: null };
}

// --- Saving ---------------------------------------------------------------------

/** The create body for a row. The wishlist has no shelf (`bodyFromProposal` in add/flow.ts does the same). */
export function bodyFromRow(row: ImportRow, collection: Collection): BookCreate {
  const { shelf, ...rest } = row.details;
  return {
    ...rest,
    title: row.title,
    ...(row.authors.length > 0 ? { authors: row.authors } : {}),
    ...(row.isbn13 !== null ? { isbn13: row.isbn13 } : {}),
    shelf: collection === "wishlist" ? null : (shelf ?? null),
    metadataSource: row.source,
    ...(collection === "wishlist" ? { collection } : {}),
  };
}

export interface SaveFailure {
  line: number;
  title: string;
  reason: string;
}

export interface SaveReport {
  saved: number;
  failed: SaveFailure[];
  /** Rows never tried because a run-ending error (no network, signed out) came first. */
  untried: number;
}

/** Saves the rows one `POST /api/books` at a time. A failed row is reported and the rest go on; no network or a signed-out session ends the run. */
export async function saveRows(
  rows: readonly ImportRow[],
  collection: Collection,
  create: (body: BookCreate) => Promise<unknown>,
  onProgress: (done: number) => void = () => {},
): Promise<SaveReport> {
  const report: SaveReport = { saved: 0, failed: [], untried: 0 };
  for (const [index, row] of rows.entries()) {
    try {
      await create(bodyFromRow(row, collection));
      report.saved++;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "That didn't work.";
      report.failed.push({ line: row.line, title: row.title, reason });
      if (isApiError(error, "network") || isApiError(error, "signed_out")) {
        report.untried = rows.length - index - 1;
        break;
      }
    }
    onProgress(index + 1);
  }
  return report;
}
