# Task 12: Each reader their own status and rating (web)

**Depends on:** brief 11 (the server half: `status` and `rating` are the caller's own, `readers` lists everyone else).

**Before you start:** run `brief-board guide` ([corpus/CLAUDE.md](../../CLAUDE.md)).

## Context

After brief 11 every book reply carries the signed-in person's own `status` and `rating`, plus `readers`: `{ userId, username, status, rating, updatedAt }` for each other family member with a status or a rating. The filters, sorts, columns and saved views already work on the caller's own values. What's missing is showing who else is reading what, and saying "your" where a control now changes only yours.

The owner's words (2026-11-17): "when I set status to reading, I would like to show who is reading it. Or when a user sets it to read it is marked as read by that user. Each member of the family can have its own account, but the library is shared."

## The design

- **Book page.** The status and rating controls are labelled as yours ("Your status", "Your rating"). Under them, one line per other reader: name, status, their rating if any, and the date (`updatedAt`), e.g. "Ana · Read · ★★★★ · 12 Oct". Nothing when nobody else has a row.
- **Library.** A new column, `readers` ("Readers"), on by default, after Status: the others grouped by status, e.g. "Reading: Mihai · Read: Ana". It sorts by nothing and filters by nothing. Add it to `LIBRARY_COLUMN_IDS` in `shared/src/views.ts` so saved views can name it.
- **Copy.** Where a control writes a status or a rating (the add flow's `StatusPicker`, the edit form, the bulk bar, the import's mapping), the label says it is yours. The status filter's label reads "Your status", and the rating filter "Your rating".
- Follow the repo's DESIGN.md and the existing components (no new UI library). Names never truncate with an ellipsis; they wrap.

## Files you OWN

- `web/src/book/` (`BookPage.tsx`, `BookDetails.tsx`, `EditForm.tsx`, `RatingField.tsx`), `web/src/library/` (`columns.ts`, `FilterPanel.tsx`, `BookTable.tsx`, `BulkBar.tsx`, `test-books.ts`), `web/src/add/StatusPicker.tsx`, `web/src/import/` labels.
- `shared/src/views.ts` (the new column id).
- `corpus/` (log, wiki, this brief's closeout).

## Files you must NOT touch

`server/` (brief 11's), `web/vendor/`, `server/vendor/`.

## Acceptance

- [ ] Signed in as one of two accounts with different statuses on one book: the book page shows yours in the controls and the other person's line under them; the library's Readers column shows the other person.
- [ ] Changing your status or rating doesn't change the other person's line.
- [ ] Every status and rating control and filter says it is yours.
- [ ] Phone width (390 px): the book page and the library row don't overflow, and a long name wraps.
- [ ] `npm run check` passes, and the corpus lint ends clean (if the corpus has one).

## Outcome
