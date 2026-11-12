import type { Db } from "../../db/open.js";

/**
 * `catalog_query_cache` (migration 4): each catalog answer by its URL, kept
 * 30 days, so asking the same question again costs no request. Errors are
 * never stored.
 */
export const CATALOG_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface CatalogCache {
  get(url: string): unknown;
  put(url: string, response: unknown): void;
}

export function createCatalogCache(db: Db, now: () => Date = () => new Date()): CatalogCache {
  const select = db.prepare<[string], { response: string; fetchedAt: string }>(
    "SELECT response, fetched_at AS fetchedAt FROM catalog_query_cache WHERE url = ?",
  );
  const upsert = db.prepare<[string, string, string]>(`
    INSERT INTO catalog_query_cache (url, response, fetched_at) VALUES (?, ?, ?)
    ON CONFLICT (url) DO UPDATE SET response = excluded.response, fetched_at = excluded.fetched_at`);
  return {
    get(url) {
      const row = select.get(url);
      if (!row || now().getTime() - Date.parse(row.fetchedAt) >= CATALOG_TTL_MS) return undefined;
      return JSON.parse(row.response) as unknown;
    },
    put(url, response) {
      upsert.run(url, JSON.stringify(response), now().toISOString());
    },
  };
}
