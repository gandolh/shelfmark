# Task 10: Book page

## Context

One page per book at `/books/:id`: see everything, change anything, fix the
cover, delete. Fields and words: [data-model.md](../../wiki/data-model.md),
[glossary.md](../../wiki/glossary.md). Look: [design.md](../../wiki/design.md)
(the mock-ups don't draw this page; build it in the same world: the cover
leads, flat controls, one accent). Load `impeccable`.

Depends on briefs 04, 05 and 09 (reuses `ManualForm` pieces, `CoverCapture`,
`ShelfPicker`, `StatusPicker`).

## Files you OWN

```
web/src/book/BookPage.tsx   (replaces brief 04's stub)
web/src/book/BookDetails.tsx  web/src/book/EditForm.tsx
web/src/book/CoverPanel.tsx  web/src/book/RelookupDiff.tsx  web/src/book/relookup.test.ts
web/src/book/DeleteBook.tsx
```

## Files you must NOT touch

`web/src/add/*` (import from it), the server.

## What to do

1. **View.** Large cover (or the placeholder) beside title, subtitle,
   authors, then the facts in two groups: about the book (publisher, year,
   pages, language, series, ISBN-13 and the derived ISBN-10, subjects,
   description) and about this copy (shelf, status, rating, format, condition,
   signed, acquired on/from/price, tags, notes, added, source).
2. **Edit** in place: one "Edit" switches the facts to a form (`EditForm`) with
   the right control per field (shelf and status as on the Add page, rating as
   five real buttons, tags as chips with autocomplete from tags in use, price
   in lei with two decimals, stored in bani). Save sends one `PATCH` with only
   the changed fields; Cancel restores.
3. **Cover panel**: replace by photo or file (resize as brief 09), remove,
   or pick from the lookup's cover candidates.
4. **Re-run lookup** (only when the book has an ISBN): shows a field-by-field
   diff of what the sources say now against what is stored; the owner ticks the
   fields to take. Never overwrites silently.
5. **Delete** sits apart from Edit and Save, asks for confirmation naming the
   book, then returns to the Library.
6. Unknown id → "This book isn't in your library" with a link back.

## Acceptance

- `relookup.test.ts`: the diff ignores equal values and whitespace, and applies
  only ticked fields.
- Manual: edit every field kind, replace and remove a cover, re-run a lookup,
  delete; the Library reflects each change without a reload.
- impeccable's detector run on `web/src/book`; `npm run typecheck && npm run
  lint && npm test` pass.

## Outcome

_2026-10-15_. Done. Checked live at 1280 px (and the phone layout in a
390 px frame): editing title, rating, price (`19,99` → 1999 bani) and tags
sent one PATCH with only those fields; re-run lookup showed a diff with
nothing ticked and applied only the ticked fields; a cover taken from the
lookup's candidates, one uploaded from a file, then removed; delete with a
confirmation naming the book, back to the Library; the Library reflected each
change without a reload; an unknown id shows "This book isn't in your
library". The camera photo path, a failed save and the form's validation
errors weren't exercised in the browser (the logic is unit-tested). Pure
logic is in `relookup.ts`, `patch.ts` and `money.ts`; extra pieces are
`RatingField.tsx`, `TagsField.tsx`, `useLookup.ts` (one lookup feeds both the
diff and the cover candidates) and `book.css`. Cover candidates need an ISBN,
so a book entered by hand gets a cover from a photo or a file only. Currency,
barcode and `author_sort` aren't editable. 34 tests; detector clean.
