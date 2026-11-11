import { Dialog } from "@base-ui/react/dialog";
import { useRef, useSyncExternalStore, type ReactNode } from "react";
import { Button } from "../components/Button";
import { useIsDesktop } from "../layout/viewport";
import "../auth/auth.css";
import "./account.css";

/**
 * The account menu's dialogs, Change username and Change password, share this
 * shell: a modal Base UI `Dialog`, so focus stays in the form until it is done
 * or cancelled. On the desktop a white panel in the middle of the window; on a
 * phone the floating sheet over the bottom of the screen, as the Library's
 * Filter panel.
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

// --- The shell ---------------------------------------------------------------------

interface AccountDialogProps {
  title: string;
  onClose: () => void;
  /** The switch's `takeReturnFocus`. */
  returnFocus: () => HTMLElement | null;
  children: ReactNode;
}

/** The panel or sheet, its title, and the body. The element marked `data-autofocus` takes focus on open. */
export function AccountDialog({ title, onClose, returnFocus, children }: AccountDialogProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const desktop = useIsDesktop();

  // Esc, and a press on the backdrop as the panels do, close it; an Esc a field already used doesn't.
  return (
    <Dialog.Root
      open
      onOpenChange={(next, details) => {
        if (!next && !(details.reason === "escape-key" && details.event.defaultPrevented)) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="account-dialog-backdrop" />
        <Dialog.Popup
          ref={popupRef}
          className={desktop ? "account-dialog account-dialog--centered" : "account-dialog account-dialog--sheet"}
          initialFocus={() => popupRef.current?.querySelector<HTMLElement>("[data-autofocus]") ?? true}
          // Back to what had focus when it opened: the account button.
          finalFocus={() => {
            const target = returnFocus();
            return target?.isConnected ? target : true;
          }}
        >
          <div className="account-dialog__frame">
            <Dialog.Title className="account-dialog__title">{title}</Dialog.Title>
            {children}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Cancel and the action: on the desktop a row on the right, the action last; on a phone the action on top, full width. */
export function Actions({
  desktop,
  onCancel,
  children,
}: {
  desktop: boolean;
  onCancel: () => void;
  children: ReactNode;
}) {
  return (
    <div className="account-dialog__actions">
      <Button variant="quiet" size={desktop ? "regular" : "large"} block={!desktop} onClick={onCancel}>
        Cancel
      </Button>
      {children}
    </div>
  );
}
