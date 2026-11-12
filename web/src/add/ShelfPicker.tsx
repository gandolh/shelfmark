import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Toggle, ToggleGroup } from "../components/ui/ToggleGroup";
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
    <fieldset className="min-w-0" disabled={disabled}>
      <legend className="block text-muted text-label font-semibold leading-tight">{label}</legend>
      <div className="flex flex-wrap gap-2 mt-2">
        <ToggleGroup
          aria-label={label}
          className="contents"
          value={writing ? null : value}
          onChoose={(next) => {
            close();
            onChange(next);
          }}
        >
          {chips.map((shelf) => (
            <Toggle
              key={shelf}
              value={shelf}
              className="relative inline-flex items-center gap-1.5 min-h-9 max-w-full in-[fieldset:disabled]:cursor-default in-[fieldset:disabled]:opacity-45 px-3.5 rounded-pill bg-control text-ink text-meta leading-tight cursor-pointer select-none transition-[background-color,color] duration-(--duration-fast) ease-out hover:bg-control-hover aria-pressed:bg-accent-tint aria-pressed:text-accent-press aria-pressed:font-semibold has-checked:bg-accent-tint has-checked:text-accent-press has-checked:font-semibold has-focus-visible:outline-2 has-focus-visible:outline-focus-ring has-focus-visible:outline-offset-2 max-md:text-body max-md:before:content-[''] max-md:before:absolute max-md:before:-inset-y-1 max-md:before:inset-x-0"
            >
              <span
                className="inline-flex flex-col min-w-0 after:content-[attr(data-label)] after:h-0 after:overflow-hidden after:invisible after:font-semibold after:select-none after:pointer-events-none"
                data-label={shelf}
              >
                {shelf}
              </span>
            </Toggle>
          ))}
        </ToggleGroup>
        {writing ? (
          <span className="relative inline-flex items-center gap-1.5 min-h-9 max-w-full in-[fieldset:disabled]:cursor-default in-[fieldset:disabled]:opacity-45 rounded-pill text-ink text-meta leading-tight select-none transition-[background-color,color] duration-(--duration-fast) ease-out aria-pressed:bg-accent-tint aria-pressed:text-accent-press aria-pressed:font-semibold has-checked:bg-accent-tint has-checked:text-accent-press has-checked:font-semibold has-focus-visible:outline-2 has-focus-visible:outline-focus-ring has-focus-visible:outline-offset-2 max-md:text-body max-md:before:absolute max-md:before:-inset-y-1 max-md:before:inset-x-0 w-[min(100%,260px)] bg-field cursor-text hover:bg-field max-md:before:content-[none] max-md:min-h-touch">
            <input
              className="focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-[0] w-full h-9 px-3.5 rounded-[inherit] bg-transparent text-ink text-input-phone appearance-none max-md:min-h-touch"
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
          <button
            type="button"
            className="relative inline-flex items-center gap-1.5 min-h-9 max-w-full in-[fieldset:disabled]:cursor-default in-[fieldset:disabled]:opacity-45 px-3.5 rounded-pill text-meta leading-tight cursor-pointer select-none transition-[background-color,color] duration-(--duration-fast) ease-out aria-pressed:bg-accent-tint aria-pressed:text-accent-press aria-pressed:font-semibold has-checked:bg-accent-tint has-checked:text-accent-press has-checked:font-semibold has-focus-visible:outline-2 has-focus-visible:outline-focus-ring has-focus-visible:outline-offset-2 max-md:text-body max-md:before:content-[''] max-md:before:absolute max-md:before:-inset-y-1 max-md:before:inset-x-0 pl-2.75 shadow-none [outline:1px_dashed_var(--color-muted)] outline-offset-[-1px] bg-transparent text-ink-2 hover:bg-control focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2"
            onClick={open}
          >
            <PlusIcon size={16} />
            {more ? "Other shelf" : "New shelf"}
          </button>
        )}
      </div>
      {writing && (
        <p className="mt-1.5 text-small leading-tight text-muted" id={`${id}-hint`}>
          Room, then shelf: Living room · A2. A dash works too.
        </p>
      )}
    </fieldset>
  );
}
