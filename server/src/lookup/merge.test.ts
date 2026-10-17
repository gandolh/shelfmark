import { bookCreateSchema } from "@shelfmark/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "../db/open.js";
import { fakeFetch, json, recordedInternet, type FakeHandler } from "../testing/fakeFetch.js";
import { createLookupCache, NOT_FOUND_TTL_MS } from "./cache.js";
import { createGoogleBooksSource, readGoogleBooks } from "./googlebooks.js";
import { fakeLibraries, type FixtureName } from "../testing/fakeLibraries.js";
import { createLibrarySource, LIBRARY_ORDER } from "./libraries.js";
import { createLookup, emptySourceDraft, mergeDrafts, text, yearOf, type SourceDraft } from "./merge.js";
import { createOpenLibrarySource } from "./openlibrary.js";
import { createQueue } from "./queue.js";

const HOBBIT = "9780547928227"; // Open Library: complete
const OMUL = "9789735066109"; // Open Library: no cover; Google: a cover
const UNKNOWN = "9786063205583"; // nowhere
const PIRAMIDA = "9786068044873"; // the library catalogs only

let db: Db;
let clock: Date;

beforeEach(() => {
  db = openDb(":memory:");
  clock = new Date("2026-10-15T08:00:00.000Z");
});

afterEach(() => {
  db.close();
});

/**
 * The lookup as the route builds it, over a fake fetch and instant queues.
 * The library catalogs are in it only when `libraries` is given: the fixtures
 * they answer from, every other ISBN being "0 hits".
 */
function setup(
  handler: FakeHandler = recordedInternet,
  { withKey = true, libraries }: { withKey?: boolean; libraries?: FixtureName[] } = {},
) {
  const fetch = fakeFetch(handler);
  const apiKey = withKey ? "test-key" : undefined;
  const errors: string[] = [];
  const catalogs = fakeLibraries(libraries ?? []);
  const lookup = createLookup({
    sources: [
      createOpenLibrarySource({ fetch, queue: createQueue(0) }),
      ...(libraries
        ? LIBRARY_ORDER.map((library) => createLibrarySource(library, { connect: catalogs.connect, queue: createQueue(0) }))
        : []),
      createGoogleBooksSource({ apiKey, fetch, queue: createQueue(0) }),
    ],
    cache: createLookupCache(db, () => clock),
    onError: (source, isbn13, error) => errors.push(`${source} ${isbn13}: ${(error as Error).message}`),
  });
  const hosts = () => fetch.calls.map((call) => call.url.host);
  return { lookup, fetch, errors, hosts, catalogs };
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
      sources: ["openlibrary", "googlebooks"],
    });
  });

  it("names the one source that supplied values", () => {
    expect(mergeDrafts("9789735054694", [{ source: "openlibrary", draft: ol }])?.sources).toEqual(["openlibrary"]);
    expect(
      mergeDrafts("9789735054694", [
        { source: "openlibrary", draft: null },
        { source: "bcucluj", draft: null },
        { source: "googlebooks", draft: google },
      ])?.sources,
    ).toEqual(["googlebooks"]);
    // Google found the book but had nothing Open Library lacked.
    expect(
      mergeDrafts("9789735054694", [
        { source: "openlibrary", draft: ol },
        { source: "googlebooks", draft: source({ title: "Inocenții", pages: 1 }) },
      ])?.sources,
    ).toEqual(["openlibrary"]);
    // A source that found the book with nothing at all still names it.
    expect(mergeDrafts("9789735054694", [{ source: "biblacad", draft: source({}) }])?.sources).toEqual(["biblacad"]);
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
    const { coverCandidates: _covers, sources: _sources, title, ...fields } = draft;
    expect(() => bookCreateSchema.parse({ ...fields, title })).not.toThrow();
  });
});

describe("createLookup", () => {
  it("does not ask Google when Open Library's answer is complete", async () => {
    const { lookup, hosts } = setup();
    const { draft, tried } = await lookup.lookup(HOBBIT);
    expect(tried).toEqual([{ source: "openlibrary", outcome: "found" }]);
    expect(draft?.sources).toEqual(["openlibrary"]);
    expect(draft?.coverCandidates[0]?.url).toBe("https://covers.openlibrary.org/b/id/12003329-L.jpg");
    expect(hosts()).toEqual(["openlibrary.org", "openlibrary.org"]);
  });

  it("does not ask Google just for a missing cover (decisions.md, 2026-10-17)", async () => {
    const { lookup, hosts } = setup();
    const { draft, tried } = await lookup.lookup(OMUL);
    expect(tried).toEqual([{ source: "openlibrary", outcome: "found" }]);
    expect(hosts()).toEqual(["openlibrary.org", "openlibrary.org"]);
    expect(draft).toMatchObject({ title: "Omul care mută norii", pages: 258, coverCandidates: [], sources: ["openlibrary"] });
  });

  it("asks Google when nothing earlier found a title, and merges", async () => {
    // Open Library knows the ISBN but has no title for it.
    const { lookup, hosts } = setup((url, init) =>
      url.host === "openlibrary.org" && url.searchParams.get("jscmd") === "data"
        ? json({ [`ISBN:${OMUL}`]: { number_of_pages: 258 } })
        : url.host === "openlibrary.org"
          ? json({})
          : recordedInternet(url, init),
    );
    const { draft, tried } = await lookup.lookup(OMUL);
    expect(tried).toEqual([
      { source: "openlibrary", outcome: "found" },
      { source: "googlebooks", outcome: "found" },
    ]);
    expect(hosts()).toEqual(["openlibrary.org", "openlibrary.org", "www.googleapis.com"]);
    expect(draft).toMatchObject({
      title: "Omul care mută norii", // Google's: Open Library had none
      pages: 258, // Open Library's 258, not Google's 260
      description: "Șapte povestiri despre oameni obișnuiți.", // Google's
      sources: ["openlibrary", "googlebooks"],
    });
    expect(draft?.coverCandidates).toEqual([
      {
        url: "https://books.google.com/books/content?id=fixtureOmul1&printsec=frontcover&img=1&zoom=1&source=gbs_api",
        source: "googlebooks",
      },
    ]);
  });

  it("asks the library catalogs in order when Open Library misses, and stops at the first title", async () => {
    const { lookup, hosts, catalogs } = setup(recordedInternet, { libraries: ["bcucluj-piramida"] });
    const { draft, tried } = await lookup.lookup(PIRAMIDA);
    expect(tried).toEqual([
      { source: "openlibrary", outcome: "not_found" },
      { source: "biblacad", outcome: "not_found" },
      { source: "bcucluj", outcome: "found" },
    ]);
    expect(catalogs.calls.map((call) => call.library)).toEqual(["biblacad", "bcucluj"]);
    expect(hosts()).toEqual(["openlibrary.org"]); // Google is never asked
    expect(draft).toMatchObject({ title: "Piramida roșie", pages: 543, sources: ["bcucluj"] });
  });

  it("goes on to the next library, and to Google, when a library fails", async () => {
    const fetch = fakeFetch(recordedInternet);
    const catalogs = fakeLibraries([], { refused: ["biblacad", "bcucluj", "bcutimisoara"] });
    const errors: string[] = [];
    const lookup = createLookup({
      sources: [
        createOpenLibrarySource({ fetch, queue: createQueue(0) }),
        ...LIBRARY_ORDER.map((library) => createLibrarySource(library, { connect: catalogs.connect, queue: createQueue(0) })),
        createGoogleBooksSource({ apiKey: "test-key", fetch, queue: createQueue(0) }),
      ],
      cache: createLookupCache(db, () => clock),
      onError: (source) => errors.push(source),
    });
    const { draft, tried } = await lookup.lookup(HOBBIT);
    expect(tried.map((t) => t.outcome)).toEqual(["found"]); // Open Library had it: nobody else asked
    expect(draft?.title).toBe("The Hobbit");

    const missing = await lookup.lookup(UNKNOWN);
    expect(missing.tried).toEqual([
      { source: "openlibrary", outcome: "not_found" },
      { source: "biblacad", outcome: "error" },
      { source: "bcucluj", outcome: "error" },
      { source: "bcutimisoara", outcome: "error" },
      { source: "googlebooks", outcome: "not_found" },
    ]);
    expect(errors).toEqual(["biblacad", "bcucluj", "bcutimisoara"]);
    // The errors aren't cached; the not-found answers are.
    expect(db.prepare("SELECT source FROM lookup_cache WHERE isbn13 = ? ORDER BY source").all(UNKNOWN)).toEqual([
      { source: "googlebooks" },
      { source: "openlibrary" },
    ]);
  });

  it("reports Google skipped_no_key when it was needed and there is no key", async () => {
    const { lookup, hosts } = setup(recordedInternet, { withKey: false });
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
    expect(draft?.sources).toEqual(["googlebooks"]);
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

  it("shares a lookup already running for the ISBN, so no source is asked twice", async () => {
    const { lookup, fetch, catalogs } = setup(recordedInternet, { libraries: ["biblacad-piramida"] });
    const [first, second] = await Promise.all([lookup.lookup(PIRAMIDA), lookup.lookup(PIRAMIDA)]);
    expect(second).toEqual(first);
    expect(first.draft?.sources).toEqual(["biblacad"]);
    // One call to Open Library (it doesn't know the book), one search of the first library.
    expect(fetch.calls).toHaveLength(1);
    expect(catalogs.calls.map((call) => call.library)).toEqual(["biblacad"]);

    // Once it has ended, the next lookup is a new one, answered from the cache.
    await lookup.lookup(PIRAMIDA);
    expect(fetch.calls).toHaveLength(1);
    expect(catalogs.calls).toHaveLength(1);
  });

  it("keeps lookups of different ISBNs apart", async () => {
    const { lookup } = setup();
    const [hobbit, omul] = await Promise.all([lookup.lookup(HOBBIT), lookup.lookup(OMUL)]);
    expect(hobbit.draft?.isbn13).toBe(HOBBIT);
    expect(omul.draft?.isbn13).toBe(OMUL);
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
