---
summary: The SQLite schema as shipped by brief 02 on 2026-10-14. One row per physical copy (decided) with bibliographic fields, personal fields and provenance, wishlist rows in the same table; tags (matched case-insensitively), covers (as BLOBs) and the planned lookup cache as their own tables; no isbn10 column; defaults, CHECKs and what null means; how ISBNs, authors, author sort, money and dates are stored; and why there is no full-text index.
updated: 2026-10-14
---

# Data model

Shipped by brief 02 on 2026-10-14 as migration 1 in
[migrations.ts](../../server/src/db/migrations.ts). **One row per physical
copy** is the owner's decision ([decisions.md](decisions.md)); the rest came
from the 2026-10-14 research. Column names follow [glossary.md](glossary.md).
The API's `Book` ([book.ts](../../shared/src/book.ts)) is a row in camelCase
plus `tags` and `hasCover`; [books.ts](../../server/src/store/books.ts) is the
only module that runs SQL on `books`, `tags` and `book_tags`.

## `books`: one row per copy (owned or wished)

| Group | Columns |
|---|---|
| Identity | `id` INTEGER PK; `isbn13` TEXT nullable, indexed, **not unique**, CHECKed to 13 digits starting `978`/`979`; `barcode` TEXT nullable (raw non-ISBN code). No `isbn10` column: it is derived from `isbn13` when shown (null for `979`). |
| Bibliographic | `title` NOT NULL, not blank; `subtitle`; `authors` NOT NULL DEFAULT `'[]'` (JSON array of display names); `author_sort` ("Cărtărescu, Mircea", derived, editable); `publisher`; `published_year` INTEGER; `pages` INTEGER > 0; `language` (ISO 639-1, e.g. `ro`); `series`; `series_number` TEXT ("3a", "II"); `description`; `subjects` NOT NULL DEFAULT `'[]'` (JSON array) |
| Copy | `collection` NOT NULL DEFAULT `'owned'` (`owned`, `wishlist`); `format` (`hardcover`, `paperback`, `other`); `condition` (`new`, `good`, `worn`, `damaged`); `shelf` TEXT ("Living room · A2"); `signed` INTEGER 0/1, NOT NULL DEFAULT 0 |
| Reading | `status` NOT NULL DEFAULT `'unread'` (`unread`, `reading`, `read`, `abandoned`); `rating` 1-5 nullable; `notes` |
| Acquired | `acquired_on` TEXT `YYYY-MM-DD`; `acquired_from` TEXT (shop, person); `price_minor` INTEGER ≥ 0 + `currency` NOT NULL DEFAULT `'RON'` |
| Provenance | `metadata_source` NOT NULL DEFAULT `'manual'` (`openlibrary`, `googlebooks`, `manual`, `import`) |
| Times | `created_at`, `updated_at` NOT NULL (UTC ISO strings, set by the store) |

Every other column is nullable. CHECKs hold the settled vocabularies
(`collection`, `status`, `format`, `condition`), `signed`, `rating`, the ISBN
shape and the JSON arrays. `metadata_source` and `currency` have no CHECK on
purpose: SQLite can't change a CHECK without rebuilding the table, and both
lists may grow. The shared zod schemas guard them on the way in.

Why one row per copy: the question the app answers is "what is on my shelves",
and every personal field (shelf, condition, price) belongs to a copy.
Two copies of one book are rare, so the duplicated title text costs nothing.
The alternative, an `editions` table plus a `copies` table, is cleaner on paper
but doubles the join and the edit UI for a case that hardly happens.

## Other tables

- **`tags`** (`id`, `name`, `name_key` UNIQUE) and **`book_tags`**
  (`book_id`, `tag_id`, primary key on both, each FK `ON DELETE CASCADE`,
  indexed by `tag_id`). A table, not a JSON column, so renaming a tag is one
  update. `name_key` is the name (trimmed, NFC) lower-cased in JS, because
  SQLite's `NOCASE` folds ASCII only and would let "Știință" and "știință" be
  two tags. Matching is on `name_key`; the first spelling stays. A tag no book
  uses is deleted. A book's tags keep the order they were given
  (`book_tags.rowid`).
- No `loans` table: the owner dropped loans ([decisions.md](decisions.md)).
- **`covers`**: `book_id` INTEGER PK, FK to `books` with `ON DELETE CASCADE`;
  `mime`, `bytes` BLOB, `source`, `updated_at`, all NOT NULL. Covers live in
  the database, not in a folder ([decisions.md](decisions.md)); `Book.hasCover`
  is derived from it. Brief 02 created the table; brief 05 fills and serves it.
- **`lookup_cache`** (brief 05, not yet shipped): `isbn13`, `source`,
  `response` (raw JSON), `fetched_at`. Re-looking an ISBN up never hits the
  network twice.
- Auth tables come from the vendored `ward-auth` library, as in Satchel.

## Storage rules

- ISBNs stored as bare digits, ISBN-13 canonical. Formatting with hyphens is
  display only. The schema checks the shape only; the check digit is
  `parseIsbn`'s ([isbn.ts](../../shared/src/isbn.ts)), run where raw input
  comes in.
- `author_sort` is derived from the first author on create unless given
  ("Mircea Cărtărescu" → "Cărtărescu, Mircea"; one-word names and names already
  written with a comma unchanged; no authors → null). A patch of `authors`
  re-derives it only if the stored value was derived, which means it equals
  what the stored authors give; there is no flag column. Patching
  `authorSort: null` derives it again.
- In a create or a patch, `null` (or a blank string) clears a field: a nullable
  column becomes NULL, a list becomes empty, a column with a default goes back
  to it. The title can't be cleared.
- Shelf is free text with autocomplete from existing values, written as
  "Room · shelf", not a managed list, until someone needs to rename a shelf in
  bulk (then it becomes a table).
- A wishlist row has `collection = 'wishlist'` and no shelf, condition or
  acquisition; "I bought it" sets `collection = 'owned'` and asks for a shelf.
  The owned-check and "already in your library" only count owned rows. The
  server does not enforce the empty fields; the screens do.
- Money in minor units (bani) to avoid float sums.
- No FTS5 index: search runs in the browser over all rows
  ([library-table.md](library-table.md)). Add one only if the server ever needs
  to search. `GET /api/books` answers 3,000 books in about 35-40 ms (measured
  in the route test on 2026-10-14).

## Files

`data/shelfmark.db` (WAL mode, `foreign_keys = ON` per connection), opened and
migrated once by `buildApp` ([open.ts](../../server/src/db/open.ts)) and
gitignored. It holds everything, covers included, so the backup is this one
file ([export.md](export.md)). Migrations are tracked in `PRAGMA user_version`;
a later brief appends one, never edits a shipped one.
