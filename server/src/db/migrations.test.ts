import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
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
    expect(tables(db)).toEqual(["book_tags", "books", "covers", "tags"]);
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
  it("defaults a book to owned, unread, unsigned, RON, manual, with empty lists", () => {
    const db = open();
    const id = insertBook(db, "Solenoid");
    expect(
      db
        .prepare("SELECT collection, status, signed, currency, metadata_source, authors, subjects FROM books WHERE id = ?")
        .get(id),
    ).toEqual({
      collection: "owned",
      status: "unread",
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
      "UPDATE books SET status = 'finished' WHERE id = ?",
      "UPDATE books SET format = 'ebook' WHERE id = ?",
      "UPDATE books SET condition = 'mint' WHERE id = ?",
      "UPDATE books SET rating = 6 WHERE id = ?",
      "UPDATE books SET authors = 'Cărtărescu' WHERE id = ?",
    ]) {
      expect(() => db.prepare(sql).run(id), sql).toThrow(/CHECK/);
    }
  });

  it("deletes a book's cover and tag links with the book", () => {
    const db = open();
    const id = insertBook(db, "Solenoid");
    const tagId = Number(db.prepare("INSERT INTO tags (name, name_key) VALUES ('Romanian', 'romanian')").run().lastInsertRowid);
    db.prepare("INSERT INTO book_tags (book_id, tag_id) VALUES (?, ?)").run(id, tagId);
    db.prepare("INSERT INTO covers (book_id, mime, bytes, source, updated_at) VALUES (?, 'image/jpeg', ?, 'upload', ?)").run(
      id,
      Buffer.from([0xff, 0xd8, 0xff]),
      NOW,
    );

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
