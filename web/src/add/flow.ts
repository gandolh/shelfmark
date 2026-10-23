import {
  draftMetadataSource,
  type Book,
  type BookCreate,
  type Collection,
  type Draft,
  type LookupSource,
  type LookupResponse,
  type Status,
} from "@shelfmark/shared";
import type { OfflineAnswer } from "../offline/library";
import type { ScannedCode } from "../scanner/detector";
import { EMPTY_FORM, joinAuthors, type FormFields, type FormValues } from "./form";
import type { Failure } from "./words";

/**
 * Add a book as a state machine: which mode the page is in, what the result
 * sheet shows, and the session's count. Pure (no React, no fetch), so every
 * transition is unit-tested; AddBookPage runs the lookups and saves it asks
 * for and reports back with events.
 *
 * The page never navigates while the camera runs (scanning.md): scanning,
 * confirming and saving are steps here, not routes.
 */

export type Mode = "scan" | "isbn" | "manual";

/** Where a new book's cover comes from once it is saved. A photo the owner takes wins over all of these. */
export type CoverPlan =
  | { kind: "candidates"; urls: readonly string[] }
  /** Another copy: the first copy's stored cover, copied across; `coverUpdatedAt` is its version. */
  | { kind: "copy"; fromId: number; coverUpdatedAt: string | null }
  | { kind: "none" };

/** The fields a confirm step saves; shelf and status are the owner's to pick. */
export type Details = Omit<BookCreate, "shelf" | "status" | "collection">;

/** A book ready to confirm: the found sheet's content. */
export interface Proposal {
  details: Details;
  /** The sources the details came from, or another copy of a book already saved. */
  origin: readonly LookupSource[] | "copy";
  cover: CoverPlan;
}

/** The fields the by-hand form doesn't show, kept and saved with it: the rest of a draft, a scanned barcode. */
export interface FormBase {
  details: Partial<Details>;
  cover: CoverPlan;
}

/** The form's first values. `shelf` undefined: the page's default (the shelf used last). */
export type FormInitial = Omit<FormValues, "shelf"> & { shelf?: string | null };

/**
 * Why the form is open: `manual` (By hand), `not-found` (no source knew the
 * ISBN), `untitled` (found without a title), `edit` (Edit details on a
 * found book), `barcode` (a code that isn't an ISBN), `failed` (by hand after
 * a lookup failed), `copy` (another copy with nothing known to copy from).
 */
export type FormReason = "manual" | "not-found" | "untitled" | "edit" | "barcode" | "failed" | "copy";

export interface SaveState {
  saving: boolean;
  failure: Failure | null;
}

/**
 * What the sheet shows. Every step has an `id`, new for each step entered:
 * a lookup's answer carries the id it was asked under (a stale one is
 * dropped), and a form remounts with fresh values for each new id.
 *
 * - `ready`: nothing; the scanner reads (Scan) or the field waits (Type ISBN).
 * - `typing`: Scan mode's sheet asking for the ISBN after a non-ISBN barcode.
 * - `looking`: a lookup in flight.
 * - `other`: a barcode that isn't an ISBN.
 * - `failed`: the lookup didn't answer.
 * - `offline`: the lookup couldn't reach the server, so the device's copy of
 *   the library answered (offline/library.ts). Nothing on it can be saved.
 * - `owned`: the ISBN is already in the library.
 * - `wishlisted`: no copy is owned, but one is on the wishlist: "I bought it"
 *   asks for a shelf and moves that row to Owned (`save` is that call's state).
 * - `found`: a draft (or another copy) to confirm with a shelf and a status.
 * - `queue`: the scans waiting to be looked up (queued offline); opening one
 *   leaves this step for the ordinary sheet of its answer.
 * - `form`: the by-hand form.
 */
export type Step =
  | { kind: "ready"; id: number }
  | { kind: "typing"; id: number; code: string }
  | { kind: "looking"; id: number; isbn13: string }
  | { kind: "other"; id: number; code: string }
  | { kind: "failed"; id: number; isbn13: string; failure: Failure }
  | { kind: "offline"; id: number; isbn13: string; answer: OfflineAnswer }
  | { kind: "owned"; id: number; lookup: LookupResponse }
  | { kind: "wishlisted"; id: number; lookup: LookupResponse; save: SaveState }
  /** `shelf`: the shelf chosen when the scan was queued (offline/queue.ts); left out, the page's default. */
  | { kind: "found"; id: number; lookup: LookupResponse | null; proposal: Proposal; save: SaveState; shelf?: string | null }
  | { kind: "queue"; id: number }
  | {
      kind: "form";
      id: number;
      reason: FormReason;
      lookup: LookupResponse | null;
      initial: FormInitial;
      base: FormBase;
      save: SaveState;
    };

export type StepKind = Step["kind"];

/** What the top of the page says for a moment after a save. */
export type Notice =
  /** `outcome`: `wishlist` (added to the wishlist), `bought` (moved from the wishlist to a shelf); left out for a new owned book. */
  | { id: number; kind: "saved"; bookId: number; title: string; outcome?: SavedOutcome }
  | { id: number; kind: "cover-failed"; bookId: number; title: string }
  /** An offline scan went (or didn't) onto the queue. */
  | { id: number; kind: "queued"; isbn13: string; outcome: QueueOutcome };

/** `already`: the ISBN was waiting; `failed`: the device wouldn't keep it. */
export type QueueOutcome = "queued" | "already" | "failed";

/** How a save differs from a new owned book. */
export type SavedOutcome = "wishlist" | "bought";

export interface FlowState {
  mode: Mode;
  step: Step;
  /** The next id to hand out, to steps and notices alike. */
  next: number;
  /** Books saved since the page opened (the session counter). */
  added: number;
  /** The shelf of the last book saved here; `undefined` until one is. The next book defaults to it. */
  lastShelf: string | null | undefined;
  notice: Notice | null;
  /**
   * The queued scan (offline/queue.ts) the sheet came from, while the sheet is
   * still that scan's: its answer, "Edit details" or "Add another copy" on it.
   * Saving or discarding there takes the scan out of the queue; leaving the
   * sheet any other way keeps it queued.
   */
  queued: number | null;
}

export type FlowEvent =
  | { type: "mode"; mode: Mode }
  /** `known`: the answer the page already has for this ISBN (memo.ts), shown without a request. */
  | { type: "scanned"; code: ScannedCode; known?: LookupResponse }
  | { type: "submit-isbn"; isbn13: string; known?: LookupResponse }
  | { type: "looked-up"; id: number; lookup: LookupResponse }
  | { type: "lookup-failed"; id: number; failure: Failure }
  /** The server couldn't be reached and the device's copy of the library has an answer. */
  | { type: "answered-offline"; id: number; answer: OfflineAnswer }
  | { type: "retry" }
  /** The page asked the queue to keep an offline scan ("Look it up later"), and this is what came of it. */
  | { type: "queued"; isbn13: string; outcome: QueueOutcome }
  /** "Waiting to look up (N)": the list of queued scans. */
  | { type: "show-queue" }
  /** A queued scan's answer (`null`: the lookup was refused, so the form opens) as the ordinary sheet, on the shelf it was queued with. */
  | { type: "open-queued"; id: number; isbn13: string; lookup: LookupResponse | null; shelf: string | null }
  | { type: "type-isbn" }
  | { type: "by-hand" }
  | { type: "edit"; shelf: string | null; status: Status }
  | { type: "another-copy"; proposal: Proposal | null }
  | { type: "discard" }
  | { type: "save" }
  /** `outcome`: `wishlist` leaves the default shelf alone; `bought` (from "I bought it") sets it to the shelf chosen. */
  | { type: "saved"; book: { id: number; title: string; shelf: string | null }; outcome?: SavedOutcome }
  | { type: "save-failed"; failure: Failure }
  | { type: "cover-failed"; book: { id: number; title: string } }
  | { type: "dismiss-notice"; id: number };

const IDLE: SaveState = { saving: false, failure: null };

export function initialFlow(mode: Mode, carried?: Pick<FlowState, "added" | "lastShelf">): FlowState {
  return {
    mode,
    step: restingStep(mode, 1),
    next: 2,
    added: carried?.added ?? 0,
    lastShelf: carried?.lastShelf,
    notice: null,
    queued: null,
  };
}

/** The step a mode rests in: a blank form By hand, nothing otherwise. */
function restingStep(mode: Mode, id: number): Step {
  if (mode !== "manual") return { kind: "ready", id };
  return { kind: "form", id, reason: "manual", lookup: null, initial: { ...EMPTY_FORM, shelf: undefined }, base: NO_BASE, save: IDLE };
}

const NO_BASE: FormBase = { details: {}, cover: { kind: "none" } };

/**
 * The scanner can read only while nothing is on the sheet: a result is the
 * owner's until they act on it, and its buttons bring the camera back.
 */
export function scannerPaused(state: FlowState): boolean {
  return state.mode !== "scan" || state.step.kind !== "ready";
}

/** True while a save is in flight: the sheet's buttons wait. */
export function isSaving(step: Step): boolean {
  return (step.kind === "found" || step.kind === "form" || step.kind === "wishlisted") && step.save.saving;
}

/** The ISBN the sheet is about, if any: Enter on the same ISBN again does nothing. */
export function currentIsbn(step: Step): string | null {
  switch (step.kind) {
    case "looking":
      return step.isbn13;
    case "owned":
    case "wishlisted":
      return step.lookup.isbn13;
    case "offline":
      return step.isbn13;
    case "found":
    case "form":
      return step.lookup?.isbn13 ?? null;
    default:
      return null;
  }
}

// --- Proposals ------------------------------------------------------------------

/** A found draft as the details to save: never the draft itself (the create body is strict). */
export function proposalFromDraft(draft: Draft & { title: string }): Proposal {
  return {
    details: {
      title: draft.title,
      subtitle: draft.subtitle,
      authors: draft.authors,
      publisher: draft.publisher,
      publishedYear: draft.publishedYear,
      pages: draft.pages,
      language: draft.language,
      description: draft.description,
      subjects: draft.subjects,
      isbn13: draft.isbn13,
      metadataSource: draftMetadataSource(draft.sources),
    },
    origin: draft.sources,
    cover: draft.coverCandidates.length > 0 ? { kind: "candidates", urls: draft.coverCandidates.map((c) => c.url) } : { kind: "none" },
  };
}

/**
 * Another copy of a saved book: the details as the owner keeps them (they
 * may have corrected the draft), the first copy's cover copied across, or
 * the draft's candidate when the first copy has none.
 */
export function proposalFromBook(book: Book, draft: Draft | null): Proposal {
  const candidates = draft?.coverCandidates.map((c) => c.url) ?? [];
  return {
    details: {
      title: book.title,
      subtitle: book.subtitle,
      authors: book.authors,
      publisher: book.publisher,
      publishedYear: book.publishedYear,
      pages: book.pages,
      language: book.language,
      series: book.series,
      seriesNumber: book.seriesNumber,
      description: book.description,
      subjects: book.subjects,
      isbn13: book.isbn13,
      barcode: book.barcode,
      metadataSource: book.metadataSource,
    },
    origin: "copy",
    cover: book.hasCover
      ? { kind: "copy", fromId: book.id, coverUpdatedAt: book.coverUpdatedAt }
      : candidates.length > 0
        ? { kind: "candidates", urls: candidates }
        : { kind: "none" },
  };
}

/** The copy saved last, of those a lookup found: the one "Open the book" opens. */
export function newestCopy(owned: LookupResponse["owned"]): LookupResponse["owned"][number] | null {
  return owned.reduce<LookupResponse["owned"][number] | null>((a, b) => (a === null || b.createdAt > a.createdAt ? b : a), null);
}

/**
 * "Add another copy": the newest saved copy's details when the library has
 * it, else the draft's; `null` when neither is known (the form opens).
 */
export function copyProposal(lookup: LookupResponse, books: readonly Book[]): Proposal | null {
  const newest = newestCopy(lookup.owned);
  const saved = newest === null ? undefined : books.find((book) => book.id === newest.id);
  if (saved) return proposalFromBook(saved, lookup.draft);
  const { draft } = lookup;
  if (draft?.title) return { ...proposalFromDraft({ ...draft, title: draft.title }), origin: "copy" };
  return null;
}

/**
 * The create body for a confirmed proposal. On the wishlist there is no
 * shelf: the caller passes `null`, and `collection: "wishlist"` is sent.
 */
export function bodyFromProposal(proposal: Proposal, shelf: string | null, status: Status, collection: Collection = "owned"): BookCreate {
  return { ...proposal.details, shelf, status, ...(collection === "wishlist" ? { collection } : {}) };
}

/** The wishlisted copy "I bought it" moves: the first one a lookup found. */
export function wishlistedCopy(lookup: LookupResponse): LookupResponse["wishlisted"][number] | null {
  return lookup.wishlisted[0] ?? null;
}

/** Today as `YYYY-MM-DD` in the owner's own day: the `acquiredOn` of a book just bought. */
export function todayIso(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** The create body for the form: its fields over the details it doesn't show. */
export function bodyFromForm(fields: FormFields, base: FormBase): BookCreate {
  return {
    ...base.details,
    title: fields.title,
    subtitle: fields.subtitle,
    authors: fields.authors,
    publisher: fields.publisher,
    publishedYear: fields.publishedYear,
    isbn13: fields.isbn13,
    shelf: fields.shelf,
    status: fields.status,
  };
}

function initialFromDetails(details: Partial<Details>, extra: Partial<FormInitial> = {}): FormInitial {
  return {
    ...EMPTY_FORM,
    shelf: undefined,
    title: details.title ?? "",
    subtitle: details.subtitle ?? "",
    author: joinAuthors(details.authors ?? []),
    publisher: details.publisher ?? "",
    year: details.publishedYear ? String(details.publishedYear) : "",
    isbn: details.isbn13 ?? "",
    ...extra,
  };
}

/** The details a form keeps but doesn't show: everything but its own fields. */
function hiddenDetails(details: Partial<Details>): Partial<Details> {
  const { title: _title, subtitle: _subtitle, authors: _authors, publisher: _publisher, publishedYear: _year, isbn13: _isbn, ...rest } =
    details;
  return rest;
}

// --- The machine ----------------------------------------------------------------

/** The step a lookup's answer leads to. Already owned wins over wishlisted, and both win over found. */
function answered(lookup: LookupResponse, id: number, shelf?: string | null): Step {
  const chosen: Partial<FormInitial> = shelf === undefined ? {} : { shelf };
  if (lookup.owned.length > 0) return { kind: "owned", id, lookup };
  if (lookup.wishlisted.length > 0) return { kind: "wishlisted", id, lookup, save: IDLE };
  const { draft } = lookup;
  if (draft !== null && draft.title) {
    const found: Step = { kind: "found", id, lookup, proposal: proposalFromDraft({ ...draft, title: draft.title }), save: IDLE };
    return shelf === undefined ? found : { ...found, shelf };
  }
  if (draft !== null) {
    const { details, cover } = proposalFromDraft({ ...draft, title: "" });
    return {
      kind: "form",
      id,
      reason: "untitled",
      lookup,
      initial: initialFromDetails(details, chosen),
      base: { details: hiddenDetails(details), cover },
      save: IDLE,
    };
  }
  return {
    kind: "form",
    id,
    reason: "not-found",
    lookup,
    initial: initialFromDetails({ isbn13: lookup.isbn13 }, chosen),
    base: NO_BASE,
    save: IDLE,
  };
}

export function flowReducer(state: FlowState, event: FlowEvent): FlowState {
  const next = reduce(state, event);
  if (next === state) return state;
  if (event.type === "open-queued") return { ...next, queued: next.step === state.step ? state.queued : event.id };
  // Still the same sheet (a save in flight, a failure), or one it leads to on the same scan.
  const same = next.step.id === state.step.id || event.type === "edit" || event.type === "another-copy";
  return same || next.queued === null ? next : { ...next, queued: null };
}

function reduce(state: FlowState, event: FlowEvent): FlowState {
  const { step } = state;
  const id = state.next;
  const go = (next: Step, extra: Partial<FlowState> = {}): FlowState => ({ ...state, ...extra, step: next, next: id + 1 });
  const saving = isSaving(step);

  switch (event.type) {
    case "mode":
      if (event.mode === state.mode) return state;
      // Leaving a mode drops its unsaved result; a save in flight still lands and counts.
      return go(restingStep(event.mode, id), { mode: event.mode });

    case "scanned": {
      if (state.mode !== "scan" || step.kind !== "ready") return state;
      const { code, known } = event;
      if (code.kind !== "isbn") return go({ kind: "other", id, code: code.code });
      return go(known ? answered(known, id) : { kind: "looking", id, isbn13: code.isbn13 });
    }

    case "submit-isbn":
      if (saving || state.mode === "manual") return state;
      if (state.mode === "scan" && step.kind !== "typing") return state;
      // A double read from a USB scanner, or Enter pressed again: the answer is already here.
      if (currentIsbn(step) === event.isbn13 && step.kind !== "failed" && step.kind !== "offline") return state;
      return go(event.known ? answered(event.known, id) : { kind: "looking", id, isbn13: event.isbn13 });

    case "looked-up":
      if (step.kind !== "looking" || step.id !== event.id) return state;
      return go(answered(event.lookup, id));

    case "lookup-failed":
      if (step.kind !== "looking" || step.id !== event.id) return state;
      return go({ kind: "failed", id, isbn13: step.isbn13, failure: event.failure });

    case "answered-offline":
      if (step.kind !== "looking" || step.id !== event.id) return state;
      return go({ kind: "offline", id, isbn13: step.isbn13, answer: event.answer });

    case "retry":
      if (step.kind === "failed" || step.kind === "offline") return go({ kind: "looking", id, isbn13: step.isbn13 });
      if (step.kind === "form" && step.reason === "not-found" && step.lookup && !saving) {
        return go({ kind: "looking", id, isbn13: step.lookup.isbn13 });
      }
      return state;

    case "queued": {
      const notice: Notice = { id: id + 1, kind: "queued", isbn13: event.isbn13, outcome: event.outcome };
      const waiting = (step.kind === "offline" || step.kind === "failed") && step.isbn13 === event.isbn13;
      // Kept (or already kept): the sheet is done and the scanner reads the next book. Not kept: the sheet stays.
      if (event.outcome === "failed" || !waiting) return { ...state, notice: { ...notice, id }, next: id + 1 };
      return { ...state, step: restingStep(state.mode, id), notice, next: id + 2 };
    }

    case "show-queue":
      if (step.kind !== "ready") return state;
      return go({ kind: "queue", id });

    case "open-queued": {
      if (step.kind !== "queue" && step.kind !== "ready") return state;
      if (event.lookup !== null) return go(answered(event.lookup, id, event.shelf));
      return go({
        kind: "form",
        id,
        reason: "failed",
        lookup: null,
        initial: initialFromDetails({ isbn13: event.isbn13 }, { shelf: event.shelf }),
        base: NO_BASE,
        save: IDLE,
      });
    }

    case "type-isbn":
      if (step.kind !== "other") return state;
      return go({ kind: "typing", id, code: step.code });

    case "by-hand":
      if (step.kind === "other" || step.kind === "typing") {
        return go({
          kind: "form",
          id,
          reason: "barcode",
          lookup: null,
          initial: initialFromDetails({}),
          base: { details: { barcode: step.code }, cover: { kind: "none" } },
          save: IDLE,
        });
      }
      if (step.kind === "failed") {
        return go({
          kind: "form",
          id,
          reason: "failed",
          lookup: null,
          initial: initialFromDetails({ isbn13: step.isbn13 }),
          base: NO_BASE,
          save: IDLE,
        });
      }
      return state;

    case "edit":
      if (step.kind !== "found" || saving) return state;
      return go({
        kind: "form",
        id,
        reason: "edit",
        lookup: step.lookup,
        initial: initialFromDetails(step.proposal.details, { shelf: event.shelf, status: event.status }),
        base: { details: hiddenDetails(step.proposal.details), cover: step.proposal.cover },
        save: IDLE,
      });

    case "another-copy":
      if (step.kind !== "owned") return state;
      if (event.proposal !== null) {
        return go({ kind: "found", id, lookup: step.lookup, proposal: event.proposal, save: IDLE });
      }
      return go({
        kind: "form",
        id,
        reason: "copy",
        lookup: step.lookup,
        initial: initialFromDetails({ isbn13: step.lookup.isbn13 }),
        base: NO_BASE,
        save: IDLE,
      });

    case "discard":
      if (saving || (step.kind === "form" && step.reason === "manual")) return state;
      return go(restingStep(state.mode, id));

    case "save":
      if ((step.kind !== "found" && step.kind !== "form" && step.kind !== "wishlisted") || saving) return state;
      return { ...state, step: { ...step, save: { saving: true, failure: null } } };

    case "saved": {
      // Counted even when the owner has moved on: the book is in the library.
      const { outcome } = event;
      const counted: Partial<FlowState> = {
        added: state.added + 1,
        // A wishlist book has no shelf: the next book keeps defaulting to the last real one.
        lastShelf: outcome === "wishlist" ? state.lastShelf : event.book.shelf,
        notice: { id, kind: "saved", bookId: event.book.id, title: event.book.title, outcome },
      };
      if (!saving) return { ...state, ...counted, next: id + 1 };
      // The resting step and the notice each take an id, the notice's the newer.
      return {
        ...state,
        ...counted,
        notice: { id: id + 1, kind: "saved", bookId: event.book.id, title: event.book.title, outcome },
        step: restingStep(state.mode, id),
        next: id + 2,
      };
    }

    case "save-failed":
      if (!saving || (step.kind !== "found" && step.kind !== "form" && step.kind !== "wishlisted")) return state;
      return { ...state, step: { ...step, save: { saving: false, failure: event.failure } } };

    case "cover-failed":
      return { ...state, notice: { id, kind: "cover-failed", bookId: event.book.id, title: event.book.title }, next: id + 1 };

    case "dismiss-notice":
      if (state.notice?.id !== event.id) return state;
      return { ...state, notice: null };
  }
}
