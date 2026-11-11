import { AddIcon, LibraryIcon, WishlistIcon } from "../components/icons";
import { Link } from "../components/Link";
import { ADD_BOOK, LIBRARY, WISHLIST, type Place } from "../router";

/**
 * The phone's three tabs at the bottom (the `Covers-Library` mock-up): Library,
 * Add a book and Wishlist, nothing else. 76 px tall plus the home-indicator area.
 */
export function TabBar({ current, exact }: { current: Place | null; exact: boolean }) {
  const mark = (place: Place) => (current === place ? (exact ? "page" : "true") : undefined);

  return (
    <nav className="tabbar" aria-label="Main">
      <Link to={LIBRARY} className="tabbar__item" aria-current={mark("library")}>
        <LibraryIcon />
        <span>Library</span>
      </Link>
      <Link to={ADD_BOOK} className="tabbar__item" aria-current={mark("add")}>
        <AddIcon />
        <span>Add a book</span>
      </Link>
      <Link to={WISHLIST} className="tabbar__item" aria-current={mark("wishlist")}>
        <WishlistIcon />
        <span>Wishlist</span>
      </Link>
    </nav>
  );
}
