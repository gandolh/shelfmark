import type { Reader } from "@shelfmark/shared";
import { describe, expect, it } from "vitest";
import { columnById, readersText } from "./columns";
import { activeFilters } from "./filters";
import { normalizeSorting } from "./prefs";
import { DEFAULT_SORTING } from "./sort";
import { book } from "./test-books";

function reader(username: string, status: Reader["status"], rating: number | null = null): Reader {
  return { userId: username, username, status, rating, updatedAt: "2026-11-17T10:00:00.000Z" };
}

describe("readersText", () => {
  it("groups the other readers by status, reading first, names in the order given", () => {
    const readers = [reader("Ana", "read"), reader("Ion", "read"), reader("Mihai", "reading")];
    expect(readersText(readers)).toBe("Reading: Mihai · Read: Ana, Ion");
  });

  it("puts an unread reader with only a rating last, and says nothing without readers", () => {
    expect(readersText([reader("Ana", "unread", 3), reader("Ion", "abandoned")])).toBe("Abandoned: Ion · Unread: Ana");
    expect(readersText([])).toBe("");
  });

  it("is the Readers column's text, and the column is empty without readers", () => {
    const readers = columnById("readers");
    expect(readers.text(book({ readers: [reader("Ana", "reading")] }))).toBe("Reading: Ana");
    expect(readers.kind === "text" && readers.value(book())).toBeNull();
  });
});

describe("the Readers column only shows", () => {
  it("drops a stored sort or filter by it", () => {
    expect(normalizeSorting([{ id: "readers", desc: false }])).toEqual(DEFAULT_SORTING);
    expect(activeFilters({ readers: { kind: "text", op: "contains", text: "Ana" } })).toEqual([]);
  });
});
