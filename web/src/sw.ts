/// <reference lib="webworker" />
import { ExpirationPlugin } from "workbox-expiration";
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute, type PrecacheEntry } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst } from "workbox-strategies";
import { appBase } from "./base";
import { COVER_CACHE, isApiPath, isCoverPath } from "./pwa/routes";

/*
 * Shelfmark's service worker (vite-plugin-pwa, injectManifest; brief 12).
 *
 * v1 keeps the app shell offline, not the data: the shell and the scanner's
 * .wasm are precached, navigations get index.html, and of the API only book
 * covers are kept. Nothing else under `/shelfmark-api/` is ever stored: every
 * route needs the session cookie, so a stored response would outlive it.
 */

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (string | PrecacheEntry)[] };

const BASE = appBase();

// A new worker waits until the owner presses "Reload" (pwa/register.ts), so an
// update never restarts the camera by itself.
self.addEventListener("message", (event) => {
  if ((event.data as { type?: unknown } | null)?.type === "SKIP_WAITING") void self.skipWaiting();
});

// HTML, JS, CSS, icons, and the scanner's .wasm, listed at build time.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Every navigation under the base opens the shell; the app's router takes it
// from there. The API is never a page.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL(`${BASE}index.html`), {
    denylist: [/^\/shelfmark-api(\/|$)/],
  }),
);

// Covers: cache-first, so the library's covers survive a bad connection. The
// address carries `?v=<Book.coverUpdatedAt>`, so a replaced cover is a new key.
// Only 200s are stored (the default), never a 401 from a lapsed session.
registerRoute(
  ({ url, request }) => request.method === "GET" && isApiPath(url.pathname) && isCoverPath(url.pathname),
  new CacheFirst({
    cacheName: COVER_CACHE.name,
    plugins: [
      new ExpirationPlugin({ maxEntries: COVER_CACHE.maxEntries, maxAgeSeconds: COVER_CACHE.maxAgeSeconds, purgeOnQuotaError: true }),
    ],
  }),
);
// No other route is registered for `/shelfmark-api/`, so the browser goes to the network for it.
