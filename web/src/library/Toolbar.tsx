import type { RefObject } from "react";
import { toolClass } from "./tool";
import { SegmentedControl } from "../components/SegmentedControl";
import { activeFilters } from "./filters";
import { ColumnsIcon, FilterIcon, SlidersIcon } from "./icons";
import type { ViewMode } from "./prefs";
import type { LibraryView } from "./view";
import { ViewsMenu } from "./ViewsMenu";

export interface ToolbarProps {
  /** The filters on: the Filter button's count. */
  view: LibraryView;
  desktop: boolean;
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  /** Which panel is open, for the buttons' expanded state. */
  open: "filter" | "columns" | null;
  onFilter: () => void;
  onColumns: () => void;
  filterButton: RefObject<HTMLButtonElement | null>;
  columnsButton: RefObject<HTMLButtonElement | null>;
}

/**
 * The Library's controls on the header card (design.md): the view switch,
 * then, at the end behind a thin rule, the list tools as quiet
 * icon-and-text buttons. Desktop, right of the title: Table / Covers |
 * Views, Filter, Columns (in the table). Phone, under the search box:
 * Covers / Table, and "Filter and sort" at the row's end; Views sits at the
 * end of the collection tabs (LibraryPage). Add a book is the top bar's (the
 * tab bar's on a phone) and Export is in the account menu, so neither is
 * here.
 *
 * While books are selected the bulk bar (BulkBar.tsx) stands in this place;
 * on a phone Views stays at the end of the tabs, as it is no part of this row.
 */
export function Toolbar({
  view,
  desktop,
  mode,
  onModeChange,
  open,
  onFilter,
  onColumns,
  filterButton,
  columnsButton,
}: ToolbarProps) {
  const count = activeFilters(view.filters).length;
  const badge =
    count > 0 ? (
      <>
        <span
          className="inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-pill bg-accent px-1.25 text-tab leading-none font-semibold text-on-accent tabular-nums"
          aria-hidden="true"
        >
          {count}
        </span>
        <span className="sr-only">, {count === 1 ? "1 filter" : `${count} filters`} on</span>
      </>
    ) : null;

  if (desktop) {
    return (
      <>
        <SegmentedControl
          label="View"
          options={[
            { value: "table", label: "Table" },
            { value: "covers", label: "Covers" },
          ]}
          value={mode}
          onChange={onModeChange}
        />
        <span className="mx-3 h-6 w-px flex-none bg-hairline" aria-hidden="true" />
        <div className="flex items-center gap-0.5">
          <ViewsMenu layout="desktop" mode={mode} />
          <button
            ref={filterButton}
            type="button"
            className={toolClass()}
            aria-haspopup="dialog"
            aria-expanded={open === "filter"}
            onClick={onFilter}
          >
            <FilterIcon />
            {mode === "table" ? "Filter" : "Filter and sort"}
            {badge}
          </button>
          {mode === "table" && (
            <button
              ref={columnsButton}
              type="button"
              className={toolClass()}
              aria-haspopup="dialog"
              aria-expanded={open === "columns"}
              onClick={onColumns}
            >
              <ColumnsIcon />
              Columns
            </button>
          )}
        </div>
      </>
    );
  }

  // The phone keeps one quiet row: Columns is a row inside "Filter and sort"
  // (LibraryPage), so its sheet is open for either panel.
  return (
    <>
      <SegmentedControl
        label="View"
        options={[
          { value: "covers", label: "Covers" },
          { value: "table", label: "Table" },
        ]}
        value={mode}
        onChange={onModeChange}
      />
      <button
        ref={filterButton}
        type="button"
        className={toolClass("max-md:-mr-2")}
        aria-haspopup="dialog"
        aria-expanded={open !== null}
        onClick={onFilter}
      >
        <SlidersIcon size={18} />
        Filter and sort
        {badge}
      </button>
    </>
  );
}
