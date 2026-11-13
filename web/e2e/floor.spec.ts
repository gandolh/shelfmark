import { expect, test, type Page } from "@playwright/test";
import { firstBookId, setTheme, signIn, stubLookup, type Theme } from "./helpers";

// The redesign's floor, on every screen: a focus ring on every stop, no running motion under reduced motion,
// no sideways overflow and 44 px targets at 390, and the theme switch (light first, then dark and system).

const SCREENS = ["", "add", "wishlist", "books/@first", "import", "stats"] as const;

async function open(page: Page, route: string, theme?: Theme): Promise<void> {
  await stubLookup(page);
  if (theme) await setTheme(page, theme);
  await signIn(page);
  await page.goto(route.replace("@first", await firstBookId(page)));
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(300);
}

test.describe("focus ring", () => {
  for (const route of SCREENS) {
    test(`every Tab stop on /${route} shows a ring`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await open(page, route);
      const missing: string[] = [];
      for (let stop = 0; stop < 14; stop++) {
        await page.keyboard.press("Tab");
        // Past the last stop the focus leaves the page for the browser.
        if (await page.evaluate(() => document.activeElement === document.body)) break;
        const ring = await page.evaluate(() => {
          const visible = (el: Element | null) => {
            if (!el) return false;
            const style = getComputedStyle(el);
            return (
              (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) >= 2) ||
              (style.boxShadow !== "none" && style.boxShadow !== "")
            );
          };
          let el: Element | null = document.activeElement;
          const label = `${el?.tagName.toLowerCase()} ${el?.getAttribute("aria-label") ?? el?.textContent?.slice(0, 24) ?? ""}`;
          // The ring may sit on the element, its row, its label or its track (a hidden radio, a table row).
          for (let up = 0; up < 4 && el; up++, el = el.parentElement) if (visible(el)) return { ok: true, label };
          return { ok: false, label };
        });
        if (!ring.ok) missing.push(ring.label);
      }
      expect(missing).toEqual([]);
    });
  }
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  for (const route of SCREENS) {
    test(`nothing keeps moving on /${route}`, async ({ page }) => {
      await open(page, route);
      await page.waitForTimeout(500);
      const running = await page.evaluate(() =>
        document
          .getAnimations()
          .filter((a) => a.playState === "running" && (a.effect?.getComputedTiming().iterations ?? 1) === Infinity)
          .map((a) => a.id || String((a as CSSAnimation).animationName ?? "")),
      );
      expect(running).toEqual([]);
    });
  }
});

test.describe("390 px", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  for (const route of SCREENS) {
    test(`/${route} does not overflow and its targets are 44 px`, async ({ page }) => {
      await open(page, route);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
      expect(overflow).toBe(true);
      const small = await page.evaluate(() => {
        const found: string[] = [];
        const selector = 'a[href], button, input:not([type="hidden"]), select, textarea, [role="tab"], [role="radio"]';
        for (const el of document.querySelectorAll<HTMLElement>(selector)) {
          const box = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          if (box.width === 0 || box.height === 0 || style.visibility === "hidden") continue;
          if (el.closest("[hidden], .sr-only, [aria-hidden='true']") || style.clip !== "auto") continue;
          // A link inside running text is not a target of its own.
          if (el.tagName === "A" && el.closest("p, li") && style.display === "inline") continue;
          const pad = getComputedStyle(el, "::before");
          const expanded = pad.position === "absolute" && pad.content !== "none";
          // A box inside a label is tapped through the label.
          const host = el.closest("label") ?? el;
          const hb = host.getBoundingClientRect();
          if (!expanded && (hb.height < 43.5 || hb.width < 43.5)) {
            found.push(
              `${el.tagName.toLowerCase()} ${el.getAttribute("aria-label") ?? el.textContent?.slice(0, 20)} ${Math.round(hb.width)}x${Math.round(hb.height)}`,
            );
          }
        }
        return found;
      });
      expect(small).toEqual([]);
    });
  }
});

test.describe("themes", () => {
  test("the first visit is light", async ({ page }) => {
    await open(page, "");
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe("light");
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(246, 243, 239)");
  });
  test("dark and system render the dark ground", async ({ page, browser }) => {
    await open(page, "", "dark");
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(20, 19, 16)");
    const context = await browser.newContext({ colorScheme: "dark", serviceWorkers: "block" });
    const second = await context.newPage();
    await open(second, "", "system");
    expect(await second.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(20, 19, 16)");
    await context.close();
  });
});
