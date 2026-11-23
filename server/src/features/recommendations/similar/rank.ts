import { surname } from "../keys.js";
import type { CatalogWork } from "../openlibrary.js";
import type { Seed } from "./profile.js";

/**
 * The ranking: a candidate scores its best cosine similarity to a seed,
 * scaled by that seed's weight, and names that seed in its reason. The
 * model's vectors are unit length, so the cosine is the dot product.
 */

/** A list that is not one author's shelf: at most this many books by one author. */
export const PER_AUTHOR_MAX = 3;

export interface Ranked {
  work: CatalogWork;
  score: number;
  reason: string;
}

function dot(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length && i < b.length; i++) sum += (a[i] ?? 0) * (b[i] ?? 0);
  return sum;
}

/** 0.75 for an unread book up to 1 for one rated 5: a rating moves a book up, closeness still leads. */
const factor = (weight: number) => 0.7 + 0.1 * weight;

export function reasonFor(seed: Seed): string {
  if (seed.rating !== null) return `Close to “${seed.title}”, rated ${seed.rating}.`;
  if (seed.collection === "wishlist") return `Close to “${seed.title}” on your wishlist.`;
  return `Close to “${seed.title}” in your library.`;
}

/** The best `limit` candidates, at most `PER_AUTHOR_MAX` by one author. Vectors line up with their lists. */
export function rank(
  candidates: readonly CatalogWork[],
  candidateVectors: readonly Float32Array[],
  seeds: readonly Seed[],
  seedVectors: readonly Float32Array[],
  limit: number,
): Ranked[] {
  const scored: Ranked[] = [];
  for (const [index, work] of candidates.entries()) {
    const vector = candidateVectors[index];
    if (!vector) continue;
    let bestSeed: Seed | null = null;
    let bestScore = -Infinity;
    for (const [at, seed] of seeds.entries()) {
      const seedVector = seedVectors[at];
      if (!seedVector) continue;
      const score = dot(vector, seedVector) * factor(seed.weight);
      if (score > bestScore) {
        bestSeed = seed;
        bestScore = score;
      }
    }
    if (bestSeed !== null) scored.push({ work, score: bestScore, reason: reasonFor(bestSeed) });
  }

  scored.sort((a, b) => b.score - a.score);
  const perAuthor = new Map<string, number>();
  const out: Ranked[] = [];
  for (const entry of scored) {
    const by = surname(entry.work.authors[0] ?? "");
    const count = perAuthor.get(by) ?? 0;
    if (by !== "" && count === PER_AUTHOR_MAX) continue;
    perAuthor.set(by, count + 1);
    out.push(entry);
    if (out.length === limit) break;
  }
  return out;
}
