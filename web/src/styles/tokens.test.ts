import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The stylesheet the app ships. (A `?raw` import is empty: Vitest leaves CSS unprocessed.)
const css = readFileSync(new URL("./index.css", import.meta.url), "utf8");

type Theme = "light" | "dark";

/** `--color-ink: light-dark(#1b1b1d, #ececee);` → the colour for one theme. A plain alias (`var(--color-x)`) follows. */
function colour(name: string, theme: Theme): string {
  const line = new RegExp(`--color-${name}:\\s*([^;]+);`).exec(css)?.[1] ?? "";
  const pair = /light-dark\((#[0-9a-f]{6}),\s*(#[0-9a-f]{6})\)/i.exec(line);
  if (pair) return (theme === "light" ? pair[1] : pair[2]) ?? "";
  const alias = /^var\(--color-([\w-]+)\)/.exec(line.trim());
  if (alias?.[1]) return colour(alias[1], theme);
  const plain = /^(#[0-9a-f]{6})/i.exec(line.trim());
  return plain?.[1] ?? "";
}

function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((at) => {
    const channel = parseInt(hex.slice(at, at + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi = 0, lo = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// [text or icon, ground]: 4.5:1 for text.
const TEXT: readonly (readonly [string, string])[] = [
  ["ink", "ground"],
  ["ink", "surface"],
  ["ink", "control"],
  ["ink", "row-hover"],
  ["ink", "field"],
  ["ink", "accent-tint-soft"],
  ["ink-2", "ground"],
  ["ink-2", "surface"],
  ["ink-2", "control"],
  ["ink-2", "field"],
  ["muted", "ground"],
  ["muted", "surface"],
  ["muted", "control"],
  ["field-placeholder", "field"],
  ["accent", "ground"],
  ["accent", "field"],
  ["on-accent-tint", "accent-tint"],
  ["ink-2", "row-hover"],
  ["muted", "row-hover"],
  ["ink", "control-raised"],
  ["accent", "surface"],
  ["accent", "accent-tint-soft"],
  ["accent-press", "accent-tint"],
  ["accent-press", "surface"],
  ["on-accent", "accent"],
  ["camera-ink", "camera"],
];

// UI parts (a control's edge, a ring): 3:1.
const PARTS: readonly (readonly [string, string])[] = [
  ["muted", "surface"],
  ["accent", "surface"],
  ["focus-ring", "ground"],
  ["ink-2", "surface"],
  ["outline", "field"],
  ["outline", "surface"],
  ["outline", "ground"],
];

describe.each<Theme>(["light", "dark"])("the %s tokens", (theme) => {
  it.each(TEXT)("%s on %s is at least 4.5:1", (text, ground) => {
    expect(contrast(colour(text, theme), colour(ground, theme))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(PARTS)("%s against %s is at least 3:1", (part, ground) => {
    expect(contrast(colour(part, theme), colour(ground, theme))).toBeGreaterThanOrEqual(3);
  });
});
