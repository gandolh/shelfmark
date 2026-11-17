---
summary: The SQLite schema as shipped on 2026-10-15 on 2026-10-14 and extended since. One row per physical copy (decided) with bibliographic fields, personal fields and provenance, wishlist rows in the same table; each person's own status and rating in readings (migration 5, 2026-11-17); tags (matched case-insensitively), covers (as BLOBs), the lookup cache and saved views (migration 3, unique names via name_key) as their own tables; bulk changes in one transaction; no isbn10 column; defaults, CHECKs and what null means; how ISBNs, authors, author sort, money and dates are stored; and why there is no full-text index.
updated: 2026-11-17
---

# Data model

Shipped on 2026-10-15 on 2026-10-14 as migration 1 in
[migrations.ts](../../server/src/db/migrations.ts). **One row per physical
copy** is the owner's decision ([decisions.md](decisions.md)); the rest came
from the 2026-10-14 research. Column names follow [glossary.md](glossary.md).
The API's `Book` ([book.ts](../../shared/src/book.ts)) is a row in camelCase
plus `tags`, `hasCover` and `coverUpdatedAt`, and the signed-in person's own
`status` and `rating` with everyone else's in `readers` (see `readings`
below); [features/books/store.ts](../../server/src/features/books/store.ts) is the
only module that runs SQL on `books`, `tags` and `book_tags`, and
[readings.ts](../../server/src/features/books/readings.ts) beside it the only
one that writes `readings`.

## `books`: one row per copy (owned or wished)

| Group | Columns |
|---|---|
| Identity | `id` INTEGER PK; `isbn13` TEXT nullable, indexed, **not unique**, CHECKed to 13 digits starting `978`/`979`; `barcode` TEXT nullable (raw non-ISBN code). No `isbn10` column: it is derived from `isbn13` when shown (null for `979`). |
| Bibliographic | `title` NOT NULL, not blank; `subtitle`; `authors` NOT NULL DEFAULT `'[]'` (JSON array of display names); `author_sort` ("Cărtărescu, Mircea", derived, editable); `publisher`; `published_year` INTEGER; `pages` INTEGER > 0; `language` (ISO 639-1, e.g. `ro`); `series`; `series_number` TEXT ("3a", "II"); `description`; `subjects` NOT NULL DEFAULT `'[]'` (JSON array) |
| Copy | `collection` NOT NULL DEFAULT `'owned'` (`owned`, `wishlist`); `format` (`hardcover`, `paperback`, `other`); `condition` (`new`, `good`, `worn`, `damaged`); `shelf` TEXT ("Living room · A2"); `signed` INTEGER 0/1, NOT NULL DEFAULT 0 |
| Reading | `notes`. `status` and `rating` were here until migration 5 (2026-11-17) moved them to `readings`, one per person |
| Acquired | `acquired_on` TEXT `YYYY-MM-DD`; `acquired_from` TEXT (shop, person); `price_minor` INTEGER ≥ 0 + `currency` NOT NULL DEFAULT `'RON'` |
| Provenance | `metadata_source` NOT NULL DEFAULT `'manual'` (`openlibrary`, `googlebooks`, `manual`, `import`) |
| Times | `created_at`, `updated_at` NOT NULL (UTC ISO strings, set by the store) |

Every other column is nullable. CHECKs hold the settled vocabularies
(`collection`, `format`, `condition`), `signed`, the ISBN shape and the JSON
arrays. `metadata_source` and `currency` have no CHECK on
purpose: SQLite can't change a CHECK without rebuilding the table, and both
lists may grow. The shared zod schemas guard them on the way in.

Why one row per copy: the question the app answers is "what is on my shelves",
and every personal field (shelf, condition, price) belongs to a copy.
Two copies of one book are rare, so the duplicated title text costs nothing.
The alternative, an `editions` table plus a `copies` table, is cleaner on paper
but doubles the join and the edit UI for a case that hardly happens.

## Other tables

- **`readings`** (migration 5, 2026-11-17): `book_id` (FK to `books`,
  `ON DELETE CASCADE`), `user_id` TEXT, `status` NOT NULL DEFAULT `'unread'`
  (CHECKed to the four statuses), `rating` 1-5 nullable, `updated_at`; primary
  key `(book_id, user_id)`. One person's own status and rating on one book
  ([decisions.md](decisions.md)), kept only while it says something: back to
  `unread` with no rating deletes the row. `user_id` is an `auth_users` id with
  **no foreign key**: that table is the accounts library's, created after the
  app's migrations on a fresh database, and no account is ever deleted. A row
  whose account has no `auth_users` row is left out of every reply. Every book
  reply reads as the signed-in person: their own `status` and `rating`
  (`unread` and `null` without a row), and `readers`, everyone else with a
  row, sorted by username, the name read from `auth_users` at reply time.
  Writing a status or rating never touches the book's `updated_at`. The
  migration gave every status and rating already on `books` to the
  earliest-created account with the `owner` role (ties by id; the reading's
  `updated_at` is the book's), then dropped the two columns; with something to
  move and no such account it throws and changes nothing.
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
  and `Book.coverUpdatedAt` (its `updated_at`, the web app's `?v=` for the
  image URL) are derived from it. The table came with the schema (2026-10-15); the lookup fills and serves it.
- **`lookup_cache`** (migration 2, 2026-10-15): `isbn13`, `source`, `outcome`
  (`found` or `not_found`, CHECK), `response` (the source's answer as JSON),
  `fetched_at`; primary key `(isbn13, source)`, `WITHOUT ROWID`. The
  `outcome` column lets expiry work without parsing each source's format, and
  its CHECK keeps an error from ever being stored. A found answer is reused
  forever, a not-found one for 7 days ([metadata-lookup.md](metadata-lookup.md)).
- **`saved_views`** (migration 3, 2026-10-23): `id`; `name` NOT NULL, not blank;
  `name_key` NOT NULL UNIQUE; `state` TEXT, CHECKed to be a JSON object;
  `position` INTEGER ≥ 0; `created_at`, `updated_at`. One row per named view
  of the Library ([library-table.md](library-table.md)). `name_key` exists for
  the same reason as tags': the name in NFC, trimmed and lower-cased in JS
  (`viewNameKey` in [features/views/store.ts](../../server/src/features/views/store.ts)), because a
  `UNIQUE ... COLLATE NOCASE` on `name` would fold ASCII only and let "Știință"
  and "știință" be two views. A clash is a `409`. `state` is the shared
  `SavedViewState` ([views.ts](../../shared/src/views.ts): tab, filters, sort,
  shown columns), checked strictly on the way in and read leniently, so a
  column a later version drops leaves the view rather than breaking it.
  `position` is the view's place in the Views menu, kept dense (0, 1, 2…) by
  the store, which is the only module that runs SQL on the table.
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
  Shipped (2026-10-23) as one `PATCH /api/books/:id` with
  `{ collection: "owned", shelf, acquiredOn: <today> }`: the same row moves, so
  no second row and the id keeps its cover and notes.
  The owned-check and "already in your library" only count owned rows. The
  server does not enforce the empty fields; the screens do.
- A bulk change (2026-10-23; `POST /api/books/bulk`) is one transaction in
  the books store: it checks every id first and changes nothing if one names
  no book. Only the rows whose shelf or tags actually change are written, so
  the rest keep their `updated_at`. A status change writes only the caller's
  `readings` rows and no book's `updated_at`. A shelf change skips wishlist
  rows (they have no shelf). Added tags go through `name_key` like any other,
  and `book_tags`' primary key keeps a book from getting a tag twice.
- Money in minor units (bani) to avoid float sums.
- No FTS5 index: search runs in the browser over all rows
  ([library-table.md](library-table.md)). Add one only if the server ever needs
  to search. `GET /api/books` answered 3,000 books in about 35-40 ms (measured
  on 2026-10-14 by a route test, dropped on 2026-10-24 with the other
  app-booting tests).

## Files

`data/shelfmark.db` (WAL mode, `foreign_keys = ON` per connection), opened and
migrated once by `buildApp` ([open.ts](../../server/src/db/open.ts)) and
gitignored. It holds everything, covers included, so the backup is this one
file ([export.md](export.md)). Migrations are tracked in `PRAGMA user_version`;
a later brief appends one, never edits a shipped one. An entry is SQL, or a
function when it needs code (migration 5's move and its refusal), run in the
same transaction.
