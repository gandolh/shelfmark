import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import type { ComponentProps } from "react";

/**
 * Base UI tabs for a page that shows one of a few ways of doing something
 * (Add a book's Scan / Type ISBN / By hand). Switching is React state, never a
 * route. The arrow keys switch as they move focus (`activateOnFocus`).
 */

export const TabsRoot = BaseTabs.Root;
export const TabsPanel = BaseTabs.Panel;

export function TabsList(props: ComponentProps<typeof BaseTabs.List>) {
  return <BaseTabs.List activateOnFocus {...props} />;
}

/**
 * A press chooses the tab without focusing it, so the new form can take focus:
 * a focus moved while the press is still focusing the tab ends back on the tab.
 */
export function Tab({ onMouseDown, ...props }: ComponentProps<typeof BaseTabs.Tab>) {
  return (
    <BaseTabs.Tab
      {...props}
      onMouseDown={(event) => {
        event.preventDefault();
        onMouseDown?.(event);
      }}
    />
  );
}
