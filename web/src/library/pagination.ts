/**
 * Pages in the Library (corpus/wiki/library-table.md): the list the client
 * already holds, cut into pages in the browser. Pure helpers: how many pages
 * a list makes, which rows a page holds, a page number kept in range, and
 * which page buttons the pager shows.
 */

/** The sizes the "Per page" menu offers, the same on both layouts. */
export const PAGE_SIZES = [25, 50, 100, 200] as const;

export type PageSize = (typeof PAGE_SIZES)[number];

export const DEFAULT_PAGE_SIZE: PageSize = 50;

export function isPageSize(value: unknown): value is PageSize {
  return PAGE_SIZES.includes(value as PageSize);
}

/** How many pages `total` books make at `size` a page. Never fewer than one: an empty list is one empty page. */
export function pageCount(total: number, size: number): number {
  if (!(size > 0) || !(total > 0)) return 1;
  return Math.ceil(total / size);
}

/** A whole page number from 1 to `count`: past the end it is the last page, before the start the first. */
export function clampPage(page: number, count: number): number {
  const last = Math.max(1, Math.floor(count));
  if (!Number.isFinite(page)) return 1;
  return Math.min(last, Math.max(1, Math.floor(page)));
}

/** The rows on page `page` (from 1), clamped to the pages there are. A list that fits on one page comes back as it is. */
export function pageSlice<T>(rows: readonly T[], page: number, size: number): readonly T[] {
  if (rows.length <= size) return rows;
  const start = (clampPage(page, pageCount(rows.length, size)) - 1) * size;
  return rows.slice(start, start + size);
}

/** The first and last book a page shows, counted from 1 over the whole list: 51 and 100 for "51–100 of 1,234". 0 and 0 when the list is empty. */
export function pageRange(page: number, size: number, total: number): { first: number; last: number } {
  if (total <= 0) return { first: 0, last: 0 };
  const start = (clampPage(page, pageCount(total, size)) - 1) * size;
  return { first: start + 1, last: Math.min(total, start + size) };
}

/** A page button, or a gap standing for two or more pages left out. */
export type PageItem = number | "gap";

/** Up to this many page buttons and gaps, so the row keeps its width as the page turns. */
const SLOTS = 7;

/**
 * The page buttons to show: the first and the last page, the current one
 * with a neighbour on each side, and a gap for each run left out. Past seven
 * pages it is always seven items, so nothing jumps under the pointer:
 * `1 2 3 4 5 … 25`, `1 … 4 5 6 … 25`, `1 … 21 22 23 24 25`. A gap never
 * hides a single page; that page is shown instead.
 */
export function pageItems(page: number, count: number): PageItem[] {
  const last = Math.max(1, Math.floor(count));
  const current = clampPage(page, last);
  const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
  if (last <= SLOTS) return range(1, last);
  // Near an end the current page's side gets five numbers and no gap.
  if (current <= SLOTS - 3) return [...range(1, SLOTS - 2), "gap", last];
  if (current >= last - (SLOTS - 4)) return [1, "gap", ...range(last - (SLOTS - 3), last)];
  return [1, "gap", current - 1, current, current + 1, "gap", last];
}

/**
 * Whether the Library shows the pager: when the list runs past one page, or
 * past one page at the default size. The second keeps "Per page" in reach
 * after a larger size has put everything on one page, so the owner can go
 * back to 50; at 50 or fewer, 50 books or fewer show no pager at all.
 */
export function showsPager(total: number, size: number): boolean {
  return pageCount(total, size) > 1 || total > DEFAULT_PAGE_SIZE;
}
