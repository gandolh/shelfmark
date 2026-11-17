# Task 11: Each reader their own status and rating (server)

**Depends on:** nothing. **Runs before:** brief 12 (the web half).

**Before you start:** run `brief-board guide` ([corpus/CLAUDE.md](../../CLAUDE.md)).

## Context

The library is shared by a family, and each member signs in with their own account (a local one, or Ward). Today a book has one `status` (`unread`, `reading`, `read`, `abandoned`) and one `rating` (1-5) in the `books` table, for everyone: when one person marks a book read, it reads as read for all, and nobody can see who is reading what.

## Owner decisions (2026-11-17)

- **Each person has their own status on each book.** One book can be "Reading" for Mihai and "Read" for Ana at once. A person changes only their own; the book shows everyone's.
- **Ratings are per person too**, with the status they belong to.
- Filters and sorts on status and rating mean **yours** (the owner took this with the first answer).

## The design

- **A new table**, in the next migration in `server/src/db/migrations.ts`:
  `readings (book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE, user_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread','reading','read','abandoned')), rating INTEGER CHECK (rating BETWEEN 1 AND 5), updated_at TEXT NOT NULL, PRIMARY KEY (book_id, user_id))`.
  A row means someone has a status other than `unread`, or a rating. Setting yourself back to `unread` with no rating deletes your row.
- **No foreign key to `auth_users`.** It is the vendored library's table, created after the app's migrations on a fresh database, and no user is ever deleted. A row whose `user_id` has no `auth_users` row is left out of every reply.
- **Moving today's data.** Every book whose `status` isn't `unread` or whose `rating` isn't null gets one `readings` row for the **earliest-created admin** in `auth_users` (ties by `id`), then `books.status` and `books.rating` are dropped. If there is something to move and `auth_users` is missing or has no admin, the migration throws with a message naming the problem: it never drops a status silently. A fresh database has no books, so it moves nothing.
- **The API keeps its shape for the caller.** In every book reply, `status` and `rating` are now **the signed-in person's own** (`unread` and `null` without a row), so the web app's filters, sorts, columns and saved views keep working and now mean "yours". A new field, `readers`, lists everyone else with a row: `{ userId, username, status, rating, updatedAt }`, sorted by username, the username read from `auth_users` at reply time (so a rename shows at once).
- **Writes change only the caller's row:** `PATCH /api/books/:id` with `status` or `rating`, the bulk status change, and `POST /api/books` (and so the import) with a status or rating. Changing your own status doesn't touch the book's `updated_at`: the book itself didn't change.
- **Backup** is a copy of the database file, so `readings` is in it with no change. A backup taken before this migration still restores: its next start runs the migration.

## Files you OWN

- `server/src/db/migrations.ts` and its test.
- `server/src/features/books/` (store, routes, their tests).
- `shared/src/book.ts` (the `readers` field and its type; `status` and `rating` stay).
- `server/scripts/check-stored-replies.ts`, if its fixtures need `readers`.
- `corpus/` (log, wiki, this brief's closeout).

## Files you must NOT touch

`web/` (brief 12), `server/vendor/`, `web/vendor/`, the recommendations, lookup and covers features.

## What to do

1. The migration, with the data move and its refusal.
2. The store reads `status`, `rating` and `readers` for a given user id, and writes the caller's row. The routes pass the signed-in user's id (see how the session reaches a route in `server/src/app.ts`).
3. `readers` in `shared/src/book.ts`. `npm run check` keeps the web app compiling: it reads `status` and `rating` as before and ignores `readers` until brief 12.
4. Tests, kept light: the migration's move to the earliest admin, its refusal, and its no-op on a fresh database; two users with different statuses on one book, each seeing their own `status` and the other in `readers`; a bulk status change touching only the caller's rows; back to `unread` with no rating deleting the row.

## Acceptance

- [ ] On a copy of a database with statuses and ratings, the migration gives each one to the earliest admin, and the books table has no `status` or `rating` column.
- [ ] With something to move and no admin, the migration throws and the database is unchanged.
- [ ] Two accounts on one book: each `GET /api/books` shows the caller's own `status` and `rating`, and the other person in `readers` with their username.
- [ ] `PATCH`, the bulk status change and `POST` write only the caller's row.
- [ ] `npm run check` passes, and `bash corpus/lint.sh` ends clean (if the corpus has one).

## Outcome (2026-11-17)

Built on local `main` (`50106d9`), server and shared; deploy: `node cli.ts shelfmark server` from the vps-deploy checkout after the push (the `server` phase builds and starts the container, whose start runs migration 5; `deploy` uploads the web build only, unchanged here). Migration 5 is a function (a migration can now be SQL or code, run in the same transaction): it creates `readings` as specified, moves every book whose status isn't `unread` or whose rating isn't null to one row for the earliest-created owner (ties by id; the row's `updated_at` is the book's), then drops `books.status` and `books.rating` with `ALTER TABLE ... DROP COLUMN`. With something to move it throws, naming the count and the problem, when `auth_users` is missing or holds no owner, and the whole step rolls back (version 4, both columns, no `readings`). A fresh database has no books and never reads `auth_users`. The readings live in `server/src/features/books/readings.ts` beside the store, a factory returning an interface like the store and not exported from the feature's index (the store would have passed 400 lines, code-structure rule 11's limit, which says to split by sub-domain); the store reads the caller's own with the book through a `LEFT JOIN` and the others through one statement, so the list is three statements, not two. The reader is a trailing argument: required for `patch` and `bulk`, optional for `list`, `get`, `findByIsbn` and `create`, so the covers and lookup features and their tests are untouched; read as nobody, every reading is in `readers` (`check-stored-replies.ts` checks them all that way, unchanged). The routes take `request.auth.user.id`.

**Deviation: "admin" is the `owner` role.** Shelfmark has no admin role: the seed and Sign in with Ward give every account `owner`, the only role. The migration picks the earliest-created `owner`; the role is written out in the migration, not imported. Asked on the board: if the owner has a local account and a separate one a first Ward sign-in made, everything goes to the older.

**Forced web edit:** the four web test fixtures that build a whole `Book` (`web/src/api.test.ts`, `web/src/add/flow.test.ts`, `web/src/books/store.test.ts`, `web/src/library/test-books.ts`) gained `readers: []`. No app code in `web/` changed.

**Tests** (store and migration level, nothing boots the app): the move to the earliest owner with a tie, the refusal with no accounts table and with no owner (database unchanged), the no-op on a fresh database, the readings CHECKs and cascade; two readers on one book each seeing their own and the other in `readers`, a rename showing at once, a reading whose account has no row left out; a bulk status change touching only the caller's rows and no book's `updatedAt`; back to `unread` with no rating deleting the row. The accounts tables in the tests are the vendored library's own (`createSqliteStore`), the users written straight in.

**Checks:** `npm run check` exit 0 (905 tests). By hand on a scratch data folder, never the real database: a version-4 database with statuses and one owner, a second account seeded (which ran the migration: both statuses went to the older account, the columns gone), then the server on a scratch port and the routes over HTTP as both accounts: each `GET /api/books` showed the caller's own and the other in `readers`; `PATCH` and `POST` as one and the bulk change as the other wrote only their own rows, with the book's `updatedAt` unchanged; back to unread deleted the row; no session answered 401. The walk was repeated on the final code (after the move to `readings.ts`), on a fresh scratch database, with the same results and no `status` or `rating` column left on `books`. `check-stored-replies.ts` on a copy of the version-4 database: exit 0. Not run: the deploy and `docker build`.
