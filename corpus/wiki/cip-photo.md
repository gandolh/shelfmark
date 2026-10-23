---
summary: How "Read the CIP block" fills the by-hand form from a photo of a Romanian book's copyright page (brief 30, built 2026-10-23). Tesseract.js in the browser with the Romanian data, every file served from the app (no CDN) and cached by the service worker on first use (4.8 MB, not precached), Sauvola thresholds for shadowed photos, how the description is found in the OCR text and read with the CIP list parser, which fields are filled (only empty ones) and how they are marked, the fixtures and what is still unchecked.
updated: 2026-10-23
---

# Reading the CIP block from a photo

Romanian books print the [CIP](glossary.md) on the copyright page, under "Descrierea CIP a
Bibliotecii Naţionale a României". When the lookups and the [CIP index](metadata-lookup.md)
miss a book, "Read the CIP block" on the by-hand form reads that block from a photo. The owner
chose on 2026-10-23: OCR in the browser, free, private and offline. Rejected: sending the
photo to Claude (better on poor photos, but a paid key and the photo leaving the device).

## The flow

[`web/src/add/CipReader.tsx`](../../web/src/add/CipReader.tsx) sits at the top of the form's
fields. A photo (`capture="environment"`, a file picker on a desktop), then an optional box
dragged around the block, then "Read the photo" or "Read the box". The photo is decoded upright,
cut to the box and scaled to at most 2400 px on the long side
([`web/src/ocr/image.ts`](../../web/src/ocr/image.ts)); it is never stored or uploaded.

The fields the read found go into the form's empty fields only, or into ones still holding what
an earlier read put there ([`web/src/add/cip.ts`](../../web/src/add/cip.ts)); a field the owner typed is
never touched, and a hidden ISBN (from a scan) stays. Filled fields are tinted and ringed in the
accent with "From the CIP block: check it." until they are edited. Title only, no subtitle: the
form has no subtitle field. The text Tesseract read stays under a disclosure, editable, with
"Fill from this text" to read it again after a fix. With no "Descrierea CIP" heading the form
says so and opens the text to copy.

## Finding the description

[`web/src/ocr/block.ts`](../../web/src/ocr/block.ts) takes OCR text, which keeps the lines but not
the indents. After the heading (also as "C1P", or wrapped onto "a României"), it folds the
lines into the one-line form the monthly lists use, so the list parser reads it unchanged
(`readDescription`, moved to [`shared/src/cip.ts`](../../shared/src/cip.ts) for this):

- the main heading on its own line ("PALEOLOGU, THEODOR") gets the ". " the lists have;
- "Cluj-" at a line's end joins "Napoca"; other lines join with a space;
- it stops at the ISBN line, at a note ("Conţine bibliografie", "Tit. orig.", "6 vol.",
  "Vol. 1"), or once the text ends on the imprint's year, so a note's year never counts;
- " : trad." becomes " ; trad." (OCR reads the semicolon as a colon, which would glue the
  translator to the author), and specks at a line's end ("2026 |") are dropped.

The ISBN comes from the lines after the description: "1SBN", "ISBN:", O for 0 and l for 1
are mended, an ISBN broken over two lines is joined, and each catch is checked (`parseIsbn`,
trimmed to 13 or 10 characters when OCR left marks after it). One valid ISBN fills the field;
several (a set and its volumes) fill none and the form says to type the one on the back cover.

## Tesseract, from the app's own origin

Tesseract.js 7.0.0 in a worker, LSTM only, with the `ron` best_int data
(`@tesseract.js-data/ron` 1.0.0). Its defaults fetch everything from jsDelivr; here
`ocrAssets()` in [`web/vite.config.ts`](../../web/vite.config.ts) copies the files under the
base path and [`web/src/ocr/files.ts`](../../web/src/ocr/files.ts) passes their URLs:

| Path under the base | Size |
|---|---|
| `ocr/tesseract-<hash>/worker.min.js` | 111 KB |
| `ocr/tesseract-<hash>/tesseract-core-{relaxedsimd-lstm,simd-lstm,lstm}.{js,wasm}` | 89 KB + 2.86 MB each; a device loads one |
| `ocr/ron-<hash>/ron.traineddata.gz` | 1.69 MB |

The core's `.wasm` must sit beside the worker (Emscripten looks next to the worker script), so
the worker is a same-origin file (`workerBlobURL: false`), and the language path names a
directory, so the files keep their names; the `<hash>` of their contents is in the directory
instead. The core is picked with `wasm-feature-detect` as tesseract.js would. Tesseract's own
IndexedDB copy of the data is off (`cacheMethod: "none"`).

**Caching.** Not precached (`globIgnores: ["ocr/**"]`): about 4.8 MB that most visits never
need. [`sw.ts`](../../web/src/sw.ts) caches `ocr/` cache-first in `shelfmark-ocr` (four
entries: a new version's files push out the old). On the first press the page fetches the
missing files itself to show "Downloading the text reader: 1.2 of 4.8 MB", and the Tesseract
worker's own requests are then answered from that cache. Without a controlling service worker
(dev, a first visit) Tesseract fetches them itself and the count is a plain "Downloading
(4.8 MB)…". The form's hint gives the size until the files are cached.

**Thresholds.** `thresholding_method: "2"` (Sauvola). With Tesseract's default (Otsu, one
threshold for the page) the right-hand words under a shadow were lost on every test photo;
Sauvola read them all.

## Fixtures and checks

[`web/src/ocr/fixtures/`](../../web/src/ocr/fixtures/record.ts): five blocks with real
descriptions from the CIP lists, rendered and degraded to look photographed (tilt,
perspective, blur, noise, a shadow, heavy JPEG), and what Tesseract read from each
(`record.ts` writes the `.txt` with the app's settings). All five give the right title,
authors, publisher, year and ISBN. They are renders, not camera photos; real photos are owed.
Checked on 2026-10-23 in headless Chrome on a desktop: a first read took 0.6 s, start included, the worker's requests went
through the service worker into `shelfmark-ocr`, and with the server stopped a second read
still worked. Not yet walked on a phone.

If a Content-Security-Policy is ever added, the worker needs `'wasm-unsafe-eval'` and
`worker-src 'self'`.
