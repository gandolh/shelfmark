import { describe, expect, it } from "vitest";
import { COVER_CACHE, isApiPath, isCoverPath } from "./routes";

describe("service worker routes", () => {
  it("keeps covers only", () => {
    expect(isCoverPath("/shelfmark-api/api/books/12/cover")).toBe(true);
    expect(isCoverPath("/shelfmark-api/api/books/12")).toBe(false);
    expect(isCoverPath("/shelfmark-api/api/books/12/cover/extra")).toBe(false);
    expect(isCoverPath("/shelfmark-api/api/books/abc/cover")).toBe(false);
    expect(isCoverPath("/shelfmark-api/auth/session")).toBe(false);
    expect(isCoverPath("/shelfmark-api/api/books")).toBe(false);
  });

  it("recognises the API prefix, and only as a whole segment", () => {
    expect(isApiPath("/shelfmark-api/auth/session")).toBe(true);
    expect(isApiPath("/shelfmark-api")).toBe(true);
    expect(isApiPath("/shelfmark/library")).toBe(false);
    expect(isApiPath("/shelfmark-apiary")).toBe(false);
  });

  it("bounds the covers cache", () => {
    expect(COVER_CACHE.maxEntries).toBeLessThanOrEqual(1000);
    expect(COVER_CACHE.maxAgeSeconds).toBeLessThanOrEqual(30 * 24 * 60 * 60);
  });
});
