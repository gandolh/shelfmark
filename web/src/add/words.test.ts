import { describe, expect, it } from "vitest";
import { ApiError } from "../api";
import { flowReducer, initialFlow } from "./flow";
import {
  addedOn,
  announcement,
  bylineLine,
  isbnProblem,
  lookupFailure,
  metaLine,
  notFoundText,
  noOfflineCopy,
  notFoundWording,
  offlineNote,
  offlineShelves,
  offlineStatus,
  ownedLine,
  saveFailure,
  sessionCount,
  sourceLine,
} from "./words";

const ISIDOR = "9786063205583";

describe("notFoundWording", () => {
  it("names both sources when both were searched", () => {
    const tried = [
      { source: "openlibrary", outcome: "not_found" },
      { source: "googlebooks", outcome: "not_found" },
    ] as const;
    expect(notFoundText(ISIDOR, [...tried])).toBe(`No match for ${ISIDOR} in Open Library or Google Books.`);
    expect(notFoundWording([...tried]).uncertain).toBe(false);
  });

  it("never claims Google Books was searched when it was skipped for want of a key", () => {
    const text = notFoundText(ISIDOR, [
      { source: "openlibrary", outcome: "not_found" },
      { source: "googlebooks", outcome: "skipped_no_key" },
    ]);
    expect(text).toBe(`No match for ${ISIDOR} in Open Library. Google Books isn't set up yet, so it wasn't searched.`);
    expect(text).not.toMatch(/in Open Library or Google Books/);
  });

  it("says a source that failed may still have the book, and asks for a retry", () => {
    const wording = notFoundWording([
      { source: "openlibrary", outcome: "error" },
      { source: "googlebooks", outcome: "not_found" },
    ]);
    expect(wording).toEqual({
      searchedIn: "Google Books",
      notes: ["Open Library didn't answer, so it may still have it."],
      uncertain: true,
    });
  });

  it("names every library searched, and capitalizes one that didn't answer", () => {
    expect(
      notFoundText(ISIDOR, [
        { source: "openlibrary", outcome: "not_found" },
        { source: "biblacad", outcome: "error" },
        { source: "bcucluj", outcome: "not_found" },
        { source: "bcutimisoara", outcome: "not_found" },
        { source: "googlebooks", outcome: "not_found" },
      ]),
    ).toBe(
      `No match for ${ISIDOR} in Open Library, BCU Cluj, BCU Timișoara or Google Books. ` +
        "The Romanian Academy Library didn't answer, so it may still have it.",
    );
  });

  it("words a miss where no source answered at all", () => {
    expect(
      notFoundText(ISIDOR, [
        { source: "openlibrary", outcome: "error" },
        { source: "googlebooks", outcome: "skipped_no_key" },
      ]),
    ).toBe(
      `Nothing found for ${ISIDOR}. Open Library didn't answer, so it may still have it. Google Books isn't set up yet, so it wasn't searched.`,
    );
  });
});

describe("isbnProblem", () => {
  it("names the problem", () => {
    expect(isbnProblem("9780547928228", "checksum")).toBe("Check digit doesn't match. One of the digits is off.");
    expect(isbnProblem("978-0-547", "length")).toBe("An ISBN has 10 or 13 digits; this has 7.");
    expect(isbnProblem("  ", "length")).toBe("Type the ISBN first.");
    expect(isbnProblem("5941234567890", "not_isbn")).toBe("An ISBN-13 starts with 978 or 979.");
    expect(isbnProblem("12345678AB", "not_isbn")).toBe("An ISBN is digits only, with an X allowed at the end of a 10-digit one.");
  });
});

describe("lines", () => {
  it("says where a draft came from", () => {
    expect(sourceLine(["openlibrary"])).toBe("Found in Open Library");
    expect(sourceLine(["googlebooks"])).toBe("Found in Google Books");
    expect(sourceLine(["openlibrary", "googlebooks"])).toBe("Found in Open Library and Google Books");
    expect(sourceLine(["bcucluj"])).toBe("Found in the catalog of BCU Cluj");
    expect(sourceLine(["biblacad"])).toBe("Found in the catalog of the Romanian Academy Library");
    expect(sourceLine(["openlibrary", "bcutimisoara"])).toBe("Found in Open Library and the catalog of BCU Timișoara");
    expect(sourceLine(["cip"])).toBe("Found in the national library's CIP lists (written before printing)");
    expect(sourceLine("copy")).toBe("Another copy of a book you have");
  });

  it("joins what is known", () => {
    expect(metaLine({ publisher: "Polirom", publishedYear: 2021, pages: 218 })).toBe("Polirom\u00a0· 2021\u00a0· 218 pages");
    expect(metaLine({ publisher: null, publishedYear: 2021, pages: 1 })).toBe("2021\u00a0· 1 page");
    expect(metaLine({})).toBe("");
    expect(bylineLine({ authors: ["Frank Herbert"], publisher: "Ace", publishedYear: 2020 })).toBe("Frank Herbert\u00a0· Ace\u00a0· 2020");
    expect(sessionCount(3)).toBe("3 added this session");
  });

  it("says where the copies already saved are", () => {
    const now = new Date(2026, 9, 15, 12);
    expect(ownedLine([{ id: 1, shelf: "Living room · A3", createdAt: new Date(2026, 2, 3, 9).toISOString() }], now)).toBe(
      "Living room · A3\u00a0· added 3 Mar 2026",
    );
    expect(ownedLine([{ id: 1, shelf: null, createdAt: new Date(2026, 9, 15, 8).toISOString() }], now)).toBe(
      "No shelf\u00a0· added today",
    );
    expect(
      ownedLine(
        [
          { id: 1, shelf: "Living room · A3", createdAt: now.toISOString() },
          { id: 2, shelf: "Bedroom", createdAt: now.toISOString() },
          { id: 3, shelf: null, createdAt: now.toISOString() },
        ],
        now,
      ),
    ).toBe("3 copies: Living room · A3, Bedroom and no shelf\u00a0· last added today");
    expect(addedOn(new Date(2026, 9, 14, 23).toISOString(), now)).toBe("added 14 Oct 2026");
  });
});

describe("failures", () => {
  it("marks a lookup or save that never reached the server", () => {
    const offline = new ApiError(0, "network", "Shelfmark can't be reached. Check your connection.");
    expect(lookupFailure(offline)).toEqual({
      message: "Looking up a book needs the network, and Shelfmark can't be reached. Try again when you're back online.",
      network: true,
    });
    expect(saveFailure(offline)).toEqual({
      message: "Not saved: saving needs the network, and Shelfmark can't be reached. Try again when you're back online.",
      network: true,
    });
  });

  it("passes the server's own message through", () => {
    const invalid = new ApiError(400, "validation", "isbn13: must be 13 digits starting with 978 or 979");
    expect(saveFailure(invalid)).toEqual({ message: "Not saved: isbn13: must be 13 digits starting with 978 or 979", network: false });
    expect(lookupFailure(new Error("boom"))).toEqual({ message: "The lookup didn't work. Try again.", network: false });
  });
});

describe("announcement", () => {
  it("says a save once it lands, and the step otherwise when asked to", () => {
    let state = flowReducer(initialFlow("isbn"), { type: "submit-isbn", isbn13: ISIDOR });
    expect(announcement(state, true)).toBe(`Looking up ${ISIDOR}.`);
    expect(announcement(state, false)).toBe("");
    state = flowReducer(state, {
      type: "looked-up",
      id: state.step.id,
      lookup: {
        isbn13: ISIDOR,
        draft: null,
        tried: [{ source: "openlibrary", outcome: "not_found" }],
        owned: [],
        wishlisted: [],
      },
    });
    expect(announcement(state, true)).toBe(`No match for ${ISIDOR} in Open Library.`);
    state = flowReducer(flowReducer(state, { type: "save" }), {
      type: "saved",
      book: { id: 1, title: "O vară cu Isidor", shelf: null },
    });
    expect(announcement(state, false)).toBe("Saved O vară cu Isidor. 1 added this session.");
    state = flowReducer(state, { type: "submit-isbn", isbn13: "9780547928227" });
    expect(announcement(state, true)).toBe("Looking up 9780547928227.");
  });
});

describe("the offline answer's words", () => {
  const savedAt = "2026-10-22T10:00:00.000Z";
  const copy = (shelf: string | null) => ({ isbn13: "9780547928227", title: "The Hobbit", shelf, collection: "owned" as const });

  it("says where it is, that it is the offline answer, and as of when", () => {
    const answer = { kind: "owned" as const, copies: [copy("Living room · A2")], savedAt };
    expect(offlineStatus(answer)).toBe("Already on Living room · A2");
    expect(offlineNote(answer)).toContain("This is the offline answer");
    expect(offlineNote(answer)).toContain("22 Oct 2026");
  });

  it("names every shelf, and the missing one plainly", () => {
    expect(offlineShelves([copy("Living room · A2"), copy(null)])).toBe("Living room · A2 and no shelf");
    expect(offlineShelves([copy(null)])).toBe("No shelf");
  });

  it("says wishlisted and absent", () => {
    expect(offlineStatus({ kind: "wishlisted", copies: [copy(null)], savedAt })).toBe("On your wishlist");
    expect(offlineStatus({ kind: "absent", savedAt })).toBe("Not in your library");
  });

  it("announces the offline step and the no-copy failure asks for one visit online", () => {
    const step = { kind: "offline" as const, id: 2, isbn13: "9780547928227", answer: { kind: "absent" as const, savedAt } };
    expect(announcement({ step, notice: null, added: 0 }, true)).toBe(`Not in your library. ${offlineNote(step.answer)}`);
    expect(noOfflineCopy().message).toContain("needs one visit online first");
  });
});
