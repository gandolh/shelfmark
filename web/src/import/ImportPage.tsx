import { cn } from "../lib/cn";
import type { Collection } from "@shelfmark/shared";
import { useMemo, useRef, useState } from "react";
import { lookupIsbn } from "../add/api";
import { createBook, useBooks } from "../books/store";
import { Button, ButtonLink } from "../components/Button";
import { SegmentedControl } from "../components/SegmentedControl";
import { Page } from "../layout/Page";
import { LIBRARY } from "../router";
import { decodeCsv, parseCsv, type Encoding } from "./csv";
import { guessMapping, IMPORT_FIELDS, isUsable, type ImportFormat, type ImportFieldId, type Mapping } from "./fields";
import {
  buildRows,
  flagRows,
  hasTitle,
  isDuplicate,
  lookupTargets,
  runLookups,
  saveRows,
  tickedByDefault,
  type ImportRow,
  type RowFlag,
  type SaveReport,
} from "./rows";

/** A home library is hundreds to a few thousand books; a bigger file is the wrong file. */
const MAX_ROWS = 5000;

const FLAG_TEXT: Record<RowFlag, string> = {
  "in-library": "Already in your library",
  "in-file": "Repeated in this file",
  "invalid-isbn": "Invalid ISBN",
  "needs-lookup": "Needs a lookup",
  "not-found": "Not found",
  "lookup-failed": "Lookup failed",
  empty: "No title or ISBN",
};

type Step =
  | { kind: "choose"; error?: string }
  | { kind: "map"; file: Loaded }
  | { kind: "preview"; file: Loaded }
  | { kind: "done"; report: SaveReport; skippedDuplicates: number; leftOut: number; collection: Collection };

interface Loaded {
  name: string;
  encoding: Encoding;
  format: ImportFormat | null;
  table: string[][];
  mapping: Mapping;
}

const ENCODING_NOTE: Record<Encoding, string> = {
  "UTF-8": "Read as UTF-8.",
  "UTF-16": "Read as UTF-16.",
  "windows-1250": "Not UTF-8, so read as windows-1250 (Central European). Check the accents below.",
  "windows-1252": "Not UTF-8, so read as windows-1252 (Western European). Check the accents below.",
};

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Import a CSV: reached from the account menu, not a place of its
 * own. Choose the file, map its columns when it isn't a known export, look at
 * the rows with their flags, optionally look up the ones with only an ISBN,
 * then save the ticked ones into Owned or Wishlist.
 */
export function ImportPage() {
  const [step, setStep] = useState<Step>({ kind: "choose" });
  return (
    <Page title="Import a CSV" back={{ to: LIBRARY, label: "Library" }}>
      <div className="flex flex-col gap-4 max-w-page">
        {step.kind === "choose" && (
          <ChooseFile
            error={step.error}
            onLoaded={(file) => setStep({ kind: file.format ? "preview" : "map", file })}
            onError={(error) => setStep({ kind: "choose", error })}
          />
        )}
        {step.kind === "map" && (
          <MapColumns
            file={step.file}
            onBack={() => setStep({ kind: "choose" })}
            onContinue={(mapping) => setStep({ kind: "preview", file: { ...step.file, mapping } })}
          />
        )}
        {step.kind === "preview" && (
          <Preview
            file={step.file}
            onChangeColumns={() => setStep({ kind: "map", file: step.file })}
            onStartOver={() => setStep({ kind: "choose" })}
            onDone={(done) => setStep({ kind: "done", ...done })}
          />
        )}
        {step.kind === "done" && <Done {...step} onAgain={() => setStep({ kind: "choose" })} />}
      </div>
    </Page>
  );
}

// --- Step 1: the file -----------------------------------------------------------

function ChooseFile({
  error,
  onLoaded,
  onError,
}: {
  error?: string;
  onLoaded: (file: Loaded) => void;
  onError: (message: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);

  const read = async (file: File) => {
    const { text, encoding } = decodeCsv(new Uint8Array(await file.arrayBuffer()));
    const table = parseCsv(text);
    const header = table[0];
    if (!header || table.length < 2) return onError("That file has no rows under its header line. Is it a CSV?");
    if (table.length - 1 > MAX_ROWS)
      return onError(`That file has more than ${MAX_ROWS} rows. Split it and import the parts.`);
    const { format, mapping } = guessMapping(header);
    onLoaded({ name: file.name, encoding, format, table, mapping });
  };

  return (
    <section className="flex flex-col items-start gap-3 p-5 bg-surface rounded-container">
      <h2 className="text-row-title font-semibold">Choose a CSV file</h2>
      <p className="text-ink-2 text-meta leading-body">
        A Goodreads, Libib or LibraryThing export, a Shelfmark export, or a spreadsheet saved as CSV. A file with only a
        column of ISBNs works: the details can be looked up afterwards.
      </p>
      <input
        ref={input}
        className="sr-only"
        type="file"
        accept=".csv,.txt,text/csv,text/plain"
        aria-label="CSV file"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) read(file).catch(() => onError("That file couldn't be read."));
        }}
      />
      <Button variant="primary" onClick={() => input.current?.click()}>
        Choose a file
      </Button>
      {error && (
        <p className="text-ink text-meta font-semibold" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

// --- Step 2: the columns --------------------------------------------------------

function MapColumns({
  file,
  onBack,
  onContinue,
}: {
  file: Loaded;
  onBack: () => void;
  onContinue: (mapping: Mapping) => void;
}) {
  const [mapping, setMapping] = useState<Mapping>(file.mapping);
  const header = file.table[0] ?? [];
  const usable = isUsable(mapping);

  return (
    <section className="flex flex-col items-start gap-3 p-5 bg-surface rounded-container">
      <h2 className="text-row-title font-semibold">Match the columns</h2>
      <p className="text-ink-2 text-meta leading-body">
        {file.format ? `This looks like a ${file.format.name} export.` : "This isn't an export Shelfmark knows."} Say
        what each column holds. One with a title or an ISBN is needed.
      </p>
      <ul className="flex flex-col self-stretch list-none">
        {header.map((name, column) => {
          const samples = file.table
            .slice(1, 4)
            .map((row) => row[column] ?? "")
            .filter((cell) => cell !== "");
          return (
            <li
              key={column}
              className="flex flex-wrap items-center justify-between gap-y-2 gap-x-4 py-2.5 border-t border-divider"
            >
              <div className="flex flex-col min-w-0 max-w-full">
                <span className="text-body font-semibold">{name || `Column ${column + 1}`}</span>
                <span className="overflow-hidden max-w-105 text-muted text-small text-ellipsis whitespace-nowrap">
                  {samples.join(" · ") || "empty"}
                </span>
              </div>
              <select
                className="min-h-control px-2.5 bg-field rounded-control text-ink text-meta max-md:min-h-touch max-md:text-input-phone"
                aria-label={`What column ${name || column + 1} holds`}
                value={mapping[column] ?? ""}
                onChange={(event) => {
                  const value = (event.currentTarget.value || null) as ImportFieldId | null;
                  setMapping((current) => current.map((field, i) => (i === column ? value : field)));
                }}
              >
                <option value="">Don't import</option>
                {IMPORT_FIELDS.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.label}
                  </option>
                ))}
              </select>
            </li>
          );
        })}
      </ul>
      {!usable && <p className="text-ink text-meta font-semibold">Pick a Title or an ISBN column to go on.</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" disabled={!usable} onClick={() => onContinue(mapping)}>
          Preview the rows
        </Button>
        <Button variant="quiet" onClick={onBack}>
          Choose another file
        </Button>
      </div>
    </section>
  );
}

// --- Step 3: the preview --------------------------------------------------------

type Progress =
  { kind: "idle" } | { kind: "looking"; done: number; total: number } | { kind: "saving"; done: number; total: number };

function Preview({
  file,
  onChangeColumns,
  onStartOver,
  onDone,
}: {
  file: Loaded;
  onChangeColumns: () => void;
  onStartOver: () => void;
  onDone: (done: { report: SaveReport; skippedDuplicates: number; leftOut: number; collection: Collection }) => void;
}) {
  const { books, status } = useBooks();
  const [rows, setRows] = useState<ImportRow[]>(() => buildRows(file.table, file.mapping));
  const [collection, setCollection] = useState<Collection>("owned");
  const flags = useMemo(() => flagRows(rows, books, collection), [rows, books, collection]);
  // Ticks are the owner's; until one is touched they follow the flags (duplicates off, the rest on).
  const [touched, setTouched] = useState<Map<number, boolean>>(new Map());
  const [progress, setProgress] = useState<Progress>({ kind: "idle" });
  const [lookupNote, setLookupNote] = useState("");
  const stop = useRef<AbortController | null>(null);

  const ticked = useMemo(
    () =>
      new Set(rows.flatMap((_, index) => ((touched.get(index) ?? tickedByDefault(flags[index] ?? [])) ? [index] : []))),
    [rows, flags, touched],
  );
  const targets = lookupTargets(rows, ticked);
  const saveable = [...ticked].filter((index) => rows[index] && hasTitle(rows[index]));
  const busy = progress.kind !== "idle";
  const ready = status === "ready";

  const setTick = (index: number, on: boolean) => setTouched((current) => new Map(current).set(index, on));
  const setAll = (on: boolean) => setTouched(new Map(rows.map((_, index) => [index, on])));

  const look = async () => {
    const controller = new AbortController();
    stop.current = controller;
    setLookupNote("");
    setProgress({ kind: "looking", done: 0, total: targets.length });
    let done = 0;
    const run = await runLookups(
      rows,
      targets,
      (isbn, signal) => lookupIsbn(isbn, { signal }),
      controller.signal,
      (index, row) => {
        done++;
        setRows((current) => current.map((existing, i) => (i === index ? row : existing)));
        setProgress({ kind: "looking", done, total: targets.length });
      },
    );
    stop.current = null;
    setProgress({ kind: "idle" });
    if (run.stoppedBy === "signal") setLookupNote(`Stopped after ${plural(run.done, "row", "rows")}.`);
    else if (run.stoppedBy === "error")
      setLookupNote("The lookups stopped: the server can't be reached. Try again in a moment.");
  };

  const save = async () => {
    const chosen = saveable.map((index) => rows[index]).filter((row): row is ImportRow => row !== undefined);
    setProgress({ kind: "saving", done: 0, total: chosen.length });
    const report = await saveRows(chosen, collection, createBook, (done) =>
      setProgress({ kind: "saving", done, total: chosen.length }),
    );
    const unsaved = rows.map((_, index) => index).filter((index) => !saveable.includes(index));
    const skippedDuplicates = unsaved.filter((index) => isDuplicate(flags[index] ?? [])).length;
    onDone({ report, skippedDuplicates, leftOut: unsaved.length - skippedDuplicates, collection });
  };

  const counts = {
    duplicates: flags.filter(isDuplicate).length,
    invalid: flags.filter((f) => f.includes("invalid-isbn")).length,
  };

  return (
    <section className="flex flex-col items-start gap-3 p-5 bg-surface rounded-container">
      <h2 className="text-row-title font-semibold">
        {plural(rows.length, "row", "rows")} in {file.name}
      </h2>
      <p className="text-ink-2 text-meta leading-body">
        {ENCODING_NOTE[file.encoding]}{" "}
        {file.format ? `Recognised as a ${file.format.name} export.` : "Columns matched by hand."}{" "}
        <button
          type="button"
          className="text-accent cursor-pointer hover:[&:not(:disabled)]:text-accent-press hover:[&:not(:disabled)]:underline disabled:text-muted disabled:cursor-default"
          onClick={onChangeColumns}
          disabled={busy}
        >
          Change columns
        </button>
      </p>
      <p className="text-ink-2 text-meta leading-body">
        {plural(counts.duplicates, "row is", "rows are")} already in your library or repeated,{" "}
        {plural(counts.invalid, "has an", "have an")} invalid ISBN. Both are unticked.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          label="Save into"
          options={[
            { value: "owned", label: "Owned" },
            { value: "wishlist", label: "Wishlist" },
          ]}
          value={collection}
          onChange={(value) => {
            setCollection(value);
            setTouched(new Map());
          }}
        />
        <span className="text-ink-2 text-meta leading-body">
          <button
            type="button"
            className="text-accent cursor-pointer hover:[&:not(:disabled)]:text-accent-press hover:[&:not(:disabled)]:underline disabled:text-muted disabled:cursor-default"
            onClick={() => setAll(true)}
            disabled={busy}
          >
            Tick all
          </button>
          {" · "}
          <button
            type="button"
            className="text-accent cursor-pointer hover:[&:not(:disabled)]:text-accent-press hover:[&:not(:disabled)]:underline disabled:text-muted disabled:cursor-default"
            onClick={() => setAll(false)}
            disabled={busy}
          >
            Untick all
          </button>
        </span>
      </div>

      {(targets.length > 0 || progress.kind === "looking") && (
        <div className="flex flex-wrap items-center gap-3">
          {progress.kind === "looking" ? (
            <>
              <p role="status" className="text-ink-2 text-meta leading-body">
                Looking up {progress.done} of {progress.total}, one at a time.
              </p>
              <Button variant="secondary" onClick={() => stop.current?.abort()}>
                Stop
              </Button>
            </>
          ) : (
            <>
              <p className="text-ink-2 text-meta leading-body">
                {plural(targets.length, "ticked row has", "ticked rows have")} an ISBN and no title. Looking them up
                asks the book sources one request at a time, which takes a while for a long list.
              </p>
              <Button variant="secondary" disabled={busy || !ready} onClick={() => void look()}>
                Look up the missing details ({targets.length})
              </Button>
            </>
          )}
        </div>
      )}
      {lookupNote && (
        <p role="status" className="text-ink-2 text-meta leading-body">
          {lookupNote}
        </p>
      )}

      <div className="self-stretch overflow-x-auto">
        <table className="w-full border-collapse text-meta text-left [&_th]:py-1.5 [&_th]:px-2.5 [&_th]:text-muted [&_th]:text-label [&_th]:font-semibold [&_td]:py-2 [&_td]:px-2.5 [&_td]:border-t [&_td]:border-divider [&_td]:align-top [&_tbody_tr:not([data-ticked])_td:not(:first-child):not(:last-child)]:text-muted">
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Import</span>
              </th>
              <th scope="col">Title</th>
              <th scope="col">Author</th>
              <th scope="col">ISBN</th>
              <th scope="col">Shelf</th>
              <th scope="col">Flags</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const rowFlags = flags[index] ?? [];
              return (
                <tr key={row.line} data-ticked={ticked.has(index) || undefined}>
                  <td>
                    <input
                      type="checkbox"
                      className="w-4.5 h-4.5 accent-accent"
                      checked={ticked.has(index)}
                      disabled={busy}
                      aria-label={`Import line ${row.line}${row.title ? `, ${row.title}` : ""}`}
                      onChange={(event) => setTick(index, event.currentTarget.checked)}
                    />
                  </td>
                  <td>{row.title || <span className="text-muted">none yet</span>}</td>
                  <td>{row.authors.join(", ")}</td>
                  <td className="tabular-nums whitespace-nowrap">{row.isbn13 ?? row.isbnText}</td>
                  <td>{collection === "wishlist" ? "" : (row.details.shelf ?? "")}</td>
                  <td>
                    {rowFlags.map((flag) => (
                      <span
                        key={flag}
                        className={cn(
                          "mr-1.5 mb-1 inline-block rounded-pill bg-control px-2 py-0.5 text-label font-semibold whitespace-nowrap text-ink-2",
                          flag === "needs-lookup" && "bg-accent-tint text-accent-press",
                        )}
                      >
                        {FLAG_TEXT[flag]}
                      </span>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {progress.kind === "saving" ? (
          <p role="status" className="text-ink-2 text-meta leading-body">
            Saving {progress.done} of {progress.total}…
          </p>
        ) : (
          <Button variant="primary" disabled={busy || !ready || saveable.length === 0} onClick={() => void save()}>
            Save {plural(saveable.length, "book", "books")} to {collection === "owned" ? "Owned" : "the Wishlist"}
          </Button>
        )}
        <Button variant="quiet" onClick={onStartOver} disabled={busy}>
          Choose another file
        </Button>
      </div>
      {ticked.size > saveable.length && (
        <p className="text-ink-2 text-meta leading-body">
          {plural(ticked.size - saveable.length, "ticked row has", "ticked rows have")} no title and will be left out.
        </p>
      )}
      {!ready && <p className="text-ink-2 text-meta leading-body">Loading your library to check for duplicates…</p>}
    </section>
  );
}

// --- Step 4: the result ---------------------------------------------------------

function Done({
  report,
  skippedDuplicates,
  leftOut,
  collection,
  onAgain,
}: {
  report: SaveReport;
  skippedDuplicates: number;
  leftOut: number;
  collection: Collection;
  onAgain: () => void;
}) {
  return (
    <section className="flex flex-col items-start gap-3 p-5 bg-surface rounded-container">
      <h2 className="text-row-title font-semibold">
        {report.saved === 0
          ? "Nothing was saved"
          : `${plural(report.saved, "book", "books")} saved to ${collection === "owned" ? "Owned" : "the Wishlist"}`}
      </h2>
      <ul className="text-ink-2 text-meta leading-body pl-5">
        <li>{plural(report.saved, "book", "books")} saved</li>
        <li>{plural(skippedDuplicates, "row", "rows")} skipped as duplicates</li>
        {leftOut > 0 && <li>{plural(leftOut, "row", "rows")} left out (unticked, invalid or without a title)</li>}
        <li>{plural(report.failed.length, "row", "rows")} failed</li>
        {report.untried > 0 && <li>{plural(report.untried, "row", "rows")} not tried: the server stopped answering</li>}
      </ul>
      {report.failed.length > 0 && (
        <ul className="pl-5 text-meta">
          {report.failed.map((failure) => (
            <li key={failure.line}>
              Line {failure.line}
              {failure.title ? `, ${failure.title}` : ""}: {failure.reason}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <ButtonLink variant="primary" to={LIBRARY}>
          Back to the Library
        </ButtonLink>
        <Button variant="quiet" onClick={onAgain}>
          Import another file
        </Button>
      </div>
    </section>
  );
}
