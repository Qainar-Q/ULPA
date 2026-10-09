import { test, expect, expectNoOverflow, enterStudentDemo, closeOverlays } from "./helpers.js";

// Every student page with something that must be on it.
const PAGES = [
  ["/", ".session-list li, .session"],
  ["/schedule", ".session-list li, .session"],
  ["/tasks", ".task-list li, .task"],
  ["/photos", "img"],
  ["/materials", ".material, li"],
  ["/gpa", ".gpa-row"],
  ["/notes", ".note-card"],
  ["/notes/00000000-0000-4000-8000-000000000900", ".md h3"],
  ["/translate", ".translation-old"],
  ["/draw", ".draw-person"],
  ["/suggestions", ".suggestion"],
  ["/polls", ".poll"],
  ["/teachers", ".teacher-card, article"],
  ["/attendance", ".official__row, .att, li"],
  ["/announcements", ".announcement, article"],
  ["/campus", ".campus-dot"],
  ["/profile", ".badge"],
  ["/search?q=туынды", ".search-hit"],
  ["/checkin", ".checkin-form__code"],
  ["/quiz", "#quiz-course"],
  ["/admin", "tr, li"],
  ["/admin/teachers", ".t-account"],
];

test("every student page opens without errors", async ({ page, errors }) => {
  test.setTimeout(120_000);
  await enterStudentDemo(page);
  for (const [path, selector] of PAGES) {
    await test.step(path, async () => {
      await page.goto(path);
      await expect(page.locator(selector).first(), `content on ${path}`).toBeVisible();
      await expectNoOverflow(page);
    });
  }
});

test("random draw makes groups", async ({ page, errors }) => {
  await enterStudentDemo(page);
  await page.goto("/draw");
  await page.getByRole("button", { name: "Бастау" }).click();
  await expect(page.locator(".draw-stage .draw-group").first()).toBeVisible({ timeout: 10_000 });
});

test("translation returns Kazakh text", async ({ page, errors }) => {
  await enterStudentDemo(page);
  await page.goto("/translate");
  await page.getByRole("radio", { name: "Мәтін" }).click();
  await page.locator("textarea").fill("Сила равна массе, умноженной на ускорение.");
  await page.getByRole("button", { name: "Қазақшаға аудару" }).click();
  await expect(page.locator(".translation .md h2").first()).toBeVisible();
});

test("wrong check-in code shows an error", async ({ page, errors }) => {
  await enterStudentDemo(page);
  await page.goto("/checkin");
  await page.locator(".checkin-form__code").fill("123456");
  await page.getByRole("button", { name: "Белгілену" }).click();
  await expect(page.locator(".form__error")).toContainText("Код");
});

test("leaving the demo goes back to the start", async ({ page, errors }) => {
  await enterStudentDemo(page);
  await page.locator(".demo-banner button").click();
  await expect(page.locator(".demo-banner")).toHaveCount(0);
  await expect(page).not.toHaveURL(/\/demo/);
});

test("going back returns to the same scroll position", async ({ page, errors }) => {
  await enterStudentDemo(page);
  await page.goto("/notes");
  await expect(page.locator(".note-card").first()).toBeVisible();
  await page.goto("/");
  await closeOverlays(page);
  await expect(page.locator(".session-list li, .session").first()).toBeVisible();
  const max = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  const target = Math.min(600, max - 10);
  expect(target, "home page is long enough to scroll").toBeGreaterThan(100);
  await page.mouse.wheel(0, target);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(target - 40);
  const before = await page.evaluate(() => window.scrollY);

  // A new page opens at the top…
  // (any link on the home page that is visible right now)
  const link = page.locator('main a[href^="/tasks"]:visible, main a[href^="/notes"]:visible').first();
  await link.click();
  await expect(page).not.toHaveURL(/localhost:4173\/$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

  // …and "back" returns to where we were.
  await page.goBack();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before - 40);
});

test("AI quiz: pick a course, answer, see the result", async ({ page, errors }) => {
  await enterStudentDemo(page);
  await page.goto("/notes");
  await page.getByRole("link", { name: "AI тест" }).click();
  await expect(page).toHaveURL(/\/quiz/);
  await page.locator("#quiz-course").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Тест құрастыру" }).click();
  const options = page.locator(".quiz__option");
  await expect(options.first()).toBeVisible();
  const total = Number((await page.locator(".quiz__count").innerText()).match(/\/\s*(\d+)/)[1]);
  for (let i = 0; i < total; i += 1) {
    await options.first().click();
    await expect(page.locator(".quiz__explain")).toBeVisible();
    await expect(page.locator(".quiz__option.is-correct")).toHaveCount(1);
    await page.locator(".quiz__explain .button").click();
  }
  await expect(page.locator(".quiz__score")).toHaveText(new RegExp(`^\\d+ / ${total}$`));
  await expectNoOverflow(page);
});

test("blackboard photo becomes a note draft", async ({ page, errors }) => {
  await enterStudentDemo(page);
  await page.goto("/photos");
  await page.locator(".photo-tile").first().click();
  await page.getByRole("button", { name: "Тақтадан конспект жасау" }).click();
  await expect(page).toHaveURL(/\/notes\/new$/);
  await expect(page.locator("#note-title")).toHaveValue("Тақтадан конспект (демо)");
  await expect(page.locator(".viewer")).toHaveCount(0);
});
