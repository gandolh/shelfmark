import type { Status } from "@shelfmark/shared";
import { useId } from "react";

/** The words for each status (glossary.md). */
export const STATUS_LABELS: Record<Status, string> = {
  unread: "Unread",
  reading: "Reading",
  read: "Read",
  abandoned: "Abandoned",
};

/** What Add a book offers; the book page can add `abandoned`. */
export const ADD_STATUSES: readonly Status[] = ["unread", "reading", "read"];

export interface StatusPickerProps {
  value: Status;
  onChange: (status: Status) => void;
  /** The statuses to offer, in order. Default Unread, Reading, Read. */
  options?: readonly Status[];
  /** The group's visible label. Default "Status". */
  label?: string;
  disabled?: boolean;
}

/**
 * The status as chips, one always chosen: real radio buttons under the chip
 * look, so arrow keys move the choice and a screen reader hears a group.
 */
export function StatusPicker({
  value,
  onChange,
  options = ADD_STATUSES,
  label = "Status",
  disabled,
}: StatusPickerProps) {
  const name = useId();
  return (
    <fieldset className="min-w-0" disabled={disabled}>
      <legend className="block text-label leading-label font-semibold text-muted">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((status) => (
          <label
            key={status}
            className="relative inline-flex min-h-9 max-w-full cursor-pointer items-center gap-1.5 rounded-pill bg-control px-4 text-meta leading-meta text-ink transition-[background-color,color] duration-(--duration-fast) ease-out select-none hover:bg-control-hover in-[fieldset:disabled]:cursor-default in-[fieldset:disabled]:opacity-45 has-checked:bg-accent-tint has-checked:font-semibold has-checked:text-on-accent-tint has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus-ring aria-pressed:bg-accent-tint aria-pressed:font-semibold aria-pressed:text-on-accent-tint max-md:min-h-control-large max-md:before:absolute max-md:before:inset-x-0 max-md:before:-inset-y-1 max-md:before:content-['']"
          >
            <input
              className="absolute inset-0 h-full w-full [cursor:inherit] opacity-0"
              type="radio"
              name={name}
              value={status}
              checked={status === value}
              onChange={() => onChange(status)}
            />
            <span
              className="inline-flex min-w-0 flex-col after:pointer-events-none after:invisible after:h-0 after:overflow-hidden after:font-semibold after:content-[attr(data-label)] after:select-none"
              data-label={STATUS_LABELS[status]}
            >
              {STATUS_LABELS[status]}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
