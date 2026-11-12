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
    <section
      className="min-w-0 p-5 rounded-container bg-surface max-md:p-4 flex flex-col gap-4"
      aria-labelledby="book-buy-title"
    >
      <h2 className="mb-1 text-ink text-row-title font-semibold" id="book-buy-title" ref={heading} tabIndex={-1}>
        Where does “{book.title}” go?
      </h2>
      <ShelfPicker value={shelf} onChange={setShelf} shelves={shelves} disabled={busy} />
      {failure && <FailureLine>{failure}</FailureLine>}
      <div className="flex flex-wrap items-center gap-2">
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
