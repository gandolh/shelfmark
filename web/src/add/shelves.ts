import type { Book } from "@shelfmark/shared";

/**
 * Shelves are free text written "Room · shelf" (glossary.md). These helpers
 * list the ones in use and tidy what the owner types, since a phone keyboard
 * has no middle dot.
 */

/** Every shelf an owned book sits on, the one added to most recently first. */
export function shelvesInUse(books: readonly Pick<Book, "shelf" | "collection" | "createdAt">[]): string[] {
  const latest = new Map<string, string>();
  for (const book of books) {
    if (book.collection !== "owned" || book.shelf === null || book.shelf.trim() === "") continue;
    const seen = latest.get(book.shelf);
    if (seen === undefined || book.createdAt > seen) latest.set(book.shelf, book.createdAt);
  }
  return [...latest.entries()]
    .sort(([a, at], [b, bt]) => (at === bt ? a.localeCompare(b) : at < bt ? 1 : -1))
    .map(([shelf]) => shelf);
}

/**
 * A typed shelf in the house style: spaces collapsed, and a dash, slash, bar
 * or bullet between room and shelf written as " · ". A dash inside a word
 * ("A-2") stays. Blank is `null`.
 */
export function normalizeShelf(input: string): string | null {
  const text = input
    .replace(/\s+/g, " ")
    .replace(/\s*[·•|/>]\s*/g, " · ")
    .replace(/ [-–—] /g, " · ")
    .trim()
    .replace(/^·\s*|\s*·$/g, "")
    .trim();
  return text === "" ? null : text;
}

/** The shelf as the library already spells it, when the owner typed one that exists in another case. */
export function matchShelf(shelf: string, shelves: readonly string[]): string {
  const key = shelf.toLocaleLowerCase();
  return shelves.find((existing) => existing.toLocaleLowerCase() === key) ?? shelf;
}
