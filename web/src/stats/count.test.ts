import { describe, expect, it } from "vitest";
import { book } from "../library/test-books";
import { computeStats, decadeOf, roomOf, top } from "./count";
import { decadeFilter, shelfFilter } from "./links";

const books = [
  book({ authors: ["Mircea Cărtărescu"], language: "ro", shelf: "Study · B1", status: "read", publishedYear: 1996, acquiredOn: "2024-03-01", priceMinor: 5000, currency: "RON" }),
  book({ authors: ["Mircea Cărtărescu"], language: "ro", shelf: "Study · B2", status: "unread", publishedYear: 1999, acquiredOn: "2024-08-10", priceMinor: 2500, currency: "RON" }),
  book({ authors: ["Neil Gaiman", "Terry Pratchett"], language: "en", shelf: "Study · B1", status: "read", publishedYear: 1990, acquiredOn: "2025-01-05", priceMinor: 1200, currency: "EUR" }),
  book({ authors: ["Terry Pratchett", "Terry Pratchett"], language: "en", shelf: "Bedroom", status: "reading", publishedYear: null, acquiredOn: "2024-12-31", priceMinor: 900, currency: "EUR" }),
  book({ authors: [], language: null, shelf: null, status: "unread", publishedYear: 2005, acquiredOn: null, priceMinor: 700 }),
  book({ authors: ["Wish Author"], language: "fr", shelf: "Study · B1", status: "unread", collection: "wishlist", publishedYear: 1850, acquiredOn: "2020-01-01", priceMinor: 100 }),
];

describe("computeStats", () => {
  const stats = computeStats(books);

  it("counts owned books only, with the wishlist as one number", () => {
    expect(stats.owned).toBe(5);
    expect(stats.wishlist).toBe(1);
    expect(stats.languages.map((t) => t.key)).not.toContain("fr");
    expect(stats.authors.map((t) => t.key)).not.toContain("Wish Author");
  });

  it("counts each author of a book once", () => {
    expect(stats.authors).toEqual([
      { key: "Mircea Cărtărescu", count: 2 },
      { key: "Terry Pratchett", count: 2 },
      { key: "Neil Gaiman", count: 1 },
    ]);
    expect(stats.distinctAuthors).toBe(3);
  });

  it("ranks languages, with none last", () => {
    expect(stats.languages).toEqual([
      { key: "en", count: 2 },
      { key: "ro", count: 2 },
      { key: "", count: 1 },
    ]);
  });

  it("groups shelves by room", () => {
    expect(stats.shelvesInUse).toBe(3);
    expect(stats.rooms).toEqual([
      { room: "Study", count: 3, shelves: [{ key: "Study · B1", count: 2 }, { key: "Study · B2", count: 1 }] },
      { room: "Bedroom", count: 1, shelves: [] },
      { room: "", count: 1, shelves: [] },
    ]);
  });

  it("counts status and decades, unknown year included", () => {
    expect(stats.statuses).toEqual([
      { key: "read", count: 2 },
      { key: "unread", count: 2 },
      { key: "reading", count: 1 },
    ]);
    expect(stats.decades).toEqual([
      { key: "1990", count: 3 },
      { key: "2000", count: 1 },
      { key: "", count: 1 },
    ]);
  });

  it("adds money per year, never across currencies, and counts what it left out", () => {
    expect(stats.spending).toEqual([
      { currency: "EUR", years: [{ year: "2025", totalMinor: 1200, books: 1 }, { year: "2024", totalMinor: 900, books: 1 }] },
      { currency: "RON", years: [{ year: "2024", totalMinor: 7500, books: 2 }] },
    ]);
    expect(stats.unpriced).toBe(1);
  });

  it("copes with an empty library", () => {
    const empty = computeStats([]);
    expect(empty.owned).toBe(0);
    expect(empty.spending).toEqual([]);
  });
});

describe("helpers", () => {
  it("finds rooms and decades", () => {
    expect(roomOf("Study · B1")).toBe("Study");
    expect(roomOf("Bedroom")).toBe("Bedroom");
    expect(decadeOf(1999)).toBe(1990);
  });

  it("cuts a list to ten and says how many more", () => {
    const rows = Array.from({ length: 13 }, (_, i) => i);
    expect(top(rows)).toEqual({ shown: rows.slice(0, 10), more: 3 });
    expect(top([1, 2])).toEqual({ shown: [1, 2], more: 0 });
  });

  it("turns counts into Library filters", () => {
    expect(decadeFilter("1990")?.filter).toEqual({ kind: "number", min: 1990, max: 1999 });
    expect(decadeFilter("")).toBeNull();
    expect(shelfFilter(["Study · B1", ""]).filter).toEqual({ kind: "pick", values: ["Study · B1", ""] });
  });
});
