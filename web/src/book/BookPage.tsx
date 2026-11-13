import type { Book, BookPatch } from "@shelfmark/shared";
import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { todayIso } from "../add/flow";
import { saveFailure } from "../add/words";
import { deleteBook, patchBook, useBook, useBooks } from "../books/store";
import { Button, ButtonLink } from "../components/Button";
import { STATUS_LABELS } from "../add/StatusPicker";
import { CoverImage } from "../components/CoverImage";
import { EditIcon } from "../components/icons";
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
          <Button variant="secondary" onClick={() => void refresh()}>
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
        <ButtonLink to={LIBRARY} variant="secondary">
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

  const actions = editing ? undefined : (
    <div className="flex flex-wrap items-center gap-2 max-md:w-full max-md:[&>*]:flex-[1_1_100%]">
      {book.collection === "wishlist" && (
        <Button
          id="book-buy"
          variant="primary"
          aria-expanded={buying}
          onClick={() => (setNotice(null), setBuying(true))}
        >
          I bought it
        </Button>
      )}
      <Button
        id="book-edit"
        variant="secondary"
        icon={<EditIcon size={18} />}
        onClick={() => (setNotice(null), setEditing(true))}
      >
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
    </div>
  );

  return (
    <Page title={book.title} back={BACK} bare>
      <div className="flex flex-wrap items-start gap-x-12 gap-y-6 max-lg:gap-x-6 max-md:gap-y-2 md:mx-auto md:w-full md:max-w-[1020px] md:pt-2">
        <div className="flex flex-none basis-60 flex-col gap-4 max-lg:basis-50 max-md:basis-full max-md:items-center md:sticky md:top-[calc(var(--spacing-topbar)_+_32px)] [&>:first-child]:w-full max-md:[&>:first-child]:w-42">
          <CoverImage book={book} width="100%" alt={`Cover of ${book.title}`} loading="eager" />
          <CoverPanel book={book} lookup={lookup} />
        </div>
        <div className="flex max-w-180 min-w-0 flex-[999_1_360px] flex-col gap-4 max-md:basis-full">
          <div>
            <h1 className="font-book text-title leading-title font-semibold tracking-title wrap-anywhere max-md:text-title-phone max-md:leading-9">
              {book.title}
            </h1>
            {book.subtitle && <p className="text-body text-ink-2">{book.subtitle}</p>}
            {authors && <p className="text-body text-ink-2">{authors}</p>}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 pb-2">
            <dl className="flex flex-wrap gap-8">
              <div className="flex flex-col gap-1">
                <dt className="text-label leading-label font-semibold text-muted">Shelf</dt>
                <dd className="text-heading leading-heading font-semibold">
                  {book.shelf ?? <span className="text-muted">No shelf</span>}
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-label leading-label font-semibold text-muted">Status</dt>
                <dd
                  className={cn(
                    "text-heading leading-heading font-semibold",
                    book.status === "reading" && "text-accent",
                  )}
                >
                  {STATUS_LABELS[book.status]}
                </dd>
              </div>
            </dl>
            {actions}
          </div>
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
