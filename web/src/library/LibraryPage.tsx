import { buttonClass } from "../components/Button";
import type { Book } from "@shelfmark/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBooks } from "../books/store";
import { Button, ButtonLink } from "../components/Button";
import { setSearchQuery } from "../layout/search";
import { Page } from "../layout/Page";
import { useIsDesktop } from "../layout/viewport";
import { ADD_BOOK } from "../router";
import { BookTable } from "./BookTable";
import { BulkBar, type BulkNotice } from "./BulkBar";
import type { ColumnId } from "./columns";
import { ColumnPicker } from "./ColumnPicker";
import { CoversGrid } from "./CoversGrid";
import { FilterChips } from "./FilterChips";
import { FilterPanel } from "./FilterPanel";
import { activeFilters } from "./filters";
import { LibraryMessage, LibrarySkeleton } from "./LibraryStates";
import { Pager } from "./Pager";
import { showsPager, type PageSize } from "./pagination";
import { Panel } from "./ui/Panel";
import type { Layout, ViewMode } from "./prefs";
import { useScrollMemory } from "./scroll";
import { describeSort, type Sorting } from "./sort";
import {
  isSelected,
  NO_SELECTION,
  pageTicks,
  reachedBooks,
  selectionLine,
  toggleAll,
  toggleBook,
  withBooks,
  type Selection,
  type SelectionLine,
  type SelectionScope,
} from "./selection";
import {
  clearFilters,
  clearSelection,
  getSelection,
  selectionFor,
  setPage,
  setSelection,
  updatePrefs,
  useLibraryPrefs,
  useLibrarySelection,
  type SelectionChoice,
} from "./state";
import { Toolbar } from "./Toolbar";
import { useLibraryView } from "./view";
import { ViewsMenu } from "./ViewsMenu";

/**
 * The open panel, the control it hangs from, and which of that control's
 * edges it lines up with. `stepped`: the phone's sheet went from "Filter and
 * sort" to Columns (or back), so each step knows where focus belongs.
 */
type PanelState = {
  kind: "filter" | "columns";
  anchor: HTMLElement;
  align: "start" | "end";
  column?: ColumnId;
  stepped?: boolean;
};

function books(count: number): string {
  return count === 1 ? "1 book" : `${count.toLocaleString("en-GB")} books`;
}

/**
 * The Library (design.md; corpus/wiki/library-table.md): the owned books,
 * as a table or as covers, searched from the box in the shell, filtered by
 * any column, sorted by any. "14 books, newest first" under the title.
 * The list is shown a page at a time, with the pager under it.
 * While books are selected the bulk bar stands in for the
 * toolbar; Clear puts the toolbar back as it was. The ticks are the page's;
 * a line above the list offers every page ("Select all").
 */
export function LibraryPage() {
  const desktop = useIsDesktop();
  const layout: Layout = desktop ? "desktop" : "phone";
  const { status, error, refresh, books: allBooks } = useBooks();
  const prefs = useLibraryPrefs(layout);
  const view = useLibraryView(layout);
  const [panel, setPanel] = useState<PanelState | null>(null);
  const filterButton = useRef<HTMLButtonElement>(null);
  const columnsButton = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  // Focus lands here when a panel closes and its chip is gone. Stable, so the panel stays open across renders.
  const filterButtonNow = useCallback(() => filterButton.current, []);

  const ready = status === "ready";
  const hasBooks = ready && view.total > 0;
  useScrollMemory(ready);

  // The ticks belong to the list and the page they were made on (state.ts): another page, sort,
  // filter, search, tab or size lets them go, except that "Select all" outlives a turn of the page.
  const choice = useLibrarySelection();
  const inForce = selectionFor(choice, view.pageBasis, view.page);
  useEffect(() => {
    if (ready && choice !== null && inForce === null) clearSelection();
  }, [ready, choice, inForce]);
  const ticked = inForce?.books ?? NO_SELECTION;
  const scope: SelectionScope = inForce?.scope ?? "page";
  // What a bulk change reaches: the ticked books on the page, or on every page after "Select all".
  const selected = useMemo(() => reachedBooks(ticked, scope, view), [ticked, scope, view]);
  const selecting = ready && selected.length > 0;
  const line = ready ? selectionLine(ticked, scope, view) : null;
  // What the last bulk change did, for as long as the selection it was made on stays.
  const [notice, setNotice] = useState<(BulkNotice & { selection: SelectionChoice | null }) | null>(null);
  const shownNotice = notice !== null && notice.selection === choice ? notice : null;
  // The bar takes the toolbar's place, and with it the buttons a panel hangs from.
  if (selecting && panel) setPanel(null);
  // Clear (or a delete) took away the focused button with the bar: focus goes on to the toolbar's Filter.
  const wasSelecting = useRef(selecting);
  useEffect(() => {
    if (
      wasSelecting.current &&
      !selecting &&
      (document.activeElement === null || document.activeElement === document.body)
    ) {
      filterButton.current?.focus();
    }
    wasSelecting.current = selecting;
  }, [selecting]);

  // Owned books only: the wishlist is its own place (wishlist/WishlistPage.tsx).
  const collection = view.collection;
  const tablePrefs = prefs;

  const mode = prefs.view;
  const setMode = (next: ViewMode) => {
    setPanel(null);
    updatePrefs(layout, (p) => ({ ...p, view: next }));
  };
  const setSorting = (sorting: Sorting) => updatePrefs(layout, (p) => ({ ...p, sorting }));
  const toggle = (kind: "filter" | "columns", anchor: HTMLElement | null) => {
    if (!anchor) return;
    // On the phone one button opens the sheet, whichever step it is on.
    setPanel((open) => (open?.kind === kind || (!desktop && open !== null) ? null : { kind, anchor, align: "end" }));
  };
  // The phone's table has no Columns button: the sheet steps between its two panels.
  const phoneColumns = !desktop && mode === "table";
  const step = (kind: "filter" | "columns") =>
    setPanel((open) => open && { ...open, kind, column: undefined, stepped: true });

  // A turn of the page (or a new page size) brings the list's top back into view: just under
  // the desktop's sticky top bar, at the top of the window on a phone. Only upwards, so a short
  // last page whose list top is already in sight doesn't jump.
  const toListTop = () => {
    const box = list.current;
    if (!box) return;
    const covered = desktop ? (document.querySelector<HTMLElement>("[data-topbar]")?.offsetHeight ?? 0) : 0;
    const target = Math.max(0, Math.round(box.getBoundingClientRect().top + window.scrollY - covered));
    if (window.scrollY > target) window.scrollTo(0, target);
  };
  const turnPage = (page: number) => {
    toListTop();
    setPage(page, view.pageBasis);
  };
  const setPageSize = (pageSize: PageSize) => {
    toListTop();
    updatePrefs(layout, (p) => ({ ...p, pageSize }));
  };

  // A tick starts from the selection in force now, and from the page's ticks only, so nothing off the page comes along.
  const ticksNow = (): { books: Selection; scope: SelectionScope } => {
    const now = selectionFor(getSelection(), view.pageBasis, view.page);
    return { books: now?.books ?? NO_SELECTION, scope: now?.scope ?? "page" };
  };
  const tick = (next: Selection, nextScope: SelectionScope = "page") =>
    setSelection(next, view.pageBasis, view.page, nextScope);
  const onToggle = (book: Book) => tick(toggleBook(pageTicks(ticksNow().books, view.pageRows), book));
  // A long press only ticks; on a book already ticked it keeps "Select all" as it is.
  const onPress = (book: Book) => {
    const now = ticksNow().books;
    if (!isSelected(now, book)) tick(withBooks(pageTicks(now, view.pageRows), [book], true));
  };
  // The header's box: the page; after "Select all", it lets go of every book.
  const onToggleAll = () => {
    const now = ticksNow();
    if (now.scope === "all") clearSelection();
    else tick(toggleAll(pageTicks(now.books, view.pageRows), view.pageRows));
  };
  const selectPage = () => tick(withBooks(pageTicks(ticksNow().books, view.pageRows), view.pageRows, true));
  const selectEverything = () => tick(withBooks(NO_SELECTION, view.rows, true), "all");
  // The table's header box covers the page, so its line shows only to go past the page or after it;
  // the covers have no header box, so theirs offers the page too.
  const shownLine = line !== null && (mode === "covers" || line.kind === "more" || scope === "all") ? line : null;

  const count = view.narrowed
    ? `${view.rows.length.toLocaleString("en-GB")} of ${books(view.total)}`
    : books(view.total);
  const caption = hasBooks ? `${count}, ${describeSort(view.sorting)}` : undefined;

  const toolbar = selecting ? (
    <BulkBar
      selected={selected}
      everyPage={scope === "all" && selected.length > view.pageRows.length}
      books={allBooks}
      desktop={desktop}
      onNotice={(next) => setNotice({ ...next, selection: getSelection() })}
    />
  ) : hasBooks ? (
    <Toolbar
      view={view}
      desktop={desktop}
      mode={mode}
      onModeChange={setMode}
      open={panel?.kind ?? null}
      onFilter={() => toggle("filter", filterButton.current)}
      onColumns={() => toggle("columns", columnsButton.current)}
      filterButton={filterButton}
      columnsButton={columnsButton}
    />
  ) : undefined;

  return (
    <Page
      title="Library"
      caption={caption}
      toolbar={toolbar}
      search={{ placeholder: hasBooks ? `Search ${books(view.total)}` : "Search" }}
      wide
      card
    >
      {/* The phone's toolbar has no room for Views: it gets a row of its own (desktop: Toolbar). */}
      {ready && !desktop && view.counts.owned > 0 && (
        <div className="mb-3.5 flex items-baseline justify-between gap-3 border-b border-hairline">
          <ViewsMenu layout={layout} mode={mode} align="end" />
        </div>
      )}
      {/* Said for every change; shown under the bar for the ones that leave it up. */}
      <span className="sr-only" role="status">
        {shownNotice?.text ?? ""}
      </span>
      {/* It stays when the change took the books off the page (a status filter, say), so the owner sees why they went. */}
      {shownNotice?.visible && (
        <p className="-mt-1 mb-3.5 text-meta leading-body text-ink-2" aria-hidden="true">
          {shownNotice.text}
        </p>
      )}
      {hasBooks && (
        <FilterChips
          filters={view.filters}
          filterButton={filterButton}
          onEdit={(column, chip) => setPanel({ kind: "filter", anchor: chip, align: "start", column })}
        />
      )}

      {status === "loading" ? (
        <LibrarySkeleton mode={mode} />
      ) : status === "error" ? (
        <LibraryMessage
          title="Your books didn't load"
          action={
            <Button size={desktop ? "regular" : "large"} pill onClick={() => void refresh()}>
              Try again
            </Button>
          }
        >
          {error?.message ?? "Something went wrong on the way."}
        </LibraryMessage>
      ) : view.total === 0 ? (
        <LibraryMessage
          title="No books yet"
          action={
            <ButtonLink to={ADD_BOOK} variant="primary" size={desktop ? "regular" : "large"}>
              Add a book
            </ButtonLink>
          }
        >
          Scan a barcode, type an ISBN, or write in what the cover says. Every book you add lands here, ready to sort,
          filter and search.
        </LibraryMessage>
      ) : view.rows.length === 0 ? (
        <NoMatch query={view.query} filtered={activeFilters(view.filters).length > 0} />
      ) : (
        <div ref={list}>
          {shownLine && (
            <SelectionBand
              line={shownLine}
              onSelectPage={selectPage}
              onSelectAll={selectEverything}
              onClear={clearSelection}
            />
          )}
          {mode === "table" ? (
            <BookTable
              rows={view.pageRows}
              total={view.rows.length}
              pageStart={(view.page - 1) * view.pageSize}
              sorting={view.sorting}
              prefs={tablePrefs}
              layout={layout}
              selection={ticked}
              everything={scope === "all" ? selected.length : 0}
              onToggle={onToggle}
              onToggleAll={onToggleAll}
            />
          ) : (
            <CoversGrid
              rows={view.pageRows}
              pageStart={(view.page - 1) * view.pageSize}
              total={view.rows.length}
              layout={layout}
              selecting={selecting}
              selection={ticked}
              onPress={onPress}
              onToggle={onToggle}
            />
          )}
          {showsPager(view.rows.length, view.pageSize) && (
            <Pager
              page={view.page}
              pageCount={view.pageCount}
              pageSize={view.pageSize}
              total={view.rows.length}
              desktop={desktop}
              onPage={turnPage}
              onPageSize={setPageSize}
            />
          )}
        </div>
      )}

      {panel && (
        <Panel
          anchor={panel.anchor}
          fallback={filterButtonNow}
          desktop={desktop}
          align={panel.align}
          onClose={() => setPanel(null)}
        >
          {panel.kind === "filter" ? (
            <FilterPanel
              books={view.books}
              collection={collection}
              filters={view.filters}
              query={view.query}
              withSort={!desktop || mode === "covers"}
              sorting={view.sorting}
              onSortingChange={setSorting}
              startColumn={panel.column}
              onColumns={phoneColumns ? () => step("columns") : undefined}
              focusColumns={phoneColumns && panel.stepped === true}
              onClose={() => setPanel(null)}
            />
          ) : (
            <ColumnPicker
              layout={layout}
              collection={collection}
              back={phoneColumns ? { label: "Filter and sort", onClick: () => step("filter") } : undefined}
              onClose={() => setPanel(null)}
            />
          )}
        </Panel>
      )}
    </Page>
  );
}

interface SelectionBandProps {
  line: SelectionLine;
  onSelectPage: () => void;
  onSelectAll: () => void;
  onClear: () => void;
}

/**
 * The line above the list, Gmail's way (selection.ts `selectionLine`): "Select
 * all 10 on this page" (covers), then "All 10 books on this page are
 * selected. Select all 665 books", then "All 665 books are selected. Clear
 * selection". The same text and button nodes carry each step, so focus
 * stays on the button pressed.
 */
function SelectionBand({ line, onSelectPage, onSelectAll, onClear }: SelectionBandProps) {
  const n = (count: number) => count.toLocaleString("en-GB");
  const [text, action, onClick] =
    line.kind === "page"
      ? ["", `Select all ${n(line.page)} on this page`, onSelectPage]
      : line.kind === "more"
        ? [
            line.page === 1
              ? "The 1 book on this page is selected."
              : `All ${n(line.page)} books on this page are selected.`,
            `Select all ${n(line.total)} books`,
            onSelectAll,
          ]
        : [
            line.total === 1 ? "The 1 book is selected." : `All ${n(line.total)} books are selected.`,
            "Clear selection",
            onClear,
          ];
  return (
    <div className="mb-3 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0 rounded-control bg-accent-tint-soft px-3.5 py-1 text-center text-meta text-ink-2 max-md:py-0 max-md:text-body">
      <span className="empty:hidden max-md:pt-2.5" role="status">
        {text}
      </span>
      <button
        type="button"
        className={buttonClass(
          { variant: "quiet", size: "regular" },
          "min-h-7.5 text-meta font-semibold max-md:min-h-touch max-md:text-body",
        )}
        onClick={onClick}
      >
        {action}
      </button>
    </div>
  );
}

/** "No books match", with the way back to everything. */
function NoMatch({ query, filtered }: { query: string; filtered: boolean }) {
  const q = query.trim();
  const text = q
    ? filtered
      ? `Nothing matches “${q}” with these filters.`
      : `Nothing matches “${q}”. The search looks at titles, authors, publishers, series, ISBNs, tags and notes.`
    : "Nothing matches these filters.";
  return (
    <LibraryMessage
      title="No books match"
      action={
        <Button
          pill
          onClick={() => {
            clearFilters();
            setSearchQuery("");
          }}
        >
          {filtered ? "Clear filters" : "Clear search"}
        </Button>
      }
    >
      {text}
    </LibraryMessage>
  );
}
