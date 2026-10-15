import { describe, expect, it } from "vitest";
import { COVER_MAX_SIDE, downscaleSteps, fitWithin } from "./resize";

describe("fitWithin", () => {
  it("fits the long side to 900, keeping the shape", () => {
    expect(COVER_MAX_SIDE).toBe(900);
    expect(fitWithin(3024, 4032)).toEqual({ width: 675, height: 900 });
    expect(fitWithin(4032, 3024)).toEqual({ width: 900, height: 675 });
    expect(fitWithin(1000, 1000)).toEqual({ width: 900, height: 900 });
  });

  it("never makes a small picture larger", () => {
    expect(fitWithin(600, 900)).toEqual({ width: 600, height: 900 });
    expect(fitWithin(320, 480)).toEqual({ width: 320, height: 480 });
  });

  it("rounds, and keeps at least a pixel", () => {
    expect(fitWithin(1801, 2700)).toEqual({ width: 600, height: 900 });
    expect(fitWithin(10_000, 3)).toEqual({ width: 900, height: 1 });
  });

  it("refuses empty sizes", () => {
    expect(() => fitWithin(0, 100)).toThrow(RangeError);
    expect(() => fitWithin(100, Number.NaN)).toThrow(RangeError);
  });
});

describe("downscaleSteps", () => {
  it("halves a phone photo on the way down, then lands on the target", () => {
    expect(downscaleSteps(3024, 4032)).toEqual([
      { width: 1512, height: 2016 },
      { width: 756, height: 1008 },
      { width: 675, height: 900 },
    ]);
  });

  it("draws once when the picture is already close or small", () => {
    expect(downscaleSteps(1200, 1800)).toEqual([{ width: 600, height: 900 }]);
    expect(downscaleSteps(400, 600)).toEqual([{ width: 400, height: 600 }]);
  });

  it("ends every list on fitWithin's size", () => {
    for (const [w, h] of [
      [5000, 7000],
      [2001, 3000],
      [901, 1],
    ] as const) {
      expect(downscaleSteps(w, h).at(-1)).toEqual(fitWithin(w, h));
    }
  });
});
