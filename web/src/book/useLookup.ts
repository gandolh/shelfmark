import type { LookupResponse } from "@shelfmark/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { lookupIsbn } from "../add/api";
import { lookupFailure, type Failure } from "../add/words";

/** One lookup for the book page, shared by the diff and the cover candidates so the sources are asked once. */
export type LookupState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; response: LookupResponse }
  | { kind: "failed"; failure: Failure };

export interface BookLookup {
  state: LookupState;
  /** Ask the sources now (again, if already asked). Does nothing without an ISBN. */
  run: () => void;
}

const IDLE: LookupState = { kind: "idle" };

export function useLookup(isbn13: string | null): BookLookup {
  // The answer is kept with the ISBN it was for: a changed ISBN makes it stale.
  const [answer, setAnswer] = useState<{ isbn: string | null; state: LookupState }>({ isbn: null, state: { kind: "idle" } });
  const abort = useRef<AbortController | null>(null);
  const state: LookupState = answer.isbn === isbn13 ? answer.state : IDLE;

  // Leaving the page (or changing the ISBN) drops the request in flight.
  useEffect(() => () => abort.current?.abort(), [isbn13]);

  const run = useCallback(() => {
    if (isbn13 === null) return;
    const setState = (next: LookupState) => setAnswer({ isbn: isbn13, state: next });
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setState({ kind: "loading" });
    lookupIsbn(isbn13, { signal: controller.signal }).then(
      (response) => {
        if (!controller.signal.aborted) setState({ kind: "done", response });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) setState({ kind: "failed", failure: lookupFailure(error) });
      },
    );
  }, [isbn13]);

  return { state, run };
}
