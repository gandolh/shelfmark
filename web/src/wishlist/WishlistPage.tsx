import type { Recommendation } from "@shelfmark/shared";
import { useMemo, useRef, useState } from "react";
import { createBook, useBooks } from "../books/store";
import { authorLine } from "../components/cover";
import { Button, ButtonLink } from "../components/Button";
import { CoverImage } from "../components/CoverImage";
import { exportLibrary } from "../export/exportLibrary";
import { Page } from "../layout/Page";
import { useIsDesktop } from "../layout/viewport";
import { LibraryMessage } from "../library/LibraryStates";
import { CoversGrid } from "../library/CoversGrid";
import { NO_SELECTION } from "../library/selection";
import { ADD_TO_WISHLIST } from "../router";
import { CLAUDE_PROMPT, IMPORT_SCHEMA_EXAMPLE, readImportText } from "./prompt";
import { useRecommendations, type RecommendationsState } from "./useRecommendations";
import "./wishlist.css";

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
      <div className="wishlist">
        <section aria-labelledby="wished-heading">
          <h2 id="wished-heading" className="wishlist__heading">
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
      <h2 id="recs-heading" className="wishlist__heading">
        Recommendations
      </h2>
      <p className="wishlist__text">
        Books you do not have, picked from your library. Nothing is sent anywhere unless you download your library and
        hand it to Claude yourself.
      </p>
      <ClaudePanel recs={recs} />
      {languages.length > 1 && (
        <div className="wishlist__chips" role="group" aria-label="Language">
          {[null, ...languages].map((code) => (
            <button
              key={code ?? "all"}
              type="button"
              className="wishlist__chip"
              aria-pressed={language === code}
              onClick={() => setLanguage(code)}
            >
              {code === null ? "All" : code.toUpperCase()}
            </button>
          ))}
        </div>
      )}
      {recs.status === "error" ? (
        <p className="wishlist__text" role="alert">
          {recs.error}
        </p>
      ) : recs.status === "ready" && shown.length === 0 ? (
        <p className="wishlist__text">
          No recommendations yet. Download your library, copy the prompt for Claude, then import its answer.
        </p>
      ) : (
        <ul className="wishlist__cards">
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
    <li className="wishlist__card">
      <CoverImage
        book={{ title: item.title, authors: item.authors, language: item.language }}
        src={item.coverUrl ?? undefined}
        width={72}
      />
      <div className="wishlist__body">
        <h3 className="wishlist__title">{item.title}</h3>
        <p className="wishlist__meta">{[authorLine(item.authors), facts].filter(Boolean).join(" · ")}</p>
        {item.reasons.map((reason) => (
          <p key={reason} className="wishlist__reason">
            {reason}
          </p>
        ))}
        <div className="wishlist__actions">
          <Button size="compact" variant="primary" disabled={adding === "saving"} onClick={() => void add()}>
            Add to wishlist
          </Button>
          <Button size="compact" onClick={() => void recs.dismiss(item.key)}>
            Not interested
          </Button>
          {item.openLibraryUrl && (
            <a className="wishlist__link" href={item.openLibraryUrl} target="_blank" rel="noreferrer">
              Open Library
            </a>
          )}
        </div>
        {adding === "failed" && (
          <p className="wishlist__text" role="alert">
            The book did not save. Try again.
          </p>
        )}
      </div>
    </li>
  );
}

/** Download your library, copy the prompt, and Import (a panel, not a dialog: the Base UI dialog wrapper comes with brief 06). */
function ClaudePanel({ recs }: { recs: RecommendationsState }) {
  const { books } = useBooks();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const file = useRef<HTMLInputElement>(null);
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
    <div className="wishlist__claude">
      <div className="wishlist__actions">
        <Button size="compact" onClick={() => void exportLibrary(books, "csv")} disabled={books.length === 0}>
          Download your library
        </Button>
        <Button size="compact" onClick={() => void copy()}>
          {copied ? "Prompt copied" : "Copy the prompt"}
        </Button>
        <Button size="compact" aria-expanded={open} onClick={() => setOpen(!open)}>
          Import
        </Button>
      </div>
      {open && (
        <div className="wishlist__import">
          <p className="wishlist__text">
            Attach the downloaded file to Claude with the prompt, then paste its answer here, or choose a file. Each
            book is looked up in Open Library first; one it cannot find is never shown. The shape:
          </p>
          <pre className="wishlist__schema">{IMPORT_SCHEMA_EXAMPLE}</pre>
          <label className="wishlist__label" htmlFor="import-json">
            Claude’s answer (JSON)
          </label>
          <textarea
            id="import-json"
            className="wishlist__textarea"
            rows={6}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <div className="wishlist__actions">
            <Button size="compact" variant="primary" disabled={running} onClick={() => void submit()}>
              Check and import
            </Button>
            <Button size="compact" onClick={() => file.current?.click()}>
              Choose a file
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
          </div>
          {message && (
            <p className="wishlist__text" role="alert">
              {message}
            </p>
          )}
          <ImportProgress job={recs.job} />
        </div>
      )}
    </div>
  );
}

function ImportProgress({ job }: { job: RecommendationsState["job"] }) {
  if (job === null || job.state === "idle") return null;
  if (job.state === "running") {
    return (
      <p className="wishlist__text" role="status">
        Checking {job.checked} of {job.total} in Open Library…
      </p>
    );
  }
  return (
    <div role="status">
      <p className="wishlist__text">
        Added {job.added}
        {job.dropped > 0 ? `; left out ${job.dropped} you already have, wished for or dismissed` : ""}.
      </p>
      {job.notFound.length > 0 && (
        <>
          <p className="wishlist__text">Not found in Open Library, so not shown:</p>
          <ul className="wishlist__notfound">
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
