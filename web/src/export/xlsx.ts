import type { Cell } from "write-excel-file/browser";
import type { ExportTable } from "./fields";

/** The sheet's column width, in characters, from the longest cell (header included), within sane bounds. */
export function columnWidths(table: ExportTable): number[] {
  return table.header.map((title, i) => {
    let longest = title.length;
    for (const row of table.rows) {
      const cell = row[i];
      const length = cell === null || cell === undefined ? 0 : cell instanceof Date ? 16 : String(cell).length;
      if (length > longest) longest = length;
    }
    return Math.min(60, Math.max(8, longest + 2));
  });
}

/** The workbook as a file's bytes. The library (and its zip code) loads only when an export is asked for. */
export async function buildXlsx(table: ExportTable): Promise<Blob> {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const header: Cell[] = table.header.map((value) => ({ value, fontWeight: "bold" }));
  const rows: Cell[][] = table.rows.map((row) =>
    row.map((cell, i): Cell => {
      if (cell instanceof Date) return { value: cell, type: Date, format: table.dateFormats[i] ?? "yyyy-mm-dd" };
      // Always text, so an ISBN keeps its leading zeros and never becomes 9.78E+12.
      if (typeof cell === "string") return { value: cell, type: String };
      return cell;
    }),
  );
  const columns = columnWidths(table).map((width) => ({ width }));
  return writeXlsxFile([header, ...rows], { columns, stickyRowsCount: 1 }).toBlob();
}
