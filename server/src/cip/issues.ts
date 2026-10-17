import { array, record } from "../lookup/merge.js";
import { getJson, USER_AGENT } from "../lookup/openlibrary.js";
import type { Queue } from "../lookup/queue.js";

/**
 * Where the CIP lists are: the national library's site is WordPress, and its
 * media API lists every uploaded file. An issue is a PDF named CIP plus a
 * Romanian month and a year, in any of the spellings the site has used:
 * `CIP_februarie-2026.pdf`, `CIP-martie_2025.pdf`, `CIP_iulie-2023_site.pdf`,
 * `BIBLIOGR-CIP-SEP-2024.pdf`,
 * `Bibliografia-cartilor-in-curs-de-aparitie-CIP-ianuarie-2019.pdf`. When a
 * month was uploaded twice, the later upload wins.
 */

export const SITE = "https://bibnat.ro";
export const MEDIA_API = `${SITE}/wp-json/wp/v2/media`;
const PAGE_SIZE = 100;
/** The listing had 2 pages on 2026-10-17; this stops a site that keeps answering. */
const MAX_PAGES = 20;
const LISTING_TIMEOUT_MS = 30_000;

export interface Issue {
  /** `YYYY-MM`. */
  month: string;
  url: string;
  /** When the site got the file, as it says. */
  uploaded: string;
}

const MONTHS: ReadonlyMap<string, number> = new Map(
  Object.entries({
    ianuarie: 1, februarie: 2, martie: 3, aprilie: 4, mai: 5, iunie: 6, iulie: 7, august: 8, septembrie: 9,
    octombrie: 10, noiembrie: 11, decembrie: 12, ian: 1, feb: 2, mar: 3, apr: 4, iun: 6, iul: 7, aug: 8,
    sep: 9, sept: 9, oct: 10, noi: 11, nov: 11, dec: 12,
  }),
);

/** The month an issue's URL is for, or `null` when the URL isn't an issue on the library's site. */
export function issueMonth(url: string): string | null {
  if (!URL.canParse(url)) return null;
  const parsed = new URL(url);
  if (parsed.origin !== SITE || !parsed.pathname.startsWith("/wp-content/uploads/")) return null;
  const name = decodeURIComponent(parsed.pathname.split("/").at(-1) ?? "");
  const match = /(?:^|[-_])CIP[-_]([a-z]+)[-_](20\d{2})(?:[-_]site)?\.pdf$/i.exec(name);
  const month = match ? MONTHS.get(match[1]!.toLowerCase()) : undefined;
  return month && match ? `${match[2]}-${String(month).padStart(2, "0")}` : null;
}

/** One issue per month from media-API entries, the latest upload of each. */
export function issuesIn(entries: readonly unknown[]): Issue[] {
  const byMonth = new Map<string, Issue>();
  for (const entry of entries) {
    const url = record(entry)?.source_url;
    const uploaded = record(entry)?.date;
    if (typeof url !== "string" || typeof uploaded !== "string") continue;
    const month = issueMonth(url);
    if (!month) continue;
    const known = byMonth.get(month);
    if (!known || uploaded > known.uploaded) byMonth.set(month, { month, url, uploaded });
  }
  return [...byMonth.values()].sort((a, b) => b.month.localeCompare(a.month));
}

/** Every issue on the site, newest first: one listing request per page, through the queue. */
export async function listIssues(fetch: typeof globalThis.fetch, queue: Queue): Promise<Issue[]> {
  const entries: unknown[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const query = new URLSearchParams({ search: "CIP", per_page: String(PAGE_SIZE), page: String(page), _fields: "source_url,date" });
    const answer = await queue.run(() =>
      getJson("The national library's site", `${MEDIA_API}?${query}`, {
        fetch,
        timeoutMs: LISTING_TIMEOUT_MS,
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      }),
    );
    const items = array(answer);
    entries.push(...items);
    if (items.length < PAGE_SIZE) break;
  }
  return issuesIn(entries);
}
