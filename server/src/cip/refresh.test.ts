import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createQueue } from "../lookup/queue.js";
import { fakeFetch, json, type FakeHandler } from "../testing/fakeFetch.js";
import { NoPdfToText, refreshCip, type Log } from "./refresh.js";
import { openCipStore } from "./store.js";

const MEDIA = JSON.parse(readFileSync(new URL("./fixtures/media-page.json", import.meta.url), "utf8")) as unknown[];
const EXCERPT = readFileSync(new URL("./fixtures/cip-2026-02-excerpt.txt", import.meta.url), "utf8");
const PDF = Buffer.from("%PDF-1.7 not really");

function setup(handler?: FakeHandler, extractText: (pdf: Buffer) => Promise<string> = async () => EXCERPT) {
  const store = openCipStore(":memory:");
  const lines: string[] = [];
  const log: Log = {
    info: (m) => lines.push(`info ${m}`),
    warn: (m) => lines.push(`warn ${m}`),
    error: (m) => lines.push(`error ${m}`),
  };
  const fetch = fakeFetch(
    handler ??
      ((url) =>
        url.pathname.startsWith("/wp-json/")
          ? json(MEDIA)
          : new Response(new Uint8Array(PDF), { headers: { "content-type": "application/pdf" } })),
  );
  const run = () => refreshCip({ store, fetch, log, queue: createQueue(0), extractText, minRecords: 5 });
  return { store, fetch, lines, run };
}

describe("refreshCip", () => {
  it("imports every issue on the site, newest first, then nothing the next time", async () => {
    const { store, fetch, run } = setup();
    const first = await run();
    expect(first.imported.map((i) => i.month)).toEqual(["2026-03", "2026-02", "2026-01", "2025-03", "2024-09", "2023-07", "2019-01"]);
    expect(first.failed).toEqual([]);
    expect(store.get("9786064031365")?.title).toBe("Ce ne facem cu atîția proști?");
    const downloads = fetch.calls.filter((call) => call.url.pathname.endsWith(".pdf"));
    expect(downloads).toHaveLength(7);
    expect(downloads.every((call) => call.headers.get("user-agent")?.startsWith("Shelfmark/"))).toBe(true);

    fetch.calls.length = 0;
    const second = await run();
    expect(second).toEqual({ imported: [], failed: [] });
    expect(fetch.calls.map((call) => call.url.pathname)).toEqual(["/wp-json/wp/v2/media"]);
  });

  it("fetches only the months asked, again if they were imported", async () => {
    const { fetch, store, run } = setup();
    await run();
    fetch.calls.length = 0;
    const again = await refreshCip({
      store,
      fetch,
      log: { info() {}, warn() {}, error() {} },
      queue: createQueue(0),
      extractText: async () => EXCERPT,
      minRecords: 5,
      months: ["2026-02", "2018-01"],
    });
    expect(again.imported.map((i) => i.month)).toEqual(["2026-02"]);
    expect(fetch.calls.filter((call) => call.url.pathname.endsWith(".pdf"))).toHaveLength(1);
  });

  it("leaves out an issue that parses to too few records, and tries it again next time", async () => {
    const { store, lines, run } = setup(undefined, async () => "not an issue at all");
    const result = await run();
    expect(result.imported).toEqual([]);
    expect(result.failed).toHaveLength(7);
    expect(store.importedMonths().size).toBe(0);
    expect(lines).toContain("warn cip: 2026-03 parsed to 0 records, too few for an issue; not imported");
  });

  it("goes on past an issue that fails to download", async () => {
    const { store, run } = setup((url) =>
      url.pathname.startsWith("/wp-json/")
        ? json(MEDIA)
        : url.pathname.includes("martie-2026")
          ? new Response("gone", { status: 404 })
          : new Response(new Uint8Array(PDF)),
    );
    const result = await run();
    expect(result.failed).toEqual(["2026-03"]);
    expect(result.imported).toHaveLength(6);
    expect(store.importedMonths().has("2026-03")).toBe(false);
  });

  it("refuses an issue over 20 MB without reading it", async () => {
    const { run } = setup((url) =>
      url.pathname.startsWith("/wp-json/")
        ? json(MEDIA.slice(0, 1))
        : new Response(new Uint8Array(PDF), { headers: { "content-length": String(30 * 1024 * 1024) } }),
    );
    expect((await run()).failed).toEqual(["2026-03"]);
  });

  it("stops at once when pdftotext isn't installed", async () => {
    let asked = 0;
    const { fetch, lines, run } = setup(undefined, async () => {
      asked++;
      throw new NoPdfToText();
    });
    const result = await run();
    expect(asked).toBe(1);
    expect(result.failed).toHaveLength(7);
    expect(fetch.calls.filter((call) => call.url.pathname.endsWith(".pdf"))).toHaveLength(1);
    expect(lines.filter((line) => line.startsWith("error"))).toEqual([
      "error cip: pdftotext is not installed (poppler-utils), so the CIP lists can't be read",
    ]);
  });

  it("fails whole when the listing fails", async () => {
    const { run } = setup(() => json({}, 500));
    await expect(run()).rejects.toThrow("The national library's site answered 500");
  });
});
