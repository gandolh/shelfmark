import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONFIRM_WINDOW_MS, createSightings, REPEAT_WINDOW_MS } from "./debounce";

describe("createSightings", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires a code on the second read that agrees, within 700 ms", () => {
    const sightings = createSightings();
    expect(CONFIRM_WINDOW_MS).toBe(700);
    expect(sightings.read(["9786063205583"])).toEqual([]);
    expect(sightings.pending()).toBe(true);
    vi.advanceTimersByTime(699);
    expect(sightings.read(["9786063205583"])).toEqual(["9786063205583"]);
    expect(sightings.pending()).toBe(false);
  });

  it("starts over when the second read comes too late", () => {
    const sightings = createSightings();
    expect(sightings.read(["a"])).toEqual([]);
    vi.advanceTimersByTime(700);
    expect(sightings.pending()).toBe(false);
    expect(sightings.read(["a"])).toEqual([]);
    vi.advanceTimersByTime(150);
    expect(sightings.read(["a"])).toEqual(["a"]);
  });

  it("counts a code twice in one read as one sighting", () => {
    const sightings = createSightings();
    expect(sightings.read(["a", "a"])).toEqual([]);
    vi.advanceTimersByTime(150);
    expect(sightings.read(["a"])).toEqual(["a"]);
  });

  it("keeps a misread from firing: a different code in between doesn't confirm either", () => {
    const sightings = createSightings();
    expect(sightings.read(["9786063205538"])).toEqual([]); // two digits swapped, the check digit still fits
    vi.advanceTimersByTime(150);
    expect(sightings.read(["9786063205583"])).toEqual([]);
    vi.advanceTimersByTime(150);
    expect(sightings.read(["9786063205583"])).toEqual(["9786063205583"]);
    vi.advanceTimersByTime(700);
    expect(sightings.pending()).toBe(false);
  });

  it("stays quiet while a fired code stays in view, however long", () => {
    const sightings = createSightings();
    sightings.read(["a"]);
    vi.advanceTimersByTime(150);
    expect(sightings.read(["a"])).toEqual(["a"]);
    for (let elapsed = 0; elapsed < 10_000; elapsed += 1000) {
      vi.advanceTimersByTime(1000);
      expect(sightings.read(["a"])).toEqual([]);
      expect(sightings.pending()).toBe(false);
    }
  });

  it("fires again once the code has been out of view for 3 s", () => {
    const sightings = createSightings();
    expect(REPEAT_WINDOW_MS).toBe(3000);
    sightings.read(["a"]);
    vi.advanceTimersByTime(150);
    expect(sightings.read(["a"])).toEqual(["a"]);
    vi.advanceTimersByTime(2999);
    expect(sightings.read(["a"])).toEqual([]);
    vi.advanceTimersByTime(3000);
    // Away long enough: this read is a first sighting again, and needs its second.
    expect(sightings.read(["a"])).toEqual([]);
    vi.advanceTimersByTime(150);
    expect(sightings.read(["a"])).toEqual(["a"]);
  });

  it("tracks each code on its own", () => {
    const sightings = createSightings();
    sightings.read(["isbn", "sticker"]);
    vi.advanceTimersByTime(150);
    expect(sightings.read(["isbn", "sticker"])).toEqual(["isbn", "sticker"]);
    vi.advanceTimersByTime(150);
    expect(sightings.read(["other"])).toEqual([]);
    vi.advanceTimersByTime(150);
    expect(sightings.read(["other", "isbn"])).toEqual(["other"]);
  });

  it("touch restarts every fired code's window, so a code still in frame stays quiet", () => {
    const sightings = createSightings();
    sightings.read(["a"]);
    vi.advanceTimersByTime(150);
    sightings.read(["a"]);
    // Paused for a while (a held sheet), then resumed.
    vi.advanceTimersByTime(60_000);
    sightings.touch();
    vi.advanceTimersByTime(250);
    expect(sightings.read(["a"])).toEqual([]);
  });

  it("takes an explicit clock and windows", () => {
    const sightings = createSightings(100, 500);
    expect(sightings.read(["a"], 1000)).toEqual([]);
    expect(sightings.pending(1099)).toBe(true);
    expect(sightings.pending(1100)).toBe(false);
    expect(sightings.read(["a"], 1050)).toEqual(["a"]);
    expect(sightings.read(["a"], 1549)).toEqual([]);
    expect(sightings.read(["a"], 2049)).toEqual([]);
    expect(sightings.read(["a"], 2100)).toEqual(["a"]);
  });

  it("forgets everything on reset", () => {
    const sightings = createSightings();
    sightings.read(["a"]);
    vi.advanceTimersByTime(150);
    sightings.read(["a"]);
    sightings.reset();
    expect(sightings.read(["a"])).toEqual([]);
    vi.advanceTimersByTime(150);
    expect(sightings.read(["a"])).toEqual(["a"]);
  });
});
