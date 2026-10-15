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
 * One of a few, as a flat track with the chosen segment raised in white. Real
 * buttons with `aria-pressed`; each keeps a 44 px target on a phone. The top
 * bar's two places use the same look with links (layout/TopBar.tsx).
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
    <div role="group" aria-label={label} className={["segmented", `segmented--${size}`, className].filter(Boolean).join(" ")}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="segmented__item"
          aria-pressed={option.value === value}
          data-label={option.label}
          onClick={() => {
            if (option.value !== value) onChange(option.value);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
