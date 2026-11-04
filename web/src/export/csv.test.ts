import { describe, expect, it } from "vitest";
import { COLUMNS, columnById } from "../library/columns";
import { book } from "../library/test-books";
import { BOM, csvCell, toCsv } from "./csv";
import { cellOf, libraryTable } from "./fields";

describe("toCsv", () => {
  it("starts with the BOM, uses CRLF and keeps diacritics", () => {
    const csv = toCsv(["Title"], [["Cărtărescu: ș, ț, ă, â, î"]]);
    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv).toBe(`${BOM}Title\r\n"Cărtărescu: ș, ț, ă, â, î"\r\n`);
  });

  it("quotes commas, quotes and line breaks", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("one\ntwo")).toBe('"one\ntwo"');
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell(null)).toBe("");
  });

  it.each(["=", "+", "-", "@", "\t", "\r"])("guards a cell starting with %j", (start) => {
    const out = csvCell(`${start}HYPERLINK("x")`);
    expect(out.replace(/^"/, "").startsWith("'")).toBe(true);
  });

  it("leaves a negative number and an inner dash alone", () => {
    expect(csvCell(-5)).toBe("-5");
    expect(csvCell("a-b")).toBe("a-b");
  });
});

describe("fields", () => {
  const b = book({
    title: "=SUM(1)",
    authors: ["Mircea Cărtărescu", "Ioana Pârvulescu"],
    tags: ["a", "b"],
    isbn13: "9789735025106",
    priceMinor: 5990,
    signed: true,
    createdAt: "2026-03-01T10:00:00.000Z",
  });

  it("joins authors and tags with '; ', keeps the ISBN text and the price in lei", () => {
    expect(cellOf(columnById("authors"), b, false)).toBe("Mircea Cărtărescu; Ioana Pârvulescu");
    expect(cellOf(columnById("tags"), b, false)).toBe("a; b");
    expect(cellOf(columnById("isbn"), b, false)).toBe("9789735025106");
    expect(cellOf(columnById("price"), b, false)).toBe(59.9);
    expect(cellOf(columnById("signed"), b, false)).toBe(true);
  });

  it("writes every book of both collections, every field, the collection first", () => {
    const wanted = book({ title: "Wanted", collection: "wishlist" });
    const table = libraryTable([b, wanted], false);
    expect(table.header).toEqual(["Collection", ...COLUMNS.map((column) => column.label)]);
    expect(table.rows.map((row) => [row[0], row[1]])).toEqual([
      ["Owned", "=SUM(1)"],
      ["Wishlist", "Wanted"],
    ]);
    expect(table.dateFormats).toHaveLength(table.header.length);
    expect(toCsv(table.header, table.rows)).toContain("'=SUM(1)");
  });
});
