import { describe, expect, it } from "vitest";
import { bookCreateSchema, bookPatchSchema, bookSchema, deriveAuthorSort, type Book } from "./book.js";

const book: Book = {
  id: 1,
  isbn13: "9789734647262",
  barcode: null,
  title: "Solenoid",
  subtitle: null,
  authors: ["Mircea Cărtărescu"],
  authorSort: "Cărtărescu, Mircea",
  publisher: "Humanitas",
  publishedYear: 2015,
  pages: 837,
  language: "ro",
  series: null,
  seriesNumber: null,
  description: null,
  subjects: [],
  collection: "owned",
  format: "hardcover",
  condition: "good",
  shelf: "Living room · A2",
  signed: false,
  status: "read",
  rating: 5,
  notes: null,
  acquiredOn: "2016-03-01",
  acquiredFrom: "Cărturești",
  priceMinor: 5990,
  currency: "RON",
  metadataSource: "manual",
  tags: ["Romanian"],
  hasCover: false,
  coverUpdatedAt: null,
  createdAt: "2026-10-14T09:00:00.000Z",
  updatedAt: "2026-10-14T09:00:00.000Z",
};

function issue(result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  expect(result.success).toBe(false);
  const first = result.error?.issues[0];
  return first && `${first.path.join(".")}: ${first.message}`;
}

describe("bookSchema", () => {
  it("accepts a whole book", () => {
    expect(bookSchema.parse(book)).toEqual(book);
  });
});

describe("bookCreateSchema", () => {
  it("needs only a title, and adds no defaults of its own", () => {
    expect(bookCreateSchema.parse({ title: "Solenoid" })).toEqual({ title: "Solenoid" });
  });

  it("refuses a missing or blank title", () => {
    expect(issue(bookCreateSchema.safeParse({}))).toBe("title: a book needs a title");
    expect(issue(bookCreateSchema.safeParse({ title: "   " }))).toBe("title: a book needs a title");
  });

  it("checks the ISBN-13's shape, not its check digit", () => {
    expect(bookCreateSchema.parse({ title: "t", isbn13: "9786063205583" }).isbn13).toBe("9786063205583");
    expect(bookCreateSchema.parse({ title: "t", isbn13: "9780000000000" }).isbn13).toBe("9780000000000");
    for (const isbn13 of ["978606320558", "97860632055830", "9776063205583", "978-606-320-558-3", "0306406152"]) {
      expect(issue(bookCreateSchema.safeParse({ title: "t", isbn13 }))).toBe(
        "isbn13: must be 13 digits starting with 978 or 979",
      );
    }
  });

  it("trims text, turns a blank field into null and drops blank list entries", () => {
    expect(
      bookCreateSchema.parse({
        title: "  Solenoid ",
        subtitle: "   ",
        shelf: " Bedroom ",
        authors: ["Mircea Cărtărescu ", "", "  "],
        tags: ["", " Romanian "],
      }),
    ).toEqual({ title: "Solenoid", subtitle: null, shelf: "Bedroom", authors: ["Mircea Cărtărescu"], tags: ["Romanian"] });
  });

  it("normalises the language and the currency codes", () => {
    expect(bookCreateSchema.parse({ title: "t", language: "RO", currency: "eur" })).toMatchObject({
      language: "ro",
      currency: "EUR",
    });
    expect(issue(bookCreateSchema.safeParse({ title: "t", language: "ron" }))).toMatch(/^language: /);
    expect(issue(bookCreateSchema.safeParse({ title: "t", currency: "euro" }))).toMatch(/^currency: /);
  });

  it("checks enums, the rating, the date and the numbers", () => {
    expect(issue(bookCreateSchema.safeParse({ title: "t", status: "finished" }))).toMatch(/^status: /);
    expect(issue(bookCreateSchema.safeParse({ title: "t", collection: "loaned" }))).toMatch(/^collection: /);
    expect(issue(bookCreateSchema.safeParse({ title: "t", rating: 6 }))).toBe("rating: must be 1 to 5");
    expect(issue(bookCreateSchema.safeParse({ title: "t", rating: 2.5 }))).toMatch(/^rating: /);
    expect(issue(bookCreateSchema.safeParse({ title: "t", acquiredOn: "2026-02-30" }))).toBe(
      "acquiredOn: must be a date as YYYY-MM-DD",
    );
    expect(issue(bookCreateSchema.safeParse({ title: "t", priceMinor: -1 }))).toMatch(/^priceMinor: /);
    expect(issue(bookCreateSchema.safeParse({ title: "t", pages: 0 }))).toMatch(/^pages: /);
  });

  it("refuses an unknown key", () => {
    expect(issue(bookCreateSchema.safeParse({ title: "t", authorsort: "x" }))).toMatch(/Unrecognized key/);
  });

  it("accepts null for any field but the title", () => {
    expect(bookCreateSchema.parse({ title: "t", isbn13: null, status: null, tags: null })).toEqual({
      title: "t",
      isbn13: null,
      status: null,
      tags: null,
    });
  });
});

describe("bookPatchSchema", () => {
  it("accepts an empty patch", () => {
    expect(bookPatchSchema.parse({})).toEqual({});
  });

  it("lets null clear every field but the title", () => {
    expect(bookPatchSchema.parse({ shelf: null, rating: null, tags: null, signed: null })).toEqual({
      shelf: null,
      rating: null,
      tags: null,
      signed: null,
    });
    expect(issue(bookPatchSchema.safeParse({ title: null }))).toBe("title: a book needs a title");
  });

  it("validates what it is given", () => {
    expect(issue(bookPatchSchema.safeParse({ rating: 0 }))).toBe("rating: must be 1 to 5");
    expect(issue(bookPatchSchema.safeParse({ hasCover: true }))).toMatch(/Unrecognized key/);
    expect(issue(bookPatchSchema.safeParse({ coverUpdatedAt: null }))).toMatch(/Unrecognized key/);
    expect(issue(bookCreateSchema.safeParse({ title: "t", coverUpdatedAt: "2026-10-14T09:00:00.000Z" }))).toMatch(
      /Unrecognized key/,
    );
  });
});

describe("deriveAuthorSort", () => {
  it("puts the last name first", () => {
    expect(deriveAuthorSort(["Mircea Cărtărescu"])).toBe("Cărtărescu, Mircea");
    expect(deriveAuthorSort(["J. R. R. Tolkien"])).toBe("Tolkien, J. R. R.");
    expect(deriveAuthorSort(["  Ana   Blandiana "])).toBe("Blandiana, Ana");
  });

  it("uses the first author only", () => {
    expect(deriveAuthorSort(["Mircea Eliade", "Ioan Petru Culianu"])).toBe("Eliade, Mircea");
  });

  it("keeps a one-word name and a name already written last-first", () => {
    expect(deriveAuthorSort(["Homer"])).toBe("Homer");
    expect(deriveAuthorSort(["García Márquez, Gabriel"])).toBe("García Márquez, Gabriel");
  });

  it("is null without authors", () => {
    expect(deriveAuthorSort([])).toBeNull();
    expect(deriveAuthorSort([" "])).toBeNull();
  });
});
