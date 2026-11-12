import type { Book, Status } from "@shelfmark/shared";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button, ButtonLink } from "../components/Button";
import { CoverImage, type CoverBook } from "../components/CoverImage";
import { CheckIcon } from "../components/icons";
import { Sheet } from "../components/Sheet";
import type { QueueItem } from "../offline/queueStore";
import { bookRoute } from "../router";
import { CoverCapture, type CoverPhoto } from "./CoverCapture";
import {
  newestCopy,
  wishlistedCopy,
  type FormBase,
  type FormReason,
  type Mode,
  type Proposal,
  type Step,
} from "./flow";
import type { FormFields, FormValues } from "./form";
import { AlertIcon, BarcodeIcon } from "./icons";
import { IsbnField } from "./IsbnField";
import { FailureLine, ManualForm } from "./ManualForm";
import { ShelfPicker } from "./ShelfPicker";
import { StatusPicker } from "./StatusPicker";
import {
  bylineLine,
  draftSources,
  metaLine,
  notFoundWording,
  offlineNote,
  offlineStatus,
  ownedLine,
  queueItemLine,
  sourceLine,
  waitingLine,
} from "./words";

/** What the sheet's buttons ask the page to do. */
export interface SheetActions {
  saveProposal: (proposal: Proposal, shelf: string | null, status: Status, photo: CoverPhoto | null) => void;
  /** "Add to wishlist": saves the proposal with `collection: "wishlist"`, no shelf. */
  saveToWishlist: (proposal: Proposal, photo: CoverPhoto | null) => void;
  /** "I bought it": moves the wishlisted book (`bookId`) to Owned on `shelf`, acquired today. */
  buy: (bookId: number, shelf: string | null) => void;
  saveForm: (fields: FormFields, base: FormBase, photo: CoverPhoto | null) => void;
  discard: () => void;
  edit: (shelf: string | null, status: Status) => void;
  anotherCopy: () => void;
  typeIsbn: () => void;
  byHand: () => void;
  retry: () => void;
  /** "Look it up later": queue an offline scan's ISBN with the shelf picked, if any. */
  lookLater: (isbn13: string, shelf: string | null) => void;
  /** A queued scan's answer as the ordinary sheet (or the by-hand form when the lookup was refused). */
  openQueued: (id: number) => void;
  /** Drop a queued scan. */
  removeQueued: (id: number) => void;
  submitIsbn: (isbn13: string) => void;
}

export interface ResultSheetProps {
  step: Exclude<Step, { kind: "ready" }>;
  mode: Mode;
  /** Over the camera (Scan): the floating sheet. Otherwise a white panel in the page. */
  floating: boolean;
  /** Move focus into the sheet as it appears. Type ISBN keeps it in the field, for the next scan. */
  takeFocus: boolean;
  shelves: readonly string[];
  /** The shelf a new book starts on: the one used last. */
  defaultShelf: string | null;
  /** The library, for an already-owned book's details and cover. */
  books: readonly Book[];
  /** The scans waiting to be looked up (offline/queueStore.ts). */
  queue: readonly QueueItem[];
  on: SheetActions;
}

/** The primary actions, worded for the mode: the owner's next move is in the label. */
const WORDS: Record<Mode, { save: string; next: string; discard: string }> = {
  scan: { save: "Save and scan the next one", next: "Scan the next one", discard: "Discard this scan" },
  isbn: { save: "Save and type the next one", next: "Type the next one", discard: "Discard this ISBN" },
  manual: { save: "Save and add the next one", next: "Add the next one", discard: "Discard" },
};

/**
 * A scan's result, in every state the flow has: looking it up, found,
 * already owned, not found (the by-hand form), a barcode that isn't an ISBN,
 * and a failed lookup. The primary action is a full-width accent pill; the
 * way out ("Not this book", "Discard this scan") sits apart, under it, in
 * plain ink.
 */
export function ResultSheet({
  step,
  mode,
  floating,
  takeFocus,
  shelves,
  defaultShelf,
  books,
  queue,
  on,
}: ResultSheetProps) {
  const headingId = useId();
  const words = WORDS[mode];
  const shared = { headingId, takeFocus, words, on };

  let content: ReactNode;
  switch (step.kind) {
    case "looking":
      content = <Looking key={step.id} isbn13={step.isbn13} {...shared} />;
      break;
    case "found":
      content = <Found key={step.id} step={step} shelves={shelves} defaultShelf={defaultShelf} {...shared} />;
      break;
    case "owned":
      content = <Owned key={step.id} step={step} books={books} {...shared} />;
      break;
    case "wishlisted":
      content = (
        <Wishlisted key={step.id} step={step} books={books} shelves={shelves} defaultShelf={defaultShelf} {...shared} />
      );
      break;
    case "other":
      content = <Other key={step.id} code={step.code} {...shared} />;
      break;
    case "typing":
      content = <Typing key={step.id} code={step.code} {...shared} />;
      break;
    case "offline":
      content = (
        <Offline
          key={step.id}
          step={step}
          later={{ shelves, defaultShelf, waiting: queue.some((item) => item.isbn13 === step.isbn13) }}
          {...shared}
        />
      );
      break;
    case "failed":
      content = (
        <Failed
          key={step.id}
          message={step.failure.message}
          later={
            step.failure.network
              ? {
                  isbn13: step.isbn13,
                  shelves,
                  defaultShelf,
                  waiting: queue.some((item) => item.isbn13 === step.isbn13),
                }
              : null
          }
          {...shared}
        />
      );
      break;
    case "queue":
      content = <Queue key={step.id} queue={queue} {...shared} />;
      break;
    case "form":
      content = (
        <FormStep key={step.id} step={step} shelves={shelves} defaultShelf={defaultShelf} mode={mode} {...shared} />
      );
      break;
  }

  return floating ? (
    <Sheet
      className="max-h-[calc(100%-var(--add-top-room)-12px)] md:max-h-[calc(100%-24px)]"
      data-floating
      aria-labelledby={headingId}
    >
      {content}
    </Sheet>
  ) : (
    <section
      className="flex flex-col gap-3.5 rounded-container bg-surface p-4 motion-safe:animate-dialog-in md:gap-4 md:p-5"
      aria-labelledby={headingId}
    >
      {content}
    </section>
  );
}

interface Shared {
  headingId: string;
  takeFocus: boolean;
  words: (typeof WORDS)[Mode];
  on: SheetActions;
}

/** Focus the heading as a step appears, so a screen reader starts there and Tab goes on into the sheet. */
function useHeadingFocus(takeFocus: boolean) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (takeFocus) heading.current?.focus({ preventScroll: true });
  }, [takeFocus]);
  return heading;
}

/** The row every result opens with: the cover, then what the book is. */
function Head({ cover, children }: { cover: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3.5">
      <div className="w-15 flex-none">{cover}</div>
      <div className="flex min-w-0 flex-col gap-0.5">{children}</div>
    </div>
  );
}

/** A plain-ink way out, apart from the primary action. */
function Leave({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <Button variant="quiet" className="text-ink-2 hover:text-ink active:text-ink" onClick={onClick} disabled={disabled}>
      {children}
    </Button>
  );
}

// --- Looking it up ---------------------------------------------------------------

function Looking({ isbn13, headingId, takeFocus, on }: Shared & { isbn13: string }) {
  const heading = useHeadingFocus(takeFocus);
  // Open Library takes two calls per book, 400 ms apart, and is sometimes slow.
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 3500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <Head cover={<span className="block aspect-[2/3] w-15 rounded-cover bg-control" />}>
        <h2
          ref={heading}
          id={headingId}
          tabIndex={-1}
          className="text-(length:--text-result-title) leading-[1.2] font-bold tracking-[-0.01em] wrap-anywhere tabular-nums focus-visible:rounded-[2px] focus-visible:outline-offset-[4px]"
        >
          {isbn13}
        </h2>
        <p className="text-meta text-muted tabular-nums" role="status">
          {slow ? "Still looking. Open Library can take a few seconds." : "Looking it up in Open Library…"}
        </p>
      </Head>
      <div
        className="relative h-0.75 overflow-hidden rounded-pill bg-control after:absolute after:top-0 after:right-auto after:bottom-0 after:left-0 after:w-[35%] after:rounded-[inherit] after:bg-accent after:content-[''] after:motion-safe:animate-progress motion-reduce:after:w-full motion-reduce:after:[animation:none] motion-reduce:after:opacity-50"
        role="progressbar"
        aria-label={`Looking up ${isbn13}`}
      />
      <div className="-mt-1 flex justify-center gap-3">
        <Leave onClick={on.discard}>Cancel</Leave>
      </div>
    </>
  );
}

// --- Found ------------------------------------------------------------------------

function proposalCover(proposal: Proposal, photo: CoverPhoto | null): { book: CoverBook; src?: string } {
  const { details, cover } = proposal;
  const book: CoverBook = { title: details.title, authors: details.authors ?? [], language: details.language ?? null };
  if (photo) return { book, src: photo.preview };
  if (cover.kind === "candidates") return { book, src: cover.urls[0] };
  if (cover.kind === "copy")
    return { book: { ...book, id: cover.fromId, hasCover: true, coverUpdatedAt: cover.coverUpdatedAt } };
  return { book };
}

function Found({
  step,
  shelves,
  defaultShelf,
  headingId,
  takeFocus,
  words,
  on,
}: Shared & { step: Extract<Step, { kind: "found" }>; shelves: readonly string[]; defaultShelf: string | null }) {
  const heading = useHeadingFocus(takeFocus);
  // A queued scan keeps the shelf chosen when it was scanned.
  const [shelf, setShelf] = useState(step.shelf === undefined ? defaultShelf : step.shelf);
  const [status, setStatus] = useState<Status>("unread");
  const [photo, setPhoto] = useState<CoverPhoto | null>(null);
  const { proposal, save } = step;
  const { details } = proposal;
  const cover = proposalCover(proposal, photo);
  const byline = bylineLine({ authors: details.authors });
  const meta = metaLine(details);

  return (
    <>
      <Head cover={<CoverImage book={cover.book} src={cover.src} width={60} loading="eager" />}>
        <h2
          ref={heading}
          id={headingId}
          tabIndex={-1}
          className="text-(length:--text-result-title) leading-[1.2] font-bold tracking-[-0.01em] wrap-anywhere focus-visible:rounded-[2px] focus-visible:outline-offset-[4px]"
        >
          {details.title}
          {details.subtitle && (
            <span className="mt-0.5 block text-body font-regular tracking-[0] text-ink-2">{details.subtitle}</span>
          )}
        </h2>
        {byline && <p className="mt-0.5 text-body text-ink-2">{byline}</p>}
        {meta && <p className="text-meta text-muted tabular-nums">{meta}</p>}
        <p className="mt-0.5 text-small text-muted">{sourceLine(proposal.origin)}</p>
      </Head>
      {proposal.cover.kind === "none" && <CoverCapture photo={photo} onChange={setPhoto} disabled={save.saving} />}
      <ShelfPicker value={shelf} onChange={setShelf} shelves={shelves} disabled={save.saving} />
      <StatusPicker value={status} onChange={setStatus} disabled={save.saving} />
      {save.failure && <FailureLine>{save.failure.message}</FailureLine>}
      <Button
        variant="primary"
        size="large"
        block
        aria-disabled={save.saving || undefined}
        onClick={() => {
          if (!save.saving) on.saveProposal(proposal, shelf, status, photo);
        }}
      >
        {save.saving ? "Saving…" : words.save}
      </Button>
      {proposal.origin !== "copy" && (
        <Button
          variant="secondary"
          pill
          block
          aria-disabled={save.saving || undefined}
          onClick={() => {
            if (!save.saving) on.saveToWishlist(proposal, photo);
          }}
        >
          Add to wishlist
        </Button>
      )}
      <div className="-mt-1 flex justify-between gap-3">
        <Leave onClick={on.discard} disabled={save.saving}>
          {proposal.origin === "copy" ? words.discard : "Not this book"}
        </Leave>
        <Button variant="quiet" onClick={() => on.edit(shelf, status)} disabled={save.saving}>
          Edit details
        </Button>
      </div>
    </>
  );
}

// --- Already owned ----------------------------------------------------------------

function Owned({
  step,
  books,
  headingId,
  takeFocus,
  words,
  on,
}: Shared & { step: Extract<Step, { kind: "owned" }>; books: readonly Book[] }) {
  const heading = useHeadingFocus(takeFocus);
  const [now] = useState(() => new Date());
  const { owned, draft, isbn13 } = step.lookup;
  // The owned step always has a copy; the fallback only satisfies the type.
  const newest = newestCopy(owned) ?? { id: 0, shelf: null, createdAt: "" };
  const saved = books.find((book) => book.id === newest.id);
  const title = saved?.title ?? draft?.title ?? `ISBN ${isbn13}`;
  const byline = bylineLine(saved ?? draft ?? {});
  const coverBook: CoverBook = saved ?? { title, authors: draft?.authors ?? [], language: draft?.language ?? null };
  // A copy saved a moment ago may still be fetching its cover: show the draft's meanwhile.
  const src = saved?.hasCover ? undefined : draft?.coverCandidates[0]?.url;

  return (
    <>
      <Head cover={<CoverImage book={coverBook} src={src} width={60} loading="eager" />}>
        <p className="inline-flex items-center gap-1.25 text-small font-semibold text-accent">
          <CheckIcon size={15} />
          Already in your library
        </p>
        <h2
          ref={heading}
          id={headingId}
          tabIndex={-1}
          className="text-(length:--text-result-title) leading-[1.2] font-bold tracking-[-0.01em] wrap-anywhere focus-visible:rounded-[2px] focus-visible:outline-offset-[4px]"
        >
          {title}
        </h2>
        {byline && <p className="mt-0.5 text-body text-ink-2">{byline}</p>}
        <p className="text-meta text-muted tabular-nums">{ownedLine(owned, now)}</p>
      </Head>
      <Button variant="primary" size="large" block onClick={on.discard}>
        {words.next}
      </Button>
      <div className="grid grid-cols-[1fr_1fr] gap-2.5">
        <Button variant="secondary" pill block onClick={on.anotherCopy}>
          Add another copy
        </Button>
        <ButtonLink to={bookRoute(newest.id)} variant="secondary" pill block>
          Open the book
        </ButtonLink>
      </div>
    </>
  );
}

// --- On the wishlist -------------------------------------------------------------

function Wishlisted({
  step,
  books,
  shelves,
  defaultShelf,
  headingId,
  takeFocus,
  words,
  on,
}: Shared & {
  step: Extract<Step, { kind: "wishlisted" }>;
  books: readonly Book[];
  shelves: readonly string[];
  defaultShelf: string | null;
}) {
  const heading = useHeadingFocus(takeFocus);
  const [shelf, setShelf] = useState(defaultShelf);
  const { lookup, save } = step;
  const { draft, isbn13 } = lookup;
  // The wishlisted step always has a copy; the fallback only satisfies the type.
  const wanted = wishlistedCopy(lookup) ?? { id: 0 };
  const saved = books.find((book) => book.id === wanted.id);
  const title = saved?.title ?? draft?.title ?? `ISBN ${isbn13}`;
  const byline = bylineLine(saved ?? draft ?? {});
  const coverBook: CoverBook = saved ?? { title, authors: draft?.authors ?? [], language: draft?.language ?? null };
  const src = saved?.hasCover ? undefined : draft?.coverCandidates[0]?.url;

  return (
    <>
      <Head cover={<CoverImage book={coverBook} src={src} width={60} loading="eager" />}>
        <p className="inline-flex items-center gap-1.25 text-small font-semibold text-accent">
          <CheckIcon size={15} />
          On your wishlist
        </p>
        <h2
          ref={heading}
          id={headingId}
          tabIndex={-1}
          className="text-(length:--text-result-title) leading-[1.2] font-bold tracking-[-0.01em] wrap-anywhere focus-visible:rounded-[2px] focus-visible:outline-offset-[4px]"
        >
          {title}
        </h2>
        {byline && <p className="mt-0.5 text-body text-ink-2">{byline}</p>}
      </Head>
      <ShelfPicker value={shelf} onChange={setShelf} shelves={shelves} disabled={save.saving} />
      {save.failure && <FailureLine>{save.failure.message}</FailureLine>}
      <Button
        variant="primary"
        size="large"
        block
        aria-disabled={save.saving || undefined}
        onClick={() => {
          if (!save.saving) on.buy(wanted.id, shelf);
        }}
      >
        {save.saving ? "Saving…" : "I bought it"}
      </Button>
      <div className="grid grid-cols-[1fr_1fr] gap-2.5">
        <Button variant="secondary" pill block onClick={on.discard} disabled={save.saving}>
          {words.next}
        </Button>
        <ButtonLink to={bookRoute(wanted.id)} variant="secondary" pill block>
          Open the book
        </ButtonLink>
      </div>
    </>
  );
}

// --- The offline answer -----------------------------------------------------------

/**
 * The device's copy of the library answering when the server can't be
 * reached. It only says where the book is: saving needs the network, so no
 * save action is offered, and "Try again" asks the server once it is back.
 */
function Offline({
  step,
  later,
  headingId,
  takeFocus,
  words,
  on,
}: Shared & { step: Extract<Step, { kind: "offline" }>; later: Omit<LookLaterProps, "isbn13" | "on"> }) {
  const heading = useHeadingFocus(takeFocus);
  const { answer, isbn13 } = step;
  const title = answer.kind === "absent" ? `ISBN ${isbn13}` : (answer.copies[0]?.title ?? `ISBN ${isbn13}`);
  const coverBook: CoverBook = { title, authors: [], language: null };
  return (
    <>
      <Head cover={<CoverImage book={coverBook} width={60} loading="eager" />}>
        <p className="inline-flex items-center gap-1.25 text-small font-semibold text-accent">
          {answer.kind === "absent" ? <AlertIcon size={15} /> : <CheckIcon size={15} />}
          {offlineStatus(answer)}
        </p>
        <h2
          ref={heading}
          id={headingId}
          tabIndex={-1}
          className="text-(length:--text-result-title) leading-[1.2] font-bold tracking-[-0.01em] wrap-anywhere focus-visible:rounded-[2px] focus-visible:outline-offset-[4px]"
        >
          {title}
        </h2>
        <p className="text-meta text-muted tabular-nums">{offlineNote(answer)}</p>
        {answer.kind === "absent" && <p className="text-meta text-muted tabular-nums">Adding it needs the network.</p>}
      </Head>
      {answer.kind === "absent" && <LookLater isbn13={isbn13} {...later} on={on} />}
      <Button variant="primary" size="large" block onClick={on.discard}>
        {words.next}
      </Button>
      <div className="-mt-1 flex justify-center gap-3">
        <Button variant="quiet" onClick={on.retry}>
          Try again online
        </Button>
      </div>
    </>
  );
}

interface LookLaterProps {
  isbn13: string;
  shelves: readonly string[];
  defaultShelf: string | null;
  /** The ISBN is already in the queue. */
  waiting: boolean;
  on: SheetActions;
}

/** Offline, a book to add: queue its ISBN (and a shelf) to be looked up once the network is back. */
function LookLater({ isbn13, shelves, defaultShelf, waiting, on }: LookLaterProps) {
  const [shelf, setShelf] = useState(defaultShelf);
  if (waiting) return <p className="text-meta text-muted tabular-nums">Already waiting to be looked up.</p>;
  return (
    <>
      <ShelfPicker value={shelf} onChange={setShelf} shelves={shelves} />
      <Button variant="secondary" pill block onClick={() => on.lookLater(isbn13, shelf)}>
        Look it up later
      </Button>
    </>
  );
}

// --- A barcode that isn't an ISBN -------------------------------------------------

function Other({ code, headingId, takeFocus, words, on }: Shared & { code: string }) {
  const heading = useHeadingFocus(takeFocus);
  return (
    <>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-pill bg-control text-ink-2">
          <BarcodeIcon size={22} />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2
            ref={heading}
            id={headingId}
            tabIndex={-1}
            className="text-(length:--text-sheet-heading) leading-[1.2] font-semibold tracking-[-0.01em] wrap-anywhere focus-visible:rounded-[2px] focus-visible:outline-offset-[4px]"
          >
            This barcode isn't an ISBN
          </h2>
          <p className="mt-0.5 text-body text-ink-2">
            It reads <span className="font-semibold wrap-anywhere text-ink-2 tabular-nums">{code}</span>, a shop's
            sticker or another code. The ISBN is printed near the barcode or on the copyright page.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-[1fr_1fr] gap-2.5">
        <Button variant="secondary" pill block onClick={on.typeIsbn}>
          Type the ISBN
        </Button>
        <Button variant="secondary" pill block onClick={on.byHand}>
          Add by hand
        </Button>
      </div>
      <div className="-mt-1 flex justify-center gap-3">
        <Leave onClick={on.discard}>{words.discard}</Leave>
      </div>
    </>
  );
}

/** Scan mode's own ISBN field, after a non-ISBN barcode: the camera stays, paused, behind it. */
function Typing({ code, headingId, takeFocus, on }: Shared & { code: string }) {
  return (
    <>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2
          id={headingId}
          className="text-(length:--text-sheet-heading) leading-[1.2] font-semibold tracking-[-0.01em] wrap-anywhere focus-visible:rounded-[2px] focus-visible:outline-offset-[4px]"
        >
          Type the ISBN
        </h2>
        <p className="text-meta text-muted tabular-nums">
          The code read was <span className="font-semibold wrap-anywhere text-ink-2 tabular-nums">{code}</span>. The
          ISBN is printed near the barcode or on the copyright page.
        </p>
      </div>
      <IsbnField size="regular" onSubmit={on.submitIsbn} keepFocus={false} autoFocus={takeFocus} hint={null} />
      <div className="-mt-1 flex justify-between gap-3">
        <Leave onClick={on.discard}>Back to scanning</Leave>
        <Button variant="quiet" onClick={on.byHand}>
          Add by hand
        </Button>
      </div>
    </>
  );
}

// --- A failed lookup ----------------------------------------------------------------

function Failed({
  message,
  later,
  headingId,
  takeFocus,
  words,
  on,
}: Shared & { message: string; later: Omit<LookLaterProps, "on"> | null }) {
  const heading = useHeadingFocus(takeFocus);
  return (
    <>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-pill bg-control text-ink-2">
          <AlertIcon size={22} />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2
            ref={heading}
            id={headingId}
            tabIndex={-1}
            className="text-(length:--text-sheet-heading) leading-[1.2] font-semibold tracking-[-0.01em] wrap-anywhere focus-visible:rounded-[2px] focus-visible:outline-offset-[4px]"
          >
            The lookup didn't work
          </h2>
          <p className="mt-0.5 text-body text-ink-2">{message}</p>
        </div>
      </div>
      {later !== null && <LookLater {...later} on={on} />}
      <Button variant="primary" size="large" block onClick={on.retry}>
        Try again
      </Button>
      <div className="-mt-1 flex justify-between gap-3">
        <Leave onClick={on.discard}>{words.discard}</Leave>
        <Button variant="quiet" onClick={on.byHand}>
          Add by hand
        </Button>
      </div>
    </>
  );
}

// --- The queued scans ---------------------------------------------------------------

/** The list behind "Waiting to look up (N)" (or "Ready to confirm (N)"). An answered scan opens as the usual sheet; nothing is saved until it is confirmed there. */
function Queue({ queue, headingId, takeFocus, on }: Shared & { queue: readonly QueueItem[] }) {
  const heading = useHeadingFocus(takeFocus);
  return (
    <>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2
          ref={heading}
          id={headingId}
          tabIndex={-1}
          className="text-(length:--text-sheet-heading) leading-[1.2] font-semibold tracking-[-0.01em] wrap-anywhere focus-visible:rounded-[2px] focus-visible:outline-offset-[4px]"
        >
          {waitingLine(queue)}
        </h2>
        <p className="text-meta text-muted tabular-nums">
          Looked up one at a time while you're online. Each answer is yours to confirm.
        </p>
      </div>
      {queue.length > 0 && (
        <ul className="flex list-none flex-col">
          {queue.map((item) => (
            <li key={item.id} className="flex items-center gap-2 border-t border-hairline py-2.5">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="tabular-nums">{item.isbn13}</span>
                <span className="text-meta text-muted tabular-nums">
                  {queueItemLine(item)}
                  {item.shelf !== null && ` · ${item.shelf}`}
                </span>
              </div>
              {item.state === "answered" && (
                <Button variant="secondary" pill onClick={() => on.openQueued(item.id)}>
                  Review
                </Button>
              )}
              {item.state === "failed" && (
                <Button variant="secondary" pill onClick={() => on.openQueued(item.id)}>
                  Add by hand
                </Button>
              )}
              {(item.state === "waiting" || item.state === "failed") && (
                <Button variant="quiet" onClick={() => on.removeQueued(item.id)}>
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="-mt-1 flex justify-center gap-3">
        <Leave onClick={on.discard}>Close</Leave>
      </div>
    </>
  );
}

// --- The by-hand form -------------------------------------------------------------

const REST_CAN_WAIT = "Fill in what the cover says; the rest can wait.";

function FormIntro({
  step,
  headingId,
  onRetry,
}: {
  step: Extract<Step, { kind: "form" }>;
  headingId: string;
  onRetry: () => void;
}) {
  const { reason, lookup } = step;
  if (reason === "manual")
    return (
      <h2 id={headingId} className="sr-only">
        Add a book by hand
      </h2>
    );
  if (reason === "edit") {
    return (
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2
          id={headingId}
          className="text-(length:--text-sheet-heading) leading-[1.2] font-semibold tracking-[-0.01em] wrap-anywhere focus-visible:rounded-[2px] focus-visible:outline-offset-[4px]"
        >
          Edit details
        </h2>
        {lookup?.draft && <p className="mt-0.5 text-small text-muted">{sourceLine(lookup.draft.sources)}</p>}
      </div>
    );
  }

  let notice: ReactNode;
  let uncertain = false;
  switch (reason) {
    case "not-found": {
      const wording = notFoundWording(lookup?.tried ?? []);
      uncertain = wording.uncertain;
      const isbn = <strong className="tabular-nums">{lookup?.isbn13}</strong>;
      notice = (
        <>
          {wording.searchedIn ? (
            <>
              No match for {isbn} in {wording.searchedIn}.
            </>
          ) : (
            <>Nothing found for {isbn}.</>
          )}{" "}
          {wording.notes.map((note) => `${note} `)}
          {REST_CAN_WAIT}
        </>
      );
      break;
    }
    case "untitled":
      notice = (
        <>
          {lookup?.draft ? `Found in ${draftSources(lookup.draft.sources)}` : "Found"}, but without a title.{" "}
          {REST_CAN_WAIT}
        </>
      );
      break;
    case "barcode":
      notice = (
        <>
          The barcode <strong className="tabular-nums">{step.base.details.barcode}</strong> is kept with the book.{" "}
          {REST_CAN_WAIT}
        </>
      );
      break;
    case "copy":
      notice = <>Another copy of a book you have. {REST_CAN_WAIT}</>;
      break;
    case "failed":
      notice = REST_CAN_WAIT;
      break;
  }

  return (
    <div className="flex flex-col items-start gap-1 text-body text-ink [&_strong]:font-semibold">
      <h2 id={headingId} className="sr-only">
        Add it by hand
      </h2>
      <p>{notice}</p>
      {uncertain && (
        <Button variant="quiet" className="-ml-1" onClick={onRetry}>
          Look it up again
        </Button>
      )}
    </div>
  );
}

const COVER_PROMPTS: Record<FormReason, string> = {
  manual: "Add a cover: take a photo of the front.",
  barcode: "Add a cover: take a photo of the front.",
  failed: "Add a cover: take a photo of the front.",
  "not-found": "No cover found. Take a photo of the front.",
  untitled: "No cover found. Take a photo of the front.",
  copy: "No cover found. Take a photo of the front.",
  edit: "No cover found. Take a photo of the front.",
};

function FormStep({
  step,
  shelves,
  defaultShelf,
  mode,
  headingId,
  takeFocus,
  words,
  on,
}: Shared & {
  step: Extract<Step, { kind: "form" }>;
  shelves: readonly string[];
  defaultShelf: string | null;
  mode: Mode;
}) {
  const initial: FormValues = {
    ...step.initial,
    shelf: step.initial.shelf === undefined ? defaultShelf : step.initial.shelf,
  };
  const manual = step.reason === "manual";
  return (
    <ManualForm
      initial={initial}
      shelves={shelves}
      submitLabel={words.save}
      saving={step.save.saving}
      failure={step.save.failure?.message}
      intro={<FormIntro step={step} headingId={headingId} onRetry={on.retry} />}
      coverPrompt={step.base.cover.kind === "none" ? COVER_PROMPTS[step.reason] : null}
      onSubmit={(fields, photo) => on.saveForm(fields, step.base, photo)}
      // Scan: the mock-up's focused title. By hand: the owner just chose to type (unless they came by the tabs' arrows).
      autoFocus={takeFocus && (mode === "scan" || manual)}
      // The intro names the ISBN a lookup was made with; the field is for one typed by hand or corrected.
      showIsbn={!(step.reason === "not-found" || step.reason === "untitled" || step.reason === "copy")}
      secondary={
        manual ? undefined : (
          <Leave onClick={on.discard} disabled={step.save.saving}>
            {words.discard}
          </Leave>
        )
      }
    />
  );
}
