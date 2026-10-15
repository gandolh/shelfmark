import { clean, type DraftSource, type LookupResponse, type ParseIsbnResult } from "@shelfmark/shared";
import { isApiError } from "../api";
import { authorLine } from "../components/cover";
import type { FlowState } from "./flow";

/**
 * Everything Add a book says that depends on data: what is wrong with an
 * ISBN, where a draft came from, which sources a miss was looked for in, and
 * why a lookup or a save failed. One place, so the network wording (brief 12)
 * changes here only.
 */

type IsbnReason = Extract<ParseIsbnResult, { ok: false }>["reason"];

/** What is wrong with a typed ISBN, in a sentence the owner can act on. */
export function isbnProblem(input: string, reason: IsbnReason): string {
  const code = clean(input);
  switch (reason) {
    case "checksum":
      return "Check digit doesn't match. One of the digits is off.";
    case "length":
      return code === "" ? "Type the ISBN first." : `An ISBN has 10 or 13 digits; this has ${code.length}.`;
    case "not_isbn":
      return /^\d{13}$/.test(code)
        ? "An ISBN-13 starts with 978 or 979."
        : "An ISBN is digits only, with an X allowed at the end of a 10-digit one.";
  }
}

export const SOURCE_NAMES = { openlibrary: "Open Library", googlebooks: "Google Books" } as const;

/** "Open Library", "Open Library or Google Books", "A, B or C". */
function either(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} or ${names.at(-1)}`;
}

/** The found sheet's first line. `copy` is another copy of a book already saved. */
export function sourceLine(origin: DraftSource | "copy"): string {
  switch (origin) {
    case "openlibrary":
      return "Found in Open Library";
    case "googlebooks":
      return "Found in Google Books";
    case "both":
      return "Found in Open Library and Google Books";
    case "copy":
      return "Another copy of a book you have";
  }
}

export interface NotFoundWording {
  /** The sources that answered "no such ISBN": "Open Library or Google Books"; null when none did. */
  searchedIn: string | null;
  /** What else to know: a source that failed, one that wasn't asked. */
  notes: string[];
  /** A source failed, so the book may be there after all: offer the lookup again. */
  uncertain: boolean;
}

/**
 * How to say a miss truthfully from `tried`: never name a source as searched
 * when it errored or was skipped (Google Books without a key is skipped).
 */
export function notFoundWording(tried: LookupResponse["tried"]): NotFoundWording {
  const named = (outcome: LookupResponse["tried"][number]["outcome"]) =>
    tried.filter((t) => t.outcome === outcome).map((t) => SOURCE_NAMES[t.source]);
  const searched = named("not_found");
  const failed = named("error");
  const skipped = named("skipped_no_key");
  const notes: string[] = [];
  if (failed.length > 0) {
    notes.push(`${either(failed)} didn't answer, so ${failed.length === 1 ? "it" : "they"} may still have it.`);
  }
  if (skipped.length > 0) {
    const one = skipped.length === 1;
    notes.push(`${either(skipped)} ${one ? "isn't" : "aren't"} set up yet, so ${one ? "it wasn't" : "they weren't"} searched.`);
  }
  return { searchedIn: searched.length > 0 ? either(searched) : null, notes, uncertain: failed.length > 0 };
}

/** The miss as one sentence or two, for the screen reader's announcement and the tests. */
export function notFoundText(isbn13: string, tried: LookupResponse["tried"]): string {
  const { searchedIn, notes } = notFoundWording(tried);
  const lead = searchedIn === null ? `Nothing found for ${isbn13}.` : `No match for ${isbn13} in ${searchedIn}.`;
  return [lead, ...notes].join(" ");
}

/** Between the parts of a line; the space before the dot doesn't break, so no line starts with "·". */
const SEP = "\u00a0· ";

/** "Polirom · 2021 · 218 pages", skipping what isn't known. */
export function metaLine(book: { publisher?: string | null; publishedYear?: number | null; pages?: number | null }): string {
  const parts: string[] = [];
  if (book.publisher) parts.push(book.publisher);
  if (book.publishedYear) parts.push(String(book.publishedYear));
  if (book.pages) parts.push(book.pages === 1 ? "1 page" : `${book.pages} pages`);
  return parts.join(SEP);
}

/** "Frank Herbert · Ace · 2020": the already-owned sheet's second line. */
export function bylineLine(book: {
  authors?: readonly string[] | null;
  publisher?: string | null;
  publishedYear?: number | null;
}): string {
  const parts: string[] = [];
  const authors = authorLine(book.authors ?? []);
  if (authors) parts.push(authors);
  if (book.publisher) parts.push(book.publisher);
  if (book.publishedYear) parts.push(String(book.publishedYear));
  return parts.join(SEP);
}

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "added today", "added 3 Mar 2026", in the device's time zone. */
export function addedOn(iso: string, now: Date): string {
  const date = new Date(iso);
  return sameDay(date, now) ? "added today" : `added ${DAY.format(date)}`;
}

/**
 * Where the copies already saved are, and when: "Living room · A3 · added
 * 3 Mar 2026" for one, "2 copies: Living room · A3 and Bedroom · last added
 * today" for more.
 */
export function ownedLine(owned: LookupResponse["owned"], now: Date): string {
  const [first] = owned;
  if (first === undefined) return "";
  if (owned.length === 1) {
    const added = addedOn(first.createdAt, now);
    return `${first.shelf ?? "No shelf"}${SEP}${added}`;
  }
  const shelves = [...new Set(owned.map((copy) => copy.shelf ?? "no shelf"))];
  const where = shelves.length === 1 ? shelves[0] : `${shelves.slice(0, -1).join(", ")} and ${shelves.at(-1)}`;
  const newest = owned.reduce((a, b) => (b.createdAt > a.createdAt ? b : a), first);
  return `${owned.length} copies: ${where}${SEP}last ${addedOn(newest.createdAt, now)}`;
}

export function sessionCount(added: number): string {
  return `${added} added this session`;
}

/** A failed call as the sheet shows it. `network` marks "the server can't be reached" (brief 12 words it for offline). */
export interface Failure {
  message: string;
  network: boolean;
}

/** Why a lookup didn't run or didn't answer. */
export function lookupFailure(error: unknown): Failure {
  if (isApiError(error, "network")) {
    return { message: "Looking up a book needs the network, and Shelfmark can't be reached. Try again when you're back online.", network: true };
  }
  if (isApiError(error)) return { message: `The lookup didn't work: ${error.message}`, network: false };
  return { message: "The lookup didn't work. Try again.", network: false };
}

/** Why a book wasn't saved. Nothing was saved when this shows. */
export function saveFailure(error: unknown): Failure {
  if (isApiError(error, "network")) {
    return { message: "Not saved: saving needs the network, and Shelfmark can't be reached. Try again when you're back online.", network: true };
  }
  if (isApiError(error)) return { message: `Not saved: ${error.message}`, network: false };
  return { message: "Not saved. Try again.", network: false };
}

/**
 * What the page's live region says: a notice newer than the step on screen
 * ("Saved …"), else, when focus isn't moving into the sheet (Type ISBN keeps
 * it in the field), what the step is.
 */
export function announcement(state: Pick<FlowState, "step" | "notice" | "added">, stepsToo: boolean): string {
  const { step, notice, added } = state;
  if (notice !== null && notice.id > step.id) {
    return notice.kind === "saved"
      ? `Saved ${notice.title}. ${sessionCount(added)}.`
      : `${notice.title} is saved, but its cover didn't download.`;
  }
  if (!stepsToo) return "";
  switch (step.kind) {
    case "looking":
      return `Looking up ${step.isbn13}.`;
    case "found":
      return `${sourceLine(step.proposal.origin)}: ${step.proposal.details.title}.`;
    case "owned":
      return step.lookup.draft?.title ? `Already in your library: ${step.lookup.draft.title}.` : "Already in your library.";
    case "form":
      return step.reason === "not-found" && step.lookup ? notFoundText(step.lookup.isbn13, step.lookup.tried) : "";
    case "failed":
      return step.failure.message;
    default:
      return "";
  }
}
