import { connect as netConnect } from "node:net";
import type { Duplex } from "node:stream";
import { decode, Incomplete } from "./ber.js";
import { initRequest, presentRequest, readAnswer, searchRequest, type Answer, type RecordSyntax } from "./protocol.js";

/**
 * One Z39.50 exchange per lookup: connect, Init, Search, Present when there
 * are hits, then close. The whole exchange has one deadline. Errors name the
 * library and what went wrong, never more.
 */

/** Opens a TCP connection. `FeatureContext.connect`: tests pass one that reaches a fake server. */
export type Connect = (host: string, port: number) => Duplex;

export const netConnection: Connect = (host, port) => netConnect({ host, port });

export interface Target {
  /** For messages: "BCU Cluj". */
  label: string;
  host: string;
  port: number;
  database: string;
  syntax: RecordSyntax;
}

export interface SearchResult {
  hits: number;
  /** ISO 2709 records, as sent. At most `maxRecords`. */
  records: Buffer[];
}

export interface ExchangeOptions {
  connect: Connect;
  timeoutMs: number;
  maxRecords: number;
  implementation: { name: string; version: string };
}

/** An answer bigger than this is not a book record. */
const MAX_ANSWER_BYTES = 4 * 1024 * 1024;

/** The ISBNs (OR-ed) on `target`'s ISBN index, and the first records found. */
export function searchIsbns(target: Target, isbns: readonly string[], options: ExchangeOptions): Promise<SearchResult> {
  const { label } = target;
  return new Promise<SearchResult>((resolve, reject) => {
    let socket: Duplex;
    let buffered = Buffer.alloc(0);
    let waiting: ((answer: Answer) => void) | null = null;
    let settled = false;

    const finish = (error: Error | null, result?: SearchResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket?.destroy();
      if (error) reject(error);
      else resolve(result!);
    };

    const timer = setTimeout(() => {
      const error = new Error(`${label} did not answer within ${options.timeoutMs / 1000} s`);
      error.name = "TimeoutError";
      finish(error);
    }, options.timeoutMs);

    const ask = (pdu: Buffer) =>
      new Promise<Answer>((answered) => {
        waiting = answered;
        socket.write(pdu);
      });

    try {
      socket = options.connect(target.host, target.port);
    } catch (error) {
      finish(new Error(`${label} could not be reached`, { cause: error }));
      return;
    }

    socket.on("data", (chunk: Buffer) => {
      buffered = Buffer.concat([buffered, chunk]);
      if (buffered.length > MAX_ANSWER_BYTES) {
        finish(new Error(`${label} sent an answer that is too large`));
        return;
      }
      let end: number;
      try {
        end = decode(buffered).end;
      } catch (error) {
        if (error instanceof Incomplete) return;
        finish(new Error(`${label} sent an answer that is not Z39.50`, { cause: error }));
        return;
      }
      const pdu = buffered.subarray(0, end);
      buffered = buffered.subarray(end);
      let answer: Answer;
      try {
        answer = readAnswer(pdu);
      } catch (error) {
        finish(new Error(`${label} sent an answer that is not Z39.50`, { cause: error }));
        return;
      }
      const deliver = waiting;
      waiting = null;
      if (deliver) deliver(answer);
    });
    socket.on("error", (error) => finish(new Error(`${label} could not be reached`, { cause: error })));
    socket.on("close", () => finish(new Error(`${label} closed the connection`)));

    const run = async (): Promise<SearchResult> => {
      const init = await ask(initRequest(options.implementation));
      if (init.kind !== "init" || !init.accepted) throw new Error(`${label} refused the connection`);

      const search = await ask(searchRequest(target.database, isbns, target.syntax));
      if (search.kind !== "search") throw new Error(`${label} sent an unexpected answer`);
      if (search.diagnostic || !search.ok) {
        throw new Error(`${label} could not search (diagnostic ${search.diagnostic?.condition ?? "none"})`);
      }
      if (search.hits === 0) return { hits: 0, records: [] };

      const present = await ask(presentRequest(Math.min(search.hits, options.maxRecords), target.syntax));
      if (present.kind !== "present") throw new Error(`${label} sent an unexpected answer`);
      if (present.diagnostic) {
        throw new Error(`${label} could not send the record (diagnostic ${present.diagnostic.condition})`);
      }
      return { hits: search.hits, records: present.records };
    };

    run().then(
      (result) => {
        socket.end();
        finish(null, result);
      },
      (error: Error) => finish(error),
    );
  });
}
