import { buttonClass } from "../components/Button";
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
      className={buttonClass({ variant: "secondary", size: "regular" })}
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
      triggerClassName={desktop ? undefined : buttonClass({ variant: "quiet", size: "regular" })}
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
    <span className="sr-only" role="status">
      {said}
    </span>
  );

  if (!desktop) {
    return (
      <nav className="mt-3.5 flex flex-col items-stretch gap-1 text-body text-ink-2" aria-label="Pages">
        {pages > 1 && (
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 [&>:first-child]:justify-self-start [&>:last-child]:justify-self-end">
            {step("Previous", page - 1, page <= 1)}
            <p className="text-center whitespace-nowrap text-ink-2 tabular-nums">
              Page {number(page)} of {number(pages)}
            </p>
            {step("Next", page + 1, page >= pages)}
          </div>
        )}
        <div className="flex justify-center">{perPage}</div>
        {live}
      </nav>
    );
  }

  return (
    <nav
      className="mt-4.5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-meta text-ink-2"
      aria-label="Pages"
    >
      <p className="text-muted tabular-nums">
        {number(first)}–{number(last)} of {number(total)}
      </p>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        {pages > 1 && (
          <>
            {step("Previous", page - 1, page <= 1)}
            <div className="flex items-center gap-0.5">
              {pageItems(page, pages).map((item, index) =>
                item === "gap" ? (
                  <span key={`gap-${index}`} className="min-w-5 text-center text-muted select-none" aria-hidden="true">
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    className="h-control min-w-control cursor-pointer rounded-control px-1.5 text-ink-2 tabular-nums transition-[background-color,color] duration-(--duration-fast) ease-out hover:bg-control hover:text-ink aria-[current=page]:cursor-default aria-[current=page]:bg-accent-tint aria-[current=page]:font-semibold aria-[current=page]:text-accent-press"
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
