import type { Book, BookCreate, BookPatch, Reader, Status } from "@shelfmark/shared";
import type { Db } from "../../db/open.js";

/**
 * The readings: each person's own status and rating on a book, one
 * `readings` row per book and account, kept only while it says something
 * (`unread` with no rating is no row). The books store reads the caller's own
 * with the book (`OWN_READING_JOIN`) and everyone else's through `readers`;
 * this is the only module that writes the table. A written reading never
 * touches the book's own row or its `updatedAt`.
 */

/** One person's own on one book: a `readings` row, or `NO_READING` without one. */
export type Reading = Pick<Book, "status" | "rating">;

/** What a reading is without a row, and what a `null` status or rating turns back into. */
const NO_READING: Reading = { status: "unread", rating: null };

/**
 * The SQL that puts the reader's own status and rating on a select of books
 * `b`: `@reader` is the account id, or `null` to read as nobody.
 */
export const OWN_READING = {
  columns: `coalesce(r.status, '${NO_READING.status}') AS status, r.rating AS rating`,
  join: "LEFT JOIN readings r ON r.book_id = b.id AND r.user_id = @reader",
};

/** A reader as the statements return them, with the book they read. */
type ReaderRow = Reader & { bookId: number };

/** The reading a create or patch sets, `null` turned into `NO_READING`'s value. */
export function settleReading(values: BookCreate | BookPatch): Partial<Reading> {
  const out: Partial<Reading> = {};
  if (values.status !== undefined) out.status = values.status ?? NO_READING.status;
  if (values.rating !== undefined) out.rating = values.rating ?? NO_READING.rating;
  return out;
}

/** Whether a reading would be a row: anything but `NO_READING`. */
export function saysSomething(reading: Partial<Reading>): boolean {
  return (
    (reading.status ?? NO_READING.status) !== NO_READING.status ||
    (reading.rating ?? NO_READING.rating) !== NO_READING.rating
  );
}

export interface ReadingStore {
  /** Everyone but `reader` with a reading, by book, each book's by username: on every book, or on those `ids` names. */
  readers(reader: string | undefined, ids?: readonly number[]): Map<number, Reader[]>;
  /** Changes the reader's own status or rating on one book. A row whose values don't change keeps its time. */
  set(book: number, reader: string, changes: Partial<Reading>, at: string): void;
  /** Sets the reader's own status on many books, keeping each rating. */
  setStatuses(ids: readonly number[], reader: string, status: Status, at: string): void;
}

// A list of books is one JSON array parameter, read with json_each.
const IDS = "SELECT value FROM json_each(@ids)";

// Everyone but the reader. The inner join leaves out a reading whose account has no row.
const SELECT_READERS = `
  SELECT r.book_id AS bookId, r.user_id AS userId, u.username AS username,
         r.status AS status, r.rating AS rating, r.updated_at AS updatedAt
  FROM readings r JOIN auth_users u ON u.id = r.user_id
  WHERE r.user_id IS NOT @reader`;
const READERS_ORDER = "ORDER BY u.username_folded, r.user_id";

export function createReadingStore(db: Db): ReadingStore {
  const readingOf = db.prepare<[{ book: number; reader: string }], Reading>(
    "SELECT status, rating FROM readings WHERE book_id = @book AND user_id = @reader",
  );
  const upsert = db.prepare<[{ book: number; reader: string; at: string } & Reading]>(`
    INSERT INTO readings (book_id, user_id, status, rating, updated_at) VALUES (@book, @reader, @status, @rating, @at)
    ON CONFLICT (book_id, user_id) DO UPDATE
    SET status = excluded.status, rating = excluded.rating, updated_at = excluded.updated_at`);
  const remove = db.prepare<[{ book: number; reader: string }]>(
    "DELETE FROM readings WHERE book_id = @book AND user_id = @reader",
  );
  // `WHERE true` keeps SQLite from reading the upsert's ON as a join's.
  const upsertStatuses = db.prepare<[{ ids: string; reader: string; status: string; at: string }]>(`
    INSERT INTO readings (book_id, user_id, status, updated_at)
    SELECT value, @reader, @status, @at FROM json_each(@ids) WHERE true
    ON CONFLICT (book_id, user_id) DO UPDATE
    SET status = excluded.status, updated_at = excluded.updated_at WHERE readings.status <> excluded.status`);
  const removeEmpty = db.prepare<[{ ids: string; reader: string }]>(
    `DELETE FROM readings WHERE user_id = @reader AND book_id IN (${IDS})
     AND status = '${NO_READING.status}' AND rating IS NULL`,
  );

  // `auth_users` is the accounts library's table, made when the app opens its accounts, after the migrations. So
  // the readers' statements are prepared on first use, and a database without it (a test with no accounts) has
  // no readers to show.
  const hasAccounts = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'auth_users'");
  const prepareReaders = () => ({
    all: db.prepare<[{ reader: string | null }], ReaderRow>(`${SELECT_READERS} ${READERS_ORDER}`),
    of: db.prepare<[{ ids: string; reader: string | null }], ReaderRow>(
      `${SELECT_READERS} AND r.book_id IN (${IDS}) ${READERS_ORDER}`,
    ),
  });
  let readerStatements: ReturnType<typeof prepareReaders> | undefined;

  return {
    readers(reader, ids) {
      readerStatements ??= hasAccounts.get() === undefined ? undefined : prepareReaders();
      const byBook = new Map<number, Reader[]>();
      if (!readerStatements) return byBook;
      const param = { reader: reader ?? null };
      const rows =
        ids === undefined
          ? readerStatements.all.all(param)
          : readerStatements.of.all({ ...param, ids: JSON.stringify(ids) });
      for (const { bookId, ...other } of rows) {
        const readers = byBook.get(bookId);
        if (readers) readers.push(other);
        else byBook.set(bookId, [other]);
      }
      return byBook;
    },

    set(book, reader, changes, at) {
      const current = readingOf.get({ book, reader }) ?? NO_READING;
      const next: Reading = { ...current, ...changes };
      if (next.status === current.status && next.rating === current.rating) return;
      if (saysSomething(next)) upsert.run({ book, reader, ...next, at });
      else remove.run({ book, reader });
    },

    setStatuses(ids, reader, status, at) {
      const param = JSON.stringify(ids);
      upsertStatuses.run({ ids: param, reader, status, at });
      removeEmpty.run({ ids: param, reader });
    },
  };
}
