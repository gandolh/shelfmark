import Fastify, { type FastifyInstance, type FastifyPluginAsync, type FastifyServerOptions } from "fastify";
import type { Config } from "./config.js";

/**
 * Every feature's routes, registered in this order. A later brief adds its
 * plugin here and nowhere else in this file.
 */
const FEATURES: FastifyPluginAsync[] = [];

export interface BuildAppOptions {
  /** Fastify's logger option. Default off; `index.ts` turns it on. */
  logger?: FastifyServerOptions["logger"];
}

export async function buildApp(_config: Config, options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false });

  app.get("/api/health", async () => ({ ok: true }));

  for (const feature of FEATURES) await app.register(feature);

  return app;
}
