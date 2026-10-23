import { describe, expect, it } from "vitest";
import { toCsv } from "../export/csv";
import { decodeCsv, detectDelimiter, parseCsv, unguard } from "./csv";

describe("decodeCsv", () => {
  it("reads UTF-8 and drops the BOM", () => {
    const bytes = new TextEncoder().encode("﻿Title\nCărtărescu ș ț");
    expect(decodeCsv(bytes)).toEqual({ text: "Title\nCărtărescu ș ț", encoding: "UTF-8" });
  });

  it("falls back to windows-1250 when the bytes are not UTF-8, and writes ș and ț with the comma", () => {
    // ă â î in windows-1250, then ş (cedilla, 0xBA) and ţ (0xFE).
    const bytes = Uint8Array.from([0xe3, 0xe2, 0xee, 0x20, 0xba, 0x20, 0xfe]);
    expect(decodeCsv(bytes)).toEqual({ text: "ăâî ș ț", encoding: "windows-1250" });
  });

  it("reads UTF-16 from its byte order mark", () => {
    const bytes = Uint8Array.from([0xff, 0xfe, 0x41, 0x00, 0x0a, 0x00, 0x42, 0x00]);
    expect(decodeCsv(bytes)).toEqual({ text: "A\nB", encoding: "UTF-16" });
  });
});

describe("parseCsv", () => {
  it("splits cells and rows, with any line ending", () => {
    expect(parseCsv("a,b\r\nc,d\ne,f\rg,h")).toEqual([["a", "b"], ["c", "d"], ["e", "f"], ["g", "h"]]);
  });

  it("keeps commas, line breaks and doubled quotes inside quotes", () => {
    expect(parseCsv('a,"b, c","line\nbreak","say ""hi"""\r\n')).toEqual([["a", "b, c", "line\nbreak", 'say "hi"']]);
  });

  it("keeps empty cells and drops blank lines", () => {
    expect(parseCsv("a,,c\n\n,,\nx,y,z\n")).toEqual([["a", "", "c"], ["", "", ""], ["x", "y", "z"]]);
  });

  it("reads a quoted empty cell on its own line", () => {
    expect(parseCsv('""\nx')).toEqual([[""], ["x"]]);
  });

  it("takes a semicolon or a tab when that is what the first line uses", () => {
    expect(detectDelimiter("a;b;c\n1,5;2;3")).toBe(";");
    expect(detectDelimiter("a\tb\tc")).toBe("\t");
    expect(detectDelimiter('"a;b",c,d')).toBe(",");
    expect(parseCsv("a;b\n1,5;2")).toEqual([["a", "b"], ["1,5", "2"]]);
  });

  it("reads what the export writes", () => {
    const table = [["Title", "Notes"], ["Cărți, \"mari\"", "line\r\nbreak"], ["=SUM(1)", ""]];
    const parsed = parseCsv(toCsv(table[0] ?? [], table.slice(1)));
    expect(parsed.map((row) => row.map(unguard))).toEqual([["Title", "Notes"], ["Cărți, \"mari\"", "line\r\nbreak"], ["=SUM(1)", ""]]);
  });
});
