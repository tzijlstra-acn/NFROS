/**
 * Product Owner Console journeys (os-console-core).
 *
 * Run against an isolated stack only: these journeys write (persona switch,
 * disable, enable, release gate). Never against port 3000.
 *
 *   NFR_BASE_URL=http://localhost:3115 npx playwright test tests/e2e/os-console-core.spec.ts --project=desktop-1920
 */

import { expect, test, type Page } from "@playwright/test";

test.skip(!process.env.NFR_BASE_URL || process.env.NFR_BASE_URL.includes(":3000"), "Writes; run against an isolated stack only.");

async function actAs(page: Page, persona: string): Promise<void> {
  await page.selectOption('[data-testid="console-persona-select"]', persona);
  await page.click('[data-testid="console-persona-switch"]');
  await expect(page.locator(`[data-testid="console-acting-persona"][data-persona="${persona}"]`)).toBeVisible({ timeout: 60_000 });
}

async function approve(page: Page, testId: string, rationale: string): Promise<void> {
  await page.click(`[data-testid="${testId}-open"]`);
  await page.fill(`[data-testid="${testId}-rationale"]`, rationale);
  await page.check(`[data-testid="${testId}-confirm"]`);
  await page.click(`[data-testid="${testId}-submit"]`);
}

const APP = "role-app-tprm-third-party-onboarding";

test("the console shell lists every section, and each one answers", async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto("/product", { timeout: 120_000 });
  const links = page.locator('[data-testid="console-nav-primary"] a');
  await expect(links).toHaveCount(9);
  const hrefs = await links.evaluateAll((elements) => elements.map((element) => element.getAttribute("href") ?? ""));
  for (const href of hrefs) {
    const response = await page.goto(href, { timeout: 120_000 });
    expect(response?.status(), href).toBe(200);
    await expect(page.locator('[data-testid="console-acting-persona"]')).toBeVisible();
  }
});

test("an installed Role App can be disabled and enabled, with the effect on the process pages", async ({ page }) => {
  test.setTimeout(400_000);
  await page.goto("/product/role-apps", { timeout: 120_000 });
  await actAs(page, "tenant-administrator");

  const card = page.locator(`[data-testid="${APP}"]`);
  if ((await card.getAttribute("data-availability")) !== "enabled") {
    await approve(page, `${APP}-enable`, "Restoring the starting state for the journey.");
    await expect(card).toHaveAttribute("data-availability", "enabled", { timeout: 60_000 });
  }

  await approve(page, `${APP}-disable`, "Containing a defect found in the evidence review stage.");
  await expect(card).toHaveAttribute("data-availability", "disabled", { timeout: 60_000 });

  await page.goto("/workday/tprm/processes/third-party-onboarding", { timeout: 180_000 });
  await expect(page.locator('[data-testid="role-app-disabled"]')).toBeVisible();
  await expect(page.locator('[data-testid="process-status-line"]')).toHaveCount(0);
  await page.goto("/workday/tprm/processes", { timeout: 180_000 });
  await expect(page.locator('[data-testid="process-app-card"][data-disabled="true"]')).toHaveCount(1);

  await page.goto("/product/role-apps", { timeout: 120_000 });
  await approve(page, `${APP}-enable`, "The defect is fixed; opening the process again.");
  await expect(card).toHaveAttribute("data-availability", "enabled", { timeout: 60_000 });

  await page.goto("/workday/tprm/processes/third-party-onboarding", { timeout: 180_000 });
  await expect(page.locator('[data-testid="role-app-disabled"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="process-status-line"]')).toBeVisible();
});

test("a persona without the authority cannot disable an app", async ({ page }) => {
  await page.goto("/product/role-apps", { timeout: 120_000 });
  await actAs(page, "pilot-lead");
  await expect(page.locator(`[data-testid="${APP}-disable-open"]`)).toBeDisabled();
  await expect(page.locator(`[data-testid="${APP}-disable-blocked"]`)).toContainText("Tenant Administrator");
});

test("the release gate runs real checks and shows pass or fail per check", async ({ page }) => {
  test.setTimeout(900_000);
  await page.goto("/product/releases", { timeout: 120_000 });
  await actAs(page, "operations-owner");
  await page.click('[data-testid="release-run-gate-submit"]');
  await expect(page.locator('[data-testid="release-run-gate-result"]')).toHaveAttribute("data-ok", "true", { timeout: 120_000 });
  await expect(page.locator('[data-testid="release-gate-results"]')).toBeVisible({ timeout: 780_000 });
  const statuses = await page.locator('[data-testid^="release-gate-check-"]').evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("data-status")),
  );
  expect(statuses.length).toBeGreaterThanOrEqual(8);
  for (const status of statuses) expect(["passed", "failed", "not-run"]).toContain(status);
  await expect(page.locator('[data-testid="release-gate-check-migrations"]')).toHaveAttribute("data-status", "passed");
});

test("experience analytics can be filtered, and says which filters a source cannot apply", async ({ page }) => {
  await page.goto("/product/experience", { timeout: 120_000 });
  await page.selectOption('[data-testid="experience-filter-role"]', "tprm");
  await page.selectOption('[data-testid="experience-filter-process"]', { index: 1 });
  await page.click('[data-testid="experience-apply"]');
  await expect(page).toHaveURL(/role=tprm/);
  await expect(page.locator('[data-testid="experience-measure-stage-completed"]')).toBeVisible();
  await expect(page.locator('[data-testid="console-experience"]')).toContainText(/Filter not applicable|Filter fuer diese Quelle nicht anwendbar/);
});
