import { useSyncExternalStore } from "react";
import type { ColumnId } from "./columns";
import type { Filter, Filters } from "./filters";
import { browserStorage, readPrefs, writePrefs, type Layout, type LibraryPrefs } from "./prefs";
import { NO_SELECTION, type Selection } from "./selection";

/**
 * The Library's state that outlives the page: the prefs (saved per layout,
 * read once per session), the filters and the row selection (this session
 * only). Opening a book unmounts the page; coming Back finds them as they
 * were left, as the search text is in layout/search.ts.
 */

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  for (const listener of listeners) listener();
}

// --- Prefs ------------------------------------------------------------------------

const prefs: Partial<Record<Layout, LibraryPrefs>> = {};
const saveTimers: Partial<Record<Layout, ReturnType<typeof setTimeout>>> = {};
// A column being dragged wider changes the prefs every frame; one write
// after it settles is enough.
const SAVE_DELAY = 300;

export function getPrefs(layout: Layout): LibraryPrefs {
  let current = prefs[layout];
  if (!current) {
    current = readPrefs(browserStorage(), layout);
    prefs[layout] = current;
  }
  return current;
}

function save(layout: Layout): void {
  delete saveTimers[layout];
  const current = prefs[layout];
  if (current) writePrefs(browserStorage(), layout, current);
}

/** Change a layout's prefs; saved shortly after. */
export function updatePrefs(layout: Layout, update: (current: LibraryPrefs) => LibraryPrefs): void {
  const current = getPrefs(layout);
  const next = update(current);
  if (next === current) return;
  prefs[layout] = next;
  notify();
  clearTimeout(saveTimers[layout]);
  saveTimers[layout] = setTimeout(() => save(layout), SAVE_DELAY);
}

// A change still waiting when the tab goes away is written then.
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    for (const layout of Object.keys(saveTimers) as Layout[]) {
      clearTimeout(saveTimers[layout]);
      save(layout);
    }
  });
}

/** The layout's prefs; re-renders when they change. */
export function useLibraryPrefs(layout: Layout): LibraryPrefs {
  return useSyncExternalStore(subscribe, () => getPrefs(layout));
}

// --- Filters ------------------------------------------------------------------------

let filters: Filters = {};

export function getFilters(): Filters {
  return filters;
}

/** Set one column's filter; `null` removes it. */
export function setFilter(id: ColumnId, filter: Filter | null): void {
  const next: Partial<Record<ColumnId, Filter>> = { ...filters };
  if (filter) next[id] = filter;
  else delete next[id];
  filters = next;
  notify();
}

export function clearFilters(): void {
  if (Object.keys(filters).length === 0) return;
  filters = {};
  notify();
}

/** Replace every filter at once: a saved view being applied (brief 27, savedViews.ts). */
export function setFilters(next: Filters): void {
  if (next === filters) return;
  filters = next;
  notify();
}

/** The filters; re-renders when they change. */
export function useLibraryFilters(): Filters {
  return useSyncExternalStore(subscribe, getFilters);
}

// --- Selection (brief 26) ------------------------------------------------------------

let selection: Selection = NO_SELECTION;

export function getSelection(): Selection {
  return selection;
}

/** Replace the selection (selection.ts makes the next one). Sorting and filtering never call this. */
export function setSelection(next: Selection): void {
  if (next === selection) return;
  selection = next;
  notify();
}

/** The bulk bar's Clear. */
export function clearSelection(): void {
  setSelection(NO_SELECTION);
}

/** The selection; re-renders when it changes. */
export function useLibrarySelection(): Selection {
  return useSyncExternalStore(subscribe, getSelection);
}
