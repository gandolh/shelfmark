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
import { normalizeOrder, normalizeSizing, normalizeVisibility, type Layout, type LibraryPrefs } from "./prefs";
import { rememberScroll } from "./scroll";
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
 * Keyboard: Tab reaches one row (the last one used); ↑ ↓ Page Up/Down Home
 * End move between rows; Enter opens the book. Header buttons sort (Shift
 * with Enter adds a key); the handle between headers resizes with ← →.
 */

const features = tableFeatures({
  columnVisibilityFeature,
  columnOrderingFeature,
  columnSizingFeature,
  columnResizingFeature,
});

const helper = createColumnHelper<typeof features, Book>();

/** 12 + the 69 px cover + 12, and the divider over it. */
export const ROW_HEIGHT = 94;
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

interface RowNav {
  /** The row whose title link is in the Tab order. */
  tabbable: number;
  onFocus: (index: number) => void;
  onKeyDown: (event: KeyboardEvent<HTMLAnchorElement>, index: number) => void;
}

const RowNavContext = createContext<RowNav>({ tabbable: 0, onFocus: () => {}, onKeyDown: () => {} });

function Cell({ column, book, index }: { column: LibraryColumn; book: Book; index: number }) {
  if (column.id === BOOK_COLUMN_ID) return <BookCell book={book} index={index} />;
  const text = column.text(book);
  if (column.id === "status") return <span className={`library-status library-status--${book.status}`}>{text}</span>;
  // Long text gets the whole of it on hover.
  return <span title={text.length > 24 ? text : undefined}>{text}</span>;
}

function BookCell({ book, index }: { book: Book; index: number }) {
  const nav = useContext(RowNavContext);
  const author = authorLine(book.authors);
  return (
    <div className="library-book">
      <CoverImage book={book} width={46} />
      <div className="library-book__text">
        <Link
          to={bookRoute(book.id)}
          className="library-book__title"
          tabIndex={nav.tabbable === index ? 0 : -1}
          onFocus={() => nav.onFocus(index)}
          onKeyDown={(event) => nav.onKeyDown(event, index)}
          onClick={rememberScroll}
        >
          {book.title}
        </Link>
        {author && <span className="library-book__author">{author}</span>}
      </div>
    </div>
  );
}

/** A plain click anywhere on a row opens its book, as the title link does. */
function onRowClick(event: MouseEvent<HTMLDivElement>, book: Book): void {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if ((event.target as HTMLElement).closest("a, button, input")) return;
  if (window.getSelection()?.type === "Range") return; // selecting text, not opening
  rememberScroll();
  navigate(bookRoute(book.id));
}

// --- The table ----------------------------------------------------------------------------

export interface BookTableProps {
  rows: readonly Book[];
  sorting: Sorting;
  prefs: LibraryPrefs;
  layout: Layout;
}

export function BookTable({ rows, sorting, prefs, layout }: BookTableProps) {
  const desktop = layout === "desktop";

  const table = useTable({
    features,
    columns: COLUMN_DEFS,
    data: rows.length > 0 ? (rows as Book[]) : EMPTY,
    getRowId: (book) => String(book.id),
    state: {
      columnOrder: prefs.columnOrder as ColumnId[],
      columnVisibility: prefs.columnVisibility,
      columnSizing: prefs.columnSizing as Record<string, number>,
    },
    // Whatever the table hands back goes through the same checks as stored prefs.
    onColumnOrderChange: (updater) =>
      updatePrefs(layout, (p) => ({ ...p, columnOrder: normalizeOrder(resolve<string[]>(updater, [...p.columnOrder])) })),
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
  const totalWidth = headers.reduce((sum, header) => sum + header.getSize(), 0);
  // The book column takes what the others leave; the rest keep their widths.
  const template = headers
    .map((header) => (header.column.id === BOOK_COLUMN_ID ? `minmax(${header.getSize()}px, 1fr)` : `${header.getSize()}px`))
    .join(" ");

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
        old.margin === margin && old.covered === covered && old.overflows === overflows ? old : { margin, covered, overflows },
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
    scrollPaddingEnd: desktop ? 0 : 76,
    getItemKey: (index) => tableRows[index]?.id ?? index,
    initialOffset: () => window.scrollY,
  });
  const items = virtualizer.getVirtualItems();

  // --- Keyboard: one row in the Tab order, arrows between rows ---------------------

  const [active, setActive] = useState(0);
  const pendingFocus = useRef<number | null>(null);
  const firstShown = items[0]?.index ?? 0;
  const lastShown = items.at(-1)?.index ?? 0;
  // The row last used, while it is rendered; otherwise the first one on screen.
  const tabbable = active >= firstShown && active <= lastShown && active < tableRows.length ? active : firstShown;

  useLayoutEffect(() => {
    const index = pendingFocus.current;
    if (index === null) return;
    const link = body.current?.querySelector<HTMLElement>(`[data-index="${index}"] .library-book__title`);
    if (link) {
      pendingFocus.current = null;
      link.focus({ preventScroll: true });
    }
  });

  const moveTo = (index: number) => {
    const next = Math.max(0, Math.min(tableRows.length - 1, index));
    setActive(next);
    pendingFocus.current = next;
    virtualizer.scrollToIndex(next, { align: "auto" });
  };

  const rowsPerPage = () => Math.max(1, Math.floor((window.innerHeight - 160) / ROW_HEIGHT));
  const nav: RowNav = {
    tabbable,
    onFocus: setActive,
    onKeyDown: (event, index) => {
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
      moveTo(step());
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
        className="library-table"
        role="table"
        aria-label="Books"
        aria-rowcount={tableRows.length + 1}
        aria-colcount={headers.length}
        style={style}
      >
        <div ref={head} className="library-table__head">
          <div role="rowgroup">
            <div role="row" aria-rowindex={1} className="library-table__row library-table__row--head">
              {headers.map((header) => (
                <HeaderCell key={header.id} header={header} sorting={sorting} onSort={onSort} onResize={onResize} />
              ))}
            </div>
          </div>
        </div>
        <div ref={body} className="library-table__body">
          <div role="rowgroup" className="library-table__rows" style={{ height: virtualizer.getTotalSize() }}>
            {items.map((item) => {
              const row = tableRows[item.index];
              if (!row) return null;
              return (
                <div
                  key={row.id}
                  role="row"
                  aria-rowindex={item.index + 2}
                  data-index={item.index}
                  className="library-table__row"
                  style={{ transform: `translateY(${item.start - virtualizer.options.scrollMargin}px)` }}
                  onClick={(event) => onRowClick(event, row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <div
                      key={cell.id}
                      role="cell"
                      className={cellClass(columnById(cell.column.id as ColumnId))}
                    >
                      <table.FlexRender cell={cell} />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
        {desktop && geometry.overflows && (
          <div ref={bar} className="library-table__bar" aria-hidden="true">
            <div style={{ width: totalWidth }} />
          </div>
        )}
      </div>
    </RowNavContext.Provider>
  );
}

function cellClass(column: LibraryColumn): string {
  return ["library-table__cell", `library-table__cell--${column.id}`, column.align === "end" ? "library-table__cell--end" : null]
    .filter(Boolean)
    .join(" ");
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
        className="library-table__sort"
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
        <span className="library-table__label">{column.header}</span>
        {key && <SortIcon desc={key.desc} size={12} className="library-table__arrow" />}
        {key && sorting.length > 1 && (
          <span className="library-table__rank tabular" aria-hidden="true">
            {rank + 1}
          </span>
        )}
        {sortedText && <span className="visually-hidden">{sortedText}</span>}
      </button>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={`Width of ${column.label}`}
        aria-valuenow={size}
        aria-valuemin={column.minSize}
        aria-valuemax={MAX_WIDTH}
        tabIndex={0}
        className="library-table__resize"
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
