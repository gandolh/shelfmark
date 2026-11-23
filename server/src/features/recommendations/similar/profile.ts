import { fold, looseStem, surname } from "../keys.js";
import type { LibraryBook } from "../store.js";

/**
 * What the library says about its readers' taste, for the Similar refresh:
 * the books a candidate is compared with (seeds), and the authors and
 * subjects Open Library is asked about. The list is the household's, so every
 * reader's rating counts.
 */

/** A library book candidates are compared with. */
export interface Seed {
  title: string;
  /** How much a book close to it counts: 0.5 (unread) to 3 (rated 5). */
  weight: number;
  /** The highest rating anyone gave it, shown in the reason. */
  rating: number | null;
  collection: "owned" | "wishlist";
  /** What the model reads: title, authors, subjects and tags. */
  text: string;
}

export interface Profile {
  /** Heaviest first, at most `SEEDS_MAX`. */
  seeds: Seed[];
  /** Every author of a seed, by summed weight, heaviest first. */
  authors: string[];
  /**
   * Catalog subjects at least two seeds share, by summed weight, generic ones
   * left out. Never the owner's own tags: those stay on the server (the model
   * reads them), since a search must not carry what the owner wrote.
   */
  subjects: string[];
  /** The languages the library's books are in. */
  languages: ReadonlySet<string>;
  /** The languages the library holds each author in, by surname. */
  authorLanguages: ReadonlyMap<string, ReadonlySet<string>>;
  /** Every book's title stem (`looseStem`), both collections: a candidate repeating one is left out. */
  titleStems: ReadonlySet<string>;
}

/** Enough books to say what the library likes, few enough to compare in seconds. */
const SEEDS_MAX = 400;
/** Words the model reads per book beyond its title and authors. */
const TOPICS_MAX = 12;

/**
 * Open Library's subjects that name no topic: they would bring back the most
 * published books of all, whatever the library holds.
 */
const GENERIC = new Set([
  "fiction",
  "general",
  "literature",
  "novel",
  "novels",
  "classic",
  "classics",
  "accessible book",
  "protected daisy",
  "in library",
  "large type books",
  "lending library",
  "open library staff picks",
  "long now manual for civilization",
  "fiction, general",
]);
const GENERIC_PART = /^nyt:|reading level|translations? into|staff picks|award|bestseller/;

function generic(subject: string): boolean {
  const folded = fold(subject).trim();
  return folded === "" || GENERIC.has(folded) || GENERIC_PART.test(folded);
}

/** A book's weight: its best rating if anyone gave one, else what its statuses and collection say. 0 leaves it out. */
export function weightOf(book: LibraryBook): number {
  if (book.bestRating !== null) {
    if (book.bestRating >= 5) return 3;
    if (book.bestRating === 4) return 2;
    return book.bestRating === 3 ? 1 : 0;
  }
  if (book.collection === "wishlist") return 1;
  if (book.statuses.some((status) => status === "read" || status === "reading")) return 1;
  if (book.statuses.length > 0 && book.statuses.every((status) => status === "abandoned")) return 0;
  return 0.5;
}

/** The text the model reads for a book or a candidate. */
export function bookText(title: string, authors: readonly string[], topics: readonly string[]): string {
  return [title, authors.join(", "), topics.slice(0, TOPICS_MAX).join(", ")].filter((part) => part !== "").join(". ");
}

/** Adds `weight` to `key`, keeping the first spelling met. */
function tally(into: Map<string, { name: string; weight: number; books: number }>, name: string, weight: number) {
  const key = fold(name).trim();
  if (key === "") return;
  const have = into.get(key);
  if (have) into.set(key, { ...have, weight: have.weight + weight, books: have.books + 1 });
  else into.set(key, { name, weight, books: 1 });
}

const heaviest = (tallies: Map<string, { name: string; weight: number; books: number }>, minBooks: number) =>
  [...tallies.values()]
    .filter((entry) => entry.books >= minBooks)
    .sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name))
    .map((entry) => entry.name);

export function profileOf(books: readonly LibraryBook[]): Profile {
  const weighed = books
    .map((book) => ({ book, weight: weightOf(book) }))
    .filter((entry) => entry.weight > 0)
    // Stable: equal weights keep the library's order.
    .sort((a, b) => b.weight - a.weight)
    .slice(0, SEEDS_MAX);

  const authors = new Map<string, { name: string; weight: number; books: number }>();
  const subjects = new Map<string, { name: string; weight: number; books: number }>();
  const languages = new Set<string>();
  const authorLanguages = new Map<string, Set<string>>();
  const titleStems = new Set<string>();
  for (const book of books) {
    const stem = looseStem(book.title);
    if (stem !== "") titleStems.add(stem);
    if (book.language === null) continue;
    languages.add(book.language);
    for (const author of book.authors) {
      const key = surname(author);
      if (key === "") continue;
      const known = authorLanguages.get(key) ?? new Set<string>();
      known.add(book.language);
      authorLanguages.set(key, known);
    }
  }
  for (const { book, weight } of weighed) {
    for (const author of book.authors) tally(authors, author, weight);
    for (const subject of new Set(book.subjects)) if (!generic(subject)) tally(subjects, subject, weight);
  }

  return {
    seeds: weighed.map(({ book, weight }) => ({
      title: book.title,
      weight,
      rating: book.bestRating,
      collection: book.collection,
      text: bookText(book.subtitle ? `${book.title}: ${book.subtitle}` : book.title, book.authors, [
        ...book.subjects,
        ...book.tags,
      ]),
    })),
    authors: heaviest(authors, 1),
    subjects: heaviest(subjects, 2),
    languages,
    authorLanguages,
    titleStems,
  };
}
