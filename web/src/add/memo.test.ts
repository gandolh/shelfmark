import type { LookupResponse } from "@shelfmark/shared";
import { describe, expect, it } from "vitest";
import { createLookupMemo } from "./memo";

const HOBBIT = "9780547928227";

function answer(outcomes: LookupResponse["tried"][number]["outcome"][]): LookupResponse {
  const sources = ["openlibrary", "biblacad", "bcucluj", "bcutimisoara", "cip", "googlebooks"] as const;
  return {
    isbn13: HOBBIT,
    draft: null,
    tried: outcomes.map((outcome, i) => ({ source: sources[i]!, outcome })),
    owned: [],
    wishlisted: [],
  };
}

describe("createLookupMemo", () => {
  it("keeps an answer every source gave", () => {
    const memo = createLookupMemo();
    expect(memo.get(HOBBIT)).toBeUndefined();
    const notFound = answer(["not_found", "not_found", "not_found", "not_found", "not_found", "skipped_no_key"]);
    memo.keep(notFound);
    expect(memo.get(HOBBIT)).toBe(notFound);
  });

  it("doesn't keep an answer in which a source failed, and drops the one it had", () => {
    const memo = createLookupMemo();
    memo.keep(answer(["found"]));
    memo.keep(answer(["not_found", "not_found", "not_found", "error"]));
    expect(memo.get(HOBBIT)).toBeUndefined();
  });

  it("forgets an ISBN", () => {
    const memo = createLookupMemo();
    memo.keep(answer(["found"]));
    memo.forget(HOBBIT);
    expect(memo.get(HOBBIT)).toBeUndefined();
  });
});
