import type { FastifyInstance } from "fastify";
import type { Config } from "../../../config.js";
import { startCipJob } from "./job.js";
import { refreshCip } from "./refresh.js";
import { cipDatabasePath, openCipStore } from "./store.js";

/**
 * The weekly CIP refresh, unless `CIP_REFRESH=off`: on its own connection to
 * cip.db (lookups read the app's), stopped and closed with the app. The entry
 * calls it after `buildApp`; tests and the seed never do.
 */
export function startCip(app: FastifyInstance, config: Pick<Config, "cipRefresh" | "dataDir">): void {
  if (!config.cipRefresh) return;
  const store = openCipStore(cipDatabasePath(config.dataDir));
  const log = {
    info: (m: string) => app.log.info(m),
    warn: (m: string) => app.log.warn(m),
    error: (m: string) => app.log.error(m),
  };
  const job = startCipJob(() => refreshCip({ store, fetch: globalThis.fetch, log }), log);
  app.addHook("onClose", async () => {
    job.stop();
    store.close();
  });
}
