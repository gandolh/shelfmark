import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { healthSchema } from "./schemas.js";

/** `GET /api/health`: the one route with no session (`plugins/auth`), for the container's health check. */
export const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/api/health", { schema: { response: { 200: healthSchema } } }, async () => ({ ok: true as const }));
};
