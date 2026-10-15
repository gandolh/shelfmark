/**
 * One in-process queue per metadata source: one request at a time, each
 * starting at least `spacingMs` after the previous one started, so a batch (a
 * CSV import, the offline queue) never bursts. Cache hits never enter a queue.
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

export interface Queue {
  /**
   * Runs `task` once every earlier task has settled and at least the spacing
   * after the previous task started. A task that fails fails its own caller
   * only; the queue goes on.
   */
  run<T>(task: () => Promise<T>): Promise<T>;
}

export function createQueue(spacingMs: number, clock: Clock = realClock): Queue {
  let tail: Promise<unknown> = Promise.resolve();
  let lastStart = Number.NEGATIVE_INFINITY;

  return {
    run<T>(task: () => Promise<T>): Promise<T> {
      const turn = tail.then(async () => {
        // A loop, because a timer may fire a millisecond early.
        for (let wait = lastStart + spacingMs - clock.now(); wait > 0; wait = lastStart + spacingMs - clock.now()) {
          await clock.sleep(wait);
        }
        lastStart = clock.now();
        return task();
      });
      tail = turn.catch(() => undefined);
      return turn;
    },
  };
}
