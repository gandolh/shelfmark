/**
 * Which codes two reads agree on. The check digit misses some misreads (two
 * wrong digits that cancel out, neighbouring digits that differ by 5 swapped),
 * and one bad frame almost never matches the next, so a code counts only once
 * a second read within `windowMs` decodes it again.
 */
export interface Confirmer {
  /** One read's codes; the ones a read before it agreed on. A code twice in one read is one sighting. */
  read(keys: readonly string[], now?: number): string[];
}

/** How soon a second read must agree with the first for a code to count. */
export const CONFIRM_WINDOW_MS = 700;

export function createConfirmer(windowMs: number = CONFIRM_WINDOW_MS): Confirmer {
  const seenAt = new Map<string, number>();
  return {
    read(keys, now = Date.now()) {
      const agreed: string[] = [];
      for (const key of new Set(keys)) {
        const before = seenAt.get(key);
        if (before !== undefined && now - before < windowMs) agreed.push(key);
        seenAt.set(key, now);
      }
      return agreed;
    },
  };
}
