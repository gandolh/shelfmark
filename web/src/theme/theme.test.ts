import { describe, expect, it } from "vitest";
import { isTheme, readTheme, resolveTheme, THEME_KEY, writeTheme } from "./theme";

function memory(initial?: string) {
  const data = new Map<string, string>(initial === undefined ? [] : [[THEME_KEY, initial]]);
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  };
}

const blocked = {
  getItem: (): string | null => {
    throw new Error("blocked");
  },
  setItem: (): void => {
    throw new Error("blocked");
  },
};

describe("resolveTheme", () => {
  it("shows light on a first visit even where the system prefers dark", () => {
    expect(resolveTheme(readTheme(memory()), true)).toBe("light");
  });

  it("keeps Light and Dark whatever the system says", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("follows the system, in both directions, on System", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});

describe("the stored choice", () => {
  it("round-trips each of the three", () => {
    for (const theme of ["light", "dark", "system"] as const) {
      const storage = memory();
      expect(writeTheme(theme, storage)).toBe(true);
      expect(readTheme(storage)).toBe(theme);
    }
  });

  it("reads a corrupt value as light", () => {
    expect(readTheme(memory("sepia"))).toBe("light");
    expect(isTheme("sepia")).toBe(false);
  });

  it("falls back to light and does not throw when storage does", () => {
    expect(readTheme(blocked)).toBe("light");
    expect(writeTheme("dark", blocked)).toBe(false);
    expect(readTheme(null)).toBe("light");
    expect(writeTheme("dark", null)).toBe(false);
  });
});
