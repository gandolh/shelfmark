import { bookCreateSchema } from "@shelfmark/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "../db/open.js";
import { fakeFetch, json, recordedInternet, type FakeHandler } from "../testing/fakeFetch.js";
import { createLookupCache, NOT_FOUND_TTL_MS } from "./cache.js";
import { createGoogleBooksSource, readGoogleBooks } from "./googlebooks.js";
import { createLookup, emptySourceDraft, isThin, mergeDrafts, text, yearOf, type SourceDraft } from "./merge.js";
import { createOpenLibrarySource } from "./openlibrary.js";
import { createQueue } from "./queue.js";

const HOBBIT = "9780547928227"; // Open Library: complete
const OMUL = "9789735066109"; // Open Library: no cover; Google: a cover
const UNKNOWN = "9786063205583"; // nowhere

let db: Db;
let clock: Date;

beforeEach(() => {
  db = openDb(":memory:");
  clock = new Date("2026-10-15T08:00:00.000Z");
});

afterEach(() => {
  db.close();
});

/** The lookup as the route builds it, over a fake fetch and an instant queue. */
function setup(handler: FakeHandler = recordedInternet, { withKey = true } = {}) {
  const fetch = fakeFetch(handler);
  const apiKey = withKey ? "test-key" : undefined;
  const errors: string[] = [];
  const lookup = createLookup({
    sources: [
      createOpenLibrarySource({ fetch, queue: createQueue(0) }),
      createGoogleBooksSource({ apiKey, fetch, queue: createQueue(0) }),
    ],
    cache: createLookupCache(db, () => clock),
    onError: (source, isbn13, error) => errors.push(`${source} ${isbn13}: ${(error as Error).message}`),
  });
  const hosts = () => fetch.calls.map((call) => call.url.host);
  return { lookup, fetch, errors, hosts };
}

function source(fields: Partial<SourceDraft>): SourceDraft {
  return { ...emptySourceDraft(), ...fields };
}

describe("mergeDrafts", () => {
  const ol = source({
    title: "Inocentii",
    authors: ["Ioana Parvulescu"],
    pages: 348,
    coverCandidates: [{ url: "https://covers.openlibrary.org/b/id/10842140-L.jpg", source: "openlibrary" }],
  });
  const google = source({
    title: "Inocenții",
    subtitle: "Roman",
    authors: ["Ioana Pârvulescu"],
    pages: 350,
    language: "ro",
    description: "Un roman.",
    coverCandidates: [{ url: "https://books.google.com/books/content?id=x", source: "googlebooks" }],
  });

  it("takes Open Library's value first and lets Google fill the gaps, field by field", () => {
    expect(
      mergeDrafts("9789735054694", [
        { source: "openlibrary", draft: ol },
        { source: "googlebooks", draft: google },
      ]),
    ).toEqual({
      isbn13: "9789735054694",
      title: "Inocentii",
      subtitle: "Roman",
      authors: ["Ioana Parvulescu"],
      publisher: null,
      publishedYear: null,
      pages: 348,
      language: "ro",
      description: "Un roman.",
      subjects: [],
      coverCandidates: [
        { url: "https://covers.openlibrary.org/b/id/10842140-L.jpg", source: "openlibrary" },
        { url: "https://books.google.com/books/content?id=x", source: "googlebooks" },
      ],
      source: "both",
    });
  });

  it("names the one source that supplied values", () => {
    expect(mergeDrafts("9789735054694", [{ source: "openlibrary", draft: ol }])?.source).toBe("openlibrary");
    expect(
      mergeDrafts("9789735054694", [
        { source: "openlibrary", draft: null },
        { source: "googlebooks", draft: google },
      ])?.source,
    ).toBe("googlebooks");
    // Google found the book but had nothing Open Library lacked.
    expect(
      mergeDrafts("9789735054694", [
        { source: "openlibrary", draft: ol },
        { source: "googlebooks", draft: source({ title: "Inocenții", pages: 1 }) },
      ])?.source,
    ).toBe("openlibrary");
  });

  it("is null when no source found the book", () => {
    expect(mergeDrafts(UNKNOWN, [])).toBeNull();
    expect(
      mergeDrafts(UNKNOWN, [
        { source: "openlibrary", draft: null },
        { source: "googlebooks", draft: null },
      ]),
    ).toBeNull();
  });

  it("calls an answer thin without a title or without a cover", () => {
    expect(isThin(null)).toBe(true);
    expect(isThin(source({ title: "Inocentii" }))).toBe(true);
    expect(isThin(source({ coverCandidates: ol.coverCandidates }))).toBe(true);
    expect(isThin(ol)).toBe(false);
  });
});

describe("text helpers", () => {
  it("finds the year in any date string", () => {
    expect(yearOf("2012")).toBe(2012);
    expect(yearOf("2012-09-18")).toBe(2012);
    expect(yearOf("Apr 07, 2016")).toBe(2016);
    expect(yearOf("[c1995]")).toBe(1995);
    expect(yearOf("12345")).toBeNull();
    expect(yearOf("n.d.")).toBeNull();
    expect(yearOf(undefined)).toBeNull();
  });

  it("trims, folds whitespace and cuts to the schema's limits", () => {
    expect(text("  The   Hobbit \n")).toBe("The Hobbit");
    expect(text("   ")).toBeNull();
    expect(text(42)).toBeNull();
    expect(text("x".repeat(600))).toHaveLength(500);
  });

  it("makes a draft that bookCreateSchema accepts as it is, even from an oversized answer", () => {
    const volume = {
      title: "T".repeat(5000),
      authors: Array.from({ length: 300 }, (_, i) => `Author ${i}`),
      description: "D".repeat(50_000),
      categories: ["Fiction", "fiction", " ", "Fiction / Fantasy"],
      pageCount: 300,
      language: "ro",
    };
    const huge = readGoogleBooks(HOBBIT, { items: [{ volumeInfo: volume }] });
    expect(huge?.authors).toHaveLength(100);
    expect(huge?.subjects).toEqual(["Fiction", "Fiction / Fantasy"]);
    const draft = mergeDrafts(HOBBIT, [{ source: "googlebooks", draft: huge }])!;
    const { coverCandidates: _covers, source: _source, title, ...fields } = draft;
    expect(() => bookCreateSchema.parse({ ...fields, title })).not.toThrow();
  });
});

describe("createLookup", () => {
  it("does not ask Google when Open Library's answer is complete", async () => {
    const { lookup, hosts } = setup();
    const { draft, tried } = await lookup.lookup(HOBBIT);
    expect(tried).toEqual([{ source: "openlibrary", outcome: "found" }]);
    expect(draft?.source).toBe("openlibrary");
    expect(draft?.coverCandidates[0]?.url).toBe("https://covers.openlibrary.org/b/id/12003329-L.jpg");
    expect(hosts()).toEqual(["openlibrary.org", "openlibrary.org"]);
  });

  it("asks Google when Open Library came back thin, and merges", async () => {
    const { lookup, hosts } = setup();
    const { draft, tried } = await lookup.lookup(OMUL);
    expect(tried).toEqual([
      { source: "openlibrary", outcome: "found" },
      { source: "googlebooks", outcome: "found" },
    ]);
    expect(hosts()).toEqual(["openlibrary.org", "openlibrary.org", "www.googleapis.com"]);
    expect(draft).toMatchObject({
      title: "Omul care mută norii", // Open Library's
      subtitle: "şapte întâmplări", // Open Library's, though Google spells it otherwise
      pages: 258, // Open Library's 258, not Google's 260
      description: "Șapte povestiri despre oameni obișnuiți.", // Google's: Open Library had none
      subjects: ["Fiction"], // Google's
      source: "both",
    });
    expect(draft?.coverCandidates).toEqual([
      {
        url: "https://books.google.com/books/content?id=fixtureOmul1&printsec=frontcover&img=1&zoom=1&source=gbs_api",
        source: "googlebooks",
      },
    ]);
  });

  it("reports Google skipped_no_key when it was needed and there is no key", async () => {
    const { lookup, hosts } = setup(recordedInternet, { withKey: false });
    const thin = await lookup.lookup(OMUL);
    expect(thin.tried).toEqual([
      { source: "openlibrary", outcome: "found" },
      { source: "googlebooks", outcome: "skipped_no_key" },
    ]);
    expect(thin.draft?.coverCandidates).toEqual([]);
    expect(thin.draft?.source).toBe("openlibrary");

    const missing = await lookup.lookup(UNKNOWN);
    expect(missing).toEqual({
      draft: null,
      tried: [
        { source: "openlibrary", outcome: "not_found" },
        { source: "googlebooks", outcome: "skipped_no_key" },
      ],
    });
    expect(hosts().every((host) => host === "openlibrary.org")).toBe(true);
  });

  it("asks Google when Open Library fails, and says so", async () => {
    const { lookup, errors } = setup((url, init) =>
      url.host === "openlibrary.org" ? json({}, 503) : recordedInternet(url, init),
    );
    const { draft, tried } = await lookup.lookup(HOBBIT);
    expect(tried).toEqual([
      { source: "openlibrary", outcome: "error" },
      { source: "googlebooks", outcome: "found" },
    ]);
    expect(draft?.source).toBe("googlebooks");
    expect(errors).toEqual([`openlibrary ${HOBBIT}: Open Library answered 503`]);
  });

  it("answers a second lookup from the cache, with no request", async () => {
    const { lookup, fetch } = setup();
    const first = await lookup.lookup(OMUL);
    const requests = fetch.calls.length;
    const second = await lookup.lookup(OMUL);
    expect(fetch.calls).toHaveLength(requests);
    expect(second).toEqual(first);
  });

  it("reuses a found answer years later", async () => {
    const { lookup, fetch } = setup();
    await lookup.lookup(HOBBIT);
    clock = new Date("2036-10-15T08:00:00.000Z");
    fetch.calls.length = 0;
    expect((await lookup.lookup(HOBBIT)).tried).toEqual([{ source: "openlibrary", outcome: "found" }]);
    expect(fetch.calls).toHaveLength(0);
  });

  it("asks again about a not-found ISBN after 7 days", async () => {
    const { lookup, fetch } = setup();
    await lookup.lookup(UNKNOWN);
    expect(fetch.calls).toHaveLength(2); // Open Library's data call, Google's search

    clock = new Date(clock.getTime() + NOT_FOUND_TTL_MS - 60_000);
    await lookup.lookup(UNKNOWN);
    expect(fetch.calls).toHaveLength(2);

    clock = new Date(clock.getTime() + 120_000);
    const again = await lookup.lookup(UNKNOWN);
    expect(fetch.calls).toHaveLength(4);
    expect(again.tried).toEqual([
      { source: "openlibrary", outcome: "not_found" },
      { source: "googlebooks", outcome: "not_found" },
    ]);
  });

  it("never caches an error: the next lookup asks again", async () => {
    let down = true;
    const { lookup, fetch } = setup((url, init) => (down ? json({}, 503) : recordedInternet(url, init)));
    const failed = await lookup.lookup(HOBBIT);
    expect(failed).toEqual({
      draft: null,
      tried: [
        { source: "openlibrary", outcome: "error" },
        { source: "googlebooks", outcome: "error" },
      ],
    });
    expect(db.prepare("SELECT COUNT(*) AS n FROM lookup_cache").get()).toEqual({ n: 0 });

    down = false;
    const before = fetch.calls.length;
    const recovered = await lookup.lookup(HOBBIT);
    expect(fetch.calls.length).toBeGreaterThan(before);
    expect(recovered.tried).toEqual([{ source: "openlibrary", outcome: "found" }]);
  });

  it("counts an error on Open Library's second call as an error, so a half answer is never cached", async () => {
    const { lookup } = setup((url, init) =>
      url.searchParams.get("jscmd") === "details" ? json({}, 500) : recordedInternet(url, init),
    );
    const { tried } = await lookup.lookup(HOBBIT);
    expect(tried[0]).toEqual({ source: "openlibrary", outcome: "error" });
    expect(db.prepare("SELECT source FROM lookup_cache").all()).toEqual([{ source: "googlebooks" }]);
  });
});
