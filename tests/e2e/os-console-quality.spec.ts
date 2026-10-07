/**
 * Product Owner Console journeys for Quality, Integrations and Feedback
 * (plan 7.5, 7.6, 7.8), and the layout check at the three viewports.
 *
 * The journeys WRITE: they run evaluations, approve and roll back a
 * configuration, pause and resume writes, retry a dead letter and triage
 * feedback. Run them only against an isolated stack, never port 3000:
 *
 *   NFR_DB_PATH=<scratch db> npx tsx scripts/migrate.ts && npx tsx scripts/seed.ts
 *   NFR_DB_PATH=<scratch db> NFR_DIST_DIR=.next-<id> NFR_DEMO_MODE=safe npx next dev -p <port>
 *   NFR_DB_PATH=<scratch db> NFR_BASE_URL=http://localhost:<port> npx playwright test tests/e2e/os-console-quality.spec.ts
 *
 * NFR_DB_PATH is needed by the fixture that creates a real dead letter and
 * switches the language (tests/e2e/support/os-console-quality-fixture.ts).
 * Screenshots go to docs/screenshots/os-excellence/os-console-quality/.
 */

import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

const SHARED = /localhost:3000\/?$/;
const SHOTS = join(process.cwd(), "docs", "screenshots", "os-excellence", "os-console-quality");
const CANDIDATE = "AICFG-RCSA-STAGE-PREP-002";
const RELEASED = "AICFG-RCSA-STAGE-PREP-001";
const GRC = "CI-GRC-SIM";

function isolated(testInfo: TestInfo): void {
  const base = String(testInfo.project.use.baseURL ?? "");
  test.skip(SHARED.test(base) || base.length === 0, "These journeys write; they run only against an isolated stack.");
}

function writingJourney(testInfo: TestInfo): void {
  isolated(testInfo);
  test.skip(testInfo.project.name !== "desktop-1920", "The journeys write, so they run in one viewport project.");
}

function fixture(command: string): string {
  const db = process.env.NFR_DB_PATH ?? "";
  if (db.length === 0) throw new Error("Set NFR_DB_PATH to the isolated database for the fixture.");
  return execSync(`npx tsx tests/e2e/support/os-console-quality-fixture.ts ${command}`, {
    cwd: process.cwd(),
    env: { ...process.env, NFR_DB_PATH: db, NFR_DEMO_MODE: "safe" },
    encoding: "utf8",
    timeout: 300_000,
  });
}

async function actAs(page: Page, personaId: string, label: string): Promise<void> {
  await page.goto("/product/quality", { timeout: 180_000 });
  await page.getByTestId("console-persona-select").selectOption(personaId);
  await page.getByTestId("console-persona-switch").click();
  await expect(page.getByTestId("console-acting-persona-label")).toContainText(label, { timeout: 60_000 });
}

async function approveIn(page: Page, testId: string, rationale: string): Promise<void> {
  await page.getByTestId(`${testId}-open`).click();
  await page.getByTestId(`${testId}-rationale`).fill(rationale);
  await page.getByTestId(`${testId}-confirm`).check();
  await page.getByTestId(`${testId}-submit`).click();
}

async function noHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const root = document.scrollingElement ?? document.documentElement;
    const main = document.querySelector(".app-main");
    return {
      page: root.scrollWidth - window.innerWidth,
      main: main ? main.scrollWidth - main.clientWidth : 0,
    };
  });
  expect(overflow.page).toBeLessThanOrEqual(1);
  expect(overflow.main).toBeLessThanOrEqual(1);
}

async function shot(page: Page, name: string, testInfo: TestInfo): Promise<void> {
  mkdirSync(SHOTS, { recursive: true });
  const width = testInfo.project.use.viewport?.width ?? 0;
  await page.screenshot({ path: join(SHOTS, `${name}-${width}.png`), fullPage: false });
}

test.describe.configure({ mode: "serial" });

test("Quality: run evaluations, see the release block, inspect and compare, approve and roll back", async ({ page }, testInfo) => {
  writingJourney(testInfo);
  test.setTimeout(600_000);
  await actAs(page, "ai-quality-owner", "AI Quality Owner");
  await page.goto("/product/quality", { timeout: 180_000 });

  const candidate = page.getByTestId(`quality-config-${CANDIDATE}`);
  const released = page.getByTestId(`quality-config-${RELEASED}`);

  /* No evaluation yet: the release is blocked and Approve says why. */
  await expect(page.getByTestId(`quality-config-${CANDIDATE}-gate`)).toHaveAttribute("data-blocked", "true");
  await expect(page.getByTestId(`quality-config-${CANDIDATE}-approve-blocked`)).toContainText("No completed evaluation run");
  await expect(page.getByTestId(`quality-config-${CANDIDATE}-approve-open`)).toBeDisabled();

  /* Offline structural run of the candidate: the gate passes. */
  await page.getByTestId(`quality-config-${CANDIDATE}-run-submit`).click();
  await expect(page.getByTestId(`quality-config-${CANDIDATE}-gate`)).toHaveAttribute("data-blocked", "false", { timeout: 180_000 });

  /* Safe-mode runs of both, for Compare output. */
  await page.getByTestId(`quality-config-${RELEASED}-mode`).selectOption("grounding");
  await page.getByTestId(`quality-config-${RELEASED}-run-submit`).click();
  await expect(released).toContainText("Safe: reviewed responses", { timeout: 180_000 });
  await page.getByTestId(`quality-config-${CANDIDATE}-mode`).selectOption("grounding");
  await page.getByTestId(`quality-config-${CANDIDATE}-run-submit`).click();
  await expect(candidate).toContainText("Safe: reviewed responses", { timeout: 180_000 });
  await expect(released).toContainText("Not measured in safe mode");
  await shot(page, "quality-after-runs-en", testInfo);

  /* Inspect a case of the released safe-mode run and compare it with the candidate. */
  await released.getByRole("link", { name: /^AER-/ }).first().click();
  await expect(page.getByTestId("quality-run")).toBeVisible({ timeout: 120_000 });
  const firstGraded = page.locator('a[href*="?case="]').filter({ hasText: /Passed|Failed/ }).first();
  await firstGraded.click();
  await expect(page.getByTestId("quality-case-input")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId("quality-case-expected")).toBeVisible();
  await expect(page.getByTestId("quality-case-actual")).toBeVisible();
  await expect(page.getByTestId("quality-case-compare-verdict")).toContainText(/Identical output|differ/);
  await page.getByTestId("quality-case").scrollIntoViewIfNeeded();
  await shot(page, "quality-inspect-case-en", testInfo);

  /* Approve the candidate under an approval bound to the evidence, then roll back. */
  await page.goto("/product/quality", { timeout: 180_000 });
  await approveIn(page, `quality-config-${CANDIDATE}-approve`, "Structural and safe runs show no mandatory failure.");
  await expect(page.getByTestId(`quality-config-${CANDIDATE}`)).toContainText("In force", { timeout: 120_000 });
  await approveIn(page, `quality-config-${CANDIDATE}-rollback`, "Rolling back to keep the released profile for the pilot.");
  await expect(page.getByTestId(`quality-config-${RELEASED}`)).toContainText("In force", { timeout: 120_000 });
  await expect(page.getByTestId(`quality-config-${CANDIDATE}`)).toContainText("Candidate");
});

test("Integrations: test, sync, pause and resume writes, retry a dead letter, download diagnostics", async ({ page }, testInfo) => {
  writingJourney(testInfo);
  test.setTimeout(600_000);
  const output = fixture("dead-letter");
  const commandId = /COMMAND=(\S+)/.exec(output)?.[1] ?? "";
  expect(output).toContain("STATUS=dead-letter");

  await actAs(page, "integration-owner", "Integration Owner");
  await page.goto("/product/integrations", { timeout: 180_000 });
  const grc = page.getByTestId(`integrations-connector-${GRC}`);
  await expect(grc).toContainText("Simulated");

  await page.getByTestId(`integrations-connector-${GRC}-test-submit`).click();
  await expect(page.getByTestId(`integrations-connector-${GRC}-test-result`)).toHaveAttribute("data-ok", "true", { timeout: 120_000 });
  await page.getByTestId(`integrations-connector-${GRC}-sync-submit`).click();
  await expect(page.getByTestId(`integrations-connector-${GRC}-sync-result`)).toContainText("synced", { timeout: 180_000 });

  /* Pause: the dead letter cannot be retried while writes are paused. */
  await expect(page.getByTestId(`integrations-retry-${commandId}`)).toBeVisible();
  await approveIn(page, `integrations-connector-${GRC}-writes`, "Pausing GRC writes while the mapping is reviewed.");
  await expect(page.getByTestId(`integrations-connector-${GRC}-write-state`)).toContainText("Writes paused", { timeout: 120_000 });
  await expect(page.getByTestId(`integrations-retry-${commandId}-blocked`)).toBeVisible();
  await shot(page, "integrations-paused-en", testInfo);

  /* The approval panel stays open with its result; a fresh page offers Resume. */
  await page.reload({ timeout: 180_000 });
  await approveIn(page, `integrations-connector-${GRC}-writes`, "Mapping reviewed; resuming GRC writes.");
  await expect(page.getByTestId(`integrations-connector-${GRC}-write-state`)).toContainText("Writes enabled", { timeout: 120_000 });

  /* Retry through the dispatcher: the dead letter is delivered and leaves the queue. */
  await page.getByTestId(`integrations-retry-${commandId}-submit`).click();
  await expect(page.getByTestId(`integrations-retry-${commandId}`)).toHaveCount(0, { timeout: 180_000 });

  const bundle = await page.request.get("/product/integrations/diagnostics");
  expect(bundle.status()).toBe(200);
  const text = await bundle.text();
  expect(text).toContain(GRC);
  expect(text).not.toMatch(/sk-[A-Za-z0-9]|api[_-]?key|password/i);

  /* Another persona cannot act here. */
  await actAs(page, "pilot-lead", "Pilot Lead");
  await page.goto("/product/integrations", { timeout: 180_000 });
  await expect(page.getByTestId(`integrations-connector-${GRC}-test-blocked`)).toBeVisible();
  expect((await page.request.get("/product/integrations/diagnostics")).status()).toBe(403);
});

test("Feedback: an analyst submits from the workday and the product owner triages and links it", async ({ page }, testInfo) => {
  writingJourney(testInfo);
  test.setTimeout(600_000);
  const summary = `The evidence list jumps when a document opens ${Date.now()}`;

  await page.goto("/workday/rcsa", { timeout: 180_000 });
  await page.getByTestId("header-account").click();
  await page.getByTestId("header-feedback").click();
  const dialog = page.getByTestId("workday-feedback-dialog");
  await expect(dialog).toBeVisible();
  await page.getByTestId("workday-feedback-kind").selectOption("workflow-friction");
  await page.getByTestId("workday-feedback-summary").fill(summary);
  await shot(page, "workday-feedback-dialog-en", testInfo);
  await page.getByTestId("workday-feedback-send").click();
  await expect(page.getByTestId("workday-feedback-result")).toHaveAttribute("data-ok", "true", { timeout: 120_000 });
  /* The navigation is still the four items. */
  await expect(page.getByRole("navigation").first().getByRole("link")).toHaveCount(4);

  await actAs(page, "platform-product-owner", "Platform Product Owner");
  await page.goto("/product/feedback", { timeout: 180_000 });
  const row = page.locator(".app-item").filter({ hasText: summary });
  await expect(row).toBeVisible();
  const form = row.locator('form[data-testid^="feedback-triage-"]');
  await form.locator('select[name="status"]').selectOption("planned");
  await form.locator('select[name="severity"]').selectOption("medium");
  await form.locator('select[name="ownerLabel"]').selectOption("Role App Owner");
  await form.locator('select[name="roleAppId"]').selectOption("rcsa-cycle-assistant");
  await form.locator('select[name="stageId"]').selectOption("evidence-refresh");
  await form.locator('input[name="releaseVersion"]').fill("4.2.0");
  await form.locator('button[type="submit"]').click();
  await expect(page.locator(".app-item").filter({ hasText: summary })).toContainText("Planned", { timeout: 120_000 });
  await shot(page, "feedback-triaged-en", testInfo);
});

for (const path of ["/product/quality", "/product/integrations", "/product/feedback"]) {
  test(`no overflow on ${path}`, async ({ page }, testInfo) => {
    isolated(testInfo);
    test.setTimeout(300_000);
    await page.goto(path, { timeout: 180_000 });
    await noHorizontalOverflow(page);
    const name = path.split("/").pop() ?? "page";
    if (testInfo.project.name !== "desktop-1440") await shot(page, `${name}-en`, testInfo);
    if (path === "/product/quality") {
      const run = page.getByRole("link", { name: /^AER-/ }).first();
      if ((await run.count()) > 0) {
        await run.click();
        await expect(page.getByTestId("quality-run")).toBeVisible({ timeout: 120_000 });
        await noHorizontalOverflow(page);
        if (testInfo.project.name !== "desktop-1440") await shot(page, "quality-run-en", testInfo);
      }
    }
  });
}

test("German: the three sections read in German without overflow", async ({ page }, testInfo) => {
  writingJourney(testInfo);
  test.setTimeout(300_000);
  fixture("language:de");
  try {
    for (const path of ["/product/quality", "/product/integrations", "/product/feedback"]) {
      await page.goto(path, { timeout: 180_000 });
      await expect(page.locator("h1")).toHaveText(/Qualitaet|Integrationen|Rueckmeldungen/);
      await noHorizontalOverflow(page);
    }
    await page.goto("/product/quality", { timeout: 180_000 });
    await shot(page, "quality-de", testInfo);
  } finally {
    fixture("language:en");
  }
});
