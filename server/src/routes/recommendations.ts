import {
  RECOMMENDATIONS_MAX,
  recommendationImportSchema,
  type ImportJob,
  type RecommendationList,
} from "@shelfmark/shared";
import type { FastifyPluginAsync } from "fastify";
import type { FeatureContext } from "../app.js";
import { ApiError } from "../errors.js";
import { createCatalogCache } from "../recommend/cache.js";
import { createImportJob, ImportBusy } from "../recommend/job.js";
import { createCatalog } from "../recommend/openlibrary.js";
import { createRecommendationStore } from "../recommend/store.js";

/**
 * Recommendations (corpus/wiki/recommendations.md): the list, the import of
 * Claude's picks and its progress, and "Not interested". The list never
 * holds a book already in the database (recommend/dedup.ts).
 */
export const recommendationRoutes: FastifyPluginAsync<FeatureContext> = async (app, { db, fetch }) => {
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
