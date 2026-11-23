import type { Recommendation, RecommendationSource } from "@shelfmark/shared";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { createBook } from "../books/store";
import { authorLine } from "../components/cover";
import { Button } from "../components/Button";
import { CoverImage } from "../components/CoverImage";
import { ExternalIcon, PlusIcon } from "../components/icons";
import { SegmentedControl } from "../components/SegmentedControl";
import { segmentedItem, segmentedTrack } from "../components/segmented";
import { Tab, TabsList, TabsPanel, TabsRoot } from "../components/ui/Tabs";
import { cn } from "../lib/cn";
import { AskClaudeDialog } from "./AskClaudeDialog";
import { initialTab, readTab, writeTab, type SourceTab } from "./tab";
import type { RecommendationsState } from "./useRecommendations";

const TEXT = "text-meta leading-meta text-ink-2";

const TABS: readonly { value: SourceTab; label: string }[] = [
  { value: "similar", label: "Similar books" },
  { value: "claude", label: "From Claude" },
];

/**
 * The Wishlist's recommendations, one tab per source (the owner's pick,
 * 2026-11-23): Similar books, found by Shelfmark's own model on the server,
 * and From Claude, Claude's picks imported by hand. Each tab holds its own
 * explanation, its action and its list; the tab last chosen is remembered on
 * this device. A recommendation is never a book already in the database.
 */
export function Recommendations({ recs }: { recs: RecommendationsState }) {
  const [chosen, setChosen] = useState<SourceTab | null>(readTab);
  const counts = useMemo(
    () => ({
      similar: recs.items.filter((item) => item.source === "similar").length,
      claude: recs.items.filter((item) => item.source === "claude").length,
    }),
    [recs.items],
  );
  const tab = chosen ?? initialTab(null, counts);

  return (
    <section aria-labelledby="recs-heading" className="rounded-container bg-surface p-5 max-md:p-4">
      <h2 id="recs-heading" className="font-book text-heading leading-heading font-semibold">
        Recommendations
      </h2>
      <TabsRoot
        value={tab}
        onValueChange={(next: SourceTab) => {
          setChosen(next);
          writeTab(next);
        }}
      >
        <TabsList aria-label="Where they come from" className={segmentedTrack("regular", "mt-3 max-md:flex")}>
          {TABS.map(({ value, label }) => (
            <Tab
              key={value}
              value={value}
              className={segmentedItem("regular", "max-md:flex-1")}
              data-label={`${label} ${counts[value]}`}
            >
              <span>
                {label} <span className="text-muted tabular-nums">{counts[value]}</span>
              </span>
            </Tab>
          ))}
        </TabsList>
        {TABS.map(({ value }) => (
          <TabsPanel key={value} value={value} className="outline-none">
            {value === "similar" ? (
              <SimilarHeader recs={recs} has={counts.similar > 0} />
            ) : (
              <ClaudeHeader recs={recs} />
            )}
            <SourceList recs={recs} source={value} />
          </TabsPanel>
        ))}
      </TabsRoot>
    </section>
  );
}

/** A tab's explanation, then its action with the status line beside it (under it on a phone). */
function PanelHeader({ text, status, action }: { text: string; status: ReactNode; action: ReactNode }) {
  return (
    <div className="mt-4 flex max-w-prose flex-col gap-3">
      <p className={TEXT}>{text}</p>
      <div className="flex items-center gap-x-4 gap-y-2 max-md:flex-col max-md:items-start">
        <div className="flex-none">{action}</div>
        {status}
      </div>
    </div>
  );
}

function SimilarHeader({ recs, has }: { recs: RecommendationsState; has: boolean }) {
  const [startError, setStartError] = useState<string | null>(null);
  const job = recs.refresh;
  const running = job?.state === "running";

  let status: ReactNode = null;
  if (startError) {
    status = (
      <p className="text-meta leading-meta font-semibold text-ink" role="alert">
        {startError}
      </p>
    );
  } else if (job?.state === "running") {
    const words =
      job.step === "catalog"
        ? `Asking Open Library, ${job.done} of ${job.total}…`
        : job.done === 0
          ? "Loading the model…"
          : `Comparing ${job.done} of ${job.total} books…`;
    status = (
      <p className="text-meta leading-meta text-ink" role="status">
        {words}
      </p>
    );
  } else if (job?.state === "failed") {
    status = (
      <p className="text-meta leading-meta font-semibold text-ink" role="alert">
        {job.message}
      </p>
    );
  } else if (job?.state === "done") {
    status = (
      <p className="text-meta leading-meta text-ink" role="status">
        {job.message ?? `Found ${job.added} similar ${job.added === 1 ? "book" : "books"}.`}
      </p>
    );
  }

  return (
    <PanelHeader
      text="Shelfmark’s own model compares your books with Open Library’s and keeps the closest. Only author and subject searches leave the server."
      status={status}
      action={
        <Button
          disabled={running}
          onClick={() => {
            setStartError(null);
            void recs.startRefresh().then(setStartError);
          }}
        >
          {running ? "Finding…" : has ? "Find again" : "Find similar books"}
        </Button>
      }
    />
  );
}

function ClaudeHeader({ recs }: { recs: RecommendationsState }) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const job = recs.job;

  let status: ReactNode = null;
  if (job?.state === "running") {
    status = (
      <p className="text-meta leading-meta text-ink" role="status">
        Checking {job.checked} of {job.total} in Open Library…
      </p>
    );
  } else if (job?.state === "done") {
    const missing = job.notFound.length;
    status = (
      <p className="text-meta leading-meta text-ink" role="status">
        Added {job.added}
        {missing > 0 ? `; ${missing} not found in Open Library` : ""}.
      </p>
    );
  }

  return (
    <PanelHeader
      text="Hand Claude a copy of your library and a ready prompt, then import its answer. Every book it names is checked in Open Library first."
      status={status}
      action={
        <>
          <Button ref={opener} aria-haspopup="dialog" onClick={() => setOpen(true)}>
            Ask Claude…
          </Button>
          {open && <AskClaudeDialog recs={recs} onClose={() => setOpen(false)} returnFocus={() => opener.current} />}
        </>
      }
    />
  );
}

const EMPTY: Record<RecommendationSource, string> = {
  similar:
    "No similar books yet. Find similar books compares your library with Open Library’s; the first time takes a minute or two.",
  claude: "Nothing from Claude yet. Ask Claude, paste its answer, and the books it names show here.",
  series: "",
};

function SourceList({ recs, source }: { recs: RecommendationsState; source: RecommendationSource }) {
  const [language, setLanguage] = useState("all");
  const items = useMemo(() => recs.items.filter((item) => item.source === source), [recs.items, source]);
  const languages = useMemo(
    () => [...new Set(items.map((item) => item.language).filter((code): code is string => code !== null))].sort(),
    [items],
  );
  // A language whose books are all gone (added, dismissed) stops filtering.
  const active = languages.includes(language) ? language : "all";
  const shown = items.filter((item) => active === "all" || item.language === active);

  if (recs.status === "loading") return null;
  if (recs.status === "error") {
    return (
      <p className={cn(TEXT, "mt-5 font-semibold text-ink")} role="alert">
        {recs.error}
      </p>
    );
  }
  if (items.length === 0) return <p className={cn(TEXT, "mt-5 max-w-prose")}>{EMPTY[source]}</p>;

  return (
    <>
      {languages.length > 1 && (
        <SegmentedControl
          label="Language"
          size="small"
          className="mt-4"
          value={active}
          options={[
            { value: "all", label: "All" },
            ...languages.map((code) => ({ value: code, label: code.toUpperCase() })),
          ]}
          onChange={setLanguage}
        />
      )}
      <ul className="mt-4 grid list-none grid-cols-2 gap-x-10 max-lg:grid-cols-1">
        {shown.map((item) => (
          <Row key={item.key} item={item} recs={recs} />
        ))}
      </ul>
    </>
  );
}

/** One recommendation: the cover leads; Add to wishlist is a grey button, Not interested leaves in plain ink. */
function Row({ item, recs }: { item: Recommendation; recs: RecommendationsState }) {
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

  return (
    <li className="grid grid-cols-[4rem_1fr] items-start gap-x-4 border-t border-divider py-4">
      <CoverImage
        book={{ title: item.title, authors: item.authors, language: item.language }}
        src={item.coverUrl ?? undefined}
        width={64}
        className="md:row-span-2"
      />
      <div className="flex min-w-0 flex-col">
        <h3 className="font-book text-row-title leading-row-title font-semibold text-ink">{item.title}</h3>
        <p className="mt-0.5 text-meta leading-meta text-muted">
          {authorLine(item.authors)}
          {item.year !== null && <span className="tabular-nums"> · {item.year}</span>}
          {item.language !== null && ` · ${item.language.toUpperCase()}`}
        </p>
        {item.reasons.map((reason) => (
          <p key={reason} className={cn(TEXT, "mt-1.5")}>
            {reason}
          </p>
        ))}
      </div>
      {/* Under the text on the desktop; under the cover and the text, the row's whole width, on a phone. */}
      <div className="col-start-2 mt-2.5 flex flex-wrap items-center gap-x-1 gap-y-1 max-md:col-span-2 max-md:col-start-1">
        <Button
          size="compact"
          icon={<PlusIcon size={16} />}
          className="-ml-0.5"
          disabled={adding === "saving"}
          onClick={() => void add()}
        >
          Add to wishlist
        </Button>
        <Button
          size="compact"
          variant="quiet"
          className="text-ink-2 hover:text-ink active:text-ink"
          onClick={() => void recs.dismiss(item.key)}
        >
          Not interested
        </Button>
        {item.openLibraryUrl && (
          <a
            className="ml-auto inline-flex min-h-control items-center justify-center gap-1 px-1 text-meta leading-tight text-accent hover:text-accent-press max-md:min-h-touch max-md:min-w-touch"
            href={item.openLibraryUrl}
            target="_blank"
            rel="noreferrer"
          >
            {/* On a phone the arrow alone: the row has no room for the words beside the two buttons. */}
            <span className="max-md:sr-only">Open Library</span>
            <ExternalIcon size={16} />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        )}
      </div>
      {adding === "failed" && (
        <p
          className="col-start-2 mt-1.5 text-meta leading-meta font-semibold text-ink max-md:col-span-2 max-md:col-start-1"
          role="alert"
        >
          The book did not save. Try again.
        </p>
      )}
    </li>
  );
}
