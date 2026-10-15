/**
 * Continuous mode's repeat guard: a code that fired is ignored for a while, so
 * one book held under the camera does not register five times. Each code has
 * its own window, so a book's ISBN and its store sticker, seen in turns, do not
 * keep re-firing each other.
 */
export interface RepeatGuard {
  /** True when `key` should fire now; firing starts its quiet window. */
  accept(key: string, now?: number): boolean;
  /** Forget every code, so the next sighting of any code fires. */
  reset(): void;
}

/** How long the same code stays quiet after it fires (scanning.md: about 3 s). */
export const REPEAT_WINDOW_MS = 3000;

export function createRepeatGuard(windowMs: number = REPEAT_WINDOW_MS): RepeatGuard {
  const firedAt = new Map<string, number>();
  return {
    accept(key, now = Date.now()) {
      const last = firedAt.get(key);
      // The window runs from when the code fired, not from its latest sighting:
      // "ignored for 3 seconds after it fires".
      if (last !== undefined && now - last < windowMs) return false;
      firedAt.set(key, now);
      // Codes long out of their window can never block again; drop them so a
      // whole shelf of scans does not grow the map for the session.
      for (const [k, t] of firedAt) if (now - t >= windowMs) firedAt.delete(k);
      return true;
    },
    reset() {
      firedAt.clear();
    },
  };
}
