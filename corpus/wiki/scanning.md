---
summary: How the app reads a book's barcode. Browser support for BarcodeDetector (Chrome only by default), the barcode-detector polyfill on ZXing-C++ WASM and why its .wasm is self-hosted, the HTTPS rule, the iOS standalone-PWA camera bug that forces a single-screen scanner, scanning on a press (two agreeing reads, up to 3 s, the button only while no result is open), ISBN-10/13 validation, non-ISBN barcodes, and USB keyboard-wedge scanners.
updated: 2026-10-18
---

# Scanning

## Engine

The Barcode Detection API (`BarcodeDetector`) is the native way, but as of
2026-10-14 it is **off by default in Safari** (macOS and iOS, 17 through 26)
and **absent in Firefox**. Chrome for Android has it.

Recommended: the `barcode-detector` package (3.2.2, ZXing-C++ compiled to
WebAssembly via `zxing-wasm`). Import the **ponyfill** (`barcode-detector/ponyfill`)
so the same code path runs on every browser, or prefer the native class when
present. Formats to enable: `ean_13`, `ean_8`, `upc_a`, `upc_e`, `code_128`.
By default it fetches its `.wasm` from jsDelivr; **self-host it** with
`prepareZXingModule({ overrides: { locateFile } })` and precache it in the
service worker, so scanning works offline and loads nothing from a third party.

Rejected: `html5-qrcode` (last release 2023), `quagga2` (1D only, weaker on
blurry phone images), `@zxing/browser` (the older JS port; the C++ WASM build
reads better).

## Camera rules

- **HTTPS only.** `getUserMedia` needs a secure context. On a phone that means
  the deployed site or a dev server with a local certificate; `localhost`
  counts only on the laptop itself.
- **One screen, no navigation while the camera runs.** In an iOS home-screen
  PWA, a route change can stop the capture tracks and re-prompt for camera
  permission (WebKit bugs 215884, 212040; Apple forum thread from June 2025, no
  fix recorded). So the scanner is one view that switches between "scanning",
  "confirm book" and "saved" states in React state. It never navigates while
  the stream is live.
- Ask for the rear camera (`facingMode: "environment"`), turn on the torch when
  the track supports it, and stop the stream when the view is hidden.

## Scanning on a press

Since brief 19 (2026-10-18), the camera reads only when the owner taps *Scan
the barcode* (decisions.md, "The camera reads only on a press"). The picture
runs so the owner can aim, but nothing is decoded and nothing is looked up
between presses. A beep or vibration and the frame's flash mark a read. A
scanned ISBN already in the library shows "Already in your library" with
"Add another copy" and "Open the book".

- **A press reads every 150 ms until two reads agree, for at most 3 s**
  ([detector.ts](../../web/src/scanner/detector.ts) `readCode`).
  - Why two reads: the check digit misses two wrong digits that cancel out,
    and a swap of neighbouring digits that differ by 5 (`…5583` read as
    `…5538` passes). One bad frame almost never matches the next. The second
    read must come within 700 ms of the first
    ([confirm.ts](../../web/src/scanner/confirm.ts)).
  - An ISBN ends the reading, usually two reads (about 0.2 s) after the
    press.
  - A barcode that isn't an ISBN, agreed first, waits two more reads
    (450 ms, decode time included) for an ISBN beside it.
  - Nothing in 3 s: "No barcode read", and no lookup.
- **The button shows only while no result is open.** A result is the
  owner's until they act on it, and its own buttons bring the camera back. A
  misread is corrected with *Not this book* and another press.
- **What a press costs.** Between presses the scanner decodes nothing. A
  book seen again this visit shows its answer with no request (`memo.ts`).
  The server runs one lookup per ISBN at a time, with every answer cached
  ([metadata-lookup.md](metadata-lookup.md)).
- **History.** Briefs 07 to 18 read continuously, at first every 150 ms.
  Brief 17 then added two agreeing reads, plus a result that the next book in
  view replaced until the owner touched it. Brief 18 added a 600 ms wait
  before a camera lookup. The owner then chose the press: no read or call
  happens without one. Of those briefs, two agreeing reads, the memo, and one
  lookup per ISBN remain.

## What a code means

- **ISBN-13**: EAN-13 starting `978` or `979`. Validate the check digit.
- **ISBN-10**: typed by hand on older books; check digit can be `X`. Convert
  to ISBN-13 for storage. `979` ISBNs have no ISBN-10 form.
- **Add-on bars**: a small 5-digit (price) or 2-digit barcode to the right of
  the ISBN. Ignore it; never store it as the ISBN.
- **Other barcodes**: a store sticker (EAN starting `2`) or a US mass-market
  UPC. Save the raw code in a `barcode` field, try a lookup, fall back to
  manual entry. The real ISBN is usually printed inside the book.
- Strip hyphens and spaces from typed input. `isbn3` (npm) can format ISBNs
  with hyphens for display; validation is small enough to write ourselves in
  `shared`.

## USB and Bluetooth scanners

They act as keyboards: digits then Enter. The "Add by ISBN" field accepts them
as-is, so a laptop with a scanner is the fastest way to catalog a whole shelf.
No special code beyond keeping that field focused after each save.
