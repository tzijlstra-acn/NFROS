/**
 * The five-part decision workspace, per flagship role, in the browser.
 *
 * Two kinds of test. The reading journey walks Question, Context, Evidence,
 * Options and Confirm and execute for both roles at every viewport project,
 * asserts that nothing is pre-selected, that Confirm stays disabled until the
 * rationale, its ownership and every change's own approval are given, that
 * the exact payload and target of each change are visible, and that no part
 * overflows the main region horizontally. It never confirms.
 *
 * The recording journeys WRITE. They record one decision per role, which is
 * J20 and J21 in the browser: the Third-Party Risk Manager's decision executes
 * every change under her own approval, the receipt states executed and not
 * executed separately, and it is still there after a reload. They run once,
 * in the 1920 project, and only against an isolated stack whose database was
 * freshly reset, never against the shared server on port 3000:
 *
 *   NFR_DB_PATH=<scratch db> npx tsx scripts/seed.ts
 *   NFR_DB_PATH=<scratch db> NFR_DIST_DIR=.next-<id> NFR_DEMO_MODE=safe npx next dev -p <port>
 *   NFR_BASE_URL=http://localhost:<port> npx playwright test tests/e2e/os-decisions.spec.ts
 */

import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

const SHARED = /localhost:3000\/?$/;

/** Skips on the shared server, where nothing may be written and the seeded state is not known. */
function isolatedOnly(testInfo: TestInfo): void {
  const base = String(testInfo.project.use.baseURL ?? "");
  test.skip(SHARED.test(base) || base.length === 0, "These journeys run only against an isolated stack.");
}

/** The writing journeys run once. */
function writesOnce(testInfo: TestInfo): void {
  isolatedOnly(testInfo);
  test.skip(testInfo.project.name !== "desktop-1920", "The recording journeys write, so they run in one viewport project.");
}

async function noHorizontalOverflow(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(() => {
    const main = document.querySelector("main");
    const panel = document.querySelector(".wd-dq-active");
    return {
      main: main ? main.scrollWidth - main.clientWidth : 0,
      document: document.documentElement.scrollWidth - window.innerWidth,
      panel: panel ? panel.scrollWidth - panel.clientWidth : 0,
    };
  });
  expect(overflow.main, `${label}: the main region overflows horizontally`).toBeLessThanOrEqual(1);
  expect(overflow.document, `${label}: the page overflows horizontally`).toBeLessThanOrEqual(1);
  expect(overflow.panel, `${label}: the decision panel overflows horizontally`).toBeLessThanOrEqual(1);
}

async function next(workspace: Locator): Promise<void> {
  await workspace.getByTestId("decision-next").click();
}

/** Walks to Confirm and execute, choosing the option at `optionIndex`. Asserts the parts on the way. */
async function walkToConfirm(page: Page, workspace: Locator, optionIndex: number): Promise<void> {
  await expect(workspace.getByTestId("decision-part-question")).toBeVisible();
  await expect(workspace.getByTestId("decision-authority-summary")).toContainText("What approval is required");
  await noHorizontalOverflow(page, "Question");

  await next(workspace);
  await expect(workspace.getByTestId("decision-part-context")).toBeVisible();
  await expect(workspace.getByTestId("decision-context-process")).toBeVisible();
  await expect(workspace.getByTestId("decision-context-meeting")).toBeVisible();
  await expect(workspace.getByTestId("decision-context-deadline")).toBeVisible();
  await noHorizontalOverflow(page, "Context");

  await next(workspace);
  await expect(workspace.getByTestId("decision-part-evidence")).toBeVisible();
  await expect(workspace.getByTestId("decision-evidence-conflict")).toBeVisible();
  await expect(workspace.getByTestId("decision-evidence-stale")).toBeVisible();
  await expect(workspace.getByTestId("decision-evidence-uncertainty")).toBeVisible();
  await noHorizontalOverflow(page, "Evidence");

  await next(workspace);
  const options = workspace.getByRole("radio");
  expect(await options.count()).toBeGreaterThan(1);
  // Nothing is pre-selected, and Confirm is not reachable without a choice.
  await expect(workspace.locator('[role="radio"][aria-checked="true"]')).toHaveCount(0);
  await expect(workspace.getByTestId("decision-next")).toBeDisabled();
  await noHorizontalOverflow(page, "Options");

  await options.nth(optionIndex).click();
  await expect(options.nth(optionIndex)).toHaveAttribute("aria-checked", "true");
  await expect(workspace.locator('[role="radio"][aria-checked="true"]')).toHaveCount(1);
  await next(workspace);
  await expect(workspace.getByTestId("decision-part-confirm")).toBeVisible();
}

/** Fills the rationale, confirms ownership and approves every change, asserting the gate on the way. */
async function armConfirm(page: Page, workspace: Locator, rationale: string): Promise<void> {
  const confirm = workspace.getByTestId("decision-confirm");
  const textarea = workspace.locator("textarea");

  // Nothing is pre-written for the person.
  await expect(textarea).toHaveValue("");
  await expect(confirm).toBeDisabled();
  await noHorizontalOverflow(page, "Confirm and execute");

  // The exact target of every change is visible, and the exact payload one click away.
  const changes = workspace.getByTestId("decision-change");
  const count = await changes.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    await expect(changes.nth(index).getByTestId("decision-change-target")).not.toBeEmpty();
  }
  await changes.first().getByRole("button", { name: /Exact change/ }).click();
  await expect(changes.first().getByTestId("decision-change-payload")).toContainText("Your approval is bound to this exact change");
  await noHorizontalOverflow(page, "Confirm and execute, exact change open");
  await changes.first().getByRole("button", { name: /Exact change/ }).click();

  await textarea.fill(rationale);
  await workspace.locator(".wd-dq-confirm input").check();

  // One tick does not approve every change: still disabled until each is approved.
  const boxes = changes.locator('input[type="checkbox"]');
  const required = await boxes.count();
  if (required > 0) {
    await expect(confirm).toBeDisabled();
    await expect(workspace.getByTestId("decision-confirm-blocked")).toContainText("Approve each change");
    for (let index = 0; index < required; index += 1) await boxes.nth(index).check();
    await expect(workspace.getByTestId("decision-approved-count")).toContainText(`${required} of ${required} approved`);
  }
  await expect(confirm).toBeEnabled();
}

for (const role of ["rcsa", "tprm"] as const) {
  test(`${role}: the five parts read through to Confirm and execute without recording`, async ({ page }, testInfo) => {
    isolatedOnly(testInfo);
    test.setTimeout(240_000);
    await page.goto(`/workday/${role}/decisions`, { timeout: 180_000 });

    const workspace = page.getByTestId("decision-workspace");
    await expect(workspace).toBeVisible({ timeout: 60_000 });
    await walkToConfirm(page, workspace, 0);
    await armConfirm(page, workspace, "Read through only. This journey never confirms the decision.");

    // Back to Options keeps the person's own choice, and still nothing else is chosen.
    await workspace.getByRole("button", { name: "Back" }).click();
    await expect(workspace.locator('[role="radio"][aria-checked="true"]')).toHaveCount(1);
  });
}

test("tprm: recording executes every change under the Third-Party Risk Manager's own approval (J20), and the receipt survives a reload (J21)", async ({ page }, testInfo) => {
  writesOnce(testInfo);
  test.setTimeout(300_000);
  await page.goto("/workday/tprm/decisions#DEC-2026-0741", { timeout: 180_000 });

  const workspace = page.getByTestId("decision-workspace");
  await expect(workspace).toBeVisible({ timeout: 60_000 });
  await expect(workspace.getByTestId("decision-part-question")).toContainText("RepairDesk");

  // The stage decision the process engine publishes is listed, with a link to the stage.
  const stageRow = page.getByTestId("decision-stage-row").filter({ hasText: "Stage 4 gate" });
  await expect(stageRow).toHaveAttribute("href", "/workday/tprm/processes/third-party-onboarding?stage=evidence-review");

  await walkToConfirm(page, workspace, 0);
  await armConfirm(
    page,
    workspace,
    "The recovery objective is missed by 1 hour 40 minutes on a service that supports an important business service.",
  );
  await expect(workspace.getByTestId("decision-approver")).toContainText("Stefan Brunner");
  await workspace.getByTestId("decision-confirm").click();

  const receipt = page.getByTestId("decision-receipt");
  await expect(receipt).toBeVisible({ timeout: 120_000 });
  await expect(receipt.getByTestId("decision-outcome-line")).toHaveText("Decision recorded. 3 of 3 changes executed.");
  await expect(receipt.getByTestId("decision-receipt-executed")).toContainText("Executed3");
  await expect(receipt.getByTestId("decision-receipt-failed")).toContainText("Not executed0");
  await expect(receipt.getByTestId("decision-receipt-approvals")).toHaveText("3 approvals granted by Stefan Brunner");
  await expect(receipt).not.toContainText("Marlene Aigner");
  await expect(receipt).not.toContainText("Decision rationale recorded");

  await page.reload();
  await expect(page.getByTestId("decision-receipt")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("decision-outcome-line")).toHaveText("Decision recorded. 3 of 3 changes executed.");
  await expect(page.getByTestId("decision-recorded-row")).toHaveCount(1);
});

test("rcsa: the receipt links back to its process stage and meeting, and the stage sees the decision", async ({ page }, testInfo) => {
  writesOnce(testInfo);
  test.setTimeout(300_000);
  await page.goto("/workday/rcsa/decisions#DEC-2026-0771", { timeout: 180_000 });

  const workspace = page.getByTestId("decision-workspace");
  await expect(workspace).toBeVisible({ timeout: 60_000 });
  await next(workspace);
  await expect(workspace.getByTestId("decision-context-process")).toContainText("RCSA Cycle, Stage 2: Evidence Refresh");
  await expect(workspace.getByTestId("decision-context-meeting")).toContainText("KRI-PAY-007");
  await workspace.getByRole("button", { name: "Back" }).click();

  await walkToConfirm(page, workspace, 0);
  await armConfirm(page, workspace, "One causal investigation names the mechanism behind all three Red indicators.");
  await expect(workspace.getByTestId("decision-approver")).toContainText("Marlene Aigner");
  await workspace.getByTestId("decision-confirm").click();

  const receipt = page.getByTestId("decision-receipt");
  await expect(receipt).toBeVisible({ timeout: 120_000 });
  await expect(receipt.getByTestId("decision-outcome-line")).toHaveText("Decision recorded. 2 of 2 changes executed.");
  await page.reload();
  await expect(page.getByTestId("decision-receipt")).toBeVisible({ timeout: 60_000 });

  const stageLink = page.getByTestId("decision-receipt").getByRole("link", { name: /RCSA Cycle, Stage 2: Evidence Refresh/ });
  await expect(stageLink).toHaveAttribute("href", "/workday/rcsa/processes/rcsa-cycle?stage=evidence-refresh");
  await stageLink.click();
  await expect(page.getByTestId("stage-decisions")).toContainText("One causal investigation", { timeout: 120_000 });
});
