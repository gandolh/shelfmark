import { describe, expect, it } from "vitest";
import { CLAUDE_PROMPT, readImportText } from "./prompt";

describe("readImportText", () => {
  it("reads an array, fenced or not", () => {
    const json = '[{"title":"X","authors":["Y"],"reason":"Because."}]';
    expect(readImportText(json).ok).toBe(true);
    expect(readImportText("```json\n" + json + "\n```").ok).toBe(true);
  });

  it("explains malformed JSON and a wrong shape in words", () => {
    expect(readImportText("[{")).toMatchObject({
      ok: false,
      message: expect.stringContaining("not valid JSON"),
    });
    expect(readImportText('[{"title":"X"}]')).toMatchObject({
      ok: false,
      message: expect.stringContaining("expected shape"),
    });
    expect(readImportText("  ").ok).toBe(false);
  });

  it("gives Claude the schema and the warning", () => {
    expect(CLAUDE_PROMPT).toContain('"reason"');
    expect(CLAUDE_PROMPT).toContain("Do not invent");
  });
});
