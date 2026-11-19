import { describe, expect, it } from "vitest";
import {
  DEFAULT_ORDER,
  DEFAULT_VISIBILITY,
  defaultPrefs,
  mergeColumnOrder,
  prefsKey,
  readPrefs,
  writePrefs,
  type PrefsStorage,
} from "./prefs";
import { shownColumns } from "./savedViews";
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

  it("shows book, publisher, year, shelf, status, readers and added by default, newest first", () => {
    const prefs = defaultPrefs("desktop");
    expect(prefs.columnOrder.filter((id) => prefs.columnVisibility[id])).toEqual([
      "book",
      "publisher",
      "year",
      "shelf",
      "status",
      "readers",
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

  it("drops unknown columns, keeps the book first and visible, adds new columns at their place", () => {
    const storage = memoryStorage({
      [prefsKey("desktop")]: JSON.stringify({
        sorting: [
          { id: "gone", desc: true },
          { id: "book", desc: false },
          { id: "book", desc: true },
        ],
        columnOrder: ["status", "gone", "book", "status", "shelf"],
        columnVisibility: { book: false, gone: true },
        columnSizing: { gone: 100, year: 5, book: 99999 },
      }),
    });
    const prefs = readPrefs(storage, "desktop");
    expect(prefs.sorting).toEqual([{ id: "book", desc: false }]);
    expect(prefs.columnOrder[0]).toBe("book");
    expect(prefs.columnOrder.indexOf("status")).toBeLessThan(prefs.columnOrder.indexOf("shelf"));
    expect(prefs.columnOrder).not.toContain("gone");
    expect([...prefs.columnOrder].sort()).toEqual([...DEFAULT_ORDER].sort());
    expect(prefs.columnVisibility.book).toBe(true);
    expect(prefs.columnSizing).toEqual({ year: 56, book: 1200 });
  });
});

describe("the collection tab", () => {
  it("opens on Owned, and reads a Wishlist saved before the Wishlist page as Owned", () => {
    const storage = memoryStorage();
    expect(readPrefs(storage, "desktop").collection).toBe("owned");
    writePrefs(storage, "phone", { ...defaultPrefs("phone"), collection: "wishlist" });
    expect(readPrefs(storage, "phone").collection).toBe("owned");
    expect(readPrefs(storage, "desktop").collection).toBe("owned");
  });

  it("falls back to Owned on anything else", () => {
    const storage = memoryStorage({ [prefsKey("desktop")]: JSON.stringify({ collection: "loans" }) });
    expect(readPrefs(storage, "desktop").collection).toBe("owned");
  });
});

describe("the page size", () => {
  it("is 10 on both layouts by default", () => {
    expect(defaultPrefs("desktop").pageSize).toBe(10);
    expect(defaultPrefs("phone").pageSize).toBe(10);
  });

  it("reads as 10 from prefs stored before there were pages", () => {
    const storage = memoryStorage({
      [prefsKey("desktop")]: JSON.stringify({
        collection: "owned",
        view: "table",
        sorting: [{ id: "added", desc: true }],
      }),
    });
    expect(readPrefs(storage, "desktop").pageSize).toBe(10);
  });

  it("reads a saved 200, no longer offered, as 10", () => {
    const storage = memoryStorage({ [prefsKey("desktop")]: JSON.stringify({ pageSize: 200 }) });
    expect(readPrefs(storage, "desktop").pageSize).toBe(10);
  });

  it("reads as 10 when the stored size isn't one the menu offers", () => {
    for (const pageSize of [0, 75, "100", null, 1e9]) {
      const storage = memoryStorage({ [prefsKey("phone")]: JSON.stringify({ pageSize }) });
      expect(readPrefs(storage, "phone").pageSize).toBe(10);
    }
  });

  it("keeps a saved size the menu still offers, per layout", () => {
    const storage = memoryStorage();
    writePrefs(storage, "desktop", { ...defaultPrefs("desktop"), pageSize: 50 });
    expect(readPrefs(storage, "desktop").pageSize).toBe(50);
    expect(readPrefs(storage, "phone").pageSize).toBe(10);
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
      pageSize: 25 as const,
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

describe("a new column joins a stored order at its place", () => {
  const storedBeforeReaders = DEFAULT_ORDER.filter((id) => id !== "readers");

  it("puts Readers right after Your status in an order saved before Readers", () => {
    const order = mergeColumnOrder(storedBeforeReaders);
    expect(order).toEqual(DEFAULT_ORDER);
    expect(order[order.indexOf("status") + 1]).toBe("readers");
  });

  it("shows Readers after Your status on a device order saved before Readers", () => {
    const storage = memoryStorage({
      [prefsKey("desktop")]: JSON.stringify({ columnOrder: storedBeforeReaders }),
    });
    const prefs = readPrefs(storage, "desktop");
    expect(prefs.columnOrder.indexOf("readers")).toBe(prefs.columnOrder.indexOf("status") + 1);
    const shown = shownColumns(prefs);
    expect(shown[shown.indexOf("status") + 1]).toBe("readers");
    expect(JSON.parse(storage.getItem(prefsKey("desktop")) ?? "{}").columnOrder).toEqual(storedBeforeReaders);
  });

  it("keeps a reordered order and slots the new column after its default neighbour", () => {
    const reordered = ["book", "added", ...storedBeforeReaders.filter((id) => id !== "book" && id !== "added")];
    reordered.splice(reordered.indexOf("status"), 1);
    reordered.unshift("status");
    reordered.unshift("book");
    const order = mergeColumnOrder(reordered);
    expect(order.slice(0, 5)).toEqual(["book", "status", "readers", "added", "authors"]);
    expect(order).toHaveLength(DEFAULT_ORDER.length);
  });

  it("keeps two new columns in their default order", () => {
    const order = mergeColumnOrder(["book", "authors", "year"], ["book", "authors", "x1", "x2", "year", "x3"] as never);
    expect(order).toEqual(["book", "authors", "x1", "x2", "year", "x3"]);
  });

  it("puts a new column first when nothing before it is named, and drops one that is gone", () => {
    const order = mergeColumnOrder(["gone", "shelf", "shelf"], ["book", "new", "shelf"] as never);
    expect(order).toEqual(["book", "new", "shelf"]);
  });
});
