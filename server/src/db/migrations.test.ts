import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { createSqliteStore } from "../../vendor/ward/ward-auth.js";
import { migrate, migrations } from "./migrations.js";
import { databasePath, openDb, type Db } from "./open.js";

const opened: Db[] = [];
const dirs: string[] = [];
afterEach(() => {
  for (const db of opened.splice(0)) db.close();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "shelfmark-db-"));
  dirs.push(dir);
  return dir;
}

function open(path = ":memory:"): Db {
  const db = openDb(path);
  opened.push(db);
  return db;
}

const version = (db: Database.Database) => db.pragma("user_version", { simple: true });

function tables(db: Database.Database): string[] {
  return db
    .prepare<[], { name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all()
    .map((row) => row.name);
}

const NOW = "2026-10-14T09:00:00.000Z";

function insertBook(db: Db, title: string, isbn13: string | null = null): number {
  const result = db
    .prepare("INSERT INTO books (title, isbn13, created_at, updated_at) VALUES (?, ?, ?, ?)")
    .run(title, isbn13, NOW, NOW);
  return Number(result.lastInsertRowid);
}

describe("openDb", () => {
  it("creates <dataDir>/shelfmark.db, its directory included, in WAL mode with foreign keys on", () => {
    const dataDir = join(tempDir(), "nested", "data");
    const db = open(databasePath(dataDir));
    expect(existsSync(join(dataDir, "shelfmark.db"))).toBe(true);
    expect(db.pragma("journal_mode", { simple: true })).toBe("wal");
    expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
    expect(version(db)).toBe(migrations.length);
    expect(tables(db)).toEqual([
      "book_tags",
      "books",
      "catalog_query_cache",
      "covers",
      "lookup_cache",
      "readings",
      "recommendation_dismissals",
      "recommendations",
      "saved_views",
      "tags",
    ]);
  });

  it("leaves a migrated database as it is on the next open", () => {
    const path = databasePath(tempDir());
    const first = openDb(path);
    insertBook(first, "Solenoid");
    first.close();

    const again = open(path);
    expect(version(again)).toBe(migrations.length);
    expect(again.prepare("SELECT title FROM books").all()).toEqual([{ title: "Solenoid" }]);
  });
});

describe("migrate", () => {
  it("applies only the migrations after the current version, in order", () => {
    const db = new Database(":memory:");
    migrate(db, ["CREATE TABLE a (x)"]);
    expect(version(db)).toBe(1);
    migrate(db, ["CREATE TABLE a (x)", "CREATE TABLE b (x)", "ALTER TABLE b ADD COLUMN y"]);
    expect(version(db)).toBe(3);
    expect(tables(db)).toEqual(["a", "b"]);
    db.close();
  });

  it("rolls a failing migration back whole and keeps the version", () => {
    const db = new Database(":memory:");
    expect(() => migrate(db, ["CREATE TABLE a (x)", "CREATE TABLE b (x); CREATE TABLE a (x)"])).toThrow();
    expect(version(db)).toBe(1);
    expect(tables(db)).toEqual(["a"]);
    db.close();
  });

  it("refuses a database newer than this server", () => {
    const db = new Database(":memory:");
    db.pragma("user_version = 5");
    expect(() => migrate(db, ["CREATE TABLE a (x)"])).toThrow(/schema version 5.*only knows 1/);
    db.close();
  });
});

describe("migration 1", () => {
  it("defaults a book to owned, unsigned, RON, manual, with empty lists", () => {
    const db = open();
    const id = insertBook(db, "Solenoid");
    expect(
      db
        .prepare("SELECT collection, signed, currency, metadata_source, authors, subjects FROM books WHERE id = ?")
        .get(id),
    ).toEqual({
      collection: "owned",
      signed: 0,
      currency: "RON",
      metadata_source: "manual",
      authors: "[]",
      subjects: "[]",
    });
  });

  it("allows two copies with one ISBN, and refuses a malformed one", () => {
    const db = open();
    insertBook(db, "Solenoid", "9789734647262");
    insertBook(db, "Solenoid", "9789734647262");
    expect(db.prepare("SELECT count(*) AS n FROM books WHERE isbn13 = '9789734647262'").get()).toEqual({ n: 2 });
    expect(() => insertBook(db, "Bad", "978-973-46-4726-2")).toThrow(/CHECK/);
  });

  it("refuses values outside the settled vocabularies", () => {
    const db = open();
    const id = insertBook(db, "Solenoid");
    for (const sql of [
      "UPDATE books SET collection = 'loaned' WHERE id = ?",
      "UPDATE books SET format = 'ebook' WHERE id = ?",
      "UPDATE books SET condition = 'mint' WHERE id = ?",
      "UPDATE books SET authors = 'Cărtărescu' WHERE id = ?",
    ]) {
      expect(() => db.prepare(sql).run(id), sql).toThrow(/CHECK/);
    }
  });

  it("deletes a book's cover and tag links with the book", () => {
    const db = open();
    const id = insertBook(db, "Solenoid");
    const tagId = Number(
      db.prepare("INSERT INTO tags (name, name_key) VALUES ('Romanian', 'romanian')").run().lastInsertRowid,
    );
    db.prepare("INSERT INTO book_tags (book_id, tag_id) VALUES (?, ?)").run(id, tagId);
    db.prepare(
      "INSERT INTO covers (book_id, mime, bytes, source, updated_at) VALUES (?, 'image/jpeg', ?, 'upload', ?)",
    ).run(id, Buffer.from([0xff, 0xd8, 0xff]), NOW);

    db.prepare("DELETE FROM books WHERE id = ?").run(id);

    expect(db.prepare("SELECT count(*) AS n FROM covers").get()).toEqual({ n: 0 });
    expect(db.prepare("SELECT count(*) AS n FROM book_tags").get()).toEqual({ n: 0 });
  });

  it("matches tag names on name_key only", () => {
    const db = open();
    db.prepare("INSERT INTO tags (name, name_key) VALUES ('Știință', 'știință')").run();
    expect(() => db.prepare("INSERT INTO tags (name, name_key) VALUES ('știință', 'știință')").run()).toThrow(/UNIQUE/);
  });
});

describe("migration 5", () => {
  const columns = (db: Database.Database) =>
    db
      .prepare<[], { name: string }>("SELECT name FROM pragma_table_info('books')")
      .all()
      .map((row) => row.name);
  const readings = (db: Database.Database) =>
    db.prepare("SELECT book_id AS book, user_id AS user, status, rating, updated_at AS at FROM readings").all();

  /** A database as the server before this migration left it: books with a status and a rating. */
  function atVersion4(): Database.Database {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    migrate(db, migrations.slice(0, 4));
    const insert = db.prepare(
      "INSERT INTO books (title, status, rating, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    );
    insert.run("Reading", "reading", null, NOW, "2026-11-01T10:00:00.000Z");
    insert.run("Rated", "unread", 4, NOW, NOW);
    insert.run("Untouched", "unread", null, NOW, NOW);
    return db;
  }

  /** The accounts library's tables, with these accounts as `[id, role, created_at]`. */
  function addAccounts(db: Database.Database, accounts: [string, string, number][]): void {
    createSqliteStore(db);
    for (const [id, role, createdAt] of accounts) {
      db.prepare(
        "INSERT INTO auth_users (id, username, username_folded, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).run(id, id, id, role, createdAt, createdAt);
    }
  }

  it("gives every status and rating to the earliest-created owner, then drops the columns", () => {
    const db = atVersion4();
    addAccounts(db, [
      ["later", "owner", 300],
      ["tie-b", "owner", 200],
      ["tie-a", "owner", 200],
    ]);
    migrate(db);

    expect(version(db)).toBe(migrations.length);
    expect(readings(db)).toEqual([
      { book: 1, user: "tie-a", status: "reading", rating: null, at: "2026-11-01T10:00:00.000Z" },
      { book: 2, user: "tie-a", status: "unread", rating: 4, at: NOW },
    ]);
    expect(columns(db)).not.toContain("status");
    expect(columns(db)).not.toContain("rating");
    expect(db.prepare("SELECT count(*) AS n FROM books").get()).toEqual({ n: 3 });
    db.close();
  });

  it("refuses, changing nothing, when there is something to move and no owner to take it", () => {
    for (const accounts of [undefined, []] as const) {
      const db = atVersion4();
      if (accounts) addAccounts(db, [...accounts]);
      expect(() => migrate(db)).toThrow(
        accounts ? /2 books have .*no account with the owner role/ : /2 books have .*no auth_users table/,
      );
      expect(version(db)).toBe(4);
      expect(columns(db)).toEqual(expect.arrayContaining(["status", "rating"]));
      expect(tables(db)).not.toContain("readings");
      db.close();
    }
  });

  it("gives them to the account SHELFMARK_READINGS_TO names, matched as sign-in folds it", () => {
    const db = atVersion4();
    addAccounts(db, [
      ["first", "owner", 100],
      ["acasa", "owner", 300],
    ]);
    migrate(db, undefined, { readingsTo: "ACASA" });
    expect(readings(db)).toEqual([
      expect.objectContaining({ book: 1, user: "acasa" }),
      expect.objectContaining({ book: 2, user: "acasa" }),
    ]);
    db.close();
  });

  it("refuses, changing nothing, when SHELFMARK_READINGS_TO names no account", () => {
    const db = atVersion4();
    addAccounts(db, [["first", "owner", 100]]);
    expect(() => migrate(db, undefined, { readingsTo: "acsa" })).toThrow(
      /2 books have .*"acsa".*no account has that username/,
    );
    expect(version(db)).toBe(4);
    expect(columns(db)).toEqual(expect.arrayContaining(["status", "rating"]));
    db.close();
  });

  it("moves nothing on a fresh database, which has no accounts yet", () => {
    const db = open();
    expect(readings(db)).toEqual([]);
    expect(columns(db)).not.toContain("status");
  });

  it("keeps a reading's status and rating in their vocabularies, and deletes it with its book", () => {
    const db = open();
    const id = insertBook(db, "Solenoid");
    const insert = db.prepare(
      "INSERT INTO readings (book_id, user_id, status, rating, updated_at) VALUES (?, ?, ?, ?, ?)",
    );
    expect(() => insert.run(id, "u", "finished", null, NOW)).toThrow(/CHECK/);
    expect(() => insert.run(id, "u", "read", 6, NOW)).toThrow(/CHECK/);
    insert.run(id, "u", "read", 5, NOW);
    db.prepare("DELETE FROM books WHERE id = ?").run(id);
    expect(readings(db)).toEqual([]);
  });
});

describe("migration 3", () => {
  const insertView = (db: Db, name: string, key: string, state: string, position = 0) =>
    db
      .prepare(
        "INSERT INTO saved_views (name, name_key, state, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(name, key, state, position, NOW, NOW);

  it("keeps a view's name unique on its folded key", () => {
    const db = open();
    insertView(db, "Unread", "unread", "{}");
    expect(() => insertView(db, "unread", "unread", "{}", 1)).toThrow(/UNIQUE/);
  });

  it("refuses a state that is not a JSON object, a blank name and a negative position", () => {
    const db = open();
    expect(() => insertView(db, "A", "a", "not json")).toThrow(/CHECK/);
    expect(() => insertView(db, "A", "a", "[]")).toThrow(/CHECK/);
    expect(() => insertView(db, "", "", "{}")).toThrow(/CHECK/);
    expect(() => insertView(db, "A", "a", "{}", -1)).toThrow(/CHECK/);
  });
});
