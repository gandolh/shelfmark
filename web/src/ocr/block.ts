import { cip, parseIsbn } from "@shelfmark/shared";

/**
 * Finding the CIP description in what OCR read off a copyright page, and
 * reading it with the parser the server uses for the national library's
 * monthly lists (`cip.readDescription`). A book prints it like this:
 *
 *     Descrierea CIP a Bibliotecii Naţionale a României
 *     PALEOLOGU, THEODOR
 *         Ce ne facem cu atîţia proşti? / Theodor Paleologu. -
 *     Bucureşti : Editura Trei, 2026
 *         ISBN 978-606-40-3136-5
 *
 *     821.135.1
 *
 * OCR keeps the lines but not the indents, so the description is the lines
 * after the heading up to the ISBN, a note ("Conţine bibliografie") or the
 * end of the imprint, folded into one line the way the list parser expects:
 * the main heading ends with ". ", "Cluj-" and "Napoca" are one word, the rest
 * join with a space.
 */

/** "Descrierea CIP a Bibliotecii Naţionale a României", as OCR reads it: "C1P", "CIP" spaced out. */
const HEADING = /descrierea\s+c\s*[il1|]\s*p\b/iu;
/** The heading's second line, when the block wraps it: "a României", "Naţionale a României". */
const HEADING_TAIL = /^(?:a\s+)?(?:bibliotecii\s+)?(?:na[țţt]ionale\s+)?(?:a\s+)?rom[âa]niei\.?$/iu;
/** "ISBN", and what OCR makes of it: "1SBN", "lSBN", "ISBN:". */
const ISBN_WORD = /(?<![\p{L}\d])[I1l|][ \t]?S[ \t]?B[ \t]?N[ \t]*[:.]?[ \t]*/gu;
/** Lines that come after a description: its notes, the extent, a volume, the ISBN. */
const AFTER =
  /^(?:Con[țţt]ine\b|Bibliogr|Index\b|Tit\.\s*orig|Text\s+(?:în|in|paralel)\b|Not[ăa]\b|Glosar\b|Rezumat\b|\d+\s+vol\b|(?:Vol|Cartea|Partea|Tom)\.?\s*\d|ISBN\b)/iu;
/** An upper-case main heading on its own line: "PALEOLOGU, THEODOR", "PLATO", "THEOPHYLACT, sfânt". */
const MAIN_HEADING = /^\p{Lu}[\p{Lu}\p{M}'’\- ]*\p{Lu}(?:\s*\([^)]*\))?(?:,\s*[^/:;.]{1,40})?\.?$/u;
/** The description is done once it ends on its imprint's year: ". - Bucureşti : Editura Trei, 2026". */
const ENDS_ON_YEAR = /\.\s+-\s+.*,\s*\[?[12]\d{3}\]?-?\.?$/u;

/** OCR text with the cedilla letters swapped, and the ISBN word and its digits as the list parser's pattern expects them. */
export function tidyOcr(text: string): string {
  return cip
    .romanian(text)
    .replace(/\r\n?/g, "\n")
    // Specks read as marks at a line's end: "Eikon, 2026 |". Never a hyphen, which can end an area (". -").
    .replace(/[ \t]+[|_=~—»«]+[ \t]*$/gmu, "")
    .replace(ISBN_WORD, "ISBN ")
    // O for 0 and l, I or | for 1 inside an ISBN's digits.
    .replace(/(ISBN )([\dOIl| -]{10,24})/gu, (_, word: string, digits: string) => word + digits.replace(/O/g, "0").replace(/[Il|]/g, "1"))
    // An ISBN broken over two lines: "ISBN 978-\n973-50-9138-5".
    .replace(/(ISBN [\d -]*\d-)[ \t]*\n\s*(?=\d)/gu, "$1");
}

/** The description's lines folded into one, as `cip.readDescription` reads it. */
function fold(lines: readonly string[]): string {
  let out = "";
  lines.forEach((raw, i) => {
    let line = raw.trim();
    // The main heading, on its own line in a book, ends with ". " in the lists.
    if (i === 0 && MAIN_HEADING.test(line) && lines.length > 1) line = line.replace(/\.?$/u, ".");
    out = out === "" ? line : /\p{L}-$/u.test(out) ? out + line : `${out} ${line}`;
  });
  // OCR reads the " ; " before a translator or an editor as " : ", which would make them part of the author's name.
  return out.replace(/\s:\s(?=(?:trad|il|ilustr|ed|coord|pref|postf|cuv|red|sel|ref|note)\b)/giu, " ; ");
}

/**
 * An ISBN as the pattern caught it, checked. OCR leaves marks after it on the
 * line ("978-606-49-1634-1 - ul"), which the pattern can take for digits, so a
 * catch that doesn't check out is tried again as its first 13 or 10 characters.
 */
function isbnOf(written: string): string | null {
  const chars = written.replace(/[^\dXx]/g, "").toUpperCase();
  for (const length of [chars.length, 13, 10]) {
    const parsed = parseIsbn(chars.slice(0, length));
    if (parsed.ok) return parsed.isbn13;
  }
  return null;
}

export interface CipFields {
  title: string | null;
  authors: string[];
  publisher: string | null;
  year: number | null;
  /** The block's ISBN, when it has exactly one that checks out. */
  isbn13: string | null;
}

export type CipRead =
  | {
      found: true;
      fields: CipFields;
      /** The description as folded, for the tests and for fixing by hand. */
      description: string;
      /** Every ISBN in the block that checks out, as ISBN-13: a set and its volumes have several. */
      isbns: string[];
    }
  | { found: false };

/** The CIP block in OCR text, read; `found: false` when the text has no "Descrierea CIP" heading. */
export function readCipBlock(ocr: string): CipRead {
  const lines = tidyOcr(ocr)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
  const at = lines.findIndex((line) => HEADING.test(line));
  if (at < 0) return { found: false };

  let from = at + 1;
  while (from < lines.length && HEADING_TAIL.test(lines[from]!)) from++;

  const taken: string[] = [];
  let to = from;
  for (; to < lines.length; to++) {
    const line = lines[to]!;
    if (taken.length > 0 && AFTER.test(line)) break;
    if (/^ISBN\b/u.test(line)) break;
    taken.push(line);
    if (ENDS_ON_YEAR.test(fold(taken))) {
      to++;
      break;
    }
  }
  const description = fold(taken);
  const read = cip.readDescription(description);

  // ISBNs from the description's end on, so a number in a title never counts.
  const found = [...lines.slice(to).join("\n").matchAll(cip.ISBN)].map((match) => isbnOf(match[1]!));
  const isbns = [...new Set(found.filter((isbn) => isbn !== null))];

  return {
    found: true,
    description,
    isbns,
    fields: {
      title: read.title,
      authors: read.authors,
      publisher: read.publisher,
      year: read.year,
      isbn13: isbns.length === 1 ? isbns[0]! : null,
    },
  };
}
