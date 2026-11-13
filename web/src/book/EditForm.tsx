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
}: {
  label: string;
  value: T | null;
  options: Record<T, string>;
  onChange: (next: T | null) => void;
}) {
  const name = useId();
  const entries = [[null, "Not set"], ...Object.entries<string>(options)] as [T | null, string][];
  return (
    <fieldset className="min-w-0">
      <legend className="block text-label leading-label font-semibold text-muted">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {entries.map(([key, text]) => (
          <label
            key={key ?? "none"}
            className="relative inline-flex min-h-9 max-w-full cursor-pointer items-center gap-1.5 rounded-pill bg-control px-4 text-meta leading-meta text-ink transition-[background-color,color] duration-(--duration-fast) ease-out select-none hover:bg-control-hover in-[fieldset:disabled]:cursor-default in-[fieldset:disabled]:opacity-45 has-checked:bg-accent-tint has-checked:font-semibold has-checked:text-on-accent-tint has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus-ring aria-pressed:bg-accent-tint aria-pressed:font-semibold aria-pressed:text-on-accent-tint max-md:min-h-control-large max-md:before:absolute max-md:before:inset-x-0 max-md:before:-inset-y-1 max-md:before:content-['']"
          >
            <input
              className="absolute inset-0 h-full w-full [cursor:inherit] opacity-0"
              type="radio"
              name={name}
              checked={key === value}
              onChange={() => onChange(key)}
            />
            <span
              className="inline-flex min-w-0 flex-col after:pointer-events-none after:invisible after:h-0 after:overflow-hidden after:font-semibold after:content-[attr(data-label)] after:select-none"
              data-label={text}
            >
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
}: { label: string; hint?: ReactNode; error?: string } & Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "id"
>) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label className="block text-label leading-tight font-semibold text-muted" htmlFor={id}>
        {label}
        <span className="ml-1.5 font-regular">optional</span>
      </label>
      <textarea
        {...area}
        id={id}
        className="h-10.5 h-auto min-h-24 w-full resize-y appearance-none rounded-field bg-field px-3 px-3 py-2.5 text-input-phone leading-body text-ink focus-visible:outline-2 focus-visible:outline-offset-[0] focus-visible:outline-focus-ring aria-invalid:outline-[1.5px] aria-invalid:outline-offset-[-1.5px] aria-invalid:outline-ink-2 focus-visible:aria-invalid:outline-2 focus-visible:aria-invalid:outline-offset-[0] focus-visible:aria-invalid:outline-focus-ring data-filled:bg-accent-tint-soft data-filled:shadow-[inset_0_0_0_1.5px_var(--color-accent)] max-md:h-touch"
        rows={4}
        aria-invalid={error !== undefined}
      />
      {error ? (
        <p className="flex items-start gap-1.5 text-small leading-tight font-semibold text-ink [&_svg]:-mt-0.25 [&_svg]:flex-none">
          <AlertIcon size={16} />
          {error}
        </p>
      ) : (
        hint && <p className="text-small leading-tight text-muted">{hint}</p>
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
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => void submit(event)}
      noValidate
      aria-busy={saving || undefined}
    >
      <fieldset
        className="flex min-w-0 flex-col gap-4 rounded-container bg-surface p-5 max-md:p-4 [&>legend+*]:clear-both"
        disabled={saving}
      >
        <legend className="float-left mb-1 w-full text-row-title font-semibold text-ink">About the book</legend>
        <TextField label="Title" {...text("title")} required autoFocus autoCapitalize="sentences" />
        <TextField label="Subtitle" optional {...text("subtitle")} autoCapitalize="sentences" />
        <TextField
          label="Authors"
          optional
          {...text("authors")}
          autoCapitalize="words"
          hint="Several authors: put & between them."
        />
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-2.5">
          <TextField label="Publisher" optional {...text("publisher")} autoCapitalize="words" />
          <TextField
            label="Year"
            optional
            {...text("publishedYear")}
            inputMode="numeric"
            maxLength={4}
            className="tabular-nums"
          />
        </div>
        <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2.5">
          <TextField
            label="Pages"
            optional
            {...text("pages")}
            inputMode="numeric"
            maxLength={6}
            className="tabular-nums"
          />
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
        <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2.5">
          <TextField label="Series" optional {...text("series")} autoCapitalize="words" />
          <TextField label="Number in series" optional {...text("seriesNumber")} maxLength={32} />
        </div>
        <TextField
          label="ISBN"
          optional
          {...text("isbn13")}
          className="md:max-w-70"
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

      <fieldset
        className="flex min-w-0 flex-col gap-4 rounded-container bg-surface p-5 max-md:p-4 [&>legend+*]:clear-both"
        disabled={saving}
      >
        <legend className="float-left mb-1 w-full text-row-title font-semibold text-ink">About this copy</legend>
        <ShelfPicker value={values.shelf} onChange={(shelf) => set("shelf", shelf)} shelves={shelves} />
        <StatusPicker value={values.status} onChange={(status) => set("status", status)} options={STATUSES} />
        <RatingField value={values.rating} onChange={(rating) => set("rating", rating)} />
        <OptionalChoice
          label="Format"
          value={values.format}
          options={FORMAT_LABELS}
          onChange={(next) => set("format", next)}
        />
        <OptionalChoice
          label="Condition"
          value={values.condition}
          options={CONDITION_LABELS}
          onChange={(next) => set("condition", next)}
        />
        <label className="flex min-h-touch cursor-pointer items-center gap-2.5 text-body [&_input]:h-5 [&_input]:w-5 [&_input]:accent-accent [&:has(input:focus-visible)]:rounded-control [&:has(input:focus-visible)]:outline-2 [&:has(input:focus-visible)]:outline-offset-2 [&:has(input:focus-visible)]:outline-focus-ring">
          <input type="checkbox" checked={values.signed} onChange={(event) => set("signed", event.target.checked)} />
          Signed by the author
        </label>
        <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2.5">
          <TextField label="Acquired on" optional {...text("acquiredOn")} type="date" />
          <TextField label="Acquired from" optional {...text("acquiredFrom")} autoCapitalize="words" />
        </div>
        <TextField
          label={`Price in lei${book.currency === "RON" ? "" : ` (${book.currency})`}`}
          optional
          {...text("price")}
          className="tabular-nums"
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
        <AreaField
          label="Notes"
          name="notes"
          value={values.notes}
          onChange={(event) => set("notes", event.target.value)}
        />
      </fieldset>

      {failure && <FailureLine>{failure}</FailureLine>}
      <div className="sticky bottom-0 z-1 flex gap-2.5 border-t border-hairline bg-ground py-3 max-md:bottom-[calc(var(--spacing-tabbar)_-_10px_+_max(10px,env(safe-area-inset-bottom)))] max-md:mx-[calc(var(--spacing-gutter-phone)_*_-1)] max-md:px-gutter-phone">
        <Button
          type="submit"
          variant="primary"
          size="large"
          className="max-md:flex-1"
          aria-disabled={saving || undefined}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button variant="secondary" size="large" pill onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
