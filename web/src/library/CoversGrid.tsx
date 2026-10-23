import type { Book } from "@shelfmark/shared";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { authorLine } from "../components/cover";
import { CoverImage } from "../components/CoverImage";
import { CheckIcon } from "../components/icons";
import { Link } from "../components/Link";
import { bookRoute } from "../router";
import { TAB_BAR_HEIGHT } from "../layout/viewport";
import type { Layout } from "./prefs";
import { rememberScroll } from "./scroll";
import { isSelected, toggleBook, withBooks } from "./selection";
import { getSelection, setSelection, useLibrarySelection } from "./state";

/**
 * The Covers view (the `Covers-Library` mock-up): a grid of covers, each
 * with a two-line title and the author, three across on a phone and as
 * many as fit on a desktop. Rows of covers are virtual, so 3,000 books
 * scroll as lightly as thirty. Tab reaches one cover; arrows move around
 * the grid; Enter opens the book.
 *
 * Selecting (brief 26): a long press on a cover selects it, as a phone's
 * photo grid does (a finger or a pen anywhere; the mouse too on a phone's
 * layout). While books are selected (`selecting`, the bulk bar is up) each
 * cover is a toggle with a mark in its corner: a tap, Enter or Space ticks
 * or unticks it, and nothing opens until the bar's Clear.
 */

/** How long a press lasts before it selects, and how far the finger may wander meanwhile. */
const LONG_PRESS_MS = 500;
const LONG_PRESS_SLOP = 10;

const PHONE_COLUMNS = 3;
const DESKTOP_MIN_WIDTH = 132; // a cover's narrowest on the desktop
const DESKTOP_GAP = 24;
const PHONE_GAP = 14;
const ROW_GAP = { desktop: 28, phone: 18 };
// Under the cover: the gap, two lines of title and one of author.
const CAPTION = { desktop: 8 + 2 * 17.5 + 2 + 18, phone: 8 + 2 * 16.25 + 2 + 16.8 };

export interface CoversGridProps {
  rows: readonly Book[];
  layout: Layout;
  /** Books are selected: a cover ticks instead of opening. */
  selecting: boolean;
}

export function CoversGrid({ rows, layout, selecting }: CoversGridProps) {
  const desktop = layout === "desktop";
  const selection = useLibrarySelection();
  const grid = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, margin: 0 });

  useLayoutEffect(() => {
    const element = grid.current;
    if (!element) return;
    const measure = () => {
      const width = element.clientWidth;
      const margin = Math.round(element.getBoundingClientRect().top + window.scrollY);
      setBox((old) => (old.width === width && old.margin === margin ? old : { width, margin }));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    observer.observe(element.closest(".page") ?? document.body);
    return () => observer.disconnect();
  }, []);

  const gap = desktop ? DESKTOP_GAP : PHONE_GAP;
  const columns = desktop ? Math.max(3, Math.floor((box.width + gap) / (DESKTOP_MIN_WIDTH + gap))) : PHONE_COLUMNS;
  const coverWidth = box.width > 0 ? (box.width - gap * (columns - 1)) / columns : 110;
  const rowHeight = coverWidth * 1.5 + CAPTION[layout] + ROW_GAP[layout];
  const rowCount = Math.ceil(rows.length / columns);

  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => rowHeight,
    overscan: 3,
    scrollMargin: box.margin,
    scrollPaddingEnd: desktop ? 0 : TAB_BAR_HEIGHT,
    initialOffset: () => window.scrollY,
  });

  // Measured rows keep their old heights when the width changes; start over.
  useLayoutEffect(() => {
    virtualizer.measure();
  }, [virtualizer, rowHeight, columns]);

  // --- Keyboard: one cover in the Tab order, arrows around the grid -----------------

  const [active, setActive] = useState(0);
  const pendingFocus = useRef<number | null>(null);
  const items = virtualizer.getVirtualItems();
  const firstShown = (items[0]?.index ?? 0) * columns;
  const lastShown = ((items.at(-1)?.index ?? 0) + 1) * columns - 1;
  const tabbable = active >= firstShown && active <= lastShown && active < rows.length ? active : firstShown;

  useLayoutEffect(() => {
    const index = pendingFocus.current;
    if (index === null) return;
    const link = grid.current?.querySelector<HTMLElement>(`[data-book-index="${index}"]`);
    if (link) {
      pendingFocus.current = null;
      link.focus({ preventScroll: true });
    }
  });

  const onKeyDown = (event: KeyboardEvent<HTMLElement>, index: number) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const page = Math.max(1, Math.floor(window.innerHeight / rowHeight)) * columns;
    const steps: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      ArrowDown: index + columns,
      ArrowUp: index - columns,
      PageDown: index + page,
      PageUp: index - page,
      Home: 0,
      End: rows.length - 1,
    };
    const target = steps[event.key];
    if (target === undefined) return;
    event.preventDefault();
    const next = Math.max(0, Math.min(rows.length - 1, target));
    setActive(next);
    pendingFocus.current = next;
    virtualizer.scrollToIndex(Math.floor(next / columns), { align: "auto" });
  };

  // --- A long press selects ------------------------------------------------------------

  const press = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
  // The click that ends a long press must not open the book (or untick it).
  const pressed = useRef(false);
  const lastPointer = useRef<string>("mouse");

  const cancelPress = () => {
    if (press.current) clearTimeout(press.current.timer);
    press.current = null;
  };
  useEffect(() => cancelPress, []);

  const selectNow = (book: Book) => {
    cancelPress();
    pressed.current = true;
    setSelection(withBooks(getSelection(), [book], true));
  };

  const onPointerDown = (event: PointerEvent<HTMLElement>, book: Book) => {
    lastPointer.current = event.pointerType;
    pressed.current = false;
    cancelPress();
    if (event.button !== 0 || (event.pointerType === "mouse" && desktop)) return;
    press.current = { timer: setTimeout(() => selectNow(book), LONG_PRESS_MS), x: event.clientX, y: event.clientY };
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const start = press.current;
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > LONG_PRESS_SLOP) cancelPress();
  };

  const onClick = (event: MouseEvent<HTMLElement>, book: Book) => {
    if (pressed.current) {
      pressed.current = false;
      event.preventDefault();
      return;
    }
    if (selecting) {
      event.preventDefault();
      setSelection(toggleBook(getSelection(), book));
      return;
    }
    rememberScroll();
  };

  // A long touch on a link opens the browser's link menu (Android); the press is ours.
  const onContextMenu = (event: MouseEvent<HTMLElement>, book: Book) => {
    if (lastPointer.current === "mouse") return;
    event.preventDefault();
    if (press.current) selectNow(book);
  };

  return (
    <div
      ref={grid}
      className={`library-covers library-covers--${layout}`}
      role="list"
      aria-label="Books"
      style={{ height: virtualizer.getTotalSize() }}
    >
      {items.map((item) => {
        const start = item.index * columns;
        const slice = rows.slice(start, start + columns);
        return (
          <div
            key={item.key}
            role="none"
            data-index={item.index}
            ref={virtualizer.measureElement}
            className="library-covers__row"
            style={{
              transform: `translateY(${item.start - virtualizer.options.scrollMargin}px)`,
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              columnGap: gap,
              paddingBottom: ROW_GAP[layout],
            }}
          >
            {slice.map((book, offset) => {
              const index = start + offset;
              const author = authorLine(book.authors);
              const selected = isSelected(selection, book);
              const shared = {
                className: "library-cover",
                "data-book-index": index,
                "data-selected": selected ? "" : undefined,
                tabIndex: index === tabbable ? 0 : -1,
                onFocus: () => setActive(index),
                onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
                  pressed.current = false; // a key's click is never a long press's
                  onKeyDown(event, index);
                },
                onPointerDown: (event: PointerEvent<HTMLElement>) => onPointerDown(event, book),
                onPointerMove,
                onPointerUp: cancelPress,
                onPointerCancel: cancelPress,
                onPointerLeave: cancelPress,
                onContextMenu: (event: MouseEvent<HTMLElement>) => onContextMenu(event, book),
                onClick: (event: MouseEvent<HTMLElement>) => onClick(event, book),
              };
              const content = (
                <>
                  <CoverImage book={book} />
                  {selecting && (
                    <span className="library-cover__check" aria-hidden="true">
                      {selected && <CheckIcon size={16} />}
                    </span>
                  )}
                  <span className="library-cover__title">{book.title}</span>
                  {author && <span className="library-cover__author">{author}</span>}
                </>
              );
              return (
                <div key={book.id} role="listitem" aria-posinset={index + 1} aria-setsize={rows.length}>
                  {selecting ? (
                    <button type="button" aria-pressed={selected} {...shared}>
                      {content}
                    </button>
                  ) : (
                    <Link to={bookRoute(book.id)} {...shared}>
                      {content}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
