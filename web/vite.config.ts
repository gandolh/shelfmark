import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import basicSsl from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type ProxyOptions } from "vite";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Local dev on one origin, the way Caddy serves the deploy: `/shelfmark-api` is
 * the API with the prefix stripped, so paths match production.
 */
function devProxy(env: Record<string, string>): Record<string, ProxyOptions> {
  return {
    "/shelfmark-api": {
      target: `http://127.0.0.1:${env.PORT || 8808}`,
      rewrite: (url) => url.replace(/^\/shelfmark-api/, ""),
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, REPO_ROOT, "");
  const rawBase = process.env.SHELFMARK_BASE ?? env.SHELFMARK_BASE ?? "/shelfmark/";
  // Scope, start URL and the navigation fallback all assume one trailing slash.
  const base = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;
  // A phone's camera needs HTTPS, so `npm run dev:https` serves a local
  // certificate on the LAN. The certificate is generated in memory, never committed.
  const https = process.env.SHELFMARK_HTTPS === "1";

  return {
    base,
    plugins: [react(), ...(https ? [basicSsl()] : [])],
    server: {
      port: 5176,
      strictPort: true,
      ...(https ? { host: "0.0.0.0" } : {}),
      proxy: devProxy(env),
    },
  };
});
