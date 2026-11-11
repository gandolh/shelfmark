import { describe, expect, it } from "vitest";
import {
  clampPage,
  DEFAULT_PAGE_SIZE,
  isPageSize,
  pageCount,
  pageItems,
  pageRange,
  pageSlice,
  PAGE_SIZES,
  showsPager,
} from "./pagination";

const list = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe("page sizes", () => {
  it("offers 10, 25, 50 and 100, 10 by default", () => {
    expect(PAGE_SIZES).toEqual([10, 25, 50, 100]);
    expect(DEFAULT_PAGE_SIZE).toBe(10);
    expect(isPageSize(10)).toBe(true);
    expect(isPageSize(100)).toBe(true);
    for (const value of [0, 75, 200, "50", null, undefined]) expect(isPageSize(value)).toBe(false);
  });
});

describe("pageCount", () => {
  it("is one page for an empty list and for a list that fits", () => {
    expect(pageCount(0, 50)).toBe(1);
    expect(pageCount(1, 50)).toBe(1);
    expect(pageCount(50, 50)).toBe(1);
  });

  it("rounds up a part page", () => {
    expect(pageCount(51, 50)).toBe(2);
    expect(pageCount(1234, 50)).toBe(25);
    expect(pageCount(1234, 200)).toBe(7);
  });
});

describe("clampPage", () => {
  it("keeps a page in range", () => {
    expect(clampPage(3, 25)).toBe(3);
    expect(clampPage(0, 25)).toBe(1);
    expect(clampPage(-4, 25)).toBe(1);
    expect(clampPage(26, 25)).toBe(25);
  });

  it("is page 1 when there is one page or the number is no number", () => {
    expect(clampPage(5, 1)).toBe(1);
    expect(clampPage(5, 0)).toBe(1);
    expect(clampPage(Number.NaN, 25)).toBe(1);
    expect(clampPage(2.7, 25)).toBe(2);
  });
});

describe("pageSlice", () => {
  it("cuts the list into pages", () => {
    const rows = list(120);
    expect(pageSlice(rows, 1, 50)).toEqual(list(50));
    expect(pageSlice(rows, 2, 50)[0]).toBe(51);
    expect(pageSlice(rows, 2, 50)).toHaveLength(50);
    expect(pageSlice(rows, 3, 50)).toEqual([
      101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120,
    ]);
  });

  it("shows the last page for a page past the end", () => {
    expect(pageSlice(list(120), 9, 50)[0]).toBe(101);
  });

  it("hands back the list itself when it fits on one page", () => {
    const rows = list(50);
    expect(pageSlice(rows, 1, 50)).toBe(rows);
    const empty: number[] = [];
    expect(pageSlice(empty, 1, 50)).toBe(empty);
  });
});

describe("pageRange", () => {
  it("counts from 1 over the whole list", () => {
    expect(pageRange(2, 50, 1234)).toEqual({ first: 51, last: 100 });
    expect(pageRange(25, 50, 1234)).toEqual({ first: 1201, last: 1234 });
    expect(pageRange(1, 50, 7)).toEqual({ first: 1, last: 7 });
  });

  it("is nothing for an empty list, and the last page for a page past the end", () => {
    expect(pageRange(1, 50, 0)).toEqual({ first: 0, last: 0 });
    expect(pageRange(30, 50, 1234)).toEqual({ first: 1201, last: 1234 });
  });
});

describe("pageItems", () => {
  it("shows every page up to seven", () => {
    expect(pageItems(1, 1)).toEqual([1]);
    expect(pageItems(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("puts one gap before the last page near the start", () => {
    expect(pageItems(1, 25)).toEqual([1, 2, 3, 4, 5, "gap", 25]);
    expect(pageItems(4, 25)).toEqual([1, 2, 3, 4, 5, "gap", 25]);
  });

  it("puts a gap on each side in the middle", () => {
    expect(pageItems(5, 25)).toEqual([1, "gap", 4, 5, 6, "gap", 25]);
    expect(pageItems(12, 25)).toEqual([1, "gap", 11, 12, 13, "gap", 25]);
    expect(pageItems(21, 25)).toEqual([1, "gap", 20, 21, 22, "gap", 25]);
  });

  it("puts one gap after the first page near the end", () => {
    expect(pageItems(22, 25)).toEqual([1, "gap", 21, 22, 23, 24, 25]);
    expect(pageItems(25, 25)).toEqual([1, "gap", 21, 22, 23, 24, 25]);
  });

  it("keeps seven items past seven pages, and no gap hides a single page", () => {
    for (let count = 8; count <= 30; count += 1) {
      for (let page = 1; page <= count; page += 1) {
        const items = pageItems(page, count);
        expect(items).toHaveLength(7);
        expect(items).toContain(page);
        expect(items[0]).toBe(1);
        expect(items.at(-1)).toBe(count);
        items.forEach((item, i) => {
          if (item !== "gap") return;
          const before = items[i - 1] as number;
          const after = items[i + 1] as number;
          expect(after - before).toBeGreaterThan(2);
        });
      }
    }
  });

  it("clamps the current page", () => {
    expect(pageItems(40, 25)).toEqual([1, "gap", 21, 22, 23, 24, 25]);
    expect(pageItems(0, 25)).toEqual([1, 2, 3, 4, 5, "gap", 25]);
  });
});

describe("showsPager", () => {
  it("is gone while everything fits on one page of 10 or fewer", () => {
    expect(showsPager(0, 10)).toBe(false);
    expect(showsPager(10, 10)).toBe(false);
    expect(showsPager(7, 25)).toBe(false);
  });

  it("shows when the list runs past one page", () => {
    expect(showsPager(11, 10)).toBe(true);
    expect(showsPager(51, 50)).toBe(true);
  });

  it("stays when a larger size put more than 10 books on one page, so the size can go back", () => {
    expect(showsPager(11, 25)).toBe(true);
    expect(showsPager(80, 100)).toBe(true);
  });
});
