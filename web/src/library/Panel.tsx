import { useEffect, useLayoutEffect, useRef, type MouseEvent, type ReactNode, type RefObject, type SyntheticEvent } from "react";
import { BackIcon } from "../components/icons";

export interface PanelProps {
  /** Names the panel for screen readers: "Filter", "Columns". */
  label: string;
  /** The control that opened it: the desktop panel hangs under it, and focus goes back to it on close. */
  anchor: HTMLElement;
  /** Where focus goes when the anchor is gone by then (a chip whose filter was removed). */
  fallback?: () => HTMLElement | null;
  /** Desktop: a white panel under the anchor. Phone: a sheet over the bottom of the screen. */
  desktop: boolean;
  /** Which edge of the anchor the desktop panel lines up with. */
  align?: "start" | "end";
  onClose: () => void;
  children: ReactNode;
}

const GAP = 8;
const MARGIN = 8;

/**
 * The Filter and Columns panels: a modal `<dialog>`, so focus stays inside,
 * Escape closes it and nothing behind it clips it. On the desktop it is a
 * white panel under its button with no dimming (a click outside closes it);
 * on a phone it is a sheet over the bottom of the screen, as design.md's
 * floating sheet, over a dimmed page. Content changes apply as they are made;
 * Done only closes. Built here for the Library; a candidate for
 * components/ when another page needs one.
 */
export function Panel({ label, anchor, fallback, desktop, align = "start", onClose, children }: PanelProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Open as soon as it mounts, focus what asked for it, and hand focus back
  // on the way out.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => {
      if (dialog.open) dialog.close();
      (anchor.isConnected ? anchor : fallback?.())?.focus();
    };
  }, [anchor, fallback]);

  // The desktop panel follows its button while the page scrolls or resizes.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !desktop) return;
    const place = () => {
      // A chip that opened the panel goes when its filter does; the panel stays where it is.
      if (!anchor.isConnected) return;
      const box = anchor.getBoundingClientRect();
      const width = dialog.offsetWidth;
      const preferred = align === "end" ? box.right - width : box.left;
      const left = Math.min(Math.max(preferred, MARGIN), window.innerWidth - width - MARGIN);
      const top = Math.min(box.bottom + GAP, window.innerHeight - 160);
      dialog.style.left = `${Math.round(left)}px`;
      dialog.style.top = `${Math.round(Math.max(MARGIN, top))}px`;
      dialog.style.maxHeight = `${Math.round(window.innerHeight - Math.max(MARGIN, top) - MARGIN)}px`;
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchor, desktop, align]);

  // A press outside the panel (on the backdrop, which the dialog itself
  // receives) closes it, as a menu does.
  const onClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  const onCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-label={label}
      className={desktop ? "library-panel library-panel--anchored" : "library-panel library-panel--sheet"}
      onClick={onClick}
      onCancel={onCancel}
    >
      <div className="library-panel__frame">{children}</div>
    </dialog>
  );
}

export interface PanelHeaderProps {
  title: string;
  /** A step back inside the panel: "Filters". */
  back?: { label: string; onClick: () => void };
  onDone: () => void;
}

/** The panel's top row: a way back (when there is one), the title, and Done. */
export function PanelHeader({ title, back, onDone }: PanelHeaderProps) {
  return (
    <div className="library-panel__head">
      <div className="library-panel__start">
        {back && (
          <button type="button" className="library-panel__back" onClick={back.onClick}>
            <BackIcon size={18} />
            {back.label}
          </button>
        )}
      </div>
      <h2 className="library-panel__title">{title}</h2>
      <div className="library-panel__end">
        <button type="button" className="button button--quiet button--compact library-panel__done" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}

/** Keeps the panel's focus on a step's first control when the step changes. */
export function useFocusOnChange(key: unknown, container: RefObject<HTMLElement | null>): void {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const root = container.current;
    const target =
      root?.querySelector<HTMLElement>("[data-autofocus]") ??
      root?.querySelector<HTMLElement>(".library-panel__scroll :is(button, input, select):not(:disabled)") ??
      root?.querySelector<HTMLElement>("button");
    target?.focus();
  }, [key, container]);
}
