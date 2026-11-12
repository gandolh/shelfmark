import closeWithGrace from "close-with-grace";
import { buildApp } from "./app.js";
import { startCipJob } from "./cip/job.js";
import { refreshCip } from "./cip/refresh.js";
import { cipDatabasePath, openCipStore } from "./cip/store.js";
import { ConfigError, loadConfig, loadEnvFile, resolveDataDir, type Config } from "./config.js";

// The process: settings, the app, shutdown, listen. Nothing else in the server listens.
const envFile = loadEnvFile();

let config: Config;
try {
  config = loadConfig();
} catch (err) {
  if (!(err instanceof ConfigError)) throw err;
  console.error(`Shelfmark cannot start:\n${err.message}`);
  process.exit(1);
}

// `buildApp` opens `<dataDir>/shelfmark.db` there, creating the directory if needed.
const dataDir = resolveDataDir(config.dataDir);

const app = await buildApp(
  { ...config, dataDir },
  {
    logger: true,
    server: {
      // Loopback (the Vite dev proxy, a server on loopback) plus the proxy's network in a container,
      // so `request.ip` in the logs is the client. Ward's login lockout reads its own list.
      trustProxy: ["loopback", ...config.trustedProxies],
      // A socket silent this long mid-request is cut. The longest silent wait is a cover download
      // (10 s) or a lookup's library catalogs, both answered in a request of their own.
      connectionTimeout: 10_000,
      // The whole request, body included, must arrive within this.
      requestTimeout: 30_000,
      // Longer than the proxy keeps an idle upstream connection (Caddy's default: 2 minutes), so the
      // proxy never sends a request down a socket the server has just closed.
      keepAliveTimeout: 125_000,
    },
  },
);
app.log.info(envFile === undefined ? "no .env: settings from the environment" : `settings from ${envFile}`);

// The weekly CIP refresh, on its own connection to cip.db: lookups read the app's.
if (config.cipRefresh) {
  const store = openCipStore(cipDatabasePath(dataDir));
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

// SIGINT, SIGTERM, an uncaught error: stop taking requests, finish the ones in flight, run every
// onClose hook (the databases close there), and exit. After 10 s it exits anyway.
closeWithGrace({ delay: 10_000, logger: app.log }, async ({ signal, err }) => {
  if (err) app.log.error({ err }, "closing after an uncaught error");
  else app.log.info(`closing on ${signal ?? "request"}`);
  await app.close();
});

try {
  await app.listen({ host: config.host, port: config.port });
} catch (err) {
  app.log.error({ err }, `Shelfmark cannot listen on ${config.host}:${config.port}`);
  process.exit(1);
}
