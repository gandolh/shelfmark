---
summary: How the app reads a book's barcode. Browser support for BarcodeDetector (Chrome only by default), the barcode-detector polyfill on ZXing-C++ WASM and why its .wasm is self-hosted, the HTTPS rule, the iOS standalone-PWA camera bug that forces a single-screen scanner, why the picture looks soft (the stream's size, iPhone's lens switching, what Chrome on Android lets a page set) and what we ask for since brief 21 (1080p, continuous focus, a 1×/2× zoom chip, no lens picker), the `?camera` readout, scanning on a press (read until a code is read, *Stop reading*, a minute's limit, a sticker's 1 s wait, the button only while no result is open), ISBN-10/13 validation, non-ISBN barcodes, and USB keyboard-wedge scanners.
updated: 2026-10-23
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
Reading the CIP block from a photo is OCR, not a barcode: [cip-photo.md](cip-photo.md).

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

## Camera quality

Researched on 2026-10-20, after the owner found the picture soft. Brief 21
acted on it on 2026-10-21.

- **What we asked for until brief 21.** 1280×720 and nothing about focus or
  zoom. In portrait, the 720 px side is stretched across the screen's width,
  about 1.6× on a 1170 px-wide iPhone screen. 720p is the usual default for
  barcode readers: STRICH's docs call it enough for good-quality codes and
  suggest more only for small or worn ones, because each extra pixel costs
  decode time.
- **The stream is not the Camera app.** `getUserMedia` gives the camera's raw
  video, with none of the app's HDR, night mode or photo processing. A picture
  worse than the Camera app's is normal.
- **iPhone.** Since iOS 16.4, `facingMode: "environment"` opens a multi-lens
  virtual camera ahead of the plain wide lens: Back Triple Camera, then Back
  Dual Wide ([WebKit 253186](https://bugs.webkit.org/show_bug.cgi?id=253186)).
  Since iOS 17 that camera switches by itself to the ultra-wide lens near a
  close object, cropped to keep the framing
  ([WebKit 262416](https://bugs.webkit.org/show_bug.cgi?id=262416), still
  open). That switch is how a Pro iPhone focuses up close, since its main lens
  can't focus nearer than about 15 cm
  ([WebKit 247737](https://bugs.webkit.org/show_bug.cgi?id=247737)). But the
  cropped ultra-wide picture holds less detail. Safari has no focus control.
  WebKit added the `zoom` capability in March 2023
  ([WebKit 253646](https://bugs.webkit.org/show_bug.cgi?id=253646)); whether
  an iPhone lists it shows in `getCapabilities()`.
- **Chrome on Android.** `getCapabilities()` lists focus modes, focus
  distance, zoom and torch when the camera supports them. `enumerateDevices`
  lists each back lens, but with labels like `camera2 0, facing back`, so a
  lens can't be chosen by name. `facingMode` usually opens the main lens.
- **What helps.** More pixels on the barcode: a larger stream, or zoom, so
  the book can sit beyond the main lens's close-focus limit. On Android, zoom
  crops the sensor before scaling to the stream size, so 2× adds real detail.
  A lens picker doesn't help: the labels say nothing, and an iPhone switches
  lenses itself.
- **What we ask for since brief 21**
  ([camera.ts](../../web/src/scanner/camera.ts)):
  - 1920×1080 as `ideal`, so the browser gives what it can.
  - Continuous focus, when `getCapabilities().focusMode` lists it.
  - A 1× / 2× zoom chip when `getCapabilities().zoom` reaches 2. It starts
    at 2× and lasts for the visit, like the torch.

  The torch, the zoom and the focus go in one `applyConstraints` set
  (`tuneCamera`), each only when the camera lists it. That way no setting
  depends on an earlier call having kept another. If a phone then takes over
  150 ms per decode, the fix is to decode only the viewfinder's crop, in a
  later brief.
- **No lens picker.** We keep `facingMode: "environment"`. Android names its
  lenses `camera2 0, facing back` and so on, so choosing one by label is
  guesswork, and an iPhone switches lenses by itself. Don't add a picker
  without the owner's readout numbers showing it would help.
- **The readout.** `?camera` at the end of the Add page's address shows, top
  left over the camera, the engine and the track's label, what the browser
  granted (`getSettings()`), what the camera can do (`getCapabilities()`),
  and the last decode's time. It ships to production, unlinked, because
  only the owner's phone can answer the question. An installed iOS app has
  no address bar, so the owner opens it in the browser.
- **Not known yet:** which of these applies to the owner's phone, until the
  owner sends the readout's numbers.

## Scanning on a press

Since brief 19 (2026-10-18), the camera reads only when the owner taps *Scan
the barcode* (decisions.md, "The camera reads only on a press"). The picture
runs so the owner can aim, but nothing is decoded and nothing is looked up
between presses. A beep or vibration and the frame's flash mark a read. A
scanned ISBN already in the library shows "Already in your library" with
"Add another copy" and "Open the book".

- **A press reads every 150 ms until it reads a code**
  ([detector.ts](../../web/src/scanner/detector.ts) `readCode`). Since
  brief 21 (2026-10-21) there is no deadline. On a real phone the tap moves
  the camera and it refocuses, so brief 19's 3 s window often ran out before
  the barcode was sharp.
  - The first ISBN read ends it. The owner sees the ISBN and presses again
    if it looks wrong (brief 20). Brief 17 required two agreeing reads
    because the check digit misses some misreads (two wrong digits that
    cancel out, neighbouring digits that differ by 5 swapped). That mattered
    while the camera read by itself.
  - In one read, an ISBN wins over a sticker. A sticker read first counts
    only if no ISBN is read within 1 s (`ISBN_GRACE_MS`; 450 ms before
    brief 21). The owner holds the book in view while the camera focuses,
    so the ISBN beside a shop sticker needs time to come into focus.
  - While it reads, the button says *Stop reading*, and a tap stops it with
    no message. Hiding the page, switching mode and leaving the page stop it
    the same way.
  - Nothing read in 60 s (`GIVE_UP_MS`): the reading stops with "Nothing
    read for a minute", and nothing is sent. The limit is for a phone put
    down with the camera on. It saves the battery, not the owner's time.
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
  happens without one. Of those briefs, the memo and one lookup per ISBN remain; brief 20
  dropped the two agreeing reads.

## Offline

The app shell and the scanner work offline, but the answer to a scan is the server's
(`POST /api/lookup`), and the service worker keeps every API call network-only. So the page
keeps its own copy of the library in IndexedDB ([`web/src/offline/`](../../web/src/offline/library.ts)):
`{ isbn13, title, shelf, collection }` per book with an ISBN, one record rewritten whole
(with `savedAt`) each time the book list loads or changes, and cleared on sign out.

When a lookup fails with a `network` error (no answer at all; a 4xx or 5xx is the server
answering and stays a failure), `AddBookPage` reads the copy and the flow enters the
`offline` step: "Already on Living room · A2", "On your wishlist" or "Not in your library",
with "This is the offline answer ... as of <date>". It offers no save, only the next scan
and "Try again online". With no copy (a device that never loaded the library, or after sign
out) the step is the ordinary failed one, saying the offline check needs one visit online
first. Only books with an ISBN are in the copy, and a book added on another device appears
once this one loads the library again.

### The scan queue

On the offline answer for a book not in the copy (and on the no-copy failed step), "Look it
up later" keeps `{ isbn13, scannedAt, shelf }` in a second IndexedDB store (`queue`, database
version 2; [`web/src/offline/queue.ts`](../../web/src/offline/queue.ts)). A second scan of a
queued ISBN says it is already waiting. Add a book shows "Waiting to look up (N)", which opens
the list. When the browser is online (app start and the `online` event, via
[`queueStore.ts`](../../web/src/offline/queueStore.ts)) the scans are looked up one after
another through the ordinary `POST /api/lookup`, so the server's per-source queues keep the
pacing; there is no batch call and no background sync. An answer waits in the list, in memory
only, until the owner opens it: it becomes the usual found / owned / wishlisted sheet on the
shelf it was queued with, and nothing is saved without a confirm. Nothing found, or a lookup
the server refused, opens the by-hand form with the ISBN filled. Opening a scan keeps it
queued: it leaves the queue only when its book is saved or the owner discards it (the
sheet's discard or "Remove" in the list), so abandoning the sheet any other way loses
nothing. Sign out clears it.

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
