import { readFileSync } from "node:fs";
import { Duplex } from "node:stream";
import { CONTEXT, decode, type Tlv } from "../lookup/z3950/ber.js";
import type { Connect } from "../lookup/z3950/client.js";
import { LIBRARIES, type LibrarySource } from "../lookup/libraries.js";

/**
 * The library catalogs for tests, so none touches the network: a fake
 * `connect` whose connections answer in memory from the PDUs recorded in
 * lookup/z3950/fixtures/ (server/scripts/record-z3950.ts). It answers the
 * Init with the library's recorded Init answer, a Search for a recorded ISBN
 * with that fixture's answers, and a Search for any other ISBN with "0 hits".
 *
 *     const libraries = fakeLibraries(["biblacad-piramida"]);
 *     const t = await startTestApp({}, { connect: libraries.connect });
 *     // ... libraries.calls
 *
 * `silent` libraries accept the connection and never answer (a timeout);
 * `refused` ones fail it at once. `split` sends every answer in two chunks.
 */

export interface Fixture {
  recorded: string;
  library: LibrarySource;
  syntax: string;
  isbns: string[];
  /** Base64 PDUs: Init answer, Search answer, then Present answer when there were hits. */
  answers: string[];
}

export const FIXTURE_NAMES = [
  "biblacad-piramida",
  "biblacad-provence-isbn10",
  "bcucluj-piramida",
  "bcucluj-not-found",
  "bcucluj-unimarc-refused",
  "bcutimisoara-paleologu",
] as const;
export type FixtureName = (typeof FIXTURE_NAMES)[number];

export function loadFixture(name: FixtureName): Fixture {
  return JSON.parse(readFileSync(new URL(`../lookup/z3950/fixtures/${name}.json`, import.meta.url), "utf8")) as Fixture;
}

/** The answers' bytes, decoded from base64. */
export function fixtureAnswers(name: FixtureName): Buffer[] {
  return loadFixture(name).answers.map((answer) => Buffer.from(answer, "base64"));
}

/** A SearchResponse: 0 hits, search succeeded. */
const NO_HITS = Buffer.from("b70c97010098010099010196 01ff".replace(/ /g, ""), "hex");

export interface LibraryCall {
  library: LibrarySource;
  /** Each request's PDU tag: 20 Init, 22 Search, 24 Present. */
  requests: number[];
  /** The ISBNs the Search asked, in order. */
  isbns: string[];
}

export interface FakeLibraries {
  connect: Connect;
  calls: LibraryCall[];
}

export interface FakeLibrariesOptions {
  silent?: LibrarySource[];
  refused?: LibrarySource[];
  split?: boolean;
}

function terms(tlv: Tlv): string[] {
  if (tlv.cls === CONTEXT && tlv.tag === 45 && !tlv.constructed) return [tlv.value.toString("utf8")];
  return (tlv.children ?? []).flatMap(terms);
}

export function fakeLibraries(names: readonly FixtureName[] = [], options: FakeLibrariesOptions = {}): FakeLibraries {
  const fixtures = names.map(loadFixture);
  const calls: LibraryCall[] = [];
  const libraryAt = (host: string) =>
    (Object.keys(LIBRARIES) as LibrarySource[]).find((library) => LIBRARIES[library].host === host);

  const connect: Connect = (host, port) => {
    const library = libraryAt(host);
    if (!library || port !== LIBRARIES[library].port) throw new Error(`no fake library at ${host}:${port}`);
    const call: LibraryCall = { library, requests: [], isbns: [] };
    calls.push(call);
    const own = fixtures.filter((fixture) => fixture.library === library);
    // Any recorded Init answer of this library will do; fall back on another library's.
    const init = (own[0] ?? loadFixture("bcucluj-not-found")).answers[0]!;
    let chosen: Fixture | undefined;

    const socket: Duplex = new Duplex({
      read() {},
      write(chunk: Buffer, _encoding, done) {
        done();
        if (options.silent?.includes(library)) return;
        const { tlv } = decode(chunk);
        call.requests.push(tlv.tag);
        let answer: Buffer | undefined;
        if (tlv.tag === 20) answer = Buffer.from(init, "base64");
        if (tlv.tag === 22) {
          call.isbns = terms(tlv);
          chosen = own.find((fixture) => fixture.isbns.join() === call.isbns.join());
          answer = chosen ? Buffer.from(chosen.answers[1]!, "base64") : NO_HITS;
        }
        if (tlv.tag === 24 && chosen?.answers[2]) answer = Buffer.from(chosen.answers[2], "base64");
        if (!answer) return;
        const reply = answer;
        setImmediate(() => {
          if (socket.destroyed) return;
          if (options.split && reply.length > 4) {
            socket.push(reply.subarray(0, 3));
            setImmediate(() => socket.destroyed || socket.push(reply.subarray(3)));
          } else {
            socket.push(reply);
          }
        });
      },
      final(done) {
        done();
        socket.push(null);
      },
    });

    if (options.refused?.includes(library)) {
      queueMicrotask(() => socket.destroy(Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" })));
    }
    return socket;
  };

  return { connect, calls };
}
