import {
  RECOMMENDATIONS_MAX,
  recommendationImportSchema,
  type ImportJob,
  type RecommendationList,
} from "@shelfmark/shared";
import type { FastifyPluginAsync } from "fastify";
import type { Db } from "../../db/open.js";
import { ApiError } from "../../lib/api-error.js";
import { createCatalogCache } from "./cache.js";
import { createImportJob, ImportBusy } from "./job.js";
import { createCatalog } from "./openlibrary.js";
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
export const recommendationRoutes: FastifyPluginAsync<RecommendationRoutesOptions> = async (app, { db, fetch }) => {
  const store = createRecommendationStore(db);
  const job = createImportJob(createCatalog(createCatalogCache(db), { fetch }), store);

  app.get("/api/recommendations", (): RecommendationList => ({ recommendations: store.list(RECOMMENDATIONS_MAX) }));

  app.post("/api/recommendations/import", (request, reply) => {
    // A body that isn't the documented JSON is a 400 `validation` naming the field, and changes nothing.
    const picks = recommendationImportSchema.parse(request.body);
    try {
      job.start(picks);
    } catch (error) {
      if (error instanceof ImportBusy) throw new ApiError("conflict", error.message);
      throw error;
    }
    return reply.code(202).send(job.state());
  });

  app.get("/api/recommendations/import", (): ImportJob => job.state());

  app.post<{ Params: { key: string } }>("/api/recommendations/:key/dismiss", (request, reply) => {
    if (!store.dismiss(request.params.key)) throw new ApiError("not_found", "There is no such recommendation.");
    return reply.code(204).send();
  });
};
