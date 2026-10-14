import { describe, expect, it } from "vitest";
import { classifyBarcode, clean, isValid10, isValid13, parseIsbn, to10, to13 } from "./isbn.js";

// Romanian 606/973 prefixes (the lookup hit rate is lowest for these) plus a 979.
const RO = ["9786063205583", "9789731000015", "9786060920014"];

describe("clean", () => {
  it("strips spaces, hyphens and dots and uppercases a trailing x", () => {
    expect(clean(" 978-606 3205.583 ")).toBe("9786063205583");
    expect(clean("0-8044-2957-x")).toBe("080442957X");
  });
});

describe("isValid13", () => {
  it.each(RO)("accepts %s", (isbn) => expect(isValid13(isbn)).toBe(true));
  it("rejects a wrong check digit, wrong length and non-digits", () => {
    expect(isValid13("9786063205584")).toBe(false);
    expect(isValid13("978606320558")).toBe(false);
    expect(isValid13("978606320558X")).toBe(false);
  });
});

describe("isValid10", () => {
  it("accepts digits and a trailing X", () => {
    expect(isValid10("0306406152")).toBe(true);
    expect(isValid10("080442957X")).toBe(true);
  });
  it("rejects bad check digits and X anywhere else", () => {
    expect(isValid10("0306406153")).toBe(false);
    expect(isValid10("03064X6152")).toBe(false);
    expect(isValid10("030640615")).toBe(false);
  });
});

describe("to13 / to10", () => {
  it("converts 10 to 13", () => {
    expect(to13("0306406152")).toBe("9780306406157");
    expect(to13("080442957X")).toBe("9780804429573");
  });
  it("round-trips 10 -> 13 -> 10, including X", () => {
    for (const isbn10 of ["0306406152", "080442957X"]) {
      expect(to10(to13(isbn10))).toBe(isbn10);
    }
  });
  it("round-trips a 978 Romanian ISBN-13", () => {
    expect(to13(to10("9786063205583")!)).toBe("9786063205583");
  });
  it("returns null for 979", () => {
    expect(to10("9791000000008")).toBeNull();
  });
});

describe("parseIsbn", () => {
  it.each(RO)("accepts %s", (isbn) => {
    expect(parseIsbn(isbn)).toEqual({ ok: true, isbn13: isbn });
  });
  it("accepts 979", () => {
    expect(parseIsbn("979-10-00000-00-8")).toEqual({ ok: true, isbn13: "9791000000008" });
  });
  it("handles hyphenated and spaced input", () => {
    expect(parseIsbn("978-606-32-0558-3")).toEqual({ ok: true, isbn13: "9786063205583" });
    expect(parseIsbn("978 606 32 0558 3")).toEqual({ ok: true, isbn13: "9786063205583" });
  });
  it("converts ISBN-10, with X and lowercase x", () => {
    expect(parseIsbn("0-306-40615-2")).toEqual({ ok: true, isbn13: "9780306406157" });
    expect(parseIsbn("080442957x")).toEqual({ ok: true, isbn13: "9780804429573" });
  });
  it("reports length", () => {
    expect(parseIsbn("")).toEqual({ ok: false, reason: "length" });
    expect(parseIsbn("97860632055")).toEqual({ ok: false, reason: "length" });
  });
  it("reports checksum", () => {
    expect(parseIsbn("9786063205584")).toEqual({ ok: false, reason: "checksum" });
    expect(parseIsbn("0306406153")).toEqual({ ok: false, reason: "checksum" });
  });
  it("reports not_isbn for non-978/979 EANs and stray characters", () => {
    expect(parseIsbn("2000000000008")).toEqual({ ok: false, reason: "not_isbn" });
    expect(parseIsbn("97860632055AB")).toEqual({ ok: false, reason: "not_isbn" });
    expect(parseIsbn("03064X6152")).toEqual({ ok: false, reason: "not_isbn" });
  });
});

describe("classifyBarcode", () => {
  it("finds an ISBN in an EAN-13, with or without a format", () => {
    const want = { kind: "isbn", isbn13: "9786063205583" };
    expect(classifyBarcode("9786063205583")).toEqual(want);
    expect(classifyBarcode("9786063205583", "ean_13")).toEqual(want);
  });
  it("ignores 2- and 5-digit add-ons", () => {
    expect(classifyBarcode("51299")).toEqual({ kind: "addon" });
    expect(classifyBarcode("12")).toEqual({ kind: "addon" });
  });
  it("does not treat a short Code-128 label as an add-on", () => {
    expect(classifyBarcode("51299", "code_128")).toEqual({ kind: "other", code: "51299" });
  });
  it("passes a store sticker through as other", () => {
    expect(classifyBarcode("2000000000008", "ean_13")).toEqual({
      kind: "other",
      code: "2000000000008",
    });
  });
  it("passes a UPC-A, EAN-8 and Code-128 through as other", () => {
    expect(classifyBarcode("036000291452", "upc_a")).toEqual({ kind: "other", code: "036000291452" });
    expect(classifyBarcode("036000291452")).toEqual({ kind: "other", code: "036000291452" });
    expect(classifyBarcode("96385074", "ean_8")).toEqual({ kind: "other", code: "96385074" });
    expect(classifyBarcode("ABC-123", "code_128")).toEqual({ kind: "other", code: "ABC-123" });
  });
  it("treats an ISBN-shaped code with a bad check digit as other", () => {
    expect(classifyBarcode("9786063205584")).toEqual({ kind: "other", code: "9786063205584" });
  });
  it("does not read a 13-digit code as an ISBN when the format says otherwise", () => {
    expect(classifyBarcode("9786063205583", "code_128")).toEqual({
      kind: "other",
      code: "9786063205583",
    });
  });
});
