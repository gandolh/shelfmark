import { bookSchema, type BulkChange } from "@shelfmark/shared";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "../../db/migrations.js";
import { openDb, type Db } from "../../db/open.js";
import { createSqliteStore } from "../../../vendor/ward/ward-auth.js";
import { createBookStore, type BookStore } from "./store.js";

/** The reader every book is read and written as, and a second one. */
const ME = "user-ana";
const MIHAI = "user-mihai";

let db: Db;
let store: BookStore;
let tick: number;

/** One second later on every call, so `updatedAt` visibly moves. */
const clock = () => new Date(Date.UTC(2026, 9, 14, 9, 0, tick++));

beforeEach(() => {
  tick = 0;
  db = openDb(":memory:");
  store = createBookStore(db, clock);
});

afterEach(() => {
  db.close();
});

function addCover(bookId: number): void {
  db.prepare(
    "INSERT INTO covers (book_id, mime, bytes, source, updated_at) VALUES (?, 'image/jpeg', ?, 'upload', ?)",
  ).run(bookId, Buffer.from([0xff, 0xd8, 0xff]), "2026-10-14T09:00:00.000Z");
}

/** The accounts library's own tables, with both readers written straight in: the readers need only their names. */
function addAccounts(target: Db): void {
  createSqliteStore(target);
  const insert = target.prepare(
    "INSERT INTO auth_users (id, username, username_folded, role, created_at, updated_at) VALUES (?, ?, ?, 'owner', 0, 0)",
  );
  insert.run(ME, "Ana", "ana");
  insert.run(MIHAI, "Mihai", "mihai");
}

const tagNames = () =>
  db
    .prepare<[], { name: string }>("SELECT name FROM tags ORDER BY id")
    .all()
    .map((row) => row.name);

describe("create", () => {
  it("fills the defaults, derives the author sort and sets both times", () => {
    const book = store.create({ title: "Solenoid", authors: ["Mircea Cărtărescu"] }, ME);
    expect(bookSchema.parse(book)).toEqual(book);
    expect(book).toEqual({
      id: 1,
      isbn13: null,
      barcode: null,
      title: "Solenoid",
      subtitle: null,
      authors: ["Mircea Cărtărescu"],
      authorSort: "Cărtărescu, Mircea",
      publisher: null,
      publishedYear: null,
      pages: null,
      language: null,
      series: null,
      seriesNumber: null,
      description: null,
      subjects: [],
      collection: "owned",
      format: null,
      condition: null,
      shelf: null,
      signed: false,
      status: "unread",
      rating: null,
      notes: null,
      acquiredOn: null,
      acquiredFrom: null,
      priceMinor: null,
      currency: "RON",
      metadataSource: "manual",
      tags: [],
      readers: [],
      hasCover: false,
      coverUpdatedAt: null,
      createdAt: "2026-10-14T09:00:00.000Z",
      updatedAt: "2026-10-14T09:00:00.000Z",
    });
  });

  it("stores every field it is given", () => {
    const input = {
      isbn13: "9789734647262",
      barcode: null,
      title: "Solenoid",
      subtitle: "roman",
      authors: ["Mircea Cărtărescu"],
      authorSort: "Cartarescu, M.",
      publisher: "Humanitas",
      publishedYear: 2015,
      pages: 837,
      language: "ro",
      series: "Opere",
      seriesNumber: "3a",
      description: "A long one.",
      subjects: ["Fiction"],
      collection: "wishlist" as const,
      format: "hardcover" as const,
      condition: "good" as const,
      shelf: "Living room · A2",
      signed: true,
      status: "reading" as const,
      rating: 4,
      notes: "Bought twice.",
      acquiredOn: "2016-03-01",
      acquiredFrom: "Cărturești",
      priceMinor: 5990,
      currency: "EUR",
      metadataSource: "openlibrary" as const,
      tags: ["Romanian"],
    };
    const book = store.create(input, ME);
    expect(book).toMatchObject(input);
    expect(store.get(book.id, ME)).toEqual(book);
  });

  it("treats null like a missing field", () => {
    const book = store.create(
      {
        title: "t",
        status: null,
        collection: null,
        signed: null,
        currency: null,
        authors: null,
      },
      ME,
    );
    expect(book).toMatchObject({ status: "unread", collection: "owned", signed: false, currency: "RON", authors: [] });
  });
});

describe("list and get", () => {
  it("returns every book of both collections by id, with its tags and whether it has a cover", () => {
    const a = store.create({ title: "A", tags: ["Poetry", "Romanian"] }, ME);
    const b = store.create({ title: "B", collection: "wishlist", tags: ["Romanian"] }, ME);
    const c = store.create({ title: "C" }, ME);
    addCover(a.id);

    const list = store.list(ME);
    expect(list.map((book) => [book.title, book.collection, book.tags, book.hasCover, book.coverUpdatedAt])).toEqual([
      ["A", "owned", ["Poetry", "Romanian"], true, "2026-10-14T09:00:00.000Z"],
      ["B", "wishlist", ["Romanian"], false, null],
      ["C", "owned", [], false, null],
    ]);
    expect(store.get(a.id, ME)).toEqual(list[0]);
    expect(store.get(b.id, ME)?.tags).toEqual(["Romanian"]);
    expect(store.get(c.id, ME)?.hasCover).toBe(false);
  });

  it("runs three statements for the whole list, never one per book", () => {
    const executed: string[] = [];
    const traced = new Database(":memory:", { verbose: (sql) => executed.push(String(sql)) });
    traced.pragma("foreign_keys = ON");
    migrate(traced);
    addAccounts(traced);
    const tracedStore = createBookStore(traced, clock);
    for (let i = 0; i < 20; i++) {
      const book = tracedStore.create({ title: `Book ${i}`, tags: [`tag ${i % 3}`], status: "read" }, ME);
      tracedStore.patch(book.id, { rating: 4 }, MIHAI);
    }

    executed.length = 0;
    const list = tracedStore.list(ME);
    expect(list).toHaveLength(20);
    expect(list.every((book) => book.status === "read" && book.readers.length === 1)).toBe(true);
    expect(executed).toHaveLength(3);
    traced.close();
  });

  it("is undefined for an unknown id", () => {
    expect(store.get(42, ME)).toBeUndefined();
  });
});

describe("patch", () => {
  it("changes only what it is given and moves updatedAt", () => {
    const book = store.create({ title: "Solenoid", shelf: "Bedroom", rating: 3 }, ME);
    const patched = store.patch(book.id, { shelf: "Living room · A2", status: "read" }, ME);
    expect(patched).toEqual({
      ...book,
      shelf: "Living room · A2",
      status: "read",
      updatedAt: "2026-10-14T09:00:01.000Z",
    });
    expect(store.get(book.id, ME)).toEqual(patched);
  });

  it("clears with null: a nullable field to null, a list to empty, a defaulted field to its default", () => {
    const book = store.create(
      {
        title: "Solenoid",
        shelf: "Bedroom",
        rating: 3,
        subjects: ["Fiction"],
        status: "read",
        signed: true,
        currency: "EUR",
        collection: "wishlist",
        tags: ["Romanian"],
      },
      ME,
    );
    const patched = store.patch(
      book.id,
      {
        shelf: null,
        rating: null,
        subjects: null,
        status: null,
        signed: null,
        currency: null,
        collection: null,
        tags: null,
      },
      ME,
    );
    expect(patched).toMatchObject({
      shelf: null,
      rating: null,
      subjects: [],
      status: "unread",
      signed: false,
      currency: "RON",
      collection: "owned",
      tags: [],
    });
  });

  it("does nothing for an empty patch", () => {
    const book = store.create({ title: "Solenoid" }, ME);
    expect(store.patch(book.id, {}, ME)).toEqual(book);
  });

  it("is undefined for an unknown id", () => {
    expect(store.patch(42, { title: "x" }, ME)).toBeUndefined();
  });
});

describe("readings", () => {
  const readingRows = () =>
    db.prepare("SELECT book_id AS book, user_id AS user, status, rating FROM readings ORDER BY book_id, user_id").all();

  beforeEach(() => {
    addAccounts(db);
  });

  it("gives each reader their own status and rating, and the others in readers by username", () => {
    const book = store.create({ title: "Solenoid", status: "read", rating: 5 }, ME);
    expect(book).toMatchObject({ status: "read", rating: 5, readers: [] });

    // Mihai's change is his own: Ana's row stays, and the book itself is not changed.
    const his = store.patch(book.id, { status: "reading" }, MIHAI);
    expect(his).toMatchObject({ status: "reading", rating: null, updatedAt: book.updatedAt });
    expect(his?.readers).toEqual([
      { userId: ME, username: "Ana", status: "read", rating: 5, updatedAt: "2026-10-14T09:00:00.000Z" },
    ]);

    const [mine] = store.list(ME);
    expect(mine).toMatchObject({ status: "read", rating: 5 });
    expect(mine?.readers).toEqual([
      { userId: MIHAI, username: "Mihai", status: "reading", rating: null, updatedAt: "2026-10-14T09:00:01.000Z" },
    ]);
    expect(bookSchema.parse(mine)).toEqual(mine);

    // Read as nobody (another feature): the defaults, and every reader. A rename shows at once.
    db.prepare("UPDATE auth_users SET username = 'Mihăiță', username_folded = 'mihăiță' WHERE id = ?").run(MIHAI);
    expect(store.get(book.id)).toMatchObject({ status: "unread", rating: null });
    expect(store.get(book.id)?.readers.map((reader) => reader.username)).toEqual(["Ana", "Mihăiță"]);
  });

  it("leaves out a reading whose account has no row", () => {
    const book = store.create({ title: "Solenoid", status: "read" }, "user-gone");
    expect(store.get(book.id, ME)?.readers).toEqual([]);
  });

  it("changes only the caller's rows on a bulk status change, and no book's updatedAt", () => {
    const a = store.create({ title: "A", status: "reading" }, MIHAI);
    const b = store.create({ title: "B" }, ME);

    const result = store.bulk([a.id, b.id], { kind: "status", status: "read" }, ME);
    if (!("done" in result)) throw new Error("expected the bulk change to run");
    expect(result.done.books.map((book) => [book.status, book.updatedAt])).toEqual([
      ["read", a.updatedAt],
      ["read", b.updatedAt],
    ]);
    expect(readingRows()).toEqual([
      { book: a.id, user: ME, status: "read", rating: null },
      { book: a.id, user: MIHAI, status: "reading", rating: null },
      { book: b.id, user: ME, status: "read", rating: null },
    ]);
  });

  it("deletes the caller's row once it is back to unread with no rating", () => {
    const a = store.create({ title: "A", status: "read", rating: 4 }, ME);
    const b = store.create({ title: "B", status: "read" }, ME);
    store.patch(a.id, { status: "reading" }, MIHAI);

    expect(store.patch(a.id, { status: null, rating: null }, ME)).toMatchObject({ status: "unread", rating: null });
    store.bulk([b.id], { kind: "status", status: "unread" }, ME);
    expect(readingRows()).toEqual([{ book: a.id, user: MIHAI, status: "reading", rating: null }]);

    // A rating alone is something to keep.
    store.patch(b.id, { rating: 2 }, ME);
    expect(readingRows()).toContainEqual({ book: b.id, user: ME, status: "unread", rating: 2 });
  });
});

describe("author sort", () => {
  it("is derived from the first author unless given", () => {
    expect(store.create({ title: "t", authors: ["Mircea Cărtărescu", "Ion Creangă"] }, ME).authorSort).toBe(
      "Cărtărescu, Mircea",
    );
    expect(store.create({ title: "t", authors: ["Homer"] }, ME).authorSort).toBe("Homer");
    expect(store.create({ title: "t" }, ME).authorSort).toBeNull();
    expect(
      store.create({ title: "t", authors: ["Gabriel García Márquez"], authorSort: "García Márquez, Gabriel" }, ME)
        .authorSort,
    ).toBe("García Márquez, Gabriel");
  });

  it("follows new authors while it was derived", () => {
    const book = store.create({ title: "t", authors: ["Mircea Cărtărescu"] }, ME);
    expect(store.patch(book.id, { authors: ["Ana Blandiana"] }, ME)?.authorSort).toBe("Blandiana, Ana");
    expect(store.patch(book.id, { authors: null }, ME)?.authorSort).toBeNull();
    expect(store.patch(book.id, { authors: ["Homer"] }, ME)?.authorSort).toBe("Homer");
  });

  it("keeps a sort key the owner set when the authors change", () => {
    const book = store.create(
      {
        title: "t",
        authors: ["Gabriel García Márquez"],
        authorSort: "García Márquez, Gabriel",
      },
      ME,
    );
    expect(store.patch(book.id, { authors: ["Gabriel García Márquez", "Edith Grossman"] }, ME)?.authorSort).toBe(
      "García Márquez, Gabriel",
    );

    const derived = store.create({ title: "t", authors: ["Mircea Cărtărescu"] }, ME);
    store.patch(derived.id, { authorSort: "Cartarescu" }, ME);
    expect(store.patch(derived.id, { authors: ["Ana Blandiana"] }, ME)?.authorSort).toBe("Cartarescu");
  });

  it("takes an explicit key over the derived one, and derives again on null", () => {
    const book = store.create({ title: "t", authors: ["Mircea Cărtărescu"] }, ME);
    expect(store.patch(book.id, { authors: ["Ana Blandiana"], authorSort: "B" }, ME)?.authorSort).toBe("B");
    expect(store.patch(book.id, { authorSort: null }, ME)?.authorSort).toBe("Blandiana, Ana");
  });
});

describe("tags", () => {
  it("matches an existing tag case-insensitively and keeps its first spelling", () => {
    const a = store.create({ title: "A", tags: ["Știință", "Poetry"] }, ME);
    const b = store.create({ title: "B", tags: ["  ȘTIINȚĂ ", "poetry", "POETRY", "new"] }, ME);
    expect(store.get(a.id, ME)?.tags).toEqual(["Știință", "Poetry"]);
    expect(b.tags).toEqual(["Știință", "Poetry", "new"]);
    expect(tagNames()).toEqual(["Știință", "Poetry", "new"]);
  });

  it("keeps a book's tags in the order given", () => {
    const book = store.create({ title: "A", tags: ["b", "a", "c"] }, ME);
    expect(book.tags).toEqual(["b", "a", "c"]);
    expect(store.patch(book.id, { tags: ["c", "b"] }, ME)?.tags).toEqual(["c", "b"]);
  });

  it("deletes a tag no book uses any more", () => {
    const a = store.create({ title: "A", tags: ["Poetry", "Romanian"] }, ME);
    const b = store.create({ title: "B", tags: ["Romanian"] }, ME);

    store.patch(a.id, { tags: ["Essays"] }, ME);
    expect(tagNames()).toEqual(["Romanian", "Essays"]);

    store.remove(b.id);
    expect(tagNames()).toEqual(["Essays"]);

    store.patch(a.id, { tags: [] }, ME);
    expect(tagNames()).toEqual([]);
  });

  it("leaves the tags alone when a patch does not name them", () => {
    const book = store.create({ title: "A", tags: ["Poetry"] }, ME);
    expect(store.patch(book.id, { shelf: "Bedroom" }, ME)?.tags).toEqual(["Poetry"]);
  });
});

describe("remove", () => {
  it("deletes the book with its cover and tag links", () => {
    const book = store.create({ title: "A", tags: ["Poetry"] }, ME);
    addCover(book.id);

    expect(store.remove(book.id)).toBe(true);
    expect(store.get(book.id, ME)).toBeUndefined();
    expect(db.prepare("SELECT count(*) AS n FROM covers").get()).toEqual({ n: 0 });
    expect(db.prepare("SELECT count(*) AS n FROM book_tags").get()).toEqual({ n: 0 });
    expect(store.remove(book.id)).toBe(false);
  });
});

describe("findByIsbn", () => {
  it("returns every copy with the ISBN, owned and wishlist alike", () => {
    const owned = store.create(
      { title: "Solenoid", isbn13: "9789734647262", shelf: "Bedroom", tags: ["Romanian"] },
      ME,
    );
    const second = store.create({ title: "Solenoid", isbn13: "9789734647262" }, ME);
    const wished = store.create({ title: "Solenoid", isbn13: "9789734647262", collection: "wishlist" }, ME);
    store.create({ title: "Other", isbn13: "9786063205583" }, ME);
    store.create({ title: "No ISBN" }, ME);

    const found = store.findByIsbn("9789734647262", ME);
    expect(found.map((book) => [book.id, book.collection])).toEqual([
      [owned.id, "owned"],
      [second.id, "owned"],
      [wished.id, "wishlist"],
    ]);
    expect(found[0]).toEqual(owned);
    expect(store.findByIsbn("9780000000000", ME)).toEqual([]);
  });
});

describe("bulk", () => {
  const ids = (...books: { id: number }[]) => books.map((book) => book.id);
  const done = (outcome: ReturnType<BookStore["bulk"]>) => {
    if (!("done" in outcome)) throw new Error(`unknown ids ${outcome.unknown.join(", ")}`);
    return outcome.done;
  };

  it("moves owned books to a shelf, skips wishlist books, and writes only the books that change", () => {
    const a = store.create({ title: "A", shelf: "Living room · A1" }, ME);
    const b = store.create({ title: "B", shelf: "Bedroom · B1" }, ME);
    const w = store.create({ title: "W", collection: "wishlist" }, ME);
    const other = store.create({ title: "Other", shelf: "Living room · A1" }, ME);

    const result = done(store.bulk(ids(w, b, a), { kind: "shelf", shelf: "Bedroom · B1" }, ME));
    expect(result.books.map((book) => [book.id, book.shelf])).toEqual([
      [a.id, "Bedroom · B1"],
      [b.id, "Bedroom · B1"],
    ]);
    expect(result.skipped).toEqual([w.id]);
    expect(result.deleted).toEqual([]);
    expect(result.books[0]?.updatedAt).not.toBe(a.updatedAt);
    expect(result.books[1]).toEqual(b); // already there: untouched
    expect(store.get(w.id, ME)).toEqual(w);
    expect(store.get(other.id, ME)).toEqual(other);
  });

  it("takes books off their shelf with null", () => {
    const a = store.create({ title: "A", shelf: "Bedroom · B1" }, ME);
    expect(done(store.bulk(ids(a), { kind: "shelf", shelf: null }, ME)).books[0]?.shelf).toBeNull();
  });

  it("sets the status of owned and wishlist books alike", () => {
    const a = store.create({ title: "A" }, ME);
    const w = store.create({ title: "W", collection: "wishlist" }, ME);
    const read = store.create({ title: "R", status: "read" }, ME);
    const result = done(store.bulk(ids(a, w, read), { kind: "status", status: "read" }, ME));
    expect(result.books.map((book) => book.status)).toEqual(["read", "read", "read"]);
    expect(result.skipped).toEqual([]);
    expect(result.books[2]).toEqual(read);
  });

  it("adds a tag once to each book, matching an existing tag case-insensitively", () => {
    const tagged = store.create({ title: "A", tags: ["Signed"] }, ME);
    const others = [1, 2, 3, 4].map((n) => store.create({ title: `B${n}`, tags: n === 1 ? ["Poetry"] : [] }, ME));

    const result = done(store.bulk(ids(tagged, ...others), { kind: "addTags", tags: ["signed", "SIGNED"] }, ME));
    expect(result.books.map((book) => book.tags)).toEqual([
      ["Signed"],
      ["Poetry", "Signed"],
      ["Signed"],
      ["Signed"],
      ["Signed"],
    ]);
    expect(tagNames()).toEqual(["Signed", "Poetry"]);
    expect(result.books[0]).toEqual(tagged); // had it already: untouched
    expect(result.books[1]?.updatedAt).not.toBe(others[0]?.updatedAt);
  });

  it("removes tags case-insensitively and forgets a tag no book uses", () => {
    const a = store.create({ title: "A", tags: ["Signed", "Poetry"] }, ME);
    const b = store.create({ title: "B", tags: ["Poetry"] }, ME);
    const c = store.create({ title: "C", tags: ["Signed"] }, ME);

    const result = done(store.bulk(ids(a, b, c), { kind: "removeTags", tags: ["SIGNED"] }, ME));
    expect(result.books.map((book) => book.tags)).toEqual([["Poetry"], ["Poetry"], []]);
    expect(result.books[1]).toEqual(b); // had no such tag: untouched
    expect(tagNames()).toEqual(["Poetry"]);
  });

  it("deletes books with their covers and tag links, and answers their ids", () => {
    const a = store.create({ title: "A", tags: ["Signed"] }, ME);
    const b = store.create({ title: "B", tags: ["Poetry"] }, ME);
    const keep = store.create({ title: "Keep", tags: ["Poetry"] }, ME);
    addCover(a.id);

    expect(done(store.bulk(ids(b, a), { kind: "delete" }, ME))).toEqual({
      books: [],
      deleted: [a.id, b.id],
      skipped: [],
    });
    expect(store.list(ME)).toEqual([keep]);
    expect(db.prepare("SELECT count(*) AS n FROM covers").get()).toEqual({ n: 0 });
    expect(tagNames()).toEqual(["Poetry"]);
  });

  it("changes nothing when an id names no book, and names those ids", () => {
    const a = store.create({ title: "A", tags: ["Poetry"] }, ME);
    const before = store.list(ME);
    const changes: BulkChange[] = [
      { kind: "status", status: "read" },
      { kind: "shelf", shelf: "Bedroom" },
      { kind: "addTags", tags: ["Signed"] },
      { kind: "removeTags", tags: ["Poetry"] },
      { kind: "delete" },
    ];
    for (const change of changes) {
      expect(store.bulk([998, a.id, 997], change, ME)).toEqual({ unknown: [997, 998] });
    }
    expect(store.list(ME)).toEqual(before);
    expect(tagNames()).toEqual(["Poetry"]);
  });

  it("runs as one transaction: a failure part-way leaves every book as it was", () => {
    const a = store.create({ title: "A" }, ME);
    const b = store.create({ title: "B" }, ME);
    db.exec(
      `CREATE TRIGGER refuse BEFORE UPDATE ON books WHEN NEW.id = ${b.id} BEGIN SELECT RAISE(ABORT, 'refused'); END`,
    );

    expect(() => store.bulk(ids(a, b), { kind: "addTags", tags: ["Signed"] }, ME)).toThrow("refused");
    expect(store.get(a.id, ME)).toEqual(a);
    expect(tagNames()).toEqual([]);
  });
});
