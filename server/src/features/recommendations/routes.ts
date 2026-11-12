import {
  importJobSchema,
  RECOMMENDATIONS_MAX,
  recommendationImportSchema,
  recommendationListSchema,
} from "@shelfmark/shared";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { z } from "zod";
import type { Db } from "../../db/open.js";
import { ApiError } from "../../lib/api-error.js";
import { createCatalogCache } from "./cache.js";
import { createImportJob, ImportBusy } from "./job.js";
import { createCatalog } from "./openlibrary.js";
import { keyParamsSchema } from "./schemas.js";
import { createRecommendationStore } from "./store.js";

/** What the recommendation routes take from the app. */
export interface RecommendationRoutesOptions {
  db: Db;
  /** Every outbound request: the Open Library search a pick is checked against. Tests pass a fake. */
  fetch: typeof globalThis.fetch;
}

/**
 * Recommendations (corpus/wiki/recommendations.md): the list, the import of
 * Claude's picks and its progress, and "Not interested". The list never
 * holds a book already in the database (recommend/dedup.ts).
 */
export const recommendationRoutes: FastifyPluginAsyncZod<RecommendationRoutesOptions> = async (app, { db, fetch }) => {
  const store = createRecommendationStore(db);
  const job = createImportJob(createCatalog(createCatalogCache(db), { fetch }), store);

  app.get("/api/recommendations", { schema: { response: { 200: recommendationListSchema } } }, () => ({
    recommendations: store.list(RECOMMENDATIONS_MAX),
  }));

  // A body that isn't the documented JSON is a 400 `validation` naming the field, and changes nothing.
  app.post(
    "/api/recommendations/import",
    { schema: { body: recommendationImportSchema, response: { 202: importJobSchema } } },
    (request, reply) => {
      try {
        job.start(request.body);
      } catch (error) {
        if (error instanceof ImportBusy) throw new ApiError("conflict", error.message);
        throw error;
      }
      reply.code(202);
      return job.state();
    },
  );

  app.get("/api/recommendations/import", { schema: { response: { 200: importJobSchema } } }, () => job.state());

  app.post(
    "/api/recommendations/:key/dismiss",
    { schema: { params: keyParamsSchema, response: { 204: z.null() } } },
    (request, reply) => {
      if (!store.dismiss(request.params.key)) throw new ApiError("not_found", "There is no such recommendation.");
      reply.code(204);
      return null;
    },
  );
};
