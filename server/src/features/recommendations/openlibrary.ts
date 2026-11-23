import {
  COVERS_ORIGIN,
  getJson,
  languageOf,
  OPEN_LIBRARY_ORIGIN,
  SOURCE_TIMEOUT_MS,
  USER_AGENT,
} from "../lookup/index.js";
import { array, record, text, texts, yearOf } from "../lookup/index.js";
import { createQueue, OPEN_LIBRARY_SPACING_MS, type Queue } from "../lookup/index.js";
import type { CatalogCache } from "./cache.js";
import type { Candidate } from "./dedup.js";
import { fold, surname, titleKey, workKeyOf } from "./keys.js";

/**
 * Open Library's search (`/search.json`), the one catalog a pick is checked
 * against and the Similar refresh finds its books in. One request at a time
 * with Shelfmark's User-Agent, every answer through the 30-day cache. A
 * request names one pick, one author or one subject, never the library.
 */

export interface CatalogWork extends Candidate {
  workKey: string;
  year: number | null;
  language: string | null;
  coverUrl: string | null;
  /** Open Library's subjects, when the search asked for them. */
  subjects: readonly string[];
  /** Every language an edition is in, ISO 639-1. `language` is the first of them. */
  languages: readonly string[];
}

const FIELDS = "key,title,author_name,first_publish_year,language,isbn,cover_i";
/** The Similar refresh also reads the subjects, which the model compares. */
const FIELDS_WITH_SUBJECTS = `${FIELDS},subject`;
/** Works a Similar search asks for: enough to rank, few enough to stay polite. */
const SIMILAR_LIMIT = "20";

/** The search's documents as works. A document with no work key or no title is not a work. */
export function readWorks(answer: unknown): CatalogWork[] {
  const works: CatalogWork[] = [];
  for (const raw of array(record(answer)?.docs)) {
    const doc = record(raw);
    const workKey = workKeyOf(doc?.key);
    const title = text(doc?.title, 300);
    if (!doc || workKey === null || title === null) continue;
    const coverId =
      typeof doc.cover_i === "number" && Number.isInteger(doc.cover_i) && doc.cover_i > 0 ? doc.cover_i : null;
    const languages = [...new Set(array(doc.language).flatMap((code) => languageOf(code) ?? []))];
    works.push({
      workKey,
      title,
      authors: texts(array(doc.author_name), 10),
      year: yearOf(doc.first_publish_year),
      language: languageOf(array(doc.language)[0]),
      languages,
      subjects: texts(array(doc.subject), 12),
      isbns: texts(array(doc.isbn), 100).filter((isbn) => /^97[89]\d{10}$/.test(isbn)),
      coverUrl: coverId === null ? null : `${COVERS_ORIGIN}/b/id/${coverId}-M.jpg`,
    });
  }
  return works;
}

export interface CatalogClientOptions {
  fetch?: typeof globalThis.fetch;
  queue?: Queue;
  timeoutMs?: number;
}

export interface Catalog {
  /** Works for an ISBN-13, best first. */
  byIsbn(isbn13: string): Promise<CatalogWork[]>;
  /** Works for a title and its first author, best first. */
  byTitle(title: string, author: string | undefined): Promise<CatalogWork[]>;
  /** An author's works with their subjects, the most published first. */
  byAuthor(author: string): Promise<CatalogWork[]>;
  /** A subject's works with their subjects, the most published first. */
  bySubject(subject: string): Promise<CatalogWork[]>;
}

export function createCatalog(cache: CatalogCache, options: CatalogClientOptions = {}): Catalog {
  const fetch = options.fetch ?? globalThis.fetch;
  const queue = options.queue ?? createQueue(OPEN_LIBRARY_SPACING_MS);
  const timeoutMs = options.timeoutMs ?? SOURCE_TIMEOUT_MS;
  const headers = { "User-Agent": USER_AGENT, Accept: "application/json" };

  // The parameters' order is the cache key's: a pick's search keeps the URL it always had.
  async function search(params: Record<string, string>, fields = FIELDS, limit = "5"): Promise<CatalogWork[]> {
    const query = new URLSearchParams({ ...params, fields, limit });
    const url = `${OPEN_LIBRARY_ORIGIN}/search.json?${query.toString()}`;
    const cached = cache.get(url);
    if (cached !== undefined) return readWorks(cached);
    const answer = await queue.run(() => getJson("Open Library", url, { fetch, timeoutMs, headers }));
    cache.put(url, answer);
    return readWorks(answer);
  }

  return {
    byIsbn: (isbn13) => search({ isbn: isbn13 }),
    byTitle: (title, author) => search({ title, ...(author === undefined ? {} : { author }) }),
    byAuthor: (author) => search({ author, sort: "editions" }, FIELDS_WITH_SUBJECTS, SIMILAR_LIMIT),
    bySubject: (subject) => search({ subject, sort: "editions" }, FIELDS_WITH_SUBJECTS, SIMILAR_LIMIT),
  };
}

/**
 * The work a title-and-author pick means, or `null`: the guard against a
 * language model's invented books. Accepted only when the work's title key
 * equals the pick's, or its folded title does and an author's surname is
 * shared.
 */
export function matchPick(
  pick: { title: string; authors: readonly string[] },
  works: readonly CatalogWork[],
): CatalogWork | null {
  const wanted = titleKey(pick.title, pick.authors);
  const surnames = new Set(pick.authors.map(surname).filter(Boolean));
  for (const work of works) {
    if (titleKey(work.title, work.authors) === wanted) return work;
    const sameTitle = fold(work.title).trim() === fold(pick.title).trim();
    if (sameTitle && work.authors.some((author) => surnames.has(surname(author)))) return work;
  }
  return null;
}
