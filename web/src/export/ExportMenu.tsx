import { useState } from "react";
import { Menu } from "../components/Menu";
import { COLUMNS } from "../library/columns";
import type { LibraryView } from "../library/view";
import { toCsv } from "./csv";
import { everythingTable, viewTable, type ExportTable } from "./fields";

/** `shelfmark-2026-10-15`, the owner's local day. */
export function exportFileName(extension: "csv" | "xlsx", now: Date = new Date()): string {
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

async function saveCsv(table: ExportTable): Promise<void> {
  // toCsv starts with the BOM, and a Blob of a string keeps it.
  const text = toCsv(table.header, table.rows);
  save(new Blob([text], { type: "text/csv;charset=utf-8" }), exportFileName("csv"));
}

async function saveXlsx(table: ExportTable): Promise<void> {
  const { buildXlsx } = await import("./xlsx");
  save(await buildXlsx(table), exportFileName("xlsx"));
}

/** Export, under the toolbar: what the Library shows now, or every book and every field, as Excel or CSV. */
export function ExportMenu({ view }: { view: LibraryView }) {
  const [failed, setFailed] = useState(false);
  const run = (job: () => Promise<void>) => () => {
    setFailed(false);
    job().catch(() => setFailed(true));
  };
  const count = view.rows.length;

  return (
    <>
      <Menu
        label="Export"
        trigger="Export"
        align="end"
        sections={[
          {
            label: `What you see now · ${count} ${count === 1 ? "book" : "books"}`,
            items: [
              { label: "Excel workbook (.xlsx)", onSelect: run(() => saveXlsx(viewTable(view, true))), disabled: count === 0 },
              { label: "CSV", onSelect: run(() => saveCsv(viewTable(view, false))), disabled: count === 0 },
            ],
          },
          {
            label: "Every book, every field",
            items: [
              { label: "Excel workbook (.xlsx)", onSelect: run(() => saveXlsx(everythingTable(view, COLUMNS, true))), disabled: view.total === 0 },
              { label: "CSV", onSelect: run(() => saveCsv(everythingTable(view, COLUMNS, false))), disabled: view.total === 0 },
            ],
          },
        ]}
      />
      {failed && (
        <span role="alert" className="visually-hidden">
          The export did not work. Try again.
        </span>
      )}
    </>
  );
}
