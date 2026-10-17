import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { ZXING_WASM_SHA256 } from "barcode-detector/ponyfill";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSightings } from "./debounce";
import {
  codesFrom,
  FORMATS,
  PACE,
  readInterval,
  selectEngine,
  startDetectLoop,
  zxingOverrides,
  type Detection,
  type Detector,
  type DetectorClass,
  type Format,
} from "./detector";

/** A stand-in BarcodeDetector class that records how it was built. */
function fakeClass(supported: readonly string[] | Error) {
  const built: Format[][] = [];
  class Fake implements Detector {
    constructor(options: { formats: Format[] }) {
      built.push(options.formats);
    }
    static getSupportedFormats(): Promise<readonly string[]> {
      return supported instanceof Error ? Promise.reject(supported) : Promise.resolve(supported);
    }
    detect(): Promise<Detection[]> {
      return Promise.resolve([]);
    }
  }
  return { Fake: Fake as DetectorClass, built };
}

describe("selectEngine", () => {
  it("uses the native detector when it reads EAN-13, asking only for formats it has", async () => {
    const native = fakeClass(["qr_code", "ean_13", "ean_8", "code_128", "upc_a", "upc_e"]);
    const load = vi.fn(() => Promise.resolve(fakeClass([]).Fake));
    const choice = await selectEngine({ BarcodeDetector: native.Fake }, load);
    expect(choice.engine).toBe("native");
    expect(native.built).toEqual([["ean_13", "ean_8", "upc_a", "upc_e", "code_128"]]);
    expect(load).not.toHaveBeenCalled();
  });

  it("drops formats the native detector lacks", async () => {
    const native = fakeClass(["ean_13", "code_128"]);
    const choice = await selectEngine({ BarcodeDetector: native.Fake }, () => Promise.reject(new Error("unused")));
    expect(choice.engine).toBe("native");
    expect(native.built).toEqual([["ean_13", "code_128"]]);
  });

  it.each([
    ["has the class but no formats (desktop Chrome on Linux)", fakeClass([])],
    ["reads QR codes only", fakeClass(["qr_code"])],
    ["cannot list its formats", fakeClass(new Error("NotSupportedError"))],
  ])("falls back to the ponyfill when the native detector %s", async (_label, native) => {
    const ponyfill = fakeClass(["ean_13"]);
    const load = vi.fn(() => Promise.resolve(ponyfill.Fake));
    const choice = await selectEngine({ BarcodeDetector: native.Fake }, load);
    expect(choice.engine).toBe("zxing");
    expect(load).toHaveBeenCalledOnce();
    expect(native.built).toEqual([]);
    expect(ponyfill.built).toEqual([[...FORMATS]]);
  });

  it("falls back to the ponyfill when there is no native class (Safari, Firefox)", async () => {
    const ponyfill = fakeClass(["ean_13"]);
    expect((await selectEngine({}, () => Promise.resolve(ponyfill.Fake))).engine).toBe("zxing");
    expect((await selectEngine({ BarcodeDetector: {} }, () => Promise.resolve(ponyfill.Fake))).engine).toBe("zxing");
  });

  it("reads a stubbed globalThis.BarcodeDetector by default", async () => {
    const native = fakeClass(["ean_13"]);
    vi.stubGlobal("BarcodeDetector", native.Fake);
    try {
      expect((await selectEngine(undefined, () => Promise.reject(new Error("unused")))).engine).toBe("native");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("codesFrom", () => {
  const isbn = { rawValue: "9786063205583", format: "ean_13" };

  /** The frame read twice, 150 ms apart: what the second read fires. */
  function confirmed(frame: readonly Detection[]) {
    const sightings = createSightings();
    expect(codesFrom(frame, sightings, 0)).toEqual([]);
    return codesFrom(frame, sightings, 150);
  }

  it("emits an ISBN from an EAN-13 once a second read agrees", () => {
    expect(confirmed([isbn])).toEqual([{ kind: "isbn", isbn13: "9786063205583" }]);
  });

  it("drops add-ons and keeps the ISBN beside them", () => {
    const frame = [isbn, { rawValue: "51299", format: "ean_5" }, { rawValue: "12", format: "ean_2" }];
    expect(confirmed(frame)).toEqual([{ kind: "isbn", isbn13: "9786063205583" }]);
  });

  it("emits store stickers, UPCs and labels as other, raw value kept", () => {
    const frame = [
      { rawValue: "2000000000008", format: "ean_13" },
      { rawValue: "036000291452", format: "upc_a" },
      { rawValue: "51299", format: "code_128" },
    ];
    expect(confirmed(frame)).toEqual([
      { kind: "other", code: "2000000000008" },
      { kind: "other", code: "036000291452" },
      { kind: "other", code: "51299" },
    ]);
  });

  it("passes the format through: 13 digits in a Code-128 are not an ISBN", () => {
    expect(confirmed([{ rawValue: "9786063205583", format: "code_128" }])).toEqual([{ kind: "other", code: "9786063205583" }]);
  });

  it("skips empty values", () => {
    expect(confirmed([{ rawValue: " ", format: "code_128" }])).toEqual([]);
  });

  it("doesn't confirm a code with a second copy of it in the same frame", () => {
    const sightings = createSightings();
    expect(codesFrom([isbn, isbn], sightings, 0)).toEqual([]);
    expect(codesFrom([isbn, isbn], sightings, 150)).toHaveLength(1);
  });

  it("emits a code once while it stays in view", () => {
    const sightings = createSightings();
    codesFrom([isbn], sightings, 0);
    expect(codesFrom([isbn], sightings, 150)).toHaveLength(1);
    for (let now = 1150; now < 20_000; now += 1000) expect(codesFrom([isbn], sightings, now)).toEqual([]);
  });

  it("keys ISBNs and other codes apart", () => {
    const sightings = createSightings();
    codesFrom([isbn], sightings, 0);
    // The same digits read as a Code-128 are another code, not the ISBN's second read.
    expect(codesFrom([{ rawValue: "9786063205583", format: "code_128" }], sightings, 150)).toEqual([]);
    expect(codesFrom([isbn], sightings, 300)).toHaveLength(1);
  });
});

describe("readInterval", () => {
  it("reads four times a second looking, once a second watching, and soon to confirm", () => {
    expect(PACE).toEqual({ search: 250, watch: 1000, confirm: 150 });
    expect(readInterval(false, false)).toBe(250);
    expect(readInterval(true, false)).toBe(1000);
    expect(readInterval(false, true)).toBe(150);
    expect(readInterval(true, true)).toBe(150);
  });
});

describe("startDetectLoop", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads the first frame at once, then every interval", async () => {
    const detect = vi.fn(() => Promise.resolve<Detection[]>([]));
    const stop = startDetectLoop({ detect, onDetections: () => {}, interval: () => 250 });
    await vi.advanceTimersByTimeAsync(0);
    expect(detect).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(249);
    expect(detect).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(detect).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1500);
    expect(detect).toHaveBeenCalledTimes(8);
    stop();
  });

  it("asks for the interval after each read, so the pace follows what the read saw", async () => {
    const frames: Detection[][] = [[], [{ rawValue: "x", format: "code_128" }], []];
    const detect = vi.fn(() => Promise.resolve(frames.shift() ?? []));
    let seen = false;
    const stop = startDetectLoop({
      detect,
      onDetections: () => {
        seen = true;
      },
      // Watching: once a second, but soon after a read that saw something.
      interval: () => (seen ? 150 : 1000),
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(detect).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(detect).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(150);
    expect(detect).toHaveBeenCalledTimes(3);
    stop();
  });

  it("waits for a slow frame instead of overlapping it", async () => {
    let inFlight = 0;
    let most = 0;
    const detect = vi.fn(async () => {
      inFlight++;
      most = Math.max(most, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 400));
      inFlight--;
      return [];
    });
    const stop = startDetectLoop({ detect, onDetections: () => {}, interval: () => 150 });
    await vi.advanceTimersByTimeAsync(1000);
    expect(most).toBe(1);
    // A 400 ms frame starts the next one straight away: 0, 400, 800.
    expect(detect).toHaveBeenCalledTimes(3);
    stop();
  });

  it("hands over frames with codes, survives a failed frame, and stops", async () => {
    const frames: (Detection[] | Error)[] = [[], new Error("InvalidStateError"), [{ rawValue: "x", format: "code_128" }]];
    const detect = vi.fn(() => {
      const next = frames.shift() ?? [];
      return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
    });
    const onDetections = vi.fn();
    const stop = startDetectLoop({ detect, onDetections, interval: () => 150 });
    await vi.advanceTimersByTimeAsync(300);
    expect(detect).toHaveBeenCalledTimes(3);
    expect(onDetections).toHaveBeenCalledOnce();
    expect(onDetections).toHaveBeenCalledWith([{ rawValue: "x", format: "code_128" }]);
    stop();
    await vi.advanceTimersByTimeAsync(1000);
    expect(detect).toHaveBeenCalledTimes(3);
  });

  it("drops a frame that resolves after stop", async () => {
    let resolveFrame: (value: Detection[]) => void = () => {};
    const detect = () => new Promise<Detection[]>((resolve) => (resolveFrame = resolve));
    const onDetections = vi.fn();
    const stop = startDetectLoop({ detect, onDetections, interval: () => 150 });
    await vi.advanceTimersByTimeAsync(0);
    stop();
    resolveFrame([{ rawValue: "x", format: "code_128" }]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(onDetections).not.toHaveBeenCalled();
  });
});

describe("the self-hosted .wasm", () => {
  it("is what locateFile hands the ponyfill, and nothing else is redirected", () => {
    const { locateFile } = zxingOverrides("/shelfmark/assets/zxing_reader-abc.wasm");
    expect(locateFile("zxing_reader.wasm", "https://fastly.jsdelivr.net/")).toBe("/shelfmark/assets/zxing_reader-abc.wasm");
    expect(locateFile("other.data", "/prefix/")).toBe("/prefix/other.data");
  });

  it("defaults to a URL on our own origin, not a CDN", () => {
    const url = zxingOverrides().locateFile("zxing_reader.wasm", "");
    expect(url).toMatch(/zxing_reader.*\.wasm$/);
    expect(url).not.toMatch(/^https?:/);
  });

  it("matches the ZXing build the ponyfill bundles", () => {
    // Resolved the way Vite resolves the `?url` import in detector.ts.
    const require = createRequire(import.meta.url);
    const wasm = readFileSync(require.resolve("zxing-wasm/reader/zxing_reader.wasm"));
    // A barcode-detector upgrade with a newer ZXing inside fails here until
    // the zxing-wasm next to it matches.
    expect(createHash("sha256").update(wasm).digest("hex")).toBe(ZXING_WASM_SHA256);
  });
});
