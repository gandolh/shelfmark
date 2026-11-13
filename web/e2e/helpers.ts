import type { Page, Route } from "@playwright/test";

export type Theme = "light" | "dark" | "system";

/** The screens the checks walk: a route under the app's base, and a name for the file a shot is saved as. */
export const SCREENS = [
  { name: "library", path: "" },
  { name: "add", path: "add" },
  { name: "wishlist", path: "wishlist" },
  { name: "book", path: "books/@first" },
  { name: "import", path: "import" },
  { name: "stats", path: "stats" },
] as const;

/** Signs in through the dev server's API proxy, so the page opens with a session cookie. */
export async function signIn(page: Page): Promise<void> {
  const base = new URL(String(process.env.E2E_URL ?? "http://localhost:5176/shelfmark/"));
  const response = await page.request.post(`${base.origin}/shelfmark-api/auth/login`, {
    data: { username: process.env.E2E_USER ?? "demo", password: process.env.E2E_PASSWORD ?? "" },
    headers: { origin: base.origin },
  });
  if (!response.ok()) throw new Error(`Sign-in failed: ${response.status()}`);
}

/** Sets the theme before the first paint, the way the boot script reads it. */
export async function setTheme(page: Page, theme: Theme): Promise<void> {
  await page.addInitScript((value) => {
    localStorage.setItem("shelfmark.theme", value);
  }, theme);
}

/** The first book's id in the scratch library. */
export async function firstBookId(page: Page): Promise<string> {
  const base = new URL(String(process.env.E2E_URL ?? "http://localhost:5176/shelfmark/"));
  const response = await page.request.get(`${base.origin}/shelfmark-api/api/books`, {
    headers: { origin: base.origin },
  });
  const { books } = (await response.json()) as { books: { id: number }[] };
  const first = books[0];
  if (!first) throw new Error("The scratch library is empty");
  return String(first.id);
}

/** No lookup ever leaves the machine: POST /api/lookup answers with the board's draft (Emma, Open Library). */
export async function stubLookup(page: Page): Promise<void> {
  await page.route("**/shelfmark-api/api/lookup", (route: Route) =>
    route.fulfill({
      json: {
        isbn13: "9780141439587",
        draft: {
          isbn13: "9780141439587",
          title: "Emma",
          subtitle: null,
          authors: ["Jane Austen"],
          publisher: "Penguin Classics",
          publishedYear: 2003,
          pages: null,
          language: "en",
          description: null,
          subjects: [],
          coverCandidates: [],
          sources: ["openlibrary"],
        },
        tried: [{ source: "openlibrary", outcome: "found" }],
        owned: [],
        wishlisted: [],
      },
    }),
  );
}
