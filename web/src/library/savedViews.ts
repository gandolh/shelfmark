import type { SavedView, SavedViewState } from "@shelfmark/shared";
import { useSyncExternalStore } from "react";
import { BOOK_COLUMN_ID, type ColumnId } from "./columns";
import { activeFilters, type Filter, type Filters } from "./filters";
import { normalizeOrder, normalizeSorting, type Layout, type LibraryPrefs, type ViewMode } from "./prefs";
import { getFilters, getPrefs, setFilters, updatePrefs } from "./state";

/**
 * Saved views (brief 27) on the Library's side: the page's state as a
 * `SavedViewState` and back, whether the page is on a view right now, and
 * applying one. A view holds the collection tab, the active filters, the
 * sort and the table's shown columns in order; the search text, the Table /
 * Covers switch and the column widths stay the device's.
 *
 * In the covers view a view's columns don't count: the grid shows none, so a
 * view is current there on its tab, filters and sort alone, and "Update to
 * current" keeps the columns it had. Applying one in the covers view still
 * sets the table's columns for when the owner switches to it.
 */

/** A filter as a view keeps it: the text trimmed (an empty one for "is empty"), each pick-list value once. */
function keptFilter(filter: Filter): Filter {
  switch (filter.kind) {
    case "text":
      return { kind: "text", op: filter.op, text: filter.op === "contains" ? filter.text.trim() : "" };
    case "pick":
      return { kind: "pick", values: [...new Set(filter.values)] };
    case "number":
      return { kind: "number", min: filter.min, max: filter.max };
    case "date":
      return { kind: "date", from: filter.from, to: filter.to };
    case "yesno":
      return { kind: "yesno", value: filter.value };
  }
}

/** The filters that narrow something, each fit for its column, as a view keeps them. */
export function keptFilters(filters: Filters): Partial<Record<ColumnId, Filter>> {
  return Object.fromEntries(activeFilters(filters).map(([column, filter]) => [column.id, keptFilter(filter)]));
}

/** The table's shown columns in order, less the book column, which is always first. */
export function shownColumns(prefs: Pick<LibraryPrefs, "columnOrder" | "columnVisibility">): ColumnId[] {
  return prefs.columnOrder.filter((id) => id !== BOOK_COLUMN_ID && prefs.columnVisibility[id]);
}

/** The page's state right now, as a view would save it. */
export function currentViewState(prefs: LibraryPrefs, filters: Filters): SavedViewState {
  return {
    collection: prefs.collection,
    filters: keptFilters(filters),
    sorting: prefs.sorting.map(({ id, desc }) => ({ id, desc })),
    columns: shownColumns(prefs),
  };
}

function sameFilter(a: Filter, b: Filter): boolean {
  if (a.kind === "pick" && b.kind === "pick") {
    // The order values were ticked in doesn't change the rows.
    const values = new Set(a.values);
    return values.size === new Set(b.values).size && b.values.every((value) => values.has(value));
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

function sameList<T>(a: readonly T[], b: readonly T[], same: (x: T, y: T) => boolean): boolean {
  return a.length === b.length && a.every((x, i) => {
    const y = b[i];
    return y !== undefined && same(x, y);
  });
}

/**
 * Whether two states show the same rows the same way. Filters compare as
 * kept (an empty "contains" is no filter); a sort with nothing usable left is
 * the default sort, as the page reads it. `columns: false` leaves the shown
 * columns out (the covers view).
 */
export function sameViewState(a: SavedViewState, b: SavedViewState, { columns = true }: { columns?: boolean } = {}): boolean {
  if (a.collection !== b.collection) return false;

  const fa = keptFilters(a.filters);
  const fb = keptFilters(b.filters);
  const ids = Object.keys(fa) as ColumnId[];
  if (ids.length !== Object.keys(fb).length) return false;
  for (const id of ids) {
    const x = fa[id];
    const y = fb[id];
    if (!x || !y || !sameFilter(x, y)) return false;
  }

  if (!sameList(normalizeSorting(a.sorting), normalizeSorting(b.sorting), (x, y) => x.id === y.id && x.desc === y.desc)) return false;
  return !columns || sameList(a.columns, b.columns, (x, y) => x === y);
}

/** The first view, by position, that the page is on right now; columns count only in the table. */
export function matchingView(views: readonly SavedView[], current: SavedViewState, mode: ViewMode): SavedView | undefined {
  return views.find((view) => sameViewState(view.state, current, { columns: mode === "table" }));
}

/** What "Update to current" saves: the page's state, keeping the view's columns when the covers view shows none. */
export function updatedViewState(view: SavedView, current: SavedViewState, mode: ViewMode): SavedViewState {
  return mode === "table" ? current : { ...current, columns: view.state.columns };
}

/**
 * A layout's prefs with a view's tab, sort and columns: exactly the view's
 * shown columns, in its order, after the book column; the hidden ones keep
 * the order they had. The Table / Covers switch and the widths stay.
 */
export function prefsWithView(prefs: LibraryPrefs, state: SavedViewState): LibraryPrefs {
  const shown = new Set<ColumnId>(state.columns);
  const columnOrder = normalizeOrder([BOOK_COLUMN_ID, ...state.columns, ...prefs.columnOrder.filter((id) => !shown.has(id))]);
  const columnVisibility = Object.fromEntries(columnOrder.map((id) => [id, id === BOOK_COLUMN_ID || shown.has(id)])) as LibraryPrefs["columnVisibility"];
  return { ...prefs, collection: state.collection, sorting: normalizeSorting(state.sorting), columnOrder, columnVisibility };
}

// --- The view the page is on -------------------------------------------------------------

/**
 * The view last applied, saved or updated this session: the one the Views
 * menu's "Update to current", "Rename" and "Delete" act on once the page has
 * moved off it (a filter changed). A view the page matches wins over it.
 */
let onViewId: number | null = null;
const listeners = new Set<() => void>();

function setOnView(id: number | null): void {
  if (id === onViewId) return;
  onViewId = id;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The id of the view last applied, saved or updated this session (it may since have been deleted elsewhere). */
export function getLastViewId(): number | null {
  return onViewId;
}

/** `getLastViewId`; re-renders when it changes. */
export function useLastViewId(): number | null {
  return useSyncExternalStore(subscribe, getLastViewId);
}

/** A view was saved or updated from the page: it is the one the page is on. */
export function rememberView(id: number): void {
  setOnView(id);
}

/** A view was deleted: the page is on it no longer. */
export function forgetView(id: number): void {
  if (onViewId === id) setOnView(null);
}

/**
 * Apply a view to a layout: the tab, sort and columns first, then the
 * filters, so nothing that follows a tab change clears them (LibraryPage's
 * own tab switch clears the filters, and this does not go through it).
 */
export function applyView(layout: Layout, view: SavedView): void {
  updatePrefs(layout, (prefs) => prefsWithView(prefs, view.state));
  setFilters(keptFilters(view.state.filters));
  setOnView(view.id);
}

/** The page's state right now, for a layout, outside a component. */
export function currentStateOf(layout: Layout): SavedViewState {
  return currentViewState(getPrefs(layout), getFilters());
}
