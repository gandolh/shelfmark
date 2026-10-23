import { clean, type LookupResponse, type LookupSource, type ParseIsbnResult } from "@shelfmark/shared";
import { isApiError } from "../api";
import { authorLine } from "../components/cover";
import type { OfflineAnswer } from "../offline/library";
import type { QueueItem } from "../offline/queueStore";
import type { FlowState, Notice } from "./flow";

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

/** How a sentence names each source; the library catalogs as the libraries call themselves. */
export const SOURCE_NAMES: Record<LookupSource, string> = {
  openlibrary: "Open Library",
  biblacad: "the Romanian Academy Library",
  bcucluj: "BCU Cluj",
  bcutimisoara: "BCU Timișoara",
  cip: "the national library's CIP lists",
  googlebooks: "Google Books",
};

const LIBRARIES: ReadonlySet<LookupSource> = new Set(["biblacad", "bcucluj", "bcutimisoara"]);

/** "Open Library", "Open Library or Google Books", "A, B or C". */
function either(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} or ${names.at(-1)}`;
}

/** "A", "A and B", "A, B and C". */
function both(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** At the start of a sentence: "The Romanian Academy Library didn't answer". */
function sentence(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Where a draft's details came from, crediting a library by its catalog ("the
 * catalog of BCU Cluj") and saying the CIP lists were written before printing,
 * so the printed book may differ.
 */
export function draftSources(sources: readonly LookupSource[]): string {
  const phrase = (source: LookupSource) =>
    LIBRARIES.has(source)
      ? `the catalog of ${SOURCE_NAMES[source]}`
      : source === "cip"
        ? `${SOURCE_NAMES.cip} (written before printing)`
        : SOURCE_NAMES[source];
  return both(sources.map(phrase));
}

/** The found sheet's first line. `copy` is another copy of a book already saved. */
export function sourceLine(origin: readonly LookupSource[] | "copy"): string {
  return origin === "copy" ? "Another copy of a book you have" : `Found in ${draftSources(origin)}`;
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
    notes.push(`${sentence(either(failed))} didn't answer, so ${failed.length === 1 ? "it" : "they"} may still have it.`);
  }
  if (skipped.length > 0) {
    const one = skipped.length === 1;
    notes.push(`${sentence(either(skipped))} ${one ? "isn't" : "aren't"} set up yet, so ${one ? "it wasn't" : "they weren't"} searched.`);
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

/**
 * A lookup that couldn't reach the server, when the device has no copy of the
 * library to answer from (it was never loaded here, or the owner signed out).
 */
export function noOfflineCopy(): Failure {
  return {
    message: "Shelfmark can't be reached, and this device has no copy of your library yet. The offline check needs one visit online first.",
    network: true,
  };
}

// --- The scan queue ---------------------------------------------------------------

/** The line on Add a book that opens the list. */
export function waitingLine(count: number): string {
  return `Waiting to look up (${count})`;
}

/** What a queued scan is doing, for its row in the list. */
export function queueItemLine(item: Pick<QueueItem, "state" | "lookup">): string {
  switch (item.state) {
    case "waiting":
      return "Waiting for the network";
    case "looking":
      return "Looking it up…";
    case "failed":
      return "The lookup didn't work";
    case "answered": {
      const { lookup } = item;
      if (lookup === null) return "Looked up";
      if (lookup.owned.length > 0) return "Already in your library";
      if (lookup.wishlisted.length > 0) return "On your wishlist";
      return lookup.draft?.title ? lookup.draft.title : "Nothing found";
    }
  }
}

/** What the top of the page says after "Look it up later". */
export function queuedLine(notice: Extract<Notice, { kind: "queued" }>): string {
  switch (notice.outcome) {
    case "queued":
      return `${notice.isbn13} will be looked up when you're online`;
    case "already":
      return `${notice.isbn13} is already waiting to be looked up`;
    case "failed":
      return `Couldn't keep ${notice.isbn13} on this device`;
  }
}

/** "23 Oct 2026", in the device's time zone. */
export function asOf(iso: string): string {
  return DAY.format(new Date(iso));
}

/** Where the owned copies are: "Living room · A2", "Living room · A2 and No shelf". */
export function offlineShelves(copies: readonly { shelf: string | null }[]): string {
  const shelves = [...new Set(copies.map((copy) => copy.shelf ?? "no shelf"))];
  const line = shelves.length === 1 ? (shelves[0] ?? "") : `${shelves.slice(0, -1).join(", ")} and ${shelves.at(-1)}`;
  return line.charAt(0).toUpperCase() + line.slice(1);
}

/** The offline sheet's headline: "Already on Living room · A2", "On your wishlist", "Not in your library". */
export function offlineStatus(answer: OfflineAnswer): string {
  switch (answer.kind) {
    case "owned":
      return `Already on ${offlineShelves(answer.copies)}`;
    case "wishlisted":
      return "On your wishlist";
    case "absent":
      return "Not in your library";
  }
}

/** The line that says plainly this is not a live answer. */
export function offlineNote(answer: OfflineAnswer): string {
  return `This is the offline answer: Shelfmark can't be reached, so it comes from the copy of your library on this device, as of ${asOf(answer.savedAt)}.`;
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
    if (notice.kind === "saved" && notice.outcome === "wishlist") return `Added ${notice.title} to your wishlist.`;
    if (notice.kind === "saved" && notice.outcome === "bought") return `Moved ${notice.title} to your shelf.`;
    if (notice.kind === "queued") return `${queuedLine(notice)}.`;
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
    case "wishlisted":
      return step.lookup.draft?.title ? `On your wishlist: ${step.lookup.draft.title}.` : "On your wishlist.";
    case "form":
      return step.reason === "not-found" && step.lookup ? notFoundText(step.lookup.isbn13, step.lookup.tried) : "";
    case "failed":
      return step.failure.message;
    case "queue":
      return "Waiting to look up.";
    case "offline":
      return `${offlineStatus(step.answer)}${step.answer.kind === "absent" ? "" : `: ${step.answer.copies[0]?.title ?? step.isbn13}`}. ${offlineNote(step.answer)}`;
    default:
      return "";
  }
}
