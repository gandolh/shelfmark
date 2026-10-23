/**
 * Reading a CIP description, the ISBD-style text the national library writes
 * for every Romanian book before it is printed:
 *
 *     PALEOLOGU, THEODOR. Ce ne facem cu atîţia proşti? / Theodor Paleologu. -
 *     Bucureşti : Editura Trei, 2026
 *
 * The server reads it from the monthly CIP lists (`server/src/cip/parse.ts`,
 * which also uses the helpers below for a volume's own part), and the web app
 * from OCR of the block a book prints on its copyright page (brief 30). Moved
 * here from the server unchanged on 2026-10-23, so both read it with the same
 * tested code. No imports, so it runs anywhere.
 *
 * Exported from the package as one namespace, `cip`, since the helpers carry
 * generic names (`tidy`, `squash`, `AREA`, `ISBN`).
 */

/** Spaces and hyphens inside, never a line break. Global: use it with `matchAll`, never `test` or `exec`. */
export const ISBN = /ISBN[ \t]+((?:97[89][- ]?)?\d[\d -]{8,16}[\dXx])/g;

/** Romanian with the comma-below ș and ț the lists still type with a cedilla, NFC. */
export function romanian(text: string): string {
  return text.replace(/ş/g, "ș").replace(/Ş/g, "Ș").replace(/ţ/g, "ț").replace(/Ţ/g, "Ț").normalize("NFC");
}

export const squash = (text: string) => text.replace(/\s+/g, " ").trim();

/** Strips what ISBD leaves at the end of a part: " /", " :", ".". Keeps "?" and "!". */
export function tidy(text: string | undefined): string | null {
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

export interface Description {
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
export const AREA = /\.\s+-\s+|(?<=\d)\s+-\s+(?=\p{Lu}[^:]{0,60}\s:\s)/u;

/**
 * "Bucureşti : Editura Trei, 2026", "Roman : Serafica", "Bârlad : Universul
 * academic ; Bucureşti", and with no place, "Editura Andromeda, 2019".
 */
export function readImprint(area: string): Pick<Description, "publisher" | "city" | "year"> {
  const parts = area.split(/\s:\s/u);
  const [place, publisher] = parts.length > 1 ? parts : [undefined, parts[0]];
  const years = [...area.matchAll(/(?<!\d)([12]\d{3})(?!\d)/gu)].map((m) => Number(m[1]));
  return {
    city: tidy(place),
    publisher: tidy(publisher?.split(" ; ")[0]?.replace(/,\s*\[?\d{4}.*$/u, "")),
    year: years.at(-1) ?? null,
  };
}

export const isImprint = (area: string) =>
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
