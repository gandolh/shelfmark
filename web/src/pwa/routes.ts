import { API_BASE } from "../base";

/** A path under the API prefix (`/shelfmark-api/...`): the worker never answers a navigation for it. */
export function isApiPath(pathname: string): boolean {
  return pathname === API_BASE || pathname.startsWith(`${API_BASE}/`);
}

/**
 * A book's stored cover: the one API response the worker keeps. Matches the
 * path only, so the `?v=` cache-buster stays part of the cache key. Everything
 * else under `/shelfmark-api/` (auth included) is network-only.
 */
export function isCoverPath(pathname: string): boolean {
  return new RegExp(`^${API_BASE}/api/books/\\d+/cover$`).test(pathname);
}

/** The covers cache: at most this many, for at most this long. */
export const COVER_CACHE = { name: "shelfmark-covers", maxEntries: 1000, maxAgeSeconds: 30 * 24 * 60 * 60 } as const;
