import { cn } from "../lib/cn";
import { segmentedItem, segmentedTrack } from "../components/segmented";
import { Tab, TabsList } from "../components/ui/Tabs";
import type { Mode } from "./flow";

export const MODES: readonly { value: Mode; label: string }[] = [
  { value: "scan", label: "Scan" },
  { value: "isbn", label: "Type ISBN" },
  { value: "manual", label: "By hand" },
];

export interface ModeSwitchProps {
  /** Over the camera: the track on a translucent ground instead of the flat fill. */
  overCamera?: boolean;
  /** A save is in flight: it belongs to the current mode's form, so the mode stays put. */
  disabled?: boolean;
}

/**
 * Scan, Type ISBN, By hand: the segmented track of the world, as Base UI tabs
 * (the page shows one way of adding at a time). ← → Home End move between
 * them and switch at once; a click or a tap switches and moves focus on into
 * the new form. The `TabsRoot` and the panel are `AddBookPage`'s:
 * switching is React state, never a route, so the camera's page never
 * navigates.
 */
export function ModeSwitch({ overCamera, disabled }: ModeSwitchProps) {
  return (
    <TabsList aria-label="How to add the book" className={cn(segmentedTrack(), overCamera && "bg-ground/92")}>
      {MODES.map((mode) => (
        <Tab
          key={mode.value}
          value={mode.value}
          disabled={disabled}
          className={cn(segmentedItem(), overCamera && "hover:bg-surface/60")}
          data-label={mode.label}
        >
          {mode.label}
        </Tab>
      ))}
    </TabsList>
  );
}
