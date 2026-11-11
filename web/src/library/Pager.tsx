import { useState, type MouseEvent } from "react";
import { Menu } from "../components/ui/Menu";
import { pageCount, pageItems, pageRange, PAGE_SIZES, type PageSize } from "./pagination";

export interface PagerProps {
  /** The page on show, from 1. */
  page: number;
  pageCount: number;
  pageSize: PageSize;
  /** How many books the pages hold: every book the search and filters let through. */
  total: number;
  desktop: boolean;
  onPage: (page: number) => void;
  onPageSize: (size: PageSize) => void;
}

const number = (n: number) => n.toLocaleString("en-GB");

/** What the live region says after a turn: "Page 3 of 25, books 101 to 150 of 1,234". */
function where(page: number, pages: number, size: number, total: number): string {
  const { first, last } = pageRange(page, size, total);
  return `Page ${number(page)} of ${number(pages)}, books ${number(first)} to ${number(last)} of ${number(total)}`;
}

/**
 * The Library's page controls, under the table or the covers (design.md).
 * Desktop: the range on the left ("51–100 of 1,234"); on the right
 * Previous, the page numbers with gaps, Next and the "Per page" menu.
 * Phone: Previous, "Page 3 of 25" and Next, with "Per page" as accent text
 * under them. While a size over 10 puts everything on one page, only the
 * range (desktop) and "Per page" stay, so the size can go back down;
 * LibraryPage hides the pager otherwise (`showsPager`).
 *
 * Previous and Next at the ends are `aria-disabled` rather than disabled, so
 * the button just pressed keeps focus; the page buttons are keyed by number
 * and the current page is always among them, so a pressed number keeps it
 * too. A polite live region reads the new page and range after a turn.
 */
export function Pager({ page, pageCount: pages, pageSize, total, desktop, onPage, onPageSize }: PagerProps) {
  const [said, setSaid] = useState("");
  const { first, last } = pageRange(page, pageSize, total);

  const turn = (next: number) => (event: MouseEvent<HTMLButtonElement>) => {
    if (event.currentTarget.getAttribute("aria-disabled") === "true" || next === page || next < 1 || next > pages)
      return;
    onPage(next);
    setSaid(where(next, pages, pageSize, total));
  };

  const resize = (size: PageSize) => {
    if (size === pageSize) return;
    onPageSize(size);
    setSaid(`${size} per page. ${where(1, pageCount(total, size), size, total)}`);
  };

  const step = (label: "Previous" | "Next", next: number, blocked: boolean) => (
    <button
      type="button"
      className="button button--secondary button--regular"
      aria-disabled={blocked ? "true" : undefined}
      onClick={turn(next)}
    >
      {label}
    </button>
  );

  const perPage = (
    <Menu
      label="Books per page"
      trigger={`${pageSize} per page`}
      triggerClassName={desktop ? undefined : "button button--quiet button--regular menu-trigger"}
      align={desktop ? "end" : "start"}
      sections={[
        {
          label: "Books per page",
          items: PAGE_SIZES.map((size) => ({
            label: String(size),
            detail: size === pageSize ? "Current" : undefined,
            onSelect: () => resize(size),
          })),
        },
      ]}
    />
  );

  const live = (
    <span className="visually-hidden" role="status">
      {said}
    </span>
  );

  if (!desktop) {
    return (
      <nav className="library-pager library-pager--phone" aria-label="Pages">
        {pages > 1 && (
          <div className="library-pager__steps">
            {step("Previous", page - 1, page <= 1)}
            <p className="library-pager__where tabular">
              Page {number(page)} of {number(pages)}
            </p>
            {step("Next", page + 1, page >= pages)}
          </div>
        )}
        <div className="library-pager__size">{perPage}</div>
        {live}
      </nav>
    );
  }

  return (
    <nav className="library-pager library-pager--desktop" aria-label="Pages">
      <p className="library-pager__range tabular">
        {number(first)}–{number(last)} of {number(total)}
      </p>
      <div className="library-pager__end">
        {pages > 1 && (
          <>
            {step("Previous", page - 1, page <= 1)}
            <div className="library-pager__pages">
              {pageItems(page, pages).map((item, index) =>
                item === "gap" ? (
                  <span key={`gap-${index}`} className="library-pager__gap" aria-hidden="true">
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    className="library-pager__page tabular"
                    aria-current={item === page ? "page" : undefined}
                    aria-label={`Page ${number(item)}`}
                    onClick={turn(item)}
                  >
                    {number(item)}
                  </button>
                ),
              )}
            </div>
            {step("Next", page + 1, page >= pages)}
          </>
        )}
        {perPage}
      </div>
      {live}
    </nav>
  );
}
