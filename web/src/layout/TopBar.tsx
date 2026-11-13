import { Link } from "../components/Link";
import { segmentedItem, segmentedTrack } from "../components/segmented";
import { ADD_BOOK, LIBRARY, WISHLIST, type Place } from "../router";
import { AccountMenu } from "./AccountMenu";
import { SearchField } from "./SearchField";

/**
 * The desktop top bar, in three columns (the `Covers-Desktop` mock-up): the
 * wordmark; the three places as a segmented control, centred on the window;
 * the search box and the account button. `current` is the place the page is
 * in, and `exact` whether the page is that place itself (rather than, say, a
 * book inside the Library).
 */
export function TopBar({ current, exact }: { current: Place | null; exact: boolean }) {
  const mark = (place: Place) => (current === place ? (exact ? "page" : "true") : undefined);

  return (
    <header
      className="sticky top-0 z-bar grid h-topbar grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-6 border-b border-hairline bg-ground px-gutter-desktop"
      data-topbar
    >
      <Link
        to={LIBRARY}
        className="justify-self-start rounded-control font-book text-wordmark leading-heading font-semibold tracking-wordmark text-ink no-underline hover:text-ink"
      >
        Shelfmark
      </Link>
      <nav aria-label="Main" className={segmentedTrack("nav")}>
        <Link to={LIBRARY} className={segmentedItem("nav")} aria-current={mark("library")} data-label="Library">
          Library
        </Link>
        <Link to={ADD_BOOK} className={segmentedItem("nav")} aria-current={mark("add")} data-label="Add a book">
          Add a book
        </Link>
        <Link to={WISHLIST} className={segmentedItem("nav")} aria-current={mark("wishlist")} data-label="Wishlist">
          Wishlist
        </Link>
      </nav>
      <div className="flex min-w-0 items-center justify-end gap-3">
        <SearchField placement="bar" />
        <AccountMenu placement="bar" />
      </div>
    </header>
  );
}
