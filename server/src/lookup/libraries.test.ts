import { describe, expect, it } from "vitest";
import { fakeLibraries } from "../testing/fakeLibraries.js";
import { createLibrarySource, LIBRARIES, LIBRARY_ORDER, readLibrary } from "./libraries.js";
import { createQueue } from "./queue.js";

describe("createLibrarySource", () => {
  it("asks a 978 ISBN together with its ISBN-10, and caches the records as base64", async () => {
    const libraries = fakeLibraries(["biblacad-provence-isbn10"]);
    const source = createLibrarySource("biblacad", { connect: libraries.connect, queue: createQueue(0) });
    const response = await source.fetch("9789735761868");
    expect(libraries.calls[0]?.isbns).toEqual(["9789735761868", "9735761866"]);
    expect(response).toMatchObject({ hits: 1, records: [expect.stringMatching(/^[A-Za-z0-9+/]+=*$/)] });
    expect(JSON.parse(JSON.stringify(response))).toEqual(response); // what the cache stores
    expect(source.read("9789735761868", response)).toMatchObject({ title: "Un an în Provence", pages: 251 });
  });

  it("asks a 979 ISBN alone", async () => {
    const libraries = fakeLibraries();
    const source = createLibrarySource("bcucluj", { connect: libraries.connect, queue: createQueue(0) });
    expect(await source.fetch("9791234567896")).toEqual({ hits: 0, records: [] });
    expect(libraries.calls[0]?.isbns).toEqual(["9791234567896"]);
  });

  it("reads no records, or junk, as not found", () => {
    expect(readLibrary("9786064031365", { hits: 0, records: [] })).toBeNull();
    expect(readLibrary("9786064031365", { hits: 1, records: ["bm90IGEgcmVjb3Jk"] })).toBeNull();
    expect(readLibrary("9786064031365", null)).toBeNull();
    expect(readLibrary("9786064031365", { records: [42] })).toBeNull();
  });

  it("goes through its queue, one exchange at a time", async () => {
    const libraries = fakeLibraries(["bcucluj-piramida"]);
    let running = 0;
    let most = 0;
    const queue = createQueue(0);
    const counting = {
      run<T>(task: () => Promise<T>) {
        return queue.run(async () => {
          most = Math.max(most, ++running);
          try {
            return await task();
          } finally {
            running--;
          }
        });
      },
    };
    const source = createLibrarySource("bcucluj", { connect: libraries.connect, queue: counting });
    await Promise.all(["9786068044873", "9786064031365", "9789735761868"].map((isbn) => source.fetch(isbn)));
    expect(most).toBe(1);
    expect(libraries.calls).toHaveLength(3);
  });

  it("knows the three libraries, the Academy first", () => {
    expect(LIBRARY_ORDER).toEqual(["biblacad", "bcucluj", "bcutimisoara"]);
    expect(Object.values(LIBRARIES).map((target) => target.port)).toEqual([9991, 9991, 9991]);
    expect(LIBRARIES.bcucluj.syntax).toBe("usmarc");
  });
});
