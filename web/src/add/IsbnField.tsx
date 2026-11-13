import { cn } from "../lib/cn";
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
  /** A draft is open under the field: Look up turns grey, shares the field's row and the hint goes. */
  draftOpen?: boolean;
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
  draftOpen = false,
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
    <form
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] gap-x-2.5 gap-y-1.5 [grid-template-areas:'label_label'_'box_submit'_'note_note']",
        size === "large" &&
          !draftOpen &&
          "max-md:grid-cols-[minmax(0,1fr)] max-md:[grid-template-areas:'label'_'box'_'note'_'submit']",
      )}
      onSubmit={submit}
      noValidate
    >
      <label className="block text-meta leading-meta font-semibold text-ink [grid-area:label]" htmlFor={`${id}-input`}>
        {label}
      </label>
      <div className="relative min-w-0 [grid-area:box]" data-invalid={problem !== null || undefined}>
        <input
          ref={input}
          id={`${id}-input`}
          className={cn(
            "h-control-large w-full appearance-none rounded-control border border-outline bg-field pr-13 pl-4 text-(length:--text-isbn) tracking-[0.02em] tabular-nums focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-focus-ring aria-invalid:border-ink-2 aria-invalid:shadow-[inset_0_0_0_1px_var(--color-ink-2)] aria-invalid:outline-[1.5px] aria-invalid:outline-offset-[-1.5px] aria-invalid:outline-ink-2 focus-visible:aria-invalid:outline-2 focus-visible:aria-invalid:outline-offset-[0] focus-visible:aria-invalid:outline-focus-ring",
            size === "regular" && "text-input-phone tracking-[0.02em]",
          )}
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
            className="absolute top-[50%] right-1.5 h-9 w-9 [transform:translateY(-50%)] rounded-control bg-surface text-row-title font-semibold text-ink before:absolute before:-inset-1 before:content-[''] hover:bg-control"
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
      <Button
        type="submit"
        variant={draftOpen ? "secondary" : "primary"}
        size="large"
        className={cn("[grid-area:submit]", size === "large" && !draftOpen && "max-md:mt-1.5")}
        aria-disabled={busy || undefined}
      >
        {submitLabel}
      </Button>
      {problem ? (
        // A new element each time, so the alert is announced as it appears.
        <p
          key="problem"
          id={describedBy}
          className="flex items-start gap-1.5 text-small leading-tight font-semibold text-ink [grid-area:note] [&_svg]:-mt-0.25 [&_svg]:flex-none"
          role="alert"
        >
          <AlertIcon size={16} />
          {problem}
        </p>
      ) : (
        hint &&
        !draftOpen && (
          <p key="hint" id={describedBy} className="text-meta leading-meta text-muted [grid-area:note]">
            {hint}
          </p>
        )
      )}
    </form>
  );
}
