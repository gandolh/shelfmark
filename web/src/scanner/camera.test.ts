import { describe, expect, it, vi } from "vitest";
import {
  cameraFailure,
  hasTorch,
  readoutLines,
  tuneCamera,
  tuningFor,
  VIDEO_CONSTRAINTS,
  zoomsTo2x,
  type CameraCapabilities,
} from "./camera";

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

describe("VIDEO_CONSTRAINTS", () => {
  it("asks for the rear camera at 1920×1080, as an ideal", () => {
    expect(VIDEO_CONSTRAINTS).toEqual({ facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } });
  });
});

/** A stand-in track that reports `capabilities` (or has no `getCapabilities`, like Firefox's). */
function fakeTrack(capabilities: CameraCapabilities | null) {
  const applyConstraints = vi.fn((_constraints: MediaTrackConstraints) => Promise.resolve());
  const track = { applyConstraints, ...(capabilities === null ? {} : { getCapabilities: () => capabilities }) };
  return { track: track as unknown as MediaStreamTrack, applyConstraints };
}

const ANDROID: CameraCapabilities = {
  width: { min: 1, max: 4000 },
  height: { min: 1, max: 3000 },
  zoom: { min: 1, max: 8, step: 0.1 },
  focusMode: ["manual", "single-shot", "continuous"],
  torch: true,
};

describe("the zoom chip", () => {
  it("shows when the camera zooms to 2 or more", () => {
    expect(zoomsTo2x({ zoom: { min: 1, max: 2 } })).toBe(true);
    expect(zoomsTo2x(ANDROID)).toBe(true);
  });

  it("doesn't show when the camera zooms less, or not at all", () => {
    expect(zoomsTo2x({ zoom: { min: 1, max: 1.5 } })).toBe(false);
    expect(zoomsTo2x({ zoom: {} })).toBe(false);
    expect(zoomsTo2x({})).toBe(false);
  });
});

describe("tuningFor", () => {
  it("sets the torch, the zoom and continuous focus when the camera lists them", () => {
    expect(tuningFor(ANDROID, { torch: false, zoom: 2 })).toEqual({ torch: false, zoom: 2, focusMode: "continuous" });
    expect(tuningFor(ANDROID, { torch: true, zoom: 1 })).toEqual({ torch: true, zoom: 1, focusMode: "continuous" });
  });

  it("sets no focus when the camera doesn't list continuous", () => {
    expect(tuningFor({ focusMode: ["manual", "single-shot"] }, { torch: false, zoom: 2 })).toBeNull();
    expect(tuningFor({ ...ANDROID, focusMode: undefined }, { torch: false, zoom: 2 })).not.toHaveProperty("focusMode");
  });

  it("sets no zoom when the camera can't reach 2", () => {
    expect(tuningFor({ zoom: { min: 1, max: 1.5 } }, { torch: false, zoom: 2 })).toBeNull();
    expect(tuningFor({ ...ANDROID, zoom: undefined }, { torch: false, zoom: 2 })).not.toHaveProperty("zoom");
  });

  it("keeps 1× inside the camera's range", () => {
    expect(tuningFor({ zoom: { min: 1.2, max: 4 } }, { torch: false, zoom: 1 })).toEqual({ zoom: 1.2 });
  });

  it("sets no torch on a camera without one", () => {
    expect(tuningFor({ torch: false }, { torch: true, zoom: 2 })).toBeNull();
  });
});

describe("tuneCamera", () => {
  it("applies one advanced set with what the camera offers", async () => {
    const { track, applyConstraints } = fakeTrack(ANDROID);
    await tuneCamera(track, { torch: false, zoom: 2 });
    expect(applyConstraints).toHaveBeenCalledExactlyOnceWith({ advanced: [{ torch: false, zoom: 2, focusMode: "continuous" }] });
  });

  it("applies nothing when the camera offers none of it (Safari without zoom, a laptop)", async () => {
    const safari = fakeTrack({ width: { max: 1920 }, height: { max: 1080 } });
    await tuneCamera(safari.track, { torch: false, zoom: 2 });
    expect(safari.applyConstraints).not.toHaveBeenCalled();
  });

  it("applies nothing when the browser can't list capabilities", async () => {
    const firefox = fakeTrack(null);
    await tuneCamera(firefox.track, { torch: true, zoom: 2 });
    expect(firefox.applyConstraints).not.toHaveBeenCalled();
    expect(hasTorch(firefox.track)).toBe(false);
  });
});

describe("readoutLines", () => {
  it("shows the engine, what was granted, what the camera can do and the last decode", () => {
    expect(
      readoutLines({
        engine: "native",
        label: "camera2 0, facing back",
        settings: { width: 1920, height: 1080, frameRate: 29.97, zoom: 2, focusMode: "continuous" },
        capabilities: ANDROID,
        decodeMs: 41.6,
      }),
    ).toEqual([
      "native · camera2 0, facing back",
      "got 1920×1080 · 29.97 fps · zoom 2 · focus continuous",
      "can up to 4000×3000 · zoom 1–8 · focus manual, single-shot, continuous · torch",
      "decode 42 ms",
    ]);
  });

  it("says what the browser didn't report", () => {
    expect(readoutLines({ engine: "zxing", label: "", settings: {}, capabilities: {}, decodeMs: null })).toEqual([
      "zxing · unnamed camera",
      "got not reported",
      "can not reported",
      "decode –",
    ]);
  });
});
