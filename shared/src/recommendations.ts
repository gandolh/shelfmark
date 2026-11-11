import { z } from "zod";

/**
 * Recommendations (corpus/wiki/recommendations.md): books in no collection,
 * suggested from what the library holds. These schemas are the API's
 * contract. The import schema is the one the Wishlist page documents and the
 * prompt for Claude names.
 */

/** Up to this many picks in one import, and on the list. */
export const RECOMMENDATIONS_MAX = 30;

/** Where a recommendation came from. A later source adds a value. */
export const recommendationSourceSchema = z.enum(["claude", "series"]);
export type RecommendationSource = z.infer<typeof recommendationSourceSchema>;

export const recommendationSchema = z.object({
  /** The work's Open Library key (`/works/OL45883W`) when known, else the title key. Identifies the card. */
  key: z.string().min(1),
  title: z.string().min(1),
  authors: z.array(z.string()),
  year: z.number().int().nullable(),
  language: z.string().nullable(),
  coverUrl: z.string().nullable(),
  isbn13: z.string().nullable(),
  /** One line each: "Because you have 4 books by …", or Claude's own. */
  reasons: z.array(z.string()),
  source: recommendationSourceSchema,
  /** The work's page on Open Library, when it has a key. */
  openLibraryUrl: z.string().nullable(),
});
export type Recommendation = z.infer<typeof recommendationSchema>;

export const recommendationListSchema = z.object({ recommendations: z.array(recommendationSchema) });
export type RecommendationList = z.infer<typeof recommendationListSchema>;

/** One pick in the JSON Claude returns. */
export const importPickSchema = z.object({
  title: z.string().trim().min(1).max(300),
  authors: z.array(z.string().trim().min(1).max(200)).max(10),
  isbn13: z
    .string()
    .regex(/^97[89]\d{10}$/, "an ISBN-13 without hyphens")
    .optional(),
  reason: z.string().trim().min(1).max(500),
});
export type ImportPick = z.infer<typeof importPickSchema>;

export const recommendationImportSchema = z.array(importPickSchema).min(1).max(RECOMMENDATIONS_MAX);
export type RecommendationImport = z.infer<typeof recommendationImportSchema>;

/** A pick the check could not match to a real book. */
export const notFoundPickSchema = z.object({ title: z.string(), authors: z.array(z.string()) });

export const importJobSchema = z.object({
  state: z.enum(["idle", "running", "done"]),
  total: z.number().int().min(0),
  checked: z.number().int().min(0),
  /** Not in Open Library: never shown as a recommendation. */
  notFound: z.array(notFoundPickSchema),
  /** Dropped because the book is owned, wished for, dismissed or already listed. */
  dropped: z.number().int().min(0),
  added: z.number().int().min(0),
});
export type ImportJob = z.infer<typeof importJobSchema>;
