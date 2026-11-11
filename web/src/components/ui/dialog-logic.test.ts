import { describe, expect, it } from "vitest";
import { closeAllowed, INITIAL_FOCUS_ORDER, pickInitialFocus } from "./dialog-logic";

const press = (reason: string, defaultPrevented = false) => ({
  reason,
  event: { defaultPrevented } as Event,
});

describe("closeAllowed", () => {
  it("lets Esc, the X and Cancel close it", () => {
    expect(closeAllowed(press("escape-key"), {})).toBe(true);
    expect(closeAllowed(press("close-press"), {})).toBe(true);
  });

  it("ignores an Esc a field already used", () => {
    expect(closeAllowed(press("escape-key", true), {})).toBe(false);
  });

  it("ignores any close while an action runs", () => {
    for (const reason of ["escape-key", "close-press", "outside-press"]) {
      expect(closeAllowed(press(reason), { pending: true, dismissOnBackdrop: true })).toBe(false);
    }
  });

  it("ignores a backdrop press unless the dialog allows it", () => {
    expect(closeAllowed(press("outside-press"), {})).toBe(false);
    expect(closeAllowed(press("outside-press"), { dismissOnBackdrop: true })).toBe(true);
  });
});

describe("pickInitialFocus", () => {
  it("tries [data-autofocus], then a field, then the footer's first button", () => {
    const tried: string[] = [];
    expect(
      pickInitialFocus((selector) => {
        tried.push(selector);
        return null;
      }),
    ).toBeNull();
    expect(tried).toEqual([...INITIAL_FOCUS_ORDER]);
    expect(INITIAL_FOCUS_ORDER[0]).toBe("[data-autofocus]");
    expect(INITIAL_FOCUS_ORDER[1]).toContain("input");
    expect(INITIAL_FOCUS_ORDER[2]).toContain("data-dialog-actions");
  });

  it("stops at the first selector that finds something", () => {
    const tried: string[] = [];
    const found = pickInitialFocus((selector) => {
      tried.push(selector);
      return selector === INITIAL_FOCUS_ORDER[1] ? "field" : null;
    });
    expect(found).toBe("field");
    expect(tried).toHaveLength(2);
  });
});
