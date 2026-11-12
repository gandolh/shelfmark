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
      <legend className="block text-muted text-label font-semibold leading-tight">{label}</legend>
      <div className="flex flex-wrap gap-2 mt-2">
        {options.map((status) => (
          <label
            key={status}
            className="relative inline-flex items-center gap-1.5 min-h-9 max-w-full in-[fieldset:disabled]:cursor-default in-[fieldset:disabled]:opacity-45 px-3.5 rounded-pill bg-control text-ink text-meta leading-tight cursor-pointer select-none transition-[background-color,color] duration-(--duration-fast) ease-out hover:bg-control-hover aria-pressed:bg-accent-tint aria-pressed:text-accent-press aria-pressed:font-semibold has-checked:bg-accent-tint has-checked:text-accent-press has-checked:font-semibold has-focus-visible:outline-2 has-focus-visible:outline-focus-ring has-focus-visible:outline-offset-2 max-md:text-body max-md:before:content-[''] max-md:before:absolute max-md:before:-inset-y-1 max-md:before:inset-x-0"
          >
            <input
              className="absolute inset-0 w-full h-full opacity-0 [cursor:inherit]"
              type="radio"
              name={name}
              value={status}
              checked={status === value}
              onChange={() => onChange(status)}
            />
            <span
              className="inline-flex flex-col min-w-0 after:content-[attr(data-label)] after:h-0 after:overflow-hidden after:invisible after:font-semibold after:select-none after:pointer-events-none"
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
