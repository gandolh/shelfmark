import { ConfigError, loadConfig, loadEnvFile, resolveDataDir } from "../../../config.js";
import { refreshCip } from "./refresh.js";
import { cipDatabasePath, openCipStore } from "./store.js";

/**
 * The CIP refresh by hand, the same one the server's weekly job runs:
 *
 *     node server/dist/features/lookup/cip/cli.js refresh                (in the container)
 *     npx tsx server/src/features/lookup/cip/cli.ts refresh              (from a checkout)
 *     npx tsx server/src/features/lookup/cip/cli.ts refresh 2026-01 2026-02
 *
 * With months, only those issues are fetched, again if need be.
 * It reads `.env` and DATA_DIR as the server does. Running it while the
 * server's own job runs only fetches the same issues twice.
 */

const [command, ...months] = process.argv.slice(2);
if (command !== "refresh" || months.some((month) => !/^20\d{2}-[01]\d$/.test(month))) {
  console.error("Usage: node server/dist/features/lookup/cip/cli.js refresh [YYYY-MM ...]");
  process.exit(2);
}

loadEnvFile();

let dataDir: string;
try {
  dataDir = resolveDataDir(loadConfig().dataDir);
} catch (err) {
  if (!(err instanceof ConfigError)) throw err;
  console.error(`The CIP refresh cannot start:\n${err.message}`);
  process.exit(1);
}

const store = openCipStore(cipDatabasePath(dataDir));
try {
  const result = await refreshCip({
    store,
    fetch: globalThis.fetch,
    log: console,
    ...(months.length > 0 ? { months } : {}),
  });
  console.log(
    `Imported ${result.imported.length} issue(s), ${result.failed.length} failed; the index holds ${store.size()} ISBNs.`,
  );
  process.exitCode = result.failed.length > 0 ? 1 : 0;
} finally {
  store.close();
}
