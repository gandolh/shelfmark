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
  const [choice, setChoice] = useState<{ draft: unknown; set: ReadonlySet<RelookupField> }>({ draft: null, set: new Set() });
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
    <section className="book-card book-lookup" aria-labelledby="book-lookup-title" aria-busy={state.kind === "loading" || undefined}>
      <h2 className="book-card__title" id="book-lookup-title" tabIndex={-1} ref={heading}>
        What the sources say now
      </h2>

      {state.kind === "loading" && <p className="book-lookup__line">Looking up {book.isbn13}…</p>}
      {state.kind === "failed" && (
        <>
          <FailureLine>{state.failure.message}</FailureLine>
          <div className="book-actions">
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
          <p className="book-lookup__line">{notFoundText(state.response.isbn13, state.response.tried)}</p>
          <div className="book-actions">
            <Button variant="quiet" onClick={onClose}>
              Close
            </Button>
          </div>
        </>
      )}
      {state.kind === "done" && draft && (
        <>
          <p className="book-lookup__line">
            {sourceLine(draft.sources)}.{" "}
            {rows.length === 0 ? "It matches what you have; there is nothing to take." : "Tick the fields to take; the rest stay as they are."}
          </p>
          {rows.length > 0 && (
            <ul className="book-diff">
              {rows.map((row) => (
                <li key={row.field}>
                  <label className="book-diff__row">
                    <input type="checkbox" checked={ticked.has(row.field)} onChange={() => toggle(row.field)} disabled={saving} />
                    <span className="book-diff__body">
                      <span className="book-diff__label">{row.label}</span>
                      <span className="book-diff__pair">
                        <span className="book-diff__side">
                          <span className="book-diff__who">Now</span>
                          <span className="book-diff__text">{row.current || <span className="book-none">Empty</span>}</span>
                        </span>
                        <span className="book-diff__side">
                          <span className="book-diff__who">Sources</span>
                          <span className="book-diff__text">{row.proposed}</span>
                        </span>
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {failure && <FailureLine>{failure}</FailureLine>}
          <div className="book-actions">
            {rows.length > 0 && (
              <Button variant="primary" onClick={() => void apply()} aria-disabled={ticked.size === 0 || saving || undefined} disabled={ticked.size === 0 || saving}>
                {saving ? "Saving…" : ticked.size === 0 ? "Take selected" : `Take ${ticked.size} ${ticked.size === 1 ? "field" : "fields"}`}
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
