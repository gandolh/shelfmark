import type { RefObject } from "react";
import { ButtonLink } from "../components/Button";
import { SegmentedControl } from "../components/SegmentedControl";
import { ExportMenu } from "../export/ExportMenu";
import { ADD_BOOK } from "../router";
import { activeFilters } from "./filters";
import type { ViewMode } from "./prefs";
import type { LibraryView } from "./view";

export interface ToolbarProps {
  /** The rows and columns on show: what brief 11's Export takes. */
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
 * The Library's controls (design.md). Desktop, right of the title: Table /
 * Covers, Filter, Columns (in the table), Export, and the accent "Add a
 * book" pill. Phone, under the search box: Covers / Table, then the quiet
 * "Filter and sort" and "Export" as accent text; Add a book is the tab bar's.
 */
export function Toolbar({ view, desktop, mode, onModeChange, open, onFilter, onColumns, filterButton, columnsButton }: ToolbarProps) {
  const count = activeFilters(view.filters).length;
  const badge =
    count > 0 ? (
      <>
        <span className="library-count tabular" aria-hidden="true">
          {count}
        </span>
        <span className="visually-hidden">, {count === 1 ? "1 filter" : `${count} filters`} on</span>
      </>
    ) : null;

  if (desktop) {
    return (
      <>
        <SegmentedControl
          label="View"
          size="small"
          options={[
            { value: "table", label: "Table" },
            { value: "covers", label: "Covers" },
          ]}
          value={mode}
          onChange={onModeChange}
        />
        <button
          ref={filterButton}
          type="button"
          className="button button--secondary button--regular"
          aria-haspopup="dialog"
          aria-expanded={open === "filter"}
          onClick={onFilter}
        >
          {mode === "table" ? "Filter" : "Filter and sort"}
          {badge}
        </button>
        {mode === "table" && (
          <button
            ref={columnsButton}
            type="button"
            className="button button--secondary button--regular"
            aria-haspopup="dialog"
            aria-expanded={open === "columns"}
            onClick={onColumns}
          >
            Columns
          </button>
        )}
        <ExportMenu view={view} />
        <ButtonLink to={ADD_BOOK} variant="primary">
          Add a book
        </ButtonLink>
      </>
    );
  }

  // The phone keeps one quiet row: Columns is a row inside "Filter and sort"
  // (LibraryPage), so its sheet is open for either panel.
  return (
    <>
      <SegmentedControl
        label="View"
        size="small"
        options={[
          { value: "covers", label: "Covers" },
          { value: "table", label: "Table" },
        ]}
        value={mode}
        onChange={onModeChange}
      />
      <div className="library-toolbar__end">
        <button
          ref={filterButton}
          type="button"
          className="button button--quiet button--regular"
          aria-haspopup="dialog"
          aria-expanded={open !== null}
          onClick={onFilter}
        >
          Filter and sort
          {badge}
        </button>
        <ExportMenu view={view} quiet />
      </div>
    </>
  );
}
