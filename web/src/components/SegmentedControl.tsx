import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  /** Names the group for screen readers: "View", "How to add". */
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** `regular`: 32 px segments in a 10 px track (Add a book's Scan / Type ISBN / By hand). `small`: 30 px (Table / Covers). */
  size?: "regular" | "small";
  className?: string;
}

/**
 * One of a few, as a flat track with the chosen segment raised in white: a
 * Base UI `ToggleGroup` of buttons with `aria-pressed`, one tab stop with ←
 * → between the segments. Pressing the chosen one again keeps it chosen.
 * Each keeps a 44 px target on a phone. The top bar's two places use the
 * same look with links (layout/TopBar.tsx).
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  size = "regular",
  className,
}: SegmentedControlProps<T>) {
  return (
    <ToggleGroup
      aria-label={label}
      className={["segmented", `segmented--${size}`, className].filter(Boolean).join(" ")}
      value={[value]}
      onValueChange={(pressed) => {
        const next = options.find((option) => option.value === pressed[0]);
        if (next && next.value !== value) onChange(next.value);
      }}
    >
      {options.map((option) => (
        <Toggle key={option.value} value={option.value} className="segmented__item" data-label={option.label}>
          {option.label}
        </Toggle>
      ))}
    </ToggleGroup>
  );
}
