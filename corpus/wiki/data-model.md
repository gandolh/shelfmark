---
summary: The SQLite schema, proposed on 2026-10-14. One row per physical copy (decided) with bibliographic fields, personal fields and lookup provenance, wishlist rows in the same table; tags and the lookup cache as their own tables; how ISBNs, authors, money and dates are stored; and why there is no full-text index.
updated: 2026-10-14
---

# Data model (proposed)

A proposal from the 2026-10-14 research, except **one row per physical copy**,
which the owner decided ([decisions.md](decisions.md)). Column names follow
[glossary.md](glossary.md).

## `books`: one row per copy (owned or wished)

| Group | Columns |
|---|---|
| Identity | `id` INTEGER PK; `isbn13` TEXT nullable, indexed, **not unique**; `isbn10` TEXT nullable (derived; null for `979`); `barcode` TEXT nullable (raw non-ISBN code) |
| Bibliographic | `title` NOT NULL; `subtitle`; `authors` (JSON array of display names); `author_sort` ("Cărtărescu, Mircea", derived, editable); `publisher`; `published_year` INTEGER; `pages` INTEGER; `language` (ISO 639-1, e.g. `ro`); `series`; `series_number` TEXT; `description`; `subjects` (JSON array) |
| Copy | `collection` (`owned`, `wishlist`); `format` (`hardcover`, `paperback`, `other`); `condition` (`new`, `good`, `worn`, `damaged`); `shelf` TEXT ("Living room · A2"); `signed` BOOLEAN |
| Reading | `status` (`unread`, `reading`, `read`, `abandoned`); `rating` 1-5 nullable; `notes` |
| Acquired | `acquired_on` DATE; `acquired_from` TEXT (shop, person); `price_minor` INTEGER + `currency` (default `RON`) |
| Provenance | `metadata_source` (`openlibrary`, `googlebooks`, `manual`, `import`); `cover_file` nullable |
| Times | `created_at`, `updated_at` (UTC ISO strings) |

Why one row per copy: the question the app answers is "what is on my shelves",
and every personal field (shelf, condition, price) belongs to a copy.
Two copies of one book are rare, so the duplicated title text costs nothing.
The alternative, an `editions` table plus a `copies` table, is cleaner on paper
but doubles the join and the edit UI for a case that hardly happens.

## Other tables

- **`tags`** (`id`, `name` UNIQUE) and **`book_tags`** (`book_id`, `tag_id`).
  A table, not a JSON column, so renaming a tag is one update.
- No `loans` table: the owner dropped loans ([decisions.md](decisions.md)).
- **`lookup_cache`**: `isbn13`, `source`, `response` (raw JSON), `fetched_at`.
  Re-looking an ISBN up never hits the network twice.
- Auth tables come from the vendored `ward-auth` library, as in Satchel.

## Storage rules

- ISBNs stored as bare digits, ISBN-13 canonical. Formatting with hyphens is
  display only.
- Shelf is free text with autocomplete from existing values, written as
  "Room · shelf", not a managed list, until someone needs to rename a shelf in
  bulk (then it becomes a table).
- A wishlist row has `collection = 'wishlist'` and no shelf, condition or
  acquisition; "I bought it" sets `collection = 'owned'` and asks for a shelf.
  The owned-check and "already in your library" only count owned rows.
- Money in minor units (bani) to avoid float sums.
- No FTS5 index: search runs in the browser over all rows
  ([library-table.md](library-table.md)). Add one only if the server ever needs
  to search.

## Files

`data/shelfmark.db` (WAL mode) and `data/covers/<book id>.jpg`. Both
gitignored; both in the backup ([export.md](export.md)).
