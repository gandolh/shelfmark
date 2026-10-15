import { lookupResponseSchema, type Book, type LookupResponse } from "@shelfmark/shared";
import { afterEach, describe, expect, it } from "vitest";
import { fakeFetch, recordedInternet, type FakeFetch } from "../testing/fakeFetch.js";
import { startTestApp, type TestApp } from "../testing/testApp.js";

let t: TestApp | undefined;
let fetch: FakeFetch;

/** The app over the recorded sources. Without a key, as the server runs until the owner creates one. */
async function start(env: NodeJS.ProcessEnv = {}): Promise<TestApp> {
  fetch = fakeFetch(recordedInternet);
  t = await startTestApp(env, { fetch });
  return t;
}

afterEach(async () => {
  await t?.close();
  t = undefined;
});

async function lookup(app: TestApp, isbn: unknown): Promise<LookupResponse> {
  const res = await app.app.inject({ method: "POST", url: "/api/lookup", payload: { isbn } });
  expect(res.statusCode).toBe(200);
  return lookupResponseSchema.parse(res.json());
}

async function create(app: TestApp, payload: object): Promise<Book> {
  const res = await app.app.inject({ method: "POST", url: "/api/books", payload });
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
      source: "openlibrary",
      coverCandidates: [{ url: "https://covers.openlibrary.org/b/id/12003329-L.jpg", source: "openlibrary" }],
    });
    expect(body.owned).toEqual([]);
    expect(body.wishlisted).toEqual([]);
  });

  it("answers draft: null for an ISBN nobody has, with every source in tried", async () => {
    const app = await start();
    expect(await lookup(app, "9786063205583")).toEqual({
      isbn13: "9786063205583",
      draft: null,
      tried: [
        { source: "openlibrary", outcome: "not_found" },
        { source: "googlebooks", outcome: "skipped_no_key" },
      ],
      owned: [],
      wishlisted: [],
    });
  });

  it("asks Google, with the key, when Open Library's answer is thin", async () => {
    const app = await start({ GOOGLE_BOOKS_API_KEY: "test-key-not-a-real-one" });
    const body = await lookup(app, "9789735066109");
    expect(body.tried).toEqual([
      { source: "openlibrary", outcome: "found" },
      { source: "googlebooks", outcome: "found" },
    ]);
    expect(body.draft?.source).toBe("both");
    expect(body.draft?.coverCandidates.map((candidate) => candidate.source)).toEqual(["googlebooks"]);
    const google = fetch.calls.find((call) => call.url.host === "www.googleapis.com");
    expect(google?.url.searchParams.get("key")).toBe("test-key-not-a-real-one");
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
    const res = await app.app.inject({ method: "GET", url: "/api/books" });
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
    t = await startTestApp({}, { fetch });
    const body = await lookup(t, "9780547928227");
    expect(body.draft).toBeNull();
    expect(body.tried).toEqual([
      { source: "openlibrary", outcome: "error" },
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
    const res = await app.app.inject({ method: "POST", url: "/api/lookup", payload });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: { code: "validation", message } });
    expect(fetch.calls).toHaveLength(0);
  });

  it("refuses an unknown key and an empty body", async () => {
    const app = await start();
    const extra = await app.app.inject({ method: "POST", url: "/api/lookup", payload: { isbn: "9780547928227", x: 1 } });
    expect(extra.statusCode).toBe(400);
    const empty = await app.app.inject({ method: "POST", url: "/api/lookup", headers: { "content-type": "application/json" } });
    expect(empty.statusCode).toBe(400);
    expect(empty.json().error.code).toBe("validation");
  });
});
