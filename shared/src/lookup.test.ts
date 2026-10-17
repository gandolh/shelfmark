import { describe, expect, it } from "vitest";
import {
  COVER_MAX_BYTES,
  coverFetchRequestSchema,
  coverInfoSchema,
  draftMetadataSource,
  draftSchema,
  LOOKUP_OUTCOMES,
  LOOKUP_SOURCES,
  lookupRequestSchema,
  lookupResponseSchema,
  METADATA_SOURCES,
  type Draft,
} from "./index.js";

const draft: Draft = {
  isbn13: "9780547928227",
  title: "The Hobbit",
  subtitle: null,
  authors: ["J.R.R. Tolkien"],
  publisher: "Mariner Books",
  publishedYear: 2012,
  pages: 300,
  language: "en",
  description: null,
  subjects: ["Fantasy"],
  coverCandidates: [{ url: "https://covers.openlibrary.org/b/id/12003329-L.jpg", source: "openlibrary" }],
  sources: ["openlibrary"],
};

describe("lookup contract", () => {
  it("has the four outcomes the brief names", () => {
    expect(LOOKUP_OUTCOMES).toEqual(["found", "not_found", "error", "skipped_no_key"]);
  });

  it("accepts a found answer and a not-found one", () => {
    const found = {
      isbn13: "9780547928227",
      draft,
      tried: [{ source: "openlibrary", outcome: "found" }],
      owned: [{ id: 3, shelf: "Living room · A2", createdAt: "2026-10-14T09:00:00.000Z" }],
      wishlisted: [{ id: 7 }],
    };
    expect(lookupResponseSchema.parse(found)).toEqual(found);

    const missing = {
      isbn13: "9786063205583",
      draft: null,
      tried: [
        { source: "openlibrary", outcome: "not_found" },
        { source: "googlebooks", outcome: "skipped_no_key" },
      ],
      owned: [],
      wishlisted: [],
    };
    expect(lookupResponseSchema.parse(missing)).toEqual(missing);
  });

  it("refuses a cover candidate that is not https", () => {
    const http = { ...draft, coverCandidates: [{ url: "http://covers.openlibrary.org/b/id/1-L.jpg", source: "openlibrary" }] };
    expect(draftSchema.safeParse(http).success).toBe(false);
  });

  it("credits the first source that contributed", () => {
    expect(draftMetadataSource(["openlibrary"])).toBe("openlibrary");
    expect(draftMetadataSource(["bcucluj"])).toBe("bcucluj");
    expect(draftMetadataSource(["openlibrary", "biblacad"])).toBe("openlibrary");
  });

  it("asks the library catalogs between Open Library and Google, and a draft names at least one source", () => {
    expect(LOOKUP_SOURCES).toEqual(["openlibrary", "biblacad", "bcucluj", "bcutimisoara", "cip", "googlebooks"]);
    for (const source of LOOKUP_SOURCES) expect(METADATA_SOURCES).toContain(source);
    expect(draftSchema.safeParse({ ...draft, sources: [] }).success).toBe(false);
    expect(draftSchema.safeParse({ ...draft, sources: ["goodreads"] }).success).toBe(false);
  });

  it("takes the ISBN as a string and refuses unknown keys", () => {
    expect(lookupRequestSchema.parse({ isbn: "978-0-547-92822-7" })).toEqual({ isbn: "978-0-547-92822-7" });
    expect(lookupRequestSchema.safeParse({ isbn: 9780547928227 }).success).toBe(false);
    expect(lookupRequestSchema.safeParse({ isbn: "9780547928227", force: true }).success).toBe(false);
    expect(coverFetchRequestSchema.safeParse({ url: 42 }).success).toBe(false);
  });

  it("describes a stored cover", () => {
    const info = { mime: "image/jpeg", size: 1234, source: "upload", updatedAt: "2026-10-15T08:00:00.000Z" };
    expect(coverInfoSchema.parse(info)).toEqual(info);
    expect(coverInfoSchema.safeParse({ ...info, mime: "image/gif" }).success).toBe(false);
    expect(COVER_MAX_BYTES).toBe(2_097_152);
  });
});
