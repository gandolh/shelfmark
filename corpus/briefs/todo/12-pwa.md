# Task 12: Install as an app (PWA)

## Context

The owner asked for a website with a PWA: installable on the phone, opening
straight into the library. Read [scanning.md](../../wiki/scanning.md) (the
iOS standalone camera bug: the scanner must stay on one screen, which brief 09
guarantees) and [design.md](../../wiki/design.md) (the ground and accent the
icon and theme colours come from). Satchel's `web/vite.config.ts` and
`web/src/sw.ts` are the house pattern (vite-plugin-pwa with `injectManifest`).

v1 needs the app shell offline, not the data: the offline "do I own this?"
check and the offline scan queue are v1.x todos.

Depends on briefs 04, 07 and 09.

## Files you OWN

```
web/src/sw.ts
web/vite.config.ts            (the VitePWA block)
web/src/pwa/UpdatePrompt.tsx  web/src/pwa/OfflineNotice.tsx  web/src/pwa/register.ts
web/public/icon.svg  web/public/icons/*   (generated PNGs, committed)
web/package.json              (vite-plugin-pwa, workbox-*, the icon generator as a dev dependency)
web/src/App.tsx               (mount UpdatePrompt and OfflineNotice)
```

## Files you must NOT touch

The pages, the scanner, the server.

## What to do

1. **Plugin.** `vite-plugin-pwa` with `strategies: "injectManifest"`, at a
   release at least two weeks old (2.0.0 was eleven days old on 2026-10-14;
   if it is still too new, use Satchel's 1.3.0). Manifest: name and short name
   "Shelfmark", `start_url` and `scope` from the base path, `display:
   "standalone"`, background and theme colours from the `ground` token.
2. **Service worker** (`sw.ts`): precache the app shell and the scanner's
   self-hosted `.wasm` (brief 07); navigation requests fall back to the cached
   `index.html` under the base path; `/shelfmark-api/api/*` is network-only
   except covers, which use cache-first with an expiry (at most 1,000 entries,
   30 days), so the library's covers survive a bad connection.
3. **Icon.** One SVG in the design's language (a simple mark in the accent on
   the ground, legible at 48 px) and the PNG sizes the manifest and iOS need,
   generated with `@vite-pwa/assets-generator` and committed; maskable variant
   included.
4. **Update prompt**: when a new service worker is waiting, a small sheet
   "A new version is ready" with "Reload". Never reload on its own while the
   camera is running.
5. **Offline notice**: when the network is gone, a quiet line under the top
   bar ("You're offline. Your library will be back when you are."); lookups
   and saves say they need the network instead of failing silently.

## Acceptance

- Lighthouse's PWA checks pass on the production build served under
  `/shelfmark/`.
- On an iPhone (Add to Home Screen) and an Android phone (Install), the app
  opens standalone, signs in, and the Add a book page scans without a second
  camera prompt while switching modes (record devices and OS versions in the
  outcome note).
- Rebuilding shows the update prompt in an open app.
- `npm run typecheck && npm run lint && npm test && npm run build` pass.
