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

## Outcome (2026-11-17)

Built on local `main` (`e1e62ed`), the web app and one line of shared. Deploy, after the push, from the vps-deploy checkout: `node cli.ts shelfmark server` first, built from `main` including this commit (again if it already ran for brief 11 before the push), then `node cli.ts shelfmark deploy`. The order matters twice: the new web parses every book reply with `bookSchema`, which requires `readers`; and `readers` in `LIBRARY_COLUMN_IDS` compiles into the server, so a server built without it answers 400 to saving a view with Readers shown (it is on by default).

**Book page.** The header's status reads "Your status" and the rating fact in About this copy "Your rating". Under the shelf and your status, `OtherReaders` (`web/src/book/OtherReaders.tsx`) lists everyone in `readers`, in the server's order: the name semibold in ink, the status (Reading in the accent, as in the table), the rating as five 14 px stars with "4 of 5 stars" for a screen reader, and the day from `formatAdded` ("Today", "12 Oct", "3 Mar 2025"). Nothing when the list is empty. The lines sit outside the edit switch, so they show while editing too.

**Library.** `readers` sits after `status` in `LIBRARY_COLUMN_IDS` and `COLUMNS`: 180 px, on by default, its text from `readersText` in `columns.ts` (the others grouped by status, reading first, then read, abandoned and unread; names in the server's order within a group). A new `showOnly` flag on a column gives it a plain header (no sort button) and keeps it out of sorting and filtering: the filter and sort lists never named it, and `normalizeSorting` and `activeFilters` drop a stored sort or filter naming it. Its cell wraps (`wrap-anywhere`) and, past the row's 91 px, scrolls inside the cell rather than hide a name.

**Copy.** `StatusPicker`'s default label is "Your status" (Add a book's result sheet and by-hand form, the edit form); `RatingField` says "Your rating"; the bulk bar says "Set your status" (the desktop menu and the phone's Actions section); the import's mapping offers "Your status" and "Your rating". The status and rating columns' labels say "Your status" and "Your rating", so the filter list, the filter panel's heading, the chips ("Your status: Read"), the column picker, the sort list and the caption ("by your status") do too.

**Deviations.**
- Both table headers say "Your status" and "Your rating", not only the labels the filters read: next to Readers a bare "Status" reads as the book's. "Your status" fits the 112 px column with its sort arrow; the rating column went from 72 px to 104 px for its header. The rating column is off by default.
- The export writes the columns' labels, so its headers are now "Your status" and "Your rating", and it gains a Readers column. The import's Shelfmark aliases (`web/src/import/fields.ts`) read the new headers as well as the old: the first `npm run check` failed on the export read back by the import, which this fixed.
- `DESIGN.md` (outside the owned files) records the Readers column, the book page's reader lines and "Set your status", so the design system as built stays true.
- A reader with only a rating shows as "Unread: name", last in the cell.
- The phone row shows no readers under the author, as it shows shelf and status: the row is a fixed 91 px. Readers is in the table's sideways scroll like the other columns.
- On a device with saved Library columns, Readers lands last (`normalizeOrder` appends a column a version adds); Reset columns puts it after Your status. Asked on the board.
- The Stats page's Status section counts your statuses and still says "Status": outside the owned files.
- A book without `readers` can't reach the web: the service worker caches no API reply, the offline copy keeps four fields, and every reply goes through `bookSchema`. No fallback was added.

**Tests** (pure, nothing boots the app): `readersText`'s grouping and order, a rating-only reader, the empty case and the column's value; a stored sort and filter by Readers dropped. The default-column expectations in `prefs.test.ts` and `savedViews.test.ts` and the chip text in `filters.test.ts` gained the new column and label.

**Checks:** `npm run check` exit 0 (typecheck, lint 0 errors, format, knip, dependency-cruiser, check-base-ui 0, check-structure 9 warnings as before, 909 tests). A browser walk on a scratch data folder (never the real database, no lookups, the CIP refresh off) with three throwaway seeded accounts, at 1440 and 390 px: each account saw its own status and rating in the controls and the others in the reader lines and the Readers cell; changing your status and rating in the edit form and with the bulk bar left the other account's line and its own values unchanged, checked from both sides over the API and in the browser; a saved view with Readers shown saved, reloaded and applied; at 390 px no horizontal overflow on the book page or the table, and a 55-character hyphenated name and a 58-character unbroken one wrap. Not run: the deploy, the e2e suite, saving an import (only the mapping).
