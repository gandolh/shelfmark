import { cn } from "../../lib/cn";
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

// A white floating panel with the menus' shadow over a dimmed page: in the middle of the window on the desktop,
// the floating sheet over the bottom on a phone.
const POPUP = "z-float flex flex-col overflow-hidden bg-surface text-ink shadow-float outline-none";
const CENTERED =
  "fixed inset-0 m-auto mt-[max(24px,16vh)] h-fit max-h-[calc(100dvh-48px)] w-100 max-w-[calc(100vw-32px)] rounded-sheet motion-safe:animate-dialog-in";
const SHEET =
  "fixed inset-x-2 top-auto bottom-[max(8px,env(safe-area-inset-bottom))] max-h-[min(90dvh,680px)] w-auto rounded-sheet motion-safe:animate-sheet-in";

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
        <BaseDialog.Backdrop className="fixed inset-0 z-float bg-scrim" />
        <BaseDialog.Popup
          ref={popupRef}
          className={cn(POPUP, desktop ? CENTERED : SHEET)}
          initialFocus={() => {
            const popup = popupRef.current;
            return popup ? (pickInitialFocus((selector) => popup.querySelector<HTMLElement>(selector)) ?? true) : true;
          }}
          finalFocus={() => {
            const target = typeof returnFocus === "function" ? returnFocus() : returnFocus;
            return target?.isConnected ? target : true;
          }}
        >
          <div
            className={cn(
              "flex min-h-0 flex-col gap-4.5 overflow-y-auto overscroll-contain",
              desktop ? "pt-5.5 pr-6 pb-6 pl-6" : "px-4 pt-5 pb-4",
            )}
          >
            <BaseDialog.Title
              className={cn("text-body leading-tight font-semibold wrap-anywhere text-ink", !desktop && "text-center")}
            >
              {title}
            </BaseDialog.Title>
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
    <div
      className={cn("mt-1.5 flex items-center justify-end gap-3", !desktop && "flex-col-reverse items-stretch gap-1")}
      data-dialog-actions
    >
      <Button variant="quiet" size={desktop ? "regular" : "large"} block={!desktop} onClick={onCancel}>
        {cancel}
      </Button>
      {children}
    </div>
  );
}
