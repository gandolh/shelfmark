import { COVER_MAX_BYTES, coverInfoSchema, type Book } from "@shelfmark/shared";
import { afterEach, describe, expect, it } from "vitest";
import {
  fakeFetch,
  hang,
  image,
  imageBytes,
  recordedInternet,
  RECORDED_COVER,
  redirect,
  type FakeFetch,
  type FakeHandler,
} from "../testing/fakeFetch.js";
import { startSignedInApp, type SignedInTestApp } from "../testing/testApp.js";
import { downloadCover, sniffImage } from "./covers.js";

let t: SignedInTestApp | undefined;
let fetch: FakeFetch;

async function start(handler: FakeHandler = recordedInternet): Promise<SignedInTestApp> {
  fetch = fakeFetch(handler);
  t = await startSignedInApp({}, { fetch });
  return t;
}

afterEach(async () => {
  await t?.close();
  t = undefined;
});

type Response = Awaited<ReturnType<SignedInTestApp["inject"]>>;

function expectError(res: Response, status: number, code: string): string {
  expect(res.statusCode).toBe(status);
  const body = res.json() as { error: { code: string; message: string } };
  expect(body.error.code).toBe(code);
  return body.error.message;
}

async function book(app: SignedInTestApp): Promise<Book> {
  const res = await app.inject({ method: "POST", url: "/api/books", payload: { title: "The Hobbit" } });
  expect(res.statusCode).toBe(201);
  return res.json() as Book;
}

const put = (app: SignedInTestApp, id: number, body: Buffer, contentType = "image/jpeg") =>
  app.inject({ method: "PUT", url: `/api/books/${id}/cover`, headers: { "content-type": contentType }, payload: body });

const fetchCover = (app: SignedInTestApp, id: number, url: unknown) =>
  app.inject({ method: "POST", url: `/api/books/${id}/cover/fetch`, payload: { url } });

const hasCover = async (app: SignedInTestApp, id: number) =>
  ((await app.inject({ method: "GET", url: `/api/books/${id}` })).json() as Book).hasCover;

describe("PUT and GET /api/books/:id/cover", () => {
  it("round-trips an upload: the bytes, the type, an ETag, a day of private caching", async () => {
    const app = await start();
    const { id } = await book(app);
    const png = imageBytes("image/png", 5000);

    const saved = await put(app, id, png, "image/png");
    expect(saved.statusCode).toBe(200);
    expect(coverInfoSchema.parse(saved.json())).toMatchObject({ mime: "image/png", size: 5000, source: "upload" });
    expect(await hasCover(app, id)).toBe(true);

    const got = await app.inject({ method: "GET", url: `/api/books/${id}/cover` });
    expect(got.statusCode).toBe(200);
    expect(got.rawPayload.equals(png)).toBe(true);
    expect(got.headers["content-type"]).toBe("image/png");
    expect(got.headers["cache-control"]).toBe("private, max-age=86400");
    expect(got.headers["x-content-type-options"]).toBe("nosniff");
    const etag = got.headers.etag as string;
    expect(etag).toMatch(/^"[\w-]+"$/);

    const again = await app.inject({
      method: "GET",
      url: `/api/books/${id}/cover?v=1`,
      headers: { "if-none-match": etag },
    });
    expect(again.statusCode).toBe(304);
    expect(again.rawPayload).toHaveLength(0);

    // A replaced cover has a new ETag.
    await put(app, id, imageBytes("image/jpeg", 5000));
    const replaced = await app.inject({ method: "GET", url: `/api/books/${id}/cover`, headers: { "if-none-match": etag } });
    expect(replaced.statusCode).toBe(200);
    expect(replaced.headers["content-type"]).toBe("image/jpeg");
  });

  it("stores the type the bytes say, whatever the header said", async () => {
    const app = await start();
    const { id } = await book(app);
    const res = await put(app, id, imageBytes("image/webp"), "image/jpeg");
    expect(res.json().mime).toBe("image/webp");
  });

  it("refuses a body over 2 MB with 413", async () => {
    const app = await start();
    const { id } = await book(app);
    expectError(await put(app, id, imageBytes("image/jpeg", COVER_MAX_BYTES + 1)), 413, "validation");
    expect(await hasCover(app, id)).toBe(false);
    expect((await put(app, id, imageBytes("image/jpeg", COVER_MAX_BYTES))).statusCode).toBe(200);
  });

  it.each([["image/gif"], ["application/json"], ["text/plain"]])("refuses %s with 415", async (type) => {
    const app = await start();
    const { id } = await book(app);
    const body = type === "application/json" ? Buffer.from('{"a":1}') : imageBytes("image/jpeg");
    const message = expectError(await put(app, id, body, type), 415, "validation");
    expect(message).toBe("A cover is sent as the raw image: image/jpeg, image/png, image/webp.");
  });

  it("refuses bytes that aren't an image with 400", async () => {
    const app = await start();
    const { id } = await book(app);
    expectError(await put(app, id, Buffer.from("GIF89a, not really")), 400, "validation");
    expectError(await put(app, id, Buffer.alloc(0)), 400, "validation");
  });

  it("answers 404 for a book that doesn't exist, and for a book with no cover", async () => {
    const app = await start();
    expect(expectError(await put(app, 999, imageBytes("image/jpeg")), 404, "not_found")).toBe("There is no such book.");
    const { id } = await book(app);
    const none = await app.inject({ method: "GET", url: `/api/books/${id}/cover` });
    expect(expectError(none, 404, "not_found")).toBe("This book has no cover.");
    const missing = await app.inject({ method: "GET", url: "/api/books/999/cover" });
    expect(expectError(missing, 404, "not_found")).toBe("There is no such book.");
    expectError(await app.inject({ method: "GET", url: "/api/books/abc/cover" }), 404, "not_found");
  });
});

describe("DELETE /api/books/:id/cover", () => {
  it("removes the cover, then answers 404", async () => {
    const app = await start();
    const { id } = await book(app);
    await put(app, id, imageBytes("image/jpeg"));
    const removed = await app.inject({ method: "DELETE", url: `/api/books/${id}/cover` });
    expect(removed.statusCode).toBe(204);
    expect(await hasCover(app, id)).toBe(false);
    expectError(await app.inject({ method: "GET", url: `/api/books/${id}/cover` }), 404, "not_found");
    expectError(await app.inject({ method: "DELETE", url: `/api/books/${id}/cover` }), 404, "not_found");
  });

  it("goes with the book", async () => {
    const app = await start();
    const { id } = await book(app);
    await put(app, id, imageBytes("image/jpeg"));
    await app.inject({ method: "DELETE", url: `/api/books/${id}` });
    expectError(await app.inject({ method: "GET", url: `/api/books/${id}/cover` }), 404, "not_found");
  });
});

describe("POST /api/books/:id/cover/fetch", () => {
  it("downloads an Open Library candidate through its archive.org redirects and stores it", async () => {
    const app = await start();
    const { id } = await book(app);
    const res = await fetchCover(app, id, "https://covers.openlibrary.org/b/id/12003329-L.jpg");
    expect(res.statusCode).toBe(200);
    expect(coverInfoSchema.parse(res.json())).toMatchObject({ mime: "image/jpeg", size: RECORDED_COVER.length, source: "openlibrary" });
    expect(fetch.calls.map((call) => call.url.host)).toEqual([
      "covers.openlibrary.org",
      "archive.org",
      "ia600100.us.archive.org",
    ]);
    // Redirects are followed by hand, so each hop passes the guard.
    expect(fetch.calls.every((call) => call.redirect === "manual")).toBe(true);

    const got = await app.inject({ method: "GET", url: `/api/books/${id}/cover` });
    expect(got.rawPayload.equals(RECORDED_COVER)).toBe(true);
  });

  it("downloads a Google Books candidate", async () => {
    const app = await start();
    const { id } = await book(app);
    const url = "https://books.google.com/books/content?id=pD6arNyKyi8C&printsec=frontcover&img=1&zoom=1&source=gbs_api";
    const res = await fetchCover(app, id, url);
    expect(res.statusCode).toBe(200);
    expect(res.json().source).toBe("googlebooks");
  });

  it.each([
    ["http, even on a cover host", "http://covers.openlibrary.org/b/id/12003329-L.jpg"],
    ["a host that isn't a cover host", "https://example.com/cover.jpg"],
    ["a look-alike host", "https://covers.openlibrary.org.example.com/b/id/1-L.jpg"],
    ["a host named like an object property", "https://constructor/b/id/1-L.jpg"],
    ["a host named __proto__", "https://__proto__/b/id/1-L.jpg"],
    ["archive.org directly: a redirect target only", "https://archive.org/download/x/y.jpg"],
    ["an address", "https://127.0.0.1/cover.jpg"],
    ["the metadata endpoint", "https://169.254.169.254/latest/meta-data/"],
    ["a port", "https://covers.openlibrary.org:8443/b/id/1-L.jpg"],
    ["a user name", "https://user@covers.openlibrary.org/b/id/1-L.jpg"],
    ["a file URL", "file:///etc/passwd"],
    ["something that isn't a URL", "covers.openlibrary.org/b/id/1-L.jpg"],
  ])("refuses %s with 400, without a request", async (_what, url) => {
    const app = await start();
    const { id } = await book(app);
    expectError(await fetchCover(app, id, url), 400, "validation");
    expect(fetch.calls).toHaveLength(0);
    expect(await hasCover(app, id)).toBe(false);
  });

  it.each([
    ["a host that isn't a cover host", "https://example.com/cover.jpg"],
    ["an internal address", "https://10.0.0.5/cover.jpg"],
    ["http", "http://ia600100.us.archive.org/cover.jpg"],
  ])("refuses a redirect to %s with 400, and doesn't follow it", async (_what, location) => {
    const app = await start((url) => (url.host === "covers.openlibrary.org" ? redirect(location) : image(RECORDED_COVER)));
    const { id } = await book(app);
    const message = expectError(await fetchCover(app, id, "https://covers.openlibrary.org/b/id/1-L.jpg"), 400, "validation");
    expect(message).toMatch(/redirected to/);
    expect(fetch.calls.map((call) => call.url.host)).toEqual(["covers.openlibrary.org"]);
    expect(await hasCover(app, id)).toBe(false);
  });

  it("refuses an image over 2 MB, whether the host says so or not", async () => {
    const big = imageBytes("image/jpeg", COVER_MAX_BYTES + 1);
    const declared = await start(() => image(big));
    const { id } = await book(declared);
    expect(expectError(await fetchCover(declared, id, "https://books.google.com/books/content?id=a"), 400, "validation")).toBe(
      "url: the image is larger than 2 MB.",
    );
    await declared.close();

    // No Content-Length: the body is counted as it streams.
    const streamed = await start(() => new Response(new Uint8Array(big), { headers: { "content-type": "image/jpeg" } }));
    const other = await book(streamed);
    expectError(await fetchCover(streamed, other.id, "https://books.google.com/books/content?id=a"), 400, "validation");
    expect(await hasCover(streamed, other.id)).toBe(false);
  });

  it("refuses something that isn't a JPEG, PNG or WebP", async () => {
    const app = await start(() => new Response("<html>not found</html>", { headers: { "content-type": "text/html" } }));
    const { id } = await book(app);
    expectError(await fetchCover(app, id, "https://books.google.com/books/content?id=a"), 400, "validation");
  });

  it("answers 502 when the cover host fails", async () => {
    const app = await start(() => new Response(null, { status: 404 }));
    const { id } = await book(app);
    const message = expectError(await fetchCover(app, id, "https://covers.openlibrary.org/b/id/1-L.jpg"), 502, "upstream");
    expect(message).toBe("The cover host answered 404.");
  });

  it("answers 404 for a book that doesn't exist, without a request", async () => {
    const app = await start();
    expectError(await fetchCover(app, 999, "https://covers.openlibrary.org/b/id/12003329-L.jpg"), 404, "not_found");
    expect(fetch.calls).toHaveLength(0);
  });

  it("refuses a body without a URL", async () => {
    const app = await start();
    const { id } = await book(app);
    expectError(await fetchCover(app, id, 42), 400, "validation");
  });
});

describe("downloadCover", () => {
  it("gives up after the timeout (10 s by default) with 502", async () => {
    const error = await downloadCover("https://books.google.com/books/content?id=a", {
      fetch: fakeFetch((_url, init) => hang(init)),
      timeoutMs: 20,
    }).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: "upstream", message: "The cover host did not answer within 0.02 s." });
  });

  it("stops after five redirects", async () => {
    let hops = 0;
    const fetch = fakeFetch(() => redirect(`https://books.googleusercontent.com/hop/${++hops}`));
    const error = await downloadCover("https://books.google.com/books/content?id=a", { fetch }).catch(
      (caught: unknown) => caught,
    );
    expect(error).toMatchObject({ code: "upstream", message: "The cover host redirected too many times." });
    expect(fetch.calls).toHaveLength(6);
  });
});

describe("sniffImage", () => {
  it("knows JPEG, PNG and WebP by their first bytes, and nothing else", () => {
    expect(sniffImage(imageBytes("image/jpeg"))).toBe("image/jpeg");
    expect(sniffImage(imageBytes("image/png"))).toBe("image/png");
    expect(sniffImage(imageBytes("image/webp"))).toBe("image/webp");
    expect(sniffImage(Buffer.from("GIF89a"))).toBeNull();
    expect(sniffImage(Buffer.from("RIFF0000WAVE"))).toBeNull();
    expect(sniffImage(Buffer.alloc(0))).toBeNull();
  });
});
