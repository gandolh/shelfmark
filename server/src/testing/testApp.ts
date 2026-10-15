import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { buildApp, type BuildAppOptions } from "../app.js";
import { loadConfig, type Config } from "../config.js";

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
 * No test touches the network: the app's outbound `fetch` (lookups, cover
 * downloads) refuses every request unless the test passes its own, answering
 * from recorded fixtures:
 *
 *     const t = await startTestApp({}, { fetch: fakeFetch });
 */

export interface TestApp {
  app: FastifyInstance;
  config: Config;
  /** The temporary data directory. */
  dataDir: string;
  close(): Promise<void>;
}

export interface TestAppOptions {
  /** The app's outbound `fetch`. Default: one that rejects every request. */
  fetch?: BuildAppOptions["fetch"];
}

const refuseNetwork: typeof globalThis.fetch = (input) => {
  const url = input instanceof Request ? input.url : String(input);
  return Promise.reject(new Error(`A test tried to reach the network: ${url}. Pass a fake fetch to startTestApp.`));
};

export async function startTestApp(overrides: NodeJS.ProcessEnv = {}, options: TestAppOptions = {}): Promise<TestApp> {
  const dataDir = await mkdtemp(join(tmpdir(), "shelfmark-test-"));
  const config = loadConfig({ DATA_DIR: dataDir, ...overrides });
  const app = await buildApp(config, { fetch: options.fetch ?? refuseNetwork });
  return {
    app,
    config,
    dataDir,
    async close() {
      await app.close();
      await rm(dataDir, { recursive: true, force: true });
    },
  };
}
