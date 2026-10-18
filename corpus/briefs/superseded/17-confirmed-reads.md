_Superseded 2026-10-18: briefs 19 (scan on a press) and 20 (the first read wins) undid all of it._

# Task 17: Confirmed reads and live rescans

## Context

On 2026-10-17 the owner reported that the camera sometimes reads the wrong
digits. The scanner fires on the first frame that decodes to a valid ISBN,
and the check digit is its only filter. The check digit misses two wrong
digits that cancel out, and a swap of neighbouring digits that differ by 5,
so a blurry or angled frame can now and then pass. Once the sheet opened, the
camera paused, so the only way out was "Not this book" and a second scan.

The owner asked for the camera to keep reading, so that repositioning the book
corrects the result. They also asked for a slow pace that doesn't feel laggy
(they suggested about every 2 s). Read the continuous-mode part of
[scanning.md](../../wiki/scanning.md). Brief 07 built the scanner and brief 09
the page; their done notes describe the code this changes.

## Files you OWN

```
web/src/scanner/debounce.ts  web/src/scanner/debounce.test.ts
web/src/scanner/detector.ts  web/src/scanner/detector.test.ts
web/src/scanner/CameraScanner.tsx  web/src/scanner/ScannerDemo.tsx
web/src/add/flow.ts  web/src/add/flow.test.ts
web/src/add/AddBookPage.tsx  web/src/add/ResultSheet.tsx
corpus/wiki/scanning.md  corpus/wiki/features.md
```

## What to do

1. **Two reads must agree.** A code fires only when a second read, within
   700 ms of the first, decodes the same value. Two copies of a code in one
   frame are one read. One bad frame almost never matches the next.
2. **A code fires when it comes into view, not while it stays there.** After
   a code fires, every later sighting keeps it quiet. It fires again only after
   it has been out of view for 3 s. This replaces brief 07's window, which
   counted from the fire, so a book held still kept refiring every 3 s. When
   the scanner resumes, every fired code's window starts over, as before.
3. **The camera keeps reading while a result is open, until the owner
   touches the sheet.** A sheet the camera opened (looking up, found,
   already owned, not found, untitled, a non-ISBN barcode, a failed lookup)
   stays *loose*. While it is loose, a different ISBN in view replaces it
   with a new lookup. The first pointer-down, key-down or input inside the
   sheet holds it. A held sheet, or one the owner opened (Edit details,
   Another copy, Type the ISBN, By hand, Try again), pauses the camera as
   before.
   - The same ISBN the sheet is about changes nothing. A failed lookup is
     the exception: like Enter in the ISBN field, it tries again.
   - A barcode that isn't an ISBN never replaces a sheet; it only opens one
     from the empty camera.
   - A code that changes nothing makes no beep or flash: `onCode` returns
     `false` for it.
4. **Pace.** Read every 250 ms while the sheet is empty (looking for a
   book), and once a second while a loose sheet is open (watching for a
   different one). After any read that sees a code still waiting for its
   second read, read again 150 ms later. That gives a first result in about
   0.3-0.5 s and a corrected one about 1-1.3 s after the book moves.
   - At the owner's 2 s, a correction could take 2.3 s, which would feel
     slow. Going from 2 s to 1 s costs one extra read a second, and only
     while a result is open.
   - Overall the scanner reads less than before: 4 reads a second instead
     of about 7 while looking, and the camera still stops when the page is
     hidden.

## Acceptance

- Unit tests:
  - Agreement: one read doesn't fire, a second within 700 ms does, and one
    after 700 ms starts over.
  - The quiet window: refreshed by every sighting, a code back after 3 s
    away fires, and resuming restarts the window.
  - The pace: each delay, and the quick second look.
  - The flow: a loose sheet replaced, a held one kept, the same ISBN
    ignored, the failed retry, a non-ISBN barcode never replaces a sheet,
    and a save or an owner action holds the sheet.
- Manual, recorded in the outcome note: in headless Chrome with a fake
  camera, a code fires after two reads, and a second code replaces an
  untouched sheet but not a touched one. The phone check is the owner's.
- `npm run typecheck && npm run lint && npm test` pass.

## Outcome

_2026-10-17_. Built inline, 629 tests (19 new).

- **What replaced what.** `debounce.ts`'s repeat guard became `createSightings`,
  which tracks agreement and the quiet window per code. `detector.ts` has
  `PACE` and `readInterval`; `startDetectLoop` asks for the next interval
  after each read. `CameraScanner` takes `watching`, and an `onCode` that
  returns `false` skips the beep and flash. `FlowState.loose` and a `hold`
  event in `flow.ts`, `scannerWatching`, and `ResultSheet`'s `onTouch`
  (capture-phase pointer-down, key-down, input) carry the loose sheet.
  `AddBookPage` asks the reducer whether a code changes anything before it
  dispatches it. That is how a code that changes nothing makes no beep.
- **Checked** in headless Chrome 149 (ZXing engine) with a fake camera
  showing three EAN-13s for 8 s each, the lookups answered in the browser:
  - The first book fired on its second read, 150 ms after the first.
  - With the sheet open, reads came every 1,000 ms. The book in view caused
    no extra reads.
  - The second barcode was confirmed 145 ms after it appeared and replaced
    the untouched sheet.
  - After a tap on the sheet, the scanner paused. There were no reads for
    20 s, and the sheet stayed while the video moved on.
  - After a code fires, one read still comes at the 250 ms pace before the
    1 s pace starts, because the sheet opens on the next render.
- **Departures:**
  - `ScannerDemo` is unchanged, since the pace only matters on the Add page.
  - The glossary gained *Loose sheet*.

**Owner checks** (on a phone, Add a book, Scan):
- A book reads with one beep.
- Holding it still doesn't beep again.
- Sliding a second book in while the first's result is untouched replaces
  the result within about a second.
- After a tap on the result, another book changes nothing until Save or
  Discard.
- A sticker next to an open result changes nothing.
