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
import "./import.css";

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
 * Import a CSV (brief 28): reached from the account menu, not a place of its
 * own. Choose the file, map its columns when it isn't a known export, look at
 * the rows with their flags, optionally look up the ones with only an ISBN,
 * then save the ticked ones into Owned or Wishlist.
 */
export function ImportPage() {
  const [step, setStep] = useState<Step>({ kind: "choose" });
  return (
    <Page title="Import a CSV" back={{ to: LIBRARY, label: "Library" }}>
      <div className="import">
        {step.kind === "choose" && <ChooseFile error={step.error} onLoaded={(file) => setStep({ kind: file.format ? "preview" : "map", file })} onError={(error) => setStep({ kind: "choose", error })} />}
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

function ChooseFile({ error, onLoaded, onError }: { error?: string; onLoaded: (file: Loaded) => void; onError: (message: string) => void }) {
  const input = useRef<HTMLInputElement>(null);

  const read = async (file: File) => {
    const { text, encoding } = decodeCsv(new Uint8Array(await file.arrayBuffer()));
    const table = parseCsv(text);
    const header = table[0];
    if (!header || table.length < 2) return onError("That file has no rows under its header line. Is it a CSV?");
    if (table.length - 1 > MAX_ROWS) return onError(`That file has more than ${MAX_ROWS} rows. Split it and import the parts.`);
    const { format, mapping } = guessMapping(header);
    onLoaded({ name: file.name, encoding, format, table, mapping });
  };

  return (
    <section className="import__card">
      <h2 className="import__heading">Choose a CSV file</h2>
      <p className="import__text">
        A Goodreads, Libib or LibraryThing export, a Shelfmark export, or a spreadsheet saved as CSV. A file with only a
        column of ISBNs works: the details can be looked up afterwards.
      </p>
      <input
        ref={input}
        className="visually-hidden"
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
        <p className="import__error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

// --- Step 2: the columns --------------------------------------------------------

function MapColumns({ file, onBack, onContinue }: { file: Loaded; onBack: () => void; onContinue: (mapping: Mapping) => void }) {
  const [mapping, setMapping] = useState<Mapping>(file.mapping);
  const header = file.table[0] ?? [];
  const usable = isUsable(mapping);

  return (
    <section className="import__card">
      <h2 className="import__heading">Match the columns</h2>
      <p className="import__text">
        {file.format ? `This looks like a ${file.format.name} export.` : "This isn't an export Shelfmark knows."} Say what each
        column holds. One with a title or an ISBN is needed.
      </p>
      <ul className="import-map">
        {header.map((name, column) => {
          const samples = file.table.slice(1, 4).map((row) => row[column] ?? "").filter((cell) => cell !== "");
          return (
            <li key={column} className="import-map__row">
              <div className="import-map__column">
                <span className="import-map__name">{name || `Column ${column + 1}`}</span>
                <span className="import-map__sample">{samples.join(" · ") || "empty"}</span>
              </div>
              <select
                className="import-select"
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
      {!usable && <p className="import__error">Pick a Title or an ISBN column to go on.</p>}
      <div className="import__actions">
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

type Progress = { kind: "idle" } | { kind: "looking"; done: number; total: number } | { kind: "saving"; done: number; total: number };

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
    () => new Set(rows.flatMap((_, index) => ((touched.get(index) ?? tickedByDefault(flags[index] ?? [])) ? [index] : []))),
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
    const run = await runLookups(rows, targets, (isbn, signal) => lookupIsbn(isbn, { signal }), controller.signal, (index, row) => {
      done++;
      setRows((current) => current.map((existing, i) => (i === index ? row : existing)));
      setProgress({ kind: "looking", done, total: targets.length });
    });
    stop.current = null;
    setProgress({ kind: "idle" });
    if (run.stoppedBy === "signal") setLookupNote(`Stopped after ${plural(run.done, "row", "rows")}.`);
    else if (run.stoppedBy === "error") setLookupNote("The lookups stopped: the server can't be reached. Try again in a moment.");
  };

  const save = async () => {
    const chosen = saveable.map((index) => rows[index]).filter((row): row is ImportRow => row !== undefined);
    setProgress({ kind: "saving", done: 0, total: chosen.length });
    const report = await saveRows(chosen, collection, createBook, (done) => setProgress({ kind: "saving", done, total: chosen.length }));
    const unsaved = rows.map((_, index) => index).filter((index) => !saveable.includes(index));
    const skippedDuplicates = unsaved.filter((index) => isDuplicate(flags[index] ?? [])).length;
    onDone({ report, skippedDuplicates, leftOut: unsaved.length - skippedDuplicates, collection });
  };

  const counts = {
    duplicates: flags.filter(isDuplicate).length,
    invalid: flags.filter((f) => f.includes("invalid-isbn")).length,
  };

  return (
    <section className="import__card">
      <h2 className="import__heading">{plural(rows.length, "row", "rows")} in {file.name}</h2>
      <p className="import__text">
        {ENCODING_NOTE[file.encoding]} {file.format ? `Recognised as a ${file.format.name} export.` : "Columns matched by hand."}{" "}
        <button type="button" className="import__link" onClick={onChangeColumns} disabled={busy}>
          Change columns
        </button>
      </p>
      <p className="import__text">
        {plural(counts.duplicates, "row is", "rows are")} already in your library or repeated, {plural(counts.invalid, "has an", "have an")} invalid ISBN. Both are
        unticked.
      </p>

      <div className="import__bar">
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
        <span className="import__text">
          <button type="button" className="import__link" onClick={() => setAll(true)} disabled={busy}>
            Tick all
          </button>
          {" · "}
          <button type="button" className="import__link" onClick={() => setAll(false)} disabled={busy}>
            Untick all
          </button>
        </span>
      </div>

      {(targets.length > 0 || progress.kind === "looking") && (
        <div className="import__lookup">
          {progress.kind === "looking" ? (
            <>
              <p role="status" className="import__text">
                Looking up {progress.done} of {progress.total}, one at a time.
              </p>
              <Button variant="secondary" onClick={() => stop.current?.abort()}>
                Stop
              </Button>
            </>
          ) : (
            <>
              <p className="import__text">
                {plural(targets.length, "ticked row has", "ticked rows have")} an ISBN and no title. Looking them up asks the
                book sources one request at a time, which takes a while for a long list.
              </p>
              <Button variant="secondary" disabled={busy || !ready} onClick={look}>
                Look up the missing details ({targets.length})
              </Button>
            </>
          )}
        </div>
      )}
      {lookupNote && (
        <p role="status" className="import__text">
          {lookupNote}
        </p>
      )}

      <div className="import__scroll">
        <table className="import-table">
          <thead>
            <tr>
              <th scope="col">
                <span className="visually-hidden">Import</span>
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
                      className="import-check"
                      checked={ticked.has(index)}
                      disabled={busy}
                      aria-label={`Import line ${row.line}${row.title ? `, ${row.title}` : ""}`}
                      onChange={(event) => setTick(index, event.currentTarget.checked)}
                    />
                  </td>
                  <td>{row.title || <span className="import__muted">none yet</span>}</td>
                  <td>{row.authors.join(", ")}</td>
                  <td className="import-table__isbn">{row.isbn13 ?? row.isbnText}</td>
                  <td>{collection === "wishlist" ? "" : (row.details.shelf ?? "")}</td>
                  <td>
                    {rowFlags.map((flag) => (
                      <span key={flag} className={`import-flag import-flag--${flag}`}>
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

      <div className="import__actions">
        {progress.kind === "saving" ? (
          <p role="status" className="import__text">
            Saving {progress.done} of {progress.total}…
          </p>
        ) : (
          <Button variant="primary" disabled={busy || !ready || saveable.length === 0} onClick={save}>
            Save {plural(saveable.length, "book", "books")} to {collection === "owned" ? "Owned" : "the Wishlist"}
          </Button>
        )}
        <Button variant="quiet" onClick={onStartOver} disabled={busy}>
          Choose another file
        </Button>
      </div>
      {ticked.size > saveable.length && (
        <p className="import__text">{plural(ticked.size - saveable.length, "ticked row has", "ticked rows have")} no title and will be left out.</p>
      )}
      {!ready && <p className="import__text">Loading your library to check for duplicates…</p>}
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
}: { report: SaveReport; skippedDuplicates: number; leftOut: number; collection: Collection; onAgain: () => void }) {
  return (
    <section className="import__card">
      <h2 className="import__heading">
        {report.saved === 0 ? "Nothing was saved" : `${plural(report.saved, "book", "books")} saved to ${collection === "owned" ? "Owned" : "the Wishlist"}`}
      </h2>
      <ul className="import__text import__counts">
        <li>{plural(report.saved, "book", "books")} saved</li>
        <li>{plural(skippedDuplicates, "row", "rows")} skipped as duplicates</li>
        {leftOut > 0 && <li>{plural(leftOut, "row", "rows")} left out (unticked, invalid or without a title)</li>}
        <li>{plural(report.failed.length, "row", "rows")} failed</li>
        {report.untried > 0 && <li>{plural(report.untried, "row", "rows")} not tried: the server stopped answering</li>}
      </ul>
      {report.failed.length > 0 && (
        <ul className="import__failures">
          {report.failed.map((failure) => (
            <li key={failure.line}>
              Line {failure.line}
              {failure.title ? `, ${failure.title}` : ""}: {failure.reason}
            </li>
          ))}
        </ul>
      )}
      <div className="import__actions">
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
