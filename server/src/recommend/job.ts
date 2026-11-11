import type { ImportJob, RecommendationImport } from "@shelfmark/shared";
import type { Catalog, CatalogWork } from "./openlibrary.js";
import { matchPick } from "./openlibrary.js";
import { mergeEditions, withoutKnown } from "./dedup.js";
import { titleKey } from "./keys.js";
import type { RecommendationStore, StoredRecommendation } from "./store.js";

/**
 * The import's check (brief 04, step 2): each pick Claude named is looked up
 * in Open Library, by ISBN when it gave one, else by title and author. A pick
 * not found is listed as "not found" and never shown; the found ones go through
 * the dedup, and what is left is stored. One pick at a time (the catalog's
 * queue paces the requests), progress kept for the page to poll.
 */

export interface ImportJobRunner {
  /** Starts a check. Throws while another is running: one at a time. */
  start(picks: RecommendationImport): void;
  state(): ImportJob;
  /** Resolves when the running check ends. For tests. */
  settled(): Promise<void>;
}

const IDLE: ImportJob = { state: "idle", total: 0, checked: 0, notFound: [], dropped: 0, added: 0 };

export class ImportBusy extends Error {
  constructor() {
    super("An import is still being checked.");
  }
}

/** The pick's work from Open Library, or `null`. Two requests at most: the ISBN, then the title. */
async function resolve(catalog: Catalog, pick: RecommendationImport[number]): Promise<CatalogWork | null> {
  if (pick.isbn13) {
    const [first] = await catalog.byIsbn(pick.isbn13);
    if (first) return first;
  }
  return matchPick(pick, await catalog.byTitle(pick.title, pick.authors[0]));
}

export function createImportJob(catalog: Catalog, store: RecommendationStore): ImportJobRunner {
  let current: ImportJob = IDLE;
  let running: Promise<void> = Promise.resolve();

  async function run(picks: RecommendationImport): Promise<void> {
    const found: StoredRecommendation[] = [];
    for (const pick of picks) {
      let work: CatalogWork | null = null;
      try {
        work = await resolve(catalog, pick);
      } catch {
        // Open Library did not answer for this pick: it is not shown, and the owner can import it again.
        work = null;
      }
      if (work === null) {
        current = {
          ...current,
          checked: current.checked + 1,
          notFound: [...current.notFound, { title: pick.title, authors: pick.authors }],
        };
        continue;
      }
      found.push({
        key: work.workKey,
        workKey: work.workKey,
        title: work.title,
        authors: work.authors,
        year: work.year,
        language: work.language,
        coverUrl: work.coverUrl,
        isbns: work.isbns,
        reasons: [pick.reason],
        source: "claude",
        score: 0,
      });
      current = { ...current, checked: current.checked + 1 };
    }
    const { kept, dropped } = withoutKnown(mergeEditions(found), store.known());
    const listed = new Set(store.list(Number.MAX_SAFE_INTEGER).map((r) => r.key));
    const fresh = kept.filter(
      (pick) => !listed.has(pick.key) && !listed.has(`t:${titleKey(pick.title, pick.authors)}`),
    );
    store.append(kept);
    current = { ...current, state: "done", dropped: dropped + (kept.length - fresh.length), added: fresh.length };
  }

  return {
    start(picks) {
      if (current.state === "running") throw new ImportBusy();
      current = { state: "running", total: picks.length, checked: 0, notFound: [], dropped: 0, added: 0 };
      running = run(picks).catch(() => {
        current = { ...current, state: "done" };
      });
    },
    state: () => current,
    settled: () => running,
  };
}
