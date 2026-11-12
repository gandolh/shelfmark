/**
 * One in-process queue per metadata source: one request at a time, each
 * starting at least the spacing after the previous one started (or, for the
 * library catalogs, ended), so a batch (a CSV import, the offline queue) never
 * bursts. Cache hits never enter a queue.
 */

/** What a queue waits on. Tests pass a fake one that moves time by itself. */
export interface Clock {
  /** Milliseconds, monotonic. */
  now(): number;
  sleep(ms: number): Promise<void>;
}

export const realClock: Clock = {
  now: () => performance.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/** Open Library allows 3 requests a second with a `User-Agent` naming the app: 2.5 keeps under it. */
export const OPEN_LIBRARY_SPACING_MS = 400;
export const GOOGLE_BOOKS_SPACING_MS = 200;

/** A spacing that can vary per request, measured from the previous request's start or end. */
export interface Spacing {
  /** The pause before the next request, drawn after each one. */
  ms(): number;
  from: "start" | "end";
}

/**
 * The library catalogs publish no limits, and the owner asked for a random
 * 5-10 s pause after each request ends (decisions.md, 2026-10-17).
 */
export const LIBRARY_SPACING: Spacing = { ms: () => 5000 + Math.random() * 5000, from: "end" };

export interface Queue {
  /**
   * Runs `task` once every earlier task has settled and at least the spacing
   * after the previous task started. A task that fails fails its own caller
   * only; the queue goes on.
   */
  run<T>(task: () => Promise<T>): Promise<T>;
}

/** `spacing` in milliseconds is a fixed spacing from the previous start. */
export function createQueue(spacing: number | Spacing, clock: Clock = realClock): Queue {
  const { ms, from } = typeof spacing === "number" ? { ms: () => spacing, from: "start" } : spacing;
  let tail: Promise<unknown> = Promise.resolve();
  // The previous task's start or end, whichever `from` says, and the pause drawn after it.
  let last = Number.NEGATIVE_INFINITY;
  let gap = 0;

  return {
    run<T>(task: () => Promise<T>): Promise<T> {
      const turn = tail.then(async () => {
        // A loop, because a timer may fire a millisecond early.
        for (let wait = last + gap - clock.now(); wait > 0; wait = last + gap - clock.now()) {
          await clock.sleep(wait);
        }
        if (from === "start") last = clock.now();
        try {
          return await task();
        } finally {
          if (from === "end") last = clock.now();
          gap = ms();
        }
      });
      tail = turn.catch(() => undefined);
      return turn;
    },
  };
}
