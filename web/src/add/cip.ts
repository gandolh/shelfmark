import type { CipFields } from "../ocr/block";
import { joinAuthors, type FormField, type FormValues } from "./form";

/**
 * Filling the by-hand form from a CIP block (brief 30). Pure, for the tests:
 * CipReader.tsx reads the photo, ManualForm.tsx keeps what was filled so the
 * filled fields stand out until the owner has looked at them.
 */

/** The text fields a CIP block can fill, as the form writes them. */
export type CipValues = Partial<Record<FormField, string>>;

/** What a read puts in each field: only what it found. */
export function cipValues(fields: CipFields): CipValues {
  const out: CipValues = {};
  if (fields.title) out.title = fields.title;
  if (fields.authors.length > 0) out.author = joinAuthors(fields.authors);
  if (fields.publisher) out.publisher = fields.publisher;
  if (fields.year !== null) out.year = String(fields.year);
  if (fields.isbn13) out.isbn = fields.isbn13;
  return out;
}

/**
 * `read` put into the fields that are empty, or that still hold what an
 * earlier read put there (`filled`), never into one the owner typed. Returns
 * the new values, what every filled field now holds (earlier fills the owner
 * left alone included), and which fields this read changed.
 */
export function fillFromCip(
  values: FormValues,
  read: CipValues,
  filled: CipValues,
): { values: FormValues; filled: CipValues; changed: FormField[] } {
  const next = { ...values };
  const nowFilled: CipValues = {};
  for (const [field, value] of Object.entries(filled) as [FormField, string][]) {
    if (values[field] === value) nowFilled[field] = value;
  }
  const changed: FormField[] = [];
  for (const [field, value] of Object.entries(read) as [FormField, string][]) {
    const current = values[field];
    const free = current.trim() === "" || nowFilled[field] === current;
    if (!free) continue;
    nowFilled[field] = value;
    if (current !== value) {
      next[field] = value;
      changed.push(field);
    }
  }
  return { values: next, filled: nowFilled, changed };
}
