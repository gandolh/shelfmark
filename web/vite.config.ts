import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import basicSsl from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin, type ProxyOptions } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** The Tesseract builds shipped: LSTM only (the `ron` data below has no legacy model), best first. */
const OCR_CORES = ["relaxedsimd-lstm", "simd-lstm", "lstm"] as const;

/**
 * Reading the CIP block (brief 30) runs Tesseract.js in a worker, and all of
 * it comes from the app's own origin, never jsDelivr (tesseract.js's default):
 * the worker script, the core's glue and .wasm (one build per device, chosen
 * by ocr/files.ts), and the Romanian `ron` data (best_int, 1.7 MB gzipped).
 *
 * Copied under the base path with their own names, since the core finds its
 * .wasm beside the worker script and Tesseract asks for `<langPath>/ron.traineddata.gz`.
 * Each set sits in a directory named by a hash of its contents
 * (`ocr/tesseract-<hash>/`, `ocr/ron-<hash>/`), so the service worker's
 * cache-first copy is never stale after an upgrade. Not precached (globIgnores
 * below): they are fetched on the first press of "Read the CIP block", and
 * sw.ts keeps them from then on. The app reads the paths and sizes from
 * `__SHELFMARK_OCR__`.
 */
function ocrAssets(): Plugin {
  const require = createRequire(import.meta.url);
  const tesseract = require.resolve("tesseract.js/package.json");
  const core = dirname(createRequire(tesseract).resolve("tesseract.js-core/package.json"));
  const read = (path: string) => readFileSync(path);
  const hashOf = (buffers: Buffer[]) => {
    const hash = createHash("sha256");
    for (const buffer of buffers) hash.update(buffer);
    return hash.digest("hex").slice(0, 10);
  };

  // The worker without its source-map comment (the map isn't shipped), and its licence file beside it.
  const workerJs = Buffer.from(
    read(resolve(dirname(tesseract), "dist/worker.min.js")).toString("utf8").replace(/\n\/\/# sourceMappingURL=\S+\s*$/, "\n"),
  );
  const engine: [string, Buffer][] = [
    ["worker.min.js", workerJs],
    ["worker.min.js.LICENSE.txt", read(resolve(dirname(tesseract), "dist/worker.min.js.LICENSE.txt"))],
    ...OCR_CORES.flatMap((name) => [
      [`tesseract-core-${name}.js`, read(resolve(core, `tesseract-core-${name}.js`))] as [string, Buffer],
      [`tesseract-core-${name}.wasm`, read(resolve(core, `tesseract-core-${name}.wasm`))] as [string, Buffer],
    ]),
  ];
  const ronPath = require.resolve("@tesseract.js-data/ron/4.0.0_best_int/ron.traineddata.gz");
  const lang: [string, Buffer][] = [[basename(ronPath), read(ronPath)]];

  const engineDir = `ocr/tesseract-${hashOf(engine.map(([, buffer]) => buffer))}/`;
  const langDir = `ocr/ron-${hashOf(lang.map(([, buffer]) => buffer))}/`;
  const files = new Map<string, Buffer>([
    ...engine.map(([name, buffer]) => [engineDir + name, buffer] as const),
    ...lang.map(([name, buffer]) => [langDir + name, buffer] as const),
  ]);
  const size = (dir: string, name: string) => files.get(dir + name)!.length;
  const manifest = {
    engine: engineDir,
    lang: langDir,
    bytes: {
      worker: size(engineDir, "worker.min.js"),
      cores: Object.fromEntries(
        OCR_CORES.map((name) => [name, { js: size(engineDir, `tesseract-core-${name}.js`), wasm: size(engineDir, `tesseract-core-${name}.wasm`) }]),
      ),
      ron: size(langDir, "ron.traineddata.gz"),
    },
  };
  const TYPES: Record<string, string> = { js: "text/javascript", wasm: "application/wasm", gz: "application/gzip", txt: "text/plain" };

  let base = "/";
  return {
    name: "shelfmark-ocr-assets",
    config: () => ({ define: { __SHELFMARK_OCR__: JSON.stringify(manifest) } }),
    configResolved(config) {
      base = config.base;
    },
    // Dev: answer for them at the same paths the build emits.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? "").split("?")[0]!;
        const file = path.startsWith(base) ? files.get(path.slice(base.length)) : undefined;
        if (!file) return next();
        res.setHeader("Content-Type", TYPES[path.split(".").at(-1)!] ?? "application/octet-stream");
        res.setHeader("Content-Length", file.length);
        res.end(file);
      });
    },
    generateBundle() {
      for (const [fileName, source] of files) this.emitFile({ type: "asset", fileName, source });
    },
  };
}

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
    plugins: [
      react(),
      ocrAssets(),
      ...(https ? [basicSsl()] : []),
      VitePWA({
        // Our own worker, src/sw.ts: precache plus a covers cache. workbox only
        // injects the file list.
        strategies: "injectManifest",
        srcDir: "src",
        filename: "sw.ts",
        // A new worker waits; pwa/register.ts applies it when "Reload" is pressed.
        registerType: "prompt",
        // pwa/register.ts registers it (workbox-window).
        injectRegister: false,
        // The icons are in public/ and the glob below precaches them once.
        includeManifestIcons: false,
        manifest: {
          id: base,
          name: "Shelfmark",
          short_name: "Shelfmark",
          description: "A catalog of the physical books at home.",
          lang: "en",
          display: "standalone",
          scope: base,
          start_url: base,
          // Raw hex: the manifest can't read CSS tokens. Keep in step with
          // --ground (#F5F5F3) in src/styles/tokens.css and design.md's table.
          theme_color: "#F5F5F3",
          background_color: "#F5F5F3",
          // Relative, so they resolve against the manifest under `base`.
          icons: [
            { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
            { src: "icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        },
        injectManifest: {
          // The app shell, and the scanner's zxing .wasm (1.09 MB, under
          // workbox's 2 MiB limit) so scanning starts offline. Nothing of the
          // API is cached here.
          globPatterns: ["**/*.{js,css,html,png,svg,ico,wasm}"],
          // Tesseract's worker, cores and language data (ocrAssets above): about
          // 4.8 MB a device needs only if it reads a CIP block, so sw.ts caches
          // them on that first use instead.
          globIgnores: ["ocr/**"],
        },
      }),
    ],
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
    // `vite preview` serves the built app and its service worker, behind the same proxy.
    preview: { port: 4176, strictPort: true, proxy: devProxy(env, https) },
  };
});
