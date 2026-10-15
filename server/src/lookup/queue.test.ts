import { describe, expect, it } from "vitest";
import { createQueue, GOOGLE_BOOKS_SPACING_MS, OPEN_LIBRARY_SPACING_MS, type Clock } from "./queue.js";

/** A clock that moves only when the queue sleeps, so spacing is measured exactly and instantly. */
function fakeClock(): Clock & { slept: number[] } {
  let now = 1_000;
  const slept: number[] = [];
  return {
    slept,
    now: () => now,
    sleep: async (ms) => {
      slept.push(ms);
      now += ms;
    },
  };
}

describe("createQueue", () => {
  it("spaces a batch of 300 ISBNs at least 400 ms apart for Open Library, one at a time", async () => {
    const clock = fakeClock();
    const queue = createQueue(OPEN_LIBRARY_SPACING_MS, clock);
    const starts: number[] = [];
    let running = 0;
    let most = 0;

    // All 300 are queued at once, as a CSV import would.
    await Promise.all(
      Array.from({ length: 300 }, (_, i) =>
        queue.run(async () => {
          running++;
          most = Math.max(most, running);
          starts.push(clock.now());
          await Promise.resolve();
          running--;
          return i;
        }),
      ),
    );

    expect(most).toBe(1);
    expect(starts).toHaveLength(300);
    const gaps = starts.slice(1).map((start, i) => start - starts[i]!);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(400);
    expect(starts.at(-1)! - starts[0]!).toBeGreaterThanOrEqual(299 * 400);
  });

  it("spaces Google Books 200 ms apart", async () => {
    const clock = fakeClock();
    const queue = createQueue(GOOGLE_BOOKS_SPACING_MS, clock);
    const starts: number[] = [];
    await Promise.all([1, 2, 3].map(() => queue.run(async () => starts.push(clock.now()))));
    expect(starts).toEqual([1_000, 1_200, 1_400]);
  });

  it("starts the first request at once and waits only the rest of the spacing", async () => {
    const clock = fakeClock();
    const queue = createQueue(400, clock);
    await queue.run(() => clock.sleep(150)); // the request itself took 150 ms
    expect(clock.slept).toEqual([150]);
    await queue.run(async () => undefined);
    expect(clock.slept).toEqual([150, 250]);
  });

  it("returns each task's result in order and keeps going after a failure", async () => {
    const queue = createQueue(400, fakeClock());
    const results = await Promise.allSettled([
      queue.run(async () => "first"),
      queue.run(async () => {
        throw new Error("Open Library answered 503");
      }),
      queue.run(async () => "third"),
    ]);
    expect(results.map((result) => result.status)).toEqual(["fulfilled", "rejected", "fulfilled"]);
    expect(results[2]).toEqual({ status: "fulfilled", value: "third" });
  });

  it("waits with real timers too", async () => {
    const queue = createQueue(30);
    const starts: number[] = [];
    await Promise.all([1, 2, 3].map(() => queue.run(async () => starts.push(performance.now()))));
    expect(starts[1]! - starts[0]!).toBeGreaterThanOrEqual(29);
    expect(starts[2]! - starts[1]!).toBeGreaterThanOrEqual(29);
  });
});
