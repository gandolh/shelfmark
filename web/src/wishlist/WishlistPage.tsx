import type { Recommendation } from "@shelfmark/shared";
import { useMemo, useRef, useState } from "react";
import { createBook, useBooks } from "../books/store";
import { authorLine } from "../components/cover";
import { Button, ButtonLink } from "../components/Button";
import { CoverImage } from "../components/CoverImage";
import { Dialog, DialogActions } from "../components/ui/Dialog";
import { exportLibrary } from "../export/exportLibrary";
import { Page } from "../layout/Page";
import { useIsDesktop } from "../layout/viewport";
import { LibraryMessage } from "../library/LibraryStates";
import { CoversGrid } from "../library/CoversGrid";
import { NO_SELECTION } from "../library/selection";
import { ADD_TO_WISHLIST } from "../router";
import { CLAUDE_PROMPT, IMPORT_SCHEMA_EXAMPLE, readImportText } from "./prompt";
import { useRecommendations, type RecommendationsState } from "./useRecommendations";

const noop = () => undefined;

/**
 * Wishlist, the third place (decisions.md, 2026-11-10): the books wished for,
 * then the recommendations. A recommendation is never a book already in the
 * database, in either collection or dismissed (server/src/recommend/dedup.ts).
 */
export function WishlistPage() {
  const desktop = useIsDesktop();
  const { books, status } = useBooks();
  const wished = useMemo(() => books.filter((book) => book.collection === "wishlist"), [books]);
  const recs = useRecommendations();

  return (
    <Page
      title="Wishlist"
      caption={status === "ready" ? `${wished.length.toLocaleString("en-GB")} wished for` : undefined}
      toolbar={
        <ButtonLink to={ADD_TO_WISHLIST} variant="primary" size={desktop ? "regular" : "large"}>
          Add a book
        </ButtonLink>
      }
      card
    >
      <div className="flex flex-col gap-8">
        <section aria-labelledby="wished-heading">
          <h2 id="wished-heading" className="mb-3 text-row-title font-semibold">
            Wished for
          </h2>
          {status === "loading" ? null : wished.length === 0 ? (
            <LibraryMessage
              title="Your wishlist is empty"
              action={
                <ButtonLink to={ADD_TO_WISHLIST} variant="primary" size={desktop ? "regular" : "large"}>
                  Add a book
                </ButtonLink>
              }
            >
              Add a book you hear about, or one of the recommendations below. “I bought it” on a book moves it to your
              library.
            </LibraryMessage>
          ) : (
            <CoversGrid
              rows={wished}
              pageStart={0}
              total={wished.length}
              layout={desktop ? "desktop" : "phone"}
              selecting={false}
              selection={NO_SELECTION}
              onPress={noop}
              onToggle={noop}
            />
          )}
        </section>
        <Recommendations recs={recs} />
      </div>
    </Page>
  );
}

function Recommendations({ recs }: { recs: RecommendationsState }) {
  const [language, setLanguage] = useState<string | null>(null);
  const languages = useMemo(
    () => [...new Set(recs.items.map((item) => item.language).filter((code): code is string => code !== null))].sort(),
    [recs.items],
  );
  // A chip whose books are all gone (added, dismissed) stops filtering.
  const shown = recs.items.filter(
    (item) => language === null || item.language === language || !languages.includes(language),
  );

  return (
    <section aria-labelledby="recs-heading" className="wishlist__recs">
      <h2 id="recs-heading" className="mb-3 text-row-title font-semibold">
        Recommendations
      </h2>
      <p className="mb-3 text-ink-2 text-meta leading-body">
        Books you do not have, picked from your library. Nothing is sent anywhere unless you download your library and
        hand it to Claude yourself.
      </p>
      <ClaudePanel recs={recs} />
      {languages.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Language">
          {[null, ...languages].map((code) => (
            <button
              key={code ?? "all"}
              type="button"
              className="min-h-segment px-3.5 rounded-pill bg-control text-ink-2 text-small cursor-pointer aria-pressed:bg-accent-tint aria-pressed:text-accent-press aria-pressed:font-semibold"
              aria-pressed={language === code}
              onClick={() => setLanguage(code)}
            >
              {code === null ? "All" : code.toUpperCase()}
            </button>
          ))}
        </div>
      )}
      {recs.status === "error" ? (
        <p className="mb-3 text-ink-2 text-meta leading-body" role="alert">
          {recs.error}
        </p>
      ) : recs.status === "ready" && shown.length === 0 ? (
        <p className="mb-3 text-ink-2 text-meta leading-body">
          No recommendations yet. Download your library, copy the prompt for Claude, then import its answer.
        </p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-y-4 gap-x-6 list-none max-md:grid-cols-[1fr]">
          {shown.map((item) => (
            <Card key={item.key} item={item} recs={recs} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Card({ item, recs }: { item: Recommendation; recs: RecommendationsState }) {
  const [adding, setAdding] = useState<"idle" | "saving" | "failed">("idle");

  const add = async () => {
    setAdding("saving");
    try {
      await createBook({
        title: item.title,
        authors: [...item.authors],
        collection: "wishlist",
        shelf: null,
        status: "unread",
        ...(item.isbn13 ? { isbn13: item.isbn13 } : {}),
        ...(item.year ? { publishedYear: item.year } : {}),
        ...(item.language ? { language: item.language } : {}),
        metadataSource: "openlibrary",
      });
      // The server leaves a book it now holds out of the list.
      await recs.reload();
    } catch {
      setAdding("failed");
    }
  };

  const facts = [item.year, item.language?.toUpperCase()].filter(Boolean).join(" · ");
  return (
    <li className="flex items-start gap-3.5">
      <CoverImage
        book={{ title: item.title, authors: item.authors, language: item.language }}
        src={item.coverUrl ?? undefined}
        width={72}
      />
      <div className="min-w-0">
        <h3 className="text-body font-semibold">{item.title}</h3>
        <p className="mt-0.5 mb-1.5 text-muted text-small">
          {[authorLine(item.authors), facts].filter(Boolean).join(" · ")}
        </p>
        {item.reasons.map((reason) => (
          <p key={reason} className="mb-2 text-ink-2 text-meta leading-body">
            {reason}
          </p>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <Button size="compact" variant="primary" disabled={adding === "saving"} onClick={() => void add()}>
            Add to wishlist
          </Button>
          <Button size="compact" onClick={() => void recs.dismiss(item.key)}>
            Not interested
          </Button>
          {item.openLibraryUrl && (
            <a className="text-accent text-meta" href={item.openLibraryUrl} target="_blank" rel="noreferrer">
              Open Library
            </a>
          )}
        </div>
        {adding === "failed" && (
          <p className="mb-3 text-ink-2 text-meta leading-body" role="alert">
            The book did not save. Try again.
          </p>
        )}
      </div>
    </li>
  );
}

/** Download your library, copy the prompt, and Import (a dialog: paste Claude's answer or choose a file). */
function ClaudePanel({ recs }: { recs: RecommendationsState }) {
  const { books } = useBooks();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const importButton = useRef<HTMLButtonElement>(null);
  const desktop = useIsDesktop();
  const running = recs.job?.state === "running";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CLAUDE_PROMPT);
      setCopied(true);
    } catch {
      setMessage("The prompt could not be copied. Select it below and copy it by hand.");
      setOpen(true);
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
    <div className="mb-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="compact" onClick={() => void exportLibrary(books, "csv")} disabled={books.length === 0}>
          Download your library
        </Button>
        <Button size="compact" onClick={() => void copy()}>
          {copied ? "Prompt copied" : "Copy the prompt"}
        </Button>
        <Button ref={importButton} size="compact" aria-haspopup="dialog" onClick={() => setOpen(true)}>
          Import
        </Button>
      </div>
      {open && (
        <Dialog title="Import from Claude" returnFocus={() => importButton.current} onClose={() => setOpen(false)}>
          <div className="flex flex-col gap-4">
            <p className="mb-3 text-ink-2 text-meta leading-body">
              Attach the downloaded file to Claude with the prompt, then paste its answer here, or choose a file. Each
              book is looked up in Open Library first; one it cannot find is never shown. The shape:
            </p>
            <pre className="py-2.5 px-3 overflow-x-auto rounded-control bg-ground text-small">
              {IMPORT_SCHEMA_EXAMPLE}
            </pre>
            <label className="text-label font-semibold" htmlFor="import-json">
              Claude’s answer (JSON)
            </label>
            <textarea
              id="import-json"
              className="w-full py-2.5 px-3 border border-hairline rounded-field bg-surface text-ink text-meta"
              rows={6}
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
            <DialogActions desktop={desktop} cancel="Close" onCancel={() => setOpen(false)}>
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
            {message && (
              <p className="mb-3 text-ink-2 text-meta leading-body" role="alert">
                {message}
              </p>
            )}
            <ImportProgress job={recs.job} />
          </div>
        </Dialog>
      )}
    </div>
  );
}

function ImportProgress({ job }: { job: RecommendationsState["job"] }) {
  if (job === null || job.state === "idle") return null;
  if (job.state === "running") {
    return (
      <p className="mb-3 text-ink-2 text-meta leading-body" role="status">
        Checking {job.checked} of {job.total} in Open Library…
      </p>
    );
  }
  return (
    <div role="status">
      <p className="mb-3 text-ink-2 text-meta leading-body">
        Added {job.added}
        {job.dropped > 0 ? `; left out ${job.dropped} you already have, wished for or dismissed` : ""}.
      </p>
      {job.notFound.length > 0 && (
        <>
          <p className="mb-3 text-ink-2 text-meta leading-body">Not found in Open Library, so not shown:</p>
          <ul className="pl-5 text-ink-2 text-meta">
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
