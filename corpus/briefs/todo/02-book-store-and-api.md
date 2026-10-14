# Task 02: Book store and API

## Context

The server's data layer and the CRUD routes every screen uses. Read
[data-model.md](../../wiki/data-model.md) (the schema),
[glossary.md](../../wiki/glossary.md) (the words: book, collection, shelf,
status) and [decisions.md](../../wiki/decisions.md): one row per physical copy,
no loans, the wishlist as a second collection in the same table, one user.

Two simplifications made while writing the briefs (recorded in
[data-model.md](../../wiki/data-model.md)):

- **No `isbn10` column.** It is derived from `isbn13` wherever it is shown
  (brief 03's `to10`).
- **Covers live in SQLite**, in a `covers` table with `ON DELETE CASCADE`, not
  in a folder. Deleting a book deletes its cover, and the backup is one file.
  This brief creates the table; brief 05 fills and serves it.

Depends on brief 01.

## Files you OWN

```
shared/src/book.ts  shared/src/book.test.ts   (and one export line in shared/src/index.ts)
server/src/db/open.ts  server/src/db/migrations.ts  server/src/db/migrations.test.ts
server/src/store/books.ts  server/src/store/books.test.ts
server/src/routes/books.ts  server/src/routes/books.test.ts
server/src/errors.ts
server/src/app.ts   (one registration line)
```

## Files you must NOT touch

`server/src/testing/testApp.ts` beyond using it (brief 06 extends it). No
lookup, cover bytes, auth or UI.

## What to do

1. **Shared contract** (`shared/src/book.ts`, zod): `Status` (`unread`,
   `reading`, `read`, `abandoned`), `Format` (`hardcover`, `paperback`,
   `other`), `Condition` (`new`, `good`, `worn`, `damaged`), `Collection`
   (`owned`, `wishlist`); `Book` (every column in the data model, `tags` as
   `string[]`, plus `hasCover: boolean`); `BookCreate` (title required;
   everything else optional; `collection` defaults to `owned`); `BookPatch`
   (every field optional, `null` clears). `isbn13` must match
   `^97[89]\d{10}$` (full check-digit validation is brief 03's, applied by the
   routes that take raw input).
2. **Database.** `server/src/db/open.ts` opens `<DATA_DIR>/shelfmark.db` with WAL and
   `foreign_keys = ON`. `server/src/db/migrations.ts` holds an ordered list of SQL
   migrations applied on boot inside a transaction, tracked with
   `PRAGMA user_version`; later briefs append. Migration 1 creates `books`
   (as in the data model, `collection TEXT NOT NULL DEFAULT 'owned'`, an index
   on `isbn13`, not unique), `tags`, `book_tags` (both FKs with cascade) and
   `covers` (`book_id INTEGER PRIMARY KEY REFERENCES books ON DELETE CASCADE`,
   `mime TEXT NOT NULL`, `bytes BLOB NOT NULL`, `source TEXT NOT NULL`,
   `updated_at TEXT NOT NULL`).
3. **Store** (`server/src/store/books.ts`, the only module that runs SQL on these tables):
   `list()` (every book with its tags and `hasCover`, in one query plus one
   for tags, never one query per book), `get(id)`, `create(input)`,
   `patch(id, patch)`, `remove(id)`, `findByIsbn(isbn13)` (all rows,
   both collections, for brief 05's "already owned"). Tags are upserted by name
   (trimmed, case-insensitive match, original casing kept); unused tags are
   deleted. `author_sort` is derived on create from the first author ("Mircea
   Cărtărescu" → "Cărtărescu, Mircea"; one-word names unchanged) unless given;
   a patch of `authors` re-derives it only if the stored value was derived.
   Times are UTC ISO strings set by the store.
4. **Routes** (`server/src/routes/books.ts`, a Fastify plugin): `GET /api/books`,
   `GET /api/books/:id`, `POST /api/books` (201 with the book),
   `PATCH /api/books/:id`, `DELETE /api/books/:id` (204). Bodies validated with
   the shared schemas. Errors leave through `errors.ts` as
   `{ "error": { "code", "message" } }`: `validation` 400, `not_found` 404.
5. **Tests** for the store (create, list with tags and covers, patch, the
   author-sort rule, tag clean-up, cascade on delete, `findByIsbn` across both
   collections) and the routes (each status code), on `testApp`.

## Acceptance

- `npm run typecheck && npm run lint && npm test` pass.
- With the dev server running: create, list, patch and delete a book with
  `curl` against `/shelfmark-api/api/books`.
- `GET /api/books` with 3,000 seeded books answers in under 100 ms (a test
  seeds them in a transaction and measures).
- [data-model.md](../../wiki/data-model.md) matches what shipped.
