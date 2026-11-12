import { cn } from "../lib/cn";
import { useEffect, type MouseEvent, type ReactNode } from "react";
import { BackIcon } from "../components/icons";
import { Link } from "../components/Link";
import { goBack, type Route } from "../router";
import { AccountMenu } from "./AccountMenu";
import { SearchField } from "./SearchField";
import { useIsDesktop } from "./viewport";

const HEADROW = "flex flex-wrap items-end justify-between gap-4 max-md:flex-nowrap max-md:items-center";
const BOOK_HEADROW = "md:max-w-[1020px]";
const TOOLBAR = "flex flex-wrap items-center gap-2 max-md:justify-between";

export interface PageProps {
  /** The page's `<h1>` and the window's title: 34 px on the desktop, the large 32 px title on a phone. */
  title: string;
  /** A line under the title: "14 books, newest first". */
  caption?: ReactNode;
  /** Controls for the page. Desktop: on the title's right. Phone: a row under the title (and the search box). */
  toolbar?: ReactNode;
  /**
   * Show the search box under the phone title (on the desktop it is always
   * in the top bar). `{ placeholder }` words it: "Search 14 books".
   */
  search?: boolean | { placeholder: string };
  /** A link back, over the title: `{ to: LIBRARY, label: "Library" }`. Uses the browser's Back when it can. */
  back?: { to: Route; label: string };
  /**
   * Phone only: no visible header and no padding, the content filling the
   * screen down to the tab bar (Add a book's camera). The title stays for
   * screen readers. No effect on the desktop.
   */
  bleed?: boolean;
  /** Desktop only: the window's width less the gutters, instead of the 1180 px column (the Library). */
  wide?: boolean;
  /** The header (title, caption, toolbar; on a phone the search box too) on a white card like the table's container. */
  card?: boolean;
  /** The book page's two columns (260 + 40 + 720 px): the heading row stays as wide as they are, on the desktop. */
  book?: boolean;
  children?: ReactNode;
}

/**
 * The frame of every page inside the shell: the title, its caption and
 * toolbar, then the content. On a phone the header also carries the
 * account button beside the title, as in the `Covers-Library` mock-up.
 */
export function Page({
  title,
  caption,
  toolbar,
  search,
  back,
  bleed = false,
  wide = false,
  card = false,
  book = false,
  children,
}: PageProps) {
  const desktop = useIsDesktop();
  const hidden = bleed && !desktop;

  useEffect(() => {
    document.title = `${title} · Shelfmark`;
  }, [title]);

  const heading = (
    <div className="flex min-w-0 flex-col gap-0.5">
      <h1 className="text-title leading-[1.15] font-bold tracking-title max-md:text-title-phone">{title}</h1>
      {caption && <p className="text-muted tabular-nums">{caption}</p>}
    </div>
  );

  return (
    <div
      className={cn(
        "flex flex-[1_0_auto] flex-col md:mx-auto md:w-full md:max-w-page md:gap-4.5 md:px-gutter-desktop md:pt-9 md:pb-12",
        wide && "md:max-w-none",
      )}
    >
      {hidden ? (
        <h1 className="sr-only">{title}</h1>
      ) : (
        <header
          className={cn(
            "flex flex-col gap-2.5 max-md:px-gutter-phone max-md:pt-3.5 max-md:pb-3",
            card && "rounded-container bg-surface md:px-6 md:py-5.5 max-md:mb-2.5 max-md:rounded-t-none",
          )}
        >
          {back && <BackLink to={back.to} label={back.label} />}
          {desktop ? (
            <div className={cn(HEADROW, book && BOOK_HEADROW)}>
              {heading}
              {toolbar && <div className={TOOLBAR}>{toolbar}</div>}
            </div>
          ) : (
            <>
              <div className={cn(HEADROW, book && BOOK_HEADROW)}>
                {heading}
                <AccountMenu placement="header" />
              </div>
              {search && (
                <SearchField
                  placement="header"
                  placeholder={typeof search === "object" ? search.placeholder : "Search"}
                />
              )}
              {toolbar && <div className={TOOLBAR}>{toolbar}</div>}
            </>
          )}
        </header>
      )}
      <div
        className={cn(
          "max-md:px-gutter-phone max-md:pt-1 max-md:pb-6",
          hidden && "flex flex-[1_0_auto] flex-col max-md:p-0",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function BackLink({ to, label }: { to: Route; label: string }) {
  // Back through history when the Library is behind this page, so it comes
  // back scrolled and filtered as it was left; a deep link gets the route.
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    goBack(to);
  };
  return (
    <Link
      to={to}
      className="-ml-1.5 inline-flex min-h-8 items-center gap-0.5 self-start rounded-control pr-1.5 text-body no-underline max-md:-mt-1.5 max-md:-mb-1 max-md:min-h-touch"
      onClick={onClick}
    >
      <BackIcon size={18} />
      {label}
    </Link>
  );
}
