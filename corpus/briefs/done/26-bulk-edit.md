# Task 26: Bulk edit from the table

## Context

Promoted 2026-10-23 from the todo [bulk-edit](../../todos/bulk-edit.md) (v1.x in
[features.md](../../wiki/features.md): "row selection in the table first").

Select rows in the table, then set shelf, status or tags on all of them, or delete
them, in one action. Row selection is sketched in
[library-table.md](../../wiki/library-table.md) and is **not built** (checked
2026-10-23: no `rowSelection` in `web/src/library/`). The API has one-book routes
only: `PATCH /api/books/:id` and `DELETE /api/books/:id` in
[`server/src/routes/books.ts`](../../../server/src/routes/books.ts).
[`server/src/store/books.ts`](../../../server/src/store/books.ts) is the only module
that runs SQL on `books`, `tags` and `book_tags`.

## Files you OWN

- `web/src/library/BookTable.tsx`, `CoversGrid.tsx`, `Toolbar.tsx`, `LibraryPage.tsx`,
  `state.ts`, `library.css` and their tests (selection and the bulk bar)
- `server/src/routes/books.ts`, `books.test.ts` (one bulk route)
- `server/src/store/books.ts`, `books.test.ts` (one transaction per bulk change)
- `shared/src/book.ts` (the bulk request schema)
- `web/src/books/store.ts` (applying the result to the cached list)

## Files you must NOT touch

- `server/src/db/migrations.ts`: no schema change.
- `web/src/add/`.

## What to do

1. A checkbox column in the table (and a long-press or a select mode on the covers
   view on a phone). Select all selects the rows the current filters show, not every
   book. The selection survives sorting and filtering until cleared.
2. With one or more rows selected, a bar replaces the toolbar: "3 selected", then
   Move to shelf, Set status, Add tags, Remove tags, Delete, and Clear.
3. `POST /api/books/bulk` with `{ ids, change }`, where `change` is one of: set
   shelf, set status, add tags, remove tags, delete. One SQLite transaction; it
   answers the updated books (or the deleted ids). Unknown ids are a `400` and
   nothing changes.
4. Delete asks first, naming the count. There is no undo, so say so in the dialog.
5. Moving wishlist rows to a shelf is not this brief's job: shelf changes apply to
   owned rows only, and the bar says how many it skipped.

## Acceptance

- Filter to one shelf, select all, Move to shelf "Bedroom · B1": every row shown
  moves, the rows hidden by the filter don't.
- Add tag "signed" to 5 rows: each has it once, matched case-insensitively with any
  existing "Signed" tag.
- Delete 3 rows after the confirm: gone from the table and from `GET /api/books`.
- A bulk request with one unknown id changes nothing.
- `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` pass.

## Outcome (2026-10-23)

Built in `fe7d22a` in a worktree. `POST /api/books/bulk` takes `{ ids, change }`, `change`
one of `{ kind: "shelf", shelf }` (`null` takes books off their shelf), `"status"`,
`"addTags"`, `"removeTags"` (each with `tags`) or `"delete"` (`bookBulkSchema` in
`shared/src/book.ts`, up to 10,000 distinct ids). `BookStore.bulk` runs it as one
transaction: every id is checked first, and an unknown one answers `400 validation` naming
it, with nothing changed. It answers `{ books, deleted, skipped }`: the books it applied to
as they now stand, the deleted ids, and the wishlist ids a shelf change left alone. Only
rows whose value changes are written, so the rest keep `updatedAt`; tags go through
`name_key` and `book_tags`' primary key, so "signed" joins an existing "Signed" once.
`books/store.ts` gains `bulk` / `bulkChangeBooks`, applied to the cached list in place.

The table has a select box before the columns (drawn outside TanStack, not in
`LIBRARY_COLUMN_IDS`) and a header box over the rows on show; on the covers a long press
selects, and while anything is selected a tap toggles. The selection (`selection.ts`, held
in `state.ts`) is keyed by id and `createdAt` and lasts through sort, filter, search and tab
switches until Clear. The bulk bar (`BulkBar.tsx`, dialogs in `BulkDialogs.tsx` on
ViewDialog's now-exported frame) replaces the toolbar: six buttons on the desktop, an
Actions menu and Clear on a phone, where Views stays at the end of the tabs row. The
selection stays after an edit; a delete drops the deleted books. A 400 makes the page
refetch the list (a book deleted elsewhere). Also touched outside the brief's list:
`web/src/api.ts` (`booksApi.bulk`), `ViewDialog.tsx` (exports). Not walked in a browser
yet; 818 tests at the time.
