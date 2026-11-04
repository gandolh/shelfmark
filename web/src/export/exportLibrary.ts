import type { Book } from "@shelfmark/shared";
import { toCsv } from "./csv";
import { libraryTable } from "./fields";

/**
 * "Export library" in the account menu (layout/AccountMenu.tsx): every book,
 * whatever the Library shows, as an Excel workbook or a CSV file. The account
 * menu loads this module only when an export is chosen, so the shell carries
 * none of it.
 */

export type ExportFormat = "xlsx" | "csv";

/** `shelfmark-2026-10-15`, the owner's local day. */
export function exportFileName(extension: ExportFormat, now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `shelfmark-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.${extension}`;
}

function save(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  // After the click has started the download.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Write every book to a file the browser downloads. */
export async function exportLibrary(books: readonly Book[], format: ExportFormat): Promise<void> {
  if (format === "csv") {
    const table = libraryTable(books, false);
    // toCsv starts with the BOM, and a Blob of a string keeps it.
    save(new Blob([toCsv(table.header, table.rows)], { type: "text/csv;charset=utf-8" }), exportFileName("csv"));
    return;
  }
  const { buildXlsx } = await import("./xlsx");
  save(await buildXlsx(libraryTable(books, true)), exportFileName("xlsx"));
}
