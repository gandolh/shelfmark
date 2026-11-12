import type { Book, BookPatch } from "@shelfmark/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { FailureLine } from "../add/ManualForm";
import { notFoundText, saveFailure, sourceLine } from "../add/words";
import { Button } from "../components/Button";
import { diffDraft, patchFromTicked, type RelookupField } from "./relookup";
import type { BookLookup } from "./useLookup";

export interface RelookupDiffProps {
  book: Book;
  lookup: BookLookup;
  /** Save the ticked fields as one patch. */
  onApply: (patch: BookPatch, fields: string[]) => Promise<void>;
  onClose: () => void;
}

/**
 * Re-run lookup: what the sources say now, field by field, beside what is
 * stored. Nothing is ticked at the start and nothing is applied until the
 * owner presses the button, so a lookup never overwrites silently.
 */
const NONE: ReadonlySet<RelookupField> = new Set();

export function RelookupDiff({ book, lookup, onApply, onClose }: RelookupDiffProps) {
  const { state } = lookup;
  const draft = state.kind === "done" ? state.response.draft : null;
  const rows = useMemo(() => (draft ? diffDraft(book, draft) : []), [book, draft]);
  // Ticks belong to one answer: a new draft starts with nothing ticked.
  const [choice, setChoice] = useState<{ draft: unknown; set: ReadonlySet<RelookupField> }>({
    draft: null,
    set: new Set(),
  });
  const ticked = choice.draft === draft ? choice.set : NONE;
  const setTicked = (set: ReadonlySet<RelookupField>) => setChoice({ draft, set });
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => heading.current?.focus(), []);

  const toggle = (field: RelookupField) => {
    const next = new Set(ticked);
    if (!next.delete(field)) next.add(field);
    setTicked(next);
  };

  const apply = async () => {
    setSaving(true);
    setFailure(null);
    try {
      await onApply(
        patchFromTicked(rows, ticked),
        rows.filter((row) => ticked.has(row.field)).map((row) => row.label.toLowerCase()),
      );
    } catch (error) {
      setFailure(saveFailure(error).message);
      setSaving(false);
    }
  };

  return (
    <section
      className="book-lookup min-w-0 p-5 rounded-container bg-surface max-md:p-4"
      aria-labelledby="book-lookup-title"
      aria-busy={state.kind === "loading" || undefined}
    >
      <h2 className="mb-1 text-ink text-row-title font-semibold" id="book-lookup-title" tabIndex={-1} ref={heading}>
        What the sources say now
      </h2>

      {state.kind === "loading" && <p className="mb-2 text-ink-2 text-body">Looking up {book.isbn13}…</p>}
      {state.kind === "failed" && (
        <>
          <FailureLine>{state.failure.message}</FailureLine>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" pill onClick={lookup.run}>
              Try again
            </Button>
            <Button variant="quiet" onClick={onClose}>
              Close
            </Button>
          </div>
        </>
      )}
      {state.kind === "done" && !draft && (
        <>
          <p className="mb-2 text-ink-2 text-body">{notFoundText(state.response.isbn13, state.response.tried)}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="quiet" onClick={onClose}>
              Close
            </Button>
          </div>
        </>
      )}
      {state.kind === "done" && draft && (
        <>
          <p className="mb-2 text-ink-2 text-body">
            {sourceLine(draft.sources)}.{" "}
            {rows.length === 0
              ? "It matches what you have; there is nothing to take."
              : "Tick the fields to take; the rest stay as they are."}
          </p>
          {rows.length > 0 && (
            <ul className="flex flex-col mb-3 list-none [&_li]:border-t [&_li]:border-divider">
              {rows.map((row) => (
                <li key={row.field}>
                  <label className="flex items-start gap-3 min-h-touch py-3 cursor-pointer [&_input]:flex-none [&_input]:w-5 [&_input]:h-5 [&_input]:mt-0.5 [&_input]:accent-accent [&:has(input:focus-visible)]:outline-2 [&:has(input:focus-visible)]:outline-focus-ring [&:has(input:focus-visible)]:outline-offset-[-2px] [&:has(input:focus-visible)]:rounded-control">
                    <input
                      type="checkbox"
                      checked={ticked.has(row.field)}
                      onChange={() => toggle(row.field)}
                      disabled={saving}
                    />
                    <span className="flex flex-1 flex-col gap-1.5 min-w-0">
                      <span className="text-meta font-semibold">{row.label}</span>
                      <span className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 max-md:grid-cols-[minmax(0,1fr)] max-md:gap-2">
                        <span className="flex flex-col gap-px min-w-0">
                          <span className="text-muted text-label font-semibold">Now</span>
                          <span className="max-h-[9em] overflow-auto text-body wrap-anywhere whitespace-pre-line">
                            {row.current || <span className="text-muted">Empty</span>}
                          </span>
                        </span>
                        <span className="flex flex-col gap-px min-w-0">
                          <span className="text-muted text-label font-semibold">Sources</span>
                          <span className="max-h-[9em] overflow-auto text-body wrap-anywhere whitespace-pre-line">
                            {row.proposed}
                          </span>
                        </span>
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {failure && <FailureLine>{failure}</FailureLine>}
          <div className="flex flex-wrap items-center gap-2">
            {rows.length > 0 && (
              <Button
                variant="primary"
                onClick={() => void apply()}
                aria-disabled={ticked.size === 0 || saving || undefined}
                disabled={ticked.size === 0 || saving}
              >
                {saving
                  ? "Saving…"
                  : ticked.size === 0
                    ? "Take selected"
                    : `Take ${ticked.size} ${ticked.size === 1 ? "field" : "fields"}`}
              </Button>
            )}
            {rows.length > 1 && (
              <Button
                variant="secondary"
                pill
                disabled={saving}
                onClick={() => setTicked(ticked.size === rows.length ? new Set() : new Set(rows.map((r) => r.field)))}
              >
                {ticked.size === rows.length ? "Untick all" : "Tick all"}
              </Button>
            )}
            <Button variant="quiet" onClick={onClose} disabled={saving}>
              {rows.length === 0 ? "Close" : "Leave as is"}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
