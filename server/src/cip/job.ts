import type { Log } from "./refresh.js";

/**
 * The CIP refresh on a timer: a minute after the server starts, then every 7
 * days, never two at once. The timers don't keep the process alive. index.ts
 * starts it unless `CIP_REFRESH=off`; tests and the seed never do.
 */

export const FIRST_RUN_DELAY_MS = 60_000;
export const RUN_EVERY_MS = 7 * 24 * 60 * 60 * 1000;

export interface CipJob {
  /** Stops the timers; a run in progress finishes on its own. */
  stop(): void;
}

export function startCipJob(run: () => Promise<unknown>, log: Log, firstDelayMs = FIRST_RUN_DELAY_MS): CipJob {
  let running = false;
  const tick = () => {
    if (running) return;
    running = true;
    run()
      .catch((error: unknown) => log.error(`cip: refresh failed: ${error instanceof Error ? error.message : String(error)}`))
      .finally(() => {
        running = false;
      });
  };
  const first = setTimeout(tick, firstDelayMs);
  const every = setInterval(tick, RUN_EVERY_MS);
  first.unref();
  every.unref();
  return {
    stop() {
      clearTimeout(first);
      clearInterval(every);
    },
  };
}
