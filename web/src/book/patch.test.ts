import { describe, expect, it } from "vitest";
import { book } from "../library/test-books";
import { formatLei, parseLei, priceLine } from "./money";
import { addToList, buildPatch, isDate, valuesOf, type EditValues } from "./patch";

const stored = book({
  title: "Dune",
  authors: ["Frank Herbert"],
  publisher: "Ace",
  publishedYear: 2019,
  shelf: "Living room · A2",
  priceMinor: 4990,
  tags: ["sci-fi"],
  rating: 4,
});

function patchOf(change: Partial<EditValues>) {
  const base = valuesOf(stored);
  return buildPatch(stored, base, { ...base, ...change });
}

describe("buildPatch", () => {
  it("sends nothing when nothing changed", () => {
    expect(patchOf({})).toEqual({ ok: true, patch: {} });
  });

  it("sends only the changed fields", () => {
    expect(patchOf({ title: "Dune Messiah", rating: 5 })).toEqual({ ok: true, patch: { title: "Dune Messiah", rating: 5 } });
  });

  it("drops a change that tidies back to the stored value", () => {
    expect(patchOf({ title: "  Dune  ", publisher: "Ace " })).toEqual({ ok: true, patch: {} });
  });

  it("clears with null: blank text, no shelf, no rating", () => {
    expect(patchOf({ publisher: "  ", shelf: null, rating: null, price: "" })).toEqual({
      ok: true,
      patch: { publisher: null, shelf: null, rating: null, priceMinor: null },
    });
  });

  it("stores the price in bani and the authors as a list", () => {
    expect(patchOf({ price: "19,99", authors: "Frank Herbert & Brian Herbert" })).toEqual({
      ok: true,
      patch: { priceMinor: 1999, authors: ["Frank Herbert", "Brian Herbert"] },
    });
  });

  it("sends a changed list whole", () => {
    expect(patchOf({ tags: ["sci-fi", "classic"] })).toEqual({ ok: true, patch: { tags: ["sci-fi", "classic"] } });
  });

  it("reports what is wrong and sends nothing", () => {
    const result = patchOf({ title: " ", publishedYear: "20x1", price: "4.999", language: "eng", acquiredOn: "2026-02-31" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["acquiredOn", "language", "price", "publishedYear", "title"]);
  });

  it("doesn't check a field nobody touched", () => {
    const odd = book({ language: "ROM" });
    const base = valuesOf(odd);
    expect(buildPatch(odd, base, { ...base, pages: "12" })).toEqual({ ok: true, patch: { pages: 12 } });
  });

  it("normalises the ISBN and the language", () => {
    expect(patchOf({ isbn13: "0-547-92822-X", language: "RO" })).toEqual({
      ok: true,
      patch: { isbn13: "9780547928227", language: "ro" },
    });
  });
});

describe("price", () => {
  it("reads lei into bani without float error", () => {
    expect(parseLei("49")).toBe(4900);
    expect(parseLei("49.9")).toBe(4990);
    expect(parseLei("19.99")).toBe(1999);
    expect(parseLei("1 234,50")).toBe(123450);
    expect(parseLei("0")).toBe(0);
    expect(parseLei("  ")).toBeNull();
  });

  it("refuses what isn't a price", () => {
    for (const bad of ["abc", "4.999", "-3", "4.", ".5", "1e3"]) expect(parseLei(bad)).toBe("invalid");
  });

  it("writes bani back with two decimals", () => {
    expect(formatLei(4990)).toBe("49.90");
    expect(formatLei(5)).toBe("0.05");
    expect(priceLine(123450, "RON")).toBe("1234.50 RON");
    expect(parseLei(formatLei(1999))).toBe(1999);
  });
});

describe("helpers", () => {
  it("adds a tag once, ignoring case", () => {
    expect(addToList(["Sci-fi"], " sci-fi ")).toEqual(["Sci-fi"]);
    expect(addToList(["a"], "b  c")).toEqual(["a", "b c"]);
    expect(addToList(["a"], "  ")).toEqual(["a"]);
  });

  it("knows a real date", () => {
    expect(isDate("2024-02-29")).toBe(true);
    expect(isDate("2023-02-29")).toBe(false);
    expect(isDate("2023-2-1")).toBe(false);
  });
});
