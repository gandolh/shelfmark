import type { Book, BookCreate } from "@shelfmark/shared";
import { useEffect, useId, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { createBook, useBooks } from "../books/store";
import { CheckIcon } from "../components/icons";
import { Page } from "../layout/Page";
import { DESKTOP_QUERY, useIsDesktop } from "../layout/viewport";
import { CameraScanner } from "../scanner/CameraScanner";
import { attachCover, lookupIsbn } from "./api";
import type { CoverPhoto } from "./CoverCapture";
import {
  bodyFromForm,
  bodyFromProposal,
  copyProposal,
  flowReducer,
  initialFlow,
  scannerPaused,
  type CoverPlan,
  type FlowState,
  type Mode,
  type Notice,
} from "./flow";
import { TorchIcon } from "./icons";
import { IsbnField, type IsbnFieldHandle } from "./IsbnField";
import { ModeSwitch, modeTabId } from "./ModeSwitch";
import { ResultSheet, type SheetActions } from "./ResultSheet";
import { shelvesInUse } from "./shelves";
import { announcement, lookupFailure, saveFailure, sessionCount } from "./words";
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
  const shelves = useMemo(() => shelvesInUse(books), [books]);
  // The shelf used last this session, else the one the library added to last.
  const defaultShelf = state.lastShelf !== undefined ? state.lastShelf : (shelves[0] ?? null);
  const panelId = useId();
  const isbnField = useRef<IsbnFieldHandle>(null);
  const result = useRef<HTMLDivElement>(null);
  const saving = useRef(false);
  const [torch, setTorch] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  // A mode chosen by pointer puts the cursor in its field; one reached with
  // the tabs' arrow keys leaves focus on the tabs, as tabs should.
  const [focusOnEnter, setFocusOnEnter] = useState(true);

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
      (lookup) => dispatch({ type: "looked-up", id: lookingId, lookup }),
      (error: unknown) => {
        if (!controller.signal.aborted) dispatch({ type: "lookup-failed", id: lookingId, failure: lookupFailure(error) });
      },
    );
    return () => controller.abort();
  }, [lookingId, lookingIsbn]);

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

  const save = async (body: BookCreate, cover: CoverPlan, photo: CoverPhoto | null) => {
    // The button waits from the next render; a double tap before then stops here.
    if (saving.current) return;
    saving.current = true;
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
    dispatch({ type: "saved", book: { id: book.id, title: book.title, shelf: book.shelf } });
    // Type ISBN: the cursor is back in the empty field, so a USB scanner goes
    // straight on to the next book. By hand: the fresh form takes it.
    isbnField.current?.reset();
    setFocusOnEnter(true);
    // In the background: the scanner is already reading the next book.
    if ((await attachCover(book.id, cover, photo?.blob ?? null)) === "failed") {
      dispatch({ type: "cover-failed", book: { id: book.id, title: book.title } });
    }
  };

  const on: SheetActions = {
    saveProposal: (proposal, shelf, status, photo) => void save(bodyFromProposal(proposal, shelf, status), proposal.cover, photo),
    saveForm: (fields, base, photo) => void save(bodyFromForm(fields, base), base.cover, photo),
    discard: () => {
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
    submitIsbn: (isbn13) => dispatch({ type: "submit-isbn", isbn13 }),
  };

  const changeMode = (next: Mode, viaKeyboard = false) => {
    setTorch(false);
    setTorchAvailable(false);
    setFocusOnEnter(!viaKeyboard);
    dispatch({ type: "mode", mode: next });
  };

  const switcher = <ModeSwitch value={mode} onChange={changeMode} panelId={panelId} overCamera={!desktop && mode === "scan"} />;
  const status = added > 0 || notice !== null ? <SessionStatus added={added} notice={notice} /> : null;
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
        on={on}
      />
    );

  return (
    <Page title="Add a book" bleed caption={desktop ? status : undefined} toolbar={desktop ? switcher : undefined}>
      <div className={`add add--${mode}`}>
        {/* Scan moves focus into each result; Type ISBN keeps it in the field, so results are read out from here. */}
        <p className="visually-hidden" role="status">
          {announcement(state, mode !== "scan")}
        </p>
        {!desktop && (
          <div className="add-top" data-over-camera={mode === "scan" || undefined}>
            {switcher}
            {status}
          </div>
        )}
        <div role="tabpanel" id={panelId} aria-labelledby={modeTabId(panelId, mode)} className="add__panel">
          {mode === "scan" && (
            <div className="add-stage">
              <CameraScanner
                className="add-camera"
                paused={scannerPaused(state)}
                torch={torch}
                onCode={(code) => dispatch({ type: "scanned", code })}
                onFallback={() => changeMode("isbn")}
                onTorchAvailable={setTorchAvailable}
              />
              {torchAvailable && (
                <button
                  type="button"
                  className="add-torch"
                  aria-pressed={torch}
                  aria-label="Torch"
                  onClick={() => setTorch((lit) => !lit)}
                >
                  <TorchIcon size={20} on={torch} />
                </button>
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
        </div>
      </div>
    </Page>
  );
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
        <span className="add-session__title">Saved “{notice.title}”</span>
        <span className="add-session__count">· {count}</span>
      </>
    );
  } else if (notice?.kind === "cover-failed") {
    text = <span className="add-session__title">“{notice.title}” is saved; its cover didn't download.</span>;
  }
  return (
    <span className="add-session" data-shown={text !== "" || undefined}>
      {text}
    </span>
  );
}
