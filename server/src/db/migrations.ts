import type { Database } from "better-sqlite3";

/**
 * Applied in order on boot, each in its own transaction, tracked in
 * `PRAGMA user_version`. Never edit a shipped entry; append a new one with a
 * comment naming its brief.
 *
 * CHECKs hold the settled vocabularies (glossary.md). `metadata_source` and
 * `currency` have none on purpose: SQLite can't alter a CHECK without
 * rebuilding the table, and those lists may grow. The shared schemas guard
 * them on the way in.
 */
export const migrations: readonly string[] = [
  // 1 (brief 02): books, tags and covers.
  `
  CREATE TABLE books (
    id               INTEGER PRIMARY KEY,
    isbn13           TEXT CHECK (isbn13 GLOB '97[89][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
    barcode          TEXT,
    title            TEXT NOT NULL CHECK (title <> ''),
    subtitle         TEXT,
    authors          TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(authors) AND json_type(authors) = 'array'),
    author_sort      TEXT,
    publisher        TEXT,
    published_year   INTEGER,
    pages            INTEGER CHECK (pages > 0),
    language         TEXT,
    series           TEXT,
    series_number    TEXT,
    description      TEXT,
    subjects         TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(subjects) AND json_type(subjects) = 'array'),
    collection       TEXT NOT NULL DEFAULT 'owned' CHECK (collection IN ('owned', 'wishlist')),
    format           TEXT CHECK (format IN ('hardcover', 'paperback', 'other')),
    condition        TEXT CHECK (condition IN ('new', 'good', 'worn', 'damaged')),
    shelf            TEXT,
    signed           INTEGER NOT NULL DEFAULT 0 CHECK (signed IN (0, 1)),
    status           TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'reading', 'read', 'abandoned')),
    rating           INTEGER CHECK (rating BETWEEN 1 AND 5),
    notes            TEXT,
    acquired_on      TEXT,
    acquired_from    TEXT,
    price_minor      INTEGER CHECK (price_minor >= 0),
    currency         TEXT NOT NULL DEFAULT 'RON',
    metadata_source  TEXT NOT NULL DEFAULT 'manual',
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL
  );
  -- Not unique: two copies of one book are two rows.
  CREATE INDEX books_by_isbn13 ON books(isbn13);

  -- name_key is the name folded to lower case in JS: SQLite's NOCASE folds
  -- ASCII only, so it would let "Știință" and "știință" be two tags.
  CREATE TABLE tags (
    id        INTEGER PRIMARY KEY,
    name      TEXT NOT NULL,
    name_key  TEXT NOT NULL UNIQUE
  );

  CREATE TABLE book_tags (
    book_id  INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    tag_id   INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (book_id, tag_id)
  );
  CREATE INDEX book_tags_by_tag ON book_tags(tag_id);

  CREATE TABLE covers (
    book_id     INTEGER PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,
    mime        TEXT NOT NULL,
    bytes       BLOB NOT NULL,
    source      TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );
  `,
];

/** Brings the schema up to `list.length`, tracked in `PRAGMA user_version`. */
export function migrate(db: Database, list: readonly string[] = migrations): void {
  const current = db.pragma("user_version", { simple: true }) as number;
  if (current > list.length) {
    throw new Error(
      `The database is at schema version ${current}, but this server only knows ${list.length}. Run a newer server.`,
    );
  }
  list.slice(current).forEach((sql, index) => {
    const version = current + index + 1;
    db.transaction(() => {
      db.exec(sql);
      db.pragma(`user_version = ${version}`);
    })();
  });
}
