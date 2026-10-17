import { z } from "zod";
import { isbn13Schema, type MetadataSource } from "./book.js";

/**
 * A lookup fetches a book's details for an ISBN from the metadata sources,
 * through the server and its cache; it answers a draft, which the owner
 * confirms or edits before the book is saved (corpus/wiki/glossary.md,
 * corpus/wiki/metadata-lookup.md). A lookup saves nothing.
 */

/**
 * Every source, in the order a lookup asks them: Open Library, the three
 * Romanian library catalogs (the Romanian Academy Library, BCU Cluj, BCU
 * Timișoara), then Google Books. Each is asked only while no earlier one has
 * found a title (decisions.md, 2026-10-17).
 */
export const LOOKUP_SOURCES = ["openlibrary", "biblacad", "bcucluj", "bcutimisoara", "googlebooks"] as const;
export const lookupSourceSchema = z.enum(LOOKUP_SOURCES);
export type LookupSource = z.infer<typeof lookupSourceSchema>;

/**
 * How one source did. `skipped_no_key`: Google Books was needed but the
 * server has no `GOOGLE_BOOKS_API_KEY`. A source that was not needed (any
 * after the one that found a title) is not in `tried` at all.
 */
export const LOOKUP_OUTCOMES = ["found", "not_found", "error", "skipped_no_key"] as const;
export const lookupOutcomeSchema = z.enum(LOOKUP_OUTCOMES);
export type LookupOutcome = z.infer<typeof lookupOutcomeSchema>;

/** A cover the server can download with `POST /api/books/:id/cover/fetch`. Always `https`. */
export const coverCandidateSchema = z.object({
  url: z.url({ protocol: /^https$/ }),
  source: lookupSourceSchema,
});
export type CoverCandidate = z.infer<typeof coverCandidateSchema>;

/**
 * The `BookCreate` fields a lookup can fill, `null` (or empty) where no source
 * had a value, plus the cover candidates (best first, in the order the sources
 * were asked) and the sources the values came from. Text is already trimmed
 * and within `bookCreateSchema`'s limits, so the fields can be sent to
 * `POST /api/books` as they are once the owner has a title.
 */
export const draftSchema = z.object({
  isbn13: isbn13Schema,
  /** `null` only if every source that found the book left it out. */
  title: z.string().nullable(),
  subtitle: z.string().nullable(),
  authors: z.array(z.string()),
  publisher: z.string().nullable(),
  publishedYear: z.number().int().nullable(),
  pages: z.number().int().nullable(),
  /** ISO 639-1, e.g. `ro`. */
  language: z.string().nullable(),
  description: z.string().nullable(),
  subjects: z.array(z.string()),
  coverCandidates: z.array(coverCandidateSchema),
  /** Every source that supplied a value, in the order asked. Never empty. */
  sources: z.array(lookupSourceSchema).min(1),
});
export type Draft = z.infer<typeof draftSchema>;

/** The `metadataSource` to save a book from this draft with: the first source that supplied a value. */
export function draftMetadataSource(sources: readonly LookupSource[]): MetadataSource {
  return sources[0] ?? "openlibrary";
}

/** `POST /api/lookup`. Any ISBN-10 or ISBN-13 spelling `parseIsbn` accepts (hyphens, spaces). */
export const lookupRequestSchema = z.strictObject({
  isbn: z.string({ error: "send the ISBN as a string" }).max(64),
});
export type LookupRequest = z.infer<typeof lookupRequestSchema>;

/**
 * `POST /api/lookup` answers this. `draft` is `null` when no source found the
 * ISBN. `tried` lists the sources in the order they were asked. `owned` and
 * `wishlisted` are the copies already saved with this ISBN, by id.
 */
export const lookupResponseSchema = z.object({
  isbn13: isbn13Schema,
  draft: draftSchema.nullable(),
  tried: z.array(z.object({ source: lookupSourceSchema, outcome: lookupOutcomeSchema })),
  owned: z.array(
    z.object({ id: z.number().int().positive(), shelf: z.string().nullable(), createdAt: z.iso.datetime() }),
  ),
  wishlisted: z.array(z.object({ id: z.number().int().positive() })),
});
export type LookupResponse = z.infer<typeof lookupResponseSchema>;

// Covers (`/api/books/:id/cover`).

/** What `PUT /api/books/:id/cover` accepts and `GET` can answer. */
export const COVER_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const coverMimeSchema = z.enum(COVER_MIME_TYPES);
export type CoverMime = z.infer<typeof coverMimeSchema>;

/** 2 MB, for an upload and a download alike. The web app resizes photos well below it. */
export const COVER_MAX_BYTES = 2 * 1024 * 1024;

/** Where a stored cover came from: a photo or file the owner sent, or a source's candidate. */
export const COVER_SOURCES = ["upload", "openlibrary", "googlebooks"] as const;
export const coverSourceSchema = z.enum(COVER_SOURCES);
export type CoverSource = z.infer<typeof coverSourceSchema>;

/** `PUT /api/books/:id/cover` and `POST /api/books/:id/cover/fetch` answer the stored cover's facts. */
export const coverInfoSchema = z.object({
  mime: coverMimeSchema,
  /** Bytes. */
  size: z.number().int().positive(),
  source: coverSourceSchema,
  /** UTC ISO timestamp. Changes with every replace: a cache-busting `?v=` for the image URL. */
  updatedAt: z.iso.datetime(),
});
export type CoverInfo = z.infer<typeof coverInfoSchema>;

/** `POST /api/books/:id/cover/fetch`: a `coverCandidates` URL from a draft. */
export const coverFetchRequestSchema = z.strictObject({
  url: z.string({ error: "send the cover URL as a string" }).max(2048),
});
export type CoverFetchRequest = z.infer<typeof coverFetchRequestSchema>;
