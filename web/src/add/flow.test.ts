import type { Book, Draft, LookupResponse } from "@shelfmark/shared";
import { describe, expect, it } from "vitest";
import {
  bodyFromForm,
  bodyFromProposal,
  copyProposal,
  currentIsbn,
  flowReducer,
  initialFlow,
  newestCopy,
  proposalFromBook,
  proposalFromDraft,
  isSaving,
  scannerPaused,
  todayIso,
  type FlowEvent,
  type FlowState,
  type Mode,
  type Step,
} from "./flow";
import type { OfflineAnswer } from "../offline/library";
import { readForm } from "./form";

const HOBBIT = "9780547928227";
const ISIDOR = "9786063205583";

function draft(extra: Partial<Draft> = {}): Draft {
  return {
    isbn13: HOBBIT,
    title: "The Hobbit",
    subtitle: null,
    authors: ["J. R. R. Tolkien"],
    publisher: "Houghton Mifflin Harcourt",
    publishedYear: 2012,
    pages: 300,
    language: "en",
    description: null,
    subjects: ["Fantasy"],
    coverCandidates: [{ url: "https://covers.openlibrary.org/b/id/1-L.jpg", source: "openlibrary" }],
    sources: ["openlibrary"],
    ...extra,
  };
}

function lookup(extra: Partial<LookupResponse> = {}): LookupResponse {
  return {
    isbn13: HOBBIT,
    draft: draft(),
    tried: [{ source: "openlibrary", outcome: "found" }],
    owned: [],
    wishlisted: [],
    ...extra,
  };
}

const NOT_FOUND = lookup({
  isbn13: ISIDOR,
  draft: null,
  tried: [
    { source: "openlibrary", outcome: "not_found" },
    { source: "googlebooks", outcome: "skipped_no_key" },
  ],
});

const WISHLISTED = lookup({ wishlisted: [{ id: 21 }] });

const OWNED = lookup({ owned: [{ id: 7, shelf: "Living room · A3", createdAt: "2026-03-03T10:00:00.000Z" }] });

function book(extra: Partial<Book> = {}): Book {
  return {
    id: 7,
    isbn13: HOBBIT,
    barcode: null,
    title: "The Hobbit, or There and Back Again",
    subtitle: null,
    authors: ["J. R. R. Tolkien"],
    authorSort: "Tolkien, J. R. R.",
    publisher: "Houghton Mifflin Harcourt",
    publishedYear: 2012,
    pages: 300,
    language: "en",
    series: null,
    seriesNumber: null,
    description: null,
    subjects: [],
    collection: "owned",
    format: "paperback",
    condition: "good",
    shelf: "Living room · A3",
    signed: false,
    status: "read",
    rating: 5,
    notes: "A gift",
    acquiredOn: null,
    acquiredFrom: null,
    priceMinor: null,
    currency: "RON",
    metadataSource: "openlibrary",
    tags: ["Favourite"],
    hasCover: true,
    coverUpdatedAt: "2026-03-04T08:00:00.000Z",
    createdAt: "2026-03-03T10:00:00.000Z",
    updatedAt: "2026-03-03T10:00:00.000Z",
    ...extra,
  };
}

/** Run events in order from a fresh flow. */
function run(mode: Mode, ...events: FlowEvent[]): FlowState {
  return events.reduce(flowReducer, initialFlow(mode));
}

function expectStep<K extends Step["kind"]>(state: FlowState, kind: K): Extract<Step, { kind: K }> {
  expect(state.step.kind).toBe(kind);
  return state.step as Extract<Step, { kind: K }>;
}

const scanIsbn = (isbn13: string): FlowEvent => ({ type: "scanned", code: { kind: "isbn", isbn13 } });

/** Scan an ISBN and answer its lookup. */
function scanAndAnswer(answer: LookupResponse, mode: Mode = "scan"): FlowState {
  const first =
    mode === "scan" ? run("scan", scanIsbn(answer.isbn13)) : run(mode, { type: "submit-isbn", isbn13: answer.isbn13 });
  const looking = expectStep(first, "looking");
  return flowReducer(first, { type: "looked-up", id: looking.id, lookup: answer });
}

describe("the scan flow", () => {
  it("starts scanning, with the scanner live", () => {
    const state = initialFlow("scan");
    expect(state.step.kind).toBe("ready");
    expect(scannerPaused(state)).toBe(false);
    expect(state.added).toBe(0);
  });

  it("scan → found → save → scanning again with no extra tap", () => {
    let state = run("scan", scanIsbn(HOBBIT));
    expect(expectStep(state, "looking").isbn13).toBe(HOBBIT);
    // The result is the owner's: the camera reads again only once they act on it.
    expect(scannerPaused(state)).toBe(true);

    state = flowReducer(state, { type: "looked-up", id: state.step.id, lookup: lookup() });
    const found = expectStep(state, "found");
    expect(found.proposal.origin).toEqual(["openlibrary"]);
    expect(scannerPaused(state)).toBe(true);

    state = flowReducer(state, { type: "save" });
    expect(expectStep(state, "found").save).toEqual({ saving: true, failure: null });
    expect(scannerPaused(state)).toBe(true);

    state = flowReducer(state, { type: "saved", book: { id: 12, title: "The Hobbit", shelf: "Study · B1" } });
    expect(state.step.kind).toBe("ready");
    expect(scannerPaused(state)).toBe(false);
    expect(state.added).toBe(1);
    expect(state.lastShelf).toBe("Study · B1");
    expect(state.notice).toMatchObject({ kind: "saved", bookId: 12, title: "The Hobbit" });
  });

  it("ignores codes while a sheet is open, and in the other modes", () => {
    const found = scanAndAnswer(lookup());
    expect(flowReducer(found, scanIsbn(ISIDOR))).toBe(found);
    expect(flowReducer(run("scan", { type: "scanned", code: { kind: "other", code: "2000000000008" } }), scanIsbn(ISIDOR)).step.kind).toBe("other");
    const typing = initialFlow("isbn");
    expect(flowReducer(typing, scanIsbn(ISIDOR))).toBe(typing);
  });

  it("not found → the form with the ISBN filled in → save", () => {
    let state = scanAndAnswer(NOT_FOUND);
    const form = expectStep(state, "form");
    expect(form.reason).toBe("not-found");
    expect(form.initial.isbn).toBe(ISIDOR);
    expect(form.initial.title).toBe("");
    expect(form.base.cover).toEqual({ kind: "none" });

    state = flowReducer(state, { type: "save" });
    expect(expectStep(state, "form").save.saving).toBe(true);
    state = flowReducer(state, { type: "saved", book: { id: 13, title: "O vară cu Isidor", shelf: null } });
    expect(state.step.kind).toBe("ready");
    expect(state.added).toBe(1);
    expect(state.lastShelf).toBeNull();
  });

  it("a draft without a title opens the form with what was found", () => {
    const state = scanAndAnswer(lookup({ draft: draft({ title: null, publisher: "Polirom" }) }));
    const form = expectStep(state, "form");
    expect(form.reason).toBe("untitled");
    expect(form.initial.publisher).toBe("Polirom");
    expect(form.base.cover.kind).toBe("candidates");
    expect(form.base.details).toMatchObject({ pages: 300, language: "en", metadataSource: "openlibrary" });
  });

  it("a wishlisted book (no owned copy) gets its own step, with “I bought it” saving through it", () => {
    let state = scanAndAnswer(WISHLISTED);
    expect(expectStep(state, "wishlisted").lookup.wishlisted).toEqual([{ id: 21 }]);
    expect(currentIsbn(state.step)).toBe(HOBBIT);

    state = flowReducer(state, { type: "save" });
    expect(isSaving(state.step)).toBe(true);
    state = flowReducer(state, { type: "save-failed", failure: { message: "no", network: false } });
    expect(expectStep(state, "wishlisted").save).toEqual({ saving: false, failure: { message: "no", network: false } });

    state = flowReducer(state, { type: "save" });
    state = flowReducer(state, { type: "saved", book: { id: 21, title: "The Hobbit", shelf: "Bedroom" }, outcome: "bought" });
    expect(state.step.kind).toBe("ready");
    expect(state.lastShelf).toBe("Bedroom");
    expect(state.notice).toMatchObject({ kind: "saved", bookId: 21, outcome: "bought" });
  });

  it("an owned copy leads over a wishlisted one", () => {
    const both = lookup({ owned: OWNED.owned, wishlisted: [{ id: 21 }] });
    expectStep(scanAndAnswer(both), "owned");
  });

  it("a wishlist save keeps the default shelf, and its body has the wishlist and no shelf", () => {
    let state = scanAndAnswer(lookup());
    state = flowReducer(state, { type: "save" });
    state = flowReducer(state, { type: "saved", book: { id: 30, title: "The Hobbit", shelf: null }, outcome: "wishlist" });
    expect(state.lastShelf).toBeUndefined();
    expect(state.added).toBe(1);
    const proposal = proposalFromDraft({ ...draft(), title: "The Hobbit" });
    expect(bodyFromProposal(proposal, null, "unread", "wishlist")).toMatchObject({ collection: "wishlist", shelf: null, status: "unread" });
    expect(bodyFromProposal(proposal, "A", "unread")).not.toHaveProperty("collection");
  });

  it("todayIso is the local calendar day", () => {
    expect(todayIso(new Date(2026, 9, 3, 23, 59))).toBe("2026-10-03");
  });

  it("already owned wins over found, then offers another copy", () => {
    let state = scanAndAnswer(OWNED);
    expect(expectStep(state, "owned").lookup.owned).toHaveLength(1);

    state = flowReducer(state, { type: "another-copy", proposal: proposalFromBook(book(), OWNED.draft) });
    const found = expectStep(state, "found");
    expect(found.proposal.origin).toBe("copy");
    // With the first copy's cover version, so the copy is of the cover it has now.
    expect(found.proposal.cover).toEqual({ kind: "copy", fromId: 7, coverUpdatedAt: "2026-03-04T08:00:00.000Z" });

    state = flowReducer(state, { type: "save" });
    state = flowReducer(state, { type: "saved", book: { id: 14, title: "The Hobbit", shelf: "Bedroom" } });
    expect(state.step.kind).toBe("ready");
    expect(state.added).toBe(1);
  });

  it("another copy with nothing to copy from opens the form with the ISBN", () => {
    const state = flowReducer(scanAndAnswer(OWNED), { type: "another-copy", proposal: null });
    const form = expectStep(state, "form");
    expect(form.reason).toBe("copy");
    expect(form.initial.isbn).toBe(HOBBIT);
  });

  it("“Scan the next one” after already owned goes back to scanning", () => {
    const state = flowReducer(scanAndAnswer(OWNED), { type: "discard" });
    expect(state.step.kind).toBe("ready");
    expect(scannerPaused(state)).toBe(false);
    expect(state.added).toBe(0);
  });
});

describe("an answer the page already has", () => {
  it("shows at once, from the camera or typed, with no lookup step", () => {
    const scanned = run("scan", { type: "scanned", code: { kind: "isbn", isbn13: HOBBIT }, known: lookup() });
    expect(expectStep(scanned, "found").proposal.details.title).toBe("The Hobbit");
    const typed = run("isbn", { type: "submit-isbn", isbn13: HOBBIT, known: OWNED });
    expectStep(typed, "owned");
  });

  it("still waits for the owner: a result on the sheet ignores the camera", () => {
    const found = scanAndAnswer(lookup());
    expect(flowReducer(found, { type: "scanned", code: { kind: "isbn", isbn13: ISIDOR }, known: NOT_FOUND })).toBe(found);
  });
});

describe("a barcode that isn't an ISBN", () => {
  const other: FlowEvent = { type: "scanned", code: { kind: "other", code: "2001234567890" } };

  it("says so, and can type the ISBN in the sheet", () => {
    let state = run("scan", other);
    expect(expectStep(state, "other").code).toBe("2001234567890");
    expect(scannerPaused(state)).toBe(true);

    state = flowReducer(state, { type: "type-isbn" });
    expect(state.mode).toBe("scan");
    expectStep(state, "typing");
    expect(scannerPaused(state)).toBe(true);

    state = flowReducer(state, { type: "submit-isbn", isbn13: HOBBIT });
    expect(expectStep(state, "looking").isbn13).toBe(HOBBIT);
  });

  it("adds by hand, keeping the code as the book's barcode", () => {
    const state = run("scan", other, { type: "by-hand" });
    const form = expectStep(state, "form");
    expect(form.reason).toBe("barcode");
    expect(form.base.details.barcode).toBe("2001234567890");
    expect(form.initial.isbn).toBe("");

    const read = readForm({ ...form.initial, title: "Caiet", shelf: null });
    if (!read.ok) throw new Error("form should read");
    expect(bodyFromForm(read.fields, form.base)).toMatchObject({ title: "Caiet", barcode: "2001234567890", isbn13: null });
  });

  it("by hand from the ISBN sheet keeps the code too", () => {
    const state = run("scan", other, { type: "type-isbn" }, { type: "by-hand" });
    expect(expectStep(state, "form").base.details.barcode).toBe("2001234567890");
  });
});

describe("discarding", () => {
  it.each<[string, FlowState]>([
    ["a lookup in flight", run("scan", scanIsbn(HOBBIT))],
    ["a found book", scanAndAnswer(lookup())],
    ["a miss", scanAndAnswer(NOT_FOUND)],
    ["a non-ISBN code", run("scan", { type: "scanned", code: { kind: "other", code: "x" } })],
    ["the ISBN sheet", run("scan", { type: "scanned", code: { kind: "other", code: "x" } }, { type: "type-isbn" })],
  ])("drops %s and scans again", (_name, state) => {
    const next = flowReducer(state, { type: "discard" });
    expect(next.step.kind).toBe("ready");
    expect(next.step.id).not.toBe(state.step.id);
    expect(scannerPaused(next)).toBe(false);
  });

  it("drops a failed lookup", () => {
    const looking = run("scan", scanIsbn(HOBBIT));
    const failed = flowReducer(looking, { type: "lookup-failed", id: looking.step.id, failure: { message: "x", network: true } });
    expect(flowReducer(failed, { type: "discard" }).step.kind).toBe("ready");
  });

  it("waits while a save is in flight", () => {
    const saving = flowReducer(scanAndAnswer(lookup()), { type: "save" });
    expect(flowReducer(saving, { type: "discard" })).toBe(saving);
  });

  it("drops a found book in Type ISBN, back to the empty field", () => {
    const state = flowReducer(scanAndAnswer(lookup(), "isbn"), { type: "discard" });
    expect(state.mode).toBe("isbn");
    expect(state.step.kind).toBe("ready");
  });
});

describe("lookup failures", () => {
  it("shows the failure, and retries under a new id", () => {
    let state = run("isbn", { type: "submit-isbn", isbn13: HOBBIT });
    const first = expectStep(state, "looking").id;
    state = flowReducer(state, { type: "lookup-failed", id: first, failure: { message: "offline", network: true } });
    expect(expectStep(state, "failed").failure).toEqual({ message: "offline", network: true });

    state = flowReducer(state, { type: "retry" });
    const again = expectStep(state, "looking");
    expect(again.isbn13).toBe(HOBBIT);
    expect(again.id).not.toBe(first);

    // The first request's late answer is not this one's.
    expect(flowReducer(state, { type: "looked-up", id: first, lookup: lookup() })).toBe(state);
    state = flowReducer(state, { type: "looked-up", id: again.id, lookup: lookup() });
    expect(state.step.kind).toBe("found");
  });

  it("drops an answer that comes after a discard", () => {
    const looking = run("scan", scanIsbn(HOBBIT));
    const discarded = flowReducer(looking, { type: "discard" });
    expect(flowReducer(discarded, { type: "looked-up", id: looking.step.id, lookup: lookup() })).toBe(discarded);
    expect(flowReducer(discarded, { type: "lookup-failed", id: looking.step.id, failure: { message: "x", network: false } })).toBe(
      discarded,
    );
  });

  it("adds by hand after a failure, with the ISBN filled in", () => {
    const looking = run("scan", scanIsbn(ISIDOR));
    const failed = flowReducer(looking, { type: "lookup-failed", id: looking.step.id, failure: { message: "x", network: false } });
    const form = expectStep(flowReducer(failed, { type: "by-hand" }), "form");
    expect(form.reason).toBe("failed");
    expect(form.initial.isbn).toBe(ISIDOR);
  });

  it("looks a miss up again when a source errored", () => {
    const state = flowReducer(scanAndAnswer(NOT_FOUND), { type: "retry" });
    expect(expectStep(state, "looking").isbn13).toBe(ISIDOR);
  });
});

describe("the offline answer", () => {
  const answer: OfflineAnswer = {
    kind: "owned",
    copies: [{ isbn13: HOBBIT, title: "The Hobbit", shelf: "Living room · A2", collection: "owned" }],
    savedAt: "2026-10-22T10:00:00.000Z",
  };

  it("replaces a lookup that couldn't reach the server, and a late one is dropped", () => {
    const looking = run("scan", scanIsbn(HOBBIT));
    const id = expectStep(looking, "looking").id;
    const done = flowReducer(looking, { type: "answered-offline", id, answer });
    expect(expectStep(done, "offline")).toMatchObject({ isbn13: HOBBIT, answer });
    expect(currentIsbn(done.step)).toBe(HOBBIT);
    expect(flowReducer(done, { type: "answered-offline", id, answer })).toBe(done);
    expect(flowReducer(looking, { type: "answered-offline", id: id + 9, answer })).toBe(looking);
  });

  it("looks again on retry, and lets the same ISBN be submitted again", () => {
    const looking = run("isbn", { type: "submit-isbn", isbn13: HOBBIT });
    const done = flowReducer(looking, { type: "answered-offline", id: expectStep(looking, "looking").id, answer });
    expect(expectStep(flowReducer(done, { type: "retry" }), "looking").isbn13).toBe(HOBBIT);
    expect(expectStep(flowReducer(done, { type: "submit-isbn", isbn13: HOBBIT }), "looking").isbn13).toBe(HOBBIT);
  });

  it("is left by discard like any result", () => {
    const looking = run("scan", scanIsbn(HOBBIT));
    const done = flowReducer(looking, { type: "answered-offline", id: expectStep(looking, "looking").id, answer });
    expect(flowReducer(done, { type: "discard" }).step.kind).toBe("ready");
  });
});

describe("saving", () => {
  it("keeps the sheet and says why when a save fails, then saves on the second try", () => {
    let state = flowReducer(scanAndAnswer(lookup()), { type: "save" });
    const id = state.step.id;
    state = flowReducer(state, { type: "save-failed", failure: { message: "Not saved: offline", network: true } });
    const found = expectStep(state, "found");
    expect(found.id).toBe(id); // the same sheet, so the owner's choices stay
    expect(found.save).toEqual({ saving: false, failure: { message: "Not saved: offline", network: true } });
    expect(state.added).toBe(0);

    state = flowReducer(state, { type: "save" });
    expect(expectStep(state, "found").save).toEqual({ saving: true, failure: null });
    state = flowReducer(state, { type: "saved", book: { id: 15, title: "The Hobbit", shelf: null } });
    expect(state.added).toBe(1);
  });

  it("ignores a second save while one is in flight", () => {
    const saving = flowReducer(scanAndAnswer(lookup()), { type: "save" });
    expect(flowReducer(saving, { type: "save" })).toBe(saving);
  });

  it("counts a save that lands after the owner switched modes", () => {
    let state = flowReducer(scanAndAnswer(lookup()), { type: "save" });
    state = flowReducer(state, { type: "mode", mode: "manual" });
    const form = expectStep(state, "form");
    state = flowReducer(state, { type: "saved", book: { id: 16, title: "The Hobbit", shelf: null } });
    expect(state.added).toBe(1);
    expect(state.step).toBe(form); // the blank form the owner moved to stays
  });

  it("reports a cover that didn't download without undoing the save", () => {
    let state = scanAndAnswer(lookup());
    state = flowReducer(flowReducer(state, { type: "save" }), {
      type: "saved",
      book: { id: 17, title: "The Hobbit", shelf: null },
    });
    state = flowReducer(state, { type: "cover-failed", book: { id: 17, title: "The Hobbit" } });
    expect(state.notice).toMatchObject({ kind: "cover-failed", bookId: 17 });
    expect(state.added).toBe(1);
    expect(state.step.kind).toBe("ready");
  });

  it("dismisses only the notice it was asked to", () => {
    let state = flowReducer(flowReducer(scanAndAnswer(lookup()), { type: "save" }), {
      type: "saved",
      book: { id: 18, title: "The Hobbit", shelf: null },
    });
    const notice = state.notice!;
    state = flowReducer(state, { type: "cover-failed", book: { id: 18, title: "The Hobbit" } });
    expect(flowReducer(state, { type: "dismiss-notice", id: notice.id })).toBe(state);
    expect(flowReducer(state, { type: "dismiss-notice", id: state.notice!.id }).notice).toBeNull();
  });
});

describe("Edit details", () => {
  it("opens the form with the draft and the chosen shelf and status, keeping the rest", () => {
    let state = flowReducer(scanAndAnswer(lookup()), { type: "edit", shelf: "Study · B1", status: "reading" });
    const form = expectStep(state, "form");
    expect(form.reason).toBe("edit");
    expect(form.initial).toMatchObject({
      title: "The Hobbit",
      author: "J. R. R. Tolkien",
      publisher: "Houghton Mifflin Harcourt",
      year: "2012",
      isbn: HOBBIT,
      shelf: "Study · B1",
      status: "reading",
    });
    expect(form.base.cover.kind).toBe("candidates");

    const read = readForm({ ...form.initial, title: "The Hobbit (75th anniversary)", shelf: "Study · B1" });
    if (!read.ok) throw new Error("form should read");
    expect(bodyFromForm(read.fields, form.base)).toEqual({
      title: "The Hobbit (75th anniversary)",
      subtitle: null,
      authors: ["J. R. R. Tolkien"],
      publisher: "Houghton Mifflin Harcourt",
      publishedYear: 2012,
      pages: 300,
      language: "en",
      description: null,
      subjects: ["Fantasy"],
      isbn13: HOBBIT,
      metadataSource: "openlibrary",
      shelf: "Study · B1",
      status: "reading",
    });

    state = flowReducer(state, { type: "save" });
    expect(expectStep(state, "form").save.saving).toBe(true);
  });
});

describe("modes", () => {
  it("By hand rests on a blank form, and a save gives a fresh one", () => {
    let state = initialFlow("manual");
    const first = expectStep(state, "form");
    expect(first.reason).toBe("manual");
    expect(flowReducer(state, { type: "discard" })).toBe(state);

    state = flowReducer(flowReducer(state, { type: "save" }), {
      type: "saved",
      book: { id: 19, title: "Caiet", shelf: "Bedroom" },
    });
    const second = expectStep(state, "form");
    expect(second.reason).toBe("manual");
    expect(second.id).not.toBe(first.id);
    expect(state.added).toBe(1);
  });

  it("switching drops an unsaved result and pauses the scanner outside Scan", () => {
    let state = scanAndAnswer(lookup());
    state = flowReducer(state, { type: "mode", mode: "isbn" });
    expect(state.mode).toBe("isbn");
    expect(state.step.kind).toBe("ready");
    expect(scannerPaused(state)).toBe(true);
    expect(flowReducer(state, { type: "mode", mode: "isbn" })).toBe(state);
    state = flowReducer(state, { type: "mode", mode: "scan" });
    expect(scannerPaused(state)).toBe(false);
  });

  it("keeps the session count across modes and from a carried session", () => {
    const state = initialFlow("isbn", { added: 3, lastShelf: "Bedroom" });
    expect(flowReducer(state, { type: "mode", mode: "scan" })).toMatchObject({ added: 3, lastShelf: "Bedroom" });
  });

  it("Type ISBN: Enter on the ISBN already shown does nothing; a new one replaces it", () => {
    const found = scanAndAnswer(lookup(), "isbn");
    expect(currentIsbn(found.step)).toBe(HOBBIT);
    expect(flowReducer(found, { type: "submit-isbn", isbn13: HOBBIT })).toBe(found);
    const next = flowReducer(found, { type: "submit-isbn", isbn13: ISIDOR });
    expect(expectStep(next, "looking").isbn13).toBe(ISIDOR);
  });

  it("Scan mode takes a typed ISBN only from its ISBN sheet", () => {
    const state = initialFlow("scan");
    expect(flowReducer(state, { type: "submit-isbn", isbn13: HOBBIT })).toBe(state);
  });
});

describe("proposals", () => {
  it("maps a draft to create fields, never the draft's own keys", () => {
    const proposal = proposalFromDraft({ ...draft({ sources: ["openlibrary", "googlebooks"] }), title: "The Hobbit" });
    expect(proposal.details).not.toHaveProperty("coverCandidates");
    expect(proposal.details).not.toHaveProperty("sources");
    expect(proposal.details.metadataSource).toBe("openlibrary");
    expect(proposal.origin).toEqual(["openlibrary", "googlebooks"]);
    expect(bodyFromProposal(proposal, "Bedroom", "unread")).toMatchObject({ title: "The Hobbit", shelf: "Bedroom", status: "unread" });
  });

  it("takes a Google-only draft's source and an absent cover", () => {
    const proposal = proposalFromDraft({ ...draft({ sources: ["googlebooks"], coverCandidates: [] }), title: "t" });
    expect(proposal.details.metadataSource).toBe("googlebooks");
    expect(proposal.cover).toEqual({ kind: "none" });
  });

  it("credits a library catalog as the book's metadata source", () => {
    const proposal = proposalFromDraft({ ...draft({ sources: ["bcucluj"], coverCandidates: [] }), title: "Piramida roșie" });
    expect(proposal.details.metadataSource).toBe("bcucluj");
    expect(proposal.origin).toEqual(["bcucluj"]);
  });

  it("copies a saved book's facts but not the owner's own fields", () => {
    const proposal = proposalFromBook(book(), null);
    expect(proposal.details).toMatchObject({ title: "The Hobbit, or There and Back Again", isbn13: HOBBIT });
    for (const key of ["shelf", "status", "rating", "notes", "tags", "format", "condition", "authorSort", "id", "hasCover", "coverUpdatedAt"]) {
      expect(proposal.details).not.toHaveProperty(key);
    }
  });

  it("takes the draft's cover for a copy whose first copy has none", () => {
    expect(proposalFromBook(book({ hasCover: false, coverUpdatedAt: null }), draft()).cover).toEqual({
      kind: "candidates",
      urls: ["https://covers.openlibrary.org/b/id/1-L.jpg"],
    });
    expect(proposalFromBook(book({ hasCover: false, coverUpdatedAt: null }), null).cover).toEqual({ kind: "none" });
  });

  it("builds another copy from the newest saved copy, else the draft, else nothing", () => {
    const two = lookup({
      owned: [
        { id: 7, shelf: "Living room · A3", createdAt: "2026-03-03T10:00:00.000Z" },
        { id: 9, shelf: "Bedroom", createdAt: "2026-05-01T10:00:00.000Z" },
      ],
    });
    expect(newestCopy(two.owned)?.id).toBe(9);
    expect(newestCopy([])).toBeNull();
    expect(copyProposal(two, [book({ id: 9, title: "Mine" })])?.details.title).toBe("Mine");
    const fromDraft = copyProposal(two, []);
    expect(fromDraft).toMatchObject({ origin: "copy", details: { title: "The Hobbit" } });
    expect(copyProposal(lookup({ ...two, draft: null }), [])).toBeNull();
  });
});
