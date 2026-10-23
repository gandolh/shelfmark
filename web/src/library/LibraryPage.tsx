import type { Collection } from "@shelfmark/shared";
import { useCallback, useMemo, useRef, useState } from "react";
import { useBooks } from "../books/store";
import { Button, ButtonLink } from "../components/Button";
import { setSearchQuery } from "../layout/search";
import { Page } from "../layout/Page";
import { useIsDesktop } from "../layout/viewport";
import { ADD_BOOK } from "../router";
import { BookTable } from "./BookTable";
import type { ColumnId } from "./columns";
import { ColumnPicker } from "./ColumnPicker";
import { CoversGrid } from "./CoversGrid";
import { FilterChips } from "./FilterChips";
import { FilterPanel } from "./FilterPanel";
import { activeFilters } from "./filters";
import { LibraryMessage, LibrarySkeleton } from "./LibraryStates";
import { Panel } from "./Panel";
import type { Layout, LibraryPrefs, ViewMode } from "./prefs";
import { useScrollMemory } from "./scroll";
import { describeSort, type Sorting } from "./sort";
import { clearFilters, updatePrefs, useLibraryPrefs } from "./state";
import { Toolbar } from "./Toolbar";
import { columnApplies, useLibraryView, type LibraryView } from "./view";
import "./library.css";

/**
 * The open panel, the control it hangs from, and which of that control's
 * edges it lines up with. `stepped`: the phone's sheet went from "Filter and
 * sort" to Columns (or back), so each step knows where focus belongs.
 */
type PanelState = { kind: "filter" | "columns"; anchor: HTMLElement; align: "start" | "end"; column?: ColumnId; stepped?: boolean };

function books(count: number): string {
  return count === 1 ? "1 book" : `${count.toLocaleString("en-GB")} books`;
}

/** The tabs' words (glossary.md: collection). */
const COLLECTION_LABELS: Record<Collection, string> = { owned: "Owned", wishlist: "Wishlist" };

/**
 * The Library (design.md; corpus/wiki/library-table.md): the open collection
 * (Owned or Wishlist), as a table or as covers, searched from the box in the shell, filtered by
 * any column, sorted by any. "14 books, newest first" under the title.
 */
export function LibraryPage() {
  const desktop = useIsDesktop();
  const layout: Layout = desktop ? "desktop" : "phone";
  const { status, error, refresh } = useBooks();
  const prefs = useLibraryPrefs(layout);
  const view = useLibraryView(layout);
  const [panel, setPanel] = useState<PanelState | null>(null);
  const filterButton = useRef<HTMLButtonElement>(null);
  const columnsButton = useRef<HTMLButtonElement>(null);
  // Focus lands here when a panel closes and its chip is gone. Stable, so the panel stays open across renders.
  const filterButtonNow = useCallback(() => filterButton.current, []);

  const ready = status === "ready";
  const hasBooks = ready && view.total > 0;
  useScrollMemory(ready);

  const collection = view.collection;
  // The wishlist leaves out the columns a wishlist book never fills; the saved choice is untouched.
  const tablePrefs = useMemo<LibraryPrefs>(
    () =>
      collection === "owned"
        ? prefs
        : {
            ...prefs,
            columnVisibility: Object.fromEntries(
              Object.entries(prefs.columnVisibility).map(([id, shown]) => [id, shown && columnApplies(id as ColumnId, collection)]),
            ) as LibraryPrefs["columnVisibility"],
          },
    [prefs, collection],
  );
  const setCollection = (next: Collection) => {
    if (next === collection) return;
    setPanel(null);
    // A shelf filter means nothing on the wishlist, and a filter left behind would hide the other tab's books.
    clearFilters();
    updatePrefs(layout, (p) => ({ ...p, collection: next }));
  };

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
  const step = (kind: "filter" | "columns") => setPanel((open) => open && { ...open, kind, column: undefined, stepped: true });

  const count = view.narrowed ? `${view.rows.length.toLocaleString("en-GB")} of ${books(view.total)}` : books(view.total);
  const caption = hasBooks ? `${count}, ${describeSort(view.sorting)}` : undefined;

  const toolbar = hasBooks ? (
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
  ) : desktop && !(ready && view.total === 0) ? (
    <ButtonLink to={ADD_BOOK} variant="primary">
      Add a book
    </ButtonLink>
  ) : undefined;

  return (
    <Page title="Library" caption={caption} toolbar={toolbar} search={{ placeholder: hasBooks ? `Search ${books(view.total)}` : "Search" }}>
      {ready && view.counts.owned + view.counts.wishlist > 0 && <CollectionTabs view={view} onChange={setCollection} />}
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
      ) : view.total === 0 && collection === "wishlist" ? (
        <LibraryMessage
          title="Your wishlist is empty"
          action={
            <ButtonLink to={ADD_BOOK} variant="primary" size={desktop ? "regular" : "large"}>
              Add a book
            </ButtonLink>
          }
        >
          Scan a book you don't own and choose “Add to wishlist”. It waits here until you buy it.
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
      ) : mode === "table" ? (
        <BookTable rows={view.rows} sorting={view.sorting} prefs={tablePrefs} layout={layout} />
      ) : (
        <CoversGrid rows={view.rows} layout={layout} />
      )}

      {panel && (
        <Panel
          label={panel.kind === "filter" ? (desktop && mode === "table" ? "Filter" : "Filter and sort") : "Columns"}
          anchor={panel.anchor}
          fallback={filterButtonNow}
          desktop={desktop}
          align={panel.align}
          onClose={() => setPanel(null)}
        >
          {panel.kind === "filter" ? (
            <FilterPanel
              books={view.books}
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
              back={phoneColumns ? { label: "Filter and sort", onClick: () => step("filter") } : undefined}
              onClose={() => setPanel(null)}
            />
          )}
        </Panel>
      )}
    </Page>
  );
}

/** Owned and Wishlist as text tabs under the title, each with its count: "Owned 14 · Wishlist 3". */
function CollectionTabs({ view, onChange }: { view: LibraryView; onChange: (collection: Collection) => void }) {
  return (
    <div className="library-tabs" role="group" aria-label="Collection">
      {(["owned", "wishlist"] as const).map((id) => (
        <button
          key={id}
          type="button"
          className="library-tab"
          aria-pressed={view.collection === id}
          onClick={() => onChange(id)}
        >
          {COLLECTION_LABELS[id]}
          <span className="library-tab__count tabular">{view.counts[id].toLocaleString("en-GB")}</span>
        </button>
      ))}
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
