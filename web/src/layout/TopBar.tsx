import { Link } from "../components/Link";
import { ADD_BOOK, LIBRARY, type Place } from "../router";
import { AccountMenu } from "./AccountMenu";
import { SearchField } from "./SearchField";

/**
 * The desktop top bar, in three columns (the `Covers-Desktop` mock-up): the
 * wordmark; the two places as a segmented control, centred on the window;
 * the search box and the account button. `current` is the place the page is
 * in, and `exact` whether the page is that place itself (rather than, say, a
 * book inside the Library).
 */
export function TopBar({ current, exact }: { current: Place | null; exact: boolean }) {
  const mark = (place: Place) => (current === place ? (exact ? "page" : "true") : undefined);

  return (
    <header className="topbar">
      <Link to={LIBRARY} className="topbar__wordmark">
        Shelfmark
      </Link>
      <nav aria-label="Main" className="segmented segmented--nav">
        <Link to={LIBRARY} className="segmented__item" aria-current={mark("library")} data-label="Library">
          Library
        </Link>
        <Link to={ADD_BOOK} className="segmented__item" aria-current={mark("add")} data-label="Add a book">
          Add a book
        </Link>
      </nav>
      <div className="topbar__end">
        <SearchField placement="bar" />
        <AccountMenu placement="bar" />
      </div>
    </header>
  );
}
