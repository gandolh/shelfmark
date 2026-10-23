# Task 30: Fill a book from a photo of its CIP block

## Context

Promoted 2026-10-23 from the todo [cip-photo-capture](../../todos/cip-photo-capture.md)
("later" in [features.md](../../wiki/features.md)). The owner chose on 2026-10-23:
**OCR in the browser** (Tesseract), so it is free, private and works offline.
Rejected: sending the photo to Claude (better on poor photos, but a paid API key
and the photo leaving the server), and dropping the feature.

Romanian books print a "Descrierea CIP a Bibliotecii Naţionale a României" block on
the copyright page: main heading, title / statement of responsibility, imprint,
ISBN, class numbers. It is the best fallback for the Romanian books the lookups and
the CIP lists miss ([metadata-lookup.md](../../wiki/metadata-lookup.md)).

What exists (checked 2026-10-23):

- [`server/src/cip/parse.ts`](../../../server/src/cip/parse.ts) already reads that
  exact ISBD-style text for the national library's monthly lists: `readDescription`
  turns "PALEOLOGU, THEODOR. Ce ne facem cu atîţia proşti? / Theodor Paleologu. -
  Bucureşti : Editura Trei, 2026" into title, subtitle, authors, publisher, city and
  year, with `romanian()` fixing cedilla letters and an `ISBN` pattern beside it. The
  module has no imports, so it can move.
- [`web/src/add/CoverCapture.tsx`](../../../web/src/add/CoverCapture.tsx) takes a
  photo (`capture="environment"` on a phone, a file picker elsewhere), and
  `web/src/add/resize.ts` scales it. The manual form is `web/src/add/ManualForm.tsx`.
- The scanner already ships wasm (`zxing-wasm` 3.1.3), precached by the worker
  (`web/vite.config.ts`, `globPatterns` with `wasm`). Shelfmark sends no
  Content-Security-Policy today, so a wasm worker runs; if one is added later it
  needs `'wasm-unsafe-eval'` and `worker-src 'self' blob:`.

## Files you OWN

- `shared/src/cip.ts` (new): `readDescription`, `romanian` and the ISBN pattern,
  moved from `server/src/cip/parse.ts` with their tests; the server imports them back
  from `@shelfmark/shared`
- `server/src/cip/parse.ts`, `parse.test.ts` (importing instead of defining)
- `web/src/add/` (a "Read the CIP block" button on the manual form, the OCR call and
  filling the form)
- `web/src/ocr/` (new): loading Tesseract in a worker, self-hosted
- `web/package.json` (`tesseract.js`, pinned exactly), `web/vite.config.ts` (serving
  its worker, core and the Romanian language file from the app, not a CDN)
- `web/src/sw.ts` (runtime-caching the language file on first use)
- `corpus/.planned-roots` (add `web/src/ocr`), `THIRD-PARTY-NOTICES` or the README's
  licences line if the repo keeps one

## Files you must NOT touch

- `server/src/lookup/`: lookups stay as they are; the photo is a separate way in.
- `parseIssue` and the monthly-list job: only the description reading moves.

## What to do

1. Move `readDescription`, `romanian` and the ISBN pattern to `shared/src/cip.ts`
   unchanged, the server imports them, all existing tests still pass.
2. Load Tesseract.js in a worker with `ron` data, all of it served from the app's own
   origin (no CDN; the estate rule). Fetch the language file only when the user first
   presses the button, show its size and progress, and let the worker cache it so
   later reads work offline. Don't put it in the precache: most visits never need it.
3. "Read the CIP block" on the manual form: take a photo with the existing capture,
   crop to the block if the user drags a box (optional), run OCR, then find the
   description: the lines after "Descrierea CIP…" up to the ISBN, with line breaks
   folded the way the list parser expects.
4. Feed it to `readDescription` and the ISBN pattern; fill the form's empty fields
   (never overwrite what the user typed) and highlight what was filled, so it is
   checked before saving. Show the raw OCR text under a disclosure for fixing by hand.
5. If no "Descrierea CIP" heading is found, say so and keep the text available to copy.

## Acceptance

- Photos of five real CIP blocks (fixtures in `web/src/ocr/fixtures/`, no personal
  data) fill title, author and publisher correctly on at least four, and the ISBN on
  all five that show one.
- The server's CIP list tests pass unchanged after the move.
- With the network off after one use, the button still works.
- No request leaves the app's origin during OCR (check the network panel).
- `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` pass.
