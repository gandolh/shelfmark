import type { Database } from "better-sqlite3";

/** One migration: SQL, or a step that needs code (a check that can refuse, data moved by a rule). */
type Migration = string | ((db: Database) => void);

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
export const migrations: readonly Migration[] = [
  // 1: books, tags and covers.
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

  // 2: the lookup cache, one raw answer per ISBN and source.
  // `outcome` is what expiry needs (lookup/cache.ts: found kept forever,
  // not_found 7 days) without parsing each source's format; errors are never
  // stored. `source` has no CHECK, as the list of sources may grow.
  `
  CREATE TABLE lookup_cache (
    isbn13      TEXT NOT NULL,
    source      TEXT NOT NULL,
    outcome     TEXT NOT NULL CHECK (outcome IN ('found', 'not_found')),
    response    TEXT NOT NULL CHECK (json_valid(response)),
    fetched_at  TEXT NOT NULL,
    PRIMARY KEY (isbn13, source)
  ) WITHOUT ROWID;
  `,

  // 3: saved views, the Library's filters, sort, columns and tab
  // under a name. `state` is the shared SavedViewState as JSON, checked by
  // the shared schema on the way in and read leniently on the way out
  // (features/views/store.ts). `name_key` is the name folded to lower case in JS, as
  // tags' is, so "Unread" and "unread" can't be two views. `position` is the
  // view's place in the Views menu, 0 first, kept dense by the store.
  `
  CREATE TABLE saved_views (
    id          INTEGER PRIMARY KEY,
    name        TEXT NOT NULL CHECK (name <> ''),
    name_key    TEXT NOT NULL UNIQUE,
    state       TEXT NOT NULL CHECK (json_valid(state) AND json_type(state) = 'object'),
    position    INTEGER NOT NULL CHECK (position >= 0),
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );
  `,

  // 4: recommendations (brief 04). `recommendations` is the last list only:
  // a refresh replaces the list of its source in one transaction, an import
  // appends. `key` is the work's Open Library key, else the title key.
  // `recommendation_dismissals` keeps a "Not interested" for good, by work
  // key and by title key (one row each, `kind` says which). `catalog_query_cache`
  // keeps each catalog answer by its URL for 30 days (features/recommendations/cache.ts).
  `
  CREATE TABLE recommendations (
    key           TEXT PRIMARY KEY,
    title         TEXT NOT NULL,
    authors       TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(authors) AND json_type(authors) = 'array'),
    year          INTEGER,
    language      TEXT,
    cover_url     TEXT,
    isbn13        TEXT,
    isbns         TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(isbns) AND json_type(isbns) = 'array'),
    title_key     TEXT NOT NULL,
    reasons       TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(reasons) AND json_type(reasons) = 'array'),
    source        TEXT NOT NULL,
    score         REAL NOT NULL DEFAULT 0,
    refreshed_at  TEXT NOT NULL
  );

  CREATE TABLE recommendation_dismissals (
    key           TEXT NOT NULL,
    kind          TEXT NOT NULL CHECK (kind IN ('work', 'title')),
    dismissed_at  TEXT NOT NULL,
    PRIMARY KEY (key, kind)
  ) WITHOUT ROWID;

  CREATE TABLE catalog_query_cache (
    url         TEXT PRIMARY KEY,
    response    TEXT NOT NULL CHECK (json_valid(response)),
    fetched_at  TEXT NOT NULL
  ) WITHOUT ROWID;
  `,

  // 5: each reader their own status and rating. A `readings` row is
  // one person's status and rating on one book, kept only while it says
  // something: `unread` with no rating is no row. `user_id` is an `auth_users`
  // id with no foreign key: that table is the accounts library's, made after
  // these migrations on a fresh database, and no user is ever deleted.
  // The statuses and ratings stored on `books` move to the earliest-created
  // owner account, then their columns go.
  (db) => {
    db.exec(`
      CREATE TABLE readings (
        book_id     INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        user_id     TEXT NOT NULL,
        status      TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'reading', 'read', 'abandoned')),
        rating      INTEGER CHECK (rating BETWEEN 1 AND 5),
        updated_at  TEXT NOT NULL,
        PRIMARY KEY (book_id, user_id)
      );
    `);
    const SAYS_SOMETHING = "status <> 'unread' OR rating IS NOT NULL";
    const toMove =
      db.prepare<[], { n: number }>(`SELECT count(*) AS n FROM books WHERE ${SAYS_SOMETHING}`).get()?.n ?? 0;
    if (toMove > 0) {
      const owner = earliestOwner(db, toMove);
      // The book's updated_at is the latest the status can have been set: the migration's own time would be a guess.
      db.prepare(
        `INSERT INTO readings (book_id, user_id, status, rating, updated_at)
         SELECT id, ?, status, rating, updated_at FROM books WHERE ${SAYS_SOMETHING}`,
      ).run(owner);
    }
    db.exec("ALTER TABLE books DROP COLUMN status; ALTER TABLE books DROP COLUMN rating;");
  },
];

/**
 * The id of the account the books' statuses and ratings move to: the
 * earliest-created with the `owner` role (Shelfmark's only role, the seed's
 * and Sign in with Ward's), ties by id. The role is written out, not imported:
 * a shipped migration never changes. Throws, naming the problem, when there is
 * none, so a status is never dropped.
 */
function earliestOwner(db: Database, books: number): string {
  const what = `${books} ${books === 1 ? "book has" : "books have"} a status or a rating to move to the owner's account`;
  const accounts = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'auth_users'").get();
  if (accounts === undefined) {
    throw new Error(`Migration 5: ${what}, but the database has no accounts (no auth_users table).`);
  }
  const owner = db
    .prepare<[], { id: string }>("SELECT id FROM auth_users WHERE role = 'owner' ORDER BY created_at, id LIMIT 1")
    .get();
  if (owner === undefined) {
    throw new Error(`Migration 5: ${what}, but auth_users has no account with the owner role.`);
  }
  return owner.id;
}

/** Brings the schema up to `list.length`, tracked in `PRAGMA user_version`. */
export function migrate(db: Database, list: readonly Migration[] = migrations): void {
  const current = db.pragma("user_version", { simple: true }) as number;
  if (current > list.length) {
    throw new Error(
      `The database is at schema version ${current}, but this server only knows ${list.length}. Run a newer server.`,
    );
  }
  list.slice(current).forEach((step, index) => {
    const version = current + index + 1;
    db.transaction(() => {
      if (typeof step === "string") db.exec(step);
      else step(db);
      db.pragma(`user_version = ${version}`);
    })();
  });
}
