/**
 * How often each metadata source finds a book: per ISBN list, per source,
 * how many ISBNs it found, how many came with a cover and with a page count
 * (the tables in corpus/wiki/metadata-lookup.md).
 *
 *     npx tsx server/scripts/measure-lookup.ts samples/ro-2019.txt samples/ro-2026.txt
 *
 * Each file holds ISBNs, one per line, in any spelling `parseIsbn` accepts;
 * blank lines and lines starting with `#` are skipped, anything else that
 * isn't an ISBN is counted and reported. Every source is asked about every
 * ISBN (not only when Open Library misses), through the app's own clients and
 * queues, with no cache, so the numbers are each source's own. Google Books is
 * measured only if `GOOGLE_BOOKS_API_KEY` is set (the repo's `.env` is read);
 * otherwise its row says it was skipped. Prints Markdown.
 *
 * Never point it at the national library's catalog: its CIP search sits
 * behind a CAPTCHA, and the app does not work around it. ISBN lists from its
 * published CIP bibliography PDFs are fine.
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { parseIsbn, type LookupSource } from "@shelfmark/shared";
import { createGoogleBooksSource } from "../src/lookup/googlebooks.js";
import type { LookupSourceClient, SourceDraft } from "../src/lookup/merge.js";
import { createOpenLibrarySource } from "../src/lookup/openlibrary.js";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));

try {
  process.loadEnvFile(`${REPO_ROOT}.env`);
} catch (err) {
  if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Usage: npx tsx server/scripts/measure-lookup.ts <isbn-list> [<isbn-list> ...]");
  process.exit(2);
}

const apiKey = process.env.GOOGLE_BOOKS_API_KEY?.trim() || undefined;
const sources: LookupSourceClient[] = [createOpenLibrarySource(), createGoogleBooksSource({ apiKey })];
const LABELS: Record<LookupSource, string> = { openlibrary: "Open Library", googlebooks: "Google Books" };

interface Tally {
  found: number;
  cover: number;
  pages: number;
  errors: number;
}

const empty = (): Tally => ({ found: 0, cover: 0, pages: 0, errors: 0 });

function count(tally: Tally, draft: SourceDraft | null): void {
  if (!draft) return;
  tally.found++;
  if (draft.coverCandidates.length > 0) tally.cover++;
  if (draft.pages !== null) tally.pages++;
}

function readList(file: string): { isbns: string[]; rejected: string[] } {
  const isbns: string[] = [];
  const rejected: string[] = [];
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const parsed = parseIsbn(line);
    if (parsed.ok) isbns.push(parsed.isbn13);
    else rejected.push(line);
  }
  return { isbns: [...new Set(isbns)], rejected };
}

for (const file of files) {
  const { isbns, rejected } = readList(file);
  const n = isbns.length;
  const tallies = new Map<LookupSource | "any", Tally>([["any", empty()]]);
  const asked = sources.filter((source) => source.enabled);
  for (const source of asked) tallies.set(source.source, empty());

  for (const [i, isbn13] of isbns.entries()) {
    process.stderr.write(`\r${basename(file)}: ${i + 1}/${n}`);
    const drafts: (SourceDraft | null)[] = [];
    for (const source of asked) {
      const tally = tallies.get(source.source)!;
      try {
        const draft = source.read(isbn13, await source.fetch(isbn13));
        count(tally, draft);
        drafts.push(draft);
      } catch {
        tally.errors++;
      }
    }
    const found = drafts.filter((draft) => draft !== null);
    // "Any": found by at least one; a cover or pages from at least one.
    const any = tallies.get("any")!;
    if (found.length > 0) any.found++;
    if (found.some((draft) => draft.coverCandidates.length > 0)) any.cover++;
    if (found.some((draft) => draft.pages !== null)) any.pages++;
  }
  process.stderr.write("\n");

  const cell = (value: number) => `${value}/${n}`;
  console.log(`\n### ${basename(file)}: ${n} ISBNs${rejected.length ? `, ${rejected.length} line${rejected.length === 1 ? "" : "s"} skipped (not ISBNs)` : ""}\n`);
  console.log("| Source | Found | With cover | With page count | Errors |");
  console.log("|---|---|---|---|---|");
  for (const source of sources) {
    const tally = tallies.get(source.source);
    if (!tally) {
      console.log(`| ${LABELS[source.source]} | skipped: no GOOGLE_BOOKS_API_KEY | | | |`);
      continue;
    }
    console.log(`| ${LABELS[source.source]} | ${cell(tally.found)} | ${cell(tally.cover)} | ${cell(tally.pages)} | ${tally.errors} |`);
  }
  const any = tallies.get("any")!;
  console.log(`| Any of them | ${cell(any.found)} | ${cell(any.cover)} | ${cell(any.pages)} | |`);
  for (const line of rejected) console.error(`skipped: ${line}`);
}
