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
    <fieldset className="add-choice" disabled={disabled}>
      <legend className="add-label">{label}</legend>
      {value.length > 0 && (
        <ul className="book-chips">
          {value.map((entry) => (
            <li key={entry} className="book-chip">
              {entry}
              <button
                type="button"
                className="book-chip__remove"
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
        className="add-input book-chips__input"
        type="text"
        value={text}
        onChange={(event) => (/[,;]/.test(event.target.value) ? commit(event.target.value) : setText(event.target.value))}
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
      {hint && <p className="add-hint">{hint}</p>}
    </fieldset>
  );
}
