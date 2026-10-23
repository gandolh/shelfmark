/**
 * The national library's monthly CIP list, as `pdftotext -layout` prints it,
 * to one record per ISBN. The layout has been the same from 2019 to 2026:
 *
 *             267. PALEOLOGU, THEODOR. Ce ne facem cu atîţia proşti? /
 *     Theodor Paleologu. - Bucureşti : Editura Trei, 2026
 *             ISBN 978-606-40-3136-5
 *     1
 *                                                         CIP 2026-06430
 *
 * An entry starts with an indented number; its description runs on in
 * lines indented less (some pages sit six columns to the right, so it is
 * measured against the entry's first line); notes ("Conţine bibliografie"), the extent ("6 vol."), the
 * ISBNs and the volumes are indented lines after it; class numbers and the CIP
 * number end it. Page headers can land inside a description and are dropped.
 * A volume ("Vol. 1 : ...", "Cartea 4 : ...") with its own ISBN gets the
 * entry's title and its own line as the subtitle. The lists are the
 * publishers' pre-publication data and say nothing of language, pages or
 * cover.
 */

import { cip } from "@shelfmark/shared";

// The description reading moved to shared/src/cip.ts (brief 30), unchanged; the web app reads OCR text with it too.
const { AREA, ISBN, isImprint, readDescription, readImprint, romanian, squash, tidy } = cip;

export interface CipRecord {
  isbn13: string;
  /** The entry's number in its issue. */
  entry: number;
  title: string;
  subtitle: string | null;
  authors: string[];
  publisher: string | null;
  city: string | null;
  year: number | null;
}

const ENTRY_START = /^(\s{4,})(\d{1,5})\.\s+(\S.*)$/;
const indent = (line: string) => line.length - line.trimStart().length;
/** "12        BIBLIOGRAFIA CĂRŢILOR ÎN CURS DE APARIŢIE" and "CIP        13", with or without the form feed. */
const PAGE_HEADER = /^\f?\s*(?:\d+\s{3,}BIBLIOGRAFIA CĂR[ŢȚ]ILOR\b.*|CIP\s{3,}\d+)\s*$/u;

/** Digits of an ISBN-13 as written; anything else (an ISBN-10, a typo) is `null`. */
function isbn13Of(written: string): string | null {
  const digits = written.replace(/[^\dXx]/g, "");
  return /^97[89]\d{10}$/.test(digits) ? digits : null;
}

/** Every entry in an issue's text. An entry with no ISBN-13 gives nothing. */
export function parseIssue(text: string): CipRecord[] {
  const lines = text.split(/\r?\n/);
  const records = new Map<string, CipRecord>();

  const starts: { line: number; entry: number; depth: number }[] = [];
  lines.forEach((line, i) => {
    const match = ENTRY_START.exec(line);
    if (match) starts.push({ line: i, entry: Number(match[2]), depth: match[1]!.length });
  });

  starts.forEach(({ line: from, entry, depth }, k) => {
    const to = starts[k + 1]?.line ?? lines.length;
    const chunk = lines.slice(from, to).filter((line) => !PAGE_HEADER.test(line));

    // The description: the start line, then the lines indented less, up to the first that isn't.
    let description = ENTRY_START.exec(chunk[0]!)![3]!;
    let i = 1;
    for (; i < chunk.length; i++) {
      const line = chunk[i]!;
      if (line.trim() === "") continue;
      if (indent(line) > depth - 3) break;
      // "Cluj-" at a line's end and "Napoca" on the next are one word.
      description = /\p{L}-$/u.test(description.trimEnd()) ? description.trimEnd() + line.trim() : `${description} ${line}`;
    }
    const read = readDescription(romanian(description));
    if (!read.title) return;

    // The rest, with ISBNs broken across lines put back together ("ISBN 978-\n973-50-9138-5"). The
    // other line breaks stay: an ISBN must not run on into the class number on the next line.
    const tail = romanian(chunk.slice(i).join("\n")).replace(/(\d)-[ \t]*\n\s*(?=\d)/g, "$1-");
    const found = [...tail.matchAll(ISBN)];
    found.forEach((match, n) => {
      const isbn13 = isbn13Of(match[1]!);
      if (!isbn13) return;
      const record: CipRecord = { isbn13, entry, ...read, title: read.title! };
      if (n > 0) {
        // A volume: the text since the previous ISBN, "Vol. 1 : Apărarea lui Socrate, ... - 2026. - ISBN",
        // or with its own imprint, "Cartea 4 : ... - Timişoara : Artpress, 2019. - ISBN".
        const previous = found[n - 1]!;
        const between = squash(tail.slice(previous.index + previous[0].length, match.index));
        const part = /(?:^|\s)((?:Vol|Cartea|Partea|Tom|Nr)\.?\s.+)$/u.exec(between)?.[1];
        if (part) {
          const [own = "", ...after] = part.split(AREA);
          record.subtitle = tidy(own.split(" / ")[0]) ?? record.subtitle;
          const imprint = after.find(isImprint);
          if (imprint) Object.assign(record, readImprint(imprint));
          const year = after.map((area) => /^\[?(\d{4})\]?\.?$/u.exec(area.trim())?.[1]).find(Boolean);
          if (year) record.year = Number(year);
        }
      }
      records.set(isbn13, record);
    });
  });

  return [...records.values()];
}
