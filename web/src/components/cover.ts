/**
 * The no-cover placeholder's tint: one of eight (`--color-cover-1-bg` … `--color-cover-8-bg`
 * in styles/index.css), picked from the title so a book keeps its colour
 * everywhere and between visits. Free databases miss most Romanian covers, so
 * many books wear one of these.
 */

export const COVER_TINT_COUNT = 8;

/** The classes of each tint (index 0 is tint 1): its ground and its text. Written out so Tailwind sees them. */
export const TINT_CLASS: readonly string[] = [
  "bg-cover-1-bg text-cover-1-ink",
  "bg-cover-2-bg text-cover-2-ink",
  "bg-cover-3-bg text-cover-3-ink",
  "bg-cover-4-bg text-cover-4-ink",
  "bg-cover-5-bg text-cover-5-ink",
  "bg-cover-6-bg text-cover-6-ink",
  "bg-cover-7-bg text-cover-7-ink",
  "bg-cover-8-bg text-cover-8-ink",
];

/**
 * The title as the tint sees it: trimmed, spaces collapsed, lower case, and
 * without diacritics, so "Inocenţii" (cedilla) and "Inocenții" (comma) are
 * the same book's colour.
 */
export function tintKey(title: string): string {
  return title.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim().replace(/\s+/g, " ");
}

/** 1 to 8, the same for the same title on every device: FNV-1a over the key's code points. */
export function coverTint(title: string): number {
  let hash = 0x811c9dc5;
  for (const char of tintKey(title)) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return ((hash >>> 0) % COVER_TINT_COUNT) + 1;
}

/** "Mircea Cărtărescu", "Mircea Cărtărescu and Ioan Petru Culianu", "A, B and 2 more". */
export function authorLine(authors: readonly string[]): string {
  const names = authors.map((name) => name.trim()).filter((name) => name !== "");
  if (names.length <= 2) return names.join(" and ");
  return `${names[0]}, ${names[1]} and ${names.length - 2} more`;
}
