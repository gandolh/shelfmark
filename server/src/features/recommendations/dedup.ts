import { titleKey } from "./keys.js";

/**
 * "Already have it": the hard part of recommending (brief 04, step 4). A
 * recommendation is never a book in the database. Both collections count, and
 * so does a dismissal. Used by every source, the import included, and again
 * when the list is read, so a book added since never lingers on the page.
 */

/** What the library and the dismissals know, as sets to test against. */
export interface Known {
  /** Every `books.isbn13`. */
  isbns: ReadonlySet<string>;
  /** Work keys resolved for library books (from `lookup_cache`). */
  workKeys: ReadonlySet<string>;
  /** `titleKey(title, authors)` of every book. */
  titleKeys: ReadonlySet<string>;
  dismissedWorks: ReadonlySet<string>;
  dismissedTitles: ReadonlySet<string>;
}

export interface Candidate {
  /** The work's key (`OL45883W`), or `null` when the source gave none. */
  workKey: string | null;
  title: string;
  authors: readonly string[];
  /** An ISBN-13 of any of the work's editions. */
  isbns: readonly string[];
}

export type DropReason = "isbn" | "work" | "title" | "dismissed";

/** Why a candidate is dropped, or `null` when it is a book the owner has no part in. */
export function dropReason(candidate: Candidate, known: Known): DropReason | null {
  const key = titleKey(candidate.title, candidate.authors);
  if ((candidate.workKey !== null && known.dismissedWorks.has(candidate.workKey)) || known.dismissedTitles.has(key)) {
    return "dismissed";
  }
  if (candidate.isbns.some((isbn) => known.isbns.has(isbn))) return "isbn";
  if (candidate.workKey !== null && known.workKeys.has(candidate.workKey)) return "work";
  if (known.titleKeys.has(key)) return "title";
  return null;
}

/** The candidates worth showing, and how many were dropped. */
export function withoutKnown<T extends Candidate>(
  candidates: readonly T[],
  known: Known,
): { kept: T[]; dropped: number } {
  const kept = candidates.filter((candidate) => dropReason(candidate, known) === null);
  return { kept, dropped: candidates.length - kept.length };
}

/**
 * Editions of one work are one candidate: the first of each work key (or, with
 * none, each title key) wins, and takes the ISBNs of the rest. A source lists
 * its best edition first, so the first one's cover and language stay.
 */
export function mergeEditions<T extends Candidate>(candidates: readonly T[]): T[] {
  const merged = new Map<string, T>();
  for (const candidate of candidates) {
    const id = candidate.workKey ?? `t:${titleKey(candidate.title, candidate.authors)}`;
    const have = merged.get(id);
    if (have) merged.set(id, { ...have, isbns: [...new Set([...have.isbns, ...candidate.isbns])] });
    else merged.set(id, candidate);
  }
  return [...merged.values()];
}
