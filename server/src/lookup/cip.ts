import type { CipStore } from "../cip/store.js";
import { emptySourceDraft, record, text, texts, yearOf, type LookupSourceClient, type SourceDraft } from "./merge.js";

/**
 * The CIP index as a lookup source (brief 16): the national library's lists
 * of books announced before printing, held locally in cip.db. It costs no
 * request, so it skips the lookup cache, and a record refreshed in the index
 * is seen at once. It gives title, subtitle, authors, publisher and year;
 * the lists have no language, pages or cover.
 */

/** The draft fields in a stored record; `null` when the index has none. */
export function readCip(_isbn13: string, response: unknown): SourceDraft | null {
  const row = record(response);
  if (!row) return null;
  const draft = emptySourceDraft();
  draft.title = text(row.title);
  draft.subtitle = text(row.subtitle);
  draft.authors = texts(Array.isArray(row.authors) ? row.authors : []);
  draft.publisher = text(row.publisher);
  draft.publishedYear = yearOf(row.year);
  return draft;
}

export function createCipSource(store: CipStore): LookupSourceClient {
  return {
    source: "cip",
    enabled: true,
    cached: false,
    fetch: async (isbn13) => store.get(isbn13) ?? null,
    read: readCip,
  };
}
