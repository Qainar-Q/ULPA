import { defineConfig, devices } from "@playwright/test";

/**
 * Automatic checks that run before every deploy (see .github/workflows/main.yml).
 * They only use demo mode with made-up data: every request to the real
 * Supabase project is blocked, so no passwords or keys are needed.
 *
 * Run locally:  npm run build && npm test
 */
export default defineConfig({
  testDir: "tests",
  timeout: 60_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:4173",
    timezoneId: "Asia/Almaty",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"], browserName: "chromium" } },
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: "npx vite preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
