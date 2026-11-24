import { describe, expect, it } from "vitest";
import { isComposingKey } from "./ime";

describe("isComposingKey", () => {
  it("is true while the keyboard composes a word", () => {
    expect(isComposingKey({ nativeEvent: { isComposing: true }, keyCode: 13 })).toBe(true);
  });

  it("is true for Safari's keyCode 229 after the composition ended", () => {
    expect(isComposingKey({ nativeEvent: { isComposing: false }, keyCode: 229 })).toBe(true);
  });

  it("is false for a plain Enter", () => {
    expect(isComposingKey({ nativeEvent: { isComposing: false }, keyCode: 13 })).toBe(false);
  });
});
