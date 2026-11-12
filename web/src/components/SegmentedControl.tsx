import { Radio, RadioGroup } from "./ui/RadioGroup";

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
 * Base UI `RadioGroup` (`data-checked` on the chosen one): one tab stop, the
 * arrow keys move and choose, one is always chosen (base-ui rule 16).
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
    <RadioGroup<T>
      aria-label={label}
      className={["segmented", `segmented--${size}`, className].filter(Boolean).join(" ")}
      value={value}
      onChoose={(next) => {
        if (next !== value) onChange(next);
      }}
    >
      {options.map((option) => (
        <Radio key={option.value} value={option.value} className="segmented__item" data-label={option.label}>
          {option.label}
        </Radio>
      ))}
    </RadioGroup>
  );
}
