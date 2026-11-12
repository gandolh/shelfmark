import { buttonClass } from "../components/Button";
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
    const removes = root.current?.querySelectorAll<HTMLElement>("[data-chip-remove]");
    const target = removes?.[Math.min(index, removes.length - 1)];
    (target ?? filterButton.current)?.focus();
  });

  if (active.length === 0) return null;

  return (
    <div ref={root} className="flex flex-wrap items-center gap-2 mb-4">
      <ul className="flex flex-wrap gap-2 list-none" role="list" aria-label="Filters on">
        {active.map(([column, filter], index) => {
          const text = describeFilter(column, filter);
          return (
            <li
              key={column.id}
              className="inline-flex items-center min-w-0 max-w-full min-h-segment-small rounded-pill bg-accent-tint text-accent-press text-small leading-tight"
            >
              <button
                type="button"
                className="relative text-inherit flex items-center min-w-0 max-w-85 min-h-segment-small pr-1 pl-3 rounded-[var(--radius-pill)_0_0_var(--radius-pill)] font-semibold text-left max-md:before:content-[''] max-md:before:absolute max-md:before:inset-y-[calc((100%_-_var(--spacing-touch))_/_2)] max-md:before:inset-x-0"
                aria-haspopup="dialog"
                onClick={(event) => onEdit(column.id, event.currentTarget)}
              >
                <span className="overflow-hidden text-ellipsis whitespace-nowrap">{text}</span>
              </button>
              <button
                type="button"
                className="relative text-inherit flex flex-none items-center justify-center w-6 h-6 mr-0.75 rounded-pill transition-[background-color] duration-(--duration-fast) ease-out hover:bg-[color-mix(in_srgb,var(--color-accent)_16%,var(--color-accent-tint))] max-md:before:content-[''] max-md:before:absolute max-md:before:inset-y-[calc((100%_-_var(--spacing-touch))_/_2)] max-md:before:inset-x-0 max-md:before:[inset-inline:calc((100%_-_var(--spacing-touch))_/_2)]"
                data-chip-remove
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
        className={buttonClass({ variant: "quiet", size: "compact" }, "text-meta")}
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
