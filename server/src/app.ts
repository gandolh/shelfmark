import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import type { Config } from "./config.js";
import { databasePath, openDb, type Db } from "./db/open.js";
import { auth } from "./plugins/auth/index.js";
import { errors } from "./plugins/errors.js";
import { jsonBodyParser } from "./plugins/json-body.js";
import { backupRoutes } from "./features/backup/index.js";
import { bookRoutes, createBookStore, type BookStore } from "./features/books/index.js";
import { coverRoutes } from "./features/covers/index.js";
import {
  cipDatabasePath,
  lookupRoutes,
  netConnection,
  openCipStore,
  type CipStore,
  type Connect,
} from "./features/lookup/index.js";
import { viewRoutes } from "./features/views/index.js";
import { recommendationRoutes } from "./routes/recommendations.js";

/** What every feature is handed. Add a field only when more than one feature needs it. */
export interface FeatureContext {
  config: Config;
  /** The one connection, migrated, closed with the app. The backup reads it. */
  db: Db;
  /** Books go through this store, never through another module's SQL. */
  books: BookStore;
  /** Every outbound request: the lookup's sources, cover downloads and Ward. Tests pass a fake (`startTestApp`). */
  fetch: typeof globalThis.fetch;
  /** Every outbound TCP connection: the library catalogs' Z39.50. Tests pass a fake (`startTestApp`). */
  connect: Connect;
  /** The CIP index, `<dataDir>/cip.db`, closed with the app. Its weekly refresh is `server.ts`'s. */
  cip: CipStore;
}

/**
 * A feature sets itself up on the root app. Usually that is registering its
 * route plugin with the context, which keeps the plugin's hooks to itself:
 * `(app, ctx) => app.register(bookRoutes, ctx)`.
 */
export type Feature = (app: FastifyInstance, ctx: FeatureContext) => PromiseLike<unknown>;

/**
 * Every feature, set up in this order, after the plugins (`buildApp`). A later
 * brief adds its entry here and nowhere else in this file.
 */
const FEATURES: Feature[] = [
  (app, ctx) => app.register(bookRoutes, ctx),
  (app, ctx) => app.register(lookupRoutes, ctx),
  (app, ctx) => app.register(coverRoutes, ctx),
  (app, ctx) => app.register(backupRoutes, ctx),
  (app, ctx) => app.register(viewRoutes, ctx),
  (app, ctx) => app.register(recommendationRoutes, ctx),
];

/** Fastify's options that belong to the process. `server.ts` sets them; a test leaves them out. */
export type ServerOptions = Pick<
  FastifyServerOptions,
  "trustProxy" | "connectionTimeout" | "requestTimeout" | "keepAliveTimeout"
>;

export interface BuildAppOptions {
  /** Fastify's logger option. Default off; `server.ts` turns it on. */
  logger?: FastifyServerOptions["logger"];
  /** The process's options: `trustProxy` and the timeouts. */
  server?: ServerOptions;
  /** What `FeatureContext.fetch` is. Default the global `fetch`. */
  fetch?: typeof globalThis.fetch;
  /** What `FeatureContext.connect` is. Default a real TCP connection. */
  connect?: Connect;
}

/**
 * The app, not listening, with `<dataDir>/shelfmark.db` open and migrated (the
 * accounts' tables too). Closing the app closes the database. Every route but
 * `GET /api/health` needs a session (`plugins/auth`).
 */
export async function buildApp(config: Config, options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ ...options.server, logger: options.logger ?? false });

  const db = openDb(databasePath(config.dataDir));
  const cip = openCipStore(cipDatabasePath(config.dataDir));
  app.addHook("onClose", async () => {
    db.close();
    cip.close();
  });

  // 1. The app's own plugins, `fastify-plugin` wrapped so they reach everything after them. Errors
  // go first, so every plugin and feature inherits the one handler.
  await app.register(errors);
  await app.register(jsonBodyParser);
  // Accounts and the guard: `wardAuth`'s `onRequest` hook refuses every route set up after it
  // without a session, so this goes before every feature.
  const fetch = options.fetch ?? globalThis.fetch;
  await app.register(auth, { config, db, fetch });

  app.get("/api/health", async () => ({ ok: true }));

  // 2. The features.
  const ctx: FeatureContext = {
    config,
    db,
    books: createBookStore(db),
    fetch,
    connect: options.connect ?? netConnection,
    cip,
  };
  for (const feature of FEATURES) await feature(app, ctx);

  return app;
}
