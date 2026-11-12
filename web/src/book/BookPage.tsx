import type { Book, BookPatch } from "@shelfmark/shared";
import { useEffect, useRef, useState } from "react";
import { todayIso } from "../add/flow";
import { saveFailure } from "../add/words";
import { deleteBook, patchBook, useBook, useBooks } from "../books/store";
import { Button, ButtonLink } from "../components/Button";
import { CoverImage } from "../components/CoverImage";
import { authorLine } from "../components/cover";
import { Page } from "../layout/Page";
import { LIBRARY, navigate, type RouteParams } from "../router";
import { BookDetails } from "./BookDetails";
import { BuyIt } from "./BuyIt";
import { CoverPanel } from "./CoverPanel";
import { DeleteBook } from "./DeleteBook";
import { EditForm } from "./EditForm";
import { RelookupDiff } from "./RelookupDiff";
import { useLookup } from "./useLookup";

const BACK = { to: LIBRARY, label: "Library" } as const;

/**
 * One book at `/books/:id`: the cover, everything the book holds, and every
 * way to change it. Edits go through the books store, so the Library shows
 * them without a reload.
 */
export function BookPage({ params }: { params: RouteParams<"book"> }) {
  const id = /^\d+$/.test(params.id) ? Number(params.id) : Number.NaN;
  const { book, status, error } = useBook(id);
  const { refresh } = useBooks();
  // The book being deleted, kept on screen while the delete finishes so the page doesn't flash "not in your library".
  const [leaving, setLeaving] = useState<Book | null>(null);
  const shown = book ?? leaving ?? undefined;

  if (shown) return <BookView key={shown.id} book={shown} onLeaving={() => setLeaving(shown)} />;

  if (status === "loading") {
    return (
      <Page title="Book" back={BACK}>
        <p className="text-meta text-muted" role="status">
          Opening the book…
        </p>
      </Page>
    );
  }
  if (status === "error") {
    return (
      <Page title="Book" back={BACK}>
        <div className="flex flex-col items-start gap-2.5 pt-2" role="alert">
          <p className="text-row-title font-semibold">The library didn’t load</p>
          <p className="text-small leading-tight text-muted">{error?.message ?? "Shelfmark can’t be reached."}</p>
          <Button variant="secondary" pill onClick={() => void refresh()}>
            Try again
          </Button>
        </div>
      </Page>
    );
  }
  return (
    <Page title="Not found" back={BACK}>
      <div className="flex flex-col items-start gap-2.5 pt-2">
        <p className="text-row-title font-semibold">This book isn’t in your library</p>
        <p className="text-small leading-tight text-muted">It may have been deleted, or the link is wrong.</p>
        <ButtonLink to={LIBRARY} variant="secondary" pill>
          Back to the Library
        </ButtonLink>
      </div>
    </Page>
  );
}

function BookView({ book, onLeaving }: { book: Book; onLeaving: () => void }) {
  const [editing, setEditing] = useState(false);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [buying, setBuying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const lookup = useLookup(book.isbn13);
  const wasEditing = useRef(false);

  // Back to the Edit button once the form closes, so the keyboard isn't dropped on the page.
  useEffect(() => {
    if (wasEditing.current && !editing) document.getElementById("book-edit")?.focus();
    wasEditing.current = editing;
  }, [editing]);

  const save = async (patch: BookPatch) => {
    if (Object.keys(patch).length > 0) await patchBook(book.id, patch);
    setNotice(Object.keys(patch).length > 0 ? "Saved." : "Nothing changed.");
    setEditing(false);
  };

  const applyLookup = async (patch: BookPatch, fields: string[]) => {
    await patchBook(book.id, patch);
    setNotice(`Updated ${fields.join(", ")}.`);
    setLookupOpen(false);
  };

  // "I bought it": the same row moves to Owned, on the shelf chosen, acquired today.
  const buy = async (shelf: string | null) => {
    await patchBook(book.id, { collection: "owned", shelf, acquiredOn: todayIso() });
    setNotice("Moved to your shelf.");
    setBuying(false);
  };

  const remove = async () => {
    onLeaving();
    try {
      await deleteBook(book.id);
    } catch (error) {
      // Not deleted: show the book again and let the confirmation say why.
      throw new Error(saveFailure(error).message, { cause: error });
    }
    navigate(LIBRARY, { replace: true });
  };

  const authors = authorLine(book.authors);
  const caption =
    book.subtitle || authors ? (
      <span className="flex flex-col gap-0.5">
        {book.subtitle && <span className="text-body text-ink-2">{book.subtitle}</span>}
        {authors && <span className="text-body text-muted">{authors}</span>}
      </span>
    ) : undefined;

  const toolbar = editing ? undefined : (
    <>
      {book.collection === "wishlist" && (
        <Button
          id="book-buy"
          variant="primary"
          pill
          aria-expanded={buying}
          onClick={() => (setNotice(null), setBuying(true))}
        >
          I bought it
        </Button>
      )}
      <Button id="book-edit" variant="secondary" pill onClick={() => (setNotice(null), setEditing(true))}>
        Edit
      </Button>
      {book.isbn13 !== null && (
        <Button
          variant="quiet"
          aria-expanded={lookupOpen}
          onClick={() => {
            setNotice(null);
            setLookupOpen(true);
            lookup.run();
          }}
        >
          Re-run lookup
        </Button>
      )}
    </>
  );

  return (
    <Page title={book.title} caption={caption} toolbar={toolbar} back={BACK} book>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 md:grid-cols-[260px_minmax(0,720px)] md:gap-10 md:pt-1.5">
        <div className="mx-auto flex w-[min(100%,168px)] flex-col gap-3 max-md:has-data-[cover-panel]:w-full md:sticky md:top-[calc(var(--spacing-topbar)_+_24px)] md:m-0 md:w-full max-md:has-data-[cover-panel]:[&>:first-child]:w-42 max-md:has-data-[cover-panel]:[&>:first-child]:self-center">
          <CoverImage book={book} width="100%" alt={`Cover of ${book.title}`} loading="eager" />
          <CoverPanel book={book} lookup={lookup} />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <p className="text-meta font-semibold text-ink empty:hidden" role="status">
            {notice}
          </p>
          {buying && !editing && book.collection === "wishlist" && (
            <BuyIt book={book} onBuy={buy} onClose={() => setBuying(false)} />
          )}
          {lookupOpen && !editing && (
            <RelookupDiff book={book} lookup={lookup} onApply={applyLookup} onClose={() => setLookupOpen(false)} />
          )}
          {editing ? (
            <EditForm book={book} onSave={save} onCancel={() => setEditing(false)} />
          ) : (
            <>
              <BookDetails book={book} />
              <DeleteBook book={book} onDelete={remove} />
            </>
          )}
        </div>
      </div>
    </Page>
  );
}
