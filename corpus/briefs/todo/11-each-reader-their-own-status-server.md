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

## Outcome
