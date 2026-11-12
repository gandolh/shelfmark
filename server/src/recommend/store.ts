import { recommendationSchema, type Recommendation, type RecommendationSource } from "@shelfmark/shared";
import type { Db } from "../db/open.js";
import type { Known } from "./dedup.js";
import { array, record } from "../features/lookup/index.js";
import { titleKey, workKeyOf } from "./keys.js";

/**
 * Recommendations, dismissals and what the library knows (brief 04, step 6).
 * The list is the last one only: an import appends, a refresh replaces its
 * source's rows. Each read of the list drops what the library has gained
 * since, so no card is ever a book in the database.
 */

export interface StoredRecommendation {
  /** `OL45883W` for a work, `t:<title key>` for a book with no work key. */
  key: string;
  workKey: string | null;
  title: string;
  authors: readonly string[];
  year: number | null;
  language: string | null;
  coverUrl: string | null;
  isbns: readonly string[];
  reasons: readonly string[];
  source: RecommendationSource;
  score: number;
}

export interface RecommendationStore {
  /** What the library and the dismissals know, for the dedup. */
  known(): Known;
  /** The list, minus anything now known, highest score first, at most `limit`. */
  list(limit: number): Recommendation[];
  /** Adds picks; a pick whose key is already listed keeps its place and gains its reasons. */
  append(picks: readonly StoredRecommendation[]): void;
  /** Replaces one source's rows in a single transaction. */
  replaceSource(source: RecommendationSource, picks: readonly StoredRecommendation[]): void;
  /** "Not interested": the work and the title are never shown again. `false` when no such card. */
  dismiss(key: string): boolean;
}

interface Row {
  key: string;
  title: string;
  authors: string;
  year: number | null;
  language: string | null;
  cover_url: string | null;
  isbns: string;
  title_key: string;
  reasons: string;
  source: RecommendationSource;
  score: number;
}

const strings = (json: string): string[] =>
  (JSON.parse(json) as unknown[]).filter((v): v is string => typeof v === "string");

/**
 * The work key in a cached Open Library answer: `{ data, details }` where
 * `details` is `{ "ISBN:<isbn>": { details: { works: [{ key }] } } }`.
 * Anything else adds none; the title key still guards that book.
 */
export function cachedWorkKey(response: string): string | null {
  try {
    const details = record(record(JSON.parse(response))?.details);
    for (const edition of Object.values(details ?? {})) {
      const work = record(array(record(record(edition)?.details)?.works)[0])?.key;
      const key = workKeyOf(work);
      if (key !== null) return key;
    }
  } catch {
    // Not JSON: no work key.
  }
  return null;
}

export function createRecommendationStore(db: Db, now: () => Date = () => new Date()): RecommendationStore {
  const books = db.prepare<[], { isbn13: string | null; title: string; authors: string }>(
    "SELECT isbn13, title, authors FROM books",
  );
  const cached = db.prepare<[], { isbn13: string; response: string }>(
    "SELECT isbn13, response FROM lookup_cache WHERE source = 'openlibrary' AND outcome = 'found'",
  );
  const dismissals = db.prepare<[], { key: string; kind: "work" | "title" }>(
    "SELECT key, kind FROM recommendation_dismissals",
  );
  const rows = db.prepare<[], Row>("SELECT * FROM recommendations ORDER BY score DESC, rowid");
  const byKey = db.prepare<[string], Row>("SELECT * FROM recommendations WHERE key = ?");
  const insert = db.prepare(`
    INSERT INTO recommendations (key, title, authors, year, language, cover_url, isbn13, isbns, title_key, reasons, source, score, refreshed_at)
    VALUES (@key, @title, @authors, @year, @language, @coverUrl, @isbn13, @isbns, @titleKey, @reasons, @source, @score, @at)
    ON CONFLICT (key) DO UPDATE SET reasons = excluded.reasons`);
  const remove = db.prepare<[string]>("DELETE FROM recommendations WHERE key = ?");
  const removeSource = db.prepare<[string]>("DELETE FROM recommendations WHERE source = ?");
  const dismiss = db.prepare<[string, string, string]>(
    "INSERT OR IGNORE INTO recommendation_dismissals (key, kind, dismissed_at) VALUES (?, ?, ?)",
  );

  function known(): Known {
    const isbns = new Set<string>();
    const titleKeys = new Set<string>();
    for (const book of books.all()) {
      if (book.isbn13) isbns.add(book.isbn13);
      titleKeys.add(titleKey(book.title, strings(book.authors)));
    }
    // The work each library book has, from Open Library's edition record in the lookup cache.
    const workKeys = new Set<string>();
    for (const { response } of cached.all()) {
      const key = cachedWorkKey(response);
      if (key !== null) workKeys.add(key);
    }
    const dismissedWorks = new Set<string>();
    const dismissedTitles = new Set<string>();
    for (const { key, kind } of dismissals.all()) (kind === "work" ? dismissedWorks : dismissedTitles).add(key);
    return { isbns, workKeys, titleKeys, dismissedWorks, dismissedTitles };
  }

  const toRow = (pick: StoredRecommendation, at: string) => ({
    key: pick.key,
    title: pick.title,
    authors: JSON.stringify(pick.authors),
    year: pick.year,
    language: pick.language,
    coverUrl: pick.coverUrl,
    isbn13: pick.isbns[0] ?? null,
    isbns: JSON.stringify(pick.isbns),
    titleKey: titleKey(pick.title, pick.authors),
    reasons: JSON.stringify(pick.reasons),
    source: pick.source,
    score: pick.score,
    at,
  });

  return {
    known,
    list(limit) {
      const have = known();
      const out: Recommendation[] = [];
      for (const row of rows.all()) {
        const isbns = strings(row.isbns);
        const workKey = row.key.startsWith("t:") ? null : row.key;
        const authors = strings(row.authors);
        if (
          isbns.some((isbn) => have.isbns.has(isbn)) ||
          (workKey !== null && (have.workKeys.has(workKey) || have.dismissedWorks.has(workKey))) ||
          have.titleKeys.has(row.title_key) ||
          have.dismissedTitles.has(row.title_key)
        ) {
          continue;
        }
        out.push(
          recommendationSchema.parse({
            key: row.key,
            title: row.title,
            authors,
            year: row.year,
            language: row.language,
            coverUrl: row.cover_url,
            isbn13: isbns[0] ?? null,
            reasons: strings(row.reasons),
            source: row.source,
            openLibraryUrl: workKey === null ? null : `https://openlibrary.org/works/${workKey}`,
          }),
        );
        if (out.length === limit) break;
      }
      return out;
    },
    append(picks) {
      const at = now().toISOString();
      db.transaction(() => {
        for (const pick of picks) insert.run(toRow(pick, at));
      })();
    },
    replaceSource(source, picks) {
      const at = now().toISOString();
      db.transaction(() => {
        removeSource.run(source);
        for (const pick of picks) insert.run(toRow(pick, at));
      })();
    },
    dismiss(key) {
      const row = byKey.get(key);
      if (!row) return false;
      const at = now().toISOString();
      db.transaction(() => {
        dismiss.run(row.title_key, "title", at);
        if (!key.startsWith("t:")) dismiss.run(key, "work", at);
        remove.run(key);
      })();
      return true;
    },
  };
}
