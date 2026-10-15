import { describe, expect, it } from "vitest";
import { DEFAULT_SORTING, describeSort, directionLabel, sortBooks, toggleSort } from "./sort";
import { columnById } from "./columns";
import { book } from "./test-books";

const titles = (books: { title: string }[]) => books.map((b) => b.title);

describe("sortBooks", () => {
  it("sorts text the Romanian way: ă after a, ț after t", () => {
    const books = ["Zebra", "Țara", "Tata", "Ana", "Ăla", "Bun", "Ăsta"].map((title) => book({ title }));
    expect(titles(sortBooks(books, [{ id: "book", desc: false }]))).toEqual([
      "Ana",
      "Ăla",
      "Ăsta",
      "Bun",
      "Tata",
      "Țara",
      "Zebra",
    ]);
  });

  it("ignores case, and compares numbers in text as numbers", () => {
    const books = ["Vol. 10", "vol. 2", "Vol. 1"].map((title) => book({ title }));
    expect(titles(sortBooks(books, [{ id: "book", desc: false }]))).toEqual(["Vol. 1", "vol. 2", "Vol. 10"]);
  });

  it("sorts authors by their sort name, not the displayed one", () => {
    const books = [
      book({ title: "Solenoid", authors: ["Mircea Cărtărescu"], authorSort: "Cărtărescu, Mircea" }),
      book({ title: "Mireasa", authors: ["Ana Blandiana"], authorSort: "Blandiana, Ana" }),
      book({ title: "Dune", authors: ["Frank Herbert"], authorSort: "Herbert, Frank" }),
    ];
    expect(titles(sortBooks(books, [{ id: "authors", desc: false }]))).toEqual(["Mireasa", "Solenoid", "Dune"]);
  });

  it("sorts by several keys, each in its own direction", () => {
    const books = [
      book({ title: "C", shelf: "Study · B1", publishedYear: 2001 }),
      book({ title: "A", shelf: "Bedroom", publishedYear: 1999 }),
      book({ title: "B", shelf: "Study · B1", publishedYear: 2015 }),
      book({ title: "D", shelf: "Bedroom", publishedYear: 2020 }),
    ];
    expect(
      titles(
        sortBooks(books, [
          { id: "shelf", desc: false },
          { id: "year", desc: true },
        ]),
      ),
    ).toEqual(["D", "A", "B", "C"]);
  });

  it("puts empty values last, whichever way the column runs", () => {
    const books = [book({ title: "none" }), book({ title: "old", publishedYear: 1990 }), book({ title: "new", publishedYear: 2020 })];
    expect(titles(sortBooks(books, [{ id: "year", desc: false }]))).toEqual(["old", "new", "none"]);
    expect(titles(sortBooks(books, [{ id: "year", desc: true }]))).toEqual(["new", "old", "none"]);
  });

  it("orders statuses as a reader moves through them, not by the alphabet", () => {
    const books = (["read", "abandoned", "unread", "reading"] as const).map((status) => book({ title: status, status }));
    expect(titles(sortBooks(books, [{ id: "status", desc: false }]))).toEqual(["unread", "reading", "read", "abandoned"]);
  });

  it("is newest first by default, and on ties", () => {
    const older = book({ title: "older", createdAt: "2026-01-01T00:00:00.000Z", shelf: "Bedroom" });
    const newer = book({ title: "newer", createdAt: "2026-02-01T00:00:00.000Z", shelf: "Bedroom" });
    expect(titles(sortBooks([older, newer], DEFAULT_SORTING))).toEqual(["newer", "older"]);
    expect(titles(sortBooks([older, newer], []))).toEqual(["newer", "older"]);
    expect(titles(sortBooks([older, newer], [{ id: "shelf", desc: false }]))).toEqual(["newer", "older"]);
  });

  it("treats the comma and cedilla spellings as one, leaving the tie to the date", () => {
    const comma = book({ title: "Țara", createdAt: "2026-01-01T00:00:00.000Z" });
    const cedilla = book({ title: "Ţara", createdAt: "2026-03-01T00:00:00.000Z" });
    expect(titles(sortBooks([comma, cedilla], [{ id: "book", desc: false }]))).toEqual(["Ţara", "Țara"]);
  });

  it("does not change the array it is given", () => {
    const books = [book({ title: "B" }), book({ title: "A" })];
    sortBooks(books, [{ id: "book", desc: false }]);
    expect(titles(books)).toEqual(["B", "A"]);
  });
});

describe("toggleSort", () => {
  it("sorts by a clicked column, text A to Z and dates newest first", () => {
    expect(toggleSort(DEFAULT_SORTING, "book")).toEqual([{ id: "book", desc: false }]);
    expect(toggleSort([{ id: "book", desc: false }], "year")).toEqual([{ id: "year", desc: true }]);
  });

  it("flips the column that alone leads", () => {
    expect(toggleSort([{ id: "book", desc: false }], "book")).toEqual([{ id: "book", desc: true }]);
    expect(toggleSort([{ id: "book", desc: true }], "book")).toEqual([{ id: "book", desc: false }]);
  });

  it("adds a key on shift-click, flips it, then takes it off", () => {
    const one = toggleSort(DEFAULT_SORTING, "shelf", true);
    expect(one).toEqual([
      { id: "added", desc: true },
      { id: "shelf", desc: false },
    ]);
    const two = toggleSort(one, "shelf", true);
    expect(two).toEqual([
      { id: "added", desc: true },
      { id: "shelf", desc: true },
    ]);
    expect(toggleSort(two, "shelf", true)).toEqual([{ id: "added", desc: true }]);
  });

  it("never leaves the sort empty", () => {
    expect(toggleSort([{ id: "added", desc: false }], "added", true)).toEqual([{ id: "added", desc: true }]);
  });

  it("makes a clicked column the only key", () => {
    expect(
      toggleSort(
        [
          { id: "shelf", desc: false },
          { id: "book", desc: true },
        ],
        "book",
      ),
    ).toEqual([{ id: "book", desc: true }]);
  });
});

describe("describeSort", () => {
  it("words the caption's order", () => {
    expect(describeSort(DEFAULT_SORTING)).toBe("newest first");
    expect(describeSort([{ id: "added", desc: false }])).toBe("oldest first");
    expect(describeSort([{ id: "book", desc: false }])).toBe("by title");
    expect(describeSort([{ id: "book", desc: true }])).toBe("by title, Z to A");
    expect(describeSort([{ id: "year", desc: true }])).toBe("by year, newest first");
    expect(describeSort([{ id: "isbn", desc: false }])).toBe("by ISBN");
    expect(
      describeSort([
        { id: "shelf", desc: false },
        { id: "book", desc: false },
      ]),
    ).toBe("by shelf, then title");
  });

  it("labels directions for controls", () => {
    expect(directionLabel(columnById("book"), false)).toBe("A to Z");
    expect(directionLabel(columnById("added"), true)).toBe("Newest first");
  });
});
