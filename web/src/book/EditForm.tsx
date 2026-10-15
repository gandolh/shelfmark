import type { Book, BookPatch } from "@shelfmark/shared";
import { useId, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { shelvesInUse } from "../add/shelves";
import { ShelfPicker } from "../add/ShelfPicker";
import { StatusPicker } from "../add/StatusPicker";
import { FailureLine, TextField } from "../add/ManualForm";
import { AlertIcon } from "../add/icons";
import { Button } from "../components/Button";
import { useBooks } from "../books/store";
import { CONDITION_LABELS, FORMAT_LABELS } from "./BookDetails";
import { buildPatch, firstError, valuesOf, type EditErrors, type EditField, type EditValues } from "./patch";
import { RatingField } from "./RatingField";
import { TagsField } from "./TagsField";
import "../add/add.css";

type TextKey =
  | "title"
  | "subtitle"
  | "authors"
  | "publisher"
  | "publishedYear"
  | "pages"
  | "language"
  | "series"
  | "seriesNumber"
  | "isbn13"
  | "acquiredOn"
  | "acquiredFrom"
  | "price";

const STATUSES = ["unread", "reading", "read", "abandoned"] as const;

/** Radio chips with a "Not set" choice: format and condition may be left unknown. */
function OptionalChoice<T extends string>({
  label,
  value,
  options,
  onChange,
  required,
}: {
  label: string;
  value: T | null;
  options: Record<T, string>;
  onChange: (next: T | null) => void;
  /** No "Not set" chip: the collection is always one or the other. */
  required?: boolean;
}) {
  const name = useId();
  const entries = [...(required ? [] : [[null, "Not set"]]), ...Object.entries<string>(options)] as [T | null, string][];
  return (
    <fieldset className="add-choice">
      <legend className="add-label">{label}</legend>
      <div className="add-chips">
        {entries.map(([key, text]) => (
          <label key={key ?? "none"} className="add-chip">
            <input
              className="add-chip__input"
              type="radio"
              name={name}
              checked={key === value}
              onChange={() => onChange(key)}
            />
            <span className="add-chip__label" data-label={text}>
              {text}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** A labelled multi-line field in the same fill as `TextField`. */
function AreaField({
  label,
  hint,
  error,
  ...area
}: { label: string; hint?: ReactNode; error?: string } & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "id">) {
  const id = useId();
  return (
    <div className="add-field">
      <label className="add-label" htmlFor={id}>
        {label}
        <span className="add-label__optional">optional</span>
      </label>
      <textarea {...area} id={id} className="add-input book-area" rows={4} aria-invalid={error !== undefined} />
      {error ? (
        <p className="add-error">
          <AlertIcon size={16} />
          {error}
        </p>
      ) : (
        hint && <p className="add-hint">{hint}</p>
      )}
    </div>
  );
}

export interface EditFormProps {
  book: Book;
  /** Sends the one patch; rejects with a ready sentence for the failure line. */
  onSave: (patch: BookPatch) => Promise<void>;
  onCancel: () => void;
}

/**
 * Edit in place: the right control for each field, one Save that sends only
 * what changed, Cancel that drops it all. The values start from the book as
 * it is now and stay the form's own until Save.
 */
export function EditForm({ book, onSave, onCancel }: EditFormProps) {
  const { books } = useBooks();
  const [baseline] = useState(() => valuesOf(book));
  const [values, setValues] = useState(baseline);
  const [errors, setErrors] = useState<EditErrors>({});
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const shelves = useMemo(() => shelvesInUse(books), [books]);
  const tagsInUse = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of books) for (const tag of b.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tag]) => tag);
  }, [books]);

  const set = <K extends EditField>(key: K, value: EditValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    if (key in errors) setErrors(({ [key]: _gone, ...rest }) => rest);
  };

  const text = (key: TextKey) => ({
    name: key,
    value: values[key],
    onChange: (event: { target: { value: string } }) => set(key, event.target.value),
    error: errors[key],
    autoComplete: "off",
  });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const form = event.currentTarget;
    const result = buildPatch(book, baseline, values);
    if (!result.ok) {
      setErrors(result.errors);
      const first = firstError(result.errors);
      const field = first && form.elements.namedItem(first);
      if (field instanceof HTMLInputElement) field.focus();
      return;
    }
    setSaving(true);
    setFailure(null);
    try {
      await onSave(result.patch);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Not saved. Try again.");
      setSaving(false);
    }
  };

  return (
    <form className="book-form" onSubmit={(event) => void submit(event)} noValidate aria-busy={saving || undefined}>
      <fieldset className="book-card book-card--form" disabled={saving}>
        <legend className="book-card__title">About the book</legend>
        <TextField label="Title" {...text("title")} required autoFocus autoCapitalize="sentences" />
        <TextField label="Subtitle" optional {...text("subtitle")} autoCapitalize="sentences" />
        <TextField
          label="Authors"
          optional
          {...text("authors")}
          autoCapitalize="words"
          hint="Several authors: put & between them."
        />
        <div className="add-form__pair">
          <TextField label="Publisher" optional {...text("publisher")} autoCapitalize="words" />
          <TextField label="Year" optional {...text("publishedYear")} inputMode="numeric" maxLength={4} className="add-field--year" />
        </div>
        <div className="book-row">
          <TextField label="Pages" optional {...text("pages")} inputMode="numeric" maxLength={6} className="add-field--year" />
          <TextField
            label="Language"
            optional
            {...text("language")}
            maxLength={2}
            autoCapitalize="none"
            spellCheck={false}
            hint="Two letters: ro, en."
          />
        </div>
        <div className="book-row">
          <TextField label="Series" optional {...text("series")} autoCapitalize="words" />
          <TextField label="Number in series" optional {...text("seriesNumber")} maxLength={32} />
        </div>
        <TextField
          label="ISBN"
          optional
          {...text("isbn13")}
          className="add-field--isbn"
          inputMode="numeric"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={24}
          hint="ISBN-10 or ISBN-13; the ISBN-10 is worked out from it."
        />
        <TagsField label="Subjects" value={values.subjects} onChange={(next) => set("subjects", next)} />
        <AreaField
          label="Description"
          name="description"
          value={values.description}
          onChange={(event) => set("description", event.target.value)}
          rows={6}
        />
      </fieldset>

      <fieldset className="book-card book-card--form" disabled={saving}>
        <legend className="book-card__title">About this copy</legend>
        <OptionalChoice
          label="Collection"
          value={values.collection}
          options={{ owned: "Owned", wishlist: "Wishlist" }}
          required
          onChange={(next) => next && set("collection", next)}
        />
        <ShelfPicker value={values.shelf} onChange={(shelf) => set("shelf", shelf)} shelves={shelves} />
        <StatusPicker value={values.status} onChange={(status) => set("status", status)} options={STATUSES} />
        <RatingField value={values.rating} onChange={(rating) => set("rating", rating)} />
        <OptionalChoice label="Format" value={values.format} options={FORMAT_LABELS} onChange={(next) => set("format", next)} />
        <OptionalChoice
          label="Condition"
          value={values.condition}
          options={CONDITION_LABELS}
          onChange={(next) => set("condition", next)}
        />
        <label className="book-check">
          <input type="checkbox" checked={values.signed} onChange={(event) => set("signed", event.target.checked)} />
          Signed by the author
        </label>
        <div className="book-row">
          <TextField label="Acquired on" optional {...text("acquiredOn")} type="date" />
          <TextField label="Acquired from" optional {...text("acquiredFrom")} autoCapitalize="words" />
        </div>
        <TextField
          label={`Price in lei${book.currency === "RON" ? "" : ` (${book.currency})`}`}
          optional
          {...text("price")}
          className="add-field--year"
          inputMode="decimal"
          hint="Two decimals, such as 49.90."
        />
        <TagsField
          label="Tags"
          value={values.tags}
          onChange={(next) => set("tags", next)}
          suggestions={tagsInUse}
          hint="Your own words: gift, signed, to lend."
        />
        <AreaField label="Notes" name="notes" value={values.notes} onChange={(event) => set("notes", event.target.value)} />
      </fieldset>

      {failure && <FailureLine>{failure}</FailureLine>}
      <div className="book-savebar">
        <Button type="submit" variant="primary" size="large" aria-disabled={saving || undefined}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button variant="secondary" size="large" pill onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
