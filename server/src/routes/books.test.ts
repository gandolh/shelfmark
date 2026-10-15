import { bookListSchema, bookSchema, type Book } from "@shelfmark/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { databasePath, openDb } from "../db/open.js";
import { createBookStore } from "../store/books.js";
import { startSignedInApp, type SignedInTestApp } from "../testing/testApp.js";

let t: SignedInTestApp;

beforeEach(async () => {
  t = await startSignedInApp();
});

afterEach(async () => {
  await t.close();
});

type Response = Awaited<ReturnType<SignedInTestApp["inject"]>>;

function expectError(res: Response, status: number, code: string): string {
  expect(res.statusCode).toBe(status);
  const body = res.json() as { error: { code: string; message: string } };
  expect(Object.keys(body)).toEqual(["error"]);
  expect(body.error.code).toBe(code);
  expect(typeof body.error.message).toBe("string");
  return body.error.message;
}

async function create(payload: object): Promise<Book> {
  const res = await t.inject({ method: "POST", url: "/api/books", payload });
  expect(res.statusCode).toBe(201);
  return bookSchema.parse(res.json());
}

describe("GET /api/books", () => {
  it("answers { books: [] } on an empty library", async () => {
    const res = await t.inject({ method: "GET", url: "/api/books" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ books: [] });
  });

  it("lists every book of both collections", async () => {
    const owned = await create({ title: "Solenoid", tags: ["Romanian"] });
    const wished = await create({ title: "Orbitor", collection: "wishlist" });
    const res = await t.inject({ method: "GET", url: "/api/books" });
    expect(res.statusCode).toBe(200);
    expect(bookListSchema.parse(res.json())).toEqual({ books: [owned, wished] });
  });

  it("answers 3,000 books in under 100 ms", async () => {
    // A second connection to the app's file seeds it, in one transaction.
    const db = openDb(databasePath(t.dataDir));
    const store = createBookStore(db);
    const addCover = db.prepare(
      "INSERT INTO covers (book_id, mime, bytes, source, updated_at) VALUES (?, 'image/jpeg', ?, 'upload', ?)",
    );
    const tags = ["Romanian", "Poetry", "Essays", "Fiction", "History", "Signed copies"];
    db.transaction(() => {
      for (let i = 0; i < 3000; i++) {
        const book = store.create({
          title: `Book ${i}`,
          subtitle: i % 2 ? "A subtitle long enough to look like a real one" : null,
          authors: [`Author ${i % 400} Surname`],
          isbn13: `978${String(i).padStart(10, "0")}`,
          publisher: "Humanitas",
          publishedYear: 1950 + (i % 75),
          pages: 100 + (i % 700),
          language: "ro",
          shelf: `Living room · A${i % 9}`,
          description: "A paragraph of description. ".repeat(8),
          tags: [tags[i % tags.length] ?? "", tags[(i + 2) % tags.length] ?? ""],
        });
        if (i % 3 === 0) addCover.run(book.id, Buffer.alloc(40_000), book.createdAt);
      }
    })();
    db.close();

    // Best of three: the budget is for the query and serialisation, and one
    // run can lose a few hundred milliseconds to the other test files running
    // alongside in their own processes.
    let elapsed = Infinity;
    let res = await t.inject({ method: "GET", url: "/api/books" });
    for (let run = 0; run < 3; run++) {
      const started = performance.now();
      res = await t.inject({ method: "GET", url: "/api/books" });
      elapsed = Math.min(elapsed, performance.now() - started);
    }

    expect(res.statusCode).toBe(200);
    const { books } = res.json() as { books: Book[] };
    expect(books).toHaveLength(3000);
    expect(books.filter((book) => book.hasCover)).toHaveLength(1000);
    expect(books[1]?.tags).toEqual(["Poetry", "Fiction"]);
    console.log(`GET /api/books with 3,000 books: ${elapsed.toFixed(1)} ms`);
    expect(elapsed).toBeLessThan(100);
  });
});

describe("GET /api/books/:id", () => {
  it("answers the book", async () => {
    const book = await create({ title: "Solenoid" });
    const res = await t.inject({ method: "GET", url: `/api/books/${book.id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(book);
  });

  it("is a 404 for an unknown or malformed id", async () => {
    for (const id of ["999", "abc", "0", "-1", "1.5", "01", "99999999999999999999"]) {
      const res = await t.inject({ method: "GET", url: `/api/books/${id}` });
      expect(expectError(res, 404, "not_found"), id).toBe("There is no such book.");
    }
  });
});

describe("POST /api/books", () => {
  it("creates a book and answers 201 with it", async () => {
    const res = await t.inject({
      method: "POST",
      url: "/api/books",
      payload: { title: " Solenoid ", authors: ["Mircea Cărtărescu"], isbn13: "9789734647262" },
    });
    expect(res.statusCode).toBe(201);
    const book = bookSchema.parse(res.json());
    expect(book).toMatchObject({
      title: "Solenoid",
      authorSort: "Cărtărescu, Mircea",
      collection: "owned",
      status: "unread",
      hasCover: false,
    });
    const again = await t.inject({ method: "GET", url: `/api/books/${book.id}` });
    expect(again.json()).toEqual(book);
  });

  it("is a 400 naming the field for a bad body", async () => {
    const cases: [unknown, RegExp][] = [
      [{}, /^title: /],
      [{ title: "" }, /^title: /],
      [{ title: "t", isbn13: "123" }, /^isbn13: must be 13 digits/],
      [{ title: "t", rating: 9 }, /^rating: /],
      [{ title: "t", authorsort: "x" }, /Unrecognized key/],
      [[{ title: "t" }], /expected object/],
    ];
    for (const [payload, message] of cases) {
      const res = await t.inject({ method: "POST", url: "/api/books", payload: payload as object });
      expect(expectError(res, 400, "validation")).toMatch(message);
    }
  });

  it("is a 400 for a missing or broken JSON body", async () => {
    const empty = await t.inject({ method: "POST", url: "/api/books", headers: { "content-type": "application/json" } });
    expectError(empty, 400, "validation");
    const none = await t.inject({ method: "POST", url: "/api/books" });
    expectError(none, 400, "validation");
    const broken = await t.inject({
      method: "POST",
      url: "/api/books",
      headers: { "content-type": "application/json" },
      payload: "{ title: ",
    });
    expectError(broken, 400, "validation");
  });
});

describe("PATCH /api/books/:id", () => {
  it("changes the book and answers it", async () => {
    const book = await create({ title: "Solenoid", shelf: "Bedroom", tags: ["Romanian"] });
    const res = await t.inject({
      method: "PATCH",
      url: `/api/books/${book.id}`,
      payload: { shelf: null, status: "read", tags: ["Romanian", "Favourites"] },
    });
    expect(res.statusCode).toBe(200);
    const patched = bookSchema.parse(res.json());
    expect(patched).toMatchObject({ shelf: null, status: "read", tags: ["Romanian", "Favourites"] });
    expect(patched.createdAt).toBe(book.createdAt);
  });

  it("is a 400 for a bad body", async () => {
    const book = await create({ title: "Solenoid" });
    for (const payload of [{ title: null }, { rating: 0 }, { id: 7 }]) {
      const res = await t.inject({ method: "PATCH", url: `/api/books/${book.id}`, payload });
      expectError(res, 400, "validation");
    }
  });

  it("is a 404 for an unknown book", async () => {
    const res = await t.inject({ method: "PATCH", url: "/api/books/999", payload: { title: "x" } });
    expectError(res, 404, "not_found");
  });
});

describe("DELETE /api/books/:id", () => {
  it("deletes the book and answers 204", async () => {
    const book = await create({ title: "Solenoid" });
    // A client that sends the JSON header with no body is fine.
    const res = await t.inject({
      method: "DELETE",
      url: `/api/books/${book.id}`,
      headers: { "content-type": "application/json" },
    });
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe("");
    const gone = await t.inject({ method: "GET", url: `/api/books/${book.id}` });
    expectError(gone, 404, "not_found");
  });

  it("is a 404 for an unknown book", async () => {
    const res = await t.inject({ method: "DELETE", url: "/api/books/999" });
    expectError(res, 404, "not_found");
  });
});

describe("errors", () => {
  it("answers an unknown route with the shared error shape", async () => {
    const res = await t.inject({ method: "GET", url: "/api/nothing" });
    expect(expectError(res, 404, "not_found")).toBe("There is no such route.");
  });
});
