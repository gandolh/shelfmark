import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { useRef, type ReactNode } from "react";
import { useIsDesktop } from "../../layout/viewport";
import { Button } from "../Button";
import { closeAllowed, pickInitialFocus } from "./dialog-logic";

/**
 * The one modal frame: a white panel in the middle of the window on the
 * desktop, the floating sheet over the bottom of a phone. Holds what every
 * dialog repeats: the Escape guard, the house initial focus
 * (`[data-autofocus]`, else the first field, else the footer's first button),
 * focus going back to what opened it, and a `Title`. A dialog people type
 * into ignores a press on the backdrop (`dismissOnBackdrop` is off); while
 * `pending` it ignores Esc as well.
 */

export interface DialogProps {
  title: string;
  onClose: () => void;
  /** What had focus when it opened, or a getter for it (read once, on close). */
  returnFocus?: HTMLElement | null | (() => HTMLElement | null);
  /** Let a press on the backdrop close it. Off by default. */
  dismissOnBackdrop?: boolean;
  /** A save or delete is running: Esc and the backdrop do nothing until it ends. */
  pending?: boolean;
  children: ReactNode;
}

export function Dialog({
  title,
  onClose,
  returnFocus,
  dismissOnBackdrop = false,
  pending = false,
  children,
}: DialogProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const desktop = useIsDesktop();
  return (
    <BaseDialog.Root
      open
      disablePointerDismissal={!dismissOnBackdrop}
      onOpenChange={(next, details) => {
        if (!next && closeAllowed(details, { pending, dismissOnBackdrop })) onClose();
      }}
    >
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="library-dialog-backdrop" />
        <BaseDialog.Popup
          ref={popupRef}
          className={desktop ? "library-dialog library-dialog--centered" : "library-dialog library-dialog--sheet"}
          initialFocus={() => {
            const popup = popupRef.current;
            return popup ? (pickInitialFocus((selector) => popup.querySelector<HTMLElement>(selector)) ?? true) : true;
          }}
          finalFocus={() => {
            const target = typeof returnFocus === "function" ? returnFocus() : returnFocus;
            return target?.isConnected ? target : true;
          }}
        >
          <div className="library-dialog__frame">
            <BaseDialog.Title className="library-dialog__title">{title}</BaseDialog.Title>
            {children}
          </div>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

/** Cancel and the action: on the desktop a row on the right, the action last; on a phone the action on top, full width. */
export function DialogActions({
  desktop,
  cancel = "Cancel",
  onCancel,
  children,
}: {
  desktop: boolean;
  cancel?: string;
  onCancel: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="library-dialog__actions" data-dialog-actions>
      <Button variant="quiet" size={desktop ? "regular" : "large"} block={!desktop} onClick={onCancel}>
        {cancel}
      </Button>
      {children}
    </div>
  );
}
