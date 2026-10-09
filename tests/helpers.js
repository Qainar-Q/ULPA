import { test as base, expect } from "@playwright/test";

/**
 * Shared setup for every test:
 *  - blocks the real database and outside services (tests never touch real data),
 *  - collects JavaScript errors so a test fails if the page crashes.
 */
export const test = base.extend({
  errors: async ({ page }, use) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const text = message.text();
      // Blocked network requests are expected (see routes below).
      if (/ERR_FAILED|ERR_BLOCKED|Failed to load resource|net::/i.test(text)) return;
      errors.push(`console: ${text}`);
    });
    await page.route(/supabase\.co/, (route) => route.abort());
    await page.route(/wheretheiss\.at|thespacedevs\.com|fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
    await use(errors);
    expect(errors, "JavaScript errors on the page").toEqual([]);
  },
});

export { expect };

/** Nothing on the page may stick out sideways (no horizontal scrolling on phones). */
export async function expectNoOverflow(page) {
  const result = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const wide = [...document.querySelectorAll("body *")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (!r.width || getComputedStyle(el).position === "fixed") return false;
        if (!(r.right > width + 1 || r.left < -1)) return false;
        // Fine when a parent scrolls or clips it on purpose (tables, map, chip rows).
        for (let parent = el.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
          if (getComputedStyle(parent).overflowX !== "visible") return false;
        }
        return !el.closest(".hero__orbit, .hero__grid, .auth__bg, .auth__media");
      })
      .map((el) => (typeof el.className === "string" && el.className ? el.className.split(" ")[0] : el.tagName))
      .slice(0, 5);
    return { scroll: document.documentElement.scrollWidth, width, wide };
  });
  expect(result.wide, `elements sticking out at ${result.width}px`).toEqual([]);
  expect(result.scroll, "page scrolls sideways").toBeLessThanOrEqual(result.width + 1);
}

/** Open the student demo and close the welcome tour / birthday greeting. */
export async function enterStudentDemo(page) {
  await page.goto("/demo");
  await expect(page.locator(".demo-banner")).toBeVisible();
  await closeOverlays(page);
}

export async function closeOverlays(page) {
  const skip = page.locator(".tour__skip");
  if (await skip.isVisible({ timeout: 2500 }).catch(() => false)) await skip.click();
  const bday = page.locator(".bday-overlay__close");
  if (await bday.isVisible({ timeout: 3000 }).catch(() => false)) await bday.click();
  await expect(page.locator(".tour, .bday-overlay")).toHaveCount(0);
}

export async function enterTeacherDemo(page) {
  await page.goto("/demo?as=teacher");
  await expect(page.locator(".t-bar")).toBeVisible();
}
