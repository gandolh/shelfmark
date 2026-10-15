import type { Status } from "@shelfmark/shared";
import { useId } from "react";

/** The words for each status (glossary.md). */
export const STATUS_LABELS: Record<Status, string> = {
  unread: "Unread",
  reading: "Reading",
  read: "Read",
  abandoned: "Abandoned",
};

/** What Add a book offers; the book page (brief 10) can add `abandoned`. */
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
export function StatusPicker({ value, onChange, options = ADD_STATUSES, label = "Status", disabled }: StatusPickerProps) {
  const name = useId();
  return (
    <fieldset className="add-choice" disabled={disabled}>
      <legend className="add-label">{label}</legend>
      <div className="add-chips">
        {options.map((status) => (
          <label key={status} className="add-chip">
            <input
              className="add-chip__input"
              type="radio"
              name={name}
              value={status}
              checked={status === value}
              onChange={() => onChange(status)}
            />
            <span className="add-chip__label" data-label={STATUS_LABELS[status]}>
              {STATUS_LABELS[status]}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
