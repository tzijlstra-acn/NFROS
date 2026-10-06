/**
 * The two reference stage journeys on the process engine.
 *
 * TPRM Stage 4 (Evidence Review) and RCSA Stage 2 (Evidence Refresh), end to
 * end in the browser: the durable AI preparation reaches Completed without a
 * permanent spinner, Continue stays disabled and says why until every
 * criterion passes, the human records the review and the decision, approves
 * the governed changes (the GRC platform confirms through the outbox), and
 * completes the stage under a confirmed rationale. A reload shows the same
 * state, because it is persisted.
 *
 * These journeys WRITE. Run them only against an isolated stack whose
 * database was freshly reset, never against the shared server on port 3000:
 *
 *   NFR_DB_PATH=<scratch db> npm run demo:reset
 *   NFR_DB_PATH=<scratch db> NFR_DIST_DIR=.next-<id> NFR_DEMO_MODE=safe npx next dev -p <port>
 *   NFR_BASE_URL=http://localhost:<port> npx playwright test tests/e2e/os-process-engine.spec.ts --project=desktop-1920
 */

import { expect, test, type Page, type TestInfo } from "@playwright/test";

const SHARED = /localhost:3000\/?$/;

/** Skips unless the run targets an isolated stack, and runs the writing journeys once. */
function guard(testInfo: TestInfo): void {
  const base = String(testInfo.project.use.baseURL ?? "");
  test.skip(SHARED.test(base) || base.length === 0, "These journeys write; they run only against an isolated stack.");
  test.skip(testInfo.project.name !== "desktop-1920", "The journeys write, so they run in one viewport project.");
}

async function waitForPreparation(page: Page) {
  await expect(page.getByTestId("preparation-state")).toHaveText(/Completed/, { timeout: 120_000 });
}

async function confirmIn(page: Page, testId: string, rationale: string) {
  const form = page.getByTestId(testId);
  await form.locator('textarea[name="rationale"]').fill(rationale);
  await form.locator('input[name="rationaleConfirmed"]').check();
  await form.locator('button[type="submit"]').click();
}

test.describe.configure({ mode: "serial" });

test("TPRM Stage 4 Evidence Review runs end to end on the engine", async ({ page }, testInfo) => {
  guard(testInfo);
  test.setTimeout(300_000);
  await page.goto("/workday/tprm/processes/third-party-onboarding", { timeout: 180_000 });

  const workspace = page.locator('[data-presentation-region="tprm-stage-workspace"]');
  await expect(workspace.getByRole("heading", { name: "Evidence Review" })).toBeVisible();
  await expect(page.locator('[data-presentation-region="tprm-evidence-status"]')).toBeVisible();
  await waitForPreparation(page);

  // Continue is disabled and says why.
  const complete = page.getByTestId("complete-stage");
  await expect(complete.locator('button[type="submit"]')).toBeDisabled();
  await expect(page.getByTestId("continue-disabled-reasons")).toContainText("Evidence dispositions is not recorded");

  // The person dispositions every item. Nothing is preselected for them.
  const task = page.getByTestId("task-evidence-dispositions");
  await expect(task.locator('input[type="radio"]:checked')).toHaveCount(0);
  for (const id of ["EVD-OB-0099-01", "EVD-OB-0099-03", "EVD-OB-0099-04"]) {
    await task.locator(`input[name="disposition:${id}"][value="accept"]`).check();
  }
  await task.locator('input[name="disposition:EVD-OB-0099-02"][value="accept-with-condition"]').check();
  await task.locator('input[name="note:EVD-OB-0099-02"]').fill("Full penetration test report before contract signature.");
  for (const id of ["EVD-OB-0099-05", "EVD-OB-0099-06"]) {
    await task.locator(`input[name="disposition:${id}"][value="outstanding"]`).check();
    await expect(task.locator(`input[name="chase:${id}"]`)).toHaveValue(/2026-10-\d{2}/);
  }
  await task.locator('button[type="submit"]').click();
  await expect(page.getByTestId("stage-tasks")).toContainText("Recorded", { timeout: 60_000 });

  // The stage gate decision, with a rationale confirmed as the person's own.
  const decision = page.getByTestId("decision-stage-gate");
  await decision.locator('input[name="optionId"][value="gate-conditional"]').check();
  await confirmIn(page, "decision-stage-gate", "Two items outstanding; pass with dated conditions.");
  await expect(page.getByTestId("stage-decisions")).toContainText("Pass with conditions", { timeout: 60_000 });

  // The governed changes: a local condition action and its GRC record through the outbox.
  await expect(page.getByTestId("tool-record-conditions")).toContainText("Proposed");
  await confirmIn(page, "execute-tools", "Record the gate conditions.");
  await expect(page.getByTestId("tool-register-conditions")).toContainText("Confirmed by the target system", { timeout: 60_000 });

  // Every criterion met; Continue completes under approval.
  await expect(complete.locator('button[type="submit"]')).toBeEnabled({ timeout: 60_000 });
  await confirmIn(page, "complete-stage", "Stage 4 outcome confirmed.");
  await expect(page.getByTestId("process-status-line")).toContainText("Stage 5 of 8", { timeout: 60_000 });

  // The next stage is open and executable (the TPRM stages workstream implemented Stages 5 to 8).
  await expect(page.locator('[data-presentation-region="tprm-stage-workspace"]').getByRole("heading", { name: "Specialist Reviews" })).toBeVisible();
  await expect(page.getByTestId("stage-not-executable")).toHaveCount(0);

  // Refresh: the state is persisted.
  await page.reload();
  await expect(page.getByTestId("process-status-line")).toContainText("Stage 5 of 8");
  await page.goto("/workday/tprm/processes/third-party-onboarding?stage=evidence-review");
  await expect(page.getByTestId("stage-status")).toHaveText("Completed");
  await expect(page.getByTestId("stage-artifacts")).toContainText("Stage 4 evidence review record");
});

test("RCSA Stage 2 Evidence Refresh runs end to end on the engine", async ({ page }, testInfo) => {
  guard(testInfo);
  test.setTimeout(300_000);
  await page.goto("/workday/rcsa/processes/rcsa-cycle", { timeout: 180_000 });

  const workspace = page.locator('[data-presentation-region="rcsa-stage-workspace"]');
  await expect(workspace.getByRole("heading", { name: "Evidence Refresh" })).toBeVisible();
  await waitForPreparation(page);
  await expect(page.getByTestId("complete-stage").locator('button[type="submit"]')).toBeDisabled();

  const task = page.getByTestId("task-evidence-sufficiency");
  for (const key of ["kri-readings", "incidents", "losses", "open-actions", "prior-assessment"]) {
    await task.locator(`input[name="sufficiency:${key}"][value="sufficient"]`).check();
  }
  await task.locator('input[name="sufficiency:control-tests"][value="limited"]').check();
  await task.locator('input[name="note:control-tests"]').fill("Two test evidence items are still outstanding.");
  await task.locator('button[type="submit"]').click();
  await expect(page.getByTestId("stage-tasks")).toContainText("Recorded", { timeout: 60_000 });

  // The seeded decision DEC-2026-0771, recorded through the governed decision path.
  const decision = page.getByTestId("decision-investigation-strategy");
  await decision.locator('input[name="optionId"][value="DEC-2026-0771-O1"]').check();
  await confirmIn(page, "decision-investigation-strategy", "One causal investigation; the indicators share a mechanism.");
  await expect(page.getByTestId("stage-decisions")).toContainText("One causal investigation", { timeout: 60_000 });

  await confirmIn(page, "execute-tools", "Register the investigation.");
  await expect(page.getByTestId("tool-register-investigation")).toContainText("Confirmed by the target system", { timeout: 60_000 });

  const complete = page.getByTestId("complete-stage");
  await expect(complete.locator('button[type="submit"]')).toBeEnabled({ timeout: 60_000 });
  await confirmIn(page, "complete-stage", "Evidence corpus accepted with stated limits.");
  await expect(page.getByTestId("process-status-line")).toContainText("Stage 3 of 8", { timeout: 60_000 });

  await page.reload();
  await page.goto("/workday/rcsa/processes/rcsa-cycle?stage=evidence-refresh");
  await expect(page.getByTestId("stage-status")).toHaveText("Completed");
  await expect(page.getByTestId("stage-artifacts")).toContainText("Evidence pack");
});
