import type { Book } from "@shelfmark/shared";
import { describe, expect, it } from "vitest";
import { answerFor, copyOf, type LibraryCopy } from "./library";

function book(extra: Partial<Book>): Book {
  return {
    id: 1,
    isbn13: null,
    title: "Untitled",
    shelf: null,
    collection: "owned",
    ...extra,
  } as Book;
}

const NOW = new Date("2026-10-23T08:00:00.000Z");

describe("copyOf", () => {
  it("keeps the four fields of every book with an ISBN, and when it was made", () => {
    const copy = copyOf(
      [
        book({ id: 1, isbn13: "9780547928227", title: "The Hobbit", shelf: "Living room · A2" }),
        book({ id: 2, title: "No ISBN" }),
        book({ id: 3, isbn13: "9786063205583", title: "Wanted", collection: "wishlist" }),
      ],
      NOW,
    );
    expect(copy.savedAt).toBe("2026-10-23T08:00:00.000Z");
    expect(copy.books).toEqual([
      { isbn13: "9780547928227", title: "The Hobbit", shelf: "Living room · A2", collection: "owned" },
      { isbn13: "9786063205583", title: "Wanted", shelf: null, collection: "wishlist" },
    ]);
  });
});

describe("answerFor", () => {
  const copy: LibraryCopy = {
    savedAt: "2026-10-22T10:00:00.000Z",
    books: [
      { isbn13: "9780547928227", title: "The Hobbit", shelf: "Living room · A2", collection: "owned" },
      { isbn13: "9780547928227", title: "The Hobbit", shelf: "Bedroom", collection: "owned" },
      { isbn13: "9786063205583", title: "Wanted", shelf: null, collection: "wishlist" },
      { isbn13: "9781111111111", title: "Both", shelf: null, collection: "wishlist" },
      { isbn13: "9781111111111", title: "Both", shelf: "A1", collection: "owned" },
    ],
  };

  it("says owned with every copy's shelf", () => {
    const answer = answerFor(copy, "9780547928227");
    expect(answer.kind).toBe("owned");
    expect(answer.kind === "owned" && answer.copies.map((c) => c.shelf)).toEqual(["Living room · A2", "Bedroom"]);
  });

  it("says wishlisted when only the wishlist has it", () => {
    expect(answerFor(copy, "9786063205583")).toMatchObject({ kind: "wishlisted" });
  });

  it("lets owned win over wishlisted", () => {
    expect(answerFor(copy, "9781111111111")).toMatchObject({ kind: "owned" });
  });

  it("says absent, with the copy's date, for an ISBN it doesn't know", () => {
    expect(answerFor(copy, "9782222222222")).toEqual({ kind: "absent", savedAt: "2026-10-22T10:00:00.000Z" });
  });
});
