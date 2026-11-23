import { RECOMMENDATIONS_MAX, type RefreshJob } from "@shelfmark/shared";
import { mergeEditions, withoutKnown } from "../dedup.js";
import { titleKey } from "../keys.js";
import type { Catalog } from "../openlibrary.js";
import type { RecommendationStore, StoredRecommendation } from "../store.js";
import { gatherCandidates } from "./candidates.js";
import type { Embedder } from "./embedder.js";
import { bookText, profileOf } from "./profile.js";
import { rank } from "./rank.js";

/**
 * The Similar refresh: read the library's taste, ask Open Library by its
 * authors and subjects, leave out every book the library has or dismissed
 * and every work Claude already named, run the model over the library and the
 * rest, and keep the closest as the Similar rows. One at a time; progress for
 * the page to poll.
 */

export interface RefreshJobRunner {
  /** Starts a refresh. Throws `RefreshBusy` while one runs. */
  start(): void;
  state(): RefreshJob;
  /** Stops a running refresh (the server is closing): its child process ends, nothing is stored. */
  stop(): void;
  /** Resolves when the running refresh ends. For tests. */
  settled(): Promise<void>;
}

export interface RefreshJobDeps {
  catalog: Catalog;
  store: RecommendationStore;
  embedder: Embedder;
  /** Where a failure's cause goes: the page only says the model did not run. */
  log: (error: unknown) => void;
}

const IDLE: RefreshJob = { state: "idle", step: null, done: 0, total: 0, added: 0, message: null };

export class RefreshBusy extends Error {
  constructor() {
    super("Similar books are still being found.");
  }
}

export function createRefreshJob({ catalog, store, embedder, log }: RefreshJobDeps): RefreshJobRunner {
  let current: RefreshJob = IDLE;
  let running: Promise<void> = Promise.resolve();
  let controller = new AbortController();

  const finish = (added: number, message: string | null) => {
    current = { state: "done", step: null, done: 0, total: 0, added, message };
  };

  async function run(signal: AbortSignal): Promise<void> {
    const profile = profileOf(store.library());
    if (profile.seeds.length === 0) {
      finish(0, "There is nothing to compare yet: add books to your library first.");
      return;
    }

    const found = await gatherCandidates(catalog, profile, (done, total) => {
      current = { ...current, step: "catalog", done, total };
    });
    if (signal.aborted) return;
    const { kept } = withoutKnown(mergeEditions(found), store.known());
    const listed = store.listedSources();
    // Open Library sometimes keeps one book as several works ("Villette" three times): one each.
    const seen = new Set<string>();
    const candidates = kept.filter((work) => {
      const key = titleKey(work.title, work.authors);
      if (seen.has(key)) return false;
      seen.add(key);
      const source = listed.get(work.workKey) ?? listed.get(`t:${key}`);
      return source === undefined || source === "similar";
    });
    if (candidates.length === 0) {
      store.replaceSource("similar", []);
      finish(0, "Open Library had no book you don't have already.");
      return;
    }

    const texts = [
      ...profile.seeds.map((seed) => seed.text),
      ...candidates.map((work) => bookText(work.title, work.authors, work.subjects)),
    ];
    current = { ...current, step: "model", done: 0, total: texts.length };
    const vectors = await embedder.embed(
      texts,
      (done) => {
        current = { ...current, done };
      },
      signal,
    );
    const seedVectors = vectors.slice(0, profile.seeds.length);
    const candidateVectors = vectors.slice(profile.seeds.length);
    const ranked = rank(candidates, candidateVectors, profile.seeds, seedVectors, RECOMMENDATIONS_MAX);
    const rows: StoredRecommendation[] = ranked.map(({ work, score, reason }) => ({
      key: work.workKey,
      workKey: work.workKey,
      title: work.title,
      authors: work.authors,
      year: work.year,
      language: work.language,
      coverUrl: work.coverUrl,
      isbns: work.isbns,
      reasons: [reason],
      source: "similar",
      score,
    }));
    if (signal.aborted) return;
    store.replaceSource("similar", rows);
    finish(rows.length, null);
  }

  return {
    start() {
      if (current.state === "running") throw new RefreshBusy();
      controller = new AbortController();
      const { signal } = controller;
      current = { state: "running", step: "catalog", done: 0, total: 0, added: 0, message: null };
      running = run(signal).catch((error: unknown) => {
        if (signal.aborted) return;
        log(error);
        current = {
          state: "failed",
          step: null,
          done: 0,
          total: 0,
          added: 0,
          message: "The model did not run on the server. Its log says why.",
        };
      });
    },
    state: () => current,
    stop() {
      controller.abort();
    },
    settled: () => running,
  };
}
