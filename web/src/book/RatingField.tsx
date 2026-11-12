import { useId } from "react";
import { cn } from "../lib/cn";
import { Toggle, ToggleGroup } from "../components/ui/ToggleGroup";

export function StarIcon({ on, size = 24 }: { on: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={on ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={on ? undefined : "text-muted"}
    >
      <path d="M12 3.4l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.7l6.1-.7z" />
    </svg>
  );
}

/**
 * The rating as five toggles in one group: one tab stop, ← → between the stars. Pressing the current rating again clears
 * it: a book can be unrated, and a slider or a select would hide that.
 */
export function RatingField({
  value,
  onChange,
  disabled,
}: {
  value: number | null;
  onChange: (rating: number | null) => void;
  disabled?: boolean;
}) {
  const hint = useId();
  return (
    <fieldset className="min-w-0" disabled={disabled}>
      <legend className="block text-muted text-label font-semibold leading-tight">Rating</legend>
      <ToggleGroup
        aria-label="Rating"
        className="flex items-center gap-0.5 mt-1.5"
        aria-describedby={hint}
        value={value === null ? null : String(value)}
        onChoose={(next) => onChange(next === null ? null : Number(next))}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <Toggle
            key={n}
            value={String(n)}
            className={cn(
              "flex size-10 items-center justify-center rounded-control hover:bg-control focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring max-md:size-touch",
              n <= (value ?? 0) ? "text-accent" : "text-muted",
            )}
            aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
          >
            <StarIcon on={value !== null && n <= value} />
          </Toggle>
        ))}
        <span className="ml-2.5 text-ink-2 text-meta">{value === null ? "Not rated" : `${value} of 5`}</span>
      </ToggleGroup>
      <p className="mt-1.5 text-small leading-tight text-muted" id={hint}>
        Press the chosen star again to clear it.
      </p>
    </fieldset>
  );
}
