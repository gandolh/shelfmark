import { readFileSync } from "node:fs";
import { importJobSchema, recommendationImportSchema, recommendationListSchema } from "@shelfmark/shared";
import { isDeepStrictEqual } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "../../db/open.js";
import { fakeFetch, json } from "../../testing/fakeFetch.js";
import { serializationFailure, serialize } from "../../testing/serialize.js";
import { createQueue, type Clock } from "../lookup/index.js";
import { createCatalogCache } from "./cache.js";
import { createImportJob } from "./job.js";
import { createCatalog } from "./openlibrary.js";
import { keyParamsSchema } from "./schemas.js";
import { createRecommendationStore } from "./store.js";

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`fixtures/${name}.json`, import.meta.url), "utf8"));
const instant: Clock = { now: () => 0, sleep: async () => undefined };

let db: Db;

beforeEach(() => {
  db = openDb(":memory:");
});

afterEach(() => {
  db.close();
});

/** The routes' own wiring: a real store and import job over a fake Open Library. */
function setup() {
  const fetch = fakeFetch((url) => {
    if (url.pathname !== "/search.json") return undefined;
    if (url.searchParams.get("isbn")) return json({ numFound: 0, docs: [] });
    return json(fixture(url.searchParams.get("title") === "The Lord of the Rings" ? "search-lotr" : "search-invented"));
  });
  const catalog = createCatalog(createCatalogCache(db), { fetch, queue: createQueue(0, instant) });
  const store = createRecommendationStore(db);
  return { store, job: createImportJob(catalog, store) };
}

const picks = [
  { title: "The Lord of the Rings", authors: ["J. R. R. Tolkien"], reason: "You read fantasy." },
  { title: "A Made-Up Novel", authors: ["Nobody"], isbn13: "9781111111113", reason: "Invented." },
];

describe("the recommendation replies through their response schemas", () => {
  it("send the import job's state in every phase byte for byte as before", async () => {
    const { job } = setup();
    expect(serialize(importJobSchema, job.state())).toBe(JSON.stringify(job.state()));
    job.start(recommendationImportSchema.parse(picks));
    expect(serialize(importJobSchema, job.state())).toBe(JSON.stringify(job.state()));
    await job.settled();
    expect(job.state()).toMatchObject({ state: "done", notFound: [{ title: "A Made-Up Novel" }] });
    expect(serialize(importJobSchema, job.state())).toBe(JSON.stringify(job.state()));
  });

  it("send the list, empty and with a stored recommendation, byte for byte as before", async () => {
    const { store, job } = setup();
    const empty = { recommendations: store.list(30) };
    expect(serialize(recommendationListSchema, empty)).toBe(JSON.stringify(empty));
    job.start(recommendationImportSchema.parse(picks));
    await job.settled();
    const list = { recommendations: store.list(30) };
    expect(list.recommendations).toHaveLength(1);
    expect(serialize(recommendationListSchema, list)).toBe(JSON.stringify(list));
  });

  it("strip a field it doesn't declare, and refuse a state or a count out of shape", async () => {
    const { job } = setup();
    const state = job.state();
    const stripped = JSON.parse(serialize(importJobSchema, { ...state, startedAt: "now" })) as unknown;
    expect(isDeepStrictEqual(stripped, JSON.parse(JSON.stringify(state)))).toBe(true);
    expect(serializationFailure(importJobSchema, { ...state, state: "paused" })).toBeTruthy();
    expect(serializationFailure(importJobSchema, { ...state, added: -1 })).toBeTruthy();
    expect(serializationFailure(recommendationListSchema, { recommendations: [{ key: "" }] })).toBeTruthy();
  });
});

describe("keyParamsSchema", () => {
  it("takes the key as the string it arrives as", () => {
    expect(keyParamsSchema.parse({ key: "/works/OL45883W" })).toEqual({ key: "/works/OL45883W" });
    expect(keyParamsSchema.safeParse({}).success).toBe(false);
  });
});
