import { test, expect, expectNoOverflow } from "./helpers.js";

test("guest page shows both demo entrances", async ({ page, errors }) => {
  await page.goto("/guest");
  await expect(page.locator("a.demo-cta")).toHaveCount(2);
  await expect(page.locator('a.demo-cta[href="/demo?as=teacher"]')).toBeVisible();
  await expectNoOverflow(page);
});

test("login page loads", async ({ page, errors }) => {
  await page.goto("/login");
  await expect(page.locator("form")).toBeVisible();
  await expect(page.locator('a[href="/demo"]')).toBeVisible();
  await expectNoOverflow(page);
});
