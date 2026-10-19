# Task 21: Read until the ISBN, and a sharper camera

## Context

On 2026-10-20 the owner reported that a press of *Scan the barcode* often
reads nothing. The first scanner (briefs 07 to 18), which read every 150 ms
with no end, read books well. They asked for a mix of the two: nothing is
read before the press, then the camera reads until it finds the ISBN and
stops there. They also find the picture low quality, and asked whether that
comes from Shelfmark or from the browser.

**Why a press misses.** Since brief 19, a press reads for at most 3 s
([detector.ts](../../../web/src/scanner/detector.ts) `READ_FOR_MS`). On a
real phone the tap uses up part of that window: the phone moves, the camera
refocuses, the owner brings the barcode back into the frame. The continuous
scanner had no deadline, so the owner moved the book until it read. Brief
19's browser check didn't show this, because a fake camera's picture is
sharp and still from the first frame.

**Why the picture looks soft.** Some of it is ours and some is the browser's.
The research is in [scanning.md](../../wiki/scanning.md), "Camera quality".

- Ours: [camera.ts](../../../web/src/scanner/camera.ts) asks for 1280×720
  and sets nothing about focus or zoom. In portrait, the 720 px side is
  stretched across the screen's width (`object-fit: cover`), about 1.6× on a
  1170 px-wide iPhone screen.
- The browser's: the stream is the camera's raw video, without the Camera
  app's processing. An iPhone picks its own lens and, near the book, switches
  to a cropped ultra-wide picture. Safari has no focus control. Chrome on
  Android offers focus, zoom and torch when the camera reports them.

Which side matters more on the owner's phone can't be known without that
phone's numbers, so this brief adds a readout first.

The decision "The camera reads only on a press" still holds: nothing is read
before a press. Its "for at most 3 s" changes. Update the entry and add a
log entry.

## Files you OWN

```
web/src/scanner/detector.ts  web/src/scanner/detector.test.ts
web/src/scanner/camera.ts  web/src/scanner/camera.test.ts
web/src/scanner/CameraScanner.tsx  web/src/scanner/CameraScanner.css  web/src/scanner/ScannerDemo.tsx
web/src/add/AddBookPage.tsx  web/src/add/add.css
DESIGN.md  docs/architecture.md  docs/owner-setup.md
corpus/wiki/scanning.md  corpus/wiki/features.md  corpus/wiki/decisions.md
```

## Files you must NOT touch

- `web/src/add/flow.ts` and `memo.ts`. A press still ends in one `scanned`
  action, and the memo still answers a book seen again.
- The server. A press still sends one lookup, after the ISBN is read.

## What to do

### Part 1: a press reads until it finds the ISBN

1. **No 3 s deadline.** A press reads every 150 ms until it reads an ISBN,
   then stops. The beep, the flash and the lookup (or the memo's answer)
   stay as they are.
2. **The button stops a reading.** While reading, the button says *Stop
   reading*, and a tap stops it with no message. Today it says *Reading the
   barcode…* and ignores taps. Hiding the page, switching mode and leaving
   the page still stop a reading with no message.
3. **A sticker waits 1 s for an ISBN.** A code that isn't an ISBN, read
   first, counts only if no ISBN is read within 1 s of it (450 ms today). The
   owner now holds the book in view while the camera works, so the ISBN next
   to a shop sticker needs time to come into focus. In one read, an ISBN still
   wins over a sticker.
4. **A phone put down stops after 60 s.** If nothing is read in 60 s, the
   reading stops, and the line over the camera says "Nothing read for a
   minute. Tap *Scan the barcode* to try again." Nothing is sent. The limit
   saves the battery, not the owner's time. A reading is local decoding, so
   no lookups happen meanwhile.
5. Remove the 3 s line ("No barcode read. Hold it inside the frame and try
   again.") and rename the constants to match: `READ_FOR_MS` becomes a 60 s
   `GIVE_UP_MS`, and `ISBN_GRACE_MS` becomes 1000. `ScannerDemo`'s "nothing
   read in 3 s" follows.

### Part 2: the camera readout

6. **`?camera` on the Add page shows the camera's numbers**, in small type in
   a corner of the stage that the switcher, torch and sheet leave free:
   - the engine (`native` or `zxing`) and the track's label;
   - what the browser granted (`track.getSettings()`): width × height, frame
     rate, zoom, focus mode;
   - what the camera can do (`track.getCapabilities()`): the largest width ×
     height, the zoom range, the focus modes, the torch;
   - while reading, the last decode's time in ms.

   No link leads to it; the owner types the address. It's in production
   because only the owner's phone can answer the question. An installed iOS
   app has no address bar, so the owner opens it in the browser.

### Part 3: a sharper camera

7. **Ask for 1920×1080** (`ideal`) instead of 1280×720. The browser gives
   what it can, and the readout shows what it gave. If the owner's phone then
   takes over 150 ms per decode, the fix is to decode only the viewfinder's
   crop. That goes in a later brief, not this one.
8. **Continuous focus when the camera offers it.** After the stream opens, if
   `getCapabilities().focusMode` includes `continuous`, apply it. Chrome on
   Android lists focus modes; Safari doesn't.
9. **A 1× / 2× zoom chip when the camera zooms.** If
   `getCapabilities().zoom` reaches 2, show a chip next to the torch, as in
   the phone's camera app. Start at 2×: the barcode then fills the viewfinder
   from about 20 cm, which is beyond the close-focus limit of most main
   lenses. On Android, zoom crops the sensor before it scales down to the
   stream size, so 2× adds real detail. The choice lasts for the visit, like
   the torch. If the camera doesn't zoom, there is no chip.
10. **Keep `facingMode: "environment"`, with no lens picker.** Android names
    its lenses `camera2 0, facing back` and so on, so choosing one by label
    is guesswork. iOS opens a camera that switches lenses by itself. Note
    this in scanning.md, so nobody adds a picker without numbers.

## Acceptance

- Unit tests:
  - `readCode`: an ISBN read at 5 s ends a reading; a stop; the 60 s limit;
    a sticker counts after 1 s with no ISBN; an ISBN read within 1 s of a
    sticker wins.
  - `camera.ts`: the constraints ask for 1920×1080; focus and zoom are set
    only when the capabilities list them; the chip's rule (zoom reaches 2).
- Manual, in headless Chrome with a fake camera (brief 19's setup: a blank
  picture for 8 s, then a book's barcode):
  - A press over the blank reads past 3 s, reads the book at about 8 s, and
    sends one lookup.
  - *Stop reading* stops: no reads after it.
  - `?camera` shows the readout; without it there is none.
- `npm run typecheck && npm run lint && npm test` pass.

**Owner check** (phone, after a deploy):
- Tap *Scan the barcode*, then bring a book in. It reads once the barcode is
  sharp, with no "nothing read" message in between, and stops there.
- In the browser (not the installed app), open the Add page with `?camera`
  at the end of the address. Send the readout's numbers: resolution, zoom
  range, focus modes, decode time. They show whether the soft picture is the
  stream's size or the lens.
