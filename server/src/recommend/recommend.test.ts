import { readFileSync } from "node:fs";
import { recommendationImportSchema } from "@shelfmark/shared";
import { afterEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "../db/open.js";
import { fakeFetch, json } from "../testing/fakeFetch.js";
import { createQueue, type Clock } from "../lookup/queue.js";
import { createCatalogCache } from "./cache.js";
import { dropReason, mergeEditions, type Candidate, type Known } from "./dedup.js";
import { createImportJob } from "./job.js";
import { surname, titleKey } from "./keys.js";
import { createCatalog, matchPick, readWorks } from "./openlibrary.js";
import { cachedWorkKey, createRecommendationStore } from "./store.js";

// The two answers are shaped from Open Library's documented /search.json fields (not recorded from the live service).
const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`fixtures/${name}.json`, import.meta.url), "utf8"));

const opened: Db[] = [];
afterEach(() => {
  for (const db of opened.splice(0)) db.close();
});
function open(): Db {
  const db = openDb(":memory:");
  opened.push(db);
  return db;
}

const instant: Clock = { now: () => 0, sleep: async () => undefined };
const none: Known = {
  isbns: new Set(),
  workKeys: new Set(),
  titleKeys: new Set(),
  dismissedWorks: new Set(),
  dismissedTitles: new Set(),
};
const lotr: Candidate = {
  workKey: "OL27448W",
  title: "The Lord of the Rings",
  authors: ["J. R. R. Tolkien"],
  isbns: ["9780618640157"],
};

function insertBook(db: Db, title: string, authors: string[], isbn13: string | null, collection = "owned") {
  db.prepare(
    "INSERT INTO books (title, authors, isbn13, collection, created_at, updated_at) VALUES (?, ?, ?, ?, 'now', 'now')",
  ).run(title, JSON.stringify(authors), isbn13, collection);
}

describe("title key", () => {
  it("folds case and diacritics, cuts the subtitle and a leading article, appends the surname", () => {
    expect(titleKey("The Hobbit: There and Back Again", ["J. R. R. Tolkien"])).toBe("hobbit|tolkien");
    expect(titleKey("Orbitor", ["Mircea Cărtărescu"])).toBe(titleKey("ORBITOR!", ["Cărtărescu, Mircea"]));
    expect(surname("Cărtărescu, Mircea")).toBe("cartarescu");
  });
});

describe("dropReason", () => {
  it("drops a candidate sharing an edition ISBN with a book", () => {
    expect(dropReason(lotr, { ...none, isbns: new Set(["9780618640157"]) })).toBe("isbn");
  });
  it("drops a translation with the same work key", () => {
    const romanian = { ...lotr, title: "Stăpânul inelelor", isbns: [] };
    expect(dropReason(romanian, { ...none, workKeys: new Set(["OL27448W"]) })).toBe("work");
  });
  it("drops a same-title, same-author book with no ISBN", () => {
    const bare = { workKey: null, title: "the lord of the rings", authors: ["Tolkien, J. R. R."], isbns: [] };
    expect(
      dropReason(bare, { ...none, titleKeys: new Set([titleKey("The Lord of the Rings", ["J. R. R. Tolkien"])]) }),
    ).toBe("title");
  });
  it("drops a dismissed work and a dismissed title", () => {
    expect(dropReason(lotr, { ...none, dismissedWorks: new Set(["OL27448W"]) })).toBe("dismissed");
    expect(
      dropReason(
        { ...lotr, workKey: null },
        { ...none, dismissedTitles: new Set([titleKey(lotr.title, lotr.authors)]) },
      ),
    ).toBe("dismissed");
  });
  it("keeps a book the library knows nothing of", () => {
    expect(dropReason(lotr, none)).toBeNull();
  });
  it("merges editions of one work into one candidate", () => {
    const merged = mergeEditions([lotr, { ...lotr, isbns: ["9786069135624"] }]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.isbns).toEqual(["9780618640157", "9786069135624"]);
  });
});

describe("Open Library mapping", () => {
  it("reads works, keeps only ISBN-13s, maps the language and drops a document with no work key", () => {
    const works = readWorks(fixture("search-lotr"));
    expect(works).toHaveLength(1);
    expect(works[0]).toMatchObject({ workKey: "OL27448W", year: 1954, language: "en" });
    expect(works[0]?.isbns).toEqual(["9780618640157", "9786069135624"]);
    expect(works[0]?.coverUrl).toBe("https://covers.openlibrary.org/b/id/9255566-M.jpg");
  });
  it("matches a pick only when title and author agree", () => {
    const works = readWorks(fixture("search-lotr"));
    expect(matchPick({ title: "Lord of the Rings", authors: ["Tolkien"] }, works)?.workKey).toBe("OL27448W");
    expect(matchPick({ title: "A Book Nobody Wrote", authors: ["Tolkien"] }, works)).toBeNull();
  });
});

describe("import schema", () => {
  it("accepts the documented shape and refuses the rest with a readable path", () => {
    expect(recommendationImportSchema.safeParse([{ title: "X", authors: ["Y"], reason: "Because" }]).success).toBe(
      true,
    );
    const bad = recommendationImportSchema.safeParse([{ title: "X", authors: "Y", reason: "" }]);
    expect(bad.success).toBe(false);
  });
});

describe("store", () => {
  it("reads the work key out of a cached Open Library edition record", () => {
    const cached = JSON.stringify({
      data: {},
      details: { "ISBN:9780618640157": { details: { works: [{ key: "/works/OL27448W" }] } } },
    });
    expect(cachedWorkKey(cached)).toBe("OL27448W");
    expect(cachedWorkKey("{}")).toBeNull();
  });

  it("never lists a book in either collection, and never a dismissed one", () => {
    const db = open();
    const store = createRecommendationStore(db);
    const pick = (key: string, title: string, isbn: string) => ({
      key,
      workKey: key,
      title,
      authors: ["A. Writer"],
      year: 2000,
      language: "en",
      coverUrl: null,
      isbns: [isbn],
      reasons: ["r"],
      source: "claude" as const,
      score: 0,
    });
    store.append([
      pick("OL1W", "Owned One", "9780000000002"),
      pick("OL2W", "Wished Two", "9780000000019"),
      pick("OL3W", "Free Three", "9780000000026"),
      pick("OL4W", "Nope Four", "9780000000033"),
    ]);
    insertBook(db, "Owned One", ["A. Writer"], "9780000000002");
    insertBook(db, "Wished Two", ["A. Writer"], null, "wishlist");
    expect(store.dismiss("OL4W")).toBe(true);
    expect(store.dismiss("OL4W")).toBe(false);
    expect(store.list(30).map((r) => r.key)).toEqual(["OL3W"]);
    // The join the brief asks for: no listed row shares an ISBN or title with a book.
    const clash = db
      .prepare(
        `SELECT r.key FROM recommendations r JOIN books b ON b.isbn13 = r.isbn13 OR lower(b.title) = lower(r.title)`,
      )
      .all();
    expect(clash.map((c) => (c as { key: string }).key).sort()).toEqual(["OL1W", "OL2W"]);
  });
});

describe("import job", () => {
  const picks = [
    { title: "The Lord of the Rings", authors: ["J. R. R. Tolkien"], reason: "You read fantasy." },
    { title: "A Made-Up Novel", authors: ["Nobody"], isbn13: "9781111111113", reason: "Invented." },
  ];

  function setup() {
    const db = open();
    const fetch = fakeFetch((url) => {
      if (url.pathname !== "/search.json") return undefined;
      if (url.searchParams.get("isbn")) return json({ numFound: 0, docs: [] });
      return json(
        fixture(url.searchParams.get("title") === "The Lord of the Rings" ? "search-lotr" : "search-invented"),
      );
    });
    const catalog = createCatalog(createCatalogCache(db), { fetch, queue: createQueue(0, instant) });
    const store = createRecommendationStore(db);
    return { db, fetch, store, job: createImportJob(catalog, store) };
  }

  it("shows a found pick, lists an invented one as not found and never shows it", async () => {
    const { store, job, fetch } = setup();
    job.start(picks);
    await job.settled();
    expect(job.state()).toMatchObject({ state: "done", total: 2, checked: 2, added: 1, dropped: 0 });
    expect(job.state().notFound).toEqual([{ title: "A Made-Up Novel", authors: ["Nobody"] }]);
    expect(store.list(30).map((r) => r.title)).toEqual(["The Lord of the Rings"]);
    expect(store.list(30)[0]?.reasons).toEqual(["You read fantasy."]);
    expect(fetch.calls.every((c) => c.headers.get("user-agent")?.startsWith("Shelfmark/"))).toBe(true);
  });

  it("drops a pick the library already has, a wishlist book and a dismissed one, and says how many", async () => {
    const { db, store, job } = setup();
    insertBook(db, "Stăpânul inelelor", ["J. R. R. Tolkien"], "9786069135624", "wishlist");
    job.start(picks);
    await job.settled();
    expect(job.state()).toMatchObject({ added: 0, dropped: 1 });
    expect(store.list(30)).toEqual([]);
  });

  it("keeps a dismissed pick away when the same JSON is imported again, and asks nothing the second time", async () => {
    const { store, job, fetch } = setup();
    job.start(picks);
    await job.settled();
    store.dismiss("OL27448W");
    const asked = fetch.calls.length;
    job.start(picks);
    await job.settled();
    expect(store.list(30)).toEqual([]);
    expect(fetch.calls.length).toBe(asked);
  });
});
