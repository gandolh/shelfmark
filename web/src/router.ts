import { useMemo, useSyncExternalStore } from "react";
import { appBase } from "./base";

/**
 * The router, without a library: the History API under the app's base
 * (`/shelfmark/` by default). A route is one line in `APP_ROUTES`; a `:name`
 * segment is a parameter, handed to the page as a decoded string.
 *
 *   /shelfmark/            library   the Library
 *   /shelfmark/add         add       Add a book
 *   /shelfmark/books/:id   book      one book
 *   /shelfmark/login       login     signing in (brief 06)
 *
 * Anything else is the Library, and the shell rewrites the address to `/shelfmark/`.
 * Each route also needs its page in `PAGES` (layout/AppShell.tsx); the
 * typecheck says so when one is missing.
 */
const APP_ROUTES = {
  library: "/",
  add: "/add",
  book: "/books/:id",
  login: "/login",
} as const;

/**
 * Screens for development only, matched under `vite dev` and never in a build
 * (`import.meta.env.DEV` is a constant there, so the branch is dropped). One
 * line each, e.g. `devScanner: "/dev/scanner",`, and its page in `PAGES` as
 * `devScanner: import.meta.env.DEV ? lazy(() => import("../scanner/DevPage")) : null`.
 */
const DEV_ROUTES = {
  devScanner: "/dev/scanner",
} as const;

/** Every route the app knows, by name. */
export const ROUTES = { ...APP_ROUTES, ...DEV_ROUTES } as const;

export type RouteName = keyof typeof ROUTES;

/** `"/books/:id"` → `"id"`. */
type ParamNames<P extends string> = P extends `${string}:${infer Name}/${infer Rest}`
  ? Name | ParamNames<`/${Rest}`>
  : P extends `${string}:${infer Name}`
    ? Name
    : never;

/** A route's parameters, decoded: `{ id: "12" }` for `book`, `{}` for the rest. */
export type RouteParams<N extends RouteName> = { [K in ParamNames<(typeof ROUTES)[N]>]: string };

export type Route = { [N in RouteName]: { name: N; params: RouteParams<N> } }[RouteName];
export type RouteOf<N extends RouteName> = Extract<Route, { name: N }>;

export const LIBRARY: RouteOf<"library"> = { name: "library", params: {} };
export const ADD_BOOK: RouteOf<"add"> = { name: "add", params: {} };
export const LOGIN: RouteOf<"login"> = { name: "login", params: {} };

export function bookRoute(id: number | string): RouteOf<"book"> {
  return { name: "book", params: { id: String(id) } };
}

/** Any route by name: `route("book", { id: "12" })`. */
export function route<N extends RouteName>(name: N, params: RouteParams<N>): RouteOf<N> {
  return { name, params } as RouteOf<N>;
}

// --- Matching -------------------------------------------------------------------

type RouteTable = Readonly<Record<string, string>>;

/** The table matched right now: dev screens only under `vite dev`. */
function activeTable(): RouteTable {
  return import.meta.env.DEV ? ROUTES : APP_ROUTES;
}

function segments(path: string): string[] {
  return path.split("/").filter((segment) => segment !== "");
}

/**
 * Which route a pathname is, or `null` for one the app doesn't have (and for
 * any path outside the base). Trailing and doubled slashes are forgiven; the
 * shell then rewrites the address to the canonical one.
 */
export function matchRoute(pathname: string, base: string = appBase(), table: RouteTable = activeTable()): Route | null {
  const root = base.replace(/\/+$/, "");
  if (pathname !== root && !pathname.startsWith(`${root}/`)) return null;
  const parts = segments(pathname.slice(root.length));

  for (const [name, pattern] of Object.entries(table)) {
    const expected = segments(pattern);
    if (expected.length !== parts.length) continue;
    const params: Record<string, string> = {};
    const matches = expected.every((segment, index) => {
      const part = parts[index] ?? "";
      if (!segment.startsWith(":")) return segment === part;
      const value = decode(part);
      if (value === null || value.trim() === "") return false;
      params[segment.slice(1)] = value;
      return true;
    });
    if (matches) return { name, params } as Route;
  }
  return null;
}

/** A path segment decoded, or `null` for a malformed escape such as `%E0%A4%A`. */
function decode(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/** The canonical path of a route under the base: `/shelfmark/books/12`. */
export function pathFor(to: Route, base: string = appBase()): string {
  const pattern: string = ROUTES[to.name];
  const params = to.params as Record<string, string>;
  const filled = segments(pattern).map((segment) =>
    segment.startsWith(":") ? encodeURIComponent(params[segment.slice(1)] ?? "") : segment,
  );
  return `${base}${filled.join("/")}`;
}

export function sameRoute(a: Route, b: Route): boolean {
  return a.name === b.name && pathFor(a, "/") === pathFor(b, "/");
}

/** The two places (design.md): every route belongs to one of them, or to neither. */
export type Place = "library" | "add";

export function placeOf(to: Route): Place | null {
  switch (to.name) {
    case "library":
    case "book":
      return "library";
    case "add":
      return "add";
    default:
      return null;
  }
}

// --- Navigation -----------------------------------------------------------------

const NAVIGATE_EVENT = "shelfmark:navigate";

/**
 * Kept on each history entry: how many in-app entries sit behind it, and the
 * path of the one just behind, so a back link can tell whether the browser's
 * Back would land where it says.
 */
interface HistoryState {
  shelfmarkDepth?: number;
  shelfmarkFrom?: string;
}

function currentState(): HistoryState {
  return (window.history.state as HistoryState | null) ?? {};
}

function depth(): number {
  const { shelfmarkDepth } = currentState();
  return typeof shelfmarkDepth === "number" ? shelfmarkDepth : 0;
}

/** Go to a route without a reload. `replace` swaps the current history entry instead of adding one. */
export function navigate(to: Route, options: { replace?: boolean } = {}): void {
  const path = pathFor(to);
  if (options.replace) {
    window.history.replaceState({ ...currentState() } satisfies HistoryState, "", path);
  } else {
    if (window.location.pathname === path) return;
    const entry: HistoryState = { shelfmarkDepth: depth() + 1, shelfmarkFrom: window.location.pathname };
    window.history.pushState(entry, "", path);
    // A new page starts at its top; Back and Forward keep the browser's own restoring.
    window.scrollTo(0, 0);
  }
  window.dispatchEvent(new Event(NAVIGATE_EVENT));
}

/**
 * Rewrite the address to the route's canonical path, keeping the query and
 * the hash (a sign-in callback's, say). For the shell's tidy-up of unknown
 * paths and stray slashes.
 */
export function replaceWithCanonical(to: Route): void {
  const { search, hash } = window.location;
  window.history.replaceState({ ...currentState() } satisfies HistoryState, "", `${pathFor(to)}${search}${hash}`);
  window.dispatchEvent(new Event(NAVIGATE_EVENT));
}

/**
 * A back link to `to`: the browser's Back when the entry behind this one is
 * `to` (so the Library comes back scrolled as it was left), otherwise (a deep
 * link, a fresh tab, arriving from elsewhere) a plain visit to `to`.
 */
export function goBack(to: Route = LIBRARY): void {
  const { shelfmarkFrom } = currentState();
  if (depth() > 0 && shelfmarkFrom === pathFor(to)) window.history.back();
  else navigate(to);
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  window.addEventListener(NAVIGATE_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(NAVIGATE_EVENT, onChange);
  };
}

function currentPathname(): string {
  return window.location.pathname;
}

/** The raw pathname; re-renders on navigation and on Back/Forward. */
export function usePathname(): string {
  return useSyncExternalStore(subscribe, currentPathname);
}

/** The current route, or `null` when the address is not one the app has. */
export function useMatchedRoute(): Route | null {
  const pathname = usePathname();
  return useMemo(() => matchRoute(pathname), [pathname]);
}

/** The current route; an unknown address is the Library. */
export function useRoute(): Route {
  return useMatchedRoute() ?? LIBRARY;
}
