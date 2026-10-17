import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";
import { migrate } from "../db/migrations.js";
import type { Issue } from "./issues.js";
import type { CipRecord } from "./parse.js";

/**
 * The CIP index: `<dataDir>/cip.db`, a database of its own rather than
 * tables in shelfmark.db. It is public data the refresh can fetch again
 * (about 55 MB for 2019-2026), so the owner's backup, which is shelfmark.db
 * alone, stays small. One row per ISBN; a later issue's record replaces an
 * earlier one's.
 */

export const CIP_DB_FILE_NAME = "cip.db";

export function cipDatabasePath(dataDir: string): string {
  return join(dataDir, CIP_DB_FILE_NAME);
}

const CIP_MIGRATIONS = [
  `
  CREATE TABLE cip_issues (
    month        TEXT PRIMARY KEY CHECK (month GLOB '20[0-9][0-9]-[01][0-9]'),
    url          TEXT NOT NULL,
    imported_at  TEXT NOT NULL,
    records      INTEGER NOT NULL CHECK (records >= 0)
  ) WITHOUT ROWID;

  CREATE TABLE cip_records (
    isbn13     TEXT PRIMARY KEY CHECK (isbn13 GLOB '97[89][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
    month      TEXT NOT NULL,
    entry      INTEGER NOT NULL,
    title      TEXT NOT NULL,
    subtitle   TEXT,
    authors    TEXT NOT NULL CHECK (json_valid(authors) AND json_type(authors) = 'array'),
    publisher  TEXT,
    city       TEXT,
    year       INTEGER
  ) WITHOUT ROWID;
  `,
];

/** A record as stored, with the issue it came from. */
export interface CipRow extends CipRecord {
  month: string;
}

export interface CipStore {
  get(isbn13: string): CipRow | undefined;
  /** The months already imported. */
  importedMonths(): Set<string>;
  /** Stores an issue's records and marks it imported, in one transaction. */
  importIssue(issue: Issue, records: readonly CipRecord[], now?: Date): void;
  /** How many ISBNs the index holds. */
  size(): number;
  close(): void;
}

interface Row {
  isbn13: string;
  month: string;
  entry: number;
  title: string;
  subtitle: string | null;
  authors: string;
  publisher: string | null;
  city: string | null;
  year: number | null;
}

/** Opens (creating it if needed) the index. `:memory:` gives a private in-memory one. */
export function openCipStore(path: string): CipStore {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  try {
    db.pragma("journal_mode = WAL");
    db.pragma("busy_timeout = 5000");
    migrate(db, CIP_MIGRATIONS);
  } catch (err) {
    db.close();
    throw err;
  }

  const select = db.prepare<[string], Row>("SELECT * FROM cip_records WHERE isbn13 = ?");
  const months = db.prepare<[], { month: string }>("SELECT month FROM cip_issues");
  const count = db.prepare<[], { n: number }>("SELECT COUNT(*) AS n FROM cip_records");
  // The later issue wins, whatever order the issues are imported in.
  const upsert = db.prepare(`
    INSERT INTO cip_records (isbn13, month, entry, title, subtitle, authors, publisher, city, year)
    VALUES (@isbn13, @month, @entry, @title, @subtitle, @authors, @publisher, @city, @year)
    ON CONFLICT (isbn13) DO UPDATE SET
      month = excluded.month, entry = excluded.entry, title = excluded.title, subtitle = excluded.subtitle,
      authors = excluded.authors, publisher = excluded.publisher, city = excluded.city, year = excluded.year
    WHERE excluded.month >= cip_records.month`);
  const markImported = db.prepare(`
    INSERT INTO cip_issues (month, url, imported_at, records) VALUES (?, ?, ?, ?)
    ON CONFLICT (month) DO UPDATE SET url = excluded.url, imported_at = excluded.imported_at, records = excluded.records`);

  const importIssue = db.transaction((issue: Issue, records: readonly CipRecord[], now: Date) => {
    for (const r of records) upsert.run({ ...r, month: issue.month, authors: JSON.stringify(r.authors) });
    markImported.run(issue.month, issue.url, now.toISOString(), records.length);
  });

  return {
    get(isbn13) {
      const row = select.get(isbn13);
      return row && { ...row, authors: JSON.parse(row.authors) as string[] };
    },
    importedMonths: () => new Set(months.all().map((row) => row.month)),
    importIssue: (issue, records, now = new Date()) => importIssue(issue, records, now),
    size: () => count.get()!.n,
    close: () => db.close(),
  };
}
