import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { CipRecord } from "./parse.js";
import { cipDatabasePath, openCipStore, type CipStore } from "./store.js";

let store: CipStore | undefined;
afterEach(() => {
  store?.close();
  store = undefined;
});

const issue = (month: string) => ({ month, url: `https://bibnat.ro/wp-content/uploads/x/CIP_${month}.pdf`, uploaded: `${month}-20` });
const record = (isbn13: string, fields: Partial<CipRecord> = {}): CipRecord => ({
  isbn13,
  entry: 1,
  title: "Ce ne facem cu atîția proști?",
  subtitle: null,
  authors: ["Theodor Paleologu"],
  publisher: "Editura Trei",
  city: "București",
  year: 2026,
  ...fields,
});

describe("the CIP store", () => {
  it("stores an issue's records and remembers the month", () => {
    store = openCipStore(":memory:");
    store.importIssue(issue("2026-02"), [record("9786064031365"), record("9789735091378", { title: "Opera integrală", authors: ["Platon"] })]);
    expect(store.importedMonths()).toEqual(new Set(["2026-02"]));
    expect(store.size()).toBe(2);
    expect(store.get("9786064031365")).toEqual({ ...record("9786064031365"), month: "2026-02" });
    expect(store.get("9780547928227")).toBeUndefined();
  });

  it("keeps the later issue's record, in whatever order the issues come", () => {
    store = openCipStore(":memory:");
    store.importIssue(issue("2026-03"), [record("9786064031365", { title: "Corrected title" })]);
    store.importIssue(issue("2026-02"), [record("9786064031365", { title: "First title" })]);
    expect(store.get("9786064031365")?.title).toBe("Corrected title");
    store.importIssue(issue("2026-04"), [record("9786064031365", { title: "Final title" })]);
    expect(store.get("9786064031365")).toMatchObject({ title: "Final title", month: "2026-04" });
  });

  it("imports an issue whole or not at all", () => {
    store = openCipStore(":memory:");
    expect(() => store!.importIssue(issue("2026-02"), [record("9786064031365"), record("not an isbn")])).toThrow();
    expect(store.size()).toBe(0);
    expect(store.importedMonths().size).toBe(0);
  });

  it("lives in its own file next to shelfmark.db, and survives a reopen", async () => {
    const dir = await mkdtemp(join(tmpdir(), "shelfmark-cip-"));
    try {
      expect(cipDatabasePath(dir)).toBe(join(dir, "cip.db"));
      store = openCipStore(cipDatabasePath(join(dir, "nested")));
      store.importIssue(issue("2026-02"), [record("9786064031365")]);
      store.close();
      store = openCipStore(cipDatabasePath(join(dir, "nested")));
      expect(store.get("9786064031365")?.authors).toEqual(["Theodor Paleologu"]);
    } finally {
      store?.close();
      store = undefined;
      await rm(dir, { recursive: true, force: true });
    }
  });
});
