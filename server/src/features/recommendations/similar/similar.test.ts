import { refreshJobSchema } from "@shelfmark/shared";
import { afterEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "../../../db/open.js";
import { fakeFetch, json } from "../../../testing/fakeFetch.js";
import { serialize } from "../../../testing/serialize.js";
import { createQueue, type Clock } from "../../lookup/index.js";
import { createCatalogCache } from "../cache.js";
import { fold } from "../keys.js";
import { createCatalog, type CatalogWork } from "../openlibrary.js";
import { createRecommendationStore, type LibraryBook } from "../store.js";
import {
  echoesLibrary,
  foreignScript,
  gatherCandidates,
  readable,
  REQUESTS_MAX,
  searchesFor,
  SUBJECT_REQUESTS_MAX,
} from "./candidates.js";
import type { Embedder } from "./embedder.js";
import { createRefreshJob } from "./job.js";
import { profileOf, weightOf } from "./profile.js";
import { PER_AUTHOR_MAX, rank, reasonFor } from "./rank.js";

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

const book = (over: Partial<LibraryBook> = {}): LibraryBook => ({
  title: "A Book",
  subtitle: null,
  authors: ["Ann Writer"],
  subjects: [],
  tags: [],
  language: "en",
  collection: "owned",
  bestRating: null,
  statuses: [],
  ...over,
});

const work = (over: Partial<CatalogWork> = {}): CatalogWork => ({
  workKey: "OL1W",
  title: "A Work",
  authors: ["Someone Else"],
  isbns: [],
  year: 2000,
  language: "en",
  languages: ["en"],
  coverUrl: null,
  subjects: [],
  ...over,
});

/**
 * A stand-in for the model: each folded word lands in one of 64 slots, and the
 * vector is scaled to unit length. Texts sharing words come out close, as the
 * model's do, so the ranking can be tested without it.
 */
function wordVector(text: string): Float32Array {
  const vector = new Float32Array(64);
  for (const word of fold(text).split(/[^\p{L}\p{N}]+/u)) {
    if (word.length < 3) continue;
    let hash = 0;
    for (const char of word) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 64;
    vector[hash] = (vector[hash] ?? 0) + 1;
  }
  const length = Math.hypot(...vector) || 1;
  return vector.map((value) => value / length);
}

function fakeEmbedder(): Embedder & { texts: string[] } {
  const texts: string[] = [];
  return {
    texts,
    async embed(input, onProgress) {
      texts.push(...input);
      onProgress(input.length);
      return input.map(wordVector);
    },
  };
}

describe("the profile", () => {
  it("weighs a book by its best rating, else its statuses and collection", () => {
    expect(weightOf(book({ bestRating: 5 }))).toBe(3);
    expect(weightOf(book({ bestRating: 4 }))).toBe(2);
    expect(weightOf(book({ bestRating: 3 }))).toBe(1);
    expect(weightOf(book({ bestRating: 2 }))).toBe(0);
    expect(weightOf(book({ collection: "wishlist" }))).toBe(1);
    expect(weightOf(book({ statuses: ["abandoned", "read"] }))).toBe(1);
    expect(weightOf(book({ statuses: ["abandoned"] }))).toBe(0);
    expect(weightOf(book())).toBe(0.5);
  });

  it("keeps the heaviest books, the authors by weight, and the subjects two books share", () => {
    const profile = profileOf([
      book({ title: "Disliked", bestRating: 1, subjects: ["Sea stories"] }),
      book({ title: "Loved", authors: ["Mihail Sadoveanu"], bestRating: 5, language: "ro", tags: ["war"] }),
      book({ title: "Unread", subjects: ["Sea stories", "Fiction"], tags: ["war"] }),
      book({ title: "Also unread", subjects: ["Sea stories", "Fiction"] }),
    ]);
    expect(profile.seeds.map((seed) => seed.title)).toEqual(["Loved", "Unread", "Also unread"]);
    expect(profile.authors[0]).toBe("Mihail Sadoveanu");
    // "Fiction" names no topic; "Sea stories" is shared by two kept books (the disliked one counts for nothing).
    expect(profile.subjects).toEqual(["war", "Sea stories"]);
    expect(profile.authorLanguages.get("sadoveanu")).toEqual(new Set(["ro"]));
    expect(profile.seeds[0]?.text).toBe("Loved. Mihail Sadoveanu. war");
  });
});

describe("the candidates", () => {
  const profile = profileOf([
    book({ title: "Baltagul", authors: ["Mihail Sadoveanu"], language: "ro", bestRating: 5 }),
    book({ title: "Jane Eyre", authors: ["Charlotte Brontë"], language: "en", bestRating: 4 }),
  ]);

  it("leave out a held author's work whose first language the library doesn't read them in", () => {
    const by = (languages: string[]) =>
      work({ authors: ["Mihail Sadoveanu"], language: languages[0] ?? null, languages });
    expect(readable(by(["en", "ro"]), profile)).toBe(false);
    expect(readable(by(["ro", "en"]), profile)).toBe(true);
    expect(readable(by([]), profile)).toBe(true);
    expect(readable(work({ language: "de", languages: ["de", "en"] }), profile)).toBe(true);
    expect(readable(work({ language: "de", languages: ["de"] }), profile)).toBe(false);
    expect(readable(work({ language: null, languages: [] }), profile)).toBe(true);
  });

  it("leave out a work whose title repeats a library book's", () => {
    const shelf = profileOf([
      book({ title: "The Odyssey", authors: ["Homer"] }),
      book({ title: "Jane Eyre", authors: ["Charlotte Brontë"] }),
      book({ title: "Ion", authors: ["Liviu Rebreanu"] }),
    ]);
    const titled = (title: string) => work({ title });
    expect(echoesLibrary(titled("The Odyssey"), shelf)).toBe(true);
    expect(echoesLibrary(titled("Iliad and the Odyssey"), shelf)).toBe(true);
    expect(echoesLibrary(titled("Novels (Jane Eyre / Wuthering Heights)"), shelf)).toBe(true);
    // A one-word title this short is too common to look for inside another.
    expect(echoesLibrary(titled("Ion Creangă"), shelf)).toBe(false);
    expect(echoesLibrary(titled("Villette"), shelf)).toBe(false);
    // Romanian's spelling before 1993 writes "î" where newer books write "â".
    const forest = profileOf([book({ title: "Pădurea spânzuraților", authors: ["Liviu Rebreanu"] })]);
    expect(echoesLibrary(titled("Pădurea spînzuraților"), forest)).toBe(true);
  });

  it("leave out a title in a script none of the library's languages is written in", () => {
    const cyrillic = work({ title: "Братья Карамазовы", language: null, languages: [] });
    expect(foreignScript(cyrillic, profile)).toBe(true);
    expect(foreignScript(cyrillic, profileOf([book({ language: "ru" })]))).toBe(false);
    expect(foreignScript(work({ title: "Ispovedʹ" }), profile)).toBe(false);
  });

  it("make at most the budget's searches, subjects taking at most their share", () => {
    const many = profileOf(
      Array.from({ length: 40 }, (_, i) =>
        book({ title: `B${i}`, authors: [`Author ${i}`], subjects: [`Topic ${i % 15}`, `Topic ${(i + 1) % 15}`] }),
      ),
    );
    const { authors, subjects } = searchesFor(many);
    expect(subjects).toHaveLength(SUBJECT_REQUESTS_MAX);
    expect(authors.length + subjects.length).toBe(REQUESTS_MAX);
  });

  it("are asked once a month: a second gather is served from the cache, and a failed search costs only its own", async () => {
    const db = open();
    const fetch = fakeFetch((url) => {
      if (url.searchParams.get("author") === "Charlotte Brontë") return json({}, 503);
      return json({
        docs: [{ key: "/works/OL9W", title: "Frații Jderi", author_name: ["Mihail Sadoveanu"], language: ["rum"] }],
      });
    });
    const catalog = createCatalog(createCatalogCache(db), { fetch, queue: createQueue(0, instant) });
    const first = await gatherCandidates(catalog, profile, () => undefined);
    expect(first.map((found) => found.title)).toEqual(["Frații Jderi"]);
    expect(fetch.calls).toHaveLength(2);
    expect(fetch.calls[0]?.url.searchParams.get("sort")).toBe("editions");
    expect(fetch.calls[0]?.url.searchParams.get("fields")).toContain("subject");
    await gatherCandidates(catalog, profile, () => undefined);
    // The failed search was not stored, so only it is asked again.
    expect(fetch.calls).toHaveLength(3);
  });
});

describe("the ranking", () => {
  const seeds = [
    { title: "Moby-Dick", weight: 0.5, rating: null, collection: "owned" as const, text: "whale sea ship" },
    { title: "Jane Eyre", weight: 3, rating: 5, collection: "owned" as const, text: "governess love moors" },
  ];
  const seedVectors = seeds.map((seed) => wordVector(seed.text));

  it("names the closest book in the reason, its rating when it has one", () => {
    const candidates = [
      work({ workKey: "OL1W", title: "Sea", subjects: ["whale", "ship", "sea"] }),
      work({ workKey: "OL2W", title: "Moors", authors: ["Other"], subjects: ["governess", "moors", "love"] }),
    ];
    const ranked = rank(
      candidates,
      candidates.map((c) => wordVector(c.subjects.join(" "))),
      seeds,
      seedVectors,
      10,
    );
    // Both match a seed exactly; the one close to the rated book scores higher.
    expect(ranked.map((entry) => entry.work.title)).toEqual(["Moors", "Sea"]);
    expect(ranked[0]?.reason).toBe("Close to “Jane Eyre”, rated 5.");
    expect(ranked[1]?.reason).toBe("Close to “Moby-Dick” in your library.");
    expect(reasonFor({ ...seeds[0], collection: "wishlist" } as never)).toBe("Close to “Moby-Dick” on your wishlist.");
  });

  it("keeps at most three books by one author, and the limit", () => {
    const candidates = Array.from({ length: 6 }, (_, i) =>
      work({ workKey: `OL${i}W`, title: `Sea ${i}`, authors: [i < 5 ? "Same Writer" : "Ann Novelist"] }),
    );
    const vectors = candidates.map(() => wordVector("whale sea ship"));
    const ranked = rank(candidates, vectors, seeds, seedVectors, 10);
    expect(ranked.filter((entry) => entry.work.authors[0] === "Same Writer")).toHaveLength(PER_AUTHOR_MAX);
    expect(ranked).toHaveLength(PER_AUTHOR_MAX + 1);
    expect(rank(candidates, vectors, seeds, seedVectors, 2)).toHaveLength(2);
  });
});

function insertBook(db: Db, title: string, authors: string[], options: { rating?: number; tags?: string[] } = {}) {
  const { lastInsertRowid } = db
    .prepare(
      "INSERT INTO books (title, authors, language, collection, created_at, updated_at) VALUES (?, ?, 'en', 'owned', 'now', 'now')",
    )
    .run(title, JSON.stringify(authors));
  if (options.rating !== undefined) {
    db.prepare(
      "INSERT INTO readings (book_id, user_id, status, rating, updated_at) VALUES (?, 'u1', 'read', ?, 'now')",
    ).run(lastInsertRowid, options.rating);
  }
  for (const tag of options.tags ?? []) {
    db.prepare("INSERT OR IGNORE INTO tags (name, name_key) VALUES (?, ?)").run(tag, tag.toLowerCase());
    db.prepare("INSERT INTO book_tags (book_id, tag_id) SELECT ?, id FROM tags WHERE name_key = ?").run(
      lastInsertRowid,
      tag.toLowerCase(),
    );
  }
}

const doc = (key: string, title: string, author: string, subjects: string[]) => ({
  key: `/works/${key}`,
  title,
  author_name: [author],
  language: ["eng"],
  subject: subjects,
});

/** The routes' wiring over an in-memory database, a fake Open Library and the word-vector model. */
function setup(db: Db, embedder: Embedder = fakeEmbedder()) {
  const fetch = fakeFetch((url) => {
    if (url.pathname !== "/search.json") return undefined;
    return json({
      docs: [
        doc("OL10W", "Moby-Dick", "Herman Melville", ["whale", "sea"]),
        doc("OL11W", "Typee", "Herman Melville", ["sea", "islands"]),
        doc("OL12W", "Billy Budd", "Herman Melville", ["sea", "ship", "navy"]),
        doc("OL13W", "Shirley", "Charlotte Brontë", ["governess", "love"]),
        // Open Library sometimes keeps one book as two works.
        doc("OL14W", "Shirley", "Charlotte Brontë", ["governess"]),
      ],
    });
  });
  const store = createRecommendationStore(db);
  const catalog = createCatalog(createCatalogCache(db), { fetch, queue: createQueue(0, instant) });
  const logged: unknown[] = [];
  const job = createRefreshJob({ catalog, store, embedder, log: (error) => logged.push(error) });
  return { store, job, fetch, logged };
}

describe("the Similar refresh", () => {
  it("stores the closest books it doesn't hold, each with its reason, and its states pass the response schema", async () => {
    const db = open();
    insertBook(db, "Moby-Dick", ["Herman Melville"], { rating: 5, tags: ["sea"] });
    insertBook(db, "Jane Eyre", ["Charlotte Brontë"], { rating: 4, tags: ["sea"] });
    const { store, job, fetch } = setup(db);
    expect(serialize(refreshJobSchema, job.state())).toBe(JSON.stringify(job.state()));

    job.start();
    expect(job.state()).toMatchObject({ state: "running", step: "catalog" });
    expect(() => job.start()).toThrow("still being found");
    await job.settled();

    expect(job.state()).toMatchObject({ state: "done", added: 3, message: null });
    expect(serialize(refreshJobSchema, job.state())).toBe(JSON.stringify(job.state()));
    // Two authors and one shared tag: three searches.
    expect(fetch.calls).toHaveLength(3);
    const list = store.list(30);
    // Moby-Dick is on a shelf, so it never shows.
    expect(list.map((item) => item.title).sort()).toEqual(["Billy Budd", "Shirley", "Typee"]);
    expect(list.every((item) => item.source === "similar")).toBe(true);
    expect(list.find((item) => item.title === "Shirley")?.reasons).toEqual(["Close to “Jane Eyre”, rated 4."]);
  });

  it("leaves a work Claude named to Claude, and replaces only its own rows on the next refresh", async () => {
    const db = open();
    insertBook(db, "Moby-Dick", ["Herman Melville"], { rating: 5 });
    const { store, job } = setup(db);
    store.append([
      {
        key: "OL11W",
        workKey: "OL11W",
        title: "Typee",
        authors: ["Herman Melville"],
        year: 1846,
        language: "en",
        coverUrl: null,
        isbns: [],
        reasons: ["Claude's reason."],
        source: "claude",
        score: 0,
      },
    ]);
    job.start();
    await job.settled();
    const typee = store.list(30).filter((item) => item.title === "Typee");
    expect(typee).toEqual([expect.objectContaining({ source: "claude", reasons: ["Claude's reason."] })]);

    job.start();
    await job.settled();
    expect(store.list(30).filter((item) => item.source === "similar")).toHaveLength(job.state().added);
    expect(store.list(30).filter((item) => item.source === "claude")).toHaveLength(1);
  });

  it("says there is nothing to compare when the library is empty", async () => {
    const { job, fetch } = setup(open());
    job.start();
    await job.settled();
    expect(job.state()).toMatchObject({ state: "done", added: 0 });
    expect(job.state().message).toContain("add books");
    expect(fetch.calls).toHaveLength(0);
  });

  it("fails with a fixed message and logs the cause when the model does not run", async () => {
    const db = open();
    insertBook(db, "Moby-Dick", ["Herman Melville"], { rating: 5 });
    const broken: Embedder = {
      embed: async () => {
        throw new Error("Error loading shared library ld-linux-x86-64.so.2");
      },
    };
    const { job, logged, store } = setup(db, broken);
    job.start();
    await job.settled();
    expect(job.state()).toMatchObject({
      state: "failed",
      message: "The model did not run on the server. Its log says why.",
    });
    expect(String(logged[0])).toContain("ld-linux");
    expect(store.list(30)).toEqual([]);
  });
});

describe("the list", () => {
  it("caps each source on its own, so scored Similar rows never push Claude's off", () => {
    const store = createRecommendationStore(open());
    const row = (i: number, source: "claude" | "similar") => ({
      key: `OL${source === "claude" ? 1000 + i : i}W`,
      workKey: null,
      title: `${source} ${i}`,
      authors: ["A. Writer"],
      year: null,
      language: null,
      coverUrl: null,
      isbns: [],
      reasons: ["r"],
      source,
      score: source === "similar" ? 1 : 0,
    });
    store.append(Array.from({ length: 5 }, (_, i) => row(i, "claude")));
    store.replaceSource(
      "similar",
      Array.from({ length: 5 }, (_, i) => row(i, "similar")),
    );
    const list = store.list(3);
    expect(list.filter((item) => item.source === "similar")).toHaveLength(3);
    expect(list.filter((item) => item.source === "claude")).toHaveLength(3);
  });

  it("gives a Similar row to Claude when an import names the same work", () => {
    const store = createRecommendationStore(open());
    const base = {
      key: "OL5W",
      workKey: "OL5W",
      title: "Typee",
      authors: ["Herman Melville"],
      year: null,
      language: null,
      coverUrl: null,
      isbns: [],
    };
    store.replaceSource("similar", [{ ...base, reasons: ["Close to …"], source: "similar", score: 0.8 }]);
    store.append([{ ...base, reasons: ["Claude's reason."], source: "claude", score: 0 }]);
    expect(store.list(30)).toEqual([expect.objectContaining({ source: "claude", reasons: ["Claude's reason."] })]);
  });
});
