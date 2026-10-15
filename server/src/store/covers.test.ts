import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "../db/open.js";
import { imageBytes } from "../testing/fakeFetch.js";
import { createBookStore, type BookStore } from "./books.js";
import { createCoverStore, type CoverStore } from "./covers.js";

let db: Db;
let books: BookStore;
let covers: CoverStore;
let clock: Date;

beforeEach(() => {
  db = openDb(":memory:");
  books = createBookStore(db);
  clock = new Date("2026-10-15T08:00:00.000Z");
  covers = createCoverStore(db, () => clock);
});

afterEach(() => {
  db.close();
});

describe("createCoverStore", () => {
  it("stores, gives back and replaces a book's cover", () => {
    const book = books.create({ title: "Solenoid" });
    expect(covers.get(book.id)).toBeUndefined();

    const jpeg = imageBytes("image/jpeg", 3000);
    expect(covers.put(book.id, { mime: "image/jpeg", bytes: jpeg, source: "openlibrary" })).toEqual({
      mime: "image/jpeg",
      size: 3000,
      source: "openlibrary",
      updatedAt: "2026-10-15T08:00:00.000Z",
    });
    expect(covers.get(book.id)).toEqual({
      mime: "image/jpeg",
      bytes: jpeg,
      source: "openlibrary",
      updatedAt: "2026-10-15T08:00:00.000Z",
    });

    clock = new Date("2026-10-16T08:00:00.000Z");
    const png = imageBytes("image/png", 500);
    covers.put(book.id, { mime: "image/png", bytes: png, source: "upload" });
    expect(covers.get(book.id)).toEqual({ mime: "image/png", bytes: png, source: "upload", updatedAt: clock.toISOString() });
    expect(db.prepare("SELECT COUNT(*) AS n FROM covers").get()).toEqual({ n: 1 });
  });

  it("makes the book's hasCover true, and false again once removed", () => {
    const book = books.create({ title: "Orbitor" });
    expect(books.get(book.id)?.hasCover).toBe(false);
    covers.put(book.id, { mime: "image/webp", bytes: imageBytes("image/webp"), source: "upload" });
    expect(books.get(book.id)?.hasCover).toBe(true);
    expect(covers.remove(book.id)).toBe(true);
    expect(covers.remove(book.id)).toBe(false);
    expect(books.get(book.id)?.hasCover).toBe(false);
  });

  it("goes with its book", () => {
    const book = books.create({ title: "Levantul" });
    covers.put(book.id, { mime: "image/jpeg", bytes: imageBytes("image/jpeg"), source: "upload" });
    books.remove(book.id);
    expect(covers.get(book.id)).toBeUndefined();
  });

  it("refuses a cover for a book that doesn't exist", () => {
    expect(() => covers.put(999, { mime: "image/jpeg", bytes: imageBytes("image/jpeg"), source: "upload" })).toThrow(
      /FOREIGN KEY/,
    );
  });
});
