# Task 28: CSV import

## Context

Promoted 2026-10-23 from the todo [csv-import](../../todos/csv-import.md) (v1.x in
[features.md](../../wiki/features.md)). On 2026-10-14 the owner said there is no
existing list to bring in, so this is not urgent; it is for lists that turn up.

Import a CSV from Goodreads, Libib or a spreadsheet: map columns to fields, look up
the rows that have only an ISBN, show a preview with duplicates flagged, then save.
Libib's import needs only an ISBN column. LibraryThing exports can be non-UTF-8, so
detect the encoding.

What exists (checked 2026-10-23):

- Export already writes CSV with a field list
  ([`web/src/export/fields.ts`](../../../web/src/export/fields.ts),
  [`csv.ts`](../../../web/src/export/csv.ts)). Import reads the same field names,
  so a Shelfmark export imports back cleanly.
- Lookups go through `POST /api/lookup` and the server's per-source queues
  ([`server/src/lookup/queue.ts`](../../../server/src/lookup/queue.ts)). The Google
  Books key is to be spared: the keyless sources answer first and Google is asked
  last ([decisions.md](../../wiki/decisions.md)). A row that already has a title does
  not need a lookup at all.
- `POST /api/books` creates one book;
  [`shared/src/book.ts`](../../../shared/src/book.ts) has `bookCreateSchema`.

## Files you OWN

- `web/src/import/` (new): parsing, encoding detection, column mapping, the preview
- `web/src/layout/` (an "Import a CSV" item in the account menu, beside the backup
  download; not a new place, per "Two places only" in decisions.md)
- `web/src/router.ts` (a route for the import screen under Library)
- `server/src/routes/books.ts` and the store, only if saving the batch needs one
  transaction (`POST /api/books/batch`); otherwise none
- `corpus/.planned-roots` (add `web/src/import`)

## Files you must NOT touch

- `server/src/lookup/`: the batch waits its turn in the existing queues; no faster
  path and no parallel lookups from the client.
- `web/src/export/`: read its field list, don't change it.

## What to do

1. Read the file in the browser. Try UTF-8 with `fatal: true`; on failure fall back
   to windows-1250 (Romanian) and then windows-1252, and show which one was used. A
   UTF-8 BOM is dropped.
2. Parse CSV properly (quoted fields, embedded commas and newlines). Recognise
   Goodreads, Libib, LibraryThing and Shelfmark's own export headers and map them
   automatically; for anything else, a mapping step lists each column with a field
   picker.
3. Preview: one row per line with the mapped title, author, ISBN and shelf, flagged
   "Already in your library" (same ISBN owned), "Invalid ISBN", or "Needs a lookup"
   (ISBN only). Rows can be unticked.
4. "Look up the missing details" runs the lookups one at a time through
   `POST /api/lookup`, with progress and a Stop button. Rows that have a title skip it.
5. Save the ticked rows into the chosen collection (Owned or Wishlist, after brief
   23). Report how many were saved, skipped as duplicates and failed.

## Acceptance

- A Goodreads export of 20 books imports with no mapping step; the 3 already owned
  are flagged and unticked by default.
- A Libib CSV with only an ISBN column fills the rows through lookups, one at a time.
- A windows-1250 file with Romanian diacritics shows them correctly.
- Re-importing a Shelfmark export of the library flags every row as a duplicate.
- `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` pass.
