import { describe, expect, it } from "vitest";
import { DEFAULT_ORDER, DEFAULT_VISIBILITY, defaultPrefs, prefsKey, readPrefs, writePrefs, type PrefsStorage } from "./prefs";
import { DEFAULT_SORTING } from "./sort";

function memoryStorage(initial: Record<string, string> = {}): PrefsStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

const throwing: PrefsStorage = {
  getItem: () => {
    throw new DOMException("The operation is insecure.", "SecurityError");
  },
  setItem: () => {
    throw new DOMException("Quota exceeded", "QuotaExceededError");
  },
};

describe("readPrefs", () => {
  it("defaults to the table on a desktop and covers on a phone", () => {
    expect(readPrefs(memoryStorage(), "desktop").view).toBe("table");
    expect(readPrefs(memoryStorage(), "phone").view).toBe("covers");
    expect(readPrefs(null, "desktop")).toEqual(defaultPrefs("desktop"));
  });

  it("shows book, publisher, year, shelf, status and added by default, newest first", () => {
    const prefs = defaultPrefs("desktop");
    expect(prefs.columnOrder.filter((id) => prefs.columnVisibility[id])).toEqual([
      "book",
      "publisher",
      "year",
      "shelf",
      "status",
      "added",
    ]);
    expect(prefs.sorting).toEqual(DEFAULT_SORTING);
  });

  it("falls back to the defaults when storage throws", () => {
    expect(readPrefs(throwing, "desktop")).toEqual(defaultPrefs("desktop"));
  });

  it("falls back to the defaults on a value that isn't JSON or isn't an object", () => {
    for (const raw of ["{not json", "null", "42", '"table"', "[1,2]"]) {
      expect(readPrefs(memoryStorage({ [prefsKey("phone")]: raw }), "phone")).toEqual(defaultPrefs("phone"));
    }
  });

  it("keeps the good fields of a half-broken value", () => {
    const storage = memoryStorage({
      [prefsKey("desktop")]: JSON.stringify({
        view: "covers",
        sorting: "by title",
        columnOrder: 7,
        columnVisibility: { notes: true, publisher: "no" },
        columnSizing: { publisher: 200, year: "wide" },
      }),
    });
    const prefs = readPrefs(storage, "desktop");
    expect(prefs.view).toBe("covers");
    expect(prefs.sorting).toEqual(DEFAULT_SORTING);
    expect(prefs.columnOrder).toEqual(DEFAULT_ORDER);
    expect(prefs.columnVisibility).toEqual({ ...DEFAULT_VISIBILITY, notes: true });
    expect(prefs.columnSizing).toEqual({ publisher: 200 });
  });

  it("drops unknown columns, keeps the book first and visible, adds new columns at the end", () => {
    const storage = memoryStorage({
      [prefsKey("desktop")]: JSON.stringify({
        sorting: [{ id: "gone", desc: true }, { id: "book", desc: false }, { id: "book", desc: true }],
        columnOrder: ["status", "gone", "book", "status", "shelf"],
        columnVisibility: { book: false, gone: true },
        columnSizing: { gone: 100, year: 5, book: 99999 },
      }),
    });
    const prefs = readPrefs(storage, "desktop");
    expect(prefs.sorting).toEqual([{ id: "book", desc: false }]);
    expect(prefs.columnOrder.slice(0, 3)).toEqual(["book", "status", "shelf"]);
    expect([...prefs.columnOrder].sort()).toEqual([...DEFAULT_ORDER].sort());
    expect(prefs.columnVisibility.book).toBe(true);
    expect(prefs.columnSizing).toEqual({ year: 56, book: 1200 });
  });
});

describe("writePrefs", () => {
  it("round-trips, one entry per layout", () => {
    const storage = memoryStorage();
    const prefs = {
      ...defaultPrefs("phone"),
      view: "table" as const,
      sorting: [{ id: "shelf" as const, desc: false }],
      columnSizing: { publisher: 180 },
    };
    expect(writePrefs(storage, "phone", prefs)).toBe(true);
    expect(Object.keys(storage.data)).toEqual(["shelfmark.library.phone"]);
    expect(readPrefs(storage, "phone")).toEqual(prefs);
    expect(readPrefs(storage, "desktop")).toEqual(defaultPrefs("desktop"));
  });

  it("says no, without throwing, when storage refuses", () => {
    expect(writePrefs(throwing, "desktop", defaultPrefs("desktop"))).toBe(false);
    expect(writePrefs(null, "desktop", defaultPrefs("desktop"))).toBe(false);
  });
});
