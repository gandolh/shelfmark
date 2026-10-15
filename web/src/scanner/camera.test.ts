import { describe, expect, it } from "vitest";
import { cameraFailure } from "./camera";

describe("cameraFailure", () => {
  it.each([
    ["NotAllowedError", "denied"],
    ["SecurityError", "denied"],
    ["NotFoundError", "no-camera"],
    ["OverconstrainedError", "no-camera"],
    ["NotReadableError", "error"],
    ["AbortError", "error"],
  ] as const)("maps %s to %s", (name, want) => {
    expect(cameraFailure(new DOMException("", name))).toBe(want);
  });

  it("maps anything that is not a DOMException to error", () => {
    expect(cameraFailure(new TypeError("boom"))).toBe("error");
    expect(cameraFailure("boom")).toBe("error");
    expect(cameraFailure(null)).toBe("error");
  });
});
