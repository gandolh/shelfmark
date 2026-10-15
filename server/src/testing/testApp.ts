import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from "fastify";
import { AUTH_ROUTE_PREFIX, SESSION_COOKIE, buildApp, type BuildAppOptions } from "../app.js";
import { openAccounts, seedOwner } from "../auth/accounts.js";
import { loadConfig, type Config } from "../config.js";
import { databasePath, openDb } from "../db/open.js";

/**
 * A whole app for tests, on a fresh temporary `DATA_DIR` so route tests never
 * touch `data/`.
 *
 *     const t = await startTestApp();
 *     const res = await t.app.inject({ method: "GET", url: "/api/health" });
 *     await t.close();
 *
 * `close` stops the app and deletes the directory.
 *
 * Every route but `GET /api/health` needs a session (brief 06). A test that
 * is not about signing in starts a signed-in app and injects through it,
 * which adds the session cookie:
 *
 *     const t = await startSignedInApp();
 *     const res = await t.inject({ method: "GET", url: "/api/books" });
 *
 * `t.signIn()` on any test app creates the one user (once) and signs in
 * through the real `POST /auth/login`, as the login page does, resolving to a
 * `Cookie` header value. The user's password is made up per app, at runtime.
 *
 * No test touches the network: the app's outbound `fetch` (lookups, cover
 * downloads, Ward) refuses every request unless the test passes its own,
 * answering from recorded fixtures:
 *
 *     const t = await startTestApp({}, { fetch: fakeFetch });
 */

export interface TestApp {
  app: FastifyInstance;
  config: Config;
  /** The temporary data directory. */
  dataDir: string;
  /** The user `signIn` creates. It exists only in this app's temporary database. */
  owner: { username: string; password: string };
  /** Create the owner if needed and sign in through `POST /auth/login`. Resolves to the `Cookie` header value. */
  signIn(): Promise<string>;
  close(): Promise<void>;
}

export interface SignedInTestApp extends TestApp {
  /** The session's `Cookie` header value: `shelfmark_session=…`. */
  cookie: string;
  /** `app.inject` with the session cookie (a `cookie` header the test passes wins). */
  inject(options: InjectOptions): Promise<LightMyRequestResponse>;
}

export interface TestAppOptions {
  /** The app's outbound `fetch`. Default: one that rejects every request. */
  fetch?: BuildAppOptions["fetch"];
}

const refuseNetwork: typeof globalThis.fetch = (input) => {
  const url = input instanceof Request ? input.url : String(input);
  return Promise.reject(new Error(`A test tried to reach the network: ${url}. Pass a fake fetch to startTestApp.`));
};

/** The `name=value` pair of the session cookie a response set, if it set one. */
export function sessionCookieFrom(res: LightMyRequestResponse): string | undefined {
  const header = res.headers["set-cookie"];
  const lines = header === undefined ? [] : Array.isArray(header) ? header : [header];
  return lines.map((line) => line.split(";")[0] ?? "").find((pair) => pair.startsWith(`${SESSION_COOKIE}=`));
}

export async function startTestApp(overrides: NodeJS.ProcessEnv = {}, options: TestAppOptions = {}): Promise<TestApp> {
  const dataDir = await mkdtemp(join(tmpdir(), "shelfmark-test-"));
  const config = loadConfig({ DATA_DIR: dataDir, ...overrides });
  const app = await buildApp(config, { fetch: options.fetch ?? refuseNetwork });
  const owner = { username: "owner", password: randomBytes(12).toString("base64url") };

  let created = false;
  async function createOwner(): Promise<void> {
    // A second connection, as a seed run against a live server would be.
    const db = openDb(databasePath(config.dataDir));
    try {
      await seedOwner(openAccounts(db), owner);
    } finally {
      db.close();
    }
    created = true;
  }

  return {
    app,
    config,
    dataDir,
    owner,
    async signIn() {
      if (!created) await createOwner();
      const res = await app.inject({ method: "POST", url: `${AUTH_ROUTE_PREFIX}/login`, payload: owner });
      const cookie = sessionCookieFrom(res);
      if (res.statusCode !== 200 || cookie === undefined) {
        throw new Error(`Signing in answered ${res.statusCode} ${res.body}`);
      }
      return cookie;
    },
    async close() {
      await app.close();
      await rm(dataDir, { recursive: true, force: true });
    },
  };
}

/** `startTestApp`, signed in: `inject` carries the session cookie. */
export async function startSignedInApp(
  overrides: NodeJS.ProcessEnv = {},
  options: TestAppOptions = {},
): Promise<SignedInTestApp> {
  const t = await startTestApp(overrides, options);
  try {
    const cookie = await t.signIn();
    return {
      ...t,
      cookie,
      inject: (request) => t.app.inject({ ...request, headers: { cookie, ...request.headers } }),
    };
  } catch (error) {
    await t.close();
    throw error;
  }
}
