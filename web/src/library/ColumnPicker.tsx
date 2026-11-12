import { buttonClass } from "../components/Button";
import type { Collection } from "@shelfmark/shared";
import { useLayoutEffect, useRef } from "react";
import { BOOK_COLUMN_ID, columnById, type ColumnId } from "./columns";
import { MoveDownIcon, MoveUpIcon } from "./icons";
import { PanelHeader } from "./ui/Panel";
import { DEFAULT_ORDER, DEFAULT_VISIBILITY, type Layout } from "./prefs";
import { collator } from "./sort";
import { updatePrefs, useLibraryPrefs } from "./state";
import { columnApplies } from "./view";

/**
 * Which columns the table shows, and in what order. The shown ones are
 * listed in the table's order with Move up / Move down; the hidden ones
 * follow A to Z. Showing a column puts it at the table's end. The book
 * column always leads. Everything applies at once. The wishlist lists only
 * the columns its books can fill; the others keep their place for Owned.
 */
export interface ColumnPickerProps {
  layout: Layout;
  /** The tab on show. */
  collection: Collection;
  /** A step back to the sheet it was opened from: the phone's "Filter and sort". */
  back?: { label: string; onClick: () => void };
  onClose: () => void;
}

export function ColumnPicker({ layout, collection, back, onClose }: ColumnPickerProps) {
  const { columnOrder, columnVisibility } = useLibraryPrefs(layout);
  const listed = columnOrder.filter((id) => columnApplies(id, collection));
  const shown = listed.filter((id) => id === BOOK_COLUMN_ID || columnVisibility[id]);
  const hidden = listed
    .filter((id) => !shown.includes(id))
    .map(columnById)
    .sort((a, b) => collator.compare(a.label, b.label));

  // Rows move between the lists as they are shown and hidden; focus follows
  // to the next row of the list it left, so a run of changes stays put.
  const list = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<string | null>(null);
  // Opened from inside an open sheet, nothing else moves focus here.
  const stepped = back !== undefined;
  useLayoutEffect(() => {
    if (stepped) list.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
  }, [stepped]);
  useLayoutEffect(() => {
    const key = pendingFocus.current;
    if (key === null) return;
    pendingFocus.current = null;
    list.current?.querySelector<HTMLElement>(`[data-focus-key="${key}"]`)?.focus();
  });

  const setShown = (id: ColumnId, show: boolean) => {
    if (show) {
      const index = hidden.findIndex((column) => column.id === id);
      const next = hidden[index + 1] ?? hidden[index - 1];
      pendingFocus.current = next ? `check:${next.id}` : `check:${id}`;
    } else {
      const index = shown.indexOf(id);
      const next = [shown[index + 1], shown[index - 1]].find(
        (other) => other !== undefined && other !== BOOK_COLUMN_ID,
      );
      pendingFocus.current = `check:${next ?? id}`;
    }
    updatePrefs(layout, (prefs) => {
      const order = prefs.columnOrder.filter((other) => other !== id);
      if (show) {
        // After the last shown column: it appears at the table's end.
        const lastShown = order.reduce(
          (last, other, i) => (prefs.columnVisibility[other] || other === BOOK_COLUMN_ID ? i : last),
          0,
        );
        order.splice(lastShown + 1, 0, id);
      } else {
        order.push(id);
      }
      return { ...prefs, columnOrder: order, columnVisibility: { ...prefs.columnVisibility, [id]: show } };
    });
  };

  const move = (id: ColumnId, step: -1 | 1) => {
    const index = shown.indexOf(id);
    const other = shown[index + step];
    if (other === undefined || other === BOOK_COLUMN_ID) return;
    // At an end, the button just used turns off; its partner takes the focus.
    const atEnd = step === -1 ? index + step === 1 : index + step === shown.length - 1;
    pendingFocus.current = `${atEnd ? (step === -1 ? "down" : "up") : step === -1 ? "up" : "down"}:${id}`;
    updatePrefs(layout, (prefs) => {
      const order = [...prefs.columnOrder];
      const a = order.indexOf(id);
      const b = order.indexOf(other);
      order[a] = other;
      order[b] = id;
      return { ...prefs, columnOrder: order };
    });
  };

  const reset = () => {
    updatePrefs(layout, (prefs) => ({
      ...prefs,
      columnOrder: DEFAULT_ORDER,
      columnVisibility: DEFAULT_VISIBILITY,
      columnSizing: {},
    }));
  };

  return (
    <div className="flex flex-[1_1_auto] flex-col min-h-0">
      <PanelHeader title="Columns" back={back} onDone={onClose} />
      <div
        ref={list}
        className="flex-[1_1_auto] min-h-0 pt-0.5 pr-1.5 pb-2.5 pl-1.5 overflow-y-auto [overscroll-behavior:contain]"
        data-panel-scroll
      >
        <section className="[&+&]:mt-2.5" aria-label="Shown">
          <h3
            className="block pt-2 pr-2.5 pb-1 pl-2.5 text-muted text-label font-semibold leading-tight"
            aria-hidden="true"
          >
            Shown, in order
          </h3>
          <ul className="list-none" role="list">
            {shown.map((id, index) => {
              const column = columnById(id);
              const locked = id === BOOK_COLUMN_ID;
              return (
                <li
                  key={id}
                  className="flex items-center gap-2 min-h-9 pr-1 pl-2.5 rounded-menu-item hover:bg-accent-tint-soft max-md:min-h-touch max-md:text-body"
                >
                  <label className="[&_input]:flex-none [&_input]:w-4 [&_input]:h-4 [&_input]:accent-accent flex flex-[1_1_auto] items-center gap-2.5 min-w-0 min-h-9 text-meta cursor-pointer [&:has(input:disabled)]:cursor-default max-md:min-h-touch max-md:text-body max-md:[&_input]:w-4.5 max-md:[&_input]:h-4.5">
                    <input
                      type="checkbox"
                      checked
                      disabled={locked}
                      data-focus-key={`check:${id}`}
                      data-autofocus={index === 1 ? "" : undefined}
                      onChange={() => setShown(id, false)}
                    />
                    <span>{locked ? "Book (cover, title and author)" : column.label}</span>
                  </label>
                  {locked ? (
                    <span className="pr-1.5 text-muted text-small whitespace-nowrap">Always first</span>
                  ) : (
                    <span className="flex gap-0.5">
                      <button
                        type="button"
                        className="relative flex items-center justify-center w-7 h-7 rounded-control text-ink-2 transition-[background-color] duration-(--duration-fast) ease-out hover:bg-control hover:text-ink disabled:opacity-30 disabled:bg-none max-md:before:content-[''] max-md:before:absolute max-md:before:inset-y-[calc((100%_-_var(--spacing-touch))_/_2)] max-md:before:inset-x-0 max-md:before:[inset-inline:calc((100%_-_var(--spacing-touch))_/_2)] max-md:w-9 max-md:h-9"
                        aria-label={`Move ${column.label} up`}
                        disabled={index <= 1}
                        data-focus-key={`up:${id}`}
                        onClick={() => move(id, -1)}
                      >
                        <MoveUpIcon size={16} />
                      </button>
                      <button
                        type="button"
                        className="relative flex items-center justify-center w-7 h-7 rounded-control text-ink-2 transition-[background-color] duration-(--duration-fast) ease-out hover:bg-control hover:text-ink disabled:opacity-30 disabled:bg-none max-md:before:content-[''] max-md:before:absolute max-md:before:inset-y-[calc((100%_-_var(--spacing-touch))_/_2)] max-md:before:inset-x-0 max-md:before:[inset-inline:calc((100%_-_var(--spacing-touch))_/_2)] max-md:w-9 max-md:h-9"
                        aria-label={`Move ${column.label} down`}
                        disabled={index === shown.length - 1}
                        data-focus-key={`down:${id}`}
                        onClick={() => move(id, 1)}
                      >
                        <MoveDownIcon size={16} />
                      </button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
        {hidden.length > 0 && (
          <section className="[&+&]:mt-2.5" aria-label="Hidden">
            <h3
              className="block pt-2 pr-2.5 pb-1 pl-2.5 text-muted text-label font-semibold leading-tight"
              aria-hidden="true"
            >
              Hidden
            </h3>
            <ul className="list-none" role="list">
              {hidden.map((column) => (
                <li
                  key={column.id}
                  className="flex items-center gap-2 min-h-9 pr-1 pl-2.5 rounded-menu-item hover:bg-accent-tint-soft max-md:min-h-touch max-md:text-body"
                >
                  <label className="[&_input]:flex-none [&_input]:w-4 [&_input]:h-4 [&_input]:accent-accent flex flex-[1_1_auto] items-center gap-2.5 min-w-0 min-h-9 text-meta cursor-pointer [&:has(input:disabled)]:cursor-default max-md:min-h-touch max-md:text-body max-md:[&_input]:w-4.5 max-md:[&_input]:h-4.5">
                    <input
                      type="checkbox"
                      checked={false}
                      data-focus-key={`check:${column.id}`}
                      onChange={() => setShown(column.id, true)}
                    />
                    <span>{column.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <div className="flex flex-none py-1 px-2.5 border-t border-divider">
        <button
          type="button"
          className={buttonClass({ variant: "quiet", size: "compact" })}
          onClick={reset}
          data-focus-key="reset"
        >
          Reset columns
        </button>
      </div>
    </div>
  );
}
