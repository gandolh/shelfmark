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
