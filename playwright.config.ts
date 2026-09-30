import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration.
 *
 * The viewport matrix matches the presentation requirement: no scene may
 * overflow at 1920x1080, 1440x900 or 1366x768. Those are projected sizes, so
 * a scrollbar appearing on stage is a defect rather than a cosmetic issue.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.NFR_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Deterministic rendering for the visual checks.
    colorScheme: "dark",
    reducedMotion: "reduce",
  },
  projects: [
    { name: "desktop-1920", use: { ...devices["Desktop Chrome"], viewport: { width: 1920, height: 1080 } } },
    { name: "desktop-1440", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "desktop-1366", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 } } },
  ],
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000/api/health/ai",
    reuseExistingServer: true,
    timeout: 180_000,
    env: { NFR_DEMO_MODE: "safe" },
  },
});
