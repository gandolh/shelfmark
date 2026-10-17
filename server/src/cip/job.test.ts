import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FIRST_RUN_DELAY_MS, RUN_EVERY_MS, startCipJob } from "./job.js";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

describe("startCipJob", () => {
  it("runs a minute after start, then weekly, never twice at once", async () => {
    let runs = 0;
    let finish: () => void = () => undefined;
    const job = startCipJob(
      () =>
        new Promise<void>((resolve) => {
          runs++;
          finish = resolve;
        }),
      log,
    );
    await vi.advanceTimersByTimeAsync(FIRST_RUN_DELAY_MS - 1);
    expect(runs).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(runs).toBe(1);
    // Still running a week later: the second tick is skipped.
    await vi.advanceTimersByTimeAsync(RUN_EVERY_MS);
    expect(runs).toBe(1);
    finish();
    await vi.advanceTimersByTimeAsync(RUN_EVERY_MS);
    expect(runs).toBe(2);
    job.stop();
    finish();
    await vi.advanceTimersByTimeAsync(RUN_EVERY_MS * 3);
    expect(runs).toBe(2);
  });

  it("logs a failed run and keeps the schedule", async () => {
    let runs = 0;
    const job = startCipJob(async () => {
      runs++;
      throw new Error("The national library's site answered 503");
    }, log);
    await vi.advanceTimersByTimeAsync(FIRST_RUN_DELAY_MS + RUN_EVERY_MS);
    expect(runs).toBe(2);
    expect(log.error).toHaveBeenCalledWith("cip: refresh failed: The national library's site answered 503");
    job.stop();
  });
});
