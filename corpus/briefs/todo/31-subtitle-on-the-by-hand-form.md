# Task 31: A subtitle field on the by-hand form

## Context

Promoted 2026-10-23 from the todo
[subtitle-on-the-by-hand-form](../../todos/subtitle-on-the-by-hand-form.md). The owner
chose on 2026-10-23 an optional **Subtitle** field under Title, filled by "Read the CIP
block" and marked like the other fields, because OCR misreads diacritics and a subtitle
should be editable before the save. Rejected: saving the block's subtitle unseen, and
leaving it to Edit on the book's page.

Facts (checked 2026-10-23):

- `cip.readDescription` in [`shared/src/cip.ts`](../../../shared/src/cip.ts) already
  returns `subtitle` (the text after " : " in the title part). `readCipBlock` in
  [`web/src/ocr/block.ts`](../../../web/src/ocr/block.ts) drops it: `CipFields` has no
  `subtitle`.
- The form's fields are `FormValues` / `FormFields` / `FormField` in
  [`web/src/add/form.ts`](../../../web/src/add/form.ts): title, author, publisher, year,
  ISBN, then shelf and status. `bookSchema` already has `subtitle` (`shared/src/book.ts`),
  and the Edit form on the book's page already edits it.
- **The form is not only for by-hand books.** "Edit details" on a found book and the
  not-found, untitled, barcode, failed and copy reasons open the same form
  (`FormInitial`, `initialFromDetails` in [`web/src/add/flow.ts`](../../../web/src/add/flow.ts)).
  A lookup draft's subtitle is today kept in `FormBase.details` by `hiddenDetails` and
  saved unseen. Once the field exists, the subtitle must move from hidden to shown: filled
  into the field, stripped by `hiddenDetails`, saved from the field. Otherwise an edit to
  it is overwritten by the hidden copy, or the hidden copy wins over a cleared field.

## Files you OWN

- `web/src/add/form.ts`, `form.test.ts`: the field in `FormValues`, `FormFields`,
  `EMPTY_FORM`, `readForm` (trimmed, empty is `null`, same length rule as the title)
- `web/src/add/ManualForm.tsx`, `add.css`: the field, under Title, marked "optional"
- `web/src/add/cip.ts`, `cip.test.ts`: the reader fills it under the same rule as the
  others (only when empty or still holding an earlier read's value) and marks it
- `web/src/ocr/block.ts`, `block.test.ts`: `subtitle` in `CipFields`
- `web/src/add/flow.ts`, `flow.test.ts`: `initialFromDetails`, `hiddenDetails`,
  `bodyFromForm`

## Files you must NOT touch

- `server/**`, `shared/**`: the schema and the parser already carry the subtitle.
- `web/src/book/EditForm.tsx`: it has its own subtitle field.

## What to do

1. Add the field, between Title and Author, optional, one line.
2. Have the CIP reader fill it, ring it and say "From the CIP block: check it." like
   the others. A block with no subtitle leaves the field as it is.
3. Fill it from a lookup draft when the form opens on one ("Edit details" and the other
   reasons), and move `subtitle` from the hidden details to the field.
4. Update `corpus/wiki/cip-photo.md` (it says the subtitle is dropped) and the add flow
   page if it lists the form's fields.

## Acceptance

- Fixture `2-popa.jpg` fills Subtitle with "exerciţii de memorie culturală" (or its
  comma-below form), marked, and the saved book has it.
- "Edit details" on a found book with a subtitle shows it in the field; clearing the
  field saves the book with no subtitle, and editing it saves the edit.
- A by-hand book with the field left empty saves `subtitle: null`.
- `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` pass.
