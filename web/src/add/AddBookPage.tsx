import { cn } from "../lib/cn";
import type { Book, BookCreate, Collection } from "@shelfmark/shared";
import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { createBook, patchBook, useBooks } from "../books/store";
import { isApiError } from "../api";
import { answerFor, loadLibraryCopy } from "../offline/library";
import { queueScan, startScanQueue, takeScan, useScanQueue } from "../offline/queueStore";
import { CheckIcon } from "../components/icons";
import { Page } from "../layout/Page";
import { DESKTOP_QUERY, useIsDesktop } from "../layout/viewport";
import { Button } from "../components/Button";
import type { Zoom } from "../scanner/camera";
import {
  CameraReadout,
  CameraScanner,
  type CameraInfo,
  type ScannerHandle,
  type ScannerState,
} from "../scanner/CameraScanner";
import type { ScannedCode } from "../scanner/detector";
import { attachCover, lookupIsbn } from "./api";
import type { CoverPhoto } from "./CoverCapture";
import {
  bodyFromForm,
  bodyFromProposal,
  copyProposal,
  flowReducer,
  initialFlow,
  isSaving,
  scannerPaused,
  todayIso,
  type CoverPlan,
  type FlowState,
  type Mode,
  type Notice,
  type SavedOutcome,
} from "./flow";
import { BarcodeIcon, TorchIcon } from "./icons";
import { IsbnField, type IsbnFieldHandle } from "./IsbnField";
import { createLookupMemo } from "./memo";
import { TabsPanel, TabsRoot } from "../components/ui/Tabs";
import { Toggle } from "../components/ui/ToggleGroup";
import { ModeSwitch } from "./ModeSwitch";
import { ResultSheet, type SheetActions } from "./ResultSheet";
import { shelvesInUse } from "./shelves";
import {
  announcement,
  lookupFailure,
  noOfflineCopy,
  queuedLine,
  saveFailure,
  sessionCount,
  waitingLine,
} from "./words";

/**
 * What outlives one visit to the page, for as long as the app is open: the
 * mode last used, the session's count and the shelf last used. "Open the
 * book" and back finds them as they were.
 */
const session: { mode: Mode | null; added: number; lastShelf: string | null | undefined } = {
  mode: null,
  added: 0,
  lastShelf: undefined,
};

/** Scan on a phone; Type ISBN on a laptop, where a webcam can't focus on a barcode but a USB scanner can type. */
function startFlow(): FlowState {
  const mode = session.mode ?? (window.matchMedia(DESKTOP_QUERY).matches ? "isbn" : "scan");
  return initialFlow(mode, session);
}

/** How long "Saved …" shows before the line goes back to the count. */
const NOTICE_MS = 5000;

/**
 * Add a book: one screen, three modes (design.md). Scan fills the phone down
 * to the tab bar with the camera and floats each result over it in the white
 * sheet; Type ISBN is one large field for typing or a USB scanner; By hand is
 * the short form. Modes, results and saving are React state (flow.ts): the
 * page never navigates while the camera runs (scanning.md), and after each
 * save the scanner reads again with no extra tap.
 */
export function AddBookPage({ target = "owned" }: { target?: Collection } = {}) {
  const desktop = useIsDesktop();
  const [state, dispatch] = useReducer(flowReducer, undefined, startFlow);
  const { mode, step, notice, added } = state;
  const { books } = useBooks();
  const { items: queue } = useScanQueue();
  const shelves = useMemo(() => shelvesInUse(books), [books]);
  // The shelf used last this session, else the one the library added to last.
  const defaultShelf = state.lastShelf !== undefined ? state.lastShelf : (shelves[0] ?? null);
  const isbnField = useRef<IsbnFieldHandle>(null);
  const result = useRef<HTMLDivElement>(null);
  const saving = useRef(false);
  const [torch, setTorch] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  // 2× first: the barcode fills the viewfinder from beyond the lens's close-focus limit.
  const [zoom, setZoom] = useState<Zoom>(2);
  const [zoomAvailable, setZoomAvailable] = useState(false);
  // `?camera`: the camera's numbers over the stage. The owner types the address; nothing links to it.
  const [readout] = useState(() => new URLSearchParams(window.location.search).has("camera"));
  const [camera, setCamera] = useState<CameraInfo | null>(null);
  const [decodeMs, setDecodeMs] = useState<number | null>(null);
  // A mode chosen by pointer puts the cursor in its field; one reached with
  // the tabs' arrow keys leaves focus on the tabs, as tabs should.
  const [focusOnEnter, setFocusOnEnter] = useState(true);
  // The answers this visit has had: an ISBN again shows its answer with no request.
  const [memo] = useState(createLookupMemo);
  const scanner = useRef<ScannerHandle>(null);
  const pressButton = useRef<HTMLButtonElement>(null);
  const [scannerState, setScannerState] = useState<ScannerState>("asking");
  // What the last press of "Scan the barcode" came to: `gave-up` is a minute with nothing read.
  const [press, setPress] = useState<"idle" | "reading" | "gave-up">("idle");

  // Scans queued offline are looked up (one at a time) whenever the app is online.
  useEffect(() => startScanQueue(lookupIsbn), []);

  useEffect(() => {
    session.mode = mode;
    session.added = added;
    session.lastShelf = state.lastShelf;
  }, [mode, added, state.lastShelf]);

  // The lookup for the `looking` step, aborted when the step is left (a
  // discard, a mode switch, another ISBN); its id drops a late answer.
  const lookingId = step.kind === "looking" ? step.id : null;
  const lookingIsbn = step.kind === "looking" ? step.isbn13 : null;
  useEffect(() => {
    if (lookingId === null || lookingIsbn === null) return;
    const controller = new AbortController();
    lookupIsbn(lookingIsbn, { signal: controller.signal }).then(
      (lookup) => {
        memo.keep(lookup);
        dispatch({ type: "looked-up", id: lookingId, lookup });
      },
      async (error: unknown) => {
        if (controller.signal.aborted) return;
        // No answer from the server (offline): the device's copy of the library answers, if it has one.
        // A 4xx or a 5xx is the server answering, so it stays a failure.
        if (isApiError(error, "network")) {
          const copy = await loadLibraryCopy();
          if (controller.signal.aborted) return;
          dispatch(
            copy === null
              ? { type: "lookup-failed", id: lookingId, failure: noOfflineCopy() }
              : { type: "answered-offline", id: lookingId, answer: answerFor(copy, lookingIsbn) },
          );
          return;
        }
        dispatch({ type: "lookup-failed", id: lookingId, failure: lookupFailure(error) });
      },
    );
    return () => controller.abort();
  }, [lookingId, lookingIsbn, memo]);

  // The camera reads only on a press, and only while nothing is on the sheet:
  // a result is the owner's until they act on it. A press reads until it reads
  // a code, so the owner can bring the book in after the tap; *Stop reading*
  // ends it, and a minute with nothing read ends it for the battery.
  const canPress = mode === "scan" && step.kind === "ready" && scannerState === "scanning";
  const scan = async () => {
    if (scanner.current === null) return;
    if (press === "reading") {
      scanner.current.stop();
      return;
    }
    setPress("reading");
    let code: ScannedCode | null;
    try {
      code = await scanner.current.read();
    } catch {
      // Stopped: by the owner, a hidden page, or a move to another mode.
      setPress("idle");
      return;
    }
    setPress(code === null ? "gave-up" : "idle");
    if (code !== null)
      dispatch({ type: "scanned", code, known: code.kind === "isbn" ? memo.get(code.isbn13) : undefined });
  };
  // A result's buttons bring the scan button back; focus, lost with the sheet, goes to it.
  useEffect(() => {
    if (canPress && document.activeElement === document.body) pressButton.current?.focus({ preventScroll: true });
  }, [canPress]);

  const noticeId = notice?.id;
  useEffect(() => {
    if (noticeId === undefined) return;
    const timer = setTimeout(() => dispatch({ type: "dismiss-notice", id: noticeId }), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [noticeId]);

  // On a phone the field lets go of the keyboard on Enter; bring the answer into view.
  const answerId = mode === "isbn" && step.kind !== "ready" && step.kind !== "looking" ? step.id : null;
  useEffect(() => {
    if (answerId !== null && !desktop) result.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [answerId, desktop]);

  // The sheet is a queued scan's: saving or discarding it takes the scan out of the queue.
  const fromQueue = state.queued;

  const save = async (given: BookCreate, cover: CoverPlan, photo: CoverPhoto | null) => {
    // Opened from the Wishlist (`target`): whatever the sheet offers, the book lands in the wishlist, with no shelf.
    const body: BookCreate =
      target === "wishlist" && given.collection !== "wishlist"
        ? { ...given, collection: "wishlist", shelf: null, status: "unread" }
        : given;
    // The button waits from the next render; a double tap before then stops here.
    if (saving.current) return;
    saving.current = true;
    const scan = fromQueue;
    dispatch({ type: "save" });
    let book: Book;
    try {
      book = await createBook(body);
    } catch (error) {
      dispatch({ type: "save-failed", failure: saveFailure(error) });
      return;
    } finally {
      saving.current = false;
    }
    if (scan !== null) takeScan(scan);
    // Its ISBN is in the library now: the next lookup of it says so.
    if (book.isbn13 !== null) memo.forget(book.isbn13);
    dispatch({
      type: "saved",
      book: { id: book.id, title: book.title, shelf: book.shelf },
      outcome: body.collection === "wishlist" ? "wishlist" : undefined,
    });
    // Type ISBN: the cursor is back in the empty field, so a USB scanner goes
    // straight on to the next book. By hand: the fresh form takes it.
    isbnField.current?.reset();
    setFocusOnEnter(true);
    // In the background: the scanner is already reading the next book.
    if ((await attachCover(book.id, cover, photo?.blob ?? null)) === "failed") {
      dispatch({ type: "cover-failed", book: { id: book.id, title: book.title } });
    }
  };

  // "I bought it": the same row moves to Owned with the shelf chosen and today's date; no second row.
  const buy = async (bookId: number, shelf: string | null) => {
    if (saving.current) return;
    saving.current = true;
    const scan = fromQueue;
    dispatch({ type: "save" });
    let book: Book;
    try {
      book = await patchBook(bookId, { collection: "owned", shelf, acquiredOn: todayIso() });
    } catch (error) {
      dispatch({ type: "save-failed", failure: saveFailure(error) });
      return;
    } finally {
      saving.current = false;
    }
    if (scan !== null) takeScan(scan);
    if (book.isbn13 !== null) memo.forget(book.isbn13);
    dispatch({ type: "saved", book: { id: book.id, title: book.title, shelf: book.shelf }, outcome: "bought" });
    isbnField.current?.reset();
    setFocusOnEnter(true);
  };

  const on: SheetActions = {
    saveProposal: (proposal, shelf, status, photo) =>
      void save(bodyFromProposal(proposal, shelf, status), proposal.cover, photo),
    saveToWishlist: (proposal, photo) =>
      void save(bodyFromProposal(proposal, null, "unread", "wishlist"), proposal.cover, photo),
    buy: (bookId, shelf) => void buy(bookId, shelf),
    saveForm: (fields, base, photo) => void save(bodyFromForm(fields, base), base.cover, photo),
    discard: () => {
      if (fromQueue !== null && !isSaving(step)) takeScan(fromQueue);
      dispatch({ type: "discard" });
      isbnField.current?.reset();
    },
    edit: (shelf, status) => dispatch({ type: "edit", shelf, status }),
    anotherCopy: () => {
      if (step.kind === "owned") dispatch({ type: "another-copy", proposal: copyProposal(step.lookup, books) });
    },
    typeIsbn: () => dispatch({ type: "type-isbn" }),
    byHand: () => dispatch({ type: "by-hand" }),
    retry: () => dispatch({ type: "retry" }),
    lookLater: (isbn13, shelf) =>
      void queueScan(isbn13, shelf).then((outcome) => dispatch({ type: "queued", isbn13, outcome })),
    openQueued: (id) => {
      const item = queue.find((queued) => queued.id === id);
      if (item === undefined) return;
      // It stays queued until the sheet saves it or the owner discards it.
      dispatch({ type: "open-queued", id, isbn13: item.isbn13, lookup: item.lookup, shelf: item.shelf });
    },
    removeQueued: takeScan,
    submitIsbn: (isbn13) => dispatch({ type: "submit-isbn", isbn13, known: memo.get(isbn13) }),
  };

  const changeMode = (next: Mode, viaKeyboard = false) => {
    setTorch(false);
    setTorchAvailable(false);
    setZoom(2);
    setZoomAvailable(false);
    setPress("idle");
    setFocusOnEnter(!viaKeyboard);
    dispatch({ type: "mode", mode: next });
  };

  const switcher = <ModeSwitch overCamera={!desktop && mode === "scan"} disabled={isSaving(step)} />;
  const sessionLine =
    added > 0 || notice !== null ? (
      <SessionStatus added={added} notice={notice} desktop={desktop} overCamera={mode === "scan"} />
    ) : null;
  const waiting =
    queue.length > 0 && step.kind === "ready" ? (
      <button
        type="button"
        className={cn(
          "cursor-pointer rounded-pill border border-hairline bg-surface px-3 py-1.25 text-small leading-tight text-ink-2",
          desktop ? "ml-2" : "bg-ground/92",
        )}
        onClick={() => dispatch({ type: "show-queue" })}
      >
        {waitingLine(queue)}
      </button>
    ) : null;
  const status =
    sessionLine === null && waiting === null ? null : (
      <>
        {sessionLine}
        {waiting}
      </>
    );
  const sheet = (floating: boolean, takeFocus: boolean) =>
    step.kind === "ready" ? null : (
      <ResultSheet
        step={step}
        mode={mode}
        floating={floating}
        takeFocus={takeFocus}
        shelves={shelves}
        defaultShelf={defaultShelf}
        books={books}
        queue={queue}
        on={on}
      />
    );

  return (
    <Page
      title={target === "wishlist" ? "Add to your wishlist" : "Add a book"}
      bleed
      caption={desktop ? status : undefined}
    >
      <TabsRoot
        value={mode}
        // The arrow keys switch as they move focus, which stays on the tabs; a click (or Enter) moves it into the new form.
        onValueChange={(next: Mode, details) => changeMode(next, !(details.event instanceof MouseEvent))}
        render={
          <div
            className={cn(
              "relative flex flex-[1_0_auto] flex-col [--add-top-room:96px] [--text-isbn:22px] [--text-result-title:20px] [--text-sheet-heading:17px]",
              "md:gap-5 md:[--add-top-room:0px]",
            )}
          />
        }
      >
        {/* Scan moves focus into each result; Type ISBN keeps it in the field, so results are read out from here. */}
        <p className="sr-only" role="status">
          {announcement(state, mode !== "scan")}
        </p>
        {desktop ? (
          // Desktop: the switch heads the content column, over the field or the camera it changes.
          <div className="flex">{switcher}</div>
        ) : (
          <div
            className="flex flex-col items-center gap-2 px-gutter-phone pt-4 pb-3 data-over-camera:pointer-events-none data-over-camera:absolute data-over-camera:inset-x-0 data-over-camera:top-0 data-over-camera:bottom-auto data-over-camera:z-[calc(var(--z-index-bar)+1)] data-over-camera:[&>*]:pointer-events-auto"
            data-over-camera={mode === "scan" || undefined}
          >
            {switcher}
            {status}
          </div>
        )}
        <TabsPanel value={mode} className="flex flex-[1_0_auto] flex-col">
          {mode === "scan" && (
            <div className="relative flex-[1_0_auto] min-h-105 overflow-hidden isolate bg-ink after:content-[''] after:absolute after:inset-0 after:z-1 after:[background:radial-gradient(ellipse_at_50%_45%,transparent_55%,color-mix(in_srgb,var(--color-ink)_50%,transparent))] after:pointer-events-none md:flex-none md:h-[clamp(420px,calc(100dvh_-_260px),660px)] md:rounded-container">
              <CameraScanner
                ref={scanner}
                inStage
                paused={scannerPaused(state)}
                torch={torch}
                zoom={zoom}
                onFallback={() => changeMode("isbn")}
                onStateChange={setScannerState}
                onTorchAvailable={setTorchAvailable}
                onZoomAvailable={setZoomAvailable}
                onCamera={readout ? setCamera : undefined}
                onDecode={readout ? setDecodeMs : undefined}
              />
              {(torchAvailable || zoomAvailable) && (
                <div className="absolute top-[calc(var(--add-top-room)_-_32px)] right-3 z-2 flex flex-col gap-2 md:top-3">
                  {torchAvailable && (
                    <Toggle
                      className="flex items-center justify-center w-touch h-touch rounded-pill bg-ground/92 text-ink transition-[background-color,color] duration-(--duration-fast) ease-out aria-pressed:bg-accent-tint aria-pressed:text-accent-press"
                      pressed={torch}
                      onPressedChange={setTorch}
                      aria-label="Torch"
                    >
                      <TorchIcon size={20} on={torch} />
                    </Toggle>
                  )}
                  {zoomAvailable && (
                    <button
                      type="button"
                      className="flex items-center justify-center w-touch h-touch rounded-pill bg-ground/92 text-ink transition-[background-color,color] duration-(--duration-fast) ease-out text-small font-semibold tabular-nums"
                      aria-label={`Zoom ${zoom}×`}
                      onClick={() => setZoom((at) => (at === 2 ? 1 : 2))}
                    >
                      {zoom}×
                    </button>
                  )}
                </div>
              )}
              {readout && (
                <CameraReadout
                  className="absolute top-(--add-top-room) left-3 z-2 max-w-[min(330px,calc(100%_-_24px_-_var(--spacing-touch)_-_12px))] md:top-3"
                  camera={camera}
                  decodeMs={decodeMs}
                />
              )}
              {canPress && (
                <div className="absolute right-3 bottom-3 left-3 z-2 flex flex-col items-center gap-2.5 max-w-110 mx-auto">
                  <p
                    className="text-small leading-tight text-center data-shown:py-1.25 data-shown:px-3 data-shown:rounded-pill data-shown:bg-ground/92 data-shown:text-ink-2"
                    role="status"
                    data-shown={press === "gave-up" || undefined}
                  >
                    {press === "gave-up" ? "Nothing read for a minute. Tap “Scan the barcode” to try again." : ""}
                  </p>
                  <Button
                    ref={pressButton}
                    variant="primary"
                    size="large"
                    block
                    icon={press === "reading" ? undefined : <BarcodeIcon size={20} />}
                    onClick={() => void scan()}
                  >
                    {press === "reading" ? "Stop reading" : "Scan the barcode"}
                  </Button>
                </div>
              )}
              {sheet(true, true)}
            </div>
          )}
          {mode === "isbn" && (
            <div className="flex flex-col gap-4 pt-1 pr-gutter-phone pb-6 pl-gutter-phone md:gap-5 md:max-w-150 md:p-0">
              <IsbnField
                ref={isbnField}
                onSubmit={on.submitIsbn}
                keepFocus={desktop}
                busy={step.kind === "looking"}
                autoFocus={focusOnEnter}
              />
              <div ref={result} className="empty:hidden">
                {sheet(false, false)}
              </div>
            </div>
          )}
          {mode === "manual" && (
            <div className="flex flex-col gap-4 pt-1 pr-gutter-phone pb-6 pl-gutter-phone md:gap-5 md:max-w-150 md:p-0">
              {sheet(false, focusOnEnter)}
            </div>
          )}
        </TabsPanel>
      </TabsRoot>
    </Page>
  );
}

function savedLine(title: string, outcome: SavedOutcome | undefined): string {
  if (outcome === "wishlist") return `Added “${title}” to your wishlist`;
  if (outcome === "bought") return `Moved “${title}” to your shelf`;
  return `Saved “${title}”`;
}

/**
 * The session counter, and for a few seconds after a save what was saved.
 * Screen readers hear the same from the page's live region.
 */
function SessionStatus({
  added,
  notice,
  desktop,
  overCamera,
}: {
  added: number;
  notice: Notice | null;
  /** The desktop shows it as the page's caption, in the caption's size; the phone's is smaller. */
  desktop: boolean;
  /** Over the camera, what was just saved sits on a pill. */
  overCamera: boolean;
}) {
  const count = added > 0 ? sessionCount(added) : "";
  let text: ReactNode = count;
  if (notice?.kind === "saved") {
    text = (
      <>
        <CheckIcon size={14} />
        <span>{savedLine(notice.title, notice.outcome)}</span>
        <span>· {count}</span>
      </>
    );
  } else if (notice?.kind === "queued") {
    text = <span>{queuedLine(notice)}</span>;
  } else if (notice?.kind === "cover-failed") {
    text = <span>“{notice.title}” is saved; its cover didn't download.</span>;
  }
  return (
    <span
      className={cn(
        "inline-flex max-w-full min-w-0 items-center gap-1.25 leading-tight tabular-nums [&_svg]:flex-none [&_svg]:text-accent",
        desktop ? "text-[length:inherit]" : "text-small text-muted",
        !desktop &&
          overCamera &&
          "data-shown:rounded-pill data-shown:bg-ground/92 data-shown:px-3 data-shown:py-1.25 data-shown:text-ink-2",
      )}
      data-shown={text !== "" || undefined}
    >
      {text}
    </span>
  );
}
