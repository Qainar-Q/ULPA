import { test, expect, expectNoOverflow, enterTeacherDemo } from "./helpers.js";

function almatyToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty" }).format(new Date());
}

test("teacher home shows the week's lessons", async ({ page, errors }) => {
  await enterTeacherDemo(page);
  await expect(page.locator(".t-hero")).toBeVisible();
  await expect(page.locator(".t-lesson--link").first()).toBeVisible();
  await expectNoOverflow(page);
});

test("roll call: mark everyone, then one absent", async ({ page, errors }) => {
  await enterTeacherDemo(page);
  await page.locator(".t-lesson--link").first().click();
  const rows = page.locator(".roll-row");
  await expect(rows.first()).toBeVisible();
  await page.getByRole("button", { name: "Қалғандары келді" }).click();
  // Nobody is left unmarked ("… N" disappears).
  await expect(page.locator(".roll-counts .roll-count:not([class*='--'])")).toHaveCount(0);
  const absent = rows.nth(1).getByRole("radio", { name: "Жоқ" });
  if ((await absent.getAttribute("aria-checked")) === "true") await rows.nth(1).getByRole("radio", { name: "Келді" }).click();
  const before = Number((await page.locator(".roll-count--bad").innerText()).replace(/\D/g, ""));
  await absent.click();
  await expect(absent).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".roll-count--bad")).toHaveText(`✕ ${before + 1}`);
  await expect(page.locator(".roll-saving")).toHaveText("Сақталды ✓");
  await expectNoOverflow(page);
});

test("QR check-in shows a code", async ({ page, errors }) => {
  await enterTeacherDemo(page);
  await page.locator(".t-lesson--link").first().click();
  await expect(page.locator(".roll-row").first()).toBeVisible();
  const entryId = page.url().split("/lesson/")[1].split("/")[0];
  await page.goto(`/lesson/${entryId}/${almatyToday()}/qr`);
  await expect(page.locator("svg.qr")).toBeVisible();
  await expect(page.locator(".checkin__code")).toHaveText(/^\d{3} \d{3}$/);
  await expectNoOverflow(page);
});

test("course stats download as CSV", async ({ page, errors }) => {
  await enterTeacherDemo(page);
  await page.goto("/");
  const courseLink = page.locator('a[href^="/course/"]').first();
  await courseLink.click();
  await expect(page.locator(".stats-table tbody tr").first()).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Excel-ге жүктеу (CSV)" }).click();
  expect((await download).suggestedFilename()).toMatch(/^qatysu-.*\.csv$/);
  await expectNoOverflow(page);
});

test("teacher can send an announcement", async ({ page, errors }) => {
  await enterTeacherDemo(page);
  await page.goto("/announce");
  const before = await page.locator(".t-sent li").count();
  await page.locator("#ta-title").fill("Ертеңгі сабақ 208-де");
  await page.getByRole("button", { name: "Жіберу" }).click();
  await expect(page.locator(".form__ok")).toBeVisible();
  await expect(page.locator(".t-sent li")).toHaveCount(before + 1);
});

test("teacher profile opens", async ({ page, errors }) => {
  await enterTeacherDemo(page);
  await page.goto("/profile");
  await expect(page.locator(".t-main > .stack-lg").getByRole("button", { name: "Шығу" })).toBeVisible();
  await expectNoOverflow(page);
});
