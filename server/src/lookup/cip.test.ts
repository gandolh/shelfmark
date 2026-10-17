import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openCipStore, type CipStore } from "../cip/store.js";
import { openDb, type Db } from "../db/open.js";
import { fakeFetch, recordedInternet } from "../testing/fakeFetch.js";
import { createLookupCache } from "./cache.js";
import { createCipSource, readCip } from "./cip.js";
import { createGoogleBooksSource } from "./googlebooks.js";
import { createLookup } from "./merge.js";
import { createOpenLibrarySource } from "./openlibrary.js";
import { createQueue } from "./queue.js";

let db: Db;
let store: CipStore;

beforeEach(() => {
  db = openDb(":memory:");
  store = openCipStore(":memory:");
  store.importIssue({ month: "2026-02", url: "https://bibnat.ro/x/CIP_februarie-2026.pdf", uploaded: "2026-08-18" }, [
    {
      isbn13: "9786063205583",
      entry: 9,
      title: "Isidor",
      subtitle: "roman",
      authors: ["Ana Pop"],
      publisher: "Polirom",
      city: "Iași",
      year: 2026,
    },
  ]);
});
afterEach(() => {
  store.close();
  db.close();
});

describe("the CIP source", () => {
  it("reads a stored record as draft fields: no language, pages or cover", () => {
    expect(readCip("9786063205583", store.get("9786063205583"))).toEqual({
      title: "Isidor",
      subtitle: "roman",
      authors: ["Ana Pop"],
      publisher: "Polirom",
      publishedYear: 2026,
      pages: null,
      language: null,
      description: null,
      subjects: [],
      coverCandidates: [],
    });
    expect(readCip("9786063205583", null)).toBeNull();
  });

  it("answers before Google, which is then not asked, and never goes in the lookup cache", async () => {
    const fetch = fakeFetch(recordedInternet);
    const lookup = createLookup({
      sources: [
        createOpenLibrarySource({ fetch, queue: createQueue(0) }),
        createCipSource(store),
        createGoogleBooksSource({ apiKey: "test-key", fetch, queue: createQueue(0) }),
      ],
      cache: createLookupCache(db),
    });
    const { draft, tried } = await lookup.lookup("9786063205583");
    expect(tried).toEqual([
      { source: "openlibrary", outcome: "not_found" },
      { source: "cip", outcome: "found" },
    ]);
    expect(draft).toMatchObject({ title: "Isidor", sources: ["cip"] });
    expect(fetch.calls.some((call) => call.url.host === "www.googleapis.com")).toBe(false);
    expect(db.prepare("SELECT source FROM lookup_cache").all()).toEqual([{ source: "openlibrary" }]);
  });
});
