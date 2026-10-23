---
summary: How CSV import works and why it is shaped so. The account-menu entry (no third place), encoding detection, the header sets that map automatically, the preview flags and default ticks, the one-at-a-time lookups that spare the Google Books key, and how rows are saved. Read before changing web/src/import/.
updated: 2026-10-23
---

# CSV import

Shipped by [brief 28](../briefs/done/28-csv-import.md). Code in
[`web/src/import/`](../../web/src/import/); it reads the field names
[export](export.md) writes, so a Shelfmark export imports back cleanly.

## Where it lives

"Import a CSV" is an item in the account menu, beside the backup download. It
opens the `import` route (`/import`), which counts as part of the Library
place. It is not a third tab ("Two places only" in
[decisions.md](decisions.md)).

## Steps

1. **Choose a file.** Read in the browser. Encoding: UTF-16 when the file
   starts with its byte order mark; otherwise UTF-8 with `fatal: true`, then
   windows-1250, then windows-1252. The preview says which was used. A
   windows-1250 file's cedilla ş and ţ become the comma-below ș and ț.
   windows-1250 reads every byte, so 1252 is reached only where a runtime
   lacks that code page. A UTF-8 BOM is dropped.
2. **Parse.** `csv.ts`: RFC 4180 quoting, any line ending, and the delimiter
   (`,` `;` or tab) taken from the first line, since Excel in a Romanian locale
   writes `;`. The export's formula guard (a leading `'`) is stripped.
3. **Map.** Recognised files skip the mapping step; "Change columns" reopens
   it. The tell for each:

   | File | Recognised by | Notes |
   |---|---|---|
   | Goodreads | `Exclusive Shelf` | ISBNs arrive as `="..."`; `Exclusive Shelf` is the status; `Bookshelves` are tags |
   | LibraryThing | `Primary Author` | authors are "Last, First" and are flipped |
   | Libib | `ean_isbn13` or `item_type` | works with an ISBN column alone |
   | Shelfmark | `Number in series`, `Details from` or `Acquired from` | the Library's column labels |

   Any other file gets the mapping step, prefilled from common header names;
   it needs a Title or an ISBN column to go on.
4. **Preview.** One row per line: title, author, ISBN, shelf, flags.
   - *Already in your library*: the ISBN is on an owned book, or on a book of the
     collection being imported into.
   - *Repeated in this file*: an earlier row has the same ISBN.
   - *Invalid ISBN*: checksum or length wrong; the ISBN is dropped if the row is
     saved.
   - *Needs a lookup*: a valid ISBN and no title.
   - Duplicates and invalid ISBNs start unticked; all rows can be ticked by hand.
5. **Look up the missing details** (optional). Only ticked rows with no title
   and a valid ISBN, shown as a count first. One `POST /api/lookup` at a time,
   in order, with progress and a Stop button, so the server's per-source queues
   and the Google Books key are spared ([metadata-lookup.md](metadata-lookup.md)).
   A draft fills only what the file left empty; no title in the answer is "Not
   found". No network or a signed-out session ends the run; any other failure
   marks the row and goes on.
6. **Save.** Ticked rows with a title go one `POST /api/books` at a time into
   Owned or Wishlist (a wishlist body has `collection: "wishlist"` and no shelf,
   as `bodyFromProposal` in `web/src/add/flow.ts`). `metadataSource` is `import`, or the
   lookup's source. The result counts saved, skipped as duplicates, left out and
   failed (with each reason).

There is no batch endpoint: a home library is small, and one request per row
keeps a bad row from sinking the rest.
