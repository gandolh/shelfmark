import { Menu as BaseMenu } from "@base-ui/react/menu";
import { useRef, type ReactNode } from "react";

export interface MenuItem {
  label: string;
  /** Muted text at the row's end: "Linked". */
  detail?: string;
  onSelect: () => void;
  disabled?: boolean;
}

export interface MenuSection {
  /** A small heading over the section ("Every book, every field"). Sections without one are split by a line. */
  label?: string;
  items: readonly MenuItem[];
}

export interface MenuProps {
  /** Names the menu: "Account", "Export". */
  label: string;
  sections: readonly MenuSection[];
  /** What the button shows: text, or an icon with `triggerLabel`. */
  trigger: ReactNode;
  /** The button's accessible name when `trigger` is only an icon. */
  triggerLabel?: string;
  /** The button's look. Default: a secondary button that turns accent-tinted while open. */
  triggerClassName?: string;
  /** Which edge of the button the menu lines up with. */
  align?: "start" | "end";
}

const GAP = 8; // between the button and the menu
const MARGIN = 8; // the menu never comes closer to the window's edge than this

/**
 * A menu button on Base UI's `Menu` (the WAI-ARIA pattern): the button opens
 * a white floating list of actions. Base UI does the keys (Enter, Space or ↓
 * open it, ↑ ↓ Home End move, a letter jumps to the next item starting with
 * it, Escape closes and returns to the button), the placement under the
 * button and the portal to `body`, so no container clips it. It is not
 * modal: a click outside closes it and still lands where it was aimed.
 *
 * A chosen item runs when the menu hands focus back, right after focus is on
 * the button again, so an item that opens a dialog (Change password) takes
 * focus from there and keeps it, and the dialog knows where to return it.
 */
export function Menu({ label, sections, trigger, triggerLabel, triggerClassName, align = "start" }: MenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const chosen = useRef<MenuItem | null>(null);

  return (
    <BaseMenu.Root modal={false}>
      <BaseMenu.Trigger
        ref={triggerRef}
        className={triggerClassName ?? "button button--secondary button--regular menu-trigger"}
        aria-label={triggerLabel}
      >
        {typeof trigger === "string" ? (
          // The open button's label turns semibold; keep its width from moving the row.
          <span className="menu-trigger__label" data-label={trigger}>
            {trigger}
          </span>
        ) : (
          trigger
        )}
      </BaseMenu.Trigger>
      <BaseMenu.Portal>
        <BaseMenu.Positioner className="menu-positioner" side="bottom" align={align} sideOffset={GAP} collisionPadding={MARGIN}>
          <BaseMenu.Popup
            className="menu"
            aria-label={label}
            finalFocus={() => {
              const item = chosen.current;
              if (!item) return true;
              chosen.current = null;
              triggerRef.current?.focus();
              item.onSelect();
              return false;
            }}
          >
            {sections.map((section, sectionIndex) => (
              <BaseMenu.Group key={section.label ?? sectionIndex} className="menu__section">
                {section.label ? (
                  <BaseMenu.GroupLabel className="menu__label">{section.label}</BaseMenu.GroupLabel>
                ) : sectionIndex > 0 ? (
                  <BaseMenu.Separator className="menu__separator" />
                ) : null}
                {section.items.map((item) => (
                  <BaseMenu.Item
                    key={item.label}
                    className="menu__item"
                    disabled={item.disabled}
                    onClick={() => {
                      chosen.current = item;
                    }}
                  >
                    <span className="menu__item-label">{item.label}</span>
                    {item.detail && <span className="menu__item-detail">{item.detail}</span>}
                  </BaseMenu.Item>
                ))}
              </BaseMenu.Group>
            ))}
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}
