import { Duplex } from "node:stream";
import { to10 } from "@shelfmark/shared";
import { describe, expect, it } from "vitest";
import { fakeLibraries, fixtureAnswers } from "../../testing/fakeLibraries.js";
import { LIBRARIES } from "../libraries.js";
import { searchIsbns, type Connect, type ExchangeOptions } from "./client.js";

const PIRAMIDA = ["9786068044873", to10("9786068044873")!];
const PALEOLOGU = ["9786064031365", to10("9786064031365")!];

const options = (connect: Connect, timeoutMs = 2_000): ExchangeOptions => ({
  connect,
  timeoutMs,
  maxRecords: 5,
  implementation: { name: "Shelfmark", version: "test" },
});

/** A server that answers the Init with `reply` and then nothing. */
function answering(reply: Buffer): Connect {
  return () => {
    const socket: Duplex = new Duplex({
      read() {},
      write(_chunk, _encoding, done) {
        done();
        setImmediate(() => socket.push(reply));
      },
    });
    return socket;
  };
}

describe("searchIsbns", () => {
  it("does Init, Search and Present, and returns the records", async () => {
    const libraries = fakeLibraries(["biblacad-piramida"]);
    const result = await searchIsbns(LIBRARIES.biblacad, PIRAMIDA, options(libraries.connect));
    expect(result.hits).toBe(1);
    expect(result.records).toHaveLength(1);
    expect(libraries.calls).toEqual([{ library: "biblacad", requests: [20, 22, 24], isbns: PIRAMIDA }]);
  });

  it("sends no Present when there are no hits", async () => {
    const libraries = fakeLibraries(["bcucluj-not-found"]);
    const result = await searchIsbns(LIBRARIES.bcucluj, PALEOLOGU, options(libraries.connect));
    expect(result).toEqual({ hits: 0, records: [] });
    expect(libraries.calls[0]?.requests).toEqual([20, 22]);
  });

  it("puts an answer together that arrives in pieces", async () => {
    const libraries = fakeLibraries(["bcutimisoara-paleologu"], { split: true });
    const result = await searchIsbns(LIBRARIES.bcutimisoara, PALEOLOGU, options(libraries.connect));
    expect(result.records).toHaveLength(1);
  });

  it("fails on a diagnostic, naming the library and the condition", async () => {
    const libraries = fakeLibraries(["bcucluj-unimarc-refused"]);
    await expect(
      searchIsbns({ ...LIBRARIES.bcucluj, syntax: "unimarc" }, PIRAMIDA, options(libraries.connect)),
    ).rejects.toThrow("BCU Cluj could not send the record (diagnostic 238)");
  });

  it("times out a library that never answers, as a TimeoutError", async () => {
    const libraries = fakeLibraries([], { silent: ["bcutimisoara"] });
    const error = await searchIsbns(LIBRARIES.bcutimisoara, ["9786064031365"], options(libraries.connect, 50)).catch(
      (e: unknown) => e as Error,
    );
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).name).toBe("TimeoutError");
    expect((error as Error).message).toBe("BCU Timișoara did not answer within 0.05 s");
  });

  it("fails when the connection is refused, or closed halfway", async () => {
    const refused = fakeLibraries([], { refused: ["bcucluj"] });
    await expect(searchIsbns(LIBRARIES.bcucluj, ["9786064031365"], options(refused.connect))).rejects.toThrow(
      "BCU Cluj could not be reached",
    );

    const [init] = fixtureAnswers("bcucluj-not-found");
    const closing: Connect = () => {
      const socket: Duplex = new Duplex({
        read() {},
        write(_chunk, _encoding, done) {
          done();
          setImmediate(() => {
            socket.push(init);
            socket.push(null); // and hangs up before the search
          });
        },
      });
      return socket;
    };
    await expect(searchIsbns(LIBRARIES.bcucluj, ["9786064031365"], options(closing))).rejects.toThrow(
      /BCU Cluj (closed the connection|could not be reached)/,
    );
  });

  it("fails on an answer that isn't Z39.50, or a refused Init", async () => {
    // "HTTP/1.1 ..." reads as the start of a long element, so it ends as a timeout or as junk.
    await expect(
      searchIsbns(LIBRARIES.bcucluj, ["9786064031365"], options(answering(Buffer.from("HTTP/1.1 400 Bad Request\r\n")), 100)),
    ).rejects.toThrow(/BCU Cluj (sent an answer that is not Z39.50|did not answer)/);

    const refusedInit = Buffer.from("b5038c0100", "hex"); // initResponse, result FALSE
    await expect(searchIsbns(LIBRARIES.bcucluj, ["9786064031365"], options(answering(refusedInit)))).rejects.toThrow(
      "BCU Cluj refused the connection",
    );
  });

  it("fails when connect itself throws", async () => {
    const throwing: Connect = () => {
      throw new Error("getaddrinfo ENOTFOUND");
    };
    await expect(searchIsbns(LIBRARIES.biblacad, ["9786068044873"], options(throwing))).rejects.toThrow(
      "The Romanian Academy Library could not be reached",
    );
  });
});
