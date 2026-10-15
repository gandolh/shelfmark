import { describe, expect, it } from "vitest";
import { fakeFetch, fixture, json, recordedInternet } from "../testing/fakeFetch.js";
import { createGoogleBooksSource, readGoogleBooks } from "./googlebooks.js";
import { createQueue } from "./queue.js";

// There is no API key yet, so only `googlebooks-429-keyless.json` is a
// recording (a keyless call, 2026-10-15). The other Google fixtures are
// written by hand in the shape of the Books API v1 `volumes` answer.

const KEY = "test-key-not-a-real-one";
const instantQueue = () => createQueue(0);

describe("readGoogleBooks", () => {
  it("maps a volume, forcing the cover to https without the page curl", () => {
    expect(readGoogleBooks("9780547928227", fixture("googlebooks-9780547928227"))).toEqual({
      title: "The Hobbit",
      subtitle: "Or There and Back Again",
      authors: ["J.R.R. Tolkien"],
      publisher: "Houghton Mifflin Harcourt",
      publishedYear: 2012,
      pages: 300,
      language: "en",
      description:
        "Bilbo Baggins is a hobbit who enjoys a comfortable, unambitious life, rarely traveling any farther than his pantry or cellar.",
      subjects: ["Juvenile Fiction"],
      coverCandidates: [
        {
          url: "https://books.google.com/books/content?id=pD6arNyKyi8C&printsec=frontcover&img=1&zoom=1&source=gbs_api",
          source: "googlebooks",
        },
      ],
    });
  });

  it("says not found when there is no volume", () => {
    expect(readGoogleBooks("9786063205583", fixture("googlebooks-9786063205583"))).toBeNull();
    expect(readGoogleBooks("9786063205583", fixture("googlebooks-429-keyless"))).toBeNull();
    expect(readGoogleBooks("9786063205583", null)).toBeNull();
  });

  it("picks the volume whose identifiers carry the ISBN, ISBN-10 included", () => {
    const answer = {
      totalItems: 2,
      items: [
        { volumeInfo: { title: "Another book", industryIdentifiers: [{ type: "ISBN_13", identifier: "9780261102217" }] } },
        { volumeInfo: { title: "The Hobbit", industryIdentifiers: [{ type: "ISBN_10", identifier: "054792822X" }] } },
      ],
    };
    expect(readGoogleBooks("9780547928227", answer)?.title).toBe("The Hobbit");
    expect(readGoogleBooks("9799999999990", answer)?.title).toBe("Another book");
  });

  it("takes the largest image and the language's two letters", () => {
    const answer = {
      items: [
        {
          volumeInfo: {
            title: "Solenoid",
            language: "zh-CN",
            publishedDate: "2015",
            imageLinks: { thumbnail: "http://books.google.com/t", large: "http://books.google.com/l" },
          },
        },
      ],
    };
    const draft = readGoogleBooks("9789734650804", answer);
    expect(draft?.coverCandidates).toEqual([{ url: "https://books.google.com/l", source: "googlebooks" }]);
    expect(draft?.language).toBe("zh");
    expect(draft?.publishedYear).toBe(2015);
  });
});

describe("createGoogleBooksSource", () => {
  it("is disabled without a key and never calls out", async () => {
    const fetch = fakeFetch(recordedInternet);
    const source = createGoogleBooksSource({ apiKey: undefined, fetch, queue: instantQueue() });
    expect(source.enabled).toBe(false);
    await expect(source.fetch("9780547928227")).rejects.toThrow("no API key");
    expect(fetch.calls).toHaveLength(0);
  });

  it("searches volumes by isbn with the key", async () => {
    const fetch = fakeFetch(recordedInternet);
    const source = createGoogleBooksSource({ apiKey: KEY, fetch, queue: instantQueue() });
    const response = await source.fetch("9780547928227");
    const url = fetch.calls[0]!.url;
    expect(url.origin + url.pathname).toBe("https://www.googleapis.com/books/v1/volumes");
    expect(url.searchParams.get("q")).toBe("isbn:9780547928227");
    expect(url.searchParams.get("key")).toBe(KEY);
    expect(source.read("9780547928227", response)?.title).toBe("The Hobbit");
  });

  it("throws on the keyless 429 without putting the key in the message", async () => {
    const fetch = fakeFetch(() => json(fixture("googlebooks-429-keyless"), 429));
    const source = createGoogleBooksSource({ apiKey: KEY, fetch, queue: instantQueue() });
    const error = await source.fetch("9780547928227").catch((caught: Error) => caught);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Google Books answered 429");
    expect((error as Error).message).not.toContain(KEY);
  });
});
