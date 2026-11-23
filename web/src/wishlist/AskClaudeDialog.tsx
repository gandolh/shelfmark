import { useRef, useState, type ReactNode } from "react";
import { useBooks } from "../books/store";
import { Button } from "../components/Button";
import { Dialog, DialogActions } from "../components/ui/Dialog";
import { exportLibrary } from "../export/exportLibrary";
import { useIsDesktop } from "../layout/viewport";
import { CLAUDE_PROMPT, readImportText } from "./prompt";
import type { RecommendationsState } from "./useRecommendations";

const TEXT = "text-meta leading-meta text-ink-2";
const FIELD =
  "w-full rounded-field border border-outline bg-field px-3 py-2.5 text-meta leading-meta text-ink max-md:text-input-phone";

/** One numbered step: the order is the point (the file and the prompt go to Claude before its answer comes back). */
function Step({ n, title, children }: { n: number; title: ReactNode; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[1.5rem_1fr] gap-x-3">
      <span
        aria-hidden="true"
        className="flex size-6 items-center justify-center rounded-pill bg-control text-small font-semibold text-ink-2 tabular-nums"
      >
        {n}
      </span>
      <div className="flex min-w-0 flex-col items-start gap-2">
        <h3 className="pt-0.5 text-meta leading-meta font-semibold text-ink">{title}</h3>
        {children}
      </div>
    </li>
  );
}

/**
 * Ask Claude, in three steps: download the library, copy the prompt, paste
 * (or choose) Claude's answer. Nothing leaves the device except the file the
 * owner hands Claude. Each book is looked up in Open Library before it is
 * shown; the check's progress and outcome show here and on the tab.
 */
export function AskClaudeDialog({
  recs,
  onClose,
  returnFocus,
}: {
  recs: RecommendationsState;
  onClose: () => void;
  returnFocus: () => HTMLElement | null;
}) {
  const { books } = useBooks();
  const desktop = useIsDesktop();
  const [text, setText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  const file = useRef<HTMLInputElement>(null);
  const running = recs.job?.state === "running";

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(CLAUDE_PROMPT);
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
  };

  const submit = async () => {
    const read = readImportText(text);
    if (!read.ok) {
      setMessage(read.message);
      return;
    }
    setMessage((await recs.startImport(read.picks)) ?? null);
  };

  return (
    <Dialog title="Ask Claude" returnFocus={returnFocus} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <ol className="flex flex-col gap-5">
          <Step n={1} title="Download your library">
            <p className={TEXT}>A CSV of every book, owned and wished for, to attach in Claude.</p>
            <Button
              size="compact"
              data-autofocus
              disabled={books.length === 0}
              onClick={() => void exportLibrary(books, "csv")}
            >
              Download your library
            </Button>
          </Step>
          <Step n={2} title="Copy the prompt">
            <p className={TEXT}>Send it to Claude with the file. It asks for up to 30 books you don’t have, as JSON.</p>
            <Button size="compact" onClick={() => void copyPrompt()}>
              {copy === "copied" ? "Prompt copied" : "Copy the prompt"}
            </Button>
            {copy === "failed" && (
              <>
                <p className={TEXT} role="alert">
                  The prompt could not be copied. Select it here and copy it by hand.
                </p>
                <textarea
                  aria-label="The prompt for Claude"
                  className={FIELD}
                  rows={5}
                  readOnly
                  value={CLAUDE_PROMPT}
                  onFocus={(event) => event.currentTarget.select()}
                />
              </>
            )}
          </Step>
          <Step n={3} title={<label htmlFor="import-json">Paste Claude’s answer</label>}>
            <p className={TEXT}>Each book is looked up in Open Library first; one it can’t find is never shown.</p>
            <textarea
              id="import-json"
              className={FIELD}
              rows={5}
              spellCheck={false}
              placeholder='[{ "title": …, "authors": […], "reason": … }]'
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </Step>
        </ol>
        {message && (
          <p className="text-meta leading-meta font-semibold text-ink" role="alert">
            {message}
          </p>
        )}
        <ImportProgress job={recs.job} />
        <DialogActions desktop={desktop} cancel="Close" onCancel={onClose}>
          <Button size={desktop ? "regular" : "large"} block={!desktop} onClick={() => file.current?.click()}>
            Choose a file
          </Button>
          <Button
            size={desktop ? "regular" : "large"}
            block={!desktop}
            variant="primary"
            disabled={running}
            onClick={() => void submit()}
          >
            Check and import
          </Button>
          <input
            ref={file}
            type="file"
            accept=".json,application/json,text/plain"
            hidden
            onChange={(event) => {
              const chosen = event.target.files?.[0];
              if (chosen) void chosen.text().then(setText);
              event.target.value = "";
            }}
          />
        </DialogActions>
      </div>
    </Dialog>
  );
}

function ImportProgress({ job }: { job: RecommendationsState["job"] }) {
  if (job === null || job.state === "idle") return null;
  if (job.state === "running") {
    return (
      <p className={TEXT} role="status">
        Checking {job.checked} of {job.total} in Open Library…
      </p>
    );
  }
  return (
    <div role="status" className="flex flex-col gap-2">
      <p className={TEXT}>
        Added {job.added}
        {job.dropped > 0 ? `; left out ${job.dropped} you already have, wished for or dismissed` : ""}.
      </p>
      {job.notFound.length > 0 && (
        <>
          <p className={TEXT}>Not found in Open Library, so not shown:</p>
          <ul className="list-disc pl-5 text-meta leading-meta text-ink-2">
            {job.notFound.map((pick) => (
              <li key={`${pick.title}|${pick.authors.join(",")}`}>
                {pick.title}
                {pick.authors.length > 0 ? `, ${pick.authors.join(", ")}` : ""}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
