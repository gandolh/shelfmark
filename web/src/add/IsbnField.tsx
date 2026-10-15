import { clean, parseIsbn } from "@shelfmark/shared";
import { useId, useImperativeHandle, useRef, useState, type FormEvent, type ReactNode, type Ref } from "react";
import { Button } from "../components/Button";
import { AlertIcon } from "./icons";
import { isbnProblem } from "./words";

/** What the page can do to the field: put the cursor back in it after a save. */
export interface IsbnFieldHandle {
  focus: () => void;
  /** Empty it, forget its error, and focus it: ready for the next book. */
  reset: () => void;
}

export interface IsbnFieldProps {
  /** A valid ISBN, as 13 digits. Called on Enter or the button. */
  onSubmit: (isbn13: string) => void;
  ref?: Ref<IsbnFieldHandle>;
  label?: string;
  /** Under the field while nothing is wrong. */
  hint?: ReactNode;
  submitLabel?: string;
  /**
   * After a submit, keep the cursor in the field with the ISBN selected, so a
   * USB scanner's next code replaces it (the laptop). False lets go of the
   * field so the result isn't under the phone's keyboard.
   */
  keepFocus?: boolean;
  /** A lookup is running: the button waits. */
  busy?: boolean;
  autoFocus?: boolean;
  /** `large` is Type ISBN's own field; `regular` fits a sheet. */
  size?: "large" | "regular";
}

/**
 * One field for an ISBN-10 or -13, as printed (hyphens, spaces, a final X).
 * `inputmode="numeric"` brings up the number pad, which has no X, so an X key
 * appears once nine digits are in. Enter submits, which is all a USB or
 * Bluetooth scanner needs: it types the digits and presses Enter.
 */
export function IsbnField({
  onSubmit,
  ref,
  label = "ISBN",
  hint = "10 or 13 digits, from the back cover or the copyright page. Hyphens are fine.",
  submitLabel = "Look up",
  keepFocus = true,
  busy = false,
  autoFocus,
  size = "large",
}: IsbnFieldProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => input.current?.focus(),
      reset: () => {
        setValue("");
        setProblem(null);
        input.current?.focus();
      },
    }),
    [],
  );

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = parseIsbn(value);
    if (!parsed.ok) {
      setProblem(isbnProblem(value, parsed.reason));
      input.current?.focus();
      return;
    }
    setProblem(null);
    onSubmit(parsed.isbn13);
    if (keepFocus) input.current?.select();
    else input.current?.blur();
  };

  const wantsX = /^\d{9}$/.test(clean(value));
  const describedBy = `${id}-note`;

  return (
    <form className={`add-isbn add-isbn--${size}`} onSubmit={submit} noValidate>
      <label className="add-label" htmlFor={`${id}-input`}>
        {label}
      </label>
      <div className="add-isbn__box" data-invalid={problem !== null || undefined}>
        <input
          ref={input}
          id={`${id}-input`}
          className="add-isbn__input tabular"
          type="text"
          inputMode="numeric"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={24}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setProblem(null);
          }}
          aria-invalid={problem !== null}
          aria-describedby={problem || hint ? describedBy : undefined}
          autoFocus={autoFocus}
        />
        {wantsX && (
          <button
            type="button"
            className="add-isbn__x"
            aria-label="Type X, the last character of some ISBN-10s"
            onClick={() => {
              setValue((current) => `${current.trimEnd()}X`);
              input.current?.focus();
            }}
          >
            X
          </button>
        )}
      </div>
      <Button type="submit" variant="primary" size="large" className="add-isbn__submit" aria-disabled={busy || undefined}>
        {submitLabel}
      </Button>
      {problem ? (
        // A new element each time, so the alert is announced as it appears.
        <p key="problem" id={describedBy} className="add-error" role="alert">
          <AlertIcon size={16} />
          {problem}
        </p>
      ) : (
        hint && (
          <p key="hint" id={describedBy} className="add-hint">
            {hint}
          </p>
        )
      )}
    </form>
  );
}
