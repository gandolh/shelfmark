import { to10, type LookupSource } from "@shelfmark/shared";
import type { LookupSourceClient, SourceDraft } from "./merge.js";
import { array, record } from "./merge.js";
import { APP_VERSION } from "./openlibrary.js";
import { createQueue, LIBRARY_SPACING, type Queue } from "./queue.js";
import { netConnection, searchIsbns, type Connect, type Target } from "./z3950/client.js";
import { readUnimarc, recordFor } from "./z3950/unimarc.js";

/**
 * Three Romanian library catalogs, asked over Z39.50 (metadata-lookup.md,
 * 2026-10-17): they hold most Romanian books more than a year old, which Open
 * Library and Google mostly don't. They publish no limits, so each has its own
 * queue with a random 5-10 s pause after every request, and the lookup asks
 * them only while nothing earlier has a title. A 978 ISBN is asked together
 * with its ISBN-10, because books from before 2007 are catalogued under it.
 * The raw answer, as cached, is `{ hits, records }` with each ISO 2709
 * record in base64.
 */

export type LibrarySource = Extract<LookupSource, "biblacad" | "bcucluj" | "bcutimisoara">;

/** In the order a lookup asks them: the Academy (a legal deposit library) has the most of the last few years. */
export const LIBRARIES: Readonly<Record<LibrarySource, Target>> = {
  biblacad: {
    label: "The Romanian Academy Library",
    host: "aleph23.biblacad.ro",
    port: 9991,
    database: "RAL01",
    syntax: "unimarc",
  },
  bcucluj: {
    label: "BCU Cluj",
    host: "aleph.bcucluj.ro",
    port: 9991,
    database: "CUC01",
    // It offers only USMARC, OPAC, XML and SUTRS; the USMARC records hold UNIMARC.
    syntax: "usmarc",
  },
  bcutimisoara: {
    label: "BCU Timișoara",
    host: "193.230.238.122",
    port: 9991,
    database: "CUT01",
    syntax: "unimarc",
  },
};

export const LIBRARY_ORDER: readonly LibrarySource[] = ["biblacad", "bcucluj", "bcutimisoara"];

/** For the whole exchange: connect, Init, Search, Present. */
export const LIBRARY_TIMEOUT_MS = 10_000;
const MAX_RECORDS = 5;

/** The draft fields in `{ hits, records }`; `null` when there are none. */
export function readLibrary(isbn13: string, response: unknown): SourceDraft | null {
  const records = array(record(response)?.records)
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => Buffer.from(entry, "base64"));
  const fields = recordFor(isbn13, records);
  return fields ? readUnimarc(fields) : null;
}

export interface LibrarySourceOptions {
  /** Default: a real TCP connection. Tests pass one that reaches a fake server. */
  connect?: Connect;
  /** Default: a fresh queue at the libraries' pace. */
  queue?: Queue;
  timeoutMs?: number;
}

export function createLibrarySource(source: LibrarySource, options: LibrarySourceOptions = {}): LookupSourceClient {
  const target = LIBRARIES[source];
  const connect = options.connect ?? netConnection;
  const queue = options.queue ?? createQueue(LIBRARY_SPACING);
  const timeoutMs = options.timeoutMs ?? LIBRARY_TIMEOUT_MS;

  return {
    source,
    enabled: true,
    async fetch(isbn13) {
      const isbn10 = to10(isbn13);
      const isbns = isbn10 === null ? [isbn13] : [isbn13, isbn10];
      const { hits, records } = await queue.run(() =>
        searchIsbns(target, isbns, {
          connect,
          timeoutMs,
          maxRecords: MAX_RECORDS,
          implementation: { name: "Shelfmark", version: APP_VERSION },
        }),
      );
      return { hits, records: records.map((bytes) => bytes.toString("base64")) };
    },
    read: readLibrary,
  };
}
