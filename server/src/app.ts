import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import type { Config } from "./config.js";
import { databasePath, openDb, type Db } from "./db/open.js";
import { registerErrorHandling } from "./errors.js";
import { bookRoutes } from "./routes/books.js";
import { coverRoutes } from "./routes/covers.js";
import { lookupRoutes } from "./routes/lookup.js";
import { createBookStore, type BookStore } from "./store/books.js";

/** What every feature is handed. Add a field only when more than one feature needs it. */
export interface FeatureContext {
  config: Config;
  /** The one connection, migrated, closed with the app. Brief 11's backup reads it. */
  db: Db;
  /** Books go through this store, never through another module's SQL. */
  books: BookStore;
  /** Every outbound request: the lookup's sources and cover downloads. Tests pass a fake (`startTestApp`). */
  fetch: typeof globalThis.fetch;
}

/**
 * A feature sets itself up on the root app. Usually that is registering its
 * route plugin with the context, which keeps the plugin's hooks to itself:
 * `(app, ctx) => app.register(bookRoutes, ctx)`. A root guard (brief 06's
 * `wardAuth`) registers on `app` directly and goes first, because Fastify
 * copies root hooks into a plugin's context when the plugin is created.
 */
export type Feature = (app: FastifyInstance, ctx: FeatureContext) => PromiseLike<unknown>;

/** Every feature, set up in this order. A later brief adds its entry here and nowhere else in this file. */
const FEATURES: Feature[] = [
  (app, ctx) => app.register(bookRoutes, ctx),
  (app, ctx) => app.register(lookupRoutes, ctx),
  (app, ctx) => app.register(coverRoutes, ctx),
];

export interface BuildAppOptions {
  /** Fastify's logger option. Default off; `index.ts` turns it on. */
  logger?: FastifyServerOptions["logger"];
  /** What `FeatureContext.fetch` is. Default the global `fetch`. */
  fetch?: typeof globalThis.fetch;
}

/** The app, not listening, with `<dataDir>/shelfmark.db` open and migrated. Closing the app closes the database. */
export async function buildApp(config: Config, options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false });

  const db = openDb(databasePath(config.dataDir));
  app.addHook("onClose", async () => {
    db.close();
  });

  // A request with `Content-Type: application/json` and no body (a client that
  // sets the header on every call, DELETE included) is a body of `undefined`,
  // not a 400. Anything else goes to Fastify's own parser, which keeps its
  // prototype-poisoning checks and its 400 for bad JSON.
  const parseJson = app.getDefaultJsonParser("error", "error");
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser("application/json", { parseAs: "string" }, (request, body, done) => {
    if (body === "") {
      done(null, undefined);
      return;
    }
    parseJson(request, body as string, done);
  });

  registerErrorHandling(app);

  app.get("/api/health", async () => ({ ok: true }));

  const ctx: FeatureContext = { config, db, books: createBookStore(db), fetch: options.fetch ?? globalThis.fetch };
  for (const feature of FEATURES) await feature(app, ctx);

  return app;
}
