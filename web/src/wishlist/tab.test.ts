import { describe, expect, it } from "vitest";
import { initialTab, readTab, writeTab } from "./tab";

const memory = (initial?: string) => {
  const data = new Map<string, string>(initial === undefined ? [] : [["shelfmark.recommendations.tab", initial]]);
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
};

describe("the Recommendations tab", () => {
  it("opens where it was left on this device", () => {
    const storage = memory();
    writeTab("claude", storage);
    expect(readTab(storage)).toBe("claude");
    expect(initialTab(readTab(storage), { similar: 30, claude: 0 })).toBe("claude");
  });

  it("with nothing remembered, opens on the first tab that has books", () => {
    expect(initialTab(null, { similar: 0, claude: 6 })).toBe("claude");
    expect(initialTab(null, { similar: 3, claude: 6 })).toBe("similar");
    expect(initialTab(null, { similar: 0, claude: 0 })).toBe("similar");
  });

  it("ignores a value it doesn't know and storage that throws", () => {
    expect(readTab(memory("series"))).toBeNull();
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readTab(broken)).toBeNull();
    expect(() => writeTab("similar", broken)).not.toThrow();
  });
});
