import { cn } from "../lib/cn";
import { buttonClass } from "../components/Button";
import type { Book, Collection } from "@shelfmark/shared";
import { useId, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { SegmentedControl } from "../components/SegmentedControl";
import { columnById, type ColumnId, type LibraryColumn } from "./columns";
import {
  NO_VALUE,
  emptyFilter,
  filterSummary,
  isActive,
  pickOptions,
  valueRange,
  type Filter,
  type Filters,
  type TextOp,
} from "./filters";
import { ChevronDownIcon, ChevronIcon } from "./icons";
import { PanelHeader, useFocusOnChange } from "./ui/Panel";
import { collator, directionLabel, firstSortDesc, type Sorting } from "./sort";
import { setFilter } from "./state";
import { columnsIn } from "./view";

/**
 * The Filter panel (corpus/wiki/library-table.md): first the list of
 * columns, then the chosen column's filter, by its kind. Every change
 * applies at once; Done closes. Where the table's headers can't sort (the
 * Covers view, and the phone's "Filter and sort"), it opens with the sort.
 */

/** The filter list's order: what an owner filters a home library by most, then the rest A to Z. */
const FIRST: readonly ColumnId[] = ["shelf", "status", "authors", "publisher", "year", "tags", "language", "added"];

const LIST: readonly LibraryColumn[] = [
  ...FIRST.map(columnById),
  ...(
    [
      "book",
      "subtitle",
      "series",
      "seriesNumber",
      "isbn",
      "barcode",
      "pages",
      "format",
      "condition",
      "signed",
      "rating",
      "notes",
      "description",
      "subjects",
      "acquiredOn",
      "acquiredFrom",
      "price",
      "currency",
      "cover",
      "source",
      "changed",
    ] as const
  )
    .map(columnById)
    .sort((a, b) => collator.compare(a.label, b.label)),
];

/** What the sort can be set to here: every column, A to Z, the book's title as "Title". */
const SORTABLE: readonly LibraryColumn[] = [...LIST].sort((a, b) => collator.compare(a.label, b.label));

export interface FilterPanelProps {
  /** Every owned book: the pick-lists offer what they have. */
  books: readonly Book[];
  /** The tab on show: the wishlist lists only the columns its books can fill. */
  collection: Collection;
  filters: Filters;
  query: string;
  /** Show the sort first (Covers, and the phone). */
  withSort: boolean;
  sorting: Sorting;
  onSortingChange: (sorting: Sorting) => void;
  /** Open on this column's filter (a chip was pressed). */
  startColumn?: ColumnId;
  /** The phone's table: a "Columns" row that turns the sheet into the column picker. */
  onColumns?: () => void;
  /** Back from the column picker: focus lands on the "Columns" row again. */
  focusColumns?: boolean;
  onClose: () => void;
}

export function FilterPanel({
  books,
  collection,
  filters,
  query,
  withSort,
  sorting,
  onSortingChange,
  startColumn,
  onColumns,
  focusColumns = false,
  onClose,
}: FilterPanelProps) {
  const [columnId, setColumnId] = useState<ColumnId | null>(startColumn ?? null);
  const [returnTo, setReturnTo] = useState<ColumnId | null>(null);
  // Bumped by "Remove this filter", so the editor starts over with empty fields.
  const [fresh, setFresh] = useState(0);
  const body = useRef<HTMLDivElement>(null);
  const columnsRow = useRef<HTMLButtonElement>(null);
  useFocusOnChange(columnId, body);
  useLayoutEffect(() => {
    if (focusColumns) columnsRow.current?.focus();
  }, [focusColumns]);

  const list = useMemo(() => columnsIn(collection, LIST), [collection]);
  const sortable = useMemo(() => columnsIn(collection, SORTABLE), [collection]);
  const title = withSort ? "Filter and sort" : "Filter";
  // Back from the column picker, and not since moved on to a column's filter.
  const columnsFirst = focusColumns && returnTo === null;

  if (columnId !== null) {
    const column = columnById(columnId);
    const filter = filters[columnId];
    const active = isActive(filter);
    const back = () => {
      setReturnTo(columnId);
      setColumnId(null);
    };
    return (
      <div ref={body} className="flex flex-[1_1_auto] flex-col min-h-0">
        <PanelHeader title={column.label} back={{ label: "Filters", onClick: back }} onDone={onClose} />
        <div
          className="flex-[1_1_auto] min-h-0 pt-0.5 pr-1.5 pb-2.5 pl-1.5 overflow-y-auto [overscroll-behavior:contain]"
          data-panel-scroll
        >
          <FilterEditor
            key={`${columnId}:${fresh}`}
            column={column}
            filter={filter}
            books={books}
            filters={filters}
            query={query}
            onChange={(next) => setFilter(columnId, next && isActive(next) ? next : null)}
          />
        </div>
        {active && (
          <div className="flex flex-none py-1 px-2.5 border-t border-divider">
            <button
              type="button"
              className={buttonClass({ variant: "quiet", size: "compact" })}
              onClick={() => {
                setFilter(columnId, null);
                setFresh((n) => n + 1);
                // This button goes with the filter; focus stays in the panel, on the editor.
                requestAnimationFrame(() => {
                  const root = body.current;
                  (
                    root?.querySelector<HTMLElement>("[data-autofocus]") ??
                    root?.querySelector<HTMLElement>("[data-panel-back]")
                  )?.focus();
                });
              }}
            >
              Remove this filter
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={body} className="flex flex-[1_1_auto] flex-col min-h-0">
      <PanelHeader title={title} onDone={onClose} />
      <div
        className="flex-[1_1_auto] min-h-0 pt-0.5 pr-1.5 pb-2.5 pl-1.5 overflow-y-auto [overscroll-behavior:contain]"
        data-panel-scroll
      >
        {withSort && (
          <SortSection columns={sortable} sorting={sorting} onChange={onSortingChange} takeFocus={!columnsFirst} />
        )}
        {onColumns && (
          <section className="[&+&]:mt-2.5" aria-label="Table">
            <h3
              className="block pt-2 pr-2.5 pb-1 pl-2.5 text-muted text-label font-semibold leading-tight"
              aria-hidden="true"
            >
              Table
            </h3>
            <ul className="list-none" role="list">
              <li>
                <button
                  ref={columnsRow}
                  type="button"
                  className="flex items-center gap-2.5 w-full min-h-9 pr-1.5 pl-2.5 rounded-menu-item text-ink text-meta text-left hover:bg-accent-tint-soft focus-visible:bg-accent-tint-soft focus-visible:outline-offset-[-2px] max-md:min-h-touch max-md:text-body"
                  onClick={onColumns}
                  data-autofocus={columnsFirst ? "" : undefined}
                >
                  <span className="flex-none">Columns</span>
                  <ChevronIcon size={16} className="flex-none ml-auto text-muted" />
                </button>
              </li>
            </ul>
          </section>
        )}
        <section className="[&+&]:mt-2.5" aria-label="Filter by">
          {withSort && (
            <h3 className="block pt-2 pr-2.5 pb-1 pl-2.5 text-muted text-label font-semibold leading-tight">
              Filter by
            </h3>
          )}
          <ul className="list-none" role="list">
            {list.map((column, index) => {
              const filter = filters[column.id];
              const summary = isActive(filter) ? filterSummary(column, filter) : null;
              const focusHere = returnTo === null ? index === 0 && !withSort : returnTo === column.id;
              return (
                <li key={column.id}>
                  <button
                    type="button"
                    className="flex items-center gap-2.5 w-full min-h-9 pr-1.5 pl-2.5 rounded-menu-item text-ink text-meta text-left hover:bg-accent-tint-soft focus-visible:bg-accent-tint-soft focus-visible:outline-offset-[-2px] max-md:min-h-touch max-md:text-body"
                    onClick={() => setColumnId(column.id)}
                    data-autofocus={focusHere ? "" : undefined}
                  >
                    <span className="flex-none">{column.label}</span>
                    {summary && (
                      <span className="min-w-0 ml-auto overflow-hidden text-accent text-small font-semibold text-ellipsis whitespace-nowrap">
                        {summary}
                      </span>
                    )}
                    <ChevronIcon size={16} className={cn("flex-none text-muted", summary === null && "ml-auto")} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}

// --- Sort --------------------------------------------------------------------------

interface SortSectionProps {
  /** The columns this tab can sort by. */
  columns: readonly LibraryColumn[];
  sorting: Sorting;
  onChange: (sorting: Sorting) => void;
  takeFocus: boolean;
}

function SortSection({ columns, sorting, onChange, takeFocus }: SortSectionProps) {
  const id = useId();
  const lead = sorting[0] ?? { id: "added" as const, desc: true };
  const column = columnById(lead.id);
  // A sort carried over from Owned (by shelf, say) stays listed, so the select shows what is in force.
  const options = columns.some((option) => option.id === lead.id) ? columns : [...columns, column];
  const rest = sorting.slice(1).map((key) => columnById(key.id).label.toLowerCase());

  return (
    <section className="[&+&]:mt-2.5" aria-labelledby={id}>
      <h3 id={id} className="block pt-2 pr-2.5 pb-1 pl-2.5 text-muted text-label font-semibold leading-tight">
        Sort by
      </h3>
      <div className="flex flex-wrap items-center gap-2 pt-0.5 pr-2.5 pb-1 pl-2.5">
        <span className="relative flex flex-[1_1_150px] min-w-0">
          <select
            className="w-full min-h-segment-small pr-7.5 pl-2.5 rounded-control bg-control text-ink text-small appearance-none hover:bg-control-hover max-md:min-h-touch max-md:text-input-phone"
            aria-label="Sort by"
            value={lead.id}
            data-autofocus={takeFocus ? "" : undefined}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => {
              const next = columnById(event.target.value as ColumnId);
              onChange([{ id: next.id, desc: firstSortDesc(next) }]);
            }}
          >
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDownIcon
            size={16}
            className="absolute top-[50%] right-2.25 text-ink-2 pointer-events-none [transform:translateY(-50%)]"
          />
        </span>
        <SegmentedControl
          label="Direction"
          size="small"
          options={[
            { value: "asc", label: directionLabel(column, false) },
            { value: "desc", label: directionLabel(column, true) },
          ]}
          value={lead.desc ? "desc" : "asc"}
          onChange={(direction) => onChange([{ id: lead.id, desc: direction === "desc" }, ...sorting.slice(1)])}
        />
      </div>
      {rest.length > 0 && (
        <p className="py-1 px-2.5 text-muted text-small leading-tight">Then by {rest.join(", then ")}.</p>
      )}
    </section>
  );
}

// --- Editors, one per kind ------------------------------------------------------------

interface EditorProps {
  column: LibraryColumn;
  filter: Filter | undefined;
  books: readonly Book[];
  filters: Filters;
  query: string;
  /** `null` takes the filter off. */
  onChange: (filter: Filter | null) => void;
}

function FilterEditor(props: EditorProps) {
  switch (props.column.kind) {
    case "text":
      return <TextEditor {...props} />;
    case "pick":
      return <PickEditor {...props} />;
    case "number":
    case "date":
      return <RangeEditor {...props} />;
    case "yesno":
      return <YesNoEditor {...props} />;
  }
}

const TEXT_OPS: readonly { value: TextOp; label: string }[] = [
  { value: "contains", label: "Contains" },
  { value: "empty", label: "Is empty" },
  { value: "notEmpty", label: "Is not empty" },
];

function TextEditor({ column, filter, onChange }: EditorProps) {
  // The draft keeps "contains" with nothing typed yet, which filters nothing.
  const [draft, setDraft] = useState(() => (filter?.kind === "text" ? filter : emptyFilter(column)));
  const op = draft.kind === "text" ? draft.op : "contains";
  const text = draft.kind === "text" ? draft.text : "";
  const update = (next: Filter) => {
    setDraft(next);
    onChange(next);
  };

  return (
    <div className="flex flex-col items-stretch gap-2.5 py-1 px-2.5">
      <SegmentedControl
        label={`${column.label} filter`}
        size="small"
        className="self-start"
        options={TEXT_OPS}
        value={op}
        onChange={(value) => update({ kind: "text", op: value, text })}
      />
      {op === "contains" && (
        <input
          className="w-full min-h-control px-2.5 rounded-control bg-field text-ink text-meta appearance-none focus-visible:outline-offset-[0] [&[type=date]]:pr-1.5 [&::-webkit-calendar-picker-indicator]:opacity-60 max-md:min-h-touch max-md:text-input-phone"
          type="text"
          aria-label={`${column.label} contains`}
          placeholder={`Part of the ${column.label.toLowerCase()}`}
          autoComplete="off"
          spellCheck={false}
          value={text}
          data-autofocus=""
          onChange={(event) => update({ kind: "text", op: "contains", text: event.target.value })}
        />
      )}
    </div>
  );
}

function PickEditor({ column, filter, books, filters, query, onChange }: EditorProps) {
  const [find, setFind] = useState("");
  const options = useMemo(
    () => (column.kind === "pick" ? pickOptions(column, books, filters, query) : []),
    [column, books, filters, query],
  );
  const chosen = new Set(filter?.kind === "pick" ? filter.values : []);
  const needle = find.trim().toLocaleLowerCase();
  const shown = needle === "" ? options : options.filter((option) => option.label.toLocaleLowerCase().includes(needle));

  const toggle = (value: string, on: boolean) => {
    const next = new Set(chosen);
    if (on) next.add(value);
    else next.delete(value);
    // In the options' order, so a chip reads as the list does.
    onChange({ kind: "pick", values: options.map((option) => option.value).filter((v) => next.has(v)) });
  };

  if (options.length === 0) {
    return (
      <p className="py-1 px-2.5 text-muted text-small leading-tight">No book has a {column.label.toLowerCase()} yet.</p>
    );
  }

  return (
    <div className="flex flex-col items-stretch gap-2.5 py-1 px-2.5">
      {options.length > 8 && (
        <input
          className="w-full min-h-control px-2.5 rounded-control bg-field text-ink text-meta appearance-none focus-visible:outline-offset-[0] [&[type=date]]:pr-1.5 [&::-webkit-calendar-picker-indicator]:opacity-60 max-md:min-h-touch max-md:text-input-phone"
          type="search"
          aria-label={`Find a ${column.label.toLowerCase()} value`}
          placeholder={`Find ${column.label === "Tags" ? "a tag" : `a ${column.label.toLowerCase()}`}`}
          autoComplete="off"
          spellCheck={false}
          value={find}
          data-autofocus=""
          onChange={(event) => setFind(event.target.value)}
        />
      )}
      <fieldset className="min-w-0 -mx-2.5">
        <legend className="sr-only">{column.label}</legend>
        {shown.map((option, index) => (
          <label
            key={option.value || NO_VALUE}
            className="flex items-center gap-2.5 min-h-9 px-2.5 rounded-menu-item text-ink text-meta cursor-pointer hover:bg-accent-tint-soft [&_input]:flex-none [&_input]:w-4 [&_input]:h-4 [&_input]:accent-accent max-md:min-h-touch max-md:text-body max-md:[&_input]:w-4.5 max-md:[&_input]:h-4.5"
          >
            <input
              type="checkbox"
              checked={chosen.has(option.value)}
              onChange={(event) => toggle(option.value, event.target.checked)}
              data-autofocus={options.length <= 8 && index === 0 ? "" : undefined}
            />
            <span
              className={
                option.value === NO_VALUE
                  ? "min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-ink-2"
                  : "min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
              }
            >
              {option.label}
            </span>
            <span className="tabular-nums ml-auto pl-2 text-muted text-small">{option.count}</span>
          </label>
        ))}
        {shown.length === 0 && (
          <p className="py-1 px-2.5 text-muted text-small leading-tight">Nothing called “{find.trim()}”.</p>
        )}
      </fieldset>
    </div>
  );
}

function toField(column: LibraryColumn, value: number | string | null): string {
  if (value === null) return "";
  if (typeof value === "string") return value;
  const scale = column.kind === "number" ? (column.scale ?? 1) : 1;
  return scale === 1 ? String(value) : String(value / scale);
}

function fromField(column: LibraryColumn, text: string): number | string | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  if (column.kind === "date") return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
  const value = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(value)) return null;
  const scale = column.kind === "number" ? (column.scale ?? 1) : 1;
  return Math.round(value * scale);
}

function RangeEditor({ column, filter, books, onChange }: EditorProps) {
  const isDate = column.kind === "date";
  const current =
    filter?.kind === "number"
      ? [filter.min, filter.max]
      : filter?.kind === "date"
        ? [filter.from, filter.to]
        : [null, null];
  // The fields' own text, so "59." or a half-typed year stays as typed.
  const [low, setLow] = useState(() => toField(column, current[0] ?? null));
  const [high, setHigh] = useState(() => toField(column, current[1] ?? null));
  const range = useMemo(() => valueRange(column, books), [column, books]);
  const lowId = useId();
  const highId = useId();

  const apply = (nextLow: string, nextHigh: string) => {
    const a = fromField(column, nextLow);
    const b = fromField(column, nextHigh);
    if (isDate) {
      onChange({ kind: "date", from: typeof a === "string" ? a : null, to: typeof b === "string" ? b : null });
    } else {
      onChange({ kind: "number", min: typeof a === "number" ? a : null, max: typeof b === "number" ? b : null });
    }
  };

  const fieldProps = isDate
    ? {
        type: "date",
        min: typeof range?.min === "string" ? range.min : undefined,
        max: typeof range?.max === "string" ? range.max : undefined,
      }
    : {
        type: "text",
        inputMode: column.kind === "number" && column.scale ? ("decimal" as const) : ("numeric" as const),
      };
  const placeholder = (value: number | string | undefined) =>
    isDate || value === undefined ? undefined : toField(column, value);

  return (
    <div className="flex flex-col items-stretch gap-2.5 py-1 px-2.5">
      <div className="grid grid-cols-[1fr_1fr] gap-2.5">
        <div className="flex flex-col min-w-0">
          <label htmlFor={lowId} className="block px-0 pt-0 pb-1 text-muted text-label font-semibold leading-tight">
            From
          </label>
          <input
            id={lowId}
            className="tabular-nums w-full min-h-control px-2.5 rounded-control bg-field text-ink text-meta appearance-none focus-visible:outline-offset-[0] [&[type=date]]:pr-1.5 [&::-webkit-calendar-picker-indicator]:opacity-60 max-md:min-h-touch max-md:text-input-phone"
            autoComplete="off"
            placeholder={placeholder(range?.min)}
            value={low}
            data-autofocus=""
            onChange={(event) => {
              setLow(event.target.value);
              apply(event.target.value, high);
            }}
            {...fieldProps}
          />
        </div>
        <div className="flex flex-col min-w-0">
          <label htmlFor={highId} className="block px-0 pt-0 pb-1 text-muted text-label font-semibold leading-tight">
            To
          </label>
          <input
            id={highId}
            className="tabular-nums w-full min-h-control px-2.5 rounded-control bg-field text-ink text-meta appearance-none focus-visible:outline-offset-[0] [&[type=date]]:pr-1.5 [&::-webkit-calendar-picker-indicator]:opacity-60 max-md:min-h-touch max-md:text-input-phone"
            autoComplete="off"
            placeholder={placeholder(range?.max)}
            value={high}
            onChange={(event) => {
              setHigh(event.target.value);
              apply(low, event.target.value);
            }}
            {...fieldProps}
          />
        </div>
      </div>
      <p className="py-1 px-2.5 text-muted text-small leading-tight">
        {isDate
          ? "Both days included. Leave one empty for no limit."
          : "Both ends included. Leave one empty for no limit."}
      </p>
    </div>
  );
}

function YesNoEditor({ column, filter, onChange }: EditorProps) {
  const value = filter?.kind === "yesno" ? (filter.value ? "yes" : "no") : "any";
  return (
    <div className="flex flex-col items-stretch gap-2.5 py-1 px-2.5">
      <SegmentedControl
        label={column.label}
        size="small"
        className="self-start"
        options={[
          { value: "any", label: "Any" },
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ]}
        value={value}
        onChange={(next) => onChange(next === "any" ? null : { kind: "yesno", value: next === "yes" })}
      />
    </div>
  );
}
