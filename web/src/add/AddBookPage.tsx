import { Tabs } from "@base-ui/react/tabs";
import type { Book, BookCreate } from "@shelfmark/shared";
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
import { CameraReadout, CameraScanner, type CameraInfo, type ScannerHandle, type ScannerState } from "../scanner/CameraScanner";
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
import { ModeSwitch } from "./ModeSwitch";
import { ResultSheet, type SheetActions } from "./ResultSheet";
import { shelvesInUse } from "./shelves";
import { announcement, lookupFailure, noOfflineCopy, queuedLine, saveFailure, sessionCount, waitingLine } from "./words";
import "./add.css";

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
export function AddBookPage() {
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
    if (code !== null) dispatch({ type: "scanned", code, known: code.kind === "isbn" ? memo.get(code.isbn13) : undefined });
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

  const save = async (body: BookCreate, cover: CoverPlan, photo: CoverPhoto | null) => {
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
    dispatch({ type: "saved", book: { id: book.id, title: book.title, shelf: book.shelf }, outcome: body.collection === "wishlist" ? "wishlist" : undefined });
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
    saveProposal: (proposal, shelf, status, photo) => void save(bodyFromProposal(proposal, shelf, status), proposal.cover, photo),
    saveToWishlist: (proposal, photo) => void save(bodyFromProposal(proposal, null, "unread", "wishlist"), proposal.cover, photo),
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
    lookLater: (isbn13, shelf) => void queueScan(isbn13, shelf).then((outcome) => dispatch({ type: "queued", isbn13, outcome })),
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
  const sessionLine = added > 0 || notice !== null ? <SessionStatus added={added} notice={notice} /> : null;
  const waiting =
    queue.length > 0 && step.kind === "ready" ? (
      <button type="button" className="add-waiting" onClick={() => dispatch({ type: "show-queue" })}>
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
    <Page title="Add a book" bleed caption={desktop ? status : undefined}>
      <Tabs.Root
        value={mode}
        // The arrow keys switch as they move focus, which stays on the tabs; a click (or Enter) moves it into the new form.
        onValueChange={(next: Mode, details) => changeMode(next, !(details.event instanceof MouseEvent))}
        render={<div className={`add add--${mode}`} />}
      >
        {/* Scan moves focus into each result; Type ISBN keeps it in the field, so results are read out from here. */}
        <p className="visually-hidden" role="status">
          {announcement(state, mode !== "scan")}
        </p>
        {desktop ? (
          // Desktop: the switch heads the content column, over the field or the camera it changes.
          <div className="add-modes-row">{switcher}</div>
        ) : (
          <div className="add-top" data-over-camera={mode === "scan" || undefined}>
            {switcher}
            {status}
          </div>
        )}
        <Tabs.Panel value={mode} className="add__panel">
          {mode === "scan" && (
            <div className="add-stage">
              <CameraScanner
                ref={scanner}
                className="add-camera"
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
                <div className="add-controls">
                  {torchAvailable && (
                    <button
                      type="button"
                      className="add-control add-torch"
                      aria-pressed={torch}
                      aria-label="Torch"
                      onClick={() => setTorch((lit) => !lit)}
                    >
                      <TorchIcon size={20} on={torch} />
                    </button>
                  )}
                  {zoomAvailable && (
                    <button
                      type="button"
                      className="add-control add-zoom"
                      aria-label={`Zoom ${zoom}×`}
                      onClick={() => setZoom((at) => (at === 2 ? 1 : 2))}
                    >
                      {zoom}×
                    </button>
                  )}
                </div>
              )}
              {readout && <CameraReadout className="add-readout" camera={camera} decodeMs={decodeMs} />}
              {canPress && (
                <div className="add-press">
                  <p className="add-press__note" role="status" data-shown={press === "gave-up" || undefined}>
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
            <div className="add-column">
              <IsbnField
                ref={isbnField}
                onSubmit={on.submitIsbn}
                keepFocus={desktop}
                busy={step.kind === "looking"}
                autoFocus={focusOnEnter}
              />
              <div ref={result} className="add-column__result">
                {sheet(false, false)}
              </div>
            </div>
          )}
          {mode === "manual" && <div className="add-column">{sheet(false, focusOnEnter)}</div>}
        </Tabs.Panel>
      </Tabs.Root>
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
function SessionStatus({ added, notice }: { added: number; notice: Notice | null }) {
  const count = added > 0 ? sessionCount(added) : "";
  let text: ReactNode = count;
  if (notice?.kind === "saved") {
    text = (
      <>
        <CheckIcon size={14} />
        <span className="add-sessionLine_title">{savedLine(notice.title, notice.outcome)}</span>
        <span className="add-sessionLine_count">· {count}</span>
      </>
    );
  } else if (notice?.kind === "queued") {
    text = <span className="add-sessionLine_title">{queuedLine(notice)}</span>;
  } else if (notice?.kind === "cover-failed") {
    text = <span className="add-sessionLine_title">“{notice.title}” is saved; its cover didn't download.</span>;
  }
  return (
    <span className="add-session" data-shown={text !== "" || undefined}>
      {text}
    </span>
  );
}
