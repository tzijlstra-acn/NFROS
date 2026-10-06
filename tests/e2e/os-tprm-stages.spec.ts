/**
 * Third-Party Onboarding, the full eight-stage journey in the browser.
 *
 * The seeded Elbmarsch file (TP-0104) is opened from the onboarding pipeline
 * and taken from Request and Intake to Handover to Monitoring: at each stage
 * the durable AI preparation reaches Completed, Continue stays disabled with
 * its reasons until the criteria pass, the person records the stage's own
 * input and decision (nothing is preselected), approves the governed changes
 * (the GRC writes confirmed through the outbox), and completes the stage
 * under a confirmed rationale.
 *
 * The first test checks the default file and the run switcher: without
 * `?run=` the page opens the Veridian file, the same run the landing page and
 * the role selector name, and the pipeline opens the other file by address.
 *
 * The journey is two tests, so it can be split around a server restart:
 *
 *   NFR_BASE_URL=http://localhost:<port> npx playwright test tests/e2e/os-tprm-stages.spec.ts --project=desktop-1920 -g "Stages 1 to 4"
 *   (stop and restart the server)
 *   NFR_BASE_URL=http://localhost:<port> npx playwright test tests/e2e/os-tprm-stages.spec.ts --project=desktop-1920 -g "Stages 5 to 8"
 *
 * The second test starts by reading the state the first one left, so it also
 * proves the state survived the restart. With NFR_CAPTURE_DIR set, each stage
 * is captured at 1920x1080 and 1366x768.
 *
 * These journeys WRITE. Run them only against an isolated stack whose
 * database was freshly reset, never against the shared server on port 3000.
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

const SHARED = /localhost:3000\/?$/;
const FILE = "/workday/tprm/processes/third-party-onboarding?run=RUN-TPRM-ELBMARSCH-2026";
const CAPTURE = process.env.NFR_CAPTURE_DIR ?? "";

function guard(testInfo: TestInfo): void {
  const base = String(testInfo.project.use.baseURL ?? "");
  test.skip(SHARED.test(base) || base.length === 0, "These journeys write; they run only against an isolated stack.");
  test.skip(testInfo.project.name !== "desktop-1920", "The journeys write, so they run in one viewport project.");
}

/* ==========================================================================
   Capture: the main region in segments, at both sizes
   ========================================================================== */

async function capture(page: Page, name: string): Promise<void> {
  if (!CAPTURE) return;
  mkdirSync(CAPTURE, { recursive: true });
  for (const size of [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(300);
    const segments = await page.evaluate(() => {
      const inner = document.querySelector(".wd-main-inner");
      let node: HTMLElement | null = inner instanceof HTMLElement ? inner : null;
      while (node && node !== document.body) {
        const style = getComputedStyle(node);
        if ((style.overflowY === "auto" || style.overflowY === "scroll") && node.scrollHeight > node.clientHeight) break;
        node = node.parentElement;
      }
      const scroller = node && node !== document.body ? node : document.scrollingElement;
      if (!scroller) return 1;
      (window as unknown as { __scroller?: Element }).__scroller = scroller;
      return Math.min(4, Math.max(1, Math.ceil(scroller.scrollHeight / scroller.clientHeight)));
    });
    for (let index = 0; index < segments; index += 1) {
      await page.evaluate((i) => {
        const scroller = (window as unknown as { __scroller?: Element }).__scroller ?? document.scrollingElement;
        if (scroller) scroller.scrollTop = i * scroller.clientHeight * 0.9;
      }, index);
      await page.waitForTimeout(150);
      await page.screenshot({ path: join(CAPTURE, `${name}-${size.width}-${index + 1}.png`) });
    }
    // No horizontal overflow in the main region.
    const overflow = await page.evaluate(() => {
      const scroller = (window as unknown as { __scroller?: Element }).__scroller ?? document.scrollingElement;
      return scroller ? scroller.scrollWidth - scroller.clientWidth : 0;
    });
    expect(overflow, `${name} at ${size.width} overflows horizontally`).toBeLessThanOrEqual(1);
    await page.evaluate(() => {
      const scroller = (window as unknown as { __scroller?: Element }).__scroller ?? document.scrollingElement;
      if (scroller) scroller.scrollTop = 0;
    });
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
}

/* ==========================================================================
   One stage, the way a person works it
   ========================================================================== */

async function openStage(page: Page, stageId: string, heading: string): Promise<void> {
  await page.goto(`${FILE}&stage=${stageId}`, { timeout: 180_000 });
  await expect(page.locator('[data-presentation-region="tprm-stage-workspace"]').getByRole("heading", { name: heading })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("preparation-state")).toHaveText(/Completed/, { timeout: 180_000 });
  const complete = page.getByTestId("complete-stage").locator('button[type="submit"]');
  await expect(complete).toBeDisabled();
  await expect(page.getByTestId("continue-disabled-reasons")).toBeVisible();
}

async function recordTask(page: Page, taskKey: string, fill: (task: ReturnType<Page["getByTestId"]>) => Promise<void>): Promise<void> {
  const task = page.getByTestId(`task-${taskKey}`);
  // Nothing is preselected for the person.
  await expect(task.locator('input[type="radio"]:checked')).toHaveCount(0);
  await fill(task);
  await task.locator('button[type="submit"]').click();
  await expect(page.getByTestId("stage-tasks")).toContainText("Recorded", { timeout: 60_000 });
}

async function confirmIn(page: Page, testId: string, rationale: string): Promise<void> {
  const form = page.getByTestId(testId);
  await form.locator('textarea[name="rationale"]').fill(rationale);
  await form.locator('input[name="rationaleConfirmed"]').check();
  await form.locator('button[type="submit"]').click();
}

async function decide(page: Page, decisionKey: string, optionId: string, label: string): Promise<void> {
  const decision = page.getByTestId(`decision-${decisionKey}`);
  await expect(decision.locator('input[name="optionId"]:checked')).toHaveCount(0);
  await decision.locator(`input[name="optionId"][value="${optionId}"]`).check();
  await confirmIn(page, `decision-${decisionKey}`, `${label}: my decision on the recorded file.`);
  await expect(page.getByTestId("stage-decisions")).toContainText(label, { timeout: 60_000 });
}

async function approveChanges(page: Page, toolKeys: string[]): Promise<void> {
  for (const key of toolKeys) await expect(page.getByTestId(`tool-${key}`)).toContainText("Proposed");
  await confirmIn(page, "execute-tools", "I approve the changes this decision implies.");
  for (const key of toolKeys) {
    await expect(page.getByTestId(`tool-${key}`)).toContainText(/Confirmed by the target system|Executed/, { timeout: 90_000 });
  }
}

async function completeStage(page: Page, nextLine: RegExp): Promise<void> {
  const complete = page.getByTestId("complete-stage");
  await expect(complete.locator('button[type="submit"]')).toBeEnabled({ timeout: 60_000 });
  await confirmIn(page, "complete-stage", "The stage outcome is confirmed and the rationale is mine.");
  await expect(page.getByTestId("process-status-line")).toContainText(nextLine, { timeout: 90_000 });
}

/* ==========================================================================
   The journey
   ========================================================================== */

test.describe.configure({ mode: "serial" });

test("Third-Party Onboarding opens the Veridian file by default and switches files with ?run=", async ({ page }, testInfo) => {
  guard(testInfo);
  test.setTimeout(600_000);
  const onboarding = "/workday/tprm/processes/third-party-onboarding";

  // Without ?run= the page opens the Veridian file, the one the day's story is told around.
  await page.goto(onboarding, { timeout: 180_000 });
  await expect(page.getByTestId("process-status-line")).toContainText("Stage 4 of 8", { timeout: 60_000 });
  const pipeline = page.getByTestId("onboarding-pipeline");
  await expect(pipeline.getByTestId("onboarding-pipeline-showing")).toHaveText("Showing Veridian Document Systems GmbH. Select another supplier to open its file.");
  await expect(pipeline.locator('tr[data-run="RUN-TPRM-VERIDIAN-2026"]')).toHaveAttribute("aria-current", "page");
  await capture(page, "default-veridian-run-switcher");

  // The switcher opens the other file, with the run in the address, and back.
  await pipeline.getByRole("link", { name: "Elbmarsch Dokumentenservice GmbH" }).click();
  await expect(page).toHaveURL(/\?run=RUN-TPRM-ELBMARSCH-2026$/, { timeout: 60_000 });
  await expect(page.getByTestId("process-status-line")).toContainText("Stage 1 of 8");
  await expect(page.getByTestId("onboarding-pipeline-showing")).toContainText("Showing Elbmarsch Dokumentenservice GmbH.");
  await page.getByTestId("onboarding-pipeline").getByRole("link", { name: "Veridian Document Systems GmbH" }).click();
  await expect(page).toHaveURL(/\?run=RUN-TPRM-VERIDIAN-2026$/, { timeout: 60_000 });
  await expect(page.getByTestId("process-status-line")).toContainText("Stage 4 of 8");

  // The landing page and the role selector name the same run.
  await page.goto("/", { timeout: 180_000 });
  await expect(page.getByTestId("role-preview-tprm")).toContainText("Third-Party Onboarding, Stage 4 of 8", { timeout: 60_000 });
  await page.goto("/workday", { timeout: 180_000 });
  await expect(page.getByTestId("signals-tprm")).toContainText("Third-Party Onboarding, Stage 4 of 8", { timeout: 60_000 });
});

test("Third-Party Onboarding, Stages 1 to 4 on the Elbmarsch file", async ({ page }, testInfo) => {
  guard(testInfo);
  test.setTimeout(900_000);

  // The pipeline lists both files; the Elbmarsch file opens from it.
  await page.goto("/workday/tprm/processes/third-party-onboarding", { timeout: 180_000 });
  const pipeline = page.getByTestId("onboarding-pipeline");
  await expect(pipeline).toContainText("Veridian Document Systems GmbH");
  await pipeline.getByRole("link", { name: "Elbmarsch Dokumentenservice GmbH" }).click();
  await expect(page.getByTestId("process-status-line")).toContainText("Stage 1 of 8");

  /* ---- Stage 1, Request and Intake ---- */
  await openStage(page, "request-and-intake", "Request and Intake");
  await capture(page, "stage1-request-intake");
  await recordTask(page, "intake-review", async (task) => {
    await task.locator('input[name="intake:owner"][value="correct"]').check();
    await task.locator('input[name="note:owner"]').fill("Relationship owner Stefan Brunner (P-002) until Retail Operations names a person.");
    await task.locator('input[name="intake:service"][value="confirm"]').check();
    await task.locator('input[name="intake:data"][value="correct"]').check();
    await task.locator('input[name="note:data"]').fill("Add account numbers, balances and transaction details.");
    await task.locator('input[name="intake:entities"][value="correct"]').check();
    await task.locator('input[name="note:entities"]').fill("ARC-DE, ARC-AT, ARC-CH from the second quarter of 2027");
    await task.locator('input[name="intake:duplicate"][value="no-duplicate"]').check();
  });
  await decide(page, "intake-proceed", "intake-proceed", "Proceed");
  await approveChanges(page, ["register-candidate"]);
  await completeStage(page, /Stage 2 of 8/);

  /* ---- Stage 2, Classification and Criticality ---- */
  await openStage(page, "classification-and-criticality", "Classification and Criticality");
  await expect(page.getByTestId("stage-preparation")).toContainText("Illustrative regulatory context, not legal advice.");
  await capture(page, "stage2-classification");
  await recordTask(page, "classification-judgment", async (task) => {
    await task.locator('input[name="judgment:classification"][value="outsourcing"]').check();
    await task.locator('input[name="note:classification"]').fill("Same function as TP-0071, which is recorded as an outsourcing.");
    await task.locator('input[name="judgment:materiality"][value="not-material"]').check();
    await task.locator('input[name="judgment:criticality"][value="standard"]').check();
    await task.locator('input[name="judgment:review-depth"][value="full"]').check();
  });
  await decide(page, "classification", "class-outsourcing", "Outsourcing, not material");
  await approveChanges(page, ["record-criticality"]);
  await completeStage(page, /Stage 3 of 8/);

  /* ---- Stage 3, Tailored Due Diligence ---- */
  await openStage(page, "tailored-due-diligence", "Tailored Due Diligence");
  await capture(page, "stage3-tailored-due-diligence");
  await recordTask(page, "request-scope", async (task) => {
    for (const part of ["questionnaire", "certification", "assurance", "financials"]) {
      await task.locator(`input[name="scope:${part}"][value="reuse"]`).check();
    }
    for (const part of ["continuity", "penetration-test", "exit-plan", "data-location"]) {
      await task.locator(`input[name="scope:${part}"][value="request"]`).check();
    }
    await task.locator('input[name="scope:payment-data"][value="remove"]').check();
    await task.locator('input[name="note:payment-data"]').fill("The service prints statements and executes no payments.");
    await task.locator('input[name="blocker"][value="none"]').check();
  });
  await decide(page, "questionnaire-dispatch", "dispatch-approve", "Approve and dispatch");
  await approveChanges(page, ["record-request", "dispatch-request"]);
  await completeStage(page, /Stage 4 of 8/);

  /* ---- Stage 4, Evidence Review ---- */
  await openStage(page, "evidence-review", "Evidence Review");
  await expect(page.getByTestId("task-evidence-dispositions")).not.toContainText("EVD-OB-0104-10");
  await capture(page, "stage4-evidence-review");
  await recordTask(page, "evidence-dispositions", async (task) => {
    for (const id of ["EVD-OB-0104-02", "EVD-OB-0104-03", "EVD-OB-0104-04", "EVD-OB-0104-08"]) {
      await task.locator(`input[name="disposition:${id}"][value="accept"]`).check();
    }
    await task.locator('input[name="disposition:EVD-OB-0104-05"][value="accept-with-condition"]').check();
    await task.locator('input[name="note:EVD-OB-0104-05"]').fill("A current business continuity test before go-live.");
    for (const id of ["EVD-OB-0104-06", "EVD-OB-0104-07", "EVD-OB-0104-09"]) {
      await task.locator(`input[name="disposition:${id}"][value="outstanding"]`).check();
    }
  });
  await decide(page, "stage-gate", "gate-conditional", "Pass with conditions");
  await approveChanges(page, ["record-conditions", "register-conditions"]);
  await completeStage(page, /Stage 5 of 8/);
});

test("Third-Party Onboarding, Stages 5 to 8 on the Elbmarsch file", async ({ page }, testInfo) => {
  guard(testInfo);
  test.setTimeout(900_000);

  // The state the first half left, read after the restart.
  await page.goto(FILE, { timeout: 180_000 });
  await expect(page.getByTestId("process-status-line")).toContainText("Stage 5 of 8", { timeout: 60_000 });
  await page.goto(`${FILE}&stage=evidence-review`);
  await expect(page.getByTestId("stage-status")).toHaveText("Completed");
  await expect(page.getByTestId("stage-artifacts")).toContainText("Stage 4 evidence review record");

  /* ---- Stage 5, Specialist Reviews ---- */
  await openStage(page, "specialist-reviews", "Specialist Reviews");
  await expect(page.getByTestId("stage-sources")).toContainText("MTG-TPRM-OB-0104-HUDDLE");
  await capture(page, "stage5-specialist-reviews");
  await recordTask(page, "specialist-conditions", async (task) => {
    for (const id of ["cond-EVD-OB-0104-11", "cond-EVD-OB-0104-12", "cond-EVD-OB-0104-14"]) {
      await task.locator(`input[name="spec:${id}"][value="agree"]`).check();
    }
    await task.locator('input[name="spec:conflict-location"][value="follow-b"]').check();
    await task.locator('input[name="note:conflict-location"]').fill("Swiss correspondence stays in Switzerland until a transfer basis is documented.");
    await task.locator('input[name="spec:pending-EVD-OB-0104-13"][value="carry"]').check();
    await task.locator('input[name="spec:huddle"][value="written-opinions"]').check();
  });
  await decide(page, "specialist-escalation", "specialist-agree", "Agree the conditions");
  await completeStage(page, /Stage 6 of 8/);

  /* ---- Stage 6, Contract and Conditions ---- */
  await openStage(page, "contract-and-conditions", "Contract and Conditions");
  await capture(page, "stage6-contract-conditions");
  await recordTask(page, "contract-review", async (task) => {
    await task.locator('input[name="contract:cond-EVD-OB-0104-11"][value="reflected"]').check();
    for (const id of ["cond-EVD-OB-0104-14", "pending-EVD-OB-0104-13"]) {
      await task.locator(`input[name="contract:${id}"][value="track"]`).check();
    }
    for (const id of ["cond-EVD-OB-0104-12", "clause-COB-OB-2026-0104-03", "missing-reporting", "missing-resilience", "subprocessor-WeserdataBackupGmbH"]) {
      await task.locator(`input[name="contract:${id}"][value="negotiate"]`).check();
    }
  });
  await decide(page, "contract-sufficiency", "contract-trade-off", "Accept a documented trade-off");
  await approveChanges(page, ["record-contract-conditions", "register-contract-conditions"]);
  await completeStage(page, /Stage 7 of 8/);

  /* ---- Stage 7, Decision and Onboarding ---- */
  await openStage(page, "decision-and-onboarding", "Decision and Onboarding");
  await capture(page, "stage7-decision-onboarding");
  await decide(page, "onboarding-approval", "onboarding-conditional", "Approve with conditions");
  await approveChanges(page, ["record-onboarding-assessment", "register-supplier", "register-service", "start-monitoring"]);
  await completeStage(page, /Stage 8 of 8/);

  /* ---- Stage 8, Handover to Monitoring ---- */
  await openStage(page, "handover-to-monitoring", "Handover to Monitoring");
  await capture(page, "stage8-handover-monitoring");
  await recordTask(page, "handover-plan", async (task) => {
    await task.locator('input[name="owner"][value="P-002"]').check();
    await task.locator('input[name="first-check-set"][value="set"]').check();
    await task.locator('input[name="first-check"]').fill("2026-12-15");
    await task.locator('input[name="reassessment-set"][value="set"]').check();
    await task.locator('input[name="reassessment"]').fill("2028-10-06");
    const conditions = task.locator('input[type="radio"][name^="condition:"][value="carry"]');
    const count = await conditions.count();
    for (let index = 0; index < count; index += 1) await conditions.nth(index).check();
  });
  await decide(page, "monitoring-intensity", "monitoring-semiannual", "Semi-annual monitoring");
  await approveChanges(page, ["activate-monitoring-plan", "update-register", "send-handover-note"]);
  await completeStage(page, /Completed, all 8 stages/);

  // The pipeline and the file show the completed onboarding, after a reload.
  await page.reload();
  await expect(page.getByTestId("process-status-line")).toContainText("Completed, all 8 stages");
  await expect(page.getByTestId("onboarding-pipeline").locator('tr[data-run="RUN-TPRM-ELBMARSCH-2026"]')).toContainText("Completed");
  await capture(page, "completed-file");

  // Home reads the completed stages.
  await page.goto("/workday/tprm", { timeout: 180_000 });
  await expect(page.locator("main")).toBeVisible();
  await capture(page, "home-after-journey");
});
