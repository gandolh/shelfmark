import { existsSync, readFileSync } from "node:fs";

/**
 * A fake `fetch` for tests, so none touches the network. It records each call
 * and answers from a handler; `recordedInternet` is a handler that answers
 * Open Library and Google Books from `lookup/fixtures/*.json` and serves the
 * cover hosts as they behaved on 2026-10-15 (Open Library's covers redirect
 * through archive.org).
 *
 *     const fetch = fakeFetch(recordedInternet);
 *     const t = await startTestApp({}, { fetch });
 *     // ... fetch.calls
 */

const FIXTURES = new URL("../lookup/fixtures/", import.meta.url);

export function hasFixture(name: string): boolean {
  return existsSync(new URL(`${name}.json`, FIXTURES));
}

/** `lookup/fixtures/<name>.json`, parsed. */
export function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`${name}.json`, FIXTURES), "utf8"));
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export function redirect(location: string, status = 302): Response {
  return new Response(null, { status, headers: { location } });
}

/** Bytes that sniff as the type: the magic number, then filler. */
export function imageBytes(mime: "image/jpeg" | "image/png" | "image/webp", size = 1024): Buffer {
  const magic = {
    "image/jpeg": [0xff, 0xd8, 0xff, 0xe0],
    "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    "image/webp": [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50],
  }[mime];
  const bytes = Buffer.alloc(Math.max(size, magic.length), 0x2a);
  Buffer.from(magic).copy(bytes);
  return bytes;
}

export function image(bytes: Buffer, mime = "image/jpeg"): Response {
  return new Response(new Uint8Array(bytes), {
    headers: { "content-type": mime, "content-length": String(bytes.length) },
  });
}

export interface FetchCall {
  url: URL;
  headers: Headers;
  redirect: RequestInit["redirect"];
}

export type FakeFetch = typeof globalThis.fetch & { calls: FetchCall[] };

export type FakeHandler = (url: URL, init: RequestInit | undefined) => Response | undefined | Promise<Response | undefined>;

/** Calls `handler` for each request; a request it returns nothing for fails like an unreachable host. */
export function fakeFetch(handler: FakeHandler): FakeFetch {
  const calls: FetchCall[] = [];
  const fetch = (async (input: Parameters<typeof globalThis.fetch>[0], init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    calls.push({ url, headers: new Headers(init?.headers), redirect: init?.redirect });
    init?.signal?.throwIfAborted();
    const response = await handler(url, init);
    if (!response) throw new TypeError(`fetch failed (the fake has no answer for ${url.host})`);
    return response;
  }) as FakeFetch;
  fetch.calls = calls;
  return fetch;
}

/** A request that never answers until its signal aborts it, as a host that hangs. */
export function hang(init: RequestInit | undefined): Promise<Response> {
  return new Promise((_resolve, reject) => {
    const signal = init?.signal;
    if (!signal) return;
    signal.addEventListener("abort", () => reject(signal.reason as Error), { once: true });
  });
}

/** The cover each fake cover host serves. */
export const RECORDED_COVER = imageBytes("image/jpeg", 4096);

/**
 * Open Library and Google Books as recorded: an ISBN with a fixture gets it,
 * any other is unknown to both. Cover URLs on covers.openlibrary.org redirect
 * to archive.org and then to an ia node, as the live host does; Google's
 * cover host answers directly.
 */
export const recordedInternet: FakeHandler = (url) => {
  if (url.origin === "https://openlibrary.org" && url.pathname === "/api/books") {
    const isbn = (url.searchParams.get("bibkeys") ?? "").replace(/^ISBN:/, "");
    const name = `openlibrary-${url.searchParams.get("jscmd")}-${isbn}`;
    return json(hasFixture(name) ? fixture(name) : {});
  }
  if (url.origin === "https://www.googleapis.com" && url.pathname === "/books/v1/volumes") {
    const isbn = (url.searchParams.get("q") ?? "").replace(/^isbn:/, "");
    const name = `googlebooks-${isbn}`;
    return json(hasFixture(name) ? fixture(name) : { kind: "books#volumes", totalItems: 0 });
  }
  const coverId = /^\/b\/id\/(\d+)-L\.jpg$/.exec(url.pathname)?.[1];
  if (url.origin === "https://covers.openlibrary.org" && coverId) {
    return redirect(`https://archive.org/download/l_covers_0012/l_covers_0012_00.zip/00${coverId}-L.jpg`);
  }
  if (url.origin === "https://archive.org" && url.pathname.startsWith("/download/l_covers_")) {
    return redirect(
      `https://ia600100.us.archive.org/view_archive.php?archive=/5/items/l_covers_0012/l_covers_0012_00.zip&file=${url.pathname.split("/").pop()}`,
    );
  }
  if (url.origin === "https://ia600100.us.archive.org") return image(RECORDED_COVER);
  if (url.origin === "https://books.google.com" && url.pathname === "/books/content") return image(RECORDED_COVER);
  return undefined;
};
