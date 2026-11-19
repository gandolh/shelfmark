import { expect, test, type Page, type Route } from "@playwright/test";
import { setTheme, type Theme } from "./helpers";

// Linking and unlinking Ward ask for the password, with no server: the API is stubbed (a signed-in local user
// with a password, Ward on). SHOTS_DIR=<folder> also saves the dialogs at 1280 light and 390 dark.
const dir = process.env.SHOTS_DIR;

const SESSION = {
  user: { id: "u1", username: "demo", role: "owner", hasPassword: true },
  session: { origin: "local", expiresAt: Date.now() + 86_400_000 },
};

interface Stub {
  /** The bodies posted to the link and unlink routes. */
  posted: { path: string; body: unknown }[];
}

async function stubApi(page: Page, options: { linked: boolean; hasPassword?: boolean }): Promise<Stub> {
  const stub: Stub = { posted: [] };
  await page.route("**/shelfmark-api/**", (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^.*\/shelfmark-api/, "");
    if (path === "/auth/session") {
      return route.fulfill({
        json: {
          ...SESSION,
          user: { ...SESSION.user, hasPassword: options.hasPassword ?? true },
          ward: { enabled: true, linked: options.linked },
        },
      });
    }
    if (path === "/auth/ward/link" || path === "/auth/ward/unlink") {
      const body: unknown = request.postDataJSON();
      stub.posted.push({ path, body });
      const password = (body as { currentPassword?: string } | null)?.currentPassword;
      if (password === "open sesame") {
        return path.endsWith("/unlink")
          ? route.fulfill({ json: { signedOut: false } })
          : route.fulfill({ status: 503, json: { error: "ward_unavailable" } });
      }
      return route.fulfill({ status: 401, json: { error: "invalid_credentials" } });
    }
    if (path === "/api/books") return route.fulfill({ json: { books: [] } });
    return route.fulfill({ json: {} });
  });
  return stub;
}

async function openMenuItem(page: Page, name: RegExp): Promise<void> {
  await page.goto("");
  await page.getByRole("button", { name: "Account" }).first().click();
  await page.getByRole("menuitem", { name }).click();
}

test("Link Ward asks for the password, sends it, and keeps a wrong one beside the field", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const stub = await stubApi(page, { linked: false });
  await openMenuItem(page, /Sign in with Ward/);
  const dialog = page.getByRole("dialog", { name: "Link Ward" });
  const field = dialog.getByLabel("Current password");
  await expect(field).toHaveAttribute("type", "password");
  await expect(field).toHaveAttribute("autocomplete", "current-password");
  await expect(field).toBeFocused();
  await field.fill("not it");
  await dialog.getByRole("button", { name: "Link Ward" }).click();
  await expect(dialog.getByText("That isn't your current password.")).toBeVisible();
  await expect(field).toBeFocused();
  await expect(field).toHaveValue("");
  expect(stub.posted).toEqual([{ path: "/auth/ward/link", body: { currentPassword: "not it" } }]);
  if (dir !== undefined) {
    await field.fill("still wrong");
    await dialog.getByRole("button", { name: "Link Ward" }).click();
    await expect(dialog.getByText("That isn't your current password.")).toBeVisible();
    await page.screenshot({ path: `${dir}/ward-link-error-1280-light.png` });
  }
});

test("Unlink Ward asks for the password too, and closes once it is accepted", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const stub = await stubApi(page, { linked: true });
  await openMenuItem(page, /Sign in with Ward/);
  const dialog = page.getByRole("dialog", { name: "Unlink Ward" });
  await dialog.getByLabel("Current password").fill("open sesame");
  await dialog.getByRole("button", { name: "Unlink Ward" }).click();
  await expect(dialog).toBeHidden();
  expect(stub.posted).toEqual([{ path: "/auth/ward/unlink", body: { currentPassword: "open sesame" } }]);
});

test("an account with no password is sent to set one first", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const stub = await stubApi(page, { linked: true, hasPassword: false });
  await openMenuItem(page, /Sign in with Ward/);
  const dialog = page.getByRole("dialog", { name: "Unlink Ward" });
  await expect(dialog.getByText(/Set a Shelfmark password first/)).toBeVisible();
  await dialog.getByRole("button", { name: "Set a password" }).click();
  await expect(page.getByRole("dialog", { name: "Set a password" })).toBeVisible();
  expect(stub.posted).toEqual([]);
});

test.describe("shots", () => {
  test.skip(dir === undefined, "set SHOTS_DIR to take screenshots");
  for (const [theme, width, height] of [
    ["light", 1280, 800],
    ["dark", 390, 844],
  ] as [Theme, number, number][]) {
    for (const linked of [false, true]) {
      test(`${linked ? "unlink" : "link"} ${theme} ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        await setTheme(page, theme);
        await stubApi(page, { linked });
        await openMenuItem(page, /Sign in with Ward/);
        const dialog = page.getByRole("dialog");
        await dialog.getByLabel("Current password").fill("wrong one");
        await dialog.getByRole("button", { name: linked ? "Unlink Ward" : "Link Ward" }).click();
        await expect(dialog.getByText("That isn't your current password.")).toBeVisible();
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${dir}/ward-${linked ? "unlink" : "link"}-error-${width}-${theme}.png` });
      });
    }
  }
});
