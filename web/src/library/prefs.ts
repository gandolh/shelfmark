import type { Collection } from "@shelfmark/shared";
import { BOOK_COLUMN_ID, COLUMNS, columnById, isColumnId, type ColumnId } from "./columns";
import { DEFAULT_SORTING, type SortKey, type Sorting } from "./sort";

/**
 * The Library's layout memory (corpus/wiki/library-table.md): which
 * collection tab (Owned or Wishlist), which view, the sort, and the table's column order, visibility and widths, kept in
 * this browser's `localStorage`, one entry per layout, since a phone and a
 * desktop window want different things. A convenience: when storage is
 * blocked, full, or holds something this version can't read, the defaults
 * stand in, field by field, and nothing breaks.
 */

export type Layout = "desktop" | "phone";
export type ViewMode = "table" | "covers";

export interface LibraryPrefs {
  /** The tab last open: Owned or Wishlist. */
  collection: Collection;
  view: ViewMode;
  sorting: Sorting;
  /** Every column, in the table's order; the book column first. */
  columnOrder: readonly ColumnId[];
  /** Every column, shown or not. */
  columnVisibility: Readonly<Record<ColumnId, boolean>>;
  /** Widths the owner dragged to; the rest keep their default. */
  columnSizing: Readonly<Partial<Record<ColumnId, number>>>;
}

/** What prefs need from `localStorage`; a fake one in tests. */
export type PrefsStorage = Pick<Storage, "getItem" | "setItem">;

const MAX_WIDTH = 1200;

/** `shelfmark.library.desktop`, `shelfmark.library.phone`. */
export function prefsKey(layout: Layout): string {
  return `shelfmark.library.${layout}`;
}

/** Table on a laptop, covers on a phone (design.md). */
export function defaultView(layout: Layout): ViewMode {
  return layout === "desktop" ? "table" : "covers";
}

export const DEFAULT_ORDER: readonly ColumnId[] = COLUMNS.map((column) => column.id);

export const DEFAULT_VISIBILITY: Readonly<Record<ColumnId, boolean>> = Object.fromEntries(
  COLUMNS.map((column) => [column.id, column.defaultVisible]),
) as Record<ColumnId, boolean>;

export function defaultPrefs(layout: Layout): LibraryPrefs {
  return {
    collection: "owned",
    view: defaultView(layout),
    sorting: DEFAULT_SORTING,
    columnOrder: DEFAULT_ORDER,
    columnVisibility: DEFAULT_VISIBILITY,
    columnSizing: {},
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Known columns, each once, in a direction; the default when nothing usable is left. */
export function normalizeSorting(value: unknown): Sorting {
  if (!Array.isArray(value)) return DEFAULT_SORTING;
  const keys: SortKey[] = [];
  for (const item of value) {
    if (!isRecord(item) || !isColumnId(item.id) || typeof item.desc !== "boolean") continue;
    if (keys.some((key) => key.id === item.id)) continue;
    keys.push({ id: item.id, desc: item.desc });
  }
  return keys.length > 0 ? keys : DEFAULT_SORTING;
}

/** Every column once: the book first, the saved order next, and columns this version added at the end. */
export function normalizeOrder(value: unknown): readonly ColumnId[] {
  const saved = Array.isArray(value) ? value.filter(isColumnId) : [];
  const order: ColumnId[] = [BOOK_COLUMN_ID];
  for (const id of [...saved, ...DEFAULT_ORDER]) if (!order.includes(id)) order.push(id);
  return order;
}

/** Every column shown or not: the saved choice where there is one, the default otherwise; the book always shown. */
export function normalizeVisibility(value: unknown): Readonly<Record<ColumnId, boolean>> {
  const saved = isRecord(value) ? value : {};
  const visibility = { ...DEFAULT_VISIBILITY };
  for (const id of DEFAULT_ORDER) {
    const choice = saved[id];
    if (typeof choice === "boolean") visibility[id] = choice;
  }
  visibility[BOOK_COLUMN_ID] = true;
  return visibility;
}

/** Saved widths of known columns, whole pixels, within the column's limits. */
export function normalizeSizing(value: unknown): Readonly<Partial<Record<ColumnId, number>>> {
  if (!isRecord(value)) return {};
  const sizing: Partial<Record<ColumnId, number>> = {};
  for (const [id, width] of Object.entries(value)) {
    if (!isColumnId(id) || typeof width !== "number" || !Number.isFinite(width)) continue;
    sizing[id] = Math.round(Math.min(MAX_WIDTH, Math.max(columnById(id).minSize, width)));
  }
  return sizing;
}

/** Whatever was stored, read field by field: a broken field falls back alone. */
export function parsePrefs(value: unknown, layout: Layout): LibraryPrefs {
  const saved = isRecord(value) ? value : {};
  return {
    collection: saved.collection === "wishlist" ? "wishlist" : "owned",
    view: saved.view === "table" || saved.view === "covers" ? saved.view : defaultView(layout),
    sorting: normalizeSorting(saved.sorting),
    columnOrder: normalizeOrder(saved.columnOrder),
    columnVisibility: normalizeVisibility(saved.columnVisibility),
    columnSizing: normalizeSizing(saved.columnSizing),
  };
}

/** The saved prefs for a layout, or the defaults when there are none or they can't be read. */
export function readPrefs(storage: PrefsStorage | null, layout: Layout): LibraryPrefs {
  let raw: string | null = null;
  try {
    raw = storage?.getItem(prefsKey(layout)) ?? null;
  } catch {
    // Blocked storage (a private window, a policy): the defaults it is.
  }
  if (raw === null) return defaultPrefs(layout);
  try {
    return parsePrefs(JSON.parse(raw), layout);
  } catch {
    return defaultPrefs(layout);
  }
}

/** Save; `false` when the browser refused (full, blocked). Losing it costs nothing. */
export function writePrefs(storage: PrefsStorage | null, layout: Layout, prefs: LibraryPrefs): boolean {
  if (!storage) return false;
  try {
    storage.setItem(prefsKey(layout), JSON.stringify(prefs));
    return true;
  } catch {
    return false;
  }
}

/** This browser's `localStorage`, or `null` where touching it throws (or there is no window). */
export function browserStorage(): PrefsStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
