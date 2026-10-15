# Task 09: Add a book page

## Context

The second of the two places. Read [design.md](../../wiki/design.md) ("Add a
book": the three modes and the three scan outcomes; mock-up `Covers-Add`, with
the other outcomes drawn on `Calm-Add` and `Grid-Add`, to be redrawn in the
Covers world), [scanning.md](../../wiki/scanning.md) (continuous mode, USB
scanners) and [metadata-lookup.md](../../wiki/metadata-lookup.md) (a lookup is
a draft; nothing is saved without the owner). Load `impeccable` and build
inside the world.

Depends on briefs 04, 05 and 07.

## Files you OWN

```
web/src/add/AddBookPage.tsx   (replaces brief 04's stub)
web/src/add/ModeSwitch.tsx  web/src/add/IsbnField.tsx
web/src/add/ResultSheet.tsx  web/src/add/ManualForm.tsx
web/src/add/ShelfPicker.tsx  web/src/add/StatusPicker.tsx
web/src/add/CoverCapture.tsx  web/src/add/resize.ts
web/src/add/flow.ts  web/src/add/flow.test.ts
web/src/add/api.ts
```

## Files you must NOT touch

`web/src/scanner/*` (use `CameraScanner`), the shell, the server.

## What to do

1. **One screen, three modes** (`ModeSwitch`): Scan, Type ISBN, By hand. The
   page never navigates while the camera runs; modes, results and saving are
   React state (`flow.ts` holds the state machine, unit-tested).
2. **Scan.** `CameraScanner` fills the area above the tab bar; a code of kind
   `isbn` calls `POST /api/lookup`; kind `other` shows "This barcode isn't an
   ISBN" with "Type the ISBN" and "Add by hand". While a result sheet is open
   the scanner is paused; after a save it is live again with no extra tap.
3. **Type ISBN** (`IsbnField`): one large field, `inputmode="numeric"`,
   accepting ISBN-10 or 13 with hyphens; it validates with `parseIsbn` and says
   what is wrong ("Check digit doesn't match"). Enter submits, so a USB or
   Bluetooth scanner (digits then Enter) works on a laptop; focus returns to
   the field after every save.
4. **Result sheet** (`ResultSheet`), the floating white sheet, in three states:
   - **Found:** cover, title, author, publisher · year · pages, the source
     ("Found in Open Library"); `ShelfPicker` (chips of the shelves already in
     use, most recent first, plus "New shelf"); `StatusPicker` (Unread,
     Reading, Read; default Unread); primary "Save and scan the next one".
   - **Not found:** "No match for <isbn> in Open Library or Google Books",
     then `ManualForm` with the ISBN filled in.
   - **Already owned:** "Already in your library", shelf and date added;
     primary "Scan the next one", then "Add another copy" and "Open the book".
   "Not this book" / "Discard this scan" sits apart from the primary action.
5. **By hand** (`ManualForm`): title (required), author, publisher, year,
   shelf, status; ISBN optional and validated if given. The same form serves
   "Edit details" from a found draft.
6. **Covers on save.** If the draft has a cover candidate, save the book, then
   `POST /api/books/:id/cover/fetch`. If there is none, offer "Take a photo of
   the front" (`CoverCapture`: a file input with `capture="environment"`; the
   image is resized in a canvas to at most 900 px on the long side, JPEG,
   before `PUT`). A failed cover never undoes a saved book.
7. **Session counter** ("3 added this session") in the top area of Scan mode.
8. Saving goes through the books client (`createBook`) so the library is
   current without a refetch.

## Acceptance

- `flow.ts` tests: every transition (scan → found → save → scanning; not found
  → manual → save; already owned → another copy; other barcode; discard).
- Manual over `npm run dev:https` on a phone: scan a found English book, a
  Romanian book that is not found (enter it by hand with a cover photo), and a
  book already saved; type an ISBN on the laptop; record in the outcome note.
- impeccable's detector run on `web/src/add`; `npm run typecheck && npm run
  lint && npm test` pass.

## Outcome

_2026-10-15_. Built, unit-tested (67 tests, 39 of them on `flow.ts`) and
passed by impeccable's finish reviewer on its second round; the phone run is
the owner's. Checked in headless Chrome at 1440 and 390 px, including the
scan path with a fake camera playing generated EAN-13s: found and saved
with its cover fetched, already owned (and another copy, which copies the
stored cover), not found then saved by hand with a photo resized to
675×900, a store sticker, a lookup failure and a save failure. The build now
carries the scanner's `.wasm`. Departures: Scan is the default on a phone,
Type ISBN on a desktop; the phone page uses `bleed` in all three modes, so
the mode switch never moves and there is no visible title; "Found in Open
Library" sits under the meta line rather than above the title (the reviewer
read it as a kicker); a typed shelf normalises `-`, `/`, `|` to ` · ` and takes
the library's spelling of an existing shelf; six recent shelves show as chips,
the rest are suggested as you type; the not-found message says Google Books
wasn't searched when it was skipped for want of a key. A non-ISBN barcode is
kept as `barcode` only through "Add by hand". Known gap: `copyCover` uses a
plain `fetch`, so after brief 06 a 401 there reads as "cover didn't download".

**Owner checks** (`npm run dev:https` on a phone): scan a found English book
and save (the scanner is live again with no tap, "1 added this session");
scan a Romanian book that isn't found, type the title, take a cover photo and
return (the scanner comes back without a new permission prompt), save, and
see the cover in the Library without a reload; scan a saved book ("Already in
your library", "Open the book" opens it); scan a price sticker ("This barcode
isn't an ISBN"); switch Scan → Type ISBN → Scan without a new prompt; the
torch where the phone has one; on a laptop, a USB scanner's digits+Enter look
the book up and a repeat of the same ISBN does nothing.
