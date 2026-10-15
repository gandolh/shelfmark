import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { authorLine, COVER_TINT_COUNT, coverTint, tintKey } from "./cover";

// The stylesheet the app ships. (A `?raw` import is empty: Vitest leaves CSS unprocessed.)
const tokens = readFileSync(new URL("../styles/tokens.css", import.meta.url), "utf8");

/** `--cover-3-bg: #33503E;` → { 3: { bg: "#33503E" } }. */
function coverTokens(): Map<number, { bg?: string; ink?: string }> {
  const tints = new Map<number, { bg?: string; ink?: string }>();
  for (const match of tokens.matchAll(/--cover-(\d+)-(bg|ink):\s*(#[0-9a-f]{6})\s*;/gi)) {
    const [, n = "", part, value = ""] = match;
    const tint = tints.get(Number(n)) ?? {};
    tint[part as "bg" | "ink"] = value;
    tints.set(Number(n), tint);
  }
  return tints;
}

/** WCAG 2 relative luminance and contrast ratio. */
function luminance(hex: string): number {
  const value = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [value >> 16, (value >> 8) & 0xff, value & 0xff].map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

describe("coverTint", () => {
  it("is one of eight", () => {
    for (const title of ["", "a", "Solenoid", "Întâmplări în irealitatea imediată", "x".repeat(500)]) {
      const tint = coverTint(title);
      expect(Number.isInteger(tint)).toBe(true);
      expect(tint).toBeGreaterThanOrEqual(1);
      expect(tint).toBeLessThanOrEqual(COVER_TINT_COUNT);
    }
  });

  it("is stable: the same title has the same tint on every device and in every release", () => {
    // Pinned: changing the hash recolours every placeholder in the owner's library.
    expect(coverTint("Solenoid")).toBe(coverTint("Solenoid"));
    expect(
      ["Solenoid", "O vară cu Isidor", "Paturi oculte", "Inocenții", "The Road", "Sapiens", "Dune", "Orbitor"].map(coverTint),
    ).toEqual([7, 3, 5, 8, 3, 3, 4, 7]);
  });

  it("ignores case, spacing and diacritics, so both Romanian spellings match", () => {
    expect(tintKey("  Inocenții  ")).toBe("inocentii");
    expect(coverTint("Inocenţii")).toBe(coverTint("Inocenții")); // cedilla ţ, comma ț
    expect(coverTint("Paturi  oculte")).toBe(coverTint("paturi oculte"));
    expect(coverTint("ÎNTÂMPLĂRI")).toBe(coverTint("intamplari"));
  });

  it("spreads a shelf of titles over every tint", () => {
    const titles = Array.from({ length: 400 }, (_, i) => `Book number ${i}`);
    const counts = new Map<number, number>();
    for (const title of titles) counts.set(coverTint(title), (counts.get(coverTint(title)) ?? 0) + 1);
    expect(counts.size).toBe(COVER_TINT_COUNT);
    for (const count of counts.values()) expect(count).toBeGreaterThan(400 / COVER_TINT_COUNT / 2);
  });
});

describe("the tints in tokens.css", () => {
  it("defines exactly eight, each with its ink", () => {
    const tints = coverTokens();
    expect([...tints.keys()].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const [n, tint] of tints) {
      expect(tint.bg, `--cover-${n}-bg`).toBeDefined();
      expect(tint.ink, `--cover-${n}-ink`).toBeDefined();
    }
  });

  it("gives every tint's text at least 4.5:1", () => {
    for (const [n, { bg = "", ink = "" }] of coverTokens()) {
      expect(contrast(bg, ink), `tint ${n}: ${ink} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("authorLine", () => {
  it("names one or two authors, and counts the rest", () => {
    expect(authorLine([])).toBe("");
    expect(authorLine(["Mircea Cărtărescu"])).toBe("Mircea Cărtărescu");
    expect(authorLine(["Mircea Eliade", " Ioan Petru Culianu "])).toBe("Mircea Eliade and Ioan Petru Culianu");
    expect(authorLine(["A", "B", "C", "D"])).toBe("A, B and 2 more");
    expect(authorLine(["", "  "])).toBe("");
  });
});
