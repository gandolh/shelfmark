import type { LookupSource } from "@shelfmark/shared";
import type { Db } from "../db/open.js";

/**
 * The lookup cache (`lookup_cache`, migration 2): each source's raw answer
 * for an ISBN, so looking an ISBN up again costs no request. A found answer
 * is reused forever; a not-found one for 7 days (the book may be added to the
 * source meanwhile); an error is never stored, so the next lookup asks again.
 */

/** The outcomes worth keeping. An error has no answer to keep. */
export type CachedOutcome = "found" | "not_found";

export interface CachedAnswer {
  outcome: CachedOutcome;
  /** The source's raw answer, as its client's `fetch` returned it. */
  response: unknown;
  /** UTC ISO timestamp. */
  fetchedAt: string;
}

export interface LookupCache {
  /** The stored answer; `undefined` when there is none, or it is a not-found one older than 7 days. */
  get(isbn13: string, source: LookupSource): CachedAnswer | undefined;
  /** Stores a source's answer, replacing the one before. */
  put(isbn13: string, source: LookupSource, answer: { outcome: CachedOutcome; response: unknown }): void;
}

export const NOT_FOUND_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface CacheRow {
  outcome: CachedOutcome;
  response: string;
  fetchedAt: string;
}

export function createLookupCache(db: Db, now: () => Date = () => new Date()): LookupCache {
  const select = db.prepare<[string, string], CacheRow>(
    "SELECT outcome, response, fetched_at AS fetchedAt FROM lookup_cache WHERE isbn13 = ? AND source = ?",
  );
  const upsert = db.prepare<[string, string, string, string, string]>(`
    INSERT INTO lookup_cache (isbn13, source, outcome, response, fetched_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (isbn13, source) DO UPDATE
      SET outcome = excluded.outcome, response = excluded.response, fetched_at = excluded.fetched_at`);

  return {
    get(isbn13, source) {
      const row = select.get(isbn13, source);
      if (!row) return undefined;
      if (row.outcome === "not_found" && now().getTime() - Date.parse(row.fetchedAt) >= NOT_FOUND_TTL_MS) {
        return undefined;
      }
      return { outcome: row.outcome, response: JSON.parse(row.response) as unknown, fetchedAt: row.fetchedAt };
    },
    put(isbn13, source, { outcome, response }) {
      upsert.run(isbn13, source, outcome, JSON.stringify(response ?? null), now().toISOString());
    },
  };
}
