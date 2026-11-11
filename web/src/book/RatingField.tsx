import { useId } from "react";
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
      className={on ? "book-star book-star--on" : "book-star"}
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
    <fieldset className="add-choice" disabled={disabled}>
      <legend className="add-label">Rating</legend>
      <ToggleGroup
        aria-label="Rating"
        className="book-rating"
        aria-describedby={hint}
        value={value === null ? null : String(value)}
        onChoose={(next) => onChange(next === null ? null : Number(next))}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <Toggle
            key={n}
            value={String(n)}
            className="book-rating__star"
            aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
          >
            <StarIcon on={value !== null && n <= value} />
          </Toggle>
        ))}
        <span className="book-rating__text">{value === null ? "Not rated" : `${value} of 5`}</span>
      </ToggleGroup>
      <p className="add-hint" id={hint}>
        Press the chosen star again to clear it.
      </p>
    </fieldset>
  );
}
