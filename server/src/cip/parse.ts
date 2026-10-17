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
/** Spaces and hyphens inside, never a line break. */
const ISBN = /ISBN[ \t]+((?:97[89][- ]?)?\d[\d -]{8,16}[\dXx])/g;

/** Romanian with the comma-below ș and ț the lists still type with a cedilla, NFC. */
export function romanian(text: string): string {
  return text.replace(/ş/g, "ș").replace(/Ş/g, "Ș").replace(/ţ/g, "ț").replace(/Ţ/g, "Ț").normalize("NFC");
}

const squash = (text: string) => text.replace(/\s+/g, " ").trim();

/** Strips what ISBD leaves at the end of a part: " /", " :", ".". Keeps "?" and "!". */
function tidy(text: string | undefined): string | null {
  if (text === undefined) return null;
  const out = squash(text).replace(/[\s/:;,=]+$/u, "").replace(/(?<![.\s]\p{L})\.$/u, "");
  return out === "" ? null : out;
}

/** Roles that start a statement of someone who isn't an author: translators, editors, illustrators. */
const ROLE =
  /^\[?(trad|il|ilustr|ed|coord|pref|postf|cuv|red|sel|antol|adapt|prez|note|introd|ref|tr|transl|comp|îngr|ingr|cop|foto|desene|lb|vol)\b/iu;
/** Academic and church titles before a name: "prof. univ. dr.", "assoc. prof. PhD. eng.", "pr.". */
const HONORIFICS = /(^|,\s+|\s(?:și|şi|cu)\s+)(?:(?:prof|conf|lect|asist|univ|dr|ing|ec|pr|arhim|assoc|phd|eng|acad|av|col|gen|ș\.l|sl)\.?\s+)+/giu;

function namesIn(statement: string): string[] {
  let first = squash((statement.split(" ; ")[0] ?? "").replace(/\[[^\]]*\]|\([^)]*\)/g, "").replace(HONORIFICS, "$1"));
  if (ROLE.test(first)) return [];
  // "prezentate de Dan-Silviu Boerescu", "text de ...": a phrase before the names; one with no "de" names nobody.
  if (/^\p{Ll}/u.test(first)) {
    const after = /\bde\s+(\p{Lu}.*)$/u.exec(first);
    if (!after) return [];
    first = after[1]!;
  }
  return first
    .split(/,\s+|\s+&\s+|\s+(?:și|şi|cu|and)\s+/u)
    .map((name) => squash(name.replace(/(?:\.\.\.|…)$/u, "")))
    .filter((name) => name.length > 1 && /^\p{Lu}/u.test(name) && !ROLE.test(name));
}

/** "PALEOLOGU, THEODOR" → "Theodor Paleologu"; "PLATO" → "Plato". Cased word by word. */
function fromHeading(heading: string): string {
  const cased = (part: string) =>
    part
      .trim()
      .toLowerCase()
      .replace(/(^|[\s\-'’])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toUpperCase());
  const [surname, forename] = heading.split(/,\s*/);
  return squash(forename ? `${cased(forename)} ${cased(surname!)}` : cased(surname!));
}

interface Description {
  title: string | null;
  subtitle: string | null;
  authors: string[];
  publisher: string | null;
  city: string | null;
  year: number | null;
}

/**
 * ISBD's area separator ". - ", and " - " after a number, where the lists
 * drop the full stop ("Herculane 2019 - Bucureşti : Shambala"), but only when
 * a place and a colon follow, so "1918 - 2018 : centenar" stays whole.
 */
const AREA = /\.\s+-\s+|(?<=\d)\s+-\s+(?=\p{Lu}[^:]{0,60}\s:\s)/u;

/**
 * "Bucureşti : Editura Trei, 2026", "Roman : Serafica", "Bârlad : Universul
 * academic ; Bucureşti", and with no place, "Editura Andromeda, 2019".
 */
function readImprint(area: string): Pick<Description, "publisher" | "city" | "year"> {
  const parts = area.split(/\s:\s/u);
  const [place, publisher] = parts.length > 1 ? parts : [undefined, parts[0]];
  const years = [...area.matchAll(/(?<!\d)([12]\d{3})(?!\d)/gu)].map((m) => Number(m[1]));
  return {
    city: tidy(place),
    publisher: tidy(publisher?.split(" ; ")[0]?.replace(/,\s*\[?\d{4}.*$/u, "")),
    year: years.at(-1) ?? null,
  };
}

const isImprint = (area: string) =>
  /^\[?\p{Lu}[^:]{0,60}\s:\s\S/u.test(area.trim()) || /^\p{Lu}[^:]{1,80},\s*\[?[12]\d{3}\]?-?$/u.test(area.trim());

/** "PALEOLOGU, THEODOR. Ce ne facem ... / Theodor Paleologu. - Bucureşti : Editura Trei, 2026". */
export function readDescription(text: string): Description {
  let rest = squash(text);
  // An upper-case main heading, then ". ": a person ("SURNAME, FORENAME", "THEOPHYLACT, sfânt"),
  // one name ("PLATO"), or a body or event ("SALONUL NAŢIONAL DE PLASTICĂ MICĂ (2019 ; Brăila)").
  const heading = /^([\p{Lu}][\p{Lu}\p{M}'’\- ]*(?:\s*\([^)]*\))?(?:,\s*[^.,]{1,40})?)\.\s+(.*)$/u.exec(rest);
  const headingName = heading && /^\p{Lu}[\p{Lu}\p{M}'’\- ]*\p{Lu}/u.test(heading[1]!) ? heading[1]! : null;
  if (headingName) rest = heading![2]!;

  const areas = rest.split(AREA);
  const [titleArea = "", ...others] = areas;
  const imprint = others.find(isImprint);

  const slash = titleArea.indexOf(" / ");
  const titlePart = slash >= 0 ? titleArea.slice(0, slash) : titleArea;
  const statement = slash >= 0 ? titleArea.slice(slash + 3) : "";
  const colon = titlePart.indexOf(" : ");
  const title = tidy(colon >= 0 ? titlePart.slice(0, colon) : titlePart);
  const subtitle = colon >= 0 ? tidy(titlePart.slice(colon + 3)) : null;

  let authors = namesIn(statement);
  // The heading names the author only when it is a person ("SURNAME, FORENAME") or one name.
  if (authors.length === 0 && headingName && (headingName.includes(",") || !/\s/.test(headingName.trim()))) {
    authors = [fromHeading(headingName.replace(/\s*\([^)]*\)/, ""))];
  }

  const where = imprint ? readImprint(imprint) : { publisher: null, city: null, year: null };
  return { title, subtitle, authors, ...where };
}

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
