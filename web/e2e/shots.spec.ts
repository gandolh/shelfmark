import { test } from "@playwright/test";
import { firstBookId, setTheme, signIn, stubLookup, type Theme } from "./helpers";

// SHOTS_DIR=<folder> npx playwright test shots: every screen at 1280x800 and 390x844, light and dark.
const dir = process.env.SHOTS_DIR;
test.skip(dir === undefined, "set SHOTS_DIR to take screenshots");

const WIDTHS = [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
] as const;

type Step = {
  name: string;
  path: string;
  signedOut?: boolean;
  act?: (page: import("@playwright/test").Page) => Promise<void>;
};

const STEPS: Step[] = [
  {
    name: "library",
    path: "",
    act: async (p) => {
      if ((p.viewportSize()?.width ?? 0) < 768) await p.getByRole("radio", { name: "Table" }).click();
    },
  },
  { name: "library-covers", path: "", act: async (p) => void (await p.getByRole("radio", { name: "Covers" }).click()) },
  { name: "add", path: "add", act: async (p) => void (await p.getByRole("tab", { name: "Type ISBN" }).click()) },
  {
    name: "add-draft",
    path: "add",
    act: async (p) => {
      await p.getByRole("tab", { name: "Type ISBN" }).click();
      await p.getByRole("textbox", { name: "ISBN" }).fill("9780141439587");
      await p.getByRole("button", { name: "Look up" }).click();
      await p.getByText("Emma").first().waitFor();
    },
  },
  {
    name: "library-filter",
    path: "",
    act: async (p) => {
      await p
        .getByRole("button", { name: /^Filter/ })
        .first()
        .click();
    },
  },
  {
    name: "library-columns",
    path: "",
    act: async (p) => {
      if ((p.viewportSize()?.width ?? 0) >= 768) await p.getByRole("button", { name: "Columns" }).click();
      else await p.getByRole("button", { name: /^Filter and sort/ }).click();
    },
  },
  {
    name: "library-views",
    path: "",
    act: async (p) => {
      await p.getByRole("button", { name: "Views" }).first().click();
    },
  },
  {
    name: "library-bulk",
    path: "",
    act: async (p) => {
      if ((p.viewportSize()?.width ?? 0) < 768) await p.getByRole("radio", { name: "Table" }).click();
      await p
        .getByRole("checkbox", { name: /^Select “/ })
        .first()
        .check();
      await p
        .getByRole("checkbox", { name: /^Select “/ })
        .nth(1)
        .check();
    },
  },
  {
    name: "account",
    path: "",
    act: async (p) => void (await p.getByRole("button", { name: "Account" }).first().click()),
  },
  { name: "add-scan", path: "add", act: async (p) => void (await p.getByRole("tab", { name: "Scan" }).click()) },
  { name: "add-manual", path: "add", act: async (p) => void (await p.getByRole("tab", { name: "By hand" }).click()) },
  { name: "login", path: "login", signedOut: true },
  { name: "wishlist", path: "wishlist" },
  { name: "book", path: "books/@first" },
  { name: "import", path: "import" },
  { name: "stats", path: "stats" },
];

for (const theme of ["light", "dark"] as Theme[]) {
  for (const size of WIDTHS) {
    for (const step of STEPS) {
      test(`${step.name} ${theme} ${size.width}`, async ({ page }) => {
        await page.setViewportSize(size);
        await stubLookup(page);
        await setTheme(page, theme);
        if (!step.signedOut) await signIn(page);
        const path = step.path.replace("@first", step.signedOut ? "" : await firstBookId(page));
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        await step.act?.(page);
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${dir}/${step.name}-${theme}-${size.width}.png` });
      });
    }
  }
}
