import type { Book } from "@shelfmark/shared";
import { useEffect, useRef, useState } from "react";
import { FailureLine } from "../add/ManualForm";
import { Button } from "../components/Button";
import { saveFailure } from "../add/words";

/**
 * Delete, at the foot of the page and apart from Edit and Save. It asks first,
 * naming the book; the confirm button says what it does. There is no danger
 * colour in this world, so the weight is in the words and the distance.
 */
export function DeleteBook({ book, onDelete }: { book: Book; onDelete: () => Promise<void> }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const heading = useRef<HTMLParagraphElement>(null);
  const wasAsking = useRef(false);

  // Focus follows the question, and comes back to its button when it is dismissed.
  useEffect(() => {
    if (asking) heading.current?.focus();
    else if (wasAsking.current) document.getElementById("book-delete-open")?.focus();
    wasAsking.current = asking;
  }, [asking]);

  const confirm = async () => {
    setBusy(true);
    setFailure(null);
    try {
      await onDelete();
    } catch (error) {
      setFailure(saveFailure(error).message.replace(/^Not saved/, "Not deleted"));
      setBusy(false);
    }
  };

  return (
    <section
      className="mt-4 flex flex-col items-start gap-2 border-t border-hairline pt-6"
      aria-labelledby="book-delete-title"
    >
      <h2 className="text-label font-semibold text-muted" id="book-delete-title">
        Delete
      </h2>
      {!asking ? (
        <>
          <p className="text-small leading-tight text-muted">Take this copy out of your library.</p>
          <Button id="book-delete-open" variant="secondary" pill onClick={() => setAsking(true)}>
            Delete this book
          </Button>
        </>
      ) : (
        <div className="flex flex-col items-start gap-2" role="group" aria-labelledby="book-delete-q">
          <p
            className="text-row-title font-semibold wrap-anywhere focus-visible:rounded-[2px] focus-visible:outline-2 focus-visible:outline-offset-[4px] focus-visible:outline-focus-ring"
            id="book-delete-q"
            tabIndex={-1}
            ref={heading}
          >
            Delete “{book.title}”?
          </p>
          <p className="text-small leading-tight text-muted">
            It leaves your library with its cover and notes. This can’t be undone.
          </p>
          {failure && <FailureLine>{failure}</FailureLine>}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" pill disabled={busy} onClick={() => void confirm()}>
              {busy ? "Deleting…" : `Delete “${book.title}”`}
            </Button>
            <Button variant="quiet" disabled={busy} onClick={() => setAsking(false)}>
              Keep it
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
