import { readFileSync } from "node:fs";
import {
  array,
  emptySourceDraft,
  LONG_TEXT_MAX,
  pagesOf,
  record,
  SUBJECTS_MAX,
  text,
  texts,
  yearOf,
  type LookupSourceClient,
  type SourceDraft,
} from "./merge.js";
import { createQueue, OPEN_LIBRARY_SPACING_MS, type Queue } from "./queue.js";

/**
 * Open Library's Books API. `jscmd=data` resolves the authors and gives the
 * publishers, subjects and cover; it has no language and no description, so a
 * found ISBN costs a second call with `jscmd=details` (the edition record:
 * `languages`, `description`, the cover IDs). Both calls go through the one
 * Open Library queue. The raw answer, as cached, is `{ data, details }`;
 * `details` is `null` when `data` found nothing.
 */

/** Placeholder until the owner's mail is live (corpus/CLAUDE.md). */
const CONTACT = "johndoe@example.com";

function appVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as { version?: unknown };
    return typeof pkg.version === "string" ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/** Every outbound request names the app and a contact: Open Library asks for it, and allows 3 req/s with it. */
export const USER_AGENT = `Shelfmark/${appVersion()} (${CONTACT})`;

export const OPEN_LIBRARY_ORIGIN = "https://openlibrary.org";
export const COVERS_ORIGIN = "https://covers.openlibrary.org";
export const SOURCE_TIMEOUT_MS = 8000;

export interface SourceClientOptions {
  /** Default: the global `fetch`. Tests pass a fake that answers from fixtures. */
  fetch?: typeof globalThis.fetch;
  /** Default: a fresh queue at the source's spacing. */
  queue?: Queue;
  /** Per request. Default 8 s. */
  timeoutMs?: number;
}

/** GET a JSON answer, or throw with a message that names the source and never the URL. */
export async function getJson(
  label: string,
  url: string,
  { fetch, timeoutMs, headers }: { fetch: typeof globalThis.fetch; timeoutMs: number; headers: Record<string, string> },
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    throw new Error(timedOut ? `${label} did not answer within ${timeoutMs / 1000} s` : `${label} could not be reached`, {
      cause: error,
    });
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`${label} answered ${response.status}`);
  }
  try {
    return (await response.json()) as unknown;
  } catch (error) {
    throw new Error(`${label} sent an answer that is not JSON`, { cause: error });
  }
}

/**
 * MARC language codes (ISO 639-2/B, as Open Library's `/languages/<code>`
 * keys use them, plus the 639-2/T spellings) to ISO 639-1. A code missing
 * here leaves the language empty.
 */
const MARC_TO_ISO6391: Record<string, string> = {
  alb: "sq", ara: "ar", arm: "hy", baq: "eu", bel: "be", bos: "bs", bul: "bg", cat: "ca", ces: "cs",
  chi: "zh", cym: "cy", cze: "cs", dan: "da", deu: "de", dut: "nl", ell: "el", eng: "en", epo: "eo",
  est: "et", eus: "eu", fas: "fa", fin: "fi", fra: "fr", fre: "fr", geo: "ka", ger: "de", gle: "ga",
  gre: "el", heb: "he", hin: "hi", hrv: "hr", hun: "hu", hye: "hy", ice: "is", ind: "id", isl: "is",
  ita: "it", jpn: "ja", kat: "ka", kor: "ko", lat: "la", lav: "lv", lit: "lt", mac: "mk", may: "ms",
  mkd: "mk", mol: "ro", msa: "ms", nld: "nl", nor: "no", per: "fa", pol: "pl", por: "pt", ron: "ro",
  rum: "ro", rus: "ru", slk: "sk", slo: "sk", slv: "sl", spa: "es", sqi: "sq", srp: "sr", swe: "sv",
  tha: "th", tur: "tr", ukr: "uk", vie: "vi", wel: "cy", yid: "yi", zho: "zh",
};

/** `/languages/rum` (or `rum`) → `ro`. */
export function languageOf(key: unknown): string | null {
  if (typeof key !== "string") return null;
  const code = key.replace(/^\/languages\//, "").trim().toLowerCase();
  return MARC_TO_ISO6391[code] ?? null;
}

/** The large cover by cover ID. */
export function coverUrl(id: number): string {
  return `${COVERS_ORIGIN}/b/id/${id}-L.jpg`;
}

const COVER_ID_IN_URL = /\/b\/id\/(\d+)-[SML]\.jpg/;
const MAX_CANDIDATES = 3;

function coverIds(data: Record<string, unknown>, details: Record<string, unknown> | undefined): number[] {
  // Open Library marks a deleted cover with -1.
  const ids = array(details?.covers).filter((id): id is number => typeof id === "number" && Number.isInteger(id) && id > 0);
  if (ids.length === 0) {
    const cover = record(data.cover);
    for (const size of ["large", "medium", "small"]) {
      const match = typeof cover?.[size] === "string" ? COVER_ID_IN_URL.exec(cover[size] as string) : null;
      if (match) {
        ids.push(Number(match[1]));
        break;
      }
    }
  }
  return [...new Set(ids)].slice(0, MAX_CANDIDATES);
}

function names(entries: unknown): unknown[] {
  return array(entries).map((entry) => (typeof entry === "string" ? entry : record(entry)?.name));
}

/** The draft fields in `{ data, details }`; `null` when `data` has no record for the ISBN. */
export function readOpenLibrary(isbn13: string, response: unknown): SourceDraft | null {
  const key = `ISBN:${isbn13}`;
  const data = record(record(record(response)?.data)?.[key]);
  if (!data) return null;
  const details = record(record(record(record(response)?.details)?.[key])?.details);

  const description = details?.description;
  const draft = emptySourceDraft();
  draft.title = text(data.title) ?? text(details?.title);
  draft.subtitle = text(data.subtitle) ?? text(details?.subtitle);
  draft.authors = texts(names(data.authors));
  if (draft.authors.length === 0) draft.authors = texts(names(details?.authors));
  draft.publisher = text(names(data.publishers)[0]) ?? text(names(details?.publishers)[0]);
  draft.publishedYear = yearOf(data.publish_date) ?? yearOf(details?.publish_date);
  draft.pages = pagesOf(data.number_of_pages) ?? pagesOf(details?.number_of_pages);
  draft.language = languageOf(record(array(details?.languages)[0])?.key);
  draft.description = text(typeof description === "string" ? description : record(description)?.value, LONG_TEXT_MAX);
  draft.subjects = texts(names(data.subjects), SUBJECTS_MAX);
  draft.coverCandidates = coverIds(data, details).map((id) => ({ url: coverUrl(id), source: "openlibrary" as const }));
  return draft;
}

export function createOpenLibrarySource(options: SourceClientOptions = {}): LookupSourceClient {
  const fetch = options.fetch ?? globalThis.fetch;
  const queue = options.queue ?? createQueue(OPEN_LIBRARY_SPACING_MS);
  const timeoutMs = options.timeoutMs ?? SOURCE_TIMEOUT_MS;
  const headers = { "User-Agent": USER_AGENT, Accept: "application/json" };

  const books = (isbn13: string, jscmd: "data" | "details") =>
    queue.run(() =>
      getJson("Open Library", `${OPEN_LIBRARY_ORIGIN}/api/books?bibkeys=ISBN:${isbn13}&jscmd=${jscmd}&format=json`, {
        fetch,
        timeoutMs,
        headers,
      }),
    );

  return {
    source: "openlibrary",
    enabled: true,
    async fetch(isbn13) {
      const data = await books(isbn13, "data");
      if (!record(record(data)?.[`ISBN:${isbn13}`])) return { data, details: null };
      return { data, details: await books(isbn13, "details") };
    },
    read: readOpenLibrary,
  };
}
