import type { Book } from "@shelfmark/shared";

/**
 * The Library's search (corpus/wiki/library-table.md): one box over title,
 * subtitle, authors, publisher, series, ISBN, tags and notes, blind to case
 * and diacritics, so "cartarescu" finds "Cărtărescu" and the old cedilla
 * spellings (ş, ţ) find the comma ones (ș, ț). Each word of the query has to
 * appear somewhere in the book; an ISBN matches with or without its hyphens.
 */

/** Lower case, without diacritics: NFD, then every combining mark dropped. */
export function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** An ISBN as typed, without its hyphens and spaces: "978-606-32" → "97860632". */
export function compactIsbn(text: string): string {
  return text.replace(/[\s\-‐‑–]/g, "");
}

// A book's folded text, once per book object: the store replaces a book's
// object when it changes, so a stale entry is never read and is collected
// with its book. Notes can run to thousands of characters, and folding them
// on every keystroke would not keep typing under 50 ms at 3,000 books.
const haystacks = new WeakMap<Book, string>();

/** Everything the search box looks at, folded and joined. */
export function haystack(book: Book): string {
  let text = haystacks.get(book);
  if (text === undefined) {
    text = fold(
      [
        book.title,
        book.subtitle,
        book.authors.join("\n"),
        book.publisher,
        book.series,
        book.isbn13,
        book.tags.join("\n"),
        book.notes,
      ]
        .filter((part): part is string => part !== null && part !== "")
        .join("\n"),
    );
    haystacks.set(book, text);
  }
  return text;
}

/**
 * Fold every book's text ahead of the first keystroke, when the browser is
 * idle: the first search over 3,000 books otherwise pays ~15 ms for it.
 * Returns a cancel.
 */
export function warmSearch(books: readonly Book[]): () => void {
  const run = () => {
    for (const book of books) haystack(book);
  };
  if (typeof requestIdleCallback === "function") {
    const handle = requestIdleCallback(run, { timeout: 2000 });
    return () => cancelIdleCallback(handle);
  }
  const timer = setTimeout(run, 200);
  return () => clearTimeout(timer);
}

/**
 * A matcher for what is in the search box, or `null` when it is blank (every
 * book matches). Words are matched anywhere, in any order; a query that is
 * an ISBN or a run of its digits, hyphenated or not, also matches the ISBN.
 */
export function compileSearch(query: string): ((book: Book) => boolean) | null {
  const words = fold(query).split(/\s+/).filter((word) => word !== "");
  if (words.length === 0) return null;
  const digits = compactIsbn(query);
  const isbnQuery = /^\d{3,}$/.test(digits) ? digits : null;
  return (book) => {
    if (isbnQuery !== null && book.isbn13?.includes(isbnQuery)) return true;
    const text = haystack(book);
    return words.every((word) => text.includes(word));
  };
}

/** The books that match the query, in the order given. */
export function searchBooks(books: readonly Book[], query: string): readonly Book[] {
  const matches = compileSearch(query);
  return matches ? books.filter(matches) : books;
}
