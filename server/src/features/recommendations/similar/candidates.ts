import { looseStem, surname } from "../keys.js";
import type { Catalog, CatalogWork } from "../openlibrary.js";
import type { Profile } from "./profile.js";

/**
 * The books the model ranks: Open Library's works by the library's top
 * authors, then by the subjects its books share. At most `REQUESTS_MAX`
 * searches a refresh, one at a time through the catalog's queue and its
 * 30-day cache, so a second refresh within a month asks nothing.
 */

export const REQUESTS_MAX = 25;
/** The searches by subject; the authors take the rest. */
export const SUBJECT_REQUESTS_MAX = 10;

/**
 * Whether the library could read this work. A work by an author the library
 * holds is kept only when its first language is one the library reads that
 * author in: otherwise it is most likely a translation of a book already on a
 * shelf ("Анна Каренина" for "Anna Karenina"), which no title key catches.
 * Only the first counts, because Open Library lists every edition's language
 * on a work. Any other work is kept in a language the library reads. A work
 * with no language is kept.
 */
export function readable(work: CatalogWork, profile: Profile): boolean {
  for (const author of work.authors) {
    const known = profile.authorLanguages.get(surname(author));
    if (known) return work.language === null || known.has(work.language);
  }
  if (work.languages.length === 0) return true;
  return work.languages.some((language) => profile.languages.has(language));
}

/** A title of one word shorter than this is too common to look for inside another title. */
const ECHO_MIN = 5;

/** The scripts a title can be in that the library may not read, and the languages written in each. */
const SCRIPTS: readonly { letters: RegExp; languages: readonly string[] }[] = [
  { letters: /\p{Script=Cyrillic}/u, languages: ["ru", "uk", "bg", "sr", "mk", "be", "kk", "mn"] },
  { letters: /\p{Script=Greek}/u, languages: ["el", "grc"] },
];

/** Whether the work's title is in a script none of the library's languages is written in ("Братья Карамазовы"). */
export function foreignScript(work: CatalogWork, profile: Profile): boolean {
  return SCRIPTS.some(
    ({ letters, languages }) =>
      letters.test(work.title) && !languages.some((language) => profile.languages.has(language)),
  );
}

/**
 * Whether the work's title repeats a library book's: the same title under
 * another spelling of the author ("The Odyssey" by Ὅμηρος), or a book's title
 * inside it, word for word ("Novels (Jane Eyre / Wuthering Heights)",
 * "Frankenstein Annotated"). Either is most likely a book already on a shelf.
 */
export function echoesLibrary(work: CatalogWork, profile: Profile): boolean {
  const stem = looseStem(work.title);
  if (profile.titleStems.has(stem)) return true;
  const padded = ` ${stem} `;
  for (const held of profile.titleStems) {
    if ((held.includes(" ") || held.length >= ECHO_MIN) && padded.includes(` ${held} `)) return true;
  }
  return false;
}

/** The searches a refresh makes, in order: subjects first take their share, authors fill the budget. */
export function searchesFor(profile: Profile): { authors: string[]; subjects: string[] } {
  const subjects = profile.subjects.slice(0, SUBJECT_REQUESTS_MAX);
  return { authors: profile.authors.slice(0, REQUESTS_MAX - subjects.length), subjects };
}

/**
 * Every work the searches found that the library could read, in a script it
 * reads, not repeating a library title. A search that fails costs only its
 * own works.
 */
export async function gatherCandidates(
  catalog: Catalog,
  profile: Profile,
  onSearch: (done: number, total: number) => void,
): Promise<CatalogWork[]> {
  const { authors, subjects } = searchesFor(profile);
  const asks = [
    ...authors.map((author) => () => catalog.byAuthor(author)),
    ...subjects.map((subject) => () => catalog.bySubject(subject)),
  ];
  const works: CatalogWork[] = [];
  onSearch(0, asks.length);
  for (const [index, ask] of asks.entries()) {
    try {
      works.push(...(await ask()));
    } catch {
      // Open Library did not answer this one: the others still count.
    }
    onSearch(index + 1, asks.length);
  }
  return works.filter(
    (work) => readable(work, profile) && !echoesLibrary(work, profile) && !foreignScript(work, profile),
  );
}
