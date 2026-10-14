---
summary: How the app reads a book's barcode. Browser support for BarcodeDetector (Chrome only by default), the barcode-detector polyfill on ZXing-C++ WASM and why its .wasm is self-hosted, the HTTPS rule, the iOS standalone-PWA camera bug that forces a single-screen scanner, ISBN-10/13 validation, non-ISBN barcodes, and USB keyboard-wedge scanners.
updated: 2026-10-14
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

## Continuous mode

Scan, beep or vibrate, show the result card, keep the camera on. The same code
is ignored for ~3 seconds so one book does not register five times. A scanned
ISBN already in the library shows "Already on <shelf>" with "add another
copy" and "skip".

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
