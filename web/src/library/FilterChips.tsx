import { useLayoutEffect, useRef, type RefObject } from "react";
import { ClearIcon } from "../components/icons";
import type { ColumnId } from "./columns";
import { activeFilters, describeFilter, type Filters } from "./filters";
import { clearFilters, setFilter } from "./state";

export interface FilterChipsProps {
  filters: Filters;
  /** A chip's text was pressed: open that column's filter, under the chip. */
  onEdit: (id: ColumnId, chip: HTMLElement) => void;
  /** Where focus goes when the last chip is gone. */
  filterButton: RefObject<HTMLElement | null>;
}

/**
 * The active filters as chips under the toolbar, each with its own ×, and
 * "Clear all". Pressing a chip's words opens its filter. Nothing shows while
 * no filter is on.
 */
export function FilterChips({ filters, onEdit, filterButton }: FilterChipsProps) {
  const active = activeFilters(filters);
  const root = useRef<HTMLDivElement>(null);
  // After a chip goes, focus the one that took its place (or the one before);
  // with none left, the Filter button.
  const pendingFocus = useRef<number | null>(null);
  useLayoutEffect(() => {
    const index = pendingFocus.current;
    if (index === null) return;
    pendingFocus.current = null;
    const removes = root.current?.querySelectorAll<HTMLElement>(".library-chip__remove");
    const target = removes?.[Math.min(index, removes.length - 1)];
    (target ?? filterButton.current)?.focus();
  });

  if (active.length === 0) return null;

  return (
    <div ref={root} className="library-chips">
      <ul className="library-chips__list" role="list" aria-label="Filters on">
        {active.map(([column, filter], index) => {
          const text = describeFilter(column, filter);
          return (
            <li key={column.id} className="library-chip">
              <button
                type="button"
                className="library-chip__label"
                aria-haspopup="dialog"
                onClick={(event) => onEdit(column.id, event.currentTarget)}
              >
                <span className="library-chip__text">{text}</span>
              </button>
              <button
                type="button"
                className="library-chip__remove"
                aria-label={`Remove filter: ${text}`}
                onClick={() => {
                  pendingFocus.current = index;
                  setFilter(column.id, null);
                }}
              >
                <ClearIcon size={12} />
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className="button button--quiet button--compact library-chips__clear"
        onClick={() => {
          pendingFocus.current = 0;
          clearFilters();
        }}
      >
        Clear all
      </button>
    </div>
  );
}
