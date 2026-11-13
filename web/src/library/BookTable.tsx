import { cn } from "../lib/cn";
import type { Book } from "@shelfmark/shared";
import {
  columnOrderingFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createColumnHelper,
  tableFeatures,
  useTable,
  type Header,
  type Updater,
} from "@tanstack/react-table";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { authorLine } from "../components/cover";
import { CoverImage } from "../components/CoverImage";
import { Link } from "../components/Link";
import { bookRoute, navigate } from "../router";
import { BOOK_COLUMN_ID, COLUMNS, columnById, type ColumnId, type LibraryColumn } from "./columns";
import { SortIcon } from "./icons";
import { TAB_BAR_HEIGHT } from "../layout/viewport";
import { normalizeOrder, normalizeSizing, normalizeVisibility, type Layout, type LibraryPrefs } from "./prefs";
import { rememberScroll } from "./scroll";
import { isSelected, selectAllState, type Selection } from "./selection";
import { directionLabel, toggleSort, type Sorting } from "./sort";
import { updatePrefs } from "./state";

/**
 * The Table view (design.md, the `Covers-Desktop` mock-up): one white
 * rounded container; the book first (cover, then title over author), then
 * the shown columns. TanStack Table keeps the columns (order, visibility,
 * widths, resizing) and renders the cells; the rows arrive already
 * searched, filtered and sorted (view.ts), so the export takes the same
 * rows. Rows are virtual and the page itself scrolls, so the header sticks
 * under the top bar. A header click sorts, shift-click adds a key.
 *
 * The table shows one page of the list (`rows`); the pager under it turns
 * the page (LibraryPage).
 *
 * Keyboard: Tab reaches one row (the last one used); ↑ ↓ Page Up/Down Home
 * End move between the page's rows and stop at its first and last; they
 * never turn the page. Enter opens the book. Header buttons sort (Shift
 * with Enter adds a key); the handle between headers resizes with ← →.
 *
 * Before the columns, a box per row selects the book for the bulk bar,
 * and the header's box selects the books on this page, or none of them
 * once they all are; every page is the "Select all" line's (LibraryPage).
 * After "Select all" the header's box lets go of every book. The boxes
 * are not a TanStack column: column order,
 * visibility, widths and saved views never see them. In the row, Tab goes
 * from the box to the title; the arrows move between rows in either.
 */

const features = tableFeatures({
  columnVisibilityFeature,
  columnOrderingFeature,
  columnSizingFeature,
  columnResizingFeature,
});

const helper = createColumnHelper<typeof features, Book>();

/** 12 + the 66 px cover + 12, and the divider over it. */
export const ROW_HEIGHT = 91;
/** The select boxes' track: the table's edge padding and the box (the select cell). */
const SELECT_WIDTH = { desktop: 68, phone: 56 } as const;
const MAX_WIDTH = 1200;
const EMPTY: Book[] = [];

const COLUMN_DEFS = helper.columns(
  COLUMNS.map((column) =>
    helper.accessor((book: Book) => column.text(book), {
      id: column.id,
      header: column.header,
      size: column.size,
      minSize: column.minSize,
      maxSize: MAX_WIDTH,
      enableHiding: column.id !== BOOK_COLUMN_ID,
      cell: ({ row }) => <Cell column={column} book={row.original} index={row.index} />,
    }),
  ),
);

function resolve<T>(updater: Updater<T>, current: T): T {
  return typeof updater === "function" ? (updater as (old: T) => T)(current) : updater;
}

// --- Rows and their keyboard ----------------------------------------------------------

/** What in a row has focus: its select box or its title link. */
type RowPart = "select" | "title";

interface RowNav {
  /** The row whose box and title link are in the Tab order. */
  tabbable: number;
  onFocus: (index: number) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>, index: number, part: RowPart) => void;
  /** A row's box pressed. */
  onToggle: (book: Book) => void;
}

const RowNavContext = createContext<RowNav>({
  tabbable: 0,
  onFocus: () => {},
  onKeyDown: () => {},
  onToggle: () => {},
});

const STATUS: Record<Book["status"], string> = {
  reading: "font-semibold text-accent",
  read: "text-ink-2",
  unread: "text-muted",
  abandoned: "text-muted",
};

// A cell: the text in ink-2, one line cut short with an ellipsis. The first and last cell of a row carry the
// table's edge padding (`EDGES`, on the row).
const CELL =
  "flex min-w-0 items-center overflow-hidden px-3 text-meta leading-meta text-ink-2 [&>span]:overflow-hidden [&>span]:text-ellipsis [&>span]:whitespace-nowrap";
const EDGES = "[&>:first-child]:pl-6 [&>:last-child]:pr-6 max-md:[&>:first-child]:pl-4 max-md:[&>:last-child]:pr-4";
// A body row is placed by the virtualizer (its transform); 94 px is ROW_HEIGHT. The row carries the keyboard ring of
// its title link, and a selected row wears the selected row's teal wash, hovered or not.
const ROW =
  "absolute top-0 left-0 grid h-[91px] w-[max(100%,var(--library-width))] cursor-pointer grid-cols-[var(--library-columns)] border-t border-divider transition-[background-color] duration-(--duration-fast) ease-out hover:bg-(--library-row-hover) data-[index=0]:border-t-transparent data-selected:bg-accent-tint has-[a:focus-visible]:bg-(--library-row-hover) has-[a:focus-visible]:outline-2 has-[a:focus-visible]:-outline-offset-2 has-[a:focus-visible]:outline-focus-ring";

function Cell({ column, book, index }: { column: LibraryColumn; book: Book; index: number }) {
  if (column.id === BOOK_COLUMN_ID) return <BookCell book={book} index={index} />;
  const text = column.text(book);
  if (column.id === "status") return <span className={STATUS[book.status]}>{text}</span>;
  // Long text gets the whole of it on hover.
  return <span title={text.length > 24 ? text : undefined}>{text}</span>;
}

function BookCell({ book, index }: { book: Book; index: number }) {
  const nav = useContext(RowNavContext);
  const author = authorLine(book.authors);
  const shelf = columnById("shelf").text(book);
  return (
    <div className="flex min-w-0 items-center gap-4">
      <CoverImage book={book} width={44} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <Link
          to={bookRoute(book.id)}
          className="[display:-webkit-box] overflow-hidden font-book text-row-title leading-row-title font-semibold wrap-anywhere text-ink no-underline [-webkit-box-orient:vertical] [-webkit-line-clamp:2] hover:text-ink focus-visible:outline-none"
          tabIndex={nav.tabbable === index ? 0 : -1}
          onFocus={() => nav.onFocus(index)}
          onKeyDown={(event) => nav.onKeyDown(event, index, "title")}
          onClick={rememberScroll}
        >
          {book.title}
        </Link>
        {author && (
          <span className="overflow-hidden text-meta leading-meta text-ellipsis whitespace-nowrap text-ink-2">
            {author}
          </span>
        )}
        {/* A phone has no Shelf or Status column: they sit under the author. */}
        <span className="mt-1 flex flex-wrap gap-x-3 text-meta leading-meta md:hidden">
          {shelf && <span className="text-ink-2">{shelf}</span>}
          <span className={STATUS[book.status]}>{columnById("status").text(book)}</span>
        </span>
      </div>
    </div>
  );
}

/** The row's select box, filling its cell so the whole cell ticks it. */
function SelectCell({ book, index, selected }: { book: Book; index: number; selected: boolean }) {
  const nav = useContext(RowNavContext);
  return (
    <div role="cell" className={cn(CELL, "relative")}>
      <label className="absolute inset-0 flex cursor-pointer items-center pl-6 max-md:pl-5 [&_input]:flex-none">
        <input
          type="checkbox"
          checked={selected}
          aria-label={`Select “${book.title}”`}
          tabIndex={nav.tabbable === index ? 0 : -1}
          onChange={() => nav.onToggle(book)}
          onFocus={() => nav.onFocus(index)}
          onKeyDown={(event) => nav.onKeyDown(event, index, "select")}
        />
      </label>
    </div>
  );
}

/** The header's box: all, some (a dash) or none of the books on this page; after "Select all", every book. */
function SelectAllCell({ rows, everything, selection, onToggle }: SelectAllCellProps) {
  const state = selectAllState(selection, rows);
  const box = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    if (box.current) box.current.indeterminate = state === "some";
  }, [state]);
  const shown = everything
    ? `all ${everything.toLocaleString("en-GB")} books`
    : rows.length === 1
      ? "the 1 book on this page"
      : `the ${rows.length.toLocaleString("en-GB")} books on this page`;
  return (
    <div role="columnheader" className={cn(CELL, "relative")}>
      <label className="absolute inset-0 flex cursor-pointer items-center pl-6 max-md:pl-5 [&_input]:flex-none">
        <input
          ref={box}
          type="checkbox"
          checked={state === "all"}
          aria-label={state === "all" ? `Unselect ${shown}` : `Select ${shown}`}
          onChange={onToggle}
        />
      </label>
    </div>
  );
}

interface SelectAllCellProps {
  /** The page's rows. */
  rows: readonly Book[];
  /** After "Select all": how many books that ticked, on every page; 0 otherwise. */
  everything: number;
  selection: Selection;
  onToggle: () => void;
}

/** A plain click anywhere on a row opens its book, as the title link does. */
function onRowClick(event: MouseEvent<HTMLDivElement>, book: Book): void {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if ((event.target as HTMLElement).closest("a, button, input, label")) return;
  if (window.getSelection()?.type === "Range") return; // selecting text, not opening
  rememberScroll();
  navigate(bookRoute(book.id));
}

// --- The table ----------------------------------------------------------------------------

export interface BookTableProps {
  /** The page's rows: what the table renders. */
  rows: readonly Book[];
  /** How many books the search and filters let through, on every page, and how many come before this page: the rows' positions in the whole list. */
  total: number;
  pageStart: number;
  sorting: Sorting;
  prefs: LibraryPrefs;
  layout: Layout;
  /** The ticked books (LibraryPage keeps them, with what they cover). */
  selection: Selection;
  /** After "Select all": how many books that ticked; 0 while the ticks are the page's. */
  everything: number;
  /** A row's box pressed. */
  onToggle: (book: Book) => void;
  /** The header's box pressed. */
  onToggleAll: () => void;
}

export function BookTable({
  rows,
  total,
  pageStart,
  sorting,
  prefs,
  layout,
  selection,
  everything,
  onToggle,
  onToggleAll,
}: BookTableProps) {
  const desktop = layout === "desktop";
  const selectWidth = SELECT_WIDTH[layout];

  const table = useTable({
    features,
    columns: COLUMN_DEFS,
    data: rows.length > 0 ? (rows as Book[]) : EMPTY,
    getRowId: (book) => String(book.id),
    state: {
      columnOrder: prefs.columnOrder as ColumnId[],
      columnVisibility: prefs.columnVisibility,
      columnSizing: prefs.columnSizing,
    },
    // Whatever the table hands back goes through the same checks as stored prefs.
    onColumnOrderChange: (updater) =>
      updatePrefs(layout, (p) => ({
        ...p,
        columnOrder: normalizeOrder(resolve<string[]>(updater, [...p.columnOrder])),
      })),
    onColumnVisibilityChange: (updater) =>
      updatePrefs(layout, (p) => ({
        ...p,
        columnVisibility: normalizeVisibility(resolve<Record<string, boolean>>(updater, { ...p.columnVisibility })),
      })),
    onColumnSizingChange: (updater) =>
      updatePrefs(layout, (p) => ({
        ...p,
        columnSizing: normalizeSizing(resolve<Record<string, number>>(updater, { ...p.columnSizing })),
      })),
    columnResizeMode: "onChange",
  });

  const headers = table.getHeaderGroups()[0]?.headers ?? [];
  const tableRows = table.getRowModel().rows;
  const totalWidth = selectWidth + headers.reduce((sum, header) => sum + header.getSize(), 0);
  // The select boxes first; the book column takes what the others leave; the rest keep their widths.
  const template = [
    `${selectWidth}px`,
    ...headers.map((header) =>
      header.column.id === BOOK_COLUMN_ID ? `minmax(${header.getSize()}px, 1fr)` : `${header.getSize()}px`,
    ),
  ].join(" ");

  const root = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);

  // Where the rows start on the page, and how much of the top the top bar and
  // the sticky header cover: the virtualizer needs both, and both move when
  // the chips row comes and goes or a caption wraps.
  const [geometry, setGeometry] = useState({ margin: 0, covered: 0, overflows: false });
  useLayoutEffect(() => {
    const rowsBox = body.current;
    const headBox = head.current;
    if (!rowsBox || !headBox) return;
    const measure = () => {
      const margin = Math.round(rowsBox.getBoundingClientRect().top + window.scrollY);
      const covered = Math.round(parseFloat(getComputedStyle(headBox).top) || 0) + headBox.offsetHeight;
      const overflows = rowsBox.scrollWidth > rowsBox.clientWidth + 1;
      setGeometry((old) =>
        old.margin === margin && old.covered === covered && old.overflows === overflows
          ? old
          : { margin, covered, overflows },
      );
    };
    const observer = new ResizeObserver(measure);
    const page = rowsBox.closest(".page") ?? document.body;
    observer.observe(page);
    observer.observe(rowsBox);
    // The rows widen with the columns while the body's own box stays put.
    if (rowsBox.firstElementChild) observer.observe(rowsBox.firstElementChild);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const virtualizer = useWindowVirtualizer({
    count: tableRows.length,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
    scrollMargin: geometry.margin,
    scrollPaddingStart: geometry.covered,
    scrollPaddingEnd: desktop ? 0 : TAB_BAR_HEIGHT,
    getItemKey: (index) => tableRows[index]?.id ?? index,
    initialOffset: () => window.scrollY,
  });
  const items = virtualizer.getVirtualItems();

  // --- Keyboard: one row in the Tab order, arrows between rows ---------------------

  const [active, setActive] = useState(0);
  // The row an arrow moved to, for the page's rows it was pressed on: a turned page drops it.
  const pendingFocus = useRef<{ index: number; part: RowPart; rows: readonly Book[] } | null>(null);
  const firstShown = items[0]?.index ?? 0;
  const lastShown = items.at(-1)?.index ?? 0;
  // The row last used, while it is rendered; otherwise the first one on screen.
  const tabbable = active >= firstShown && active <= lastShown && active < tableRows.length ? active : firstShown;

  useLayoutEffect(() => {
    const pending = pendingFocus.current;
    if (pending === null) return;
    if (pending.rows !== rows) {
      pendingFocus.current = null;
      return;
    }
    const selector = pending.part === "select" ? ".library-tick input" : ".library-book__title";
    const target = body.current?.querySelector<HTMLElement>(`[data-index="${pending.index}"] ${selector}`);
    if (target) {
      pendingFocus.current = null;
      target.focus({ preventScroll: true });
    }
  });

  const moveTo = (index: number, part: RowPart) => {
    const next = Math.max(0, Math.min(tableRows.length - 1, index));
    setActive(next);
    pendingFocus.current = { index: next, part, rows };
    virtualizer.scrollToIndex(next, { align: "auto" });
  };

  const rowsPerPage = () => Math.max(1, Math.floor((window.innerHeight - 160) / ROW_HEIGHT));
  const nav: RowNav = {
    tabbable,
    onFocus: setActive,
    onToggle,
    onKeyDown: (event, index, part) => {
      const steps: Record<string, () => number> = {
        ArrowDown: () => index + 1,
        ArrowUp: () => index - 1,
        PageDown: () => index + rowsPerPage(),
        PageUp: () => index - rowsPerPage(),
        Home: () => 0,
        End: () => tableRows.length - 1,
      };
      const step = steps[event.key];
      if (!step || event.altKey || event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      // At the page's first or last row the arrow stops; it never turns the page.
      const next = Math.max(0, Math.min(tableRows.length - 1, step()));
      if (next !== index) moveTo(next, part);
    },
  };

  // --- The header follows the body sideways; the bar at the bottom scrolls both ----------

  useEffect(() => {
    const rowsBox = body.current;
    const headBox = head.current;
    const barBox = bar.current;
    if (!rowsBox || !headBox) return;
    const follow = (source: HTMLElement) => () => {
      for (const other of [rowsBox, headBox, barBox]) {
        if (other && other !== source && other.scrollLeft !== source.scrollLeft) other.scrollLeft = source.scrollLeft;
      }
    };
    const listeners = [rowsBox, headBox, barBox].flatMap((box) => {
      if (!box) return [];
      const listener = follow(box);
      box.addEventListener("scroll", listener, { passive: true });
      return [() => box.removeEventListener("scroll", listener)];
    });
    return () => {
      for (const remove of listeners) remove();
    };
  }, [geometry.overflows]);

  const onSort = (id: ColumnId, multi: boolean) => {
    updatePrefs(layout, (p) => ({ ...p, sorting: toggleSort(p.sorting, id, multi) }));
  };

  const onResize = (id: ColumnId, width: number) => {
    const column = columnById(id);
    const size = Math.round(Math.max(column.minSize, Math.min(MAX_WIDTH, width)));
    table.setColumnSizing((old) => ({ ...old, [id]: size }));
  };

  const style = { "--library-columns": template, "--library-width": `${totalWidth}px` } as CSSProperties;

  return (
    <RowNavContext.Provider value={nav}>
      <div
        ref={root}
        className="relative overflow-clip rounded-container bg-surface [--library-row-hover:var(--color-row-hover)] [--library-sticky-top:0px] md:[--library-sticky-top:var(--spacing-topbar)]"
        role="table"
        aria-label="Books"
        aria-rowcount={total + 1}
        aria-colcount={headers.length + 1}
        style={style}
      >
        <div
          ref={head}
          className="sticky top-(--library-sticky-top) z-2 overflow-hidden border-b border-divider bg-surface"
        >
          <div role="rowgroup">
            <div
              role="row"
              aria-rowindex={1}
              className={cn(
                "group/head grid w-[max(100%,var(--library-width))] grid-cols-[var(--library-columns)]",
                EDGES,
                // Header cells: 12 px labels that sort, and a handle on the right edge that resizes.
                "[&>*]:relative [&>*]:overflow-visible [&>*]:py-3.5 [&>*]:text-label [&>*]:leading-label [&>*]:font-semibold [&>*]:text-ink-2",
              )}
            >
              <SelectAllCell rows={rows} everything={everything} selection={selection} onToggle={onToggleAll} />
              {headers.map((header) => (
                <HeaderCell key={header.id} header={header} sorting={sorting} onSort={onSort} onResize={onResize} />
              ))}
            </div>
          </div>
        </div>
        <div
          ref={body}
          className="[scrollbar-width:none] overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden"
        >
          <div
            role="rowgroup"
            className="relative w-[max(100%,var(--library-width))]"
            style={{ height: virtualizer.getTotalSize() }}
          >
            {items.map((item) => {
              const row = tableRows[item.index];
              if (!row) return null;
              const selected = isSelected(selection, row.original);
              return (
                <div
                  key={row.id}
                  role="row"
                  aria-rowindex={pageStart + item.index + 2}
                  data-index={item.index}
                  data-selected={selected ? "" : undefined}
                  className={cn(ROW, EDGES)}
                  style={{ transform: `translateY(${item.start - virtualizer.options.scrollMargin}px)` }}
                  onClick={(event) => onRowClick(event, row.original)}
                >
                  <SelectCell book={row.original} index={item.index} selected={selected} />
                  {row.getVisibleCells().map((cell) => (
                    <div key={cell.id} role="cell" className={cellClass(columnById(cell.column.id as ColumnId))}>
                      <table.FlexRender cell={cell} />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
        {desktop && geometry.overflows && (
          <div
            ref={bar}
            className="sticky bottom-0 z-2 overflow-x-auto overflow-y-hidden border-t border-divider bg-surface [&>div]:h-px"
            aria-hidden="true"
          >
            <div style={{ width: totalWidth }} />
          </div>
        )}
      </div>
    </RowNavContext.Provider>
  );
}

function cellClass(column: LibraryColumn): string {
  return cn(
    CELL,
    column.id === "book" && "py-3",
    column.id === "shelf" && "text-ink",
    (column.id === "added" || column.id === "changed") && "text-muted",
    column.align === "end" && "justify-end text-right tabular-nums",
  );
}

// --- Headers ------------------------------------------------------------------------------

interface HeaderCellProps {
  header: Header<typeof features, Book, unknown>;
  sorting: Sorting;
  onSort: (id: ColumnId, multi: boolean) => void;
  onResize: (id: ColumnId, width: number) => void;
}

function HeaderCell({ header, sorting, onSort, onResize }: HeaderCellProps) {
  const column = columnById(header.column.id as ColumnId);
  const rank = sorting.findIndex((key) => key.id === column.id);
  const key = sorting[rank];
  const size = header.getSize();
  const resizeHandler = header.getResizeHandler();

  const sortedText = key
    ? `, sorted ${directionLabel(column, key.desc)}${sorting.length > 1 ? `, ${ordinal(rank + 1)} of ${sorting.length}` : ""}`
    : "";

  return (
    <div
      role="columnheader"
      aria-sort={rank === 0 && key ? (key.desc ? "descending" : "ascending") : undefined}
      className={cellClass(column)}
    >
      <button
        type="button"
        className="-mx-1.5 -my-1 inline-flex max-w-[calc(100%_+_12px)] min-w-0 items-center gap-1 rounded-segment px-1.5 py-1 whitespace-nowrap text-inherit transition-[color] duration-(--duration-fast) ease-out hover:text-ink data-sorted:text-ink"
        data-sorted={key ? "" : undefined}
        onClick={(event) => onSort(column.id, event.shiftKey)}
        onKeyDown={(event) => {
          // Shift with Enter or Space adds a key, as a shift-click does.
          if ((event.key === "Enter" || event.key === " ") && event.shiftKey) {
            event.preventDefault();
            onSort(column.id, true);
          }
        }}
      >
        <span className="overflow-hidden text-ellipsis">{column.header}</span>
        {key && <SortIcon desc={key.desc} size={12} className="flex-none" />}
        {key && sorting.length > 1 && (
          <span className="text-tab tabular-nums" aria-hidden="true">
            {rank + 1}
          </span>
        )}
        {sortedText && <span className="sr-only">{sortedText}</span>}
      </button>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={`Width of ${column.label}`}
        aria-valuenow={size}
        aria-valuemin={column.minSize}
        aria-valuemax={MAX_WIDTH}
        tabIndex={0}
        className="absolute top-0 -right-1.5 bottom-0 z-1 w-3 cursor-col-resize touch-none after:absolute after:top-2.5 after:bottom-2 after:left-1.25 after:w-0.5 after:rounded-pill after:bg-transparent after:transition-[background-color] after:duration-(--duration-fast) after:ease-out after:content-[''] group-hover/head:after:bg-divider hover:after:bg-accent focus-visible:outline-none focus-visible:after:bg-accent data-resizing:after:bg-accent"
        data-resizing={header.column.getIsResizing() ? "" : undefined}
        onMouseDown={resizeHandler}
        onTouchStart={resizeHandler}
        onDoubleClick={() => header.column.resetSize()}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 48 : 16;
          if (event.key === "ArrowLeft") onResize(column.id, size - step);
          else if (event.key === "ArrowRight") onResize(column.id, size + step);
          else if (event.key === "Home") onResize(column.id, column.size);
          else return;
          event.preventDefault();
        }}
      />
    </div>
  );
}

function ordinal(n: number): string {
  return n === 1 ? "first" : n === 2 ? "second" : n === 3 ? "third" : `number ${n}`;
}
