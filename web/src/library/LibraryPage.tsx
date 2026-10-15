import { useCallback, useRef, useState } from "react";
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
import type { Layout, ViewMode } from "./prefs";
import { useScrollMemory } from "./scroll";
import { describeSort, type Sorting } from "./sort";
import { clearFilters, updatePrefs, useLibraryPrefs } from "./state";
import { Toolbar } from "./Toolbar";
import { useLibraryView } from "./view";
import "./library.css";

/** The open panel, the control it hangs from, and which of that control's edges it lines up with. */
type PanelState = { kind: "filter" | "columns"; anchor: HTMLElement; align: "start" | "end"; column?: ColumnId };

function books(count: number): string {
  return count === 1 ? "1 book" : `${count.toLocaleString("en-GB")} books`;
}

/**
 * The Library (design.md; corpus/wiki/library-table.md): every owned book,
 * as a table or as covers, searched from the box in the shell, filtered by
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

  const mode = prefs.view;
  const setMode = (next: ViewMode) => {
    setPanel(null);
    updatePrefs(layout, (p) => ({ ...p, view: next }));
  };
  const setSorting = (sorting: Sorting) => updatePrefs(layout, (p) => ({ ...p, sorting }));
  const toggle = (kind: "filter" | "columns", anchor: HTMLElement | null) => {
    if (!anchor) return;
    setPanel((open) => (open?.kind === kind ? null : { kind, anchor, align: "end" }));
  };

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
      {/* The wishlist brief's Owned / Wishlist switch goes here, between the header and the chips. */}
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
      ) : mode === "table" ? (
        <BookTable rows={view.rows} sorting={view.sorting} prefs={prefs} layout={layout} />
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
              books={view.owned}
              filters={view.filters}
              query={view.query}
              withSort={!desktop || mode === "covers"}
              sorting={view.sorting}
              onSortingChange={setSorting}
              startColumn={panel.column}
              onClose={() => setPanel(null)}
            />
          ) : (
            <ColumnPicker layout={layout} onClose={() => setPanel(null)} />
          )}
        </Panel>
      )}
    </Page>
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
