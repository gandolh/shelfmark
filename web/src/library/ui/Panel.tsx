import { buttonClass } from "../../components/Button";
import { Dialog } from "@base-ui/react/dialog";
import { Popover } from "@base-ui/react/popover";
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode, type RefObject } from "react";
import { BackIcon } from "../../components/icons";

export interface PanelProps {
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
 * Which part holds the panel: the desktop's popover or the phone's dialog.
 * `PanelHeader` reads it for its `Title` (which names the panel for screen
 * readers) and its Done. Base UI traps focus in a modal popover only when it
 * has a close part, so on the desktop Done is `Popover.Close`.
 */
const PanelHost = createContext<"popover" | "dialog">("dialog");

/** Whether a closing Esc was already used by a control inside (a step going back), so isn't the panel's. */
function keptOpen(details: { reason: string; event: Event }): boolean {
  return details.reason === "escape-key" && details.event.defaultPrevented;
}

/**
 * The Filter and Columns panels, modal so focus stays inside and Escape
 * closes them, and each is named by its header's `Title`. On the desktop a Base UI `Popover`: a white panel under its
 * button with no dimming, where a click outside closes it and lands nowhere
 * else. On a phone a Base UI `Dialog`: a sheet over the bottom of the screen,
 * as design.md's floating sheet, over a dimmed page. Content changes apply as
 * they are made; Done only closes. Mounted means open. Only the
 * Library uses it, so it lives in the Library's own `ui/` folder.
 */
export function Panel({ anchor, fallback, desktop, align = "start", onClose, children }: PanelProps) {
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
  const frame = <div className="flex min-h-0 flex-[1_1_auto] flex-col">{children}</div>;

  if (desktop) {
    return (
      <Popover.Root open modal onOpenChange={onOpenChange}>
        <Popover.Portal>
          <Popover.Positioner
            className="z-float"
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
              className="flex max-h-(--available-height) w-81 max-w-[calc(100vw_-_16px)] flex-col overflow-hidden rounded-menu bg-surface text-ink shadow-float outline-none motion-safe:animate-panel-in"
              initialFocus={initialFocus}
              finalFocus={finalFocus}
            >
              <PanelHost.Provider value="popover">{frame}</PanelHost.Provider>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    );
  }
  return (
    <Dialog.Root open onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-float bg-scrim" />
        <Dialog.Popup
          ref={popupRef}
          className="fixed top-auto right-2 bottom-[max(8px,env(safe-area-inset-bottom))] left-2 z-float flex max-h-[min(86dvh,680px)] w-auto flex-col overflow-hidden rounded-sheet bg-surface text-ink shadow-float outline-none motion-safe:animate-sheet-in"
          initialFocus={initialFocus}
          finalFocus={finalFocus}
        >
          <PanelHost.Provider value="dialog">{frame}</PanelHost.Provider>
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
  const host = useContext(PanelHost);
  const done = (
    <button
      type="button"
      className={buttonClass({ variant: "quiet", size: "compact" }, "font-semibold")}
      onClick={onDone}
    >
      Done
    </button>
  );
  return (
    <div className="grid min-h-11.5 flex-none grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 pt-1.5 pr-2 pb-0.5 pl-2">
      <div className="min-w-0 justify-self-start">
        {back && (
          <button
            type="button"
            className="inline-flex min-h-control items-center gap-0.5 rounded-control pr-2 text-body text-accent hover:text-accent-press max-md:min-h-touch"
            data-panel-back
            onClick={back.onClick}
          >
            <BackIcon size={18} />
            {back.label}
          </button>
        )}
      </div>
      {host === "popover" ? (
        <Popover.Title className="overflow-hidden text-center text-body font-semibold text-ellipsis whitespace-nowrap">
          {title}
        </Popover.Title>
      ) : (
        <Dialog.Title className="overflow-hidden text-center text-body font-semibold text-ellipsis whitespace-nowrap">
          {title}
        </Dialog.Title>
      )}
      <div className="justify-self-end">{host === "popover" ? <Popover.Close render={done} /> : done}</div>
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
      root?.querySelector<HTMLElement>("[data-panel-scroll] :is(button, input, select):not(:disabled)") ??
      root?.querySelector<HTMLElement>("button");
    target?.focus();
  }, [key, container]);
}
