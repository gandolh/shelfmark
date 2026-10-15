import {
  draftMetadataSource,
  type Book,
  type BookCreate,
  type Draft,
  type DraftSource,
  type LookupResponse,
  type Status,
} from "@shelfmark/shared";
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
  origin: DraftSource | "copy";
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
 * - `owned`: the ISBN is already in the library.
 * - `found`: a draft (or another copy) to confirm with a shelf and a status.
 * - `form`: the by-hand form.
 */
export type Step =
  | { kind: "ready"; id: number }
  | { kind: "typing"; id: number; code: string }
  | { kind: "looking"; id: number; isbn13: string }
  | { kind: "other"; id: number; code: string }
  | { kind: "failed"; id: number; isbn13: string; failure: Failure }
  | { kind: "owned"; id: number; lookup: LookupResponse }
  | { kind: "found"; id: number; lookup: LookupResponse | null; proposal: Proposal; save: SaveState }
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
  | { id: number; kind: "saved"; bookId: number; title: string }
  | { id: number; kind: "cover-failed"; bookId: number; title: string };

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
}

export type FlowEvent =
  | { type: "mode"; mode: Mode }
  | { type: "scanned"; code: ScannedCode }
  | { type: "submit-isbn"; isbn13: string }
  | { type: "looked-up"; id: number; lookup: LookupResponse }
  | { type: "lookup-failed"; id: number; failure: Failure }
  | { type: "retry" }
  | { type: "type-isbn" }
  | { type: "by-hand" }
  | { type: "edit"; shelf: string | null; status: Status }
  | { type: "another-copy"; proposal: Proposal | null }
  | { type: "discard" }
  | { type: "save" }
  | { type: "saved"; book: { id: number; title: string; shelf: string | null } }
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
  };
}

/** The step a mode rests in: a blank form By hand, nothing otherwise. */
function restingStep(mode: Mode, id: number): Step {
  if (mode !== "manual") return { kind: "ready", id };
  return { kind: "form", id, reason: "manual", lookup: null, initial: { ...EMPTY_FORM, shelf: undefined }, base: NO_BASE, save: IDLE };
}

const NO_BASE: FormBase = { details: {}, cover: { kind: "none" } };

/** The scanner reads only while nothing is on the sheet: after a save it is live again with no extra tap. */
export function scannerPaused(state: FlowState): boolean {
  return state.mode !== "scan" || state.step.kind !== "ready";
}

/** True while a save is in flight: the sheet's buttons wait. */
export function isSaving(step: Step): boolean {
  return (step.kind === "found" || step.kind === "form") && step.save.saving;
}

/** The ISBN the sheet is about, if any: Enter on the same ISBN again does nothing. */
export function currentIsbn(step: Step): string | null {
  switch (step.kind) {
    case "looking":
      return step.isbn13;
    case "owned":
      return step.lookup.isbn13;
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
      metadataSource: draftMetadataSource(draft.source),
    },
    origin: draft.source,
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

/** The create body for a confirmed proposal. */
export function bodyFromProposal(proposal: Proposal, shelf: string | null, status: Status): BookCreate {
  return { ...proposal.details, shelf, status };
}

/** The create body for the form: its fields over the details it doesn't show. */
export function bodyFromForm(fields: FormFields, base: FormBase): BookCreate {
  return {
    ...base.details,
    title: fields.title,
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
    author: joinAuthors(details.authors ?? []),
    publisher: details.publisher ?? "",
    year: details.publishedYear ? String(details.publishedYear) : "",
    isbn: details.isbn13 ?? "",
    ...extra,
  };
}

/** The details a form keeps but doesn't show: everything but its own fields. */
function hiddenDetails(details: Partial<Details>): Partial<Details> {
  const { title: _title, authors: _authors, publisher: _publisher, publishedYear: _year, isbn13: _isbn, ...rest } = details;
  return rest;
}

// --- The machine ----------------------------------------------------------------

/** The step a lookup's answer leads to. Already owned wins over found. */
function answered(lookup: LookupResponse, id: number): Step {
  if (lookup.owned.length > 0) return { kind: "owned", id, lookup };
  const { draft } = lookup;
  if (draft !== null && draft.title) {
    return { kind: "found", id, lookup, proposal: proposalFromDraft({ ...draft, title: draft.title }), save: IDLE };
  }
  if (draft !== null) {
    const { details, cover } = proposalFromDraft({ ...draft, title: "" });
    return {
      kind: "form",
      id,
      reason: "untitled",
      lookup,
      initial: initialFromDetails(details),
      base: { details: hiddenDetails(details), cover },
      save: IDLE,
    };
  }
  return {
    kind: "form",
    id,
    reason: "not-found",
    lookup,
    initial: initialFromDetails({ isbn13: lookup.isbn13 }),
    base: NO_BASE,
    save: IDLE,
  };
}

export function flowReducer(state: FlowState, event: FlowEvent): FlowState {
  const { step } = state;
  const id = state.next;
  const go = (next: Step, extra: Partial<FlowState> = {}): FlowState => ({ ...state, ...extra, step: next, next: id + 1 });
  const saving = isSaving(step);

  switch (event.type) {
    case "mode":
      if (event.mode === state.mode) return state;
      // Leaving a mode drops its unsaved result; a save in flight still lands and counts.
      return go(restingStep(event.mode, id), { mode: event.mode });

    case "scanned":
      if (state.mode !== "scan" || step.kind !== "ready") return state;
      return event.code.kind === "isbn"
        ? go({ kind: "looking", id, isbn13: event.code.isbn13 })
        : go({ kind: "other", id, code: event.code.code });

    case "submit-isbn":
      if (saving || state.mode === "manual") return state;
      if (state.mode === "scan" && step.kind !== "typing") return state;
      // A double read from a USB scanner, or Enter pressed again: the answer is already here.
      if (currentIsbn(step) === event.isbn13 && step.kind !== "failed") return state;
      return go({ kind: "looking", id, isbn13: event.isbn13 });

    case "looked-up":
      if (step.kind !== "looking" || step.id !== event.id) return state;
      return go(answered(event.lookup, id));

    case "lookup-failed":
      if (step.kind !== "looking" || step.id !== event.id) return state;
      return go({ kind: "failed", id, isbn13: step.isbn13, failure: event.failure });

    case "retry":
      if (step.kind === "failed") return go({ kind: "looking", id, isbn13: step.isbn13 });
      if (step.kind === "form" && step.reason === "not-found" && step.lookup && !saving) {
        return go({ kind: "looking", id, isbn13: step.lookup.isbn13 });
      }
      return state;

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
      if ((step.kind !== "found" && step.kind !== "form") || saving) return state;
      return { ...state, step: { ...step, save: { saving: true, failure: null } } };

    case "saved": {
      // Counted even when the owner has moved on: the book is in the library.
      const counted: Partial<FlowState> = {
        added: state.added + 1,
        lastShelf: event.book.shelf,
        notice: { id, kind: "saved", bookId: event.book.id, title: event.book.title },
      };
      if (!saving) return { ...state, ...counted, next: id + 1 };
      // The resting step and the notice each take an id, the notice's the newer.
      return {
        ...state,
        ...counted,
        notice: { id: id + 1, kind: "saved", bookId: event.book.id, title: event.book.title },
        step: restingStep(state.mode, id),
        next: id + 2,
      };
    }

    case "save-failed":
      if (!saving || (step.kind !== "found" && step.kind !== "form")) return state;
      return { ...state, step: { ...step, save: { saving: false, failure: event.failure } } };

    case "cover-failed":
      return { ...state, notice: { id, kind: "cover-failed", bookId: event.book.id, title: event.book.title }, next: id + 1 };

    case "dismiss-notice":
      if (state.notice?.id !== event.id) return state;
      return { ...state, notice: null };
  }
}
