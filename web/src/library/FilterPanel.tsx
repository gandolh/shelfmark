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
import { PanelHeader, useFocusOnChange } from "./Panel";
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
      <div ref={body} className="library-panel__content">
        <PanelHeader title={column.label} back={{ label: "Filters", onClick: back }} onDone={onClose} />
        <div className="library-panel__scroll">
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
          <div className="library-panel__foot">
            <button
              type="button"
              className="button button--quiet button--compact"
              onClick={() => {
                setFilter(columnId, null);
                setFresh((n) => n + 1);
                // This button goes with the filter; focus stays in the panel, on the editor.
                requestAnimationFrame(() => {
                  const root = body.current;
                  (root?.querySelector<HTMLElement>("[data-autofocus]") ?? root?.querySelector<HTMLElement>(".library-panel__back"))?.focus();
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
    <div ref={body} className="library-panel__content">
      <PanelHeader title={title} onDone={onClose} />
      <div className="library-panel__scroll">
        {withSort && <SortSection columns={sortable} sorting={sorting} onChange={onSortingChange} takeFocus={!columnsFirst} />}
        {onColumns && (
          <section className="library-panel__section" aria-label="Table">
            <h3 className="library-panel__label" aria-hidden="true">
              Table
            </h3>
            <ul className="library-columns" role="list">
              <li>
                <button
                  ref={columnsRow}
                  type="button"
                  className="library-columns__item"
                  onClick={onColumns}
                  data-autofocus={columnsFirst ? "" : undefined}
                >
                  <span className="library-columns__label">Columns</span>
                  <ChevronIcon size={16} className="library-columns__chevron" />
                </button>
              </li>
            </ul>
          </section>
        )}
        <section className="library-panel__section" aria-label="Filter by">
          {withSort && <h3 className="library-panel__label">Filter by</h3>}
          <ul className="library-columns" role="list">
            {list.map((column, index) => {
              const filter = filters[column.id];
              const summary = isActive(filter) ? filterSummary(column, filter) : null;
              const focusHere = returnTo === null ? index === 0 && !withSort : returnTo === column.id;
              return (
                <li key={column.id}>
                  <button
                    type="button"
                    className="library-columns__item"
                    onClick={() => setColumnId(column.id)}
                    data-autofocus={focusHere ? "" : undefined}
                  >
                    <span className="library-columns__label">{column.label}</span>
                    {summary && <span className="library-columns__summary">{summary}</span>}
                    <ChevronIcon size={16} className="library-columns__chevron" />
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
    <section className="library-panel__section" aria-labelledby={id}>
      <h3 id={id} className="library-panel__label">
        Sort by
      </h3>
      <div className="library-sort">
        <span className="library-select">
          <select
            className="library-select__input"
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
          <ChevronDownIcon size={16} className="library-select__chevron" />
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
      {rest.length > 0 && <p className="library-panel__note">Then by {rest.join(", then ")}.</p>}
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
    <div className="library-editor">
      <SegmentedControl
        label={`${column.label} filter`}
        size="small"
        options={TEXT_OPS}
        value={op}
        onChange={(value) => update({ kind: "text", op: value, text })}
      />
      {op === "contains" && (
        <input
          className="library-field"
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
    return <p className="library-panel__note">No book has a {column.label.toLowerCase()} yet.</p>;
  }

  return (
    <div className="library-editor">
      {options.length > 8 && (
        <input
          className="library-field"
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
      <fieldset className="library-options">
        <legend className="visually-hidden">{column.label}</legend>
        {shown.map((option, index) => (
          <label key={option.value || NO_VALUE} className="library-option">
            <input
              type="checkbox"
              checked={chosen.has(option.value)}
              onChange={(event) => toggle(option.value, event.target.checked)}
              data-autofocus={options.length <= 8 && index === 0 ? "" : undefined}
            />
            <span className={option.value === NO_VALUE ? "library-option__label library-option__label--none" : "library-option__label"}>
              {option.label}
            </span>
            <span className="library-option__count tabular">{option.count}</span>
          </label>
        ))}
        {shown.length === 0 && <p className="library-panel__note">Nothing called “{find.trim()}”.</p>}
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
  const current = filter?.kind === "number" ? [filter.min, filter.max] : filter?.kind === "date" ? [filter.from, filter.to] : [null, null];
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
    ? { type: "date", min: typeof range?.min === "string" ? range.min : undefined, max: typeof range?.max === "string" ? range.max : undefined }
    : { type: "text", inputMode: column.kind === "number" && column.scale ? ("decimal" as const) : ("numeric" as const) };
  const placeholder = (value: number | string | undefined) =>
    isDate || value === undefined ? undefined : toField(column, value);

  return (
    <div className="library-editor">
      <div className="library-range">
        <div className="library-range__field">
          <label htmlFor={lowId} className="library-panel__label">
            From
          </label>
          <input
            id={lowId}
            className="library-field tabular"
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
        <div className="library-range__field">
          <label htmlFor={highId} className="library-panel__label">
            To
          </label>
          <input
            id={highId}
            className="library-field tabular"
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
      <p className="library-panel__note">
        {isDate ? "Both days included. Leave one empty for no limit." : "Both ends included. Leave one empty for no limit."}
      </p>
    </div>
  );
}

function YesNoEditor({ column, filter, onChange }: EditorProps) {
  const value = filter?.kind === "yesno" ? (filter.value ? "yes" : "no") : "any";
  return (
    <div className="library-editor">
      <SegmentedControl
        label={column.label}
        size="small"
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
