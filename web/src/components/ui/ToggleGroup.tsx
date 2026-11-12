import { Toggle as BaseToggle } from "@base-ui/react/toggle";
import { ToggleGroup as BaseToggleGroup } from "@base-ui/react/toggle-group";
import type { ComponentProps } from "react";

/**
 * One of a few as toggles: one tab stop, ← → between them, `aria-pressed` on
 * the chosen one. Pressing the chosen one again gives `null` (clearing); a
 * caller that must keep one chosen ignores it. For a value a form saves later
 * (the rating, the shelf chips); a picker that writes on each choice would
 * need a guard, and a choice kept on the device or a view switch is a
 * `RadioGroup` (base-ui rule 16).
 */
export interface ToggleGroupProps extends Omit<
  ComponentProps<typeof BaseToggleGroup>,
  "value" | "defaultValue" | "onValueChange" | "multiple"
> {
  /** The pressed item's `value`, or `null` for none. */
  value: string | null;
  onChoose: (value: string | null) => void;
}

export function ToggleGroup({ value, onChoose, ...props }: ToggleGroupProps) {
  return (
    <BaseToggleGroup
      {...props}
      value={value === null ? [] : [value]}
      onValueChange={(pressed) => onChoose(pressed[0] ?? null)}
    />
  );
}

/** One toggle inside a `ToggleGroup` (`value` is its name), or alone with `pressed`. */
export const Toggle = BaseToggle;
