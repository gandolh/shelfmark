import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import basicSsl from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type ProxyOptions } from "vite";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Local dev on one origin, the way Caddy serves the deploy: `/shelfmark-api` is
 * the API with the prefix stripped, so paths match production. The session
 * cookie is scoped to that prefix, and so are the auth routes and Ward's
 * callback (`/shelfmark-api/auth/ward/callback`), so this one rule carries all
 * of it. Ward itself is reached at its own origin and needs no rule.
 *
 * The server refuses a write whose `Origin` isn't its PUBLIC_ORIGIN
 * (`http://localhost:5176` by default): the auth plugin on `/auth/*`,
 * `server/src/auth/guard.ts` on the rest. `npm run dev:https` is opened from a
 * phone at `https://<LAN address>:5176`, another origin for the same dev
 * server. So a request whose `Origin` is exactly the address the browser
 * opened this server at (its `Host`, or HTTP/2's `:authority`, in this
 * server's scheme) reaches the API with PUBLIC_ORIGIN instead. Any other
 * `Origin` passes through untouched and is refused, as in production, where
 * there is no Vite. (`changeOrigin` stays off: it would replace the `Host`
 * this compares against.) "Sign in with Ward" still only works at
 * PUBLIC_ORIGIN: Ward sends the browser back there.
 */
function devProxy(env: Record<string, string>, https: boolean): Record<string, ProxyOptions> {
  const publicOrigin = env.PUBLIC_ORIGIN || "http://localhost:5176";
  const scheme = https ? "https" : "http";
  return {
    "/shelfmark-api": {
      target: `http://127.0.0.1:${env.PORT || 8808}`,
      rewrite: (url) => url.replace(/^\/shelfmark-api/, ""),
      configure: (proxy) => {
        proxy.on("proxyReq", (proxyReq, req) => {
          // Over HTTPS the browser speaks HTTP/2, which names the host in `:authority`, not `Host`.
          const { origin, host = req.headers[":authority"] } = req.headers;
          if (typeof origin === "string" && typeof host === "string" && origin === `${scheme}://${host}`) {
            proxyReq.setHeader("origin", publicOrigin);
          }
        });
      },
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
    // The scanner imports the barcode ponyfill lazily; listing it here bundles it
    // at dev-server start, so opening the scanner never triggers Vite's
    // "new dependency, reload" (a reload would restart the camera). Its .wasm
    // is not configured here: scanner/detector.ts imports it with `?url`, so
    // Vite serves it from our origin in dev and emits it under the base path
    // in the build, where the service worker can precache it.
    optimizeDeps: { include: ["barcode-detector/ponyfill"] },
    server: {
      port: 5176,
      strictPort: true,
      ...(https ? { host: "0.0.0.0" } : {}),
      proxy: devProxy(env, https),
    },
  };
});
