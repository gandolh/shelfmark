import { lazy, Suspense, useEffect, type ComponentType } from "react";
import { AddBookPage } from "../add/AddBookPage";
import { WishlistPage } from "../wishlist/WishlistPage";
import { BookPage } from "../book/BookPage";
import { ImportPage } from "../import/ImportPage";
import { StatsPage } from "../stats/StatsPage";
import { LibraryPage } from "../library/LibraryPage";
import {
  LIBRARY,
  WISHLIST,
  navigate,
  pathFor,
  placeOf,
  replaceWithCanonical,
  usePathname,
  useRoute,
  type RouteName,
  type RouteParams,
} from "../router";
import { TabBar } from "./TabBar";
import { TopBar } from "./TopBar";
import { useIsDesktop } from "./viewport";

type PageComponent<N extends RouteName> = ComponentType<{ params: RouteParams<N> }>;

/**
 * Each route's page, one line per route in router.ts's table (the typecheck
 * wants them all). `null` renders nothing: `/login` is the auth gate's,
 * so a signed-in visit there goes on to the Library. A dev-only
 * screen is `import.meta.env.DEV ? lazy(() => import(…)) : null`, which a
 * build drops along with its chunk.
 */
const PAGES: { [N in RouteName]: PageComponent<N> | null } = {
  library: LibraryPage,
  add: () => <AddBookPage />,
  wishlist: WishlistPage,
  addWishlist: () => <AddBookPage target="wishlist" />,
  book: BookPage,
  import: ImportPage,
  stats: StatsPage,
  login: null,
  devScanner: import.meta.env.DEV ? lazy(() => import("../scanner/ScannerDemo")) : null,
};

/**
 * The signed-in app. Desktop (768 px and up): the top bar over the page.
 * Phone: the page, with its large title, over the three-tab bar. Exactly three
 * places, Library, Add a book and Wishlist; the account menu holds the rest.
 */
export function AppShell() {
  const route = useRoute();
  const pathname = usePathname();
  const desktop = useIsDesktop();

  // Unknown paths are the Library, and stray slashes are tidied, in place;
  // `/login` while signed in moves on to the Library.
  useEffect(() => {
    if (route.name === "login") navigate(LIBRARY, { replace: true });
    // A link from before the Wishlist became a place of its own.
    else if (route.name === "library" && new URLSearchParams(window.location.search).get("collection") === "wishlist") {
      navigate(WISHLIST, { replace: true });
    } else if (pathname !== pathFor(route)) replaceWithCanonical(route);
  }, [pathname, route]);

  const place = placeOf(route);
  const exact = route.name === place;
  const Page = PAGES[route.name] as PageComponent<RouteName> | null;

  return (
    <div className="flex min-h-dvh flex-col max-md:pt-[env(safe-area-inset-top)] max-md:leading-phone">
      <a
        className="fixed top-3 left-3 z-[calc(var(--z-index-float)+1)] -translate-y-[calc(100%+24px)] rounded-control bg-surface px-3.5 py-2.5 font-semibold no-underline focus-visible:translate-y-0 focus-visible:shadow-float"
        href="#main"
      >
        Skip to content
      </a>
      {desktop && <TopBar current={place} exact={exact} />}
      <main id="main" className="flex flex-[1_0_auto] flex-col focus:outline-none" tabIndex={-1}>
        <Suspense fallback={null}>{Page && <Page key={pathFor(route)} params={route.params} />}</Suspense>
      </main>
      {!desktop && <TabBar current={place} exact={exact} />}
    </div>
  );
}
