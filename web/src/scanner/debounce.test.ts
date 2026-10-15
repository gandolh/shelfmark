import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRepeatGuard, REPEAT_WINDOW_MS } from "./debounce";

describe("createRepeatGuard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("quiets the same code for 3 s after it fires", () => {
    const guard = createRepeatGuard();
    expect(REPEAT_WINDOW_MS).toBe(3000);
    expect(guard.accept("9786063205583")).toBe(true);
    vi.advanceTimersByTime(2999);
    expect(guard.accept("9786063205583")).toBe(false);
    vi.advanceTimersByTime(1);
    expect(guard.accept("9786063205583")).toBe(true);
  });

  it("touch restarts every remembered window, so a code still in frame stays quiet", () => {
    const guard = createRepeatGuard();
    expect(guard.accept("9786063205583")).toBe(true);
    vi.advanceTimersByTime(10_000);
    guard.touch();
    expect(guard.accept("9786063205583")).toBe(false);
    // A different code still fires at once.
    expect(guard.accept("9789731000015")).toBe(true);
    vi.advanceTimersByTime(REPEAT_WINDOW_MS);
    expect(guard.accept("9786063205583")).toBe(true);
  });

  it("fires a different code at once", () => {
    const guard = createRepeatGuard();
    expect(guard.accept("9786063205583")).toBe(true);
    vi.advanceTimersByTime(150);
    expect(guard.accept("9789731000015")).toBe(true);
    vi.advanceTimersByTime(150);
    // Each code keeps its own window: back to the first one, still quiet.
    expect(guard.accept("9786063205583")).toBe(false);
  });

  it("counts the window from the fire, not from the latest sighting", () => {
    const guard = createRepeatGuard();
    expect(guard.accept("a")).toBe(true);
    for (let elapsed = 150; elapsed < 3000; elapsed += 150) {
      vi.advanceTimersByTime(150);
      expect(guard.accept("a")).toBe(false);
    }
    vi.advanceTimersByTime(150);
    expect(guard.accept("a")).toBe(true);
  });

  it("takes an explicit clock and window", () => {
    const guard = createRepeatGuard(500);
    expect(guard.accept("a", 1000)).toBe(true);
    expect(guard.accept("a", 1499)).toBe(false);
    expect(guard.accept("a", 1500)).toBe(true);
  });

  it("forgets everything on reset", () => {
    const guard = createRepeatGuard();
    expect(guard.accept("a")).toBe(true);
    guard.reset();
    expect(guard.accept("a")).toBe(true);
  });
});
