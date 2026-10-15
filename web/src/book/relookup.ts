import type { Book, BookPatch, Draft } from "@shelfmark/shared";

/**
 * Re-run lookup: what the sources say now against what is stored, field by
 * field. The owner ticks the fields to take; nothing is applied otherwise.
 * Pure, so the rules are tested without a page.
 */

export type RelookupField =
  | "title"
  | "subtitle"
  | "authors"
  | "publisher"
  | "publishedYear"
  | "pages"
  | "language"
  | "description"
  | "subjects";

export const RELOOKUP_LABELS: Record<RelookupField, string> = {
  title: "Title",
  subtitle: "Subtitle",
  authors: "Authors",
  publisher: "Publisher",
  publishedYear: "Year",
  pages: "Pages",
  language: "Language",
  description: "Description",
  subjects: "Subjects",
};

export interface DiffRow {
  field: RelookupField;
  label: string;
  /** What is stored, as text; "" when nothing is. */
  current: string;
  /** What the sources say, as text. */
  proposed: string;
  /** The patch fragment that takes it. */
  patch: BookPatch;
}

/** Whitespace runs collapsed, ends trimmed: "A  B " equals "A B". */
export function squash(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function lines(items: readonly string[]): string[] {
  return items.map(squash).filter((item) => item !== "");
}

function sameLines(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((item, i) => item === b[i]);
}

/**
 * The fields where the draft has something and it differs from the book.
 * A field a source left out is never proposed (a lookup can't clear what the
 * owner wrote); equal values and whitespace-only differences are dropped.
 */
export function diffDraft(book: Book, draft: Draft): DiffRow[] {
  const rows: DiffRow[] = [];

  const text = (field: "title" | "subtitle" | "publisher" | "language" | "description", proposed: string | null) => {
    const next = proposed === null ? "" : squash(proposed);
    if (next === "") return;
    const stored = book[field] ?? "";
    if (squash(stored) === next) return;
    // A description keeps its own line breaks when taken, only the comparison squashes.
    const value = field === "description" ? (proposed ?? "").trim() : next;
    rows.push({ field, label: RELOOKUP_LABELS[field], current: stored, proposed: value, patch: { [field]: value } });
  };
  const count = (field: "publishedYear" | "pages", proposed: number | null) => {
    if (proposed === null || proposed === book[field]) return;
    rows.push({
      field,
      label: RELOOKUP_LABELS[field],
      current: book[field] === null ? "" : String(book[field]),
      proposed: String(proposed),
      patch: { [field]: proposed },
    });
  };
  const list = (field: "authors" | "subjects", proposed: readonly string[]) => {
    const next = lines(proposed);
    if (next.length === 0 || sameLines(next, lines(book[field]))) return;
    rows.push({
      field,
      label: RELOOKUP_LABELS[field],
      current: lines(book[field]).join("; "),
      proposed: next.join("; "),
      patch: { [field]: next },
    });
  };

  text("title", draft.title);
  text("subtitle", draft.subtitle);
  list("authors", draft.authors);
  text("publisher", draft.publisher);
  count("publishedYear", draft.publishedYear);
  count("pages", draft.pages);
  text("language", draft.language === null ? null : draft.language.toLowerCase());
  text("description", draft.description);
  list("subjects", draft.subjects);
  return rows;
}

/** One patch with exactly the ticked fields; empty when none are ticked. */
export function patchFromTicked(rows: readonly DiffRow[], ticked: ReadonlySet<RelookupField>): BookPatch {
  return Object.assign({}, ...rows.filter((row) => ticked.has(row.field)).map((row) => row.patch)) as BookPatch;
}
