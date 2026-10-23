import type { Book } from "@shelfmark/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { FailureLine } from "../add/ManualForm";
import { ShelfPicker } from "../add/ShelfPicker";
import { shelvesInUse } from "../add/shelves";
import { saveFailure } from "../add/words";
import { useBooks } from "../books/store";
import { Button } from "../components/Button";

/**
 * "I bought it", on a wishlist book's page: asks for a shelf, then the
 * caller moves this same row to Owned (`collection: "owned"`, the shelf,
 * `acquiredOn` today). The shelf starts on the one used most recently.
 */
export function BuyIt({
  book,
  onBuy,
  onClose,
}: {
  book: Book;
  onBuy: (shelf: string | null) => Promise<void>;
  onClose: () => void;
}) {
  const { books } = useBooks();
  const shelves = useMemo(() => shelvesInUse(books), [books]);
  const [shelf, setShelf] = useState<string | null>(shelves[0] ?? null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => heading.current?.focus(), []);

  const confirm = async () => {
    setBusy(true);
    setFailure(null);
    try {
      await onBuy(shelf);
    } catch (error) {
      setFailure(saveFailure(error).message);
      setBusy(false);
    }
  };

  return (
    <section className="book-card book-card--form" aria-labelledby="book-buy-title">
      <h2 className="book-card__title" id="book-buy-title" ref={heading} tabIndex={-1}>
        Where does “{book.title}” go?
      </h2>
      <ShelfPicker value={shelf} onChange={setShelf} shelves={shelves} disabled={busy} />
      {failure && <FailureLine>{failure}</FailureLine>}
      <div className="book-actions">
        <Button variant="primary" pill aria-disabled={busy || undefined} onClick={() => !busy && void confirm()}>
          {busy ? "Saving…" : "I bought it"}
        </Button>
        <Button variant="quiet" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
      </div>
    </section>
  );
}
