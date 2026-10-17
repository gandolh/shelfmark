import { lookupResponseSchema, type Book, type LookupResponse } from "@shelfmark/shared";
import { afterEach, describe, expect, it } from "vitest";
import { fakeFetch, recordedInternet, type FakeFetch } from "../testing/fakeFetch.js";
import { cipDatabasePath, openCipStore } from "../cip/store.js";
import { fakeLibraries, type FakeLibraries, type FixtureName } from "../testing/fakeLibraries.js";
import { startSignedInApp, type SignedInTestApp } from "../testing/testApp.js";

let t: SignedInTestApp | undefined;
let fetch: FakeFetch;
let libraries: FakeLibraries;

/**
 * The app over the recorded sources. Without a key, as the server runs until
 * the owner creates one. The library catalogs answer from `fixtures`, and
 * "0 hits" for any other ISBN. Each app has fresh queues, so a test's first
 * request to each library goes at once.
 */
async function start(env: NodeJS.ProcessEnv = {}, fixtures: FixtureName[] = []): Promise<SignedInTestApp> {
  fetch = fakeFetch(recordedInternet);
  libraries = fakeLibraries(fixtures);
  t = await startSignedInApp(env, { fetch, connect: libraries.connect });
  return t;
}

afterEach(async () => {
  await t?.close();
  t = undefined;
});

async function lookup(app: SignedInTestApp, isbn: unknown): Promise<LookupResponse> {
  const res = await app.inject({ method: "POST", url: "/api/lookup", payload: { isbn } });
  expect(res.statusCode).toBe(200);
  return lookupResponseSchema.parse(res.json());
}

async function create(app: SignedInTestApp, payload: object): Promise<Book> {
  const res = await app.inject({ method: "POST", url: "/api/books", payload });
  expect(res.statusCode).toBe(201);
  return res.json() as Book;
}

describe("POST /api/lookup", () => {
  it("answers The Hobbit with a draft and a cover candidate, from Open Library alone", async () => {
    const app = await start();
    const body = await lookup(app, "9780547928227");
    expect(body.isbn13).toBe("9780547928227");
    expect(body.tried).toEqual([{ source: "openlibrary", outcome: "found" }]);
    expect(body.draft).toMatchObject({
      isbn13: "9780547928227",
      title: "The Hobbit",
      authors: ["J.R.R. Tolkien"],
      publishedYear: 2012,
      language: "en",
      sources: ["openlibrary"],
      coverCandidates: [{ url: "https://covers.openlibrary.org/b/id/12003329-L.jpg", source: "openlibrary" }],
    });
    expect(body.owned).toEqual([]);
    expect(body.wishlisted).toEqual([]);
    expect(libraries.calls).toEqual([]);
  });

  it("answers draft: null for an ISBN nobody has, with every source in tried", async () => {
    const app = await start();
    expect(await lookup(app, "9786063205583")).toEqual({
      isbn13: "9786063205583",
      draft: null,
      tried: [
        { source: "openlibrary", outcome: "not_found" },
        { source: "biblacad", outcome: "not_found" },
        { source: "bcucluj", outcome: "not_found" },
        { source: "bcutimisoara", outcome: "not_found" },
        { source: "cip", outcome: "not_found" },
        { source: "googlebooks", outcome: "skipped_no_key" },
      ],
      owned: [],
      wishlisted: [],
    });
  });

  it("asks Google, with the key, only when no other source found it", async () => {
    const app = await start({ GOOGLE_BOOKS_API_KEY: "test-key-not-a-real-one" });
    const body = await lookup(app, "9786063205583");
    expect(body.tried.at(-1)).toEqual({ source: "googlebooks", outcome: "not_found" });
    const google = fetch.calls.find((call) => call.url.host === "www.googleapis.com");
    expect(google?.url.searchParams.get("key")).toBe("test-key-not-a-real-one");

    // Open Library has a title but no cover: Google is not asked for the cover.
    const before = fetch.calls.length;
    const thin = await lookup(app, "9789735066109");
    expect(thin.tried).toEqual([{ source: "openlibrary", outcome: "found" }]);
    expect(fetch.calls.slice(before).every((call) => call.url.host === "openlibrary.org")).toBe(true);
  });

  it("finds a Romanian book in a library catalog, crediting the library, without Google", async () => {
    const app = await start({ GOOGLE_BOOKS_API_KEY: "test-key-not-a-real-one" }, ["biblacad-piramida"]);
    const body = await lookup(app, "978-606-8044-87-3");
    expect(body.tried).toEqual([
      { source: "openlibrary", outcome: "not_found" },
      { source: "biblacad", outcome: "found" },
    ]);
    expect(body.draft).toMatchObject({
      title: "Piramida roșie",
      authors: ["Rick Riordan"],
      publisher: "Editura Arthur",
      publishedYear: 2014,
      pages: 542,
      language: "ro",
      coverCandidates: [],
      sources: ["biblacad"],
    });
    expect(libraries.calls).toEqual([
      { library: "biblacad", requests: [20, 22, 24], isbns: ["9786068044873", "6068044874"] },
    ]);
    expect(fetch.calls.some((call) => call.url.host === "www.googleapis.com")).toBe(false);
  });

  it("finds a book only the CIP lists know, after the libraries, without Google", async () => {
    const app = await start({ GOOGLE_BOOKS_API_KEY: "test-key-not-a-real-one" });
    const store = openCipStore(cipDatabasePath(app.dataDir));
    store.importIssue({ month: "2026-02", url: "https://bibnat.ro/x/CIP_februarie-2026.pdf", uploaded: "2026-08-18" }, [
      { isbn13: "9786063205583", entry: 9, title: "Isidor", subtitle: null, authors: ["Ana Pop"], publisher: "Polirom", city: "Iași", year: 2026 },
    ]);
    store.close();
    const body = await lookup(app, "9786063205583");
    expect(body.tried.map((t) => `${t.source} ${t.outcome}`)).toEqual([
      "openlibrary not_found",
      "biblacad not_found",
      "bcucluj not_found",
      "bcutimisoara not_found",
      "cip found",
    ]);
    expect(body.draft).toMatchObject({ title: "Isidor", authors: ["Ana Pop"], publishedYear: 2026, sources: ["cip"] });
    expect(fetch.calls.some((call) => call.url.host === "www.googleapis.com")).toBe(false);
  });

  it("finds a book from before 2007 by its ISBN-10, whichever form is scanned", async () => {
    const app = await start({}, ["biblacad-provence-isbn10"]);
    const body = await lookup(app, "973-576-186-6");
    expect(body.isbn13).toBe("9789735761868");
    expect(body.draft).toMatchObject({ title: "Un an în Provence", publishedYear: 1998, sources: ["biblacad"] });
  });

  it("accepts an ISBN-10 with hyphens and answers its ISBN-13", async () => {
    const app = await start();
    const body = await lookup(app, "0-547-92822-x");
    expect(body.isbn13).toBe("9780547928227");
    expect(body.draft?.title).toBe("The Hobbit");
  });

  it("finds the copies already saved: owned with shelf and date, wishlisted by id", async () => {
    const app = await start();
    const first = await create(app, { title: "The Hobbit", isbn13: "9780547928227", shelf: "Living room · A2" });
    const second = await create(app, { title: "The Hobbit", isbn13: "9780547928227" });
    const wished = await create(app, { title: "The Hobbit", isbn13: "9780547928227", collection: "wishlist" });
    await create(app, { title: "Inocenții", isbn13: "9789735054694" });

    const body = await lookup(app, "9780547928227");
    expect(body.owned).toEqual([
      { id: first.id, shelf: "Living room · A2", createdAt: first.createdAt },
      { id: second.id, shelf: null, createdAt: second.createdAt },
    ]);
    expect(body.wishlisted).toEqual([{ id: wished.id }]);
    expect(body.draft?.title).toBe("The Hobbit");
  });

  it("saves nothing", async () => {
    const app = await start();
    await lookup(app, "9780547928227");
    const res = await app.inject({ method: "GET", url: "/api/books" });
    expect(res.json()).toEqual({ books: [] });
  });

  it("answers the same ISBN again from the cache", async () => {
    const app = await start();
    const first = await lookup(app, "9780547928227");
    const requests = fetch.calls.length;
    expect(await lookup(app, "978-0-547-92822-7")).toEqual(first);
    expect(fetch.calls).toHaveLength(requests);
  });

  it("answers 200 with an error outcome when a source fails", async () => {
    fetch = fakeFetch(() => undefined);
    t = await startSignedInApp({}, { fetch }); // and the default connect, which refuses every library
    const body = await lookup(t, "9780547928227");
    expect(body.draft).toBeNull();
    expect(body.tried).toEqual([
      { source: "openlibrary", outcome: "error" },
      { source: "biblacad", outcome: "error" },
      { source: "bcucluj", outcome: "error" },
      { source: "bcutimisoara", outcome: "error" },
      { source: "cip", outcome: "not_found" },
      { source: "googlebooks", outcome: "skipped_no_key" },
    ]);
  });

  it.each([
    [{ isbn: "12345" }, "isbn: an ISBN has 10 or 13 digits"],
    [{ isbn: "9780547928228" }, "isbn: the check digit doesn't match"],
    [{ isbn: "5901234123457" }, "isbn: this is not an ISBN"],
    [{ isbn: 9780547928227 }, "isbn: send the ISBN as a string"],
    [{}, "isbn: send the ISBN as a string"],
  ])("refuses %j with 400 validation", async (payload, message) => {
    const app = await start();
    const res = await app.inject({ method: "POST", url: "/api/lookup", payload });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: { code: "validation", message } });
    expect(fetch.calls).toHaveLength(0);
    expect(libraries.calls).toHaveLength(0);
  });

  it("refuses an unknown key and an empty body", async () => {
    const app = await start();
    const extra = await app.inject({ method: "POST", url: "/api/lookup", payload: { isbn: "9780547928227", x: 1 } });
    expect(extra.statusCode).toBe(400);
    const empty = await app.inject({ method: "POST", url: "/api/lookup", headers: { "content-type": "application/json" } });
    expect(empty.statusCode).toBe(400);
    expect(empty.json().error.code).toBe("validation");
  });
});
