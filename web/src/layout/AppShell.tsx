import { lazy, Suspense, useEffect, type ComponentType } from "react";
import { AddBookPage } from "../add/AddBookPage";
import { BookPage } from "../book/BookPage";
import { ImportPage } from "../import/ImportPage";
import { StatsPage } from "../stats/StatsPage";
import { LibraryPage } from "../library/LibraryPage";
import {
  LIBRARY,
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
 * wants them all). `null` renders nothing: `/login` is the auth gate's
 * (brief 06), so a signed-in visit there goes on to the Library. A dev-only
 * screen is `import.meta.env.DEV ? lazy(() => import(…)) : null`, which a
 * build drops along with its chunk.
 */
const PAGES: { [N in RouteName]: PageComponent<N> | null } = {
  library: LibraryPage,
  add: AddBookPage,
  book: BookPage,
  import: ImportPage,
  stats: StatsPage,
  login: null,
  devScanner: import.meta.env.DEV ? lazy(() => import("../scanner/ScannerDemo")) : null,
};

/**
 * The signed-in app. Desktop (768 px and up): the top bar over the page.
 * Phone: the page, with its large title, over the two-tab bar. Exactly two
 * places, Library and Add a book; the account menu holds the rest.
 */
export function AppShell() {
  const route = useRoute();
  const pathname = usePathname();
  const desktop = useIsDesktop();

  // Unknown paths are the Library, and stray slashes are tidied, in place;
  // `/login` while signed in moves on to the Library.
  useEffect(() => {
    if (route.name === "login") navigate(LIBRARY, { replace: true });
    else if (pathname !== pathFor(route)) replaceWithCanonical(route);
  }, [pathname, route]);

  const place = placeOf(route);
  const exact = route.name === place;
  const Page = PAGES[route.name] as PageComponent<RouteName> | null;

  return (
    <div className={desktop ? "shell shell--desktop" : "shell shell--phone"}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {desktop && <TopBar current={place} exact={exact} />}
      <main id="main" className="shell__main" tabIndex={-1}>
        <Suspense fallback={null}>{Page && <Page key={pathFor(route)} params={route.params} />}</Suspense>
      </main>
      {!desktop && <TabBar current={place} exact={exact} />}
    </div>
  );
}
