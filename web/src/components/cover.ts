/**
 * The no-cover placeholder's tint: one of eight (`--cover-1-bg` … `--cover-8-bg`
 * in styles/tokens.css), picked from the title so a book keeps its colour
 * everywhere and between visits. Free databases miss most Romanian covers, so
 * many books wear one of these.
 */

export const COVER_TINT_COUNT = 8;

/**
 * The title as the tint sees it: trimmed, spaces collapsed, lower case, and
 * without diacritics, so "Inocenţii" (cedilla) and "Inocenții" (comma) are
 * the same book's colour.
 */
export function tintKey(title: string): string {
  return title
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
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
