import type { Book } from "@shelfmark/shared";
import { collectionCounts } from "../library/view";

/**
 * The numbers behind the Stats screen (brief 29): pure functions of the books
 * already in the browser. Owned books only; the wishlist is one count.
 */

/** One row of a ranked list. `key` is what a link filters on; `""` is "none". */
export interface Tally {
  key: string;
  count: number;
}

export interface Room {
  /** The part of the shelf before " · ", or the whole shelf name when it has none; `""` for books with no shelf. */
  room: string;
  count: number;
  /** The shelves inside the room, fullest first; empty for a room that is itself the shelf. */
  shelves: Tally[];
}

export interface YearSpend {
  year: string;
  /** In minor units (bani, cents). */
  totalMinor: number;
  /** Books that had both a price and this date. */
  books: number;
}

export interface CurrencySpend {
  currency: string;
  /** Newest year first. */
  years: YearSpend[];
}

export interface Stats {
  owned: number;
  wishlist: number;
  distinctAuthors: number;
  shelvesInUse: number;
  authors: Tally[];
  languages: Tally[];
  rooms: Room[];
  statuses: Tally[];
  decades: Tally[];
  spending: CurrencySpend[];
  /** Owned books with no price or no acquired date: left out of the money lists, not guessed. */
  unpriced: number;
}

/** The key of the decade bucket for books with no year. */
export const UNKNOWN_YEAR = "";

const ROOM_SEPARATOR = " · ";

export function roomOf(shelf: string): string {
  const at = shelf.indexOf(ROOM_SEPARATOR);
  return at === -1 ? shelf : shelf.slice(0, at);
}

/** Decade of a year: 1994 → 1990. */
export function decadeOf(year: number): number {
  return Math.floor(year / 10) * 10;
}

/** Most books first; equal counts in the key's alphabetical order, "none" last. */
function rank(counts: Map<string, number>): Tally[] {
  return [...counts]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || (a.key === "" ? 1 : b.key === "" ? -1 : a.key.localeCompare(b.key, "en", { numeric: true })));
}

function bump(counts: Map<string, number>, key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

export function computeStats(books: readonly Book[]): Stats {
  const owned = books.filter((book) => book.collection === "owned");

  const authors = new Map<string, number>();
  const languages = new Map<string, number>();
  const statuses = new Map<string, number>();
  const decades = new Map<string, number>();
  const shelves = new Map<string, number>();
  const money = new Map<string, Map<string, { totalMinor: number; books: number }>>();
  let unpriced = 0;

  for (const book of owned) {
    // Each author of a multi-author book counts once for that book, even when listed twice.
    for (const name of new Set(book.authors.map((author) => author.trim()).filter((author) => author !== ""))) bump(authors, name);
    bump(languages, book.language ?? "");
    bump(statuses, book.status);
    bump(decades, book.publishedYear === null ? UNKNOWN_YEAR : String(decadeOf(book.publishedYear)));
    bump(shelves, book.shelf ?? "");

    if (book.priceMinor === null || book.acquiredOn === null) {
      unpriced += 1;
      continue;
    }
    const byYear = money.get(book.currency) ?? new Map();
    const year = book.acquiredOn.slice(0, 4);
    const spent = byYear.get(year) ?? { totalMinor: 0, books: 0 };
    spent.totalMinor += book.priceMinor;
    spent.books += 1;
    byYear.set(year, spent);
    money.set(book.currency, byYear);
  }

  const rooms = new Map<string, Map<string, number>>();
  for (const [shelf, count] of shelves) {
    const room = shelf === "" ? "" : roomOf(shelf);
    const inside = rooms.get(room) ?? new Map();
    inside.set(shelf, count);
    rooms.set(room, inside);
  }

  return {
    owned: owned.length,
    wishlist: collectionCounts(books).wishlist,
    distinctAuthors: authors.size,
    shelvesInUse: [...shelves.keys()].filter((shelf) => shelf !== "").length,
    authors: rank(authors),
    languages: rank(languages),
    rooms: [...rooms]
      .map(([room, inside]) => ({
        room,
        count: [...inside.values()].reduce((sum, n) => sum + n, 0),
        // A room with one shelf named as the room itself has nothing to list inside it.
        shelves: room === "" || (inside.size === 1 && inside.has(room)) ? [] : rank(inside),
      }))
      .sort((a, b) => b.count - a.count || (a.room === "" ? 1 : b.room === "" ? -1 : a.room.localeCompare(b.room, "en", { numeric: true }))),
    statuses: rank(statuses),
    decades: rank(decades),
    spending: [...money]
      .map(([currency, byYear]) => ({
        currency,
        years: [...byYear]
          .map(([year, spent]) => ({ year, ...spent }))
          .sort((a, b) => b.year.localeCompare(a.year)),
      }))
      .sort((a, b) => a.currency.localeCompare(b.currency)),
    unpriced,
  };
}

/** The first `limit` rows and how many were left out: "and 12 more". */
export function top<T>(rows: readonly T[], limit = 10): { shown: readonly T[]; more: number } {
  return { shown: rows.slice(0, limit), more: Math.max(0, rows.length - limit) };
}
