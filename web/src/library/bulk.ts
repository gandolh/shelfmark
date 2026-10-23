import type { Book, BookBulkResult, BulkChange } from "@shelfmark/shared";
import { STATUS_LABELS } from "../add/StatusPicker";

/**
 * The bulk bar's words and choices (brief 26): the shelves and tags its
 * dialogs offer, the tags a typed line holds, and the line it shows once a
 * change is saved.
 */

const collator = new Intl.Collator("ro", { sensitivity: "base", numeric: true });

/** "1 book", "3 books", "1,204 books". */
export function bookCount(count: number): string {
  return count === 1 ? "1 book" : `${count.toLocaleString("en-GB")} books`;
}

export interface Choice {
  name: string;
  /** How many books have it: every owned book for a shelf, the selected books for a tag. */
  count: number;
}

function counted(names: Iterable<string>): Choice[] {
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => collator.compare(a.name, b.name));
}

/** The shelves owned books sit on, by name, so "Bedroom · B1" and "Bedroom · B2" sit together. */
export function shelfChoices(books: readonly Book[]): Choice[] {
  return counted(books.flatMap((book) => (book.collection === "owned" && book.shelf ? [book.shelf] : [])));
}

/** The tags the selected books carry, by name. The server spells a tag one way, so equal names are one tag. */
export function tagChoices(selected: readonly Book[]): Choice[] {
  return counted(selected.flatMap((book) => book.tags));
}

/** The tags in what the owner typed: split at commas and semicolons, trimmed, each once whatever its case. */
export function parseTags(text: string): string[] {
  const seen = new Map<string, string>();
  for (const piece of text.split(/[,;]/)) {
    const tag = piece.trim().replace(/\s+/g, " ");
    if (tag !== "" && !seen.has(tag.toLowerCase())) seen.set(tag.toLowerCase(), tag);
  }
  return [...seen.values()];
}

function tagWords(tags: readonly string[]): string {
  return tags.length === 1 ? `“${tags[0]}”` : `${tags.length} tags`;
}

/** The line the bar shows once a change is saved. A delete's is only said: its rows are gone, and the bar with them. */
export function describeResult(change: BulkChange, result: BookBulkResult): string {
  const books = bookCount(result.books.length);
  switch (change.kind) {
    case "shelf": {
      const off = result.books.length === 1 ? "its shelf" : "their shelves";
      const moved = change.shelf === null ? `Took ${books} off ${off}.` : `Moved ${books} to ${change.shelf}.`;
      const skipped = result.skipped.length;
      if (skipped === 0) return moved;
      const left = `Left out ${skipped === 1 ? "1 wishlist book" : `${skipped} wishlist books`}: only owned books sit on shelves.`;
      return result.books.length === 0 ? left : `${moved} ${left}`;
    }
    case "status":
      return `Marked ${books} ${STATUS_LABELS[change.status]}.`;
    case "addTags":
      return `Added ${tagWords(change.tags)} to ${books}.`;
    case "removeTags":
      return `Took ${tagWords(change.tags)} off ${books}.`;
    case "delete":
      return `Deleted ${bookCount(result.deleted.length)}.`;
  }
}
