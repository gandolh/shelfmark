import { AddIcon, LibraryIcon, WishlistIcon } from "../components/icons";
import { Link } from "../components/Link";
import { ADD_BOOK, LIBRARY, WISHLIST, type Place } from "../router";

/**
 * The phone's three tabs at the bottom (the `Covers-Library` mock-up): Library,
 * Add a book and Wishlist, nothing else. 76 px tall plus the home-indicator area.
 */
// A tab: the icon over its label; the chosen one is accent and semibold, and the icon dips a little when pressed.
const ITEM =
  "flex flex-1 flex-col items-center justify-center gap-1 min-h-15 text-tab leading-meta font-regular text-muted no-underline transition-[color] duration-(--duration-fast) ease-out hover:text-ink-2 focus-visible:rounded-track focus-visible:outline-offset-[-6px] aria-[current]:font-semibold aria-[current]:text-accent hover:aria-[current]:font-semibold hover:aria-[current]:text-accent [&_svg]:transition-[transform] [&_svg]:duration-(--duration-fast) [&_svg]:ease-out active:[&_svg]:[transform:scale(0.92)]";

export function TabBar({ current, exact }: { current: Place | null; exact: boolean }) {
  const mark = (place: Place) => (current === place ? (exact ? "page" : "true") : undefined);

  return (
    <nav
      className="sticky bottom-0 z-bar flex h-[calc(var(--spacing-tabbar)-12px+max(12px,env(safe-area-inset-bottom)))] flex-none border-t border-hairline bg-ground pr-[env(safe-area-inset-right)] pb-[max(12px,env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)]"
      aria-label="Main"
    >
      <Link to={LIBRARY} className={ITEM} aria-current={mark("library")}>
        <LibraryIcon />
        <span>Library</span>
      </Link>
      <Link to={ADD_BOOK} className={ITEM} aria-current={mark("add")}>
        <AddIcon />
        <span>Add a book</span>
      </Link>
      <Link to={WISHLIST} className={ITEM} aria-current={mark("wishlist")}>
        <WishlistIcon />
        <span>Wishlist</span>
      </Link>
    </nav>
  );
}
