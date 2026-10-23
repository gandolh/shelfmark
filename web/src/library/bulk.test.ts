import { describe, expect, it } from "vitest";
import { bookCount, describeResult, parseTags, shelfChoices, tagChoices } from "./bulk";
import { book } from "./test-books";

describe("the bulk bar's choices", () => {
  it("offers the shelves owned books sit on, by name, with how many books each", () => {
    const books = [
      book({ shelf: "Living room · A1" }),
      book({ shelf: "Bedroom · B2" }),
      book({ shelf: "Bedroom · B10" }),
      book({ shelf: "Living room · A1" }),
      book({ shelf: "Attic", collection: "wishlist" }),
      book({ shelf: null }),
    ];
    expect(shelfChoices(books)).toEqual([
      { name: "Bedroom · B2", count: 1 },
      { name: "Bedroom · B10", count: 1 },
      { name: "Living room · A1", count: 2 },
    ]);
  });

  it("offers the tags the selected books carry, with how many of them have each", () => {
    const selected = [book({ tags: ["Signed", "Poetry"] }), book({ tags: ["Poetry"] }), book()];
    expect(tagChoices(selected)).toEqual([
      { name: "Poetry", count: 2 },
      { name: "Signed", count: 1 },
    ]);
  });

  it("reads the tags in a typed line, each once whatever its case", () => {
    expect(parseTags(" signed,  first   edition ; Signed,,")).toEqual(["signed", "first edition"]);
    expect(parseTags(" , ")).toEqual([]);
  });
});

describe("describeResult", () => {
  const moved = [book(), book(), book()];

  it("says where the books went, and how many wishlist books it left out", () => {
    expect(describeResult({ kind: "shelf", shelf: "Bedroom · B1" }, { books: moved, deleted: [], skipped: [] })).toBe(
      "Moved 3 books to Bedroom · B1.",
    );
    expect(describeResult({ kind: "shelf", shelf: "Bedroom · B1" }, { books: moved, deleted: [], skipped: [9, 10] })).toBe(
      "Moved 3 books to Bedroom · B1. Left out 2 wishlist books: only owned books sit on shelves.",
    );
    expect(describeResult({ kind: "shelf", shelf: null }, { books: moved.slice(0, 1), deleted: [], skipped: [] })).toBe(
      "Took 1 book off its shelf.",
    );
  });

  it("names the status and the tags", () => {
    expect(describeResult({ kind: "status", status: "read" }, { books: moved, deleted: [], skipped: [] })).toBe("Marked 3 books Read.");
    expect(describeResult({ kind: "addTags", tags: ["signed"] }, { books: moved, deleted: [], skipped: [] })).toBe(
      "Added “signed” to 3 books.",
    );
    expect(describeResult({ kind: "removeTags", tags: ["a", "b"] }, { books: moved, deleted: [], skipped: [] })).toBe(
      "Took 2 tags off 3 books.",
    );
    expect(describeResult({ kind: "delete" }, { books: [], deleted: [1, 2], skipped: [] })).toBe("Deleted 2 books.");
  });

  it("counts in words", () => {
    expect(bookCount(1)).toBe("1 book");
    expect(bookCount(1204)).toBe("1,204 books");
  });
});
