import { useId, useState, type KeyboardEvent } from "react";
import { ClearIcon } from "../components/icons";
import { addToList } from "./patch";

export interface TagsFieldProps {
  label: string;
  value: readonly string[];
  onChange: (next: string[]) => void;
  /** Entries already in use elsewhere, offered as the owner types. */
  suggestions?: readonly string[];
  hint?: string;
  disabled?: boolean;
}

/**
 * Tags, subjects: entries as chips with a field to add more. Enter, comma or
 * leaving the field adds what is typed; each chip's button takes it away.
 */
export function TagsField({ label, value, onChange, suggestions = [], hint, disabled }: TagsFieldProps) {
  const id = useId();
  const [text, setText] = useState("");

  const commit = (raw: string) => {
    let next = [...value];
    for (const piece of raw.split(/[,;]/)) next = addToList(next, piece);
    if (next.length !== value.length) onChange(next);
    setText("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      // Enter here adds the chip; it must not save the form.
      event.preventDefault();
      commit(text);
    } else if (event.key === "Backspace" && text === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const unused = suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()));

  return (
    <fieldset className="min-w-0" disabled={disabled}>
      <legend className="block text-muted text-label font-semibold leading-tight">{label}</legend>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 list-none">
          {value.map((entry) => (
            <li
              key={entry}
              className="inline-flex items-center min-h-7 px-3 rounded-pill bg-control text-ink text-meta gap-0.5 pr-1"
            >
              {entry}
              <button
                type="button"
                className="relative flex items-center justify-center w-6 h-6 rounded-pill text-ink-2 before:content-[''] before:absolute before:-inset-y-2.5 before:-inset-x-1.5 hover:bg-control-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-focus-ring"
                aria-label={`Remove ${entry} from ${label.toLowerCase()}`}
                onClick={() => onChange(value.filter((v) => v !== entry))}
              >
                <ClearIcon size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        className="mt-2 focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-[0] aria-invalid:outline-[1.5px] aria-invalid:outline-ink-2 aria-invalid:outline-offset-[-1.5px] focus-visible:aria-invalid:outline-2 focus-visible:aria-invalid:outline-focus-ring focus-visible:aria-invalid:outline-offset-[0] w-full h-10.5 px-3 rounded-field bg-field text-ink text-input-phone appearance-none data-filled:bg-accent-tint-soft data-filled:shadow-[inset_0_0_0_1.5px_var(--color-accent)] max-md:h-touch"
        type="text"
        value={text}
        onChange={(event) =>
          /[,;]/.test(event.target.value) ? commit(event.target.value) : setText(event.target.value)
        }
        onKeyDown={onKeyDown}
        onBlur={() => commit(text)}
        list={`${id}-list`}
        aria-label={`Add to ${label.toLowerCase()}`}
        placeholder="Type, then Enter"
        autoComplete="off"
        enterKeyHint="done"
      />
      <datalist id={`${id}-list`}>
        {unused.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      {hint && <p className="mt-1.5 text-small leading-tight text-muted">{hint}</p>}
    </fieldset>
  );
}
