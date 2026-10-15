import { lookupRequestSchema, parseIsbn, type LookupResponse, type ParseIsbnResult } from "@shelfmark/shared";
import type { FastifyPluginAsync } from "fastify";
import type { FeatureContext } from "../app.js";
import { ApiError } from "../errors.js";
import { createLookupCache } from "../lookup/cache.js";
import { createGoogleBooksSource } from "../lookup/googlebooks.js";
import { createLookup } from "../lookup/merge.js";
import { createOpenLibrarySource } from "../lookup/openlibrary.js";

const REASONS: Record<Extract<ParseIsbnResult, { ok: false }>["reason"], string> = {
  length: "an ISBN has 10 or 13 digits",
  checksum: "the check digit doesn't match",
  not_isbn: "this is not an ISBN",
};

/**
 * `POST /api/lookup { isbn }` (brief 05): an ISBN to a draft, plus the copies
 * already saved with it. Nothing is saved. The sources' queues live as long as
 * the app, so every lookup and every batch shares them.
 */
export const lookupRoutes: FastifyPluginAsync<FeatureContext> = async (app, { config, db, books, fetch }) => {
  const lookup = createLookup({
    sources: [createOpenLibrarySource({ fetch }), createGoogleBooksSource({ apiKey: config.googleBooksApiKey, fetch })],
    cache: createLookupCache(db),
    onError: (source, isbn13, error) => {
      app.log.warn({ source, isbn13, reason: error instanceof Error ? error.message : String(error) }, "lookup source failed");
    },
  });

  app.post("/api/lookup", async (request): Promise<LookupResponse> => {
    const parsed = parseIsbn(lookupRequestSchema.parse(request.body).isbn);
    if (!parsed.ok) throw new ApiError("validation", `isbn: ${REASONS[parsed.reason]}`);
    const { isbn13 } = parsed;

    const copies = books.findByIsbn(isbn13);
    const { draft, tried } = await lookup.lookup(isbn13);
    return {
      isbn13,
      draft,
      tried,
      owned: copies
        .filter((book) => book.collection === "owned")
        .map(({ id, shelf, createdAt }) => ({ id, shelf, createdAt })),
      wishlisted: copies.filter((book) => book.collection === "wishlist").map(({ id }) => ({ id })),
    };
  });
};
