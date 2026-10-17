import type { CoverCandidate, Draft, LookupOutcome, LookupResponse, LookupSource } from "@shelfmark/shared";
import type { LookupCache } from "./cache.js";

/**
 * The lookup (corpus/wiki/metadata-lookup.md): for each source in order, the
 * cache, else the source itself, and the next source only while no answer so
 * far has a title (decisions.md, 2026-10-17: Google Books is asked last, and
 * not for a missing cover). The answers merge field by field, the first
 * non-empty value winning. The result is a draft; nothing is saved.
 */

/** One source's answer as draft fields, before the merge. Empty is `null` or `[]`. */
export type SourceDraft = Omit<Draft, "isbn13" | "sources">;

/** A metadata source as the lookup sees it (openlibrary.ts, googlebooks.ts). */
export interface LookupSourceClient {
  readonly source: LookupSource;
  /** `false` when the source can't be asked (Google Books without a key): reported as `skipped_no_key`. */
  readonly enabled: boolean;
  /**
   * The raw answer for an ISBN, through the source's queue: what the cache
   * stores. Throws on a network error, a timeout, a non-2xx answer or bad JSON;
   * the message never carries the request URL (it may hold a key).
   */
  fetch(isbn13: string): Promise<unknown>;
  /** The draft fields in a raw answer, or `null` when it says the ISBN is unknown. Never throws. */
  read(isbn13: string, response: unknown): SourceDraft | null;
}

export type Tried = LookupResponse["tried"][number];

export interface LookupResult {
  draft: Draft | null;
  tried: Tried[];
}

export interface Lookup {
  lookup(isbn13: string): Promise<LookupResult>;
}

export interface LookupOptions {
  /** In the order they are asked (`LOOKUP_SOURCES`). */
  sources: readonly LookupSourceClient[];
  cache: LookupCache;
  /** Called for each source that failed; the lookup goes on without it. */
  onError?: (source: LookupSource, isbn13: string, error: unknown) => void;
}

// The limits of `bookCreateSchema` (shared/src/book.ts), so a draft's fields
// can be saved as they are.
export const SHORT_TEXT_MAX = 500;
export const LONG_TEXT_MAX = 20_000;
export const LIST_MAX = 100;
const PAGES_MAX = 100_000;
/**
 * Open Library lists every subject anyone added (93 for The Hobbit on
 * 2026-10-15: "thrushes", "the one ring"); the owner never sees them while
 * confirming a draft, so a draft keeps the first ten.
 */
export const SUBJECTS_MAX = 10;

export function emptySourceDraft(): SourceDraft {
  return {
    title: null,
    subtitle: null,
    authors: [],
    publisher: null,
    publishedYear: null,
    pages: null,
    language: null,
    description: null,
    subjects: [],
    coverCandidates: [],
  };
}

/** A plain object, or `undefined`: the sources' JSON is read without trusting its shape. */
export function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * NFC, trimmed, cut to `max`; blank or not a string is `null`. Runs of
 * whitespace become one space, except in long text, where line breaks stay.
 */
export function text(value: unknown, max = SHORT_TEXT_MAX): string | null {
  if (typeof value !== "string") return null;
  let out = value.normalize("NFC");
  out = max > SHORT_TEXT_MAX ? out.replace(/[^\S\n]+/g, " ").replace(/\n{3,}/g, "\n\n") : out.replace(/\s+/g, " ");
  out = out.trim().slice(0, max).trim();
  return out === "" ? null : out;
}

/** Names or subjects: each through `text`, blanks dropped, duplicates (ignoring case) dropped, at most `max`. */
export function texts(values: readonly unknown[], max = LIST_MAX): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const item = text(value);
    if (item === null || seen.has(item.toLowerCase())) continue;
    seen.add(item.toLowerCase());
    out.push(item);
    if (out.length === max) break;
  }
  return out;
}

/** The year in any date string: "2012", "2012-09-18", "Apr 07, 2016", "[c1995]". The first four-digit run from 1000 to 2999. */
export function yearOf(value: unknown): number | null {
  if (typeof value === "number") return Number.isInteger(value) && value >= 1000 && value <= 2999 ? value : null;
  if (typeof value !== "string") return null;
  const match = /(?<!\d)([12]\d{3})(?!\d)/.exec(value);
  return match ? Number(match[1]) : null;
}

export function pagesOf(value: unknown): number | null {
  const pages = typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value) : value;
  return typeof pages === "number" && Number.isInteger(pages) && pages > 0 && pages <= PAGES_MAX ? pages : null;
}

type Field = Exclude<keyof SourceDraft, "coverCandidates">;
const FIELDS: readonly Field[] = [
  "title",
  "subtitle",
  "authors",
  "publisher",
  "publishedYear",
  "pages",
  "language",
  "description",
  "subjects",
];

function filled(value: SourceDraft[Field]): boolean {
  return Array.isArray(value) ? value.length > 0 : value !== null;
}

/**
 * Field by field, the first non-empty value wins, in the order given; the cover
 * candidates are every source's, in that order, without repeats. `sources`
 * names whoever supplied a value. `null` when no source found the book.
 */
export function mergeDrafts(
  isbn13: string,
  answers: readonly { source: LookupSource; draft: SourceDraft | null }[],
): Draft | null {
  const found = answers.filter((answer): answer is { source: LookupSource; draft: SourceDraft } => answer.draft !== null);
  if (found.length === 0) return null;

  const merged: SourceDraft = emptySourceDraft();
  const contributors = new Set<LookupSource>();
  for (const { source, draft } of found) {
    for (const field of FIELDS) {
      if (!filled(merged[field]) && filled(draft[field])) {
        (merged as Record<Field, unknown>)[field] = draft[field];
        contributors.add(source);
      }
    }
    for (const candidate of draft.coverCandidates) {
      if (!merged.coverCandidates.some((known) => known.url === candidate.url)) {
        merged.coverCandidates.push(candidate);
        contributors.add(source);
      }
    }
  }

  // A source that found the book but added nothing new still counts if nobody else added anything.
  const sources = contributors.size > 0 ? [...contributors] : [found[0]!.source];
  return { isbn13, ...merged, sources };
}

/** The lookup over a list of sources and the cache. */
export function createLookup({ sources, cache, onError }: LookupOptions): Lookup {
  async function ask(
    client: LookupSourceClient,
    isbn13: string,
  ): Promise<{ outcome: LookupOutcome; draft: SourceDraft | null }> {
    // A cached answer costs nothing, so it is used even if the key has since gone.
    const cached = cache.get(isbn13, client.source);
    if (cached) {
      const draft = client.read(isbn13, cached.response);
      return { outcome: draft ? "found" : "not_found", draft };
    }
    if (!client.enabled) return { outcome: "skipped_no_key", draft: null };

    let response: unknown;
    try {
      response = await client.fetch(isbn13);
    } catch (error) {
      onError?.(client.source, isbn13, error);
      return { outcome: "error", draft: null };
    }
    const draft = client.read(isbn13, response);
    const outcome = draft ? "found" : "not_found";
    cache.put(isbn13, client.source, { outcome, response });
    return { outcome, draft };
  }

  return {
    async lookup(isbn13) {
      const tried: Tried[] = [];
      const answers: { source: LookupSource; draft: SourceDraft | null }[] = [];
      for (const client of sources) {
        // The next source only while nothing so far has a title.
        if (mergeDrafts(isbn13, answers)?.title) break;
        const { outcome, draft } = await ask(client, isbn13);
        tried.push({ source: client.source, outcome });
        answers.push({ source: client.source, draft });
      }
      return { draft: mergeDrafts(isbn13, answers), tried };
    },
  };
}

/** A candidate URL forced to https. `null` for anything that is not an http(s) URL. */
export function httpsCandidate(url: unknown, source: LookupSource): CoverCandidate | null {
  if (typeof url !== "string" || !URL.canParse(url)) return null;
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  parsed.protocol = "https:";
  return { url: parsed.href, source };
}
