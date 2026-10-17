import type { LookupResponse } from "@shelfmark/shared";

/**
 * The lookup answers this visit to Add a book has had, by ISBN: the same
 * ISBN scanned or typed again shows its answer at once, with no request. The
 * server caches each source's answer anyway; this saves the round trip.
 *
 * An answer in which a source failed is not kept, so trying the ISBN again
 * still asks that source again. Saving a book forgets its ISBN, so whether it
 * is already in the library is asked afresh.
 */
export interface LookupMemo {
  get(isbn13: string): LookupResponse | undefined;
  /** Keep an answer, unless a source failed in it. */
  keep(answer: LookupResponse): void;
  forget(isbn13: string): void;
}

export function createLookupMemo(): LookupMemo {
  const answers = new Map<string, LookupResponse>();
  return {
    get: (isbn13) => answers.get(isbn13),
    keep(answer) {
      if (answer.tried.some((tried) => tried.outcome === "error")) answers.delete(answer.isbn13);
      else answers.set(answer.isbn13, answer);
    },
    forget(isbn13) {
      answers.delete(isbn13);
    },
  };
}
