import { parseIsbn, type Status } from "@shelfmark/shared";
import { isbnProblem } from "./words";

/**
 * The by-hand form as plain values: every text field as typed, so a draft can
 * fill it and an edit can be undone by typing. `readForm` turns it into book
 * fields or says what is wrong. Pure, for the tests and for brief 10's book
 * page, which edits the same fields.
 */

export interface FormValues {
  title: string;
  /** Optional, under the title: "exerciţii de memorie culturală". */
  subtitle: string;
  /** Several authors are written with "&" between them: "Mircea Eliade & Ioan Petru Culianu". */
  author: string;
  publisher: string;
  year: string;
  isbn: string;
  shelf: string | null;
  status: Status;
}

export type FormField = "title" | "subtitle" | "author" | "publisher" | "year" | "isbn";
export type FormErrors = Partial<Record<FormField, string>>;

/** The form's values as book fields, checked. */
export interface FormFields {
  title: string;
  subtitle: string | null;
  authors: string[];
  publisher: string | null;
  publishedYear: number | null;
  isbn13: string | null;
  shelf: string | null;
  status: Status;
}

export const EMPTY_FORM: FormValues = {
  title: "",
  subtitle: "",
  author: "",
  publisher: "",
  year: "",
  isbn: "",
  shelf: null,
  status: "unread",
};

/** `"A & B"` or `"A; B"` → `["A", "B"]`. A comma stays inside a name ("García Márquez, Gabriel"). */
export function splitAuthors(text: string): string[] {
  return text
    .split(/[&;]/)
    .map((name) => name.trim().replace(/\s+/g, " "))
    .filter((name) => name !== "");
}

export function joinAuthors(authors: readonly string[]): string {
  return authors.join(" & ");
}

const YEAR = /^\d{1,4}$/;

/** The values checked and converted, or the message for each field at fault. */
export function readForm(values: FormValues): { ok: true; fields: FormFields } | { ok: false; errors: FormErrors } {
  const errors: FormErrors = {};

  const title = values.title.trim().replace(/\s+/g, " ");
  if (title === "") errors.title = "A book needs a title.";

  const yearText = values.year.trim();
  let publishedYear: number | null = null;
  if (yearText !== "") {
    const year = YEAR.test(yearText) ? Number(yearText) : Number.NaN;
    if (year >= 1) publishedYear = year;
    else errors.year = "Digits only, such as 2021.";
  }

  let isbn13: string | null = null;
  if (values.isbn.trim() !== "") {
    const parsed = parseIsbn(values.isbn);
    if (parsed.ok) isbn13 = parsed.isbn13;
    else errors.isbn = isbnProblem(values.isbn, parsed.reason);
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const subtitle = values.subtitle.trim().replace(/\s+/g, " ");
  const publisher = values.publisher.trim().replace(/\s+/g, " ");
  return {
    ok: true,
    fields: {
      title,
      subtitle: subtitle === "" ? null : subtitle,
      authors: splitAuthors(values.author),
      publisher: publisher === "" ? null : publisher,
      publishedYear,
      isbn13,
      shelf: values.shelf,
      status: values.status,
    },
  };
}

/** The first field with a problem, in the order the form shows them, to move focus to. */
export function firstInvalid(errors: FormErrors): FormField | null {
  const order: FormField[] = ["title", "subtitle", "author", "publisher", "year", "isbn"];
  return order.find((field) => errors[field] !== undefined) ?? null;
}
