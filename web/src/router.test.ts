import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ADD_BOOK,
  bookRoute,
  goBack,
  LIBRARY,
  LOGIN,
  matchRoute,
  navigate,
  pathFor,
  placeOf,
  replaceWithCanonical,
  route,
  ROUTES,
  sameRoute,
  type Route,
} from "./router";

const BASE = "/shelfmark/";

describe("matchRoute", () => {
  it("matches the four routes", () => {
    expect(matchRoute("/shelfmark/", BASE)).toEqual(LIBRARY);
    expect(matchRoute("/shelfmark", BASE)).toEqual(LIBRARY);
    expect(matchRoute("/shelfmark/add", BASE)).toEqual(ADD_BOOK);
    expect(matchRoute("/shelfmark/add/", BASE)).toEqual(ADD_BOOK);
    expect(matchRoute("/shelfmark/login", BASE)).toEqual(LOGIN);
    expect(matchRoute("/shelfmark/books/12", BASE)).toEqual({ name: "book", params: { id: "12" } });
    expect(matchRoute("/shelfmark/books/12/", BASE)).toEqual(bookRoute(12));
  });

  it("forgives doubled slashes", () => {
    expect(matchRoute("/shelfmark//books//7", BASE)).toEqual(bookRoute(7));
  });

  it("decodes a parameter", () => {
    expect(matchRoute("/shelfmark/books/a%20b", BASE)).toEqual(bookRoute("a b"));
  });

  it("has no route for unknown paths, paths outside the base, or broken parameters", () => {
    for (const path of [
      "/shelfmark/nope",
      "/shelfmark/books",
      "/shelfmark/books/",
      "/shelfmark/books/1/2",
      "/shelfmark/books/%E0%A4%A",
      "/shelfmark/books/%20",
      "/shelfmark/add/extra",
      "/shelfmarkx/add",
      "/satchel/add",
      "/",
    ]) {
      expect(matchRoute(path, BASE), path).toBeNull();
    }
  });

  it("follows a different base", () => {
    expect(matchRoute("/", "/")).toEqual(LIBRARY);
    expect(matchRoute("/books/3", "/")).toEqual(bookRoute(3));
    expect(matchRoute("/apps/shelfmark/add", "/apps/shelfmark/")).toEqual(ADD_BOOK);
    expect(matchRoute("/apps/shelfmark", "/apps/shelfmark/")).toEqual(LIBRARY);
    expect(matchRoute("/shelfmark/add", "/apps/shelfmark/")).toBeNull();
  });

  it("reads the base from the build when none is given", () => {
    vi.stubEnv("BASE_URL", "/elsewhere/");
    try {
      expect(matchRoute("/elsewhere/add")).toEqual(ADD_BOOK);
      expect(matchRoute("/shelfmark/add")).toBeNull();
      expect(pathFor(bookRoute(5))).toBe("/elsewhere/books/5");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("takes a new route from one table line, parameters and all", () => {
    const table = { ...ROUTES, devExample: "/dev/example", shelf: "/shelves/:room/:shelf" };
    expect(matchRoute("/shelfmark/dev/example", BASE, table)).toEqual({ name: "devExample", params: {} });
    expect(matchRoute("/shelfmark/shelves/Living%20room/A2", BASE, table)).toEqual({
      name: "shelf",
      params: { room: "Living room", shelf: "A2" },
    });
    // The real table has no such route.
    expect(matchRoute("/shelfmark/dev/example", BASE)).toBeNull();
  });
});

describe("pathFor", () => {
  it("writes the canonical paths", () => {
    expect(pathFor(LIBRARY, BASE)).toBe("/shelfmark/");
    expect(pathFor(ADD_BOOK, BASE)).toBe("/shelfmark/add");
    expect(pathFor(LOGIN, BASE)).toBe("/shelfmark/login");
    expect(pathFor(bookRoute(12), BASE)).toBe("/shelfmark/books/12");
    expect(pathFor(LIBRARY, "/")).toBe("/");
  });

  it("round-trips through matchRoute", () => {
    const routes: Route[] = [LIBRARY, ADD_BOOK, LOGIN, bookRoute(1), bookRoute("with/slash and space"), route("book", { id: "ș" })];
    for (const each of routes) {
      const path = pathFor(each, BASE);
      expect(path.startsWith(BASE)).toBe(true);
      expect(matchRoute(path, BASE)).toEqual(each);
    }
  });
});

describe("sameRoute and placeOf", () => {
  it("compares names and parameters", () => {
    expect(sameRoute(bookRoute(1), bookRoute("1"))).toBe(true);
    expect(sameRoute(bookRoute(1), bookRoute(2))).toBe(false);
    expect(sameRoute(LIBRARY, ADD_BOOK)).toBe(false);
  });

  it("puts a book inside the Library, and login in no place", () => {
    expect(placeOf(LIBRARY)).toBe("library");
    expect(placeOf(bookRoute(4))).toBe("library");
    expect(placeOf(ADD_BOOK)).toBe("add");
    expect(placeOf(LOGIN)).toBeNull();
  });
});

describe("navigation", () => {
  /** A History API with entries, enough for push, replace and back. */
  function fakeWindow(start: string) {
    const entries: { path: string; state: unknown }[] = [{ path: start, state: null }];
    let index = 0;
    const events: string[] = [];
    const location = { pathname: start, search: "", hash: "" };
    const sync = () => {
      const [path = "", hash = ""] = (entries[index]?.path ?? "").split("#");
      const [pathname = "", search = ""] = path.split("?");
      location.pathname = pathname;
      location.search = search ? `?${search}` : "";
      location.hash = hash ? `#${hash}` : "";
    };
    sync();
    const history = {
      get state() {
        return entries[index]?.state ?? null;
      },
      pushState(state: unknown, _title: string, path: string) {
        entries.splice(index + 1, entries.length, { path, state });
        index += 1;
        sync();
      },
      replaceState(state: unknown, _title: string, path: string) {
        entries[index] = { path, state };
        sync();
      },
      back() {
        index -= 1;
        sync();
        events.push("popstate");
      },
    };
    vi.stubGlobal("window", {
      location,
      history,
      scrollTo: () => events.push("scroll"),
      dispatchEvent: (event: Event) => events.push(event.type),
    });
    return { entries: () => entries.map((entry) => entry.path), index: () => index, events, location };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("pushes a new entry without a reload, and skips a visit to the page you're on", () => {
    vi.stubEnv("BASE_URL", BASE);
    const win = fakeWindow("/shelfmark/");
    navigate(ADD_BOOK);
    expect(win.entries()).toEqual(["/shelfmark/", "/shelfmark/add"]);
    expect(win.events).toEqual(["scroll", "shelfmark:navigate"]);
    navigate(ADD_BOOK);
    expect(win.entries()).toHaveLength(2);
  });

  it("replaces the entry when asked", () => {
    vi.stubEnv("BASE_URL", BASE);
    const win = fakeWindow("/shelfmark/login");
    navigate(LIBRARY, { replace: true });
    expect(win.entries()).toEqual(["/shelfmark/"]);
  });

  it("keeps the query and hash when tidying an address", () => {
    vi.stubEnv("BASE_URL", BASE);
    const win = fakeWindow("/shelfmark/books/3/?from=ward#top");
    replaceWithCanonical(bookRoute(3));
    expect(win.entries()).toEqual(["/shelfmark/books/3?from=ward#top"]);
  });

  it("goes Back when the entry behind is where the link points, and visits it otherwise", () => {
    vi.stubEnv("BASE_URL", BASE);
    const win = fakeWindow("/shelfmark/");
    navigate(bookRoute(1));
    goBack(LIBRARY);
    expect(win.index()).toBe(0);
    expect(win.location.pathname).toBe("/shelfmark/");

    // Add a book → Open the book: the entry behind is Add, so "Library" visits the Library.
    navigate(ADD_BOOK);
    navigate(bookRoute(2));
    goBack(LIBRARY);
    expect(win.entries()).toEqual(["/shelfmark/", "/shelfmark/add", "/shelfmark/books/2", "/shelfmark/"]);

    // A deep link has nothing behind it.
    const deep = fakeWindow("/shelfmark/books/9");
    goBack(LIBRARY);
    expect(deep.entries()).toEqual(["/shelfmark/books/9", "/shelfmark/"]);
  });
});
