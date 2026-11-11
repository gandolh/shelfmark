/**
 * The decisions the Dialog wrapper makes, as plain functions so they are
 * tested without a DOM (the repo keeps vitest in `node`).
 */

export interface CloseDetails {
  reason: string;
  event: Event;
}

export interface CloseOptions {
  /** A save or delete is running: nothing closes the dialog until it ends. */
  pending?: boolean;
  /** A press on the backdrop closes it. Off for a dialog people type into. */
  dismissOnBackdrop?: boolean;
}

/**
 * Whether a close Base UI asks for goes ahead. Not while an action runs; not
 * for an Esc a field inside already used (a step going back); not for a press
 * outside unless the dialog allows it.
 */
export function closeAllowed(
  details: CloseDetails,
  { pending = false, dismissOnBackdrop = false }: CloseOptions,
): boolean {
  if (pending) return false;
  if (details.reason === "escape-key" && details.event.defaultPrevented) return false;
  if (details.reason === "outside-press" && !dismissOnBackdrop) return false;
  return true;
}

/** Where focus lands on open, first match wins (the house order, base-ui rule 12). */
export const INITIAL_FOCUS_ORDER = [
  "[data-autofocus]",
  "input:not([type=hidden]):not(:disabled), textarea:not(:disabled), select:not(:disabled)",
  "[data-dialog-actions] button:not(:disabled)",
] as const;

/** The element to focus on open: the first selector of the order that finds one, else `null` (Base UI's first tabbable). */
export function pickInitialFocus<T>(find: (selector: string) => T | null): T | null {
  for (const selector of INITIAL_FOCUS_ORDER) {
    const found = find(selector);
    if (found !== null) return found;
  }
  return null;
}
