import { describe, expect, it } from "vitest";
import {
  LIBRARY_COLUMN_IDS,
  readSavedViewState,
  savedViewCreateSchema,
  savedViewSchema,
  savedViewStateSchema,
  viewNameSchema,
  type SavedViewState,
} from "./views.js";

const STATE: SavedViewState = {
  collection: "owned",
  filters: {
    status: { kind: "pick", values: ["unread"] },
    notes: { kind: "text", op: "notEmpty", text: "" },
    year: { kind: "number", min: 1990, max: null },
    acquiredOn: { kind: "date", from: "2025-01-01", to: "2025-12-31" },
    signed: { kind: "yesno", value: true },
  },
  sorting: [
    { id: "shelf", desc: false },
    { id: "book", desc: false },
  ],
  columns: ["authors", "shelf", "status"],
};

describe("savedViewStateSchema", () => {
  it("takes a state with every kind of filter as it is", () => {
    expect(savedViewStateSchema.parse(STATE)).toEqual(STATE);
  });

  it.each([
    ["an unknown column", { ...STATE, columns: ["loanedTo"] }],
    ["the book column among the columns", { ...STATE, columns: ["book", "year"] }],
    ["a column twice", { ...STATE, columns: ["year", "year"] }],
    ["a sort key twice", { ...STATE, sorting: [{ id: "year", desc: true }, { id: "year", desc: false }] }],
    ["a filter on an unknown column", { ...STATE, filters: { loanedTo: { kind: "yesno", value: true } } }],
    ["an unknown filter kind", { ...STATE, filters: { year: { kind: "between", min: 1, max: 2 } } }],
    ["a filter with an extra key", { ...STATE, filters: { signed: { kind: "yesno", value: true, also: 1 } } }],
    ["a date that isn't a day", { ...STATE, filters: { acquiredOn: { kind: "date", from: "last year", to: null } } }],
    ["a text op it doesn't know", { ...STATE, filters: { notes: { kind: "text", op: "startsWith", text: "a" } } }],
    ["the search text", { ...STATE, query: "dune" }],
  ])("refuses %s", (_, state) => {
    expect(savedViewStateSchema.safeParse(state).success).toBe(false);
  });

  it("knows every column once", () => {
    expect(new Set(LIBRARY_COLUMN_IDS).size).toBe(LIBRARY_COLUMN_IDS.length);
    expect(LIBRARY_COLUMN_IDS[0]).toBe("book");
  });
});

describe("readSavedViewState", () => {
  it("reads a good state back as it was", () => {
    expect(readSavedViewState(JSON.parse(JSON.stringify(STATE)))).toEqual(STATE);
  });

  it("drops a column that no longer exists from the columns, the sort and the filters", () => {
    const stored = {
      ...STATE,
      filters: { ...STATE.filters, loanedTo: { kind: "text", op: "notEmpty", text: "" } },
      sorting: [{ id: "loanedTo", desc: true }, ...STATE.sorting],
      columns: ["loanedTo", ...STATE.columns],
    };
    expect(readSavedViewState(stored)).toEqual(STATE);
  });

  it("drops what doesn't read, field by field, and never throws", () => {
    expect(
      readSavedViewState({
        collection: "loaned",
        filters: { year: { kind: "number", min: "x" }, signed: { kind: "yesno", value: false } },
        sorting: [{ id: "year" }, { id: "year", desc: true }, { id: "year", desc: false }],
        columns: ["book", "year", "year", 3],
      }),
    ).toEqual({
      collection: "owned",
      filters: { signed: { kind: "yesno", value: false } },
      sorting: [{ id: "year", desc: true }],
      columns: ["year"],
    });
    for (const junk of [null, "x", 3, [], { filters: [], sorting: {}, columns: "year" }]) {
      expect(readSavedViewState(junk)).toEqual({ collection: "owned", filters: {}, sorting: [], columns: [] });
    }
  });
});

describe("views", () => {
  it("trims a name and puts it in NFC", () => {
    expect(viewNameSchema.parse("  Știință ")).toBe("Știință");
    expect(viewNameSchema.parse("Știință")).toBe("Știință");
    expect(viewNameSchema.safeParse("   ").success).toBe(false);
    expect(viewNameSchema.safeParse("x".repeat(81)).success).toBe(false);
  });

  it("needs a name and a state to create a view", () => {
    expect(savedViewCreateSchema.safeParse({ name: "Unread" }).success).toBe(false);
    expect(savedViewCreateSchema.parse({ name: "Unread", state: STATE })).toEqual({ name: "Unread", state: STATE });
  });

  it("reads a view's state leniently from an answer", () => {
    const view = {
      id: 1,
      name: "Unread",
      state: { ...STATE, columns: ["loanedTo", "authors"] },
      position: 0,
      createdAt: "2026-10-23T09:00:00.000Z",
      updatedAt: "2026-10-23T09:00:00.000Z",
    };
    expect(savedViewSchema.parse(view).state.columns).toEqual(["authors"]);
  });
});
