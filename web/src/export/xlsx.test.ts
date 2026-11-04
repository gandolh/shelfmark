import { readSheet } from "read-excel-file/node";
import { describe, expect, it } from "vitest";
import { COLUMNS } from "../library/columns";
import { book } from "../library/test-books";
import { libraryTable } from "./fields";
import { buildXlsx, columnWidths } from "./xlsx";

const books = [
  book({
    title: "Orbitor",
    authors: ["Mircea Cărtărescu", "X"],
    isbn13: "9789735025106",
    priceMinor: 5990,
    signed: true,
    acquiredOn: "2024-03-01",
    createdAt: "2026-03-01T10:00:00.000Z",
  }),
  book({ title: "Fără preț" }),
];

describe("buildXlsx", () => {
  it("parses back with typed cells", async () => {
    const table = libraryTable(books, true);
    const blob = await buildXlsx(table);
    const rows = await readSheet(Buffer.from(await blob.arrayBuffer()));

    const header = rows[0] as string[];
    expect(header).toEqual(["Collection", ...COLUMNS.map((column) => column.label)]);
    const at = (name: string) => header.indexOf(name);
    const first = rows[1] as unknown[];
    expect(first[at("Collection")]).toBe("Owned");
    expect(first[at("Title")]).toBe("Orbitor");
    expect(first[at("Author")]).toBe("Mircea Cărtărescu; X");
    expect(first[at("ISBN")]).toBe("9789735025106");
    expect(first[at("Price")]).toBe(59.9);
    expect(first[at("Signed")]).toBe(true);
    const acquired = first[at("Acquired")];
    expect(acquired).toBeInstanceOf(Date);
    expect((acquired as Date).toISOString().slice(0, 10)).toBe("2024-03-01");
    expect(first[at("Added")]).toBeInstanceOf(Date);
    expect(rows).toHaveLength(3);
  });

  it("sizes columns from the content", () => {
    const widths = columnWidths(libraryTable(books, true));
    expect(widths).toHaveLength(COLUMNS.length + 1);
    expect(Math.max(...widths)).toBeLessThanOrEqual(60);
  });
});
