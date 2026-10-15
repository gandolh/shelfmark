import { useLayoutEffect, useRef } from "react";
import { BOOK_COLUMN_ID, columnById, type ColumnId } from "./columns";
import { MoveDownIcon, MoveUpIcon } from "./icons";
import { PanelHeader } from "./Panel";
import { DEFAULT_ORDER, DEFAULT_VISIBILITY, type Layout } from "./prefs";
import { collator } from "./sort";
import { updatePrefs, useLibraryPrefs } from "./state";

/**
 * Which columns the table shows, and in what order. The shown ones are
 * listed in the table's order with Move up / Move down; the hidden ones
 * follow A to Z. Showing a column puts it at the table's end. The book
 * column always leads. Everything applies at once.
 */
export interface ColumnPickerProps {
  layout: Layout;
  /** A step back to the sheet it was opened from: the phone's "Filter and sort". */
  back?: { label: string; onClick: () => void };
  onClose: () => void;
}

export function ColumnPicker({ layout, back, onClose }: ColumnPickerProps) {
  const { columnOrder, columnVisibility } = useLibraryPrefs(layout);
  const shown = columnOrder.filter((id) => id === BOOK_COLUMN_ID || columnVisibility[id]);
  const hidden = columnOrder
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
      const next = [shown[index + 1], shown[index - 1]].find((other) => other !== undefined && other !== BOOK_COLUMN_ID);
      pendingFocus.current = `check:${next ?? id}`;
    }
    updatePrefs(layout, (prefs) => {
      const order = prefs.columnOrder.filter((other) => other !== id);
      if (show) {
        // After the last shown column: it appears at the table's end.
        const lastShown = order.reduce((last, other, i) => (prefs.columnVisibility[other] || other === BOOK_COLUMN_ID ? i : last), 0);
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
    updatePrefs(layout, (prefs) => ({ ...prefs, columnOrder: DEFAULT_ORDER, columnVisibility: DEFAULT_VISIBILITY, columnSizing: {} }));
  };

  return (
    <div className="library-panel__content">
      <PanelHeader title="Columns" back={back} onDone={onClose} />
      <div ref={list} className="library-panel__scroll">
        <section className="library-panel__section" aria-label="Shown">
          <h3 className="library-panel__label" aria-hidden="true">
            Shown, in order
          </h3>
          <ul className="library-picker" role="list">
            {shown.map((id, index) => {
              const column = columnById(id);
              const locked = id === BOOK_COLUMN_ID;
              return (
                <li key={id} className="library-picker__row">
                  <label className="library-picker__check">
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
                    <span className="library-picker__note">Always first</span>
                  ) : (
                    <span className="library-picker__moves">
                      <button
                        type="button"
                        className="library-icon-button"
                        aria-label={`Move ${column.label} up`}
                        disabled={index <= 1}
                        data-focus-key={`up:${id}`}
                        onClick={() => move(id, -1)}
                      >
                        <MoveUpIcon size={16} />
                      </button>
                      <button
                        type="button"
                        className="library-icon-button"
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
          <section className="library-panel__section" aria-label="Hidden">
            <h3 className="library-panel__label" aria-hidden="true">
              Hidden
            </h3>
            <ul className="library-picker" role="list">
              {hidden.map((column) => (
                <li key={column.id} className="library-picker__row">
                  <label className="library-picker__check">
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
      <div className="library-panel__foot">
        <button type="button" className="button button--quiet button--compact" onClick={reset} data-focus-key="reset">
          Reset columns
        </button>
      </div>
    </div>
  );
}
