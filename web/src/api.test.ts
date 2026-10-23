import type { Book } from "@shelfmark/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiBlob, apiRequest, booksApi, coverPath, coverUrl, isApiError, onSignedOut } from "./api";

const book: Book = {
  id: 1,
  isbn13: "9789734647262",
  barcode: null,
  title: "Solenoid",
  subtitle: null,
  authors: ["Mircea Cărtărescu"],
  authorSort: "Cărtărescu, Mircea",
  publisher: "Humanitas",
  publishedYear: 2015,
  pages: 837,
  language: "ro",
  series: null,
  seriesNumber: null,
  description: null,
  subjects: [],
  collection: "owned",
  format: "hardcover",
  condition: "good",
  shelf: "Living room · A2",
  signed: false,
  status: "read",
  rating: 5,
  notes: null,
  acquiredOn: "2016-03-01",
  acquiredFrom: "Cărturești",
  priceMinor: 5990,
  currency: "RON",
  metadataSource: "manual",
  tags: ["Romanian"],
  hasCover: false,
  coverUpdatedAt: null,
  createdAt: "2026-10-14T09:00:00.000Z",
  updatedAt: "2026-10-14T09:00:00.000Z",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function apiError(status: number, code: string, message = code): Response {
  return json(status, { error: { code, message } });
}

let calls: { url: string; init: RequestInit }[];
let signedOutCount: number;
let stopListening: () => void;

function serve(handler: (url: string, init: RequestInit) => Response | Promise<Response>): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push({ url, init });
      return handler(url, init);
    }),
  );
}

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

beforeEach(() => {
  calls = [];
  signedOutCount = 0;
  stopListening = onSignedOut(() => {
    signedOutCount += 1;
  });
});

afterEach(() => {
  stopListening();
  vi.unstubAllGlobals();
});

describe("the books routes", () => {
  it("lists the books from under /shelfmark-api", async () => {
    serve(() => json(200, { books: [book] }));
    expect(await booksApi.list()).toEqual([book]);
    expect(calls[0]?.url).toBe("/shelfmark-api/api/books");
    expect(calls[0]?.init.method).toBe("GET");
    expect(calls[0]?.init.credentials).toBe("same-origin");
    expect(calls[0]?.init.body).toBeUndefined();
  });

  it("posts only the fields given, as JSON", async () => {
    serve(() => json(201, { ...book, id: 2 }));
    const created = await booksApi.create({ title: "Solenoid", shelf: "Bedroom" });
    expect(created.id).toBe(2);
    const call = calls[0];
    expect(call?.url).toBe("/shelfmark-api/api/books");
    expect(call?.init.method).toBe("POST");
    expect(call?.init.body).toBe(JSON.stringify({ title: "Solenoid", shelf: "Bedroom" }));
    expect((call?.init.headers as Record<string, string>)["content-type"]).toBe("application/json");
  });

  it("patches one book with just the change, and gets one", async () => {
    serve((_url, init) => json(200, init.method === "PATCH" ? { ...book, status: "reading" } : book));
    expect((await booksApi.patch(1, { status: "reading" })).status).toBe("reading");
    expect(calls[0]?.url).toBe("/shelfmark-api/api/books/1");
    expect(calls[0]?.init.method).toBe("PATCH");
    expect(calls[0]?.init.body).toBe('{"status":"reading"}');
    expect(await booksApi.get(1)).toEqual(book);
  });

  it("deletes with a 204 and no body", async () => {
    serve(() => new Response(null, { status: 204 }));
    await expect(booksApi.remove(1)).resolves.toBeUndefined();
    expect(calls[0]?.init.method).toBe("DELETE");
  });

  it("posts a bulk change and reads what it did", async () => {
    serve(() => json(200, { books: [{ ...book, shelf: "Bedroom · B1" }], deleted: [], skipped: [2] }));
    const result = await booksApi.bulk({ ids: [1, 2], change: { kind: "shelf", shelf: "Bedroom · B1" } });
    expect(result).toEqual({ books: [{ ...book, shelf: "Bedroom · B1" }], deleted: [], skipped: [2] });
    expect(calls[0]?.url).toBe("/shelfmark-api/api/books/bulk");
    expect(calls[0]?.init.method).toBe("POST");
    expect(calls[0]?.init.body).toBe('{"ids":[1,2],"change":{"kind":"shelf","shelf":"Bedroom · B1"}}');
  });

  it("refuses an answer that isn't a book", async () => {
    serve(() => json(200, { books: [{ ...book, authors: "Mircea Cărtărescu" }] }));
    const error = await failure(booksApi.list());
    expect(error.code).toBe("bad_response");
    expect(error.status).toBe(200);
  });

  it("knows where a cover is, and how to get past a cached one", () => {
    expect(coverUrl(7)).toBe("/shelfmark-api/api/books/7/cover");
    expect(coverUrl(7, null)).toBe("/shelfmark-api/api/books/7/cover");
    expect(coverUrl(7, "2026-10-14T09:00:00.000Z")).toBe("/shelfmark-api/api/books/7/cover?v=2026-10-14T09%3A00%3A00.000Z");
    expect(coverPath(7, "2026-10-14T09:00:00.000Z")).toBe("/api/books/7/cover?v=2026-10-14T09%3A00%3A00.000Z");
  });

  it("fetches a cover's bytes, and a 401 there signs out like any call", async () => {
    serve(() => new Response(new Uint8Array([0xff, 0xd8, 0xff]), { status: 200, headers: { "content-type": "image/jpeg" } }));
    const image = await apiBlob(coverPath(7, "2026-10-14T09:00:00.000Z"));
    expect(image.type).toBe("image/jpeg");
    expect(image.size).toBe(3);
    expect(calls[0]?.url).toBe("/shelfmark-api/api/books/7/cover?v=2026-10-14T09%3A00%3A00.000Z");
    expect(calls[0]?.init.credentials).toBe("same-origin");

    serve(() => new Response(null, { status: 401 }));
    expect((await failure(apiBlob(coverPath(7)))).code).toBe("signed_out");
    expect(signedOutCount).toBe(1);

    serve(() => json(404, { error: { code: "not_found", message: "This book has no cover." } }));
    expect(await failure(apiBlob(coverPath(7)))).toMatchObject({ status: 404, code: "not_found" });
  });
});

describe("errors", () => {
  it("carry the server's code, message and status", async () => {
    serve(() => apiError(400, "validation", "isbn13: must be 13 digits starting with 978 or 979"));
    const error = await failure(booksApi.create({ title: "t", isbn13: "123" }));
    expect(error).toMatchObject({
      status: 400,
      code: "validation",
      message: "isbn13: must be 13 digits starting with 978 or 979",
    });
    expect(isApiError(error, "validation")).toBe(true);
    expect(isApiError(error, "not_found")).toBe(false);
    expect(signedOutCount).toBe(0);
  });

  it("stand in for a proxy's page in front of a stopped API", async () => {
    serve(() => new Response("<html>502 Bad Gateway</html>", { status: 502, headers: { "content-type": "text/html" } }));
    const error = await failure(booksApi.list());
    expect(error.status).toBe(502);
    expect(error.code).toBe("bad_response");
    expect(error.message).toMatch(/isn't answering/);
  });

  it("say when there was no answer at all", async () => {
    serve(() => Promise.reject(new TypeError("Failed to fetch")));
    const error = await failure(booksApi.list());
    expect(error.status).toBe(0);
    expect(error.code).toBe("network");
    expect(error.cause).toBeInstanceOf(TypeError);
  });

  it("let an abort through as itself", async () => {
    const controller = new AbortController();
    const reason = new DOMException("Stopped", "AbortError");
    serve(() => {
      controller.abort(reason);
      return Promise.reject(reason);
    });
    await expect(booksApi.list({ signal: controller.signal })).rejects.toBe(reason);
  });
});

describe("a 401", () => {
  it("raises the signed-out signal, whatever the body, and fails the call", async () => {
    serve(() => json(401, { error: "unauthorized" }));
    const error = await failure(booksApi.list());
    expect(error).toMatchObject({ status: 401, code: "signed_out" });
    expect(signedOutCount).toBe(1);
    expect(calls).toHaveLength(1); // no retry
  });

  it("tells every listener until it unsubscribes", async () => {
    serve(() => new Response(null, { status: 401 }));
    let other = 0;
    const stop = onSignedOut(() => {
      other += 1;
    });
    await failure(booksApi.get(1));
    stop();
    await failure(booksApi.get(1));
    expect(other).toBe(1);
    expect(signedOutCount).toBe(2);
  });

  it("is the call's own answer with noSignOut (a login form's wrong password)", async () => {
    serve(() => apiError(401, "unauthorized", "Wrong username or password"));
    const error = await failure(apiRequest("/auth/login", { method: "POST", body: { username: "u" }, noSignOut: true }));
    expect(error).toMatchObject({ status: 401, code: "unauthorized", message: "Wrong username or password" });
    expect(signedOutCount).toBe(0);
  });
});

describe("apiRequest", () => {
  it("sends a Blob as it is, with its own type", async () => {
    serve(() => new Response(null, { status: 204 }));
    const image = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" });
    await apiRequest("/api/books/1/cover", { method: "PUT", body: image });
    expect(calls[0]?.init.body).toBe(image);
    expect((calls[0]?.init.headers as Record<string, string>)["content-type"]).toBe("image/jpeg");
  });

  it("ignores the body of an answer it wasn't asked to read", async () => {
    serve(() => json(200, { ok: true }));
    await expect(apiRequest("/api/health")).resolves.toBeUndefined();
  });
});
