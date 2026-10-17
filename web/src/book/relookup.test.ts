import type { Draft } from "@shelfmark/shared";
import { describe, expect, it } from "vitest";
import { book } from "../library/test-books";
import { diffDraft, patchFromTicked, squash } from "./relookup";

const draft = (fields: Partial<Draft> = {}): Draft => ({
  isbn13: "9780547928227",
  title: null,
  subtitle: null,
  authors: [],
  publisher: null,
  publishedYear: null,
  pages: null,
  language: null,
  description: null,
  subjects: [],
  coverCandidates: [],
  sources: ["openlibrary"],
  ...fields,
});

describe("diffDraft", () => {
  const stored = book({
    title: "The Hobbit",
    authors: ["J. R. R. Tolkien"],
    publisher: "Houghton Mifflin",
    publishedYear: 2012,
    pages: 300,
    language: "en",
    subjects: ["Fantasy"],
  });

  it("is empty when the sources say what is stored", () => {
    const same = draft({
      title: "The Hobbit",
      authors: ["J. R. R. Tolkien"],
      publisher: "Houghton Mifflin",
      publishedYear: 2012,
      pages: 300,
      language: "en",
      subjects: ["Fantasy"],
    });
    expect(diffDraft(stored, same)).toEqual([]);
  });

  it("ignores whitespace-only differences", () => {
    const spaced = draft({ title: "  The   Hobbit ", authors: [" J. R. R.  Tolkien"], publisher: "Houghton  Mifflin" });
    expect(diffDraft(stored, spaced)).toEqual([]);
    expect(squash(" a \n  b ")).toBe("a b");
  });

  it("lists what differs, with both sides as text", () => {
    const rows = diffDraft(stored, draft({ title: "The Hobbit, or There and Back Again", pages: 310, subjects: ["Fantasy", "Dragons"] }));
    expect(rows.map((r) => r.field)).toEqual(["title", "pages", "subjects"]);
    expect(rows[1]).toMatchObject({ label: "Pages", current: "300", proposed: "310" });
    expect(rows[2]).toMatchObject({ current: "Fantasy", proposed: "Fantasy; Dragons" });
  });

  it("proposes a value for an empty field but never clears one", () => {
    const bare = book({ title: "X" });
    expect(diffDraft(bare, draft({ publisher: "Polirom" })).map((r) => [r.field, r.current])).toEqual([["publisher", ""]]);
    // The draft says nothing about the publisher: the stored one stays.
    expect(diffDraft(stored, draft({ publisher: null, authors: [], pages: null }))).toEqual([]);
  });
});

describe("patchFromTicked", () => {
  const rows = diffDraft(book({ title: "Old", pages: 1 }), draft({ title: "New", pages: 2, publisher: "P" }));

  it("applies only the ticked fields", () => {
    expect(patchFromTicked(rows, new Set(["pages"]))).toEqual({ pages: 2 });
    expect(patchFromTicked(rows, new Set(["title", "publisher"]))).toEqual({ title: "New", publisher: "P" });
  });

  it("is empty when nothing is ticked", () => {
    expect(patchFromTicked(rows, new Set())).toEqual({});
  });
});
