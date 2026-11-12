import { bookBulkResultSchema, bookCreateSchema, bookListSchema, bookSchema } from "@shelfmark/shared";
import { isDeepStrictEqual } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "../../db/open.js";
import { serializationFailure, serialize } from "../../testing/serialize.js";
import { createBookStore, type BookStore } from "./store.js";

let db: Db;
let store: BookStore;

beforeEach(() => {
  db = openDb(":memory:");
  store = createBookStore(db, () => new Date("2026-11-12T08:00:00.000Z"));
});

afterEach(() => {
  db.close();
});

/** A book as the form sends it, through the request schema, then stored: the way a row is really made. */
const create = (input: Record<string, unknown>) => store.create(bookCreateSchema.parse(input));

/** The serialised reply holds the same JSON as the body it was made from. */
const sameJson = (serialized: string, body: unknown) =>
  isDeepStrictEqual(JSON.parse(serialized), JSON.parse(JSON.stringify(body)));

describe("the book replies through their response schemas", () => {
  it("send a stored book, a full one and a bare one, the same JSON as before the schema", () => {
    const full = create({
      title: "Solenoid",
      authors: ["Mircea Cărtărescu"],
      isbn13: "9786067765229",
      rating: 5,
      pages: 1,
      priceMinor: 0,
      tags: ["romanian", "novel"],
      collection: "owned",
    });
    const bare = create({ title: "Untitled" });
    // The schema's key order is what goes out (`tags` before the cover's facts and the times), so the
    // comparison is of the JSON, not of the bytes.
    expect(sameJson(serialize(bookSchema, full), full)).toBe(true);
    expect(sameJson(serialize(bookSchema, bare), bare)).toBe(true);
    expect(sameJson(serialize(bookListSchema, { books: store.list() }), { books: store.list() })).toBe(true);
  });

  it("send the bulk result with its books, deleted and skipped", () => {
    const ids = [create({ title: "A" }).id, create({ title: "B" }).id];
    const outcome = store.bulk(ids, { kind: "status", status: "read" });
    if (!("done" in outcome)) throw new Error("expected the bulk change to run");
    expect(sameJson(serialize(bookBulkResultSchema, outcome.done), outcome.done)).toBe(true);
  });

  it("strip a field the schema doesn't name", () => {
    const book = create({ title: "A" });
    expect(JSON.parse(serialize(bookSchema, { ...book, internalNote: "x" }))).toEqual(book);
    expect(JSON.parse(serialize(bookListSchema, { books: [{ ...book, internalNote: "x" }] }))).toEqual({
      books: [book],
    });
  });

  it("refuse a stored value out of shape, which would be a 500: a rating, an ISBN, a time", () => {
    const book = create({ title: "A" });
    expect(serializationFailure(bookSchema, { ...book, rating: 6 })).toBeTruthy();
    expect(serializationFailure(bookSchema, { ...book, isbn13: "123" })).toBeTruthy();
    expect(serializationFailure(bookSchema, { ...book, createdAt: "2020-01-01 00:00:00" })).toBeTruthy();
    expect(serializationFailure(bookListSchema, { books: [{ ...book, title: 5 }] })).toBeTruthy();
    expect(serializationFailure(bookBulkResultSchema, { books: [], deleted: [0], skipped: [] })).toBeTruthy();
  });

  it("send a rating at either bound and every empty field", () => {
    for (const rating of [1, 5]) {
      const book = create({ title: "A", rating });
      expect(sameJson(serialize(bookSchema, book), book)).toBe(true);
    }
  });
});
