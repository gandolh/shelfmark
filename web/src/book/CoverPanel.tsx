import { buttonClass } from "../components/Button";
import type { Book } from "@shelfmark/shared";
import { useState, type ChangeEvent } from "react";
import { fetchCover, removeCover, uploadCover } from "../add/api";
import { CoverCapture } from "../add/CoverCapture";
import { ImageReadError, resizeImage } from "../add/resize";
import { saveFailure, SOURCE_NAMES } from "../add/words";
import { Button } from "../components/Button";
import { CoverImage } from "../components/CoverImage";
import { CollapsiblePanel, CollapsibleRoot, CollapsibleTrigger } from "../components/ui/Collapsible";
import type { BookLookup } from "./useLookup";

/** What a failed cover call says; the cover is unchanged when this shows. */
function coverFailure(error: unknown): string {
  return saveFailure(error).message.replace(/^Not saved/, "The cover wasn't changed");
}

/**
 * Fix the cover: replace it with a photo or a file (resized as on Add a
 * book, then stored at once), take one of the lookup's candidates, or remove
 * it. Every call ends in `coverChanged`, so the Library follows.
 */
export function CoverPanel({ book, lookup }: { book: Book; lookup: BookLookup }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const act = async (work: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setMessage(null);
    setProblem(null);
    setConfirmRemove(false);
    try {
      await work();
      setMessage(done);
    } catch (error) {
      setProblem(error instanceof ImageReadError ? error.message : coverFailure(error));
    } finally {
      setBusy(false);
    }
  };

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (file) void act(async () => uploadCover(book.id, (await resizeImage(file)).blob), "Cover replaced.");
  };

  const { state } = lookup;
  const candidates = state.kind === "done" ? (state.response.draft?.coverCandidates ?? []) : [];

  return (
    <CollapsibleRoot open={open} onOpenChange={setOpen} render={<div className="flex flex-col gap-2" />}>
      <CollapsibleTrigger render={<Button variant="secondary" size="compact" pill block />}>
        Change cover
      </CollapsibleTrigger>
      {/* aria-live outside the panel: a result is read out even after it closes. */}
      <p className="text-ink text-small font-semibold text-center empty:hidden" role="status">
        {message}
      </p>
      <CollapsiblePanel
        data-cover-panel
        className="min-w-0 rounded-container bg-surface max-md:p-4 flex flex-col items-stretch gap-3 p-3 md:p-3.5"
        aria-busy={busy || undefined}
      >
        <CoverCapture
          photo={null}
          onChange={(photo) => photo && void act(() => uploadCover(book.id, photo.blob), "Cover replaced.")}
          prompt="Take a photo of the front."
          disabled={busy}
        />
        <label
          className={buttonClass(
            { variant: "secondary", size: "compact", pill: true },
            "cursor-pointer [&:has(input:focus-visible)]:outline-2 [&:has(input:focus-visible)]:outline-focus-ring [&:has(input:focus-visible)]:outline-offset-2",
          )}
          aria-disabled={busy}
        >
          <input className="sr-only" type="file" accept="image/*" disabled={busy} onChange={chooseFile} />
          Choose a file
        </label>

        {book.isbn13 !== null && (
          <div className="flex flex-col gap-2 items-start">
            <h3 className="add-label">From the lookup</h3>
            {state.kind === "idle" && (
              <Button variant="quiet" size="compact" onClick={lookup.run} disabled={busy}>
                Look for covers
              </Button>
            )}
            {state.kind === "loading" && <p className="add-hint">Looking for covers…</p>}
            {state.kind === "failed" && <p className="add-error">{state.failure.message}</p>}
            {state.kind === "done" && candidates.length === 0 && (
              <p className="add-hint">The sources have no cover for this ISBN.</p>
            )}
            {candidates.length > 0 && (
              <ul className="flex flex-wrap gap-3 list-none">
                {candidates.map((candidate) => (
                  <li key={candidate.url}>
                    <button
                      type="button"
                      className="block rounded-cover focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-[3px] disabled:opacity-45"
                      disabled={busy}
                      aria-label={`Use this cover from ${SOURCE_NAMES[candidate.source]}`}
                      onClick={() => void act(() => fetchCover(book.id, candidate.url), "Cover replaced.")}
                    >
                      <CoverImage book={book} src={candidate.url} width={72} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {book.hasCover &&
          (confirmRemove ? (
            <div
              className="flex flex-wrap items-center gap-2 text-ink text-meta"
              role="group"
              aria-label="Remove the cover"
            >
              <span>Remove this cover?</span>
              <Button
                variant="secondary"
                size="compact"
                pill
                disabled={busy}
                onClick={() => void act(() => removeCover(book.id), "Cover removed.")}
              >
                Remove it
              </Button>
              <Button variant="quiet" size="compact" onClick={() => setConfirmRemove(false)}>
                Keep it
              </Button>
            </div>
          ) : (
            <Button
              variant="quiet"
              size="compact"
              className="add-quiet-neutral"
              disabled={busy}
              onClick={() => setConfirmRemove(true)}
            >
              Remove cover
            </Button>
          ))}
        {problem && (
          <p className="add-error" role="alert">
            {problem}
          </p>
        )}
      </CollapsiblePanel>
    </CollapsibleRoot>
  );
}
