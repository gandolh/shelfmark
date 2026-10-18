# Task 19: Scan on a press

## Context

On 2026-10-17, after briefs 17 and 18, the owner asked for the scanner to stop
reading by itself: a button, and the read and the lookup only when it is
pressed. The camera has read continuously since brief 07 (scanning.md's
continuous mode). This brief replaces that model, so it is a decision
(decisions.md).

Kept from briefs 17 and 18:
- A code counts once two reads agree.
- The Add page's memo of the answers it has had.
- One lookup per ISBN at a time on the server.

Undone, because nothing reads between presses any more, so nothing can
replace a result:
- The loose sheet, the watching pace, and the quiet window while a code
  stays in view (brief 17).
- The 600 ms settle before a camera lookup (brief 18).

## Files you OWN

```
web/src/scanner/confirm.ts  web/src/scanner/confirm.test.ts   (was debounce.ts)
web/src/scanner/detector.ts  web/src/scanner/detector.test.ts
web/src/scanner/CameraScanner.tsx  web/src/scanner/CameraScanner.css  web/src/scanner/ScannerDemo.tsx
web/src/add/flow.ts  web/src/add/flow.test.ts
web/src/add/AddBookPage.tsx  web/src/add/ResultSheet.tsx  web/src/add/add.css
docs/architecture.md  docs/owner-setup.md
corpus/wiki/scanning.md  corpus/wiki/features.md  corpus/wiki/glossary.md  corpus/wiki/decisions.md
```

## What to do

1. **The camera shows, and reads nothing until it is asked.** Scan mode keeps
   the live picture and the viewfinder, so the owner can aim. At the bottom of
   the stage, where the sheet sits, is a large accent pill: *Scan the
   barcode*. It shows only while no result is open and the camera runs.
2. **A press reads every 150 ms until two reads agree, for at most 3 s.**
   - An ISBN ends the reading. It beeps and flashes, and its lookup goes out
     at once (or its answer comes from the memo).
   - A barcode that isn't an ISBN, agreed first, waits two more reads for
     an ISBN beside it, then counts.
   - Nothing in 3 s: a line over the camera says so, and nothing is sent.
   - While reading, the button says *Reading the barcode…*, and another
     press does nothing.
   - Hiding the page, switching mode, or leaving the page stops a reading,
     with no message.
3. **A result is the owner's until they act on it.** Its own buttons (*Save
   and scan the next one*, *Not this book*, *Discard this scan*, *Scan the
   next one*) bring the button back. A misread is corrected with *Not this
   book* and another press.
4. **Remove what no longer applies:**
   - the repeat guard's quiet window;
   - `PACE`, `watching`, the `fired` pace;
   - `FlowState.loose`, `hold`, `settled`, `settling`, `SETTLE_MS`;
   - `ResultSheet`'s `onTouch`;
   - the glossary's *Loose sheet*.

   `debounce.ts` becomes `confirm.ts`, which only tracks agreement.
   `ScannerDemo` gets a *Read* button.

## Acceptance

- Unit tests:
  - Agreement within 700 ms.
  - A reading: an ISBN ends it, a sticker waits two reads for an ISBN,
    nothing ends it at 3 s, and a cancel stops it.
  - The flow: a scan only from the empty camera, with the memo's answer
    when it has one.
- Manual, in headless Chrome with a fake camera:
  - No reads before a press.
  - A press reads and looks up once.
  - No reads while the result is open.
  - A press over a blank picture says nothing was read after 3 s.
- `npm run typecheck && npm run lint && npm test` pass.

## Outcome

_2026-10-18_. Built inline, 624 tests (fewer than brief 18's 639: the
loose-sheet, pace and settle tests went with their code).

- **What replaced what.**
  - `confirm.ts` (was `debounce.ts`): only agreement within 700 ms.
  - `detector.ts`: `readCode` (one press's reading, with a cancel) on top of
    `startDetectLoop`, which takes a fixed `intervalMs` again.
  - `CameraScanner`: a `ref` handle with `read()`; `onCode` and `watching`
    are gone; `paused` dims the frame and refuses to read.
  - `AddBookPage`: the button, the "No barcode read" line, and focus on the
    button when a result's buttons bring it back.
  - `Button`: now takes a `ref`.
  - Kept: the memo, and one lookup per ISBN on the server.
- **Checked** in headless Chrome 149 (ZXing engine), with a fake camera
  showing a blank picture for 8 s and then a book barcode, the lookups
  answered in the browser:
  - No reads in 1.5 s with the camera running.
  - A press over the blank: 20 reads, then "No barcode read" at 3 s, and
    no lookup.
  - A press over the book: 2 reads, the result in 227 ms, one lookup.
  - With the result open: no reads in 3 s.
  - *Not this book*, then a press: 2 reads, and the answer from the memo
    with no second lookup.
- **Departures:**
  - The sticker's wait is 450 ms, not 300. A 300 ms wait ended at the
    same instant as the ISBN's agreeing read, so with real decode time the
    sticker would always win. The brief now says "two more reads".
  - DESIGN.md's camera stage and Large button gained the button.

**Owner check** (phone, Add a book, Scan):
- Nothing beeps until you tap *Scan the barcode*.
- A tap over a book reads it in well under a second.
- A tap over no barcode says so after 3 s.
- With a result open the button is gone; *Not this book* brings it back.
