/**
 * Reading a CSV file: bytes to text (with the encoding named), text to rows.
 * The writer is export/csv.ts; this mirrors it (RFC 4180 quoting) and also
 * takes what spreadsheets in other locales write: `;` or tab between cells.
 */

export type Encoding = "UTF-8" | "UTF-16" | "windows-1250" | "windows-1252";

export interface Decoded {
  text: string;
  encoding: Encoding;
}

const BOM = "﻿";

/** Romanian text in windows-1250 has cedilla ş and ţ; the language wants the comma-below ș and ț. */
const CEDILLA_TO_COMMA: Record<string, string> = { "ş": "ș", "Ş": "Ș", "ţ": "ț", "Ţ": "Ț" };

function decodeAs(label: string, bytes: Uint8Array, fatal: boolean): string | null {
  try {
    return new TextDecoder(label, { fatal }).decode(bytes);
  } catch {
    // A fatal decode that hit a bad byte, or a runtime without that code page.
    return null;
  }
}

/**
 * The file's text. A UTF-16 byte order mark means UTF-16 ("Unicode text" from
 * Excel). Otherwise UTF-8 with `fatal: true`, so one stray byte can't pass
 * for valid text; on failure windows-1250 (Romanian), then windows-1252. A
 * byte order mark is dropped.
 */
export function decodeCsv(bytes: Uint8Array): Decoded {
  const utf16 = bytes[0] === 0xff && bytes[1] === 0xfe ? "utf-16le" : bytes[0] === 0xfe && bytes[1] === 0xff ? "utf-16be" : null;
  if (utf16) {
    const text = decodeAs(utf16, bytes, false);
    if (text !== null) return { text: text.replace(BOM, ""), encoding: "UTF-16" };
  }
  const utf8 = decodeAs("utf-8", bytes, true);
  if (utf8 !== null) return { text: utf8.startsWith(BOM) ? utf8.slice(1) : utf8, encoding: "UTF-8" };

  const cp1250 = decodeAs("windows-1250", bytes, true);
  if (cp1250 !== null) {
    return { text: cp1250.replace(/[ŞşŢţ]/g, (c) => CEDILLA_TO_COMMA[c] ?? c), encoding: "windows-1250" };
  }
  // windows-1252 reads every byte, so this is the end of the line.
  return { text: decodeAs("windows-1252", bytes, false) ?? "", encoding: "windows-1252" };
}

const DELIMITERS = [",", ";", "\t"] as const;

/** The cell separator: whichever of `,` `;` tab is most common in the first record, outside quotes. Comma on a tie. */
export function detectDelimiter(text: string): string {
  const counts = new Map<string, number>(DELIMITERS.map((d) => [d, 0]));
  let quoted = false;
  for (const char of text) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && (char === "\n" || char === "\r")) break;
    else if (!quoted && counts.has(char)) counts.set(char, (counts.get(char) ?? 0) + 1);
  }
  let best: string = ",";
  for (const d of DELIMITERS) if ((counts.get(d) ?? 0) > (counts.get(best) ?? 0)) best = d;
  return best;
}

/**
 * Text to rows of cells. Quoted cells may hold the delimiter, line breaks and
 * doubled quotes. `\r\n`, `\n` and `\r` all end a row; a row with no content
 * at all (a blank line) is dropped.
 */
export function parseCsv(input: string, delimiter: string = detectDelimiter(input)): string[][] {
  const text = input.startsWith(BOM) ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let wasQuoted = false; // the current cell opened with a quote, so "" is a real empty cell

  const endCell = () => {
    row.push(cell);
    cell = "";
    wasQuoted = false;
  };
  const endRow = () => {
    const blank = row.length === 0 && cell === "" && !wasQuoted;
    endCell();
    if (!blank) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i] ?? "";
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += char;
    } else if (char === '"' && cell === "") {
      quoted = true;
      wasQuoted = true;
    } else if (char === delimiter) endCell();
    else if (char === "\n") endRow();
    else if (char === "\r") {
      if (text[i + 1] === "\n") i++;
      endRow();
    } else cell += char;
  }
  if (cell !== "" || row.length > 0 || wasQuoted) endRow();
  return rows;
}

/** Export's formula guard (`'=1+1`) taken off again, so a Shelfmark export imports back as it was. */
export function unguard(cell: string): string {
  return /^'[=+\-@\t\r]/.test(cell) ? cell.slice(1) : cell;
}
