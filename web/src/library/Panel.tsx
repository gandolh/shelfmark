import { Dialog } from "@base-ui/react/dialog";
import { Popover } from "@base-ui/react/popover";
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode, type RefObject } from "react";
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
 * The desktop panel's close part. Base UI traps focus in a modal popover only
 * when it has one, so `PanelHeader`'s Done is it.
 */
const PanelClose = createContext(false);

/** Whether a closing Esc was already used by a control inside (a step going back), so isn't the panel's. */
function keptOpen(details: { reason: string; event: Event }): boolean {
  return details.reason === "escape-key" && details.event.defaultPrevented;
}

/**
 * The Filter and Columns panels, modal so focus stays inside and Escape
 * closes them. On the desktop a Base UI `Popover`: a white panel under its
 * button with no dimming, where a click outside closes it and lands nowhere
 * else. On a phone a Base UI `Dialog`: a sheet over the bottom of the screen,
 * as design.md's floating sheet, over a dimmed page. Content changes apply as
 * they are made; Done only closes. Mounted means open. Built here for the
 * Library; a candidate for components/ when another page needs one.
 */
export function Panel({ label, anchor, fallback, desktop, align = "start", onClose, children }: PanelProps) {
  const popupRef = useRef<HTMLDivElement>(null);

  // A chip that opened the panel goes when its filter does; the panel stays where it is.
  const lastPlace = useRef<DOMRect | null>(null);
  const placedBy = useMemo(
    () => ({
      contextElement: anchor,
      getBoundingClientRect: () => {
        if (anchor.isConnected || lastPlace.current === null) lastPlace.current = anchor.getBoundingClientRect();
        return lastPlace.current;
      },
    }),
    [anchor],
  );

  const onOpenChange = (open: boolean, details: { reason: string; event: Event }) => {
    if (!open && !keptOpen(details)) onClose();
  };
  const initialFocus = () => popupRef.current?.querySelector<HTMLElement>("[data-autofocus]") ?? true;
  // Back to what asked for it, or the fallback when that is gone.
  const finalFocus = () => (anchor.isConnected ? anchor : fallback?.()) ?? true;
  const frame = <div className="library-panel__frame">{children}</div>;

  if (desktop) {
    return (
      <Popover.Root open modal onOpenChange={onOpenChange}>
        <Popover.Portal>
          <Popover.Positioner
            className="library-panel-positioner"
            anchor={placedBy}
            side="bottom"
            align={align}
            sideOffset={GAP}
            collisionPadding={MARGIN}
            // Always under the button, shortened to the room below it, as before.
            collisionAvoidance={{ side: "none" }}
          >
            <Popover.Popup
              ref={popupRef}
              aria-label={label}
              className="library-panel library-panel--anchored"
              initialFocus={initialFocus}
              finalFocus={finalFocus}
            >
              <PanelClose.Provider value>{frame}</PanelClose.Provider>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    );
  }
  return (
    <Dialog.Root open onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="library-panel-backdrop" />
        <Dialog.Popup
          ref={popupRef}
          aria-label={label}
          className="library-panel library-panel--sheet"
          initialFocus={initialFocus}
          finalFocus={finalFocus}
        >
          {frame}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
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
  const closePart = useContext(PanelClose);
  const done = (
    <button type="button" className="button button--quiet button--compact library-panel__done" onClick={onDone}>
      Done
    </button>
  );
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
      <div className="library-panel__end">{closePart ? <Popover.Close render={done} /> : done}</div>
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
