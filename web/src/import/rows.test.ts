import { ApiError } from "../api";
import { describe, expect, it, vi } from "vitest";
import type { LookupResponse } from "@shelfmark/shared";
import { toCsv } from "../export/csv";
import { cellOf } from "../export/fields";
import { COLUMNS } from "../library/columns";
import { book } from "../library/test-books";
import { columnsIn } from "../library/view";
import { parseCsv } from "./csv";
import { guessMapping, isUsable, parseDate, parsePrice, parseRating, parseStatus } from "./fields";
import {
  applyLookup,
  bodyFromRow,
  buildRows,
  flagRows,
  lookupTargets,
  runLookups,
  saveRows,
  tickedByDefault,
  type ImportRow,
} from "./rows";

const DUNE = "9780441172719";
const ULYSSES = "9780306406157";
const SOLENOID = "9789734647262";

function load(csv: string) {
  const table = parseCsv(csv);
  const { format, mapping } = guessMapping(table[0] ?? []);
  return { format, mapping, rows: buildRows(table, mapping) };
}

const GOODREADS = [
  "Book Id,Title,Author,Author l-f,Additional Authors,ISBN,ISBN13,My Rating,Publisher,Binding,Number of Pages,Year Published,Exclusive Shelf,Bookshelves,Private Notes",
  `1,"Dune (Dune, #1)",Frank Herbert,"Herbert, Frank","Brian Herbert, Kevin J. Anderson","=""0441172717""","=""${DUNE}""",5,Ace,Paperback,604,2005,read,"favorites, sf",from a friend`,
  `2,Solenoid,Mircea Cartarescu,,,"=""""","=""${SOLENOID}""",0,Humanitas,Hardcover,,2015,to-read,,`,
].join("\n");

describe("a Goodreads export", () => {
  const { format, mapping, rows } = load(GOODREADS);

  it("is recognised and needs no mapping step", () => {
    expect(format?.id).toBe("goodreads");
    expect(isUsable(mapping)).toBe(true);
  });

  it("maps its columns", () => {
    expect(rows[0]).toMatchObject({
      line: 2,
      title: "Dune (Dune, #1)",
      authors: ["Frank Herbert", "Brian Herbert", "Kevin J. Anderson"],
      isbn13: DUNE,
      details: { rating: 5, publisher: "Ace", format: "paperback", pages: 604, publishedYear: 2005, status: "read", tags: ["favorites", "sf"], notes: "from a friend" },
    });
    expect(rows[1]).toMatchObject({ isbn13: SOLENOID, details: { format: "hardcover", status: "unread" } });
    expect(rows[1]?.details.rating).toBeUndefined();
  });
});

describe("flags", () => {
  const { rows } = load(GOODREADS);
  const owned = [book({ isbn13: DUNE }), book({ isbn13: SOLENOID, collection: "wishlist" })];

  it("flags a book already owned and unticks it", () => {
    const flags = flagRows(rows, owned, "owned");
    expect(flags[0]).toEqual(["in-library"]);
    expect(flags[1]).toEqual([]);
    expect(tickedByDefault(flags[0] ?? [])).toBe(false);
    expect(tickedByDefault(flags[1] ?? [])).toBe(true);
  });

  it("counts the wishlist too when importing into it", () => {
    expect(flagRows(rows, owned, "wishlist")[1]).toEqual(["in-library"]);
  });

  it("flags a second row with the same ISBN, an invalid ISBN and a row with nothing", () => {
    const csv = `Title,ISBN\nA,${ULYSSES}\nB,${ULYSSES}\nC,9780306406158\n,\n,${DUNE}`;
    const flags = flagRows(load(csv).rows, [], "owned");
    expect(flags).toEqual([[], ["in-file"], ["invalid-isbn"], ["needs-lookup"]]);
  });
});

describe("a Libib file with only ISBNs", () => {
  const csv = `ean_isbn13\n${DUNE}\n${ULYSSES}\n`;
  const { rows } = load(csv);

  it("needs a lookup for every row, ticked", () => {
    const flags = flagRows(rows, [], "owned");
    expect(flags).toEqual([["needs-lookup"], ["needs-lookup"]]);
    expect(lookupTargets(rows, new Set([0, 1]))).toEqual([0, 1]);
    expect(lookupTargets(rows, new Set([1]))).toEqual([1]);
  });

  it("looks up one at a time, in order, and stops when told", async () => {
    let active = 0;
    let peak = 0;
    const order: string[] = [];
    const controller = new AbortController();
    const response = (isbn: string): LookupResponse => ({
      isbn13: isbn,
      draft: { isbn13: isbn, title: `T ${isbn}`, subtitle: null, authors: ["A"], publisher: "P", publishedYear: 2000, pages: null, language: null, description: null, subjects: [], coverCandidates: [], sources: ["openlibrary"] },
      tried: [],
      owned: [],
      wishlisted: [],
    });
    const lookup = async (isbn: string) => {
      active++;
      peak = Math.max(peak, active);
      order.push(isbn);
      await Promise.resolve();
      active--;
      controller.abort(); // Stop pressed during the first lookup
      return response(isbn);
    };
    const seen: number[] = [];
    const run = await runLookups(rows, [0, 1], lookup, controller.signal, (index) => seen.push(index));
    expect(order).toEqual([DUNE]);
    expect(peak).toBe(1);
    expect(seen).toEqual([0]);
    expect(run).toMatchObject({ done: 1, stoppedBy: "signal" });
  });

  it("marks a failed lookup and goes on, but ends the run when there is no network", async () => {
    const calls: string[] = [];
    const flaky = async (isbn: string): Promise<LookupResponse> => {
      calls.push(isbn);
      throw new ApiError(500, "internal", "boom");
    };
    const updated: ImportRow[] = [];
    const run = await runLookups(rows, [0, 1], flaky, new AbortController().signal, (_, row) => updated.push(row));
    expect(calls).toHaveLength(2);
    expect(updated.map((row) => row.lookup)).toEqual(["failed", "failed"]);
    expect(run.stoppedBy).toBeNull();

    const offline = vi.fn(async (): Promise<LookupResponse> => {
      throw new ApiError(0, "network", "offline");
    });
    const ended = await runLookups(rows, [0, 1], offline, new AbortController().signal, () => {});
    expect(offline).toHaveBeenCalledTimes(1);
    expect(ended.stoppedBy).toBe("error");
  });

  it("fills the row from the draft, or calls it not found", () => {
    const row = rows[0] as ImportRow;
    const found = applyLookup(row, {
      isbn13: DUNE,
      draft: { isbn13: DUNE, title: "Dune", subtitle: null, authors: ["Frank Herbert"], publisher: "Ace", publishedYear: 1965, pages: 412, language: "en", description: null, subjects: [], coverCandidates: [], sources: ["bcucluj"] },
      tried: [],
      owned: [],
      wishlisted: [],
    });
    expect(found).toMatchObject({ title: "Dune", authors: ["Frank Herbert"], lookup: "found", source: "bcucluj", details: { publisher: "Ace", pages: 412 } });
    expect(applyLookup(row, { isbn13: DUNE, draft: null, tried: [], owned: [], wishlisted: [] }).lookup).toBe("not_found");
  });
});

describe("saving", () => {
  const { rows } = load(`Title,Author,Shelf,ISBN\nDune,Frank Herbert,Hall · A2,${DUNE}\nSolenoid,,,\n`);

  it("builds an owned body with its shelf and a wishlist body without one", () => {
    expect(bodyFromRow(rows[0] as ImportRow, "owned")).toEqual({
      title: "Dune",
      authors: ["Frank Herbert"],
      isbn13: DUNE,
      shelf: "Hall · A2",
      metadataSource: "import",
    });
    expect(bodyFromRow(rows[0] as ImportRow, "wishlist")).toMatchObject({ shelf: null, collection: "wishlist" });
  });

  it("saves one at a time and reports a failure without stopping", async () => {
    const create = vi.fn(async (body: { title: string }) => {
      if (body.title === "Dune") throw new ApiError(400, "validation", "title too long");
      return {};
    });
    const report = await saveRows(rows, "owned", create);
    expect(report).toEqual({ saved: 1, failed: [{ line: 2, title: "Dune", reason: "title too long" }], untried: 0 });
  });

  it("stops when signed out", async () => {
    const create = vi.fn(async () => {
      throw new ApiError(401, "signed_out", "Sign in again");
    });
    const report = await saveRows(rows, "owned", create);
    expect(create).toHaveBeenCalledTimes(1);
    expect(report.untried).toBe(1);
  });
});

describe("a Shelfmark export read back", () => {
  it("is recognised and every row is a duplicate of the library it came from", () => {
    const books = [
      book({ title: "Solenoid", authors: ["Mircea Cărtărescu"], isbn13: SOLENOID, publishedYear: 2015, shelf: "Hall · A2", tags: ["ro", "novel"], status: "read", rating: 5, priceMinor: 4990, language: "ro", signed: true, notes: "=1+1" }),
      book({ title: "Dune", authors: ["Frank Herbert", "Brian Herbert"], isbn13: DUNE, subjects: ["Fiction, general"], format: "paperback" }),
    ];
    const columns = columnsIn("owned", COLUMNS);
    const csv = toCsv(columns.map((c) => c.label), books.map((b) => columns.map((c) => cellOf(c, b, false))));
    const { format, rows } = load(csv);
    expect(format?.id).toBe("shelfmark");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      title: "Solenoid",
      authors: ["Mircea Cărtărescu"],
      isbn13: SOLENOID,
      details: { publishedYear: 2015, shelf: "Hall · A2", tags: ["ro", "novel"], status: "read", rating: 5, priceMinor: 4990, language: "ro", signed: true, notes: "=1+1" },
    });
    expect(rows[1]).toMatchObject({ authors: ["Frank Herbert", "Brian Herbert"], details: { subjects: ["Fiction, general"], format: "paperback" } });
    expect(flagRows(rows, books, "owned")).toEqual([["in-library"], ["in-library"]]);
  });
});

describe("a LibraryThing export", () => {
  it("flips Last, First and strips the ISBN's brackets", () => {
    const csv = `Book Id,Title,Primary Author,Secondary Author,ISBN,Date,Tags\n9,Dune,"Herbert, Frank","Herbert, Brian",[0441172717],2005,"sf, classic"`;
    const { format, rows } = load(csv);
    expect(format?.id).toBe("librarything");
    expect(rows[0]).toMatchObject({ authors: ["Frank Herbert", "Brian Herbert"], isbn13: DUNE, details: { publishedYear: 2005, tags: ["sf", "classic"] } });
  });
});

describe("any other file", () => {
  it("gets a guess and, with no title or ISBN column, no way forward", () => {
    const { format, mapping } = guessMapping(["Name", "Writer", "Whatever"]);
    expect(format).toBeNull();
    expect(mapping).toEqual(["title", "authors", null]);
    expect(isUsable(guessMapping(["Foo", "Bar"]).mapping)).toBe(false);
  });
});

describe("cell values", () => {
  it("reads prices, dates, ratings and statuses", () => {
    expect(parsePrice("49.90")).toBe(4990);
    expect(parsePrice("49,9 RON")).toBe(4990);
    expect(parsePrice("1.234,50")).toBe(123450);
    expect(parsePrice("1,234")).toBe(123400);
    expect(parsePrice("free")).toBeUndefined();
    expect(parseDate("2020/01/05")).toBe("2020-01-05");
    expect(parseDate("2020-02-31")).toBeUndefined();
    expect(parseRating("0")).toBeUndefined();
    expect(parseRating("4.5")).toBe(5);
    expect(parseStatus("currently-reading")).toBe("reading");
    expect(parseStatus("to-read")).toBe("unread");
    expect(parseStatus("who knows")).toBeUndefined();
  });
});
