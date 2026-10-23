import { describe, expect, it } from "vitest";
import { boxBetween, boxInPixels } from "./image";

describe("boxBetween", () => {
  it("is the same box whichever way it was dragged, kept inside the photo", () => {
    const box = { x: 0.125, y: 0.25, width: 0.5, height: 0.375 };
    expect(boxBetween({ x: 0.125, y: 0.25 }, { x: 0.625, y: 0.625 })).toEqual(box);
    expect(boxBetween({ x: 0.625, y: 0.625 }, { x: 0.125, y: 0.25 })).toEqual(box);
    expect(boxBetween({ x: -0.3, y: 0.5 }, { x: 1.4, y: 1.2 })).toEqual({ x: 0, y: 0.5, width: 1, height: 0.5 });
  });

  it("takes a tap or a thin sliver for no box", () => {
    expect(boxBetween({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 })).toBeNull();
    expect(boxBetween({ x: 0.1, y: 0.5 }, { x: 0.9, y: 0.52 })).toBeNull();
  });
});

describe("boxInPixels", () => {
  it("is the whole photo without a box", () => {
    expect(boxInPixels(null, 4032, 3024)).toEqual({ x: 0, y: 0, width: 4032, height: 3024 });
  });

  it("rounds to whole pixels and stays inside the photo", () => {
    expect(boxInPixels({ x: 0.25, y: 0.5, width: 0.5, height: 0.25 }, 4032, 3024)).toEqual({ x: 1008, y: 1512, width: 2016, height: 756 });
    expect(boxInPixels({ x: 0.9, y: 0.9, width: 0.2, height: 0.2 }, 100, 100)).toEqual({ x: 90, y: 90, width: 10, height: 10 });
    expect(boxInPixels({ x: 1, y: 1, width: 0, height: 0 }, 100, 100)).toEqual({ x: 99, y: 99, width: 1, height: 1 });
  });
});
