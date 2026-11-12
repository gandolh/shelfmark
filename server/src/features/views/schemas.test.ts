import { readSavedViewState, savedViewSchema, type SavedView } from "@shelfmark/shared";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { serializationFailure, serialize } from "../../testing/serialize.js";
import { savedViewListOutputSchema, savedViewOutputSchema } from "./schemas.js";

const view: SavedView = {
  id: 3,
  name: "Unread",
  state: {
    collection: "owned",
    filters: { shelf: { kind: "text", op: "contains", text: "B" } },
    sorting: [{ id: "authors", desc: false }],
    columns: ["shelf", "year"],
  },
  position: 0,
  createdAt: "2026-11-12T08:00:00.000Z",
  updatedAt: "2026-11-12T08:00:00.000Z",
};

describe("the saved view's reply schema", () => {
  // The trap, written down: `savedViewSchema` reads `state` through `.transform(readSavedViewState)`, which zod
  // can't run backwards. Declared as a response schema, it would answer 500 to every reply.
  it("is needed: zod can't encode through savedViewSchema's transform", () => {
    expect(() => z.encode(savedViewSchema, view)).toThrow(/unidirectional transform/);
    expect(() => z.encode(savedViewOutputSchema, view)).not.toThrow();
  });

  it("sends a view byte for byte as JSON.stringify would, keys in the same order", () => {
    expect(serialize(savedViewOutputSchema, view)).toBe(JSON.stringify(view));
    expect(serialize(savedViewListOutputSchema, { views: [view, { ...view, id: 4 }] })).toBe(
      JSON.stringify({ views: [view, { ...view, id: 4 }] }),
    );
  });

  it("sends a state read from an old or odd stored one", () => {
    const odd = {
      ...view,
      state: readSavedViewState({ collection: "nope", filters: [{ x: 1 }], sorting: "no", columns: ["zzz", "year"] }),
    };
    expect(JSON.parse(serialize(savedViewOutputSchema, odd))).toEqual({
      ...odd,
      state: { collection: "owned", filters: {}, sorting: [], columns: ["year"] },
    });
  });

  it("strips a field it doesn't declare", () => {
    expect(JSON.parse(serialize(savedViewOutputSchema, { ...view, nameKey: "unread" }))).toEqual(view);
    expect(JSON.parse(serialize(savedViewListOutputSchema, { views: [{ ...view, nameKey: "unread" }] }))).toEqual({
      views: [view],
    });
  });

  it("refuses a value out of shape, which would be a 500", () => {
    expect(serializationFailure(savedViewOutputSchema, { ...view, createdAt: "2020-01-01 00:00:00" })).toBeTruthy();
    expect(serializationFailure(savedViewOutputSchema, { ...view, position: -1 })).toBeTruthy();
    expect(serializationFailure(savedViewListOutputSchema, { views: [{ ...view, id: 0 }] })).toBeTruthy();
  });
});
