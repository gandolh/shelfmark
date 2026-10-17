import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { USER_AGENT } from "../lookup/openlibrary.js";
import { createQueue, LIBRARY_SPACING, type Queue } from "../lookup/queue.js";
import { listIssues, type Issue } from "./issues.js";
import { parseIssue } from "./parse.js";
import type { CipStore } from "./store.js";

/**
 * Brings the CIP index up to date: lists the issues on the national library's
 * site, then downloads each one not yet imported, newest first, converts it
 * with `pdftotext -layout` and stores its records. One request at a time to
 * the site, with the same random 5-10 s pause the library catalogs get. An
 * issue that fails, or parses to too few records to be a whole issue (a
 * changed layout), is left out and tried again next time.
 */

/** An issue holds about 2,000-3,000 records; fewer than this means the parser no longer fits the layout. */
export const MIN_RECORDS = 1000;
export const MAX_PDF_BYTES = 20 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 120_000;

export interface Log {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface RefreshOptions {
  store: CipStore;
  fetch: typeof globalThis.fetch;
  log: Log;
  /** Default: one at the polite pace. */
  queue?: Queue;
  /** PDF bytes to `pdftotext -layout` text. Tests pass a fake. */
  extractText?: (pdf: Buffer) => Promise<string>;
  minRecords?: number;
  /** Only these months (`YYYY-MM`), imported again even if they were before. Default: every month not yet imported. */
  months?: readonly string[];
}

export interface RefreshResult {
  imported: { month: string; records: number }[];
  failed: string[];
}

/** Thrown when `pdftotext` isn't installed: no issue can be read, so the refresh stops. */
export class NoPdfToText extends Error {
  constructor() {
    super("pdftotext is not installed (poppler-utils), so the CIP lists can't be read");
  }
}

/** `pdftotext -layout` on the bytes, through a temporary file. */
export async function pdfToText(pdf: Buffer): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "shelfmark-cip-"));
  const file = join(dir, "issue.pdf");
  try {
    await writeFile(file, pdf);
    return await new Promise<string>((resolve, reject) => {
      execFile("pdftotext", ["-layout", "-enc", "UTF-8", file, "-"], { maxBuffer: 64 * 1024 * 1024 }, (error, stdout) => {
        if ((error as NodeJS.ErrnoException | null)?.code === "ENOENT") reject(new NoPdfToText());
        else if (error) reject(new Error(`pdftotext failed: ${error.message}`, { cause: error }));
        else resolve(stdout);
      });
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** The PDF's bytes, at most `MAX_PDF_BYTES`. */
async function download(fetch: typeof globalThis.fetch, url: string): Promise<Buffer> {
  let response: Response;
  try {
    response = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  } catch (error) {
    throw new Error("the national library's site could not be reached", { cause: error });
  }
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new Error(`the national library's site answered ${response.status}`);
  }
  const declared = Number(response.headers.get("content-length"));
  if (declared > MAX_PDF_BYTES) {
    await response.body.cancel();
    throw new Error(`the issue is ${declared} bytes, over the ${MAX_PDF_BYTES} limit`);
  }
  const parts: Uint8Array[] = [];
  let size = 0;
  for await (const part of response.body) {
    size += part.length;
    if (size > MAX_PDF_BYTES) throw new Error(`the issue is over the ${MAX_PDF_BYTES} byte limit`);
    parts.push(part);
  }
  return Buffer.concat(parts);
}

export async function refreshCip(options: RefreshOptions): Promise<RefreshResult> {
  const { store, fetch, log } = options;
  const queue = options.queue ?? createQueue(LIBRARY_SPACING);
  const extractText = options.extractText ?? pdfToText;
  const minRecords = options.minRecords ?? MIN_RECORDS;

  const issues = await listIssues(fetch, queue);
  const done = store.importedMonths();
  const { months } = options;
  const todo = issues.filter((issue: Issue) => (months ? months.includes(issue.month) : !done.has(issue.month)));
  log.info(`cip: ${issues.length} issues on the site, ${todo.length} to import`);

  const result: RefreshResult = { imported: [], failed: [] };
  for (const issue of todo) {
    try {
      const pdf = await queue.run(() => download(fetch, issue.url));
      const records = parseIssue(await extractText(pdf));
      if (records.length < minRecords) {
        log.warn(`cip: ${issue.month} parsed to ${records.length} records, too few for an issue; not imported`);
        result.failed.push(issue.month);
        continue;
      }
      store.importIssue(issue, records);
      result.imported.push({ month: issue.month, records: records.length });
      log.info(`cip: imported ${issue.month}, ${records.length} records`);
    } catch (error) {
      if (error instanceof NoPdfToText) {
        log.error(`cip: ${error.message}`);
        result.failed.push(...todo.slice(todo.indexOf(issue)).map((left) => left.month));
        break;
      }
      log.warn(`cip: ${issue.month} failed: ${error instanceof Error ? error.message : String(error)}`);
      result.failed.push(issue.month);
    }
  }
  return result;
}
