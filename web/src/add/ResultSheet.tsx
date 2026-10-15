import type { Book, Status } from "@shelfmark/shared";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button, ButtonLink } from "../components/Button";
import { CoverImage, type CoverBook } from "../components/CoverImage";
import { CheckIcon } from "../components/icons";
import { Sheet } from "../components/Sheet";
import { bookRoute } from "../router";
import { CoverCapture, type CoverPhoto } from "./CoverCapture";
import { newestCopy, type FormBase, type FormReason, type Mode, type Proposal, type Step } from "./flow";
import type { FormFields, FormValues } from "./form";
import { AlertIcon, BarcodeIcon } from "./icons";
import { IsbnField } from "./IsbnField";
import { FailureLine, ManualForm } from "./ManualForm";
import { ShelfPicker } from "./ShelfPicker";
import { StatusPicker } from "./StatusPicker";
import { bylineLine, metaLine, notFoundWording, ownedLine, SOURCE_NAMES, sourceLine } from "./words";

/** What the sheet's buttons ask the page to do. */
export interface SheetActions {
  saveProposal: (proposal: Proposal, shelf: string | null, status: Status, photo: CoverPhoto | null) => void;
  saveForm: (fields: FormFields, base: FormBase, photo: CoverPhoto | null) => void;
  discard: () => void;
  edit: (shelf: string | null, status: Status) => void;
  anotherCopy: () => void;
  typeIsbn: () => void;
  byHand: () => void;
  retry: () => void;
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
export function ResultSheet({ step, mode, floating, takeFocus, shelves, defaultShelf, books, on }: ResultSheetProps) {
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
    case "other":
      content = <Other key={step.id} code={step.code} {...shared} />;
      break;
    case "typing":
      content = <Typing key={step.id} code={step.code} {...shared} />;
      break;
    case "failed":
      content = <Failed key={step.id} message={step.failure.message} {...shared} />;
      break;
    case "form":
      content = <FormStep key={step.id} step={step} shelves={shelves} defaultShelf={defaultShelf} mode={mode} {...shared} />;
      break;
  }

  return floating ? (
    <Sheet className="add-sheet" aria-labelledby={headingId}>
      {content}
    </Sheet>
  ) : (
    <section className="add-result" aria-labelledby={headingId}>
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
    <div className="add-head">
      <div className="add-head__cover">{cover}</div>
      <div className="add-head__text">{children}</div>
    </div>
  );
}

/** A plain-ink way out, apart from the primary action. */
function Leave({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <Button variant="quiet" className="add-quiet-neutral" onClick={onClick} disabled={disabled}>
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
      <Head cover={<span className="add-head__blank" />}>
        <h2 ref={heading} id={headingId} tabIndex={-1} className="add-title tabular">
          {isbn13}
        </h2>
        <p className="add-meta" role="status">
          {slow ? "Still looking. Open Library can take a few seconds." : "Looking it up in Open Library…"}
        </p>
      </Head>
      <div className="add-progress" role="progressbar" aria-label={`Looking up ${isbn13}`} />
      <div className="add-actions">
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
  if (cover.kind === "copy") return { book: { ...book, id: cover.fromId, hasCover: true } };
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
  const [shelf, setShelf] = useState(defaultShelf);
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
        <h2 ref={heading} id={headingId} tabIndex={-1} className="add-title">
          {details.title}
          {details.subtitle && <span className="add-title__sub">{details.subtitle}</span>}
        </h2>
        {byline && <p className="add-byline">{byline}</p>}
        {meta && <p className="add-meta">{meta}</p>}
        <p className="add-source">{sourceLine(proposal.origin)}</p>
      </Head>
      {proposal.cover.kind === "none" && (
        <CoverCapture photo={photo} onChange={setPhoto} disabled={save.saving} />
      )}
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
      <div className="add-actions add-actions--split">
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
        <p className="add-status">
          <CheckIcon size={15} />
          Already in your library
        </p>
        <h2 ref={heading} id={headingId} tabIndex={-1} className="add-title">
          {title}
        </h2>
        {byline && <p className="add-byline">{byline}</p>}
        <p className="add-meta">{ownedLine(owned, now)}</p>
      </Head>
      <Button variant="primary" size="large" block onClick={on.discard}>
        {words.next}
      </Button>
      <div className="add-pair">
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

// --- A barcode that isn't an ISBN -------------------------------------------------

function Other({ code, headingId, takeFocus, words, on }: Shared & { code: string }) {
  const heading = useHeadingFocus(takeFocus);
  return (
    <>
      <div className="add-lead">
        <span className="add-lead__icon">
          <BarcodeIcon size={22} />
        </span>
        <div className="add-head__text">
          <h2 ref={heading} id={headingId} tabIndex={-1} className="add-title add-title--small">
            This barcode isn't an ISBN
          </h2>
          <p className="add-meta">
            It reads <span className="tabular add-code">{code}</span>, a shop's sticker or another code. The ISBN is printed
            near the barcode or on the copyright page.
          </p>
        </div>
      </div>
      <div className="add-pair">
        <Button variant="secondary" pill block onClick={on.typeIsbn}>
          Type the ISBN
        </Button>
        <Button variant="secondary" pill block onClick={on.byHand}>
          Add by hand
        </Button>
      </div>
      <div className="add-actions">
        <Leave onClick={on.discard}>{words.discard}</Leave>
      </div>
    </>
  );
}

/** Scan mode's own ISBN field, after a non-ISBN barcode: the camera stays, paused, behind it. */
function Typing({ code, headingId, takeFocus, on }: Shared & { code: string }) {
  return (
    <>
      <div className="add-head__text">
        <h2 id={headingId} className="add-title add-title--small">
          Type the ISBN
        </h2>
        <p className="add-meta">
          The code read was <span className="tabular add-code">{code}</span>. The ISBN is printed near the barcode or
          on the copyright page.
        </p>
      </div>
      <IsbnField size="regular" onSubmit={on.submitIsbn} keepFocus={false} autoFocus={takeFocus} hint={null} />
      <div className="add-actions add-actions--split">
        <Leave onClick={on.discard}>Back to scanning</Leave>
        <Button variant="quiet" onClick={on.byHand}>
          Add by hand
        </Button>
      </div>
    </>
  );
}

// --- A failed lookup ----------------------------------------------------------------

function Failed({ message, headingId, takeFocus, words, on }: Shared & { message: string }) {
  const heading = useHeadingFocus(takeFocus);
  return (
    <>
      <div className="add-lead">
        <span className="add-lead__icon">
          <AlertIcon size={22} />
        </span>
        <div className="add-head__text">
          <h2 ref={heading} id={headingId} tabIndex={-1} className="add-title add-title--small">
            The lookup didn't work
          </h2>
          <p className="add-meta">{message}</p>
        </div>
      </div>
      <Button variant="primary" size="large" block onClick={on.retry}>
        Try again
      </Button>
      <div className="add-actions add-actions--split">
        <Leave onClick={on.discard}>{words.discard}</Leave>
        <Button variant="quiet" onClick={on.byHand}>
          Add by hand
        </Button>
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
  if (reason === "manual") return <h2 id={headingId} className="visually-hidden">Add a book by hand</h2>;
  if (reason === "edit") {
    return (
      <div className="add-head__text">
        <h2 id={headingId} className="add-title add-title--small">
          Edit details
        </h2>
        {lookup?.draft && <p className="add-source">{sourceLine(lookup.draft.source)}</p>}
      </div>
    );
  }

  let notice: ReactNode;
  let uncertain = false;
  switch (reason) {
    case "not-found": {
      const wording = notFoundWording(lookup?.tried ?? []);
      uncertain = wording.uncertain;
      const isbn = <strong className="tabular">{lookup?.isbn13}</strong>;
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
          {lookup?.draft ? `Found in ${draftSources(lookup.draft.source)}` : "Found"}, but without a title. {REST_CAN_WAIT}
        </>
      );
      break;
    case "barcode":
      notice = (
        <>
          The barcode <strong className="tabular">{step.base.details.barcode}</strong> is kept with the book.{" "}
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
    <div className="add-notice">
      <h2 id={headingId} className="visually-hidden">
        Add it by hand
      </h2>
      <p>{notice}</p>
      {uncertain && (
        <Button variant="quiet" className="add-notice__retry" onClick={onRetry}>
          Look it up again
        </Button>
      )}
    </div>
  );
}

function draftSources(source: "openlibrary" | "googlebooks" | "both"): string {
  return source === "both" ? `${SOURCE_NAMES.openlibrary} and ${SOURCE_NAMES.googlebooks}` : SOURCE_NAMES[source];
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
  const initial: FormValues = { ...step.initial, shelf: step.initial.shelf === undefined ? defaultShelf : step.initial.shelf };
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
