import { useId, useRef, useState, type KeyboardEvent } from "react";
import { PlusIcon } from "./icons";
import { matchShelf, normalizeShelf } from "./shelves";

export interface ShelfPickerProps {
  /** The chosen shelf, or `null` for none. */
  value: string | null;
  onChange: (shelf: string | null) => void;
  /** The shelves in use, the one added to last first (`shelvesInUse`). */
  shelves: readonly string[];
  /** How many of them show as chips; the rest are offered as the new-shelf field types. Default 6. */
  limit?: number;
  /** The group's visible label. Default "Shelf". */
  label?: string;
  disabled?: boolean;
}

/**
 * Where the book goes: the shelves already in use as chips, most recent
 * first, then "New shelf", which opens a field for one (and suggests every
 * shelf in use as it types). Pressing the chosen chip again chooses none.
 */
export function ShelfPicker({ value, onChange, shelves, limit = 6, label = "Shelf", disabled }: ShelfPickerProps) {
  const id = useId();
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState("");
  // The choice before the field opened, for Escape.
  const before = useRef<string | null>(null);

  const recent = shelves.slice(0, limit);
  // A shelf typed in, or chosen from further down the list, shows as a chip of its own.
  const chips = value !== null && !writing && !recent.includes(value) ? [value, ...recent] : recent;
  const more = shelves.length > limit;

  const open = () => {
    before.current = value;
    setText("");
    setWriting(true);
    onChange(null);
  };

  const type = (next: string) => {
    setText(next);
    const shelf = normalizeShelf(next);
    onChange(shelf === null ? null : matchShelf(shelf, shelves));
  };

  const close = () => {
    setWriting(false);
    setText("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      // Keep the form from submitting: Enter here means "this shelf".
      event.preventDefault();
      close();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onChange(before.current);
      close();
    }
  };

  return (
    <fieldset className="add-choice" disabled={disabled}>
      <legend className="add-label">{label}</legend>
      <div className="add-chips">
        {chips.map((shelf) => {
          const chosen = shelf === value && !writing;
          return (
            <button
              key={shelf}
              type="button"
              className="add-chip"
              aria-pressed={chosen}
              onClick={() => {
                close();
                onChange(chosen ? null : shelf);
              }}
            >
              <span className="add-chip__label" data-label={shelf}>
                {shelf}
              </span>
            </button>
          );
        })}
        {writing ? (
          <span className="add-chip add-chip--field">
            <input
              className="add-chip__text"
              type="text"
              value={text}
              onChange={(event) => type(event.target.value)}
              onKeyDown={onKeyDown}
              onBlur={() => {
                if (normalizeShelf(text) === null) close();
              }}
              list={`${id}-shelves`}
              aria-label="New shelf"
              aria-describedby={`${id}-hint`}
              placeholder="Room · shelf"
              autoComplete="off"
              autoCapitalize="sentences"
              enterKeyHint="done"
              // The owner just asked for this field.
              autoFocus
            />
            <datalist id={`${id}-shelves`}>
              {shelves.map((shelf) => (
                <option key={shelf} value={shelf} />
              ))}
            </datalist>
          </span>
        ) : (
          <button type="button" className="add-chip add-chip--new" onClick={open}>
            <PlusIcon size={16} />
            {more ? "Other shelf" : "New shelf"}
          </button>
        )}
      </div>
      {writing && (
        <p className="add-hint" id={`${id}-hint`}>
          Room, then shelf: Living room · A2. A dash works too.
        </p>
      )}
    </fieldset>
  );
}
