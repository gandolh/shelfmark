import { NO_VALUE, type Filter } from "../library/filters";
import { clearFilters, setFilter, updatePrefs } from "../library/state";
import type { ColumnId } from "../library/columns";
import { setSearchQuery } from "../layout/search";
import { LIBRARY, navigate } from "../router";
import { decadeOf, UNKNOWN_YEAR } from "./count";

/** One Library filter: the column and what it holds. */
export interface LibraryFilter {
  column: ColumnId;
  filter: Filter;
}

export const authorFilter = (name: string): LibraryFilter => ({ column: "authors", filter: { kind: "text", op: "contains", text: name } });
export const languageFilter = (code: string): LibraryFilter => ({ column: "language", filter: { kind: "pick", values: [code === "" ? NO_VALUE : code] } });
export const statusFilter = (status: string): LibraryFilter => ({ column: "status", filter: { kind: "pick", values: [status] } });
/** One or more shelves: a room is the list of its shelves. */
export const shelfFilter = (shelves: readonly string[]): LibraryFilter => ({ column: "shelf", filter: { kind: "pick", values: shelves.map((s) => (s === "" ? NO_VALUE : s)) } });

/** A decade as a range of `publishedYear`; no link for books with no year. */
export function decadeFilter(key: string): LibraryFilter | null {
  if (key === UNKNOWN_YEAR) return null;
  const start = decadeOf(Number(key));
  return { column: "year", filter: { kind: "number", min: start, max: start + 9 } };
}

/**
 * Open the Library on Owned with only this filter. Filters and the search
 * text are session state (library/state.ts, layout/search.ts), so setting them
 * before navigating is all it takes.
 */
export function openInLibrary({ column, filter }: LibraryFilter): void {
  setSearchQuery("");
  clearFilters();
  setFilter(column, filter);
  // The tab last open may be Wishlist, and these counts are of Owned.
  updatePrefs("desktop", (p) => (p.collection === "owned" ? p : { ...p, collection: "owned" }));
  updatePrefs("phone", (p) => (p.collection === "owned" ? p : { ...p, collection: "owned" }));
  navigate(LIBRARY);
}
