/**
 * Records the library catalogs' Z39.50 answers as test fixtures
 * (server/src/lookup/z3950/fixtures/<name>.json): each fixture is the
 * target, the ISBNs asked, and every PDU the server sent, in base64, which
 * the fake server in testing/fakeLibraries.ts replays.
 *
 *     npx tsx server/scripts/record-z3950.ts [<fixture name> ...]
 *
 * With names, only those cases are recorded again.
 * It asks the real servers, one request at a time per library with the
 * lookup's own 5-10 s pause, so run it only to refresh the fixtures.
 */
import { writeFileSync } from "node:fs";
import { connect as netConnect } from "node:net";
import { fileURLToPath } from "node:url";
import { to10 } from "@shelfmark/shared";
import { decode } from "../src/lookup/z3950/ber.js";
import { searchIsbns, type Connect, type Target } from "../src/lookup/z3950/client.js";
import { LIBRARIES, LIBRARY_TIMEOUT_MS, readLibrary, type LibrarySource } from "../src/lookup/libraries.js";
import { APP_VERSION } from "../src/lookup/openlibrary.js";
import { createQueue, LIBRARY_SPACING, type Queue } from "../src/lookup/queue.js";

const FIXTURES = fileURLToPath(new URL("../src/lookup/z3950/fixtures/", import.meta.url));

interface Case {
  name: string;
  library: LibrarySource;
  isbn13: string;
  /** Override the target's record syntax, to record a diagnostic. */
  syntax?: Target["syntax"];
}

const CASES: Case[] = [
  { name: "biblacad-piramida", library: "biblacad", isbn13: "9786068044873" },
  { name: "biblacad-provence-isbn10", library: "biblacad", isbn13: "9789735761868" },
  { name: "bcucluj-piramida", library: "bcucluj", isbn13: "9786068044873" },
  { name: "bcucluj-not-found", library: "bcucluj", isbn13: "9786064031365" },
  { name: "bcucluj-unimarc-refused", library: "bcucluj", isbn13: "9786068044873", syntax: "unimarc" },
  { name: "bcutimisoara-paleologu", library: "bcutimisoara", isbn13: "9786064031365" },
];

/** Splits what a server sent into its PDUs. */
function pdus(stream: Buffer): Buffer[] {
  const out: Buffer[] = [];
  for (let rest = stream; rest.length > 0; ) {
    const { end } = decode(rest);
    out.push(rest.subarray(0, end));
    rest = rest.subarray(end);
  }
  return out;
}

const queues = new Map<LibrarySource, Queue>();
const queueFor = (library: LibrarySource) => {
  if (!queues.has(library)) queues.set(library, createQueue(LIBRARY_SPACING));
  return queues.get(library)!;
};

const only = process.argv.slice(2);

await Promise.all(
  CASES.filter((testCase) => only.length === 0 || only.includes(testCase.name)).map(async (testCase) => {
    const target = { ...LIBRARIES[testCase.library], ...(testCase.syntax ? { syntax: testCase.syntax } : {}) };
    const isbn10 = to10(testCase.isbn13);
    const isbns = isbn10 === null ? [testCase.isbn13] : [testCase.isbn13, isbn10];
    const received: Buffer[] = [];
    const connect: Connect = (host, port) => {
      const socket = netConnect({ host, port });
      socket.on("data", (chunk: Buffer) => received.push(chunk));
      return socket;
    };

    let outcome: string;
    try {
      const result = await queueFor(testCase.library).run(() =>
        searchIsbns(target, isbns, {
          connect,
          timeoutMs: LIBRARY_TIMEOUT_MS,
          maxRecords: 5,
          implementation: { name: "Shelfmark", version: APP_VERSION },
        }),
      );
      const draft = readLibrary(testCase.isbn13, { records: result.records.map((r) => r.toString("base64")) });
      outcome = `${result.hits} hits; ${draft ? `${draft.title} / ${draft.authors.join(", ")} / ${draft.publisher} ${draft.publishedYear}, ${draft.pages} p.` : "no draft"}`;
    } catch (error) {
      outcome = `error: ${(error as Error).message}`;
    }

    const fixture = {
      recorded: new Date().toISOString().slice(0, 10),
      library: testCase.library,
      syntax: target.syntax,
      isbns,
      answers: pdus(Buffer.concat(received)).map((pdu) => pdu.toString("base64")),
    };
    writeFileSync(`${FIXTURES}${testCase.name}.json`, `${JSON.stringify(fixture, null, 2)}\n`);
    console.log(`${testCase.name}: ${outcome} (${fixture.answers.length} PDUs)`);
  }),
);
