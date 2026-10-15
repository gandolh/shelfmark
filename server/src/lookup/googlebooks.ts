import { to10 } from "@shelfmark/shared";
import {
  array,
  emptySourceDraft,
  httpsCandidate,
  LONG_TEXT_MAX,
  pagesOf,
  record,
  SUBJECTS_MAX,
  text,
  texts,
  yearOf,
  type LookupSourceClient,
  type SourceDraft,
} from "./merge.js";
import { getJson, SOURCE_TIMEOUT_MS, USER_AGENT, type SourceClientOptions } from "./openlibrary.js";
import { createQueue, GOOGLE_BOOKS_SPACING_MS } from "./queue.js";

/**
 * Google Books' `volumes` search (Books API v1). It needs the owner's key
 * (`GOOGLE_BOOKS_API_KEY` in `.env`): keyless calls share one public quota
 * that answered 429 every time on 2026-10-14 (decisions.md). Without a key the
 * source is disabled and a lookup reports it `skipped_no_key`. The raw answer,
 * as cached, is the `volumes` response itself.
 */

export const GOOGLE_BOOKS_API = "https://www.googleapis.com/books/v1";

/** Largest first. A search answer usually has only the two thumbnails. */
const IMAGE_SIZES = ["extraLarge", "large", "medium", "small", "thumbnail", "smallThumbnail"] as const;

/** The volume whose identifiers carry this ISBN; the first one if none does. */
function volumeFor(isbn13: string, items: unknown[]): Record<string, unknown> | undefined {
  const isbn10 = to10(isbn13);
  const infos = items.map((item) => record(record(item)?.volumeInfo)).filter((info) => info !== undefined);
  const matches = (info: Record<string, unknown>) =>
    array(info.industryIdentifiers).some((entry) => {
      const id = record(entry)?.identifier;
      return id === isbn13 || (isbn10 !== null && id === isbn10);
    });
  return infos.find(matches) ?? infos[0];
}

/** The largest image link, https, without the page-curl effect (`edge=curl`) Google draws on thumbnails. */
function coverCandidate(imageLinks: unknown) {
  const links = record(imageLinks);
  const url = IMAGE_SIZES.map((size) => links?.[size]).find((link) => typeof link === "string");
  const candidate = httpsCandidate(url, "googlebooks");
  if (!candidate) return [];
  const parsed = new URL(candidate.url);
  if (parsed.searchParams.get("edge") === "curl") parsed.searchParams.delete("edge");
  return [{ ...candidate, url: parsed.href }];
}

/** "en", "ro", "zh-CN" → the ISO 639-1 part; anything else `null`. */
function languageOf(value: unknown): string | null {
  const match = typeof value === "string" ? /^([a-z]{2})(?:[-_][a-z0-9]+)*$/i.exec(value.trim()) : null;
  return match ? match[1]!.toLowerCase() : null;
}

/** The draft fields in a `volumes` answer; `null` when it has no volume. */
export function readGoogleBooks(isbn13: string, response: unknown): SourceDraft | null {
  const info = volumeFor(isbn13, array(record(response)?.items));
  if (!info) return null;
  const draft = emptySourceDraft();
  draft.title = text(info.title);
  draft.subtitle = text(info.subtitle);
  draft.authors = texts(array(info.authors));
  draft.publisher = text(info.publisher);
  draft.publishedYear = yearOf(info.publishedDate);
  draft.pages = pagesOf(info.pageCount);
  draft.language = languageOf(info.language);
  draft.description = text(info.description, LONG_TEXT_MAX);
  draft.subjects = texts(array(info.categories), SUBJECTS_MAX);
  draft.coverCandidates = coverCandidate(info.imageLinks);
  return draft;
}

export interface GoogleBooksOptions extends SourceClientOptions {
  /** `config.googleBooksApiKey`. Unset, the source is disabled. */
  apiKey: string | undefined;
}

export function createGoogleBooksSource(options: GoogleBooksOptions): LookupSourceClient {
  const { apiKey } = options;
  const fetch = options.fetch ?? globalThis.fetch;
  const queue = options.queue ?? createQueue(GOOGLE_BOOKS_SPACING_MS);
  const timeoutMs = options.timeoutMs ?? SOURCE_TIMEOUT_MS;

  return {
    source: "googlebooks",
    enabled: apiKey !== undefined,
    fetch(isbn13) {
      if (apiKey === undefined) return Promise.reject(new Error("Google Books has no API key"));
      // `country` spares a server whose IP Google can't place the 403 "Cannot determine user location".
      const query = new URLSearchParams({ q: `isbn:${isbn13}`, country: "RO", key: apiKey });
      return queue.run(() =>
        getJson("Google Books", `${GOOGLE_BOOKS_API}/volumes?${query}`, {
          fetch,
          timeoutMs,
          headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        }),
      );
    },
    read: readGoogleBooks,
  };
}
