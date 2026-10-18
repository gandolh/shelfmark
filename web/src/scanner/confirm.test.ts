import { describe, expect, it } from "vitest";
import { CONFIRM_WINDOW_MS, createConfirmer } from "./confirm";

describe("createConfirmer", () => {
  it("agrees on a code read again within 700 ms", () => {
    const confirmer = createConfirmer();
    expect(CONFIRM_WINDOW_MS).toBe(700);
    expect(confirmer.read(["9786063205583"], 0)).toEqual([]);
    expect(confirmer.read(["9786063205583"], 699)).toEqual(["9786063205583"]);
  });

  it("starts over when the second read comes too late", () => {
    const confirmer = createConfirmer();
    expect(confirmer.read(["a"], 0)).toEqual([]);
    expect(confirmer.read(["a"], 700)).toEqual([]);
    expect(confirmer.read(["a"], 850)).toEqual(["a"]);
  });

  it("counts a code twice in one read as one sighting", () => {
    const confirmer = createConfirmer();
    expect(confirmer.read(["a", "a"], 0)).toEqual([]);
    expect(confirmer.read(["a"], 150)).toEqual(["a"]);
  });

  it("keeps a misread from counting: a different code in between doesn't agree either", () => {
    const confirmer = createConfirmer();
    // Two digits swapped: the check digit still fits.
    expect(confirmer.read(["9786063205538"], 0)).toEqual([]);
    expect(confirmer.read(["9786063205583"], 150)).toEqual([]);
    expect(confirmer.read(["9786063205583"], 300)).toEqual(["9786063205583"]);
  });

  it("tracks each code on its own", () => {
    const confirmer = createConfirmer();
    expect(confirmer.read(["isbn", "sticker"], 0)).toEqual([]);
    expect(confirmer.read(["sticker"], 150)).toEqual(["sticker"]);
    expect(confirmer.read(["isbn"], 300)).toEqual(["isbn"]);
  });

  it("takes an explicit window", () => {
    const confirmer = createConfirmer(100);
    expect(confirmer.read(["a"], 1000)).toEqual([]);
    expect(confirmer.read(["a"], 1100)).toEqual([]);
    expect(confirmer.read(["a"], 1199)).toEqual(["a"]);
  });
});
