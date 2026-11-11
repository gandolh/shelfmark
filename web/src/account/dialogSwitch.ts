import { useSyncExternalStore } from "react";

/**
 * The account menu's dialogs, Change username and Change password, open and
 * close from outside React: the menu's action opens one, a Ward round trip
 * reopens it. The dialog itself is the shared `Dialog` wrapper
 * (components/ui/Dialog.tsx).
 */

// --- Open and closed, from outside React -------------------------------------------

export interface DialogSwitch {
  /** Open it (the account menu's action), remembering what had focus, the account button, to go back to. */
  show(): void;
  /** Open or close it without touching where focus goes back to (a Ward round trip reopens it). */
  set(next: boolean): void;
  /** Whether it is open, for the component that mounts it. */
  useOpen(): boolean;
  /** What had focus when it opened, once; null after that. */
  takeReturnFocus(): HTMLElement | null;
}

/** One dialog's open state, kept outside React so the menu can open it. */
export function dialogSwitch(): DialogSwitch {
  let open = false;
  let returnFocus: HTMLElement | null = null;
  const listeners = new Set<() => void>();

  function set(next: boolean): void {
    if (next === open) return;
    open = next;
    for (const listener of listeners) listener();
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  return {
    show() {
      if (open) return;
      returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      set(true);
    },
    set,
    useOpen: () =>
      useSyncExternalStore(
        subscribe,
        () => open,
        () => false,
      ),
    takeReturnFocus() {
      const target = returnFocus;
      returnFocus = null;
      return target;
    },
  };
}
