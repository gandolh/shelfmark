import { describe, expect, it } from "vitest";
import { compactIsbn, compileSearch, fold, searchBooks } from "./search";
import { book } from "./test-books";

describe("fold", () => {
  it("drops case and diacritics", () => {
    expect(fold("Cărtărescu")).toBe("cartarescu");
    expect(fold("ÎNTÂMPLARE")).toBe("intamplare");
  });

  it("folds the comma and the cedilla spellings alike", () => {
    // ș U+0219 (comma below), ş U+015F (cedilla), ț U+021B, ţ U+0163
    expect(fold("șşțţ")).toBe("sstt");
    expect(fold("Inocenții")).toBe(fold("Inocenţii"));
  });
});

describe("compactIsbn", () => {
  it("drops hyphens and spaces", () => {
    expect(compactIsbn("978-606-320 558-3")).toBe("9786063205583");
  });
});

describe("compileSearch", () => {
  const solenoid = book({
    title: "Solenoid",
    authors: ["Mircea Cărtărescu"],
    publisher: "Humanitas",
    isbn13: "9789735049225",
  });
  const inocentii = book({ title: "Inocenții", subtitle: "roman", authors: ["Ioana Pârvulescu"], series: "Seria de autor" });
  const road = book({ title: "The Road", authors: ["Cormac McCarthy"], tags: ["Gift"], notes: "Bought in Iași" });
  const books = [solenoid, inocentii, road];
  const find = (query: string) => searchBooks(books, query).map((b) => b.title);

  it("is null for a blank query", () => {
    expect(compileSearch("   ")).toBeNull();
    expect(find("")).toEqual(["Solenoid", "Inocenții", "The Road"]);
  });

  it("finds Cărtărescu without the diacritics, in any case", () => {
    expect(find("cartarescu")).toEqual(["Solenoid"]);
    expect(find("CĂRTĂRESCU")).toEqual(["Solenoid"]);
  });

  it("finds a comma spelling from a cedilla one and back", () => {
    expect(find("Inocenţii")).toEqual(["Inocenții"]);
    expect(find("iasi")).toEqual(["The Road"]);
  });

  it("wants every word, anywhere in the book, in any order", () => {
    expect(find("road mccarthy")).toEqual(["The Road"]);
    expect(find("mccarthy road")).toEqual(["The Road"]);
    expect(find("road humanitas")).toEqual([]);
  });

  it("looks at title, subtitle, authors, publisher, series, ISBN, tags and notes", () => {
    expect(find("roman")).toEqual(["Inocenții"]);
    expect(find("humanitas")).toEqual(["Solenoid"]);
    expect(find("seria")).toEqual(["Inocenții"]);
    expect(find("gift")).toEqual(["The Road"]);
    expect(find("bought")).toEqual(["The Road"]);
    expect(find("9789735049225")).toEqual(["Solenoid"]);
  });

  it("matches an ISBN with or without hyphens and spaces", () => {
    expect(find("978-973-504-922-5")).toEqual(["Solenoid"]);
    expect(find("978 973 504")).toEqual(["Solenoid"]);
    expect(find("504-922")).toEqual(["Solenoid"]);
  });
});
