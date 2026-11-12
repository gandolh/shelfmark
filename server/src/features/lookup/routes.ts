import { lookupRequestSchema, lookupResponseSchema, parseIsbn, type ParseIsbnResult } from "@shelfmark/shared";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import type { Config } from "../../config.js";
import type { Db } from "../../db/open.js";
import { ApiError } from "../../lib/api-error.js";
import type { BookStore } from "../books/index.js";
import { createLookupCache } from "./cache.js";
import type { CipStore } from "./cip/store.js";
import { createCipSource } from "./cip.js";
import { createGoogleBooksSource } from "./googlebooks.js";
import { createLibrarySource, LIBRARY_ORDER } from "./libraries.js";
import { createLookup } from "./merge.js";
import { createOpenLibrarySource } from "./openlibrary.js";
import type { Connect } from "./z3950/client.js";

const REASONS: Record<Extract<ParseIsbnResult, { ok: false }>["reason"], string> = {
  length: "an ISBN has 10 or 13 digits",
  checksum: "the check digit doesn't match",
  not_isbn: "this is not an ISBN",
};

/** What the lookup route takes from the app. */
export interface LookupRoutesOptions {
  config: Pick<Config, "googleBooksApiKey">;
  db: Db;
  /** The copies already saved with an ISBN. */
  books: BookStore;
  /** Every outbound request: Open Library and Google Books. Tests pass a fake. */
  fetch: typeof globalThis.fetch;
  /** Every outbound TCP connection: the library catalogs' Z39.50. Tests pass a fake. */
  connect: Connect;
  /** The CIP index, closed with the app. */
  cip: CipStore;
}

/**
 * `POST /api/lookup { isbn }`: an ISBN to a draft, plus the copies
 * already saved with it. Nothing is saved. The sources' queues live as long as
 * the app, so every lookup and every batch shares them: the library catalogs'
 * pause between requests holds across lookups.
 */
export const lookupRoutes: FastifyPluginAsyncZod<LookupRoutesOptions> = async (
  app,
  { config, db, books, fetch, connect, cip },
) => {
  const lookup = createLookup({
    sources: [
      createOpenLibrarySource({ fetch }),
      ...LIBRARY_ORDER.map((library) => createLibrarySource(library, { connect })),
      createCipSource(cip),
      createGoogleBooksSource({ apiKey: config.googleBooksApiKey, fetch }),
    ],
    cache: createLookupCache(db),
    onError: (source, isbn13, error) => {
      app.log.warn(
        { source, isbn13, reason: error instanceof Error ? error.message : String(error) },
        "lookup source failed",
      );
    },
  });

  app.post(
    "/api/lookup",
    { schema: { body: lookupRequestSchema, response: { 200: lookupResponseSchema } } },
    async (request) => {
      const { isbn } = request.body;
      const parsed = parseIsbn(isbn);
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
    },
  );
};
