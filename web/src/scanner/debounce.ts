/**
 * Which codes in view should fire. A code fires once two reads agree on it:
 * the check digit misses some misreads, and one bad frame almost never
 * matches the next. After that it stays quiet for as long as it stays in
 * view, so one book held under the camera does not register again, and
 * fires again only once it has been out of view for a while. Each code is
 * tracked on its own, so a book's ISBN and its store sticker, seen in
 * turns, do not keep re-firing each other.
 */
export interface Sightings {
  /** One read's codes; the ones that fire now. A code twice in one read is one sighting. */
  read(keys: readonly string[], now?: number): string[];
  /** True while a code has been read once and waits for the read that confirms it. */
  pending(now?: number): boolean;
  /** Restart every fired code's quiet window at `now`: a code still in frame stays quiet. */
  touch(now?: number): void;
  /** Forget every code, so the next sighting of any code starts over. */
  reset(): void;
}

/** How soon a second read must agree with the first for a code to fire. */
export const CONFIRM_WINDOW_MS = 700;

/** How long a code that fired must be out of view before it fires again (scanning.md: about 3 s). */
export const REPEAT_WINDOW_MS = 3000;

interface Seen {
  last: number;
  fired: boolean;
}

export function createSightings(
  confirmMs: number = CONFIRM_WINDOW_MS,
  repeatMs: number = REPEAT_WINDOW_MS,
): Sightings {
  const codes = new Map<string, Seen>();
  const alive = (seen: Seen, now: number): boolean => now - seen.last < (seen.fired ? repeatMs : confirmMs);
  return {
    read(keys, now = Date.now()) {
      // A code read once that found no second read, or one out of view long enough, starts over.
      for (const [key, seen] of codes) if (!alive(seen, now)) codes.delete(key);
      const fire: string[] = [];
      for (const key of new Set(keys)) {
        const seen = codes.get(key);
        if (seen === undefined) {
          codes.set(key, { last: now, fired: false });
          continue;
        }
        if (!seen.fired) fire.push(key);
        // The window runs from the latest sighting: quiet while the code stays in view.
        codes.set(key, { last: now, fired: true });
      }
      return fire;
    },
    pending(now = Date.now()) {
      for (const seen of codes.values()) if (!seen.fired && alive(seen, now)) return true;
      return false;
    },
    touch(now = Date.now()) {
      for (const seen of codes.values()) if (seen.fired) seen.last = now;
    },
    reset() {
      codes.clear();
    },
  };
}
