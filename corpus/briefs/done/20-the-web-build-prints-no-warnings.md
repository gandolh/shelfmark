# Task 20: The web build prints no warnings

**Depends on:** nothing.
**Builder:** Sonnet.
**Before you start:** run `brief-board guide` (the repo's `CLAUDE.md` says so).

Filed 2026-11-25. The owner asked for the build warnings to be fixed in the most active repos (Shelfmark had 14
commits outside the corpus in the two days before). `npm run build` exits 0, but the web app's Vite 8.3.5 build
prints three warnings.

## Context

From `npm run build` on 2026-11-25:

1. **"Some chunks are larger than 500 kB"**: the entry chunk `index-*.js` is 920 kB (286 kB gzip).
2. **`INEFFECTIVE_DYNAMIC_IMPORT`**: `web/src/export/exportLibrary.ts` is imported dynamically by
   `web/src/layout/AccountMenu.tsx` but statically by `web/src/wishlist/AskClaudeDialog.tsx`, so it stays in the main chunk.
3. **"inlineDynamicImports option is deprecated"**, while vite-plugin-pwa builds `web/src/sw.ts`. The plugin sets
   `output.inlineDynamicImports: true` itself whenever it builds the worker as an ES module. Version 2.0.0 ships the
   same build file byte for byte (checked 2026-11-25), so upgrading doesn't help. In IIFE format it builds the worker
   in library mode and doesn't set the option: a scratch copy built with `rollupFormat: "iife"` on 2026-11-25 printed
   no deprecation and wrote a plain IIFE `sw.js`.

## Decisions

All settled. None of them is open.

- **The entry chunk gets split, not hidden.** Load routes and heavy features that aren't on the first screen with
  dynamic `import()` until no chunk of Shelfmark's own is over 500 kB. The scanner and OCR already load lazily; keep
  them so. `chunkSizeWarningLimit` stays at its default.
- **`exportLibrary` loads on demand in both places**: `AskClaudeDialog` imports it dynamically when it needs it, as
  `AccountMenu` does.
- **The service worker builds as IIFE**: `injectManifest.rollupFormat: "iife"` in `web/vite.config.ts`. `sw.ts` has
  only static imports, and the app registers the worker itself (`injectRegister: false`). Check that the
  registration doesn't ask for `type: "module"`, and drop that if it does.

## Files you OWN

- `web/vite.config.ts`, `web/src/` where an import becomes lazy, `web/src/wishlist/AskClaudeDialog.tsx`, the
  worker's registration
- `corpus/wiki/status.md`, `corpus/log.md`, and the wiki page on the PWA if it names the worker's format

## Files you must NOT touch

- `server/`, `shared/`, `web/src/sw.ts`'s caching rules, other repos.

## Steps

1. See what fills the entry chunk (a bundle visualiser); note the top contributors in the outcome.
2. Make the big, not-first-screen parts lazy, and `exportLibrary` lazy in `AskClaudeDialog`.
3. Switch the worker to IIFE.
4. Rebuild until `npm run build` prints no warning.

## Acceptance

- [ ] `npm run build` exits 0 and prints no warning; the outcome lists the entry chunk's size before and after.
- [ ] `npm run check` exits 0.
- [ ] The update path from today's worker: serve a build of `main` before this change in the preview, load it so its
      worker installs, then serve the new build and reload. The update prompt appears, the new worker takes over, and
      the app works. The outcome says so.
- [ ] On the preview build from a clean profile: the service worker installs; after one load the app shell opens offline; the update
      prompt still appears after a rebuild; reading a CIP block still caches the OCR files on first use; Ask Claude
      and the account menu's export both still work. No failed chunk request, no console error.
- [ ] `bash corpus/lint.sh` passes.

## Owner steps

- `node cli.ts shelfmark deploy` from vps-deploy (the web build only; the API doesn't change).

## Owner decisions

- Settled 2026-11-25 (owner): "run build and fix all the warnings for the most active projects". Which repos count
  (more than 10 commits outside the corpus in two days) and how each warning is fixed are the controller's calls.

## Outcome (2026-11-26)

`npm run build` exits 0 and prints no warning. The entry chunk went from 919.84 kB (285.5 kB gzip) to 377.58 kB
(116.5 kB gzip); the biggest chunk of Shelfmark's own is now that entry, and `chunkSizeWarningLimit` is untouched.

- **What filled the entry** (source bytes per package, from a sourcemap of the old build): the app's own code 850 kB,
  `@base-ui/react` 679 kB, `react-dom` 545 kB, `zod` 370 kB, `@tanstack/table-core` 202 kB, `tailwind-merge` 106 kB.
- **Lazy pages**: `web/src/layout/AppShell.tsx` loads Add a book (and Add to the wishlist), Wishlist, a book, Import
  and Stats with `lazy()` through a small `lazyPage` helper; the Library stays in the entry because it is the first
  screen. Rolldown then moves what only those pages use (Base UI's menus and dialogs, `zod`, `tailwind-merge`, the
  table's columns) into shared chunks, the largest `Page-*.js` at 251 kB.
- **`exportLibrary`** loads on demand in `AskClaudeDialog` as it does in `AccountMenu`; a failed load says so in the
  dialog's message line instead of an unhandled rejection.
- **Worker as IIFE**: `injectManifest.rollupFormat: "iife"` in `web/vite.config.ts`. `pwa/register.ts` builds its
  `Workbox` with no `type: "module"`, so nothing changed there; `dist/sw.js` has no `import`.
- **Checked on `vite preview` in Chromium, real API with a throwaway account (the `.env` is deleted)**: from a build of
  `main` before this change, the worker installed and controlled the page; serving the new build and reloading showed
  "A new version is ready", Reload made the new worker take over and the new entry load, and every route and a book
  page opened. From a clean profile on the new build: the worker installs and controls after one reload; every route,
  a book, the account menu's CSV and Excel exports and Ask Claude's download work; reading a CIP block (a generated
  photo) filled the title and author and left the four OCR files in the `shelfmark-ocr` cache; offline the shell
  opens (the fonts and the session call fail there, as before). No failed chunk request and no console error while
  online.
- Not tried: a phone, and the camera. Ships with `node cli.ts shelfmark deploy` (web only).
