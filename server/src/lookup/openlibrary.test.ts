import { describe, expect, it } from "vitest";
import { fakeFetch, fixture, hang, json, recordedInternet } from "../testing/fakeFetch.js";
import { createOpenLibrarySource, languageOf, readOpenLibrary, USER_AGENT } from "./openlibrary.js";
import { createQueue, type Clock } from "./queue.js";

// The fixtures are Open Library's real answers, recorded on 2026-10-15.
const recorded = (isbn13: string) => ({
  data: fixture(`openlibrary-data-${isbn13}`),
  details: fixture(`openlibrary-details-${isbn13}`),
});

/** No waiting between requests: the spacing has its own tests (queue.test.ts). */
const instantQueue = () => createQueue(0);

describe("readOpenLibrary", () => {
  it("maps The Hobbit: authors, publisher, year, pages, language, description, subjects, the large cover by ID", () => {
    const draft = readOpenLibrary("9780547928227", recorded("9780547928227"));
    expect(draft).toMatchObject({
      title: "The Hobbit",
      subtitle: null,
      authors: ["J.R.R. Tolkien"],
      publisher: "Mariner Books",
      publishedYear: 2012,
      pages: 300,
      language: "en",
      coverCandidates: [{ url: "https://covers.openlibrary.org/b/id/12003329-L.jpg", source: "openlibrary" }],
    });
    expect(draft?.description).toMatch(/^Bilbo Baggins is a hobbit/);
    // The recording lists 93 subjects; a draft keeps the first ten.
    expect(draft?.subjects).toHaveLength(10);
    expect(draft?.subjects.slice(0, 3)).toEqual(["Fantasy", "Arkenstone", "Battle of Five Armies"]);
  });

  it("reads the year from any date string and maps the three-letter language code", () => {
    // publish_date "Apr 07, 2016", languages [{ key: "/languages/rum" }]
    const draft = readOpenLibrary("9789735054694", recorded("9789735054694"));
    expect(draft).toMatchObject({
      title: "Inocentii",
      authors: ["Ioana Parvulescu"],
      publisher: "Humanitas",
      publishedYear: 2016,
      pages: 348,
      language: "ro",
      description: null,
      coverCandidates: [{ url: "https://covers.openlibrary.org/b/id/10842140-L.jpg", source: "openlibrary" }],
    });
  });

  it("keeps a thin answer thin: a title and a subtitle, no cover", () => {
    const draft = readOpenLibrary("9789735066109", recorded("9789735066109"));
    expect(draft).toMatchObject({
      title: "Omul care mută norii",
      subtitle: "şapte întâmplări",
      authors: ["Radu Paraschivescu"],
      publishedYear: 2019,
      pages: 258,
      language: "ro",
      coverCandidates: [],
    });
  });

  it("says not found for an empty answer and for nonsense", () => {
    const empty = { data: fixture("openlibrary-data-9786063205583"), details: null };
    expect(empty.data).toEqual({});
    expect(readOpenLibrary("9786063205583", empty)).toBeNull();
    expect(readOpenLibrary("9786063205583", null)).toBeNull();
    expect(readOpenLibrary("9786063205583", "<html>")).toBeNull();
    // An answer for another ISBN is not an answer for this one.
    expect(readOpenLibrary("9789735054694", recorded("9780547928227"))).toBeNull();
  });

  it("falls back to the cover in the data answer when the details have none", () => {
    const { data } = recorded("9789735054694");
    const draft = readOpenLibrary("9789735054694", { data, details: null });
    expect(draft?.coverCandidates).toEqual([
      { url: "https://covers.openlibrary.org/b/id/10842140-L.jpg", source: "openlibrary" },
    ]);
    expect(draft?.language).toBeNull();
  });

  it("maps MARC codes, both spellings, to ISO 639-1", () => {
    expect(languageOf("/languages/eng")).toBe("en");
    expect(languageOf("/languages/rum")).toBe("ro");
    expect(languageOf("ron")).toBe("ro");
    expect(languageOf("/languages/fre")).toBe("fr");
    expect(languageOf("/languages/ger")).toBe("de");
    expect(languageOf("/languages/hun")).toBe("hu");
    expect(languageOf("/languages/xyz")).toBeNull();
    // Upstream data, so never an object's built-ins.
    expect(languageOf("/languages/__proto__")).toBeNull();
    expect(languageOf("/languages/constructor")).toBeNull();
    expect(languageOf(undefined)).toBeNull();
  });

  it.each(["/languages/__proto__", "/languages/constructor"])("leaves the language empty for %s", (key) => {
    const { data, details } = recorded("9780547928227") as { data: unknown; details: Record<string, { details: object }> };
    const entry = details["ISBN:9780547928227"]!;
    const changed = { "ISBN:9780547928227": { ...entry, details: { ...entry.details, languages: [{ key }] } } };
    const draft = readOpenLibrary("9780547928227", { data, details: changed });
    expect(draft?.title).toBe("The Hobbit");
    expect(draft?.language).toBeNull();
  });
});

describe("createOpenLibrarySource", () => {
  it("asks jscmd=data, then jscmd=details for a found ISBN, naming the app and a contact", async () => {
    const fetch = fakeFetch(recordedInternet);
    const source = createOpenLibrarySource({ fetch, queue: instantQueue() });
    const response = await source.fetch("9780547928227");

    expect(fetch.calls.map((call) => call.url.href)).toEqual([
      "https://openlibrary.org/api/books?bibkeys=ISBN:9780547928227&jscmd=data&format=json",
      "https://openlibrary.org/api/books?bibkeys=ISBN:9780547928227&jscmd=details&format=json",
    ]);
    for (const call of fetch.calls) {
      expect(call.headers.get("user-agent")).toBe(USER_AGENT);
    }
    expect(USER_AGENT).toMatch(/^Shelfmark\/\d+\.\d+\.\d+ \(johndoe@example\.com\)$/);
    expect(source.read("9780547928227", response)?.title).toBe("The Hobbit");
  });

  it("stops after jscmd=data when the ISBN is unknown", async () => {
    const fetch = fakeFetch(recordedInternet);
    const source = createOpenLibrarySource({ fetch, queue: instantQueue() });
    expect(await source.fetch("9786063205583")).toEqual({ data: {}, details: null });
    expect(fetch.calls).toHaveLength(1);
  });

  it("spaces its two requests through the Open Library queue", async () => {
    let now = 0;
    const clock: Clock = { now: () => now, sleep: async (ms) => void (now += ms) };
    const starts: number[] = [];
    const fetch = fakeFetch((url, init) => {
      starts.push(now);
      return recordedInternet(url, init);
    });
    await createOpenLibrarySource({ fetch, queue: createQueue(400, clock) }).fetch("9780547928227");
    expect(starts).toEqual([0, 400]);
  });

  it("throws on a non-2xx answer, on an answer that isn't JSON, and when the host can't be reached", async () => {
    const answers = [
      () => json({ error: "busy" }, 503),
      () => new Response("<html>maintenance</html>", { status: 200 }),
      () => undefined,
    ];
    const messages = [];
    for (const answer of answers) {
      const source = createOpenLibrarySource({ fetch: fakeFetch(answer), queue: instantQueue() });
      messages.push(await source.fetch("9780547928227").then(() => "resolved", (error: Error) => error.message));
    }
    expect(messages).toEqual([
      "Open Library answered 503",
      "Open Library sent an answer that is not JSON",
      "Open Library could not be reached",
    ]);
  });

  it("gives up after the timeout (8 s by default)", async () => {
    const fetch = fakeFetch((_url, init) => hang(init));
    const source = createOpenLibrarySource({ fetch, queue: instantQueue(), timeoutMs: 20 });
    await expect(source.fetch("9780547928227")).rejects.toThrow("Open Library did not answer within 0.02 s");
  });
});
