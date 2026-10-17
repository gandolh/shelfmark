import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConfigError, loadConfig } from "../config.js";
import { refreshCip } from "./refresh.js";
import { cipDatabasePath, openCipStore } from "./store.js";

/**
 * The CIP refresh by hand, the same one the server's weekly job runs:
 *
 *     node server/dist/cip/cli.js refresh                (in the container)
 *     npx tsx server/src/cip/cli.ts refresh              (from a checkout)
 *     npx tsx server/src/cip/cli.ts refresh 2026-01 2026-02
 *
 * With months, only those issues are fetched, again if need be.
 * It reads `.env` and DATA_DIR as the server does. Running it while the
 * server's own job runs only fetches the same issues twice.
 */

// src/cip and dist/cip sit at the same depth, so this resolves the same from both.
const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

const [command, ...months] = process.argv.slice(2);
if (command !== "refresh" || months.some((month) => !/^20\d{2}-[01]\d$/.test(month))) {
  console.error("Usage: node server/dist/cip/cli.js refresh [YYYY-MM ...]");
  process.exit(2);
}

try {
  process.loadEnvFile(`${REPO_ROOT}.env`);
} catch (err) {
  if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
}

let dataDir: string;
try {
  const config = loadConfig(process.env);
  dataDir = isAbsolute(config.dataDir) ? config.dataDir : resolve(REPO_ROOT, config.dataDir);
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
