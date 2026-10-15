import { useEffect, type MouseEvent, type ReactNode } from "react";
import { BackIcon } from "../components/icons";
import { Link } from "../components/Link";
import { goBack, type Route } from "../router";
import { AccountMenu } from "./AccountMenu";
import { SearchField } from "./SearchField";
import { useIsDesktop } from "./viewport";

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
  children?: ReactNode;
}

/**
 * The frame of every page inside the shell: the title, its caption and
 * toolbar, then the content. On a phone the header also carries the
 * account button beside the title, as in the `Covers-Library` mock-up.
 */
export function Page({ title, caption, toolbar, search, back, bleed = false, children }: PageProps) {
  const desktop = useIsDesktop();
  const hidden = bleed && !desktop;

  useEffect(() => {
    document.title = `${title} · Shelfmark`;
  }, [title]);

  const heading = (
    <div className="page__heading">
      <h1 className="page__title">{title}</h1>
      {caption && <p className="page__caption">{caption}</p>}
    </div>
  );

  return (
    <div className={["page", hidden ? "page--bleed" : null].filter(Boolean).join(" ")}>
      {hidden ? (
        <h1 className="visually-hidden">{title}</h1>
      ) : (
        <header className="page__header">
          {back && <BackLink to={back.to} label={back.label} />}
          {desktop ? (
            <div className="page__headrow">
              {heading}
              {toolbar && <div className="page__toolbar">{toolbar}</div>}
            </div>
          ) : (
            <>
              <div className="page__headrow">
                {heading}
                <AccountMenu placement="header" />
              </div>
              {search && (
                <SearchField placement="header" placeholder={typeof search === "object" ? search.placeholder : "Search"} />
              )}
              {toolbar && <div className="page__toolbar">{toolbar}</div>}
            </>
          )}
        </header>
      )}
      <div className="page__body">{children}</div>
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
    <Link to={to} className="page__back" onClick={onClick}>
      <BackIcon size={18} />
      {label}
    </Link>
  );
}
