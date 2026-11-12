import { lookupResponseSchema, type LookupResponse } from "@shelfmark/shared";
import { isDeepStrictEqual } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "../../db/open.js";
import { fakeFetch, recordedInternet } from "../../testing/fakeFetch.js";
import { fakeLibraries } from "../../testing/fakeLibraries.js";
import { serializationFailure, serialize } from "../../testing/serialize.js";
import { createLookupCache } from "./cache.js";
import { createGoogleBooksSource } from "./googlebooks.js";
import { createLibrarySource, LIBRARY_ORDER } from "./libraries.js";
import { createLookup } from "./merge.js";
import { createOpenLibrarySource } from "./openlibrary.js";
import { createQueue } from "./queue.js";

const HOBBIT = "9780547928227"; // Open Library and Google Books: a complete draft
const PIRAMIDA = "9786068044873"; // the library catalogs only
const UNKNOWN = "9786063205583"; // nowhere: no draft

let db: Db;

beforeEach(() => {
  db = openDb(":memory:");
});

afterEach(() => {
  db.close();
});

/** What `POST /api/lookup` sends for an ISBN: the real merge over the recorded sources, nothing owned. */
async function reply(isbn13: string): Promise<LookupResponse> {
  const fetch = fakeFetch(recordedInternet);
  const catalogs = fakeLibraries(["biblacad-piramida"]);
  const lookup = createLookup({
    sources: [
      createOpenLibrarySource({ fetch, queue: createQueue(0) }),
      ...LIBRARY_ORDER.map((library) =>
        createLibrarySource(library, { connect: catalogs.connect, queue: createQueue(0) }),
      ),
      createGoogleBooksSource({ apiKey: "test-key", fetch, queue: createQueue(0) }),
    ],
    cache: createLookupCache(db),
    onError: () => undefined,
  });
  const { draft, tried } = await lookup.lookup(isbn13);
  return {
    isbn13,
    draft,
    tried,
    owned: [{ id: 1, shelf: "B2", createdAt: "2026-11-12T08:00:00.000Z" }],
    wishlisted: [{ id: 2 }],
  };
}

describe("the lookup reply through its response schema", () => {
  it("sends a complete draft, a library-only draft and no draft byte for byte as before", async () => {
    for (const isbn of [HOBBIT, PIRAMIDA, UNKNOWN]) {
      const body = await reply(isbn);
      expect(serialize(lookupResponseSchema, body)).toBe(JSON.stringify(body));
    }
  });

  it("really holds a draft for the first two and none for the last", async () => {
    expect((await reply(HOBBIT)).draft?.title).toBe("The Hobbit");
    expect((await reply(PIRAMIDA)).draft).not.toBeNull();
    expect((await reply(UNKNOWN)).draft).toBeNull();
  });

  it("strips a field it doesn't declare, at the top and inside a copy", async () => {
    const body = await reply(HOBBIT);
    const stripped = JSON.parse(
      serialize(lookupResponseSchema, { ...body, cacheKey: "x", owned: [{ ...body.owned[0], addedBy: "me" }] }),
    ) as unknown;
    expect(isDeepStrictEqual(stripped, JSON.parse(JSON.stringify(body)))).toBe(true);
  });

  it("refuses an ISBN or a time out of shape, which would be a 500", async () => {
    const body = await reply(HOBBIT);
    expect(serializationFailure(lookupResponseSchema, { ...body, isbn13: "123" })).toBeTruthy();
    expect(
      serializationFailure(lookupResponseSchema, { ...body, owned: [{ id: 1, shelf: null, createdAt: "yesterday" }] }),
    ).toBeTruthy();
    expect(
      serializationFailure(lookupResponseSchema, { ...body, tried: [{ source: "nowhere", outcome: "ok" }] }),
    ).toBeTruthy();
  });
});
