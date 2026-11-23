import { join } from "node:path";
import {
  importJobSchema,
  RECOMMENDATIONS_MAX,
  recommendationImportSchema,
  recommendationListSchema,
  refreshJobSchema,
} from "@shelfmark/shared";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { z } from "zod";
import type { Db } from "../../db/open.js";
import { ApiError } from "../../lib/api-error.js";
import { createCatalogCache } from "./cache.js";
import { createImportJob, ImportBusy } from "./job.js";
import { createCatalog } from "./openlibrary.js";
import { keyParamsSchema } from "./schemas.js";
import { createModelEmbedder } from "./similar/embedder.js";
import { createRefreshJob, RefreshBusy } from "./similar/job.js";
import { createRecommendationStore } from "./store.js";

/** What the recommendation routes take from the app. */
export interface RecommendationRoutesOptions {
  db: Db;
  /** Every outbound request: the Open Library searches. Tests pass a fake. */
  fetch: typeof globalThis.fetch;
  /** The data folder: the model's files are cached in its `models/`. */
  config: { dataDir: string };
}

/**
 * Recommendations (corpus/wiki/recommendations.md): the list, the import of
 * Claude's picks, the Similar refresh, their progress, and "Not interested".
 * The list never holds a book already in the database (dedup.ts).
 */
export const recommendationRoutes: FastifyPluginAsyncZod<RecommendationRoutesOptions> = async (
  app,
  { db, fetch, config },
) => {
  const store = createRecommendationStore(db);
  // One catalog, so the import and the refresh share Open Library's queue and cache.
  const catalog = createCatalog(createCatalogCache(db), { fetch });
  const job = createImportJob(catalog, store);
  const refresh = createRefreshJob({
    catalog,
    store,
    embedder: createModelEmbedder({ modelDir: join(config.dataDir, "models") }),
    log: (error) => app.log.error({ err: error }, "The Similar refresh failed"),
  });
  app.addHook("onClose", () => {
    refresh.stop();
  });

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

  app.post("/api/recommendations/refresh", { schema: { response: { 202: refreshJobSchema } } }, (_request, reply) => {
    try {
      refresh.start();
    } catch (error) {
      if (error instanceof RefreshBusy) throw new ApiError("conflict", error.message);
      throw error;
    }
    reply.code(202);
    return refresh.state();
  });

  app.get("/api/recommendations/refresh", { schema: { response: { 200: refreshJobSchema } } }, () => refresh.state());

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
