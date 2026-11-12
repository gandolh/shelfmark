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
      <legend className="block text-label leading-tight font-semibold text-muted">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
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
              className="relative inline-flex min-h-9 max-w-full cursor-pointer items-center gap-1.5 rounded-pill bg-control px-3.5 text-meta leading-tight text-ink transition-[background-color,color] duration-(--duration-fast) ease-out select-none hover:bg-control-hover in-[fieldset:disabled]:cursor-default in-[fieldset:disabled]:opacity-45 has-checked:bg-accent-tint has-checked:font-semibold has-checked:text-accent-press has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus-ring aria-pressed:bg-accent-tint aria-pressed:font-semibold aria-pressed:text-accent-press max-md:text-body max-md:before:absolute max-md:before:inset-x-0 max-md:before:-inset-y-1 max-md:before:content-['']"
            >
              <span
                className="inline-flex min-w-0 flex-col after:pointer-events-none after:invisible after:h-0 after:overflow-hidden after:font-semibold after:content-[attr(data-label)] after:select-none"
                data-label={shelf}
              >
                {shelf}
              </span>
            </Toggle>
          ))}
        </ToggleGroup>
        {writing ? (
          <span className="relative inline-flex min-h-9 w-[min(100%,260px)] max-w-full cursor-text items-center gap-1.5 rounded-pill bg-field text-meta leading-tight text-ink transition-[background-color,color] duration-(--duration-fast) ease-out select-none hover:bg-field in-[fieldset:disabled]:cursor-default in-[fieldset:disabled]:opacity-45 has-checked:bg-accent-tint has-checked:font-semibold has-checked:text-accent-press has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus-ring aria-pressed:bg-accent-tint aria-pressed:font-semibold aria-pressed:text-accent-press max-md:min-h-touch max-md:text-body max-md:before:absolute max-md:before:inset-x-0 max-md:before:-inset-y-1 max-md:before:content-[none]">
            <input
              className="h-9 w-full appearance-none rounded-[inherit] bg-transparent px-3.5 text-input-phone text-ink focus-visible:outline-2 focus-visible:outline-offset-[0] focus-visible:outline-focus-ring max-md:min-h-touch"
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
            className="relative inline-flex min-h-9 max-w-full cursor-pointer items-center gap-1.5 rounded-pill bg-transparent px-3.5 pl-2.75 text-meta leading-tight text-ink-2 shadow-none [outline:1px_dashed_var(--color-muted)] outline-offset-[-1px] transition-[background-color,color] duration-(--duration-fast) ease-out select-none hover:bg-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring in-[fieldset:disabled]:cursor-default in-[fieldset:disabled]:opacity-45 has-checked:bg-accent-tint has-checked:font-semibold has-checked:text-accent-press has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus-ring aria-pressed:bg-accent-tint aria-pressed:font-semibold aria-pressed:text-accent-press max-md:text-body max-md:before:absolute max-md:before:inset-x-0 max-md:before:-inset-y-1 max-md:before:content-['']"
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
