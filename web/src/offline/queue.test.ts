import { describe, expect, it } from "vitest";
import { inScanOrder, isQueued, nextWaiting, type QueuedScan } from "./queue";

function scan(id: number, isbn13: string, scannedAt: string): QueuedScan {
  return { id, isbn13, scannedAt, shelf: null };
}

const A = scan(1, "9780547928227", "2026-10-23T08:00:00.000Z");
const B = scan(2, "9786063205583", "2026-10-23T08:01:00.000Z");
const C = scan(3, "9780441172719", "2026-10-23T08:01:00.000Z");

describe("the scan queue", () => {
  it("knows an ISBN that is already waiting, so a second scan isn't queued again", () => {
    expect(isQueued([A, B], A.isbn13)).toBe(true);
    expect(isQueued([A, B], C.isbn13)).toBe(false);
    expect(isQueued([], A.isbn13)).toBe(false);
  });

  it("orders oldest first, the key breaking a tie, without touching the list", () => {
    const list = [C, B, A];
    expect(inScanOrder(list).map((s) => s.id)).toEqual([1, 2, 3]);
    expect(list.map((s) => s.id)).toEqual([3, 2, 1]);
  });

  it("picks the oldest scan nothing has answered yet, one at a time", () => {
    const list = [C, B, A];
    expect(nextWaiting(list, () => false)?.id).toBe(1);
    expect(nextWaiting(list, (id) => id === 1)?.id).toBe(2);
    expect(nextWaiting(list, (id) => id !== 3)?.id).toBe(3);
    expect(nextWaiting(list, () => true)).toBeNull();
    expect(nextWaiting([], () => false)).toBeNull();
  });
});
