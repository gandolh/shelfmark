import { z } from "zod";

/**
 * A book is one physical copy the owner has or wants (corpus/wiki/glossary.md).
 * These schemas are the API's contract; the server's store maps them to the
 * `books` table (corpus/wiki/data-model.md).
 */

export const STATUSES = ["unread", "reading", "read", "abandoned"] as const;
export const statusSchema = z.enum(STATUSES);
export type Status = z.infer<typeof statusSchema>;

export const FORMATS = ["hardcover", "paperback", "other"] as const;
export const formatSchema = z.enum(FORMATS);
export type Format = z.infer<typeof formatSchema>;

export const CONDITIONS = ["new", "good", "worn", "damaged"] as const;
export const conditionSchema = z.enum(CONDITIONS);
export type Condition = z.infer<typeof conditionSchema>;

export const COLLECTIONS = ["owned", "wishlist"] as const;
export const collectionSchema = z.enum(COLLECTIONS);
export type Collection = z.infer<typeof collectionSchema>;

/** Where a book's details came from: a lookup source (lookup.ts), the owner, or an import. */
export const METADATA_SOURCES = [
  "openlibrary",
  "biblacad",
  "bcucluj",
  "bcutimisoara",
  "cip",
  "googlebooks",
  "manual",
  "import",
] as const;
export const metadataSourceSchema = z.enum(METADATA_SOURCES);
export type MetadataSource = z.infer<typeof metadataSourceSchema>;

export const DEFAULT_CURRENCY = "RON";

const ISBN13 = /^97[89]\d{10}$/;
const ISBN13_MESSAGE = "must be 13 digits starting with 978 or 979";

/** Bare digits. The check digit is `parseIsbn`'s job (isbn.ts), run where raw input comes in. */
export const isbn13Schema = z.string().regex(ISBN13, { message: ISBN13_MESSAGE });

/** A book as the API returns it. Every key is always present; `null` means not set. */
export const bookSchema = z.object({
  id: z.number().int().positive(),
  isbn13: isbn13Schema.nullable(),
  /** A scanned code that is not an ISBN, as read. */
  barcode: z.string().nullable(),
  title: z.string(),
  subtitle: z.string().nullable(),
  /** Display names, in the book's order. */
  authors: z.array(z.string()),
  /** "Cărtărescu, Mircea". Derived from the first author unless the owner set it. */
  authorSort: z.string().nullable(),
  publisher: z.string().nullable(),
  publishedYear: z.number().int().nullable(),
  pages: z.number().int().nullable(),
  /** ISO 639-1, e.g. `ro`. */
  language: z.string().nullable(),
  series: z.string().nullable(),
  /** Text, not a number: "3", "3a", "II". */
  seriesNumber: z.string().nullable(),
  description: z.string().nullable(),
  subjects: z.array(z.string()),
  collection: collectionSchema,
  format: formatSchema.nullable(),
  condition: conditionSchema.nullable(),
  /** "Room · shelf", free text. */
  shelf: z.string().nullable(),
  signed: z.boolean(),
  status: statusSchema,
  rating: z.number().int().min(1).max(5).nullable(),
  notes: z.string().nullable(),
  /** `YYYY-MM-DD`. */
  acquiredOn: z.iso.date().nullable(),
  /** A shop or a person. */
  acquiredFrom: z.string().nullable(),
  /** Minor units (bani), so sums never go through floats. */
  priceMinor: z.number().int().nullable(),
  currency: z.string(),
  metadataSource: metadataSourceSchema,
  /** Tag names, in the order they were given. */
  tags: z.array(z.string()),
  /** Whether `GET /api/books/:id/cover` has an image. */
  hasCover: z.boolean(),
  /**
   * When the cover was last stored (UTC ISO), `null` without one. The web app
   * puts it in the image URL (`?v=`), so a replaced cover, or a new book that
   * reuses a deleted one's id, is never shown from a cache.
   */
  coverUpdatedAt: z.iso.datetime().nullable(),
  /** UTC ISO timestamps, set by the server. */
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Book = z.infer<typeof bookSchema>;

/** `GET /api/books`. */
export const bookListSchema = z.object({ books: z.array(bookSchema) });
export type BookList = z.infer<typeof bookListSchema>;

const SHORT_TEXT_MAX = 500;
const LONG_TEXT_MAX = 20_000;
const LIST_MAX = 100;

/**
 * Optional, and `null` clears it: a nullable column goes back to NULL, a list
 * to empty, a column with a default to its default. A blank string counts as
 * `null`, so an emptied form field can be sent as it is.
 */
function clearable<T extends z.ZodType>(schema: T) {
  return z.preprocess((value) => (typeof value === "string" && value.trim() === "" ? null : value), schema.nullish());
}

const shortText = z.string().trim().max(SHORT_TEXT_MAX);
const longText = z.string().trim().max(LONG_TEXT_MAX);
/** Blank entries are dropped: a form's empty author row is not an author. */
const names = z
  .array(shortText)
  .max(LIST_MAX)
  .transform((items) => items.filter((item) => item !== ""));

const titleSchema = z
  .string({ error: "a book needs a title" })
  .trim()
  .min(1, { message: "a book needs a title" })
  .max(SHORT_TEXT_MAX);

/** Every field but the title, as a create or a patch sends it. */
const bookFields = {
  isbn13: clearable(z.string().trim().regex(ISBN13, { message: ISBN13_MESSAGE })),
  barcode: clearable(z.string().trim().max(64)),
  subtitle: clearable(shortText),
  authors: clearable(names),
  authorSort: clearable(shortText),
  publisher: clearable(shortText),
  publishedYear: clearable(z.number().int().min(1).max(9999)),
  pages: clearable(z.number().int().min(1).max(100_000)),
  language: clearable(
    z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z]{2}$/, { message: "must be a two-letter ISO 639-1 code such as ro" }),
  ),
  series: clearable(shortText),
  seriesNumber: clearable(z.string().trim().max(32)),
  description: clearable(longText),
  subjects: clearable(names),
  collection: clearable(collectionSchema),
  format: clearable(formatSchema),
  condition: clearable(conditionSchema),
  shelf: clearable(shortText),
  signed: clearable(z.boolean()),
  status: clearable(statusSchema),
  rating: clearable(z.number().int().min(1, { message: "must be 1 to 5" }).max(5, { message: "must be 1 to 5" })),
  notes: clearable(longText),
  acquiredOn: clearable(z.iso.date({ message: "must be a date as YYYY-MM-DD" })),
  acquiredFrom: clearable(shortText),
  priceMinor: clearable(z.number().int().min(0)),
  currency: clearable(
    z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, { message: "must be a three-letter code such as RON" }),
  ),
  metadataSource: clearable(metadataSourceSchema),
  tags: clearable(names),
};

/**
 * `POST /api/books`. Only the title is required. Left out, `collection` is
 * `owned`, `status` `unread`, `signed` false, `currency` RON, `metadataSource`
 * `manual`, and `authorSort` is derived from the first author. Unknown keys are
 * refused, so a misspelt field is a 400 rather than silently dropped.
 */
export const bookCreateSchema = z.strictObject({ title: titleSchema, ...bookFields });
export type BookCreate = z.infer<typeof bookCreateSchema>;

/**
 * `PATCH /api/books/:id`. Every field is optional; a missing one is left as it
 * is and `null` clears it (see `clearable`). The title can be changed, never
 * cleared. A patch of `authors` re-derives `authorSort` only if the stored one
 * was derived; `authorSort: null` derives it again.
 */
export const bookPatchSchema = z.strictObject({ title: titleSchema.optional(), ...bookFields });
export type BookPatch = z.infer<typeof bookPatchSchema>;

/**
 * The sort key for a list of authors, from the first: "Mircea Cărtărescu" →
 * "Cărtărescu, Mircea". A one-word name, or one already written with a comma,
 * is kept as it is. No authors → `null`.
 */
export function deriveAuthorSort(authors: readonly string[]): string | null {
  const first = authors[0]?.trim().replace(/\s+/g, " ");
  if (!first) return null;
  if (first.includes(",")) return first;
  const space = first.lastIndexOf(" ");
  if (space === -1) return first;
  return `${first.slice(space + 1)}, ${first.slice(0, space)}`;
}
