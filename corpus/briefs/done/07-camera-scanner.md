# Task 07: Camera scanner component

## Context

A self-contained React component that turns the phone camera into a stream of
classified codes. Brief 09 puts it on the Add a book page; this brief only
builds and proves it. Read [scanning.md](../../wiki/scanning.md) in full: the
engine choice, the HTTPS rule, the iOS standalone bug that forbids navigating
while the camera runs, continuous mode, and what each kind of code means.

Depends on briefs 01 and 03. Runs alongside 04 and 05; keep styling minimal
(brief 09 places it in the design).

## Files you OWN

```
web/src/scanner/CameraScanner.tsx
web/src/scanner/detector.ts  web/src/scanner/detector.test.ts
web/src/scanner/camera.ts
web/src/scanner/feedback.ts
web/src/scanner/debounce.ts  web/src/scanner/debounce.test.ts
web/src/scanner/ScannerDemo.tsx           (dev only)
web/vite.config.ts                        (the step that copies the .wasm into the build)
web/package.json                          (barcode-detector)
web/src/router.ts                         (one dev-only route line: /dev/scanner)
```

## Files you must NOT touch

The Add a book page (brief 09), the shell, anything server-side.

## What to do

1. **Engine** (`detector.ts`): use the native `BarcodeDetector` when it exists
   and supports `ean_13`; otherwise the `barcode-detector` ponyfill
   (`barcode-detector/ponyfill`, current release, at least two weeks old,
   pinned). Formats: `ean_13`, `ean_8`, `upc_a`, `upc_e`, `code_128`.
2. **Self-host the WASM.** The ponyfill fetches its `.wasm` from jsDelivr by
   default. Copy the file from the installed `zxing-wasm` into the build output
   under the base path and point `prepareZXingModule({ overrides: { locateFile
   } })` at it. No request leaves our origin; brief 12 precaches it.
3. **Camera** (`camera.ts`): `getUserMedia` with `facingMode: "environment"`
   and a sensible resolution; torch on/off when the track supports it; stop
   every track on unmount and when the page is hidden (`visibilitychange`),
   and restart when shown.
4. **Loop.** Detect on video frames about every 150 ms (not every animation
   frame). Each raw value goes through `classifyBarcode` (brief 03): add-ons
   are dropped; `isbn` and `other` are emitted as
   `onCode({ kind, isbn13 | code })`.
5. **Continuous mode** (`debounce.ts`): the same code is ignored for 3 seconds
   after it fires; a different code fires at once. `feedback.ts` plays a short
   beep (Web Audio, created on the first user gesture) and vibrates when
   supported.
6. **States** the component renders and reports: asking for permission,
   scanning, permission denied, no camera, insecure context (http on a phone).
   Each non-scanning state offers `onFallback()` ("Type the ISBN instead").
7. **One screen.** The component never navigates and never changes the URL;
   it is mounted and unmounted by its parent. The viewfinder is a rounded
   frame over the video; props: `paused`, `torch`, `onCode`, `onFallback`.
8. `ScannerDemo` at `/dev/scanner`, registered only when
   `import.meta.env.DEV`, lists the codes it reads.

## Acceptance

- Unit tests: debounce timing, classification wiring, engine selection with a
  stubbed native detector.
- Manual, recorded in the outcome note: over `npm run dev:https`, the demo
  reads a book's ISBN on an Android phone (Chrome) and an iPhone (Safari), and
  the network panel shows the `.wasm` loaded from our own origin.
- `npm run typecheck && npm run lint && npm test` pass; production build
  contains no `/dev/scanner` route.

## Outcome

_2026-10-15_. Built and unit-tested (33 tests); the phone checks are the
owner's. `barcode-detector` 3.2.2 (2026-08-16) and its `zxing-wasm` 3.1.3,
now declared directly so the pinned `.wasm` can't drift. The `.wasm` is
self-hosted through a `?url` import in `scanner/detector.ts` instead of a copy
step in `vite.config.ts`: Vite serves it from our origin in dev and emits
`assets/zxing_reader-<hash>.wasm` under the base path in the build, once a
production page imports the scanner (brief 09). The config only pre-bundles
the ponyfill so opening the scanner never triggers a dev reload that would
restart the camera. Checked in headless Chrome with a fake camera: the states,
about 7 reads a second, add-ons dropped, the 3-second window, pause, the
track stopped when hidden and restarted when shown, and the `.wasm` fetched
from our origin only. Departures: a sixth state, `error` (camera held by
another app, or the reader failed to load), with "Try again"; optional props
`feedback`, `onStateChange`, `onTorchAvailable`, `className`; the 3-second
window counts from when a code fired. `armFeedback()` runs in `main.tsx` so
the tap that opens the scanner already unlocks the beep on iOS. `/dev/scanner`
is registered in the router's `DEV_ROUTES` and dropped from the build.

**Owner checks** (`npm run dev:https`, open
`https://<laptop LAN address>:5176/shelfmark/dev/scanner`, accept the
certificate): on Android Chrome (engine `native`) and iPhone Safari (engine
`zxing`), scan a 978 book and a Romanian one (each listed once, with a beep;
again only after 3 s), the 5-digit price add-on (ignored), a store sticker
(`other`); torch on Android; switch apps and back (camera light off, then the
camera restarts); refuse the camera once (both buttons shown); plain `http`
shows "The camera needs https". On the iPhone the demo's "Fetched" list
should show the `.wasm` from the LAN address with "Other origins: none".
