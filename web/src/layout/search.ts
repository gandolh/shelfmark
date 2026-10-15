import { useSyncExternalStore } from "react";

/**
 * The Library's search text. The box lives in the shell (the top bar on the
 * desktop, under the title on a phone), so it survives moving between pages;
 * the Library page reads it and does the matching (library/search.ts).
 */

let query = "";
const listeners = new Set<() => void>();

export function getSearchQuery(): string {
  return query;
}

export function setSearchQuery(next: string): void {
  if (next === query) return;
  query = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The search text as typed (untrimmed); re-renders as it changes. */
export function useSearchQuery(): string {
  return useSyncExternalStore(subscribe, getSearchQuery);
}
