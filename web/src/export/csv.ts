import type { ExportCell } from "./fields";

/** Excel on Windows reads a CSV without this as the local code page, and ș, ț, ă turn to garbage. */
export const BOM = "﻿";

/**
 * A cell that starts with one of these runs as a formula when the file opens
 * (OWASP "CSV Injection"), so it gets a leading `'`, which a spreadsheet
 * shows as plain text.
 */
const FORMULA_START = /^[=+\-@\t\r]/;

function text(cell: ExportCell): string {
  if (cell === null) return "";
  if (cell instanceof Date) return cell.toISOString();
  if (typeof cell === "boolean") return cell ? "Yes" : "No";
  return String(cell);
}

/** One cell, guarded and quoted (RFC 4180: only when it holds a comma, quote or line break). */
export function csvCell(cell: ExportCell): string {
  let out = text(cell);
  // A number is data, not a formula: -5 stays -5.
  if (typeof cell !== "number" && FORMULA_START.test(out)) out = `'${out}`;
  return /[",\r\n]/.test(out) ? `"${out.replaceAll('"', '""')}"` : out;
}

export function toCsv(header: readonly string[], rows: readonly (readonly ExportCell[])[]): string {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(","));
  return `${BOM}${lines.join("\r\n")}\r\n`;
}
