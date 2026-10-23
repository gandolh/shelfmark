import { useId, useState, type FormEvent, type InputHTMLAttributes, type ReactNode, type Ref } from "react";
import { Button } from "../components/Button";
import type { CipFields } from "../ocr/block";
import { cipValues, fillFromCip, type CipValues } from "./cip";
import { CipReader } from "./CipReader";
import { CoverCapture, type CoverPhoto } from "./CoverCapture";
import { firstInvalid, readForm, type FormErrors, type FormField, type FormFields, type FormValues } from "./form";
import { AlertIcon } from "./icons";
import { ShelfPicker } from "./ShelfPicker";
import { StatusPicker } from "./StatusPicker";

// --- Field pieces ----------------------------------------------------------------

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  /** A muted "optional" beside the label. */
  optional?: boolean;
  /** What is wrong; the field is marked invalid and the message read with it. */
  error?: string;
  /** A line under the field while nothing is wrong. */
  hint?: ReactNode;
  ref?: Ref<HTMLInputElement>;
  className?: string;
}

/** A labelled text field in the world's look: the `field` fill, 42 px (44 on a phone), 16 px text. */
export function TextField({ label, optional, error, hint, ref, className, ...input }: TextFieldProps) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? hint;
  return (
    <div className={["add-field", className].filter(Boolean).join(" ")}>
      <label className="add-label" htmlFor={id}>
        {label}
        {optional && <span className="add-label__optional">optional</span>}
      </label>
      <input
        {...input}
        ref={ref}
        id={id}
        className="add-input"
        aria-invalid={error !== undefined}
        aria-describedby={note ? noteId : undefined}
      />
      {error !== undefined ? (
        <p id={noteId} className="add-error">
          <AlertIcon size={16} />
          {error}
        </p>
      ) : (
        hint && (
          <p id={noteId} className="add-hint">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

/** A failure under a sheet's fields, beside its primary action: "Not saved: …". */
export function FailureLine({ children }: { children: ReactNode }) {
  return (
    <p className="add-error add-error--block" role="alert">
      <AlertIcon size={18} />
      {children}
    </p>
  );
}

// --- The form ----------------------------------------------------------------------

export interface ManualFormProps {
  /** The starting values. The form keeps its own state after; give it a new `key` to start over. */
  initial: FormValues;
  /** The shelves in use, most recent first (`shelvesInUse`). */
  shelves: readonly string[];
  /** Called with checked fields; the photo, when one was taken, is the owner's cover. */
  onSubmit: (fields: FormFields, photo: CoverPhoto | null) => void;
  /** "Save and scan the next one". */
  submitLabel: string;
  /** A save is in flight: everything waits. */
  saving?: boolean;
  /** Why the last save failed. */
  failure?: string | null;
  /** Above the fields: the not-found notice. */
  intro?: ReactNode;
  /** Offer "Take a photo of the front" with this prompt; `null` when a cover is coming from elsewhere. */
  coverPrompt?: ReactNode | null;
  /** Under the primary action, apart from it: "Discard this scan". */
  secondary?: ReactNode;
  /** Put the cursor in the title on mount (the mock-up's focused field). */
  autoFocus?: boolean;
  /**
   * Show the ISBN field. Off when the ISBN came from a scan or a lookup and
   * the intro already names it: the value is kept and saved all the same.
   */
  showIsbn?: boolean;
}

/**
 * Add by hand: title (required), author, publisher, year, ISBN, shelf and
 * status, and a photo of the front when no cover is coming. Errors are
 * checked on submit, said under each field, and the first one takes focus.
 * The same form serves a miss, Edit details on a found book, and By hand.
 */
export function ManualForm({
  initial,
  shelves,
  onSubmit,
  submitLabel,
  saving = false,
  failure,
  intro,
  coverPrompt = "No cover found. Take a photo of the front.",
  secondary,
  autoFocus,
  showIsbn = true,
}: ManualFormProps) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<FormErrors>({});
  const [photo, setPhoto] = useState<CoverPhoto | null>(null);
  /** What "Read the CIP block" put in each field; a field stands out while it still holds that. */
  const [filled, setFilled] = useState<CipValues>({});

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    if (key in errors) setErrors(({ [key as FormField]: _gone, ...rest }) => rest);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const read = readForm(values);
    if (!read.ok) {
      setErrors(read.errors);
      const first = firstInvalid(read.errors);
      const field = first && event.currentTarget.elements.namedItem(first);
      if (field instanceof HTMLInputElement) field.focus();
      return;
    }
    onSubmit(read.fields, photo);
  };

  const text = (key: FormField) => {
    const fromCip = filled[key] !== undefined && filled[key] === values[key];
    return {
      name: key,
      value: values[key],
      onChange: (event: { target: { value: string } }) => set(key, event.target.value),
      error: errors[key],
      ...(fromCip ? { "data-filled": "", hint: "From the CIP block: check it." } : {}),
    };
  };

  // The read fills only empty fields (cip.ts); a hidden ISBN came from the scan and stays.
  const fillFromBlock = (fields: CipFields): FormField[] => {
    const { isbn, ...rest } = cipValues(fields);
    const read = showIsbn && isbn !== undefined ? { ...rest, isbn } : rest;
    const out = fillFromCip(values, read, filled);
    setValues(out.values);
    setFilled(out.filled);
    setErrors((current) => {
      const kept = { ...current };
      for (const field of out.changed) delete kept[field];
      return kept;
    });
    return out.changed;
  };

  return (
    <form className="add-form" onSubmit={submit} noValidate aria-busy={saving || undefined}>
      {intro}
      <fieldset className="add-form__fields" disabled={saving}>
        <CipReader onRead={fillFromBlock} disabled={saving} />
        <TextField
          label="Title"
          {...text("title")}
          required
          autoFocus={autoFocus}
          autoCapitalize="sentences"
          autoComplete="off"
        />
        <TextField label="Author" optional {...text("author")} autoCapitalize="words" autoComplete="off" />
        <div className="add-form__pair">
          <TextField label="Publisher" optional {...text("publisher")} autoCapitalize="words" autoComplete="off" />
          <TextField
            label="Year"
            optional
            {...text("year")}
            className="add-field--year"
            inputMode="numeric"
            maxLength={4}
            autoComplete="off"
          />
        </div>
        {showIsbn && (
          <TextField
            label="ISBN"
            optional
            {...text("isbn")}
            className="add-field--isbn"
            inputMode="numeric"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={24}
          />
        )}
        <ShelfPicker value={values.shelf} onChange={(shelf) => set("shelf", shelf)} shelves={shelves} />
        <StatusPicker value={values.status} onChange={(status) => set("status", status)} />
        {coverPrompt !== null && <CoverCapture photo={photo} onChange={setPhoto} prompt={coverPrompt} disabled={saving} />}
      </fieldset>
      {failure && <FailureLine>{failure}</FailureLine>}
      <div className="add-form__submit">
        <Button type="submit" variant="primary" size="large" block aria-disabled={saving || undefined}>
          {saving ? "Saving…" : submitLabel}
        </Button>
        {secondary && <div className="add-actions">{secondary}</div>}
      </div>
    </form>
  );
}
