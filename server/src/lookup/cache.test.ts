import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "../db/open.js";
import { createLookupCache, NOT_FOUND_TTL_MS } from "./cache.js";

let db: Db;
let now: Date;

beforeEach(() => {
  db = openDb(":memory:");
  now = new Date("2026-10-15T08:00:00.000Z");
});

afterEach(() => {
  db.close();
});

const later = (ms: number) => new Date(now.getTime() + ms);

describe("createLookupCache", () => {
  it("gives back a stored answer with its fetch time", () => {
    const cache = createLookupCache(db, () => now);
    const response = { data: { "ISBN:9780547928227": { title: "The Hobbit" } }, details: null };
    cache.put("9780547928227", "openlibrary", { outcome: "found", response });
    expect(cache.get("9780547928227", "openlibrary")).toEqual({
      outcome: "found",
      response,
      fetchedAt: "2026-10-15T08:00:00.000Z",
    });
    expect(cache.get("9780547928227", "googlebooks")).toBeUndefined();
    expect(cache.get("9789735054694", "openlibrary")).toBeUndefined();
  });

  it("keeps a found answer forever", () => {
    let clock = now;
    const cache = createLookupCache(db, () => clock);
    cache.put("9780547928227", "openlibrary", { outcome: "found", response: { data: {} } });
    clock = later(10 * 365 * 24 * 60 * 60 * 1000);
    expect(cache.get("9780547928227", "openlibrary")?.outcome).toBe("found");
  });

  it("keeps a not-found answer for 7 days", () => {
    let clock = now;
    const cache = createLookupCache(db, () => clock);
    cache.put("9786063205583", "openlibrary", { outcome: "not_found", response: { data: {}, details: null } });
    clock = later(NOT_FOUND_TTL_MS - 1);
    expect(cache.get("9786063205583", "openlibrary")?.outcome).toBe("not_found");
    clock = later(NOT_FOUND_TTL_MS);
    expect(cache.get("9786063205583", "openlibrary")).toBeUndefined();
  });

  it("replaces the answer for the same ISBN and source", () => {
    let clock = now;
    const cache = createLookupCache(db, () => clock);
    cache.put("9786063205583", "googlebooks", { outcome: "not_found", response: { totalItems: 0 } });
    clock = later(NOT_FOUND_TTL_MS + 1);
    cache.put("9786063205583", "googlebooks", { outcome: "found", response: { totalItems: 1 } });
    expect(cache.get("9786063205583", "googlebooks")).toEqual({
      outcome: "found",
      response: { totalItems: 1 },
      fetchedAt: clock.toISOString(),
    });
    expect(db.prepare("SELECT COUNT(*) AS n FROM lookup_cache").get()).toEqual({ n: 1 });
  });

  it("can't hold an error: the table refuses any other outcome", () => {
    expect(() =>
      db
        .prepare("INSERT INTO lookup_cache (isbn13, source, outcome, response, fetched_at) VALUES (?, ?, ?, ?, ?)")
        .run("9780547928227", "openlibrary", "error", "{}", now.toISOString()),
    ).toThrow(/CHECK/);
  });
});
