import { CONDITIONS, STATUSES, type Condition, type Format, type Status } from "@shelfmark/shared";

/**
 * What a CSV column can become, the known files' headers, and how a cell's
 * text turns into a value. A header is compared by its letters and digits
 * only, in lower case ("Number of Pages" and "number_of_pages" are the same).
 */

export const IMPORT_FIELDS = [
  { id: "title", label: "Title" },
  { id: "authors", label: "Authors, separated by ;" },
  { id: "authorsComma", label: "Authors, separated by commas" },
  { id: "authorsLastFirst", label: "Author as Last, First" },
  { id: "isbn", label: "ISBN (10 or 13)" },
  { id: "subtitle", label: "Subtitle" },
  { id: "publisher", label: "Publisher" },
  { id: "year", label: "Year" },
  { id: "pages", label: "Pages" },
  { id: "language", label: "Language" },
  { id: "series", label: "Series" },
  { id: "seriesNumber", label: "Number in series" },
  { id: "description", label: "Description" },
  { id: "subjects", label: "Subjects" },
  { id: "format", label: "Format" },
  { id: "condition", label: "Condition" },
  { id: "shelf", label: "Shelf" },
  { id: "signed", label: "Signed" },
  { id: "status", label: "Status" },
  { id: "rating", label: "Rating" },
  { id: "tags", label: "Tags" },
  { id: "notes", label: "Notes" },
  { id: "acquiredOn", label: "Acquired on" },
  { id: "acquiredFrom", label: "Acquired from" },
  { id: "price", label: "Price" },
  { id: "currency", label: "Currency" },
] as const;

export type ImportFieldId = (typeof IMPORT_FIELDS)[number]["id"];
export type Mapping = (ImportFieldId | null)[];

export function headerKey(header: string): string {
  return header.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

type Aliases = Readonly<Record<string, ImportFieldId>>;

/** Goodreads: "Library Export". `Exclusive Shelf` is read / currently-reading / to-read, so it is the status. */
const GOODREADS: Aliases = {
  title: "title",
  author: "authors",
  additionalauthors: "authorsComma",
  isbn: "isbn",
  isbn13: "isbn",
  myrating: "rating",
  publisher: "publisher",
  binding: "format",
  numberofpages: "pages",
  yearpublished: "year",
  bookshelves: "tags",
  exclusiveshelf: "status",
  privatenotes: "notes",
};

/** Libib's export. */
const LIBIB: Aliases = {
  title: "title",
  creators: "authorsComma",
  eanisbn13: "isbn",
  upcisbn10: "isbn",
  description: "description",
  publisher: "publisher",
  publishdate: "year",
  group: "shelf",
  tags: "tags",
  notes: "notes",
  price: "price",
  length: "pages",
  rating: "rating",
  status: "status",
};

/** LibraryThing's export; its author column is "Last, First". */
const LIBRARYTHING: Aliases = {
  title: "title",
  primaryauthor: "authorsLastFirst",
  secondaryauthor: "authorsLastFirst",
  publication: "publisher",
  date: "year",
  rating: "rating",
  comment: "notes",
  summary: "description",
  pagecount: "pages",
  isbn: "isbn",
  tags: "tags",
  collections: "shelf",
  languages: "language",
  subjects: "subjects",
  acquired: "acquiredOn",
  fromwhere: "acquiredFrom",
};

/** Shelfmark's own export: the column labels of the Library table (library/columns.ts). */
const SHELFMARK: Aliases = {
  title: "title",
  author: "authors",
  subtitle: "subtitle",
  publisher: "publisher",
  year: "year",
  shelf: "shelf",
  status: "status",
  isbn: "isbn",
  pages: "pages",
  language: "language",
  series: "series",
  numberinseries: "seriesNumber",
  description: "description",
  subjects: "subjects",
  format: "format",
  condition: "condition",
  signed: "signed",
  rating: "rating",
  tags: "tags",
  notes: "notes",
  acquired: "acquiredOn",
  acquiredfrom: "acquiredFrom",
  price: "price",
  currency: "currency",
};

/** Headers a hand-made spreadsheet is likely to have; only a first guess for the mapping step. */
const GENERIC: Aliases = {
  title: "title",
  name: "title",
  booktitle: "title",
  book: "title",
  author: "authors",
  authors: "authors",
  writer: "authors",
  isbn: "isbn",
  isbn13: "isbn",
  isbn10: "isbn",
  eanisbn13: "isbn",
  upcisbn10: "isbn",
  ean: "isbn",
  barcode: "isbn",
  subtitle: "subtitle",
  publisher: "publisher",
  year: "year",
  publishedyear: "year",
  yearpublished: "year",
  publicationyear: "year",
  pages: "pages",
  pagecount: "pages",
  numberofpages: "pages",
  language: "language",
  series: "series",
  description: "description",
  summary: "description",
  subjects: "subjects",
  genre: "subjects",
  format: "format",
  binding: "format",
  condition: "condition",
  shelf: "shelf",
  location: "shelf",
  signed: "signed",
  status: "status",
  rating: "rating",
  tags: "tags",
  notes: "notes",
  comment: "notes",
  comments: "notes",
  price: "price",
  currency: "currency",
  acquired: "acquiredOn",
  acquiredfrom: "acquiredFrom",
};

export interface ImportFormat {
  id: "goodreads" | "libib" | "librarything" | "shelfmark";
  name: string;
  /** The headers that tell this file from the others. */
  signature: readonly string[];
  aliases: Aliases;
}

/** Most specific first: Shelfmark's labels overlap with the others'. */
export const FORMATS: readonly ImportFormat[] = [
  { id: "goodreads", name: "Goodreads", signature: ["exclusiveshelf"], aliases: GOODREADS },
  { id: "librarything", name: "LibraryThing", signature: ["primaryauthor"], aliases: LIBRARYTHING },
  { id: "libib", name: "Libib", signature: ["eanisbn13", "itemtype"], aliases: LIBIB },
  { id: "shelfmark", name: "Shelfmark", signature: ["numberinseries", "detailsfrom", "acquiredfrom"], aliases: SHELFMARK },
];

export interface Guess {
  /** The recognised export, or `null` for anything else (the mapping step opens). */
  format: ImportFormat | null;
  mapping: Mapping;
}

/** Which export the headers are, and the mapping that goes with it (or a generic guess). */
export function guessMapping(headers: readonly string[]): Guess {
  const keys = headers.map(headerKey);
  const format = FORMATS.find((f) => f.signature.some((s) => keys.includes(s))) ?? null;
  const aliases = format?.aliases ?? GENERIC;
  return { format, mapping: keys.map((key) => aliases[key] ?? null) };
}

/** A file can be read when a column gives a title or an ISBN. */
export function isUsable(mapping: Mapping): boolean {
  return mapping.includes("title") || mapping.includes("isbn");
}

// --- Cell values ----------------------------------------------------------------

/** Goodreads writes `="0441172717"` and LibraryThing `[0441172717]`: only the digits and a final X are the ISBN. */
export function isbnText(cell: string): string {
  return cell.replace(/[^0-9Xx]/g, "").toUpperCase();
}

export function splitList(cell: string, separator: RegExp): string[] {
  return cell
    .split(separator)
    .map((item) => item.trim())
    .filter((item) => item !== "");
}

/** "Herbert, Frank" → "Frank Herbert"; a name without exactly one comma is left alone. */
export function firstLast(name: string): string {
  const parts = name.split(",").map((part) => part.trim());
  return parts.length === 2 && parts[0] && parts[1] ? `${parts[1]} ${parts[0]}` : name.trim();
}

export function parseYear(cell: string): number | undefined {
  const match = /\d{4}/.exec(cell);
  const year = match ? Number(match[0]) : 0;
  return year >= 1 ? year : undefined;
}

export function parsePages(cell: string): number | undefined {
  const match = /\d+/.exec(cell);
  const pages = match ? Number(match[0]) : 0;
  return pages >= 1 && pages <= 100_000 ? pages : undefined;
}

/** 1 to 5, halves rounded; 0 and anything else is "no rating". */
export function parseRating(cell: string): number | undefined {
  const rating = Math.round(Number(cell.trim().replace(",", ".")));
  return rating >= 1 && rating <= 5 ? rating : undefined;
}

/** `YYYY-MM-DD`, also written `YYYY/MM/DD` or `YYYY.MM.DD`, if it is a real day. */
export function parseDate(cell: string): string | undefined {
  const match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(cell.trim());
  if (!match) return undefined;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** "49.90", "49,90" or "1.234,50 RON" in bani (minor units); a comma or dot followed by three digits is a thousands mark. */
export function parsePrice(cell: string): number | undefined {
  const text = cell.replace(/[^\d.,]/g, "");
  if (!/\d/.test(text)) return undefined;
  const at = Math.max(text.lastIndexOf(","), text.lastIndexOf("."));
  const decimals = at < 0 ? 0 : text.length - at - 1;
  const value = decimals >= 1 && decimals <= 2 ? `${text.slice(0, at).replace(/[.,]/g, "")}.${text.slice(at + 1)}` : text.replace(/[.,]/g, "");
  const minor = Math.round(Number(value) * 100);
  return Number.isFinite(minor) && minor >= 0 ? minor : undefined;
}

export function parseCurrency(cell: string): string | undefined {
  const code = cell.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : undefined;
}

export function parseStatus(cell: string): Status | undefined {
  const text = cell.trim().toLowerCase().replace(/[_-]+/g, " ");
  if ((STATUSES as readonly string[]).includes(text)) return text as Status;
  if (/^(finished|completed|done|have read)$/.test(text)) return "read";
  if (/^(currently reading|in progress|began|started)$/.test(text)) return "reading";
  if (/^(to read|want to read|not started|unstarted)$/.test(text)) return "unread";
  if (/^(dnf|did not finish|stopped)$/.test(text)) return "abandoned";
  return undefined;
}

export function parseFormat(cell: string): Format | undefined {
  const text = cell.trim().toLowerCase();
  if (text === "") return undefined;
  if (/hardcover|hardback|hard cover/.test(text)) return "hardcover";
  if (/paperback|softcover|soft cover|mass market|trade paper/.test(text)) return "paperback";
  return "other";
}

export function parseCondition(cell: string): Condition | undefined {
  const text = cell.trim().toLowerCase();
  return (CONDITIONS as readonly string[]).includes(text) ? (text as Condition) : undefined;
}

export function parseSigned(cell: string): boolean | undefined {
  const text = cell.trim().toLowerCase();
  if (/^(yes|y|true|1|signed)$/.test(text)) return true;
  return text === "" ? undefined : false;
}

const LANGUAGE_CODES: Record<string, string> = { eng: "en", ron: "ro", rum: "ro", fre: "fr", fra: "fr", ger: "de", deu: "de", spa: "es", ita: "it", hun: "hu" };
let languageByName: Map<string, string> | undefined;

/** A two-letter code, a three-letter one, or an English name ("Romanian", as export writes it) to ISO 639-1. */
export function parseLanguage(cell: string): string | undefined {
  const text = cell.trim().toLowerCase();
  if (/^[a-z]{2}$/.test(text)) return text;
  const three = LANGUAGE_CODES[text];
  if (three) return three;
  if (languageByName === undefined) {
    languageByName = new Map();
    try {
      const names = new Intl.DisplayNames(["en"], { type: "language" });
      for (let a = 97; a <= 122; a++) {
        for (let b = 97; b <= 122; b++) {
          const code = String.fromCharCode(a, b);
          const name = names.of(code);
          if (name && name.toLowerCase() !== code) languageByName.set(name.toLowerCase(), code);
        }
      }
    } catch {
      // No Intl names here: only codes are understood.
    }
  }
  return languageByName.get(text);
}
