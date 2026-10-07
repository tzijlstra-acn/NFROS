/**
 * RCSA Cycle Assistant, the full eight-stage journey in the browser.
 *
 * The Q4 2026 cycle of payment repair and manual override (ARC-DE) is taken
 * from Evidence Refresh to Monitoring and Reassessment, and the event-driven
 * reassessment it opens is taken through Scope and Trigger and through
 * Evidence Refresh, on a decision of its own (migration 0007). At each stage the
 * durable AI preparation reaches Completed, Continue stays disabled with its
 * reasons until the criteria pass, the person records the stage's own input
 * and decision (nothing is preselected), approves the governed changes, and
 * completes the stage under a confirmed rationale. The challenge workshop
 * waits for its meeting, and its minutes are drafted and confirmed in
 * Meetings, not on the stage.
 *
 * Two tests, so the journey can be split around a server restart:
 *
 *   NFR_BASE_URL=http://localhost:<port> NFR_DB_PATH=<isolated db> npx playwright test tests/e2e/os-rcsa-stages.spec.ts --project=desktop-1920 -g "Stages 2 to 5"
 *   (stop and restart the server)
 *   NFR_BASE_URL=http://localhost:<port> NFR_DB_PATH=<isolated db> npx playwright test tests/e2e/os-rcsa-stages.spec.ts --project=desktop-1920 -g "Stages 5 to 8"
 *
 * The second test starts by reading the state the first one left, so it also
 * proves the state survived the restart. A third test only reads: every stage
 * of the completed cycle at 1920x1080, 1440x900 and 1366x768, with no
 * sideways scrolling. The scenario clock is moved in the
 * isolated database, as the presenter clock would move it. With
 * NFR_CAPTURE_DIR set, each stage is captured at 1920x1080 and 1366x768, and
 * two stages also in German.
 *
 * These journeys WRITE. Run them only against an isolated stack whose
 * database was freshly seeded, never against the shared server on port 3000
 * or the repository's own database.
 */

import { mkdirSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import Database from "better-sqlite3";
import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

const SHARED = /localhost:3000\/?$/;
const PROCESS = "/workday/rcsa/processes/rcsa-cycle";
const CYCLE_RUN = "RUN-RCSA-PAYOPS-Q4-2026";
const WORKSHOP = "/workday/rcsa/work?view=meetings&item=MTG-2026-0005&ui=v3.3";
const CAPTURE = process.env.NFR_CAPTURE_DIR ?? "";

/** The isolated database, or null when none is named or it is inside the repository. */
function isolatedDb(): string | null {
  const path = process.env.NFR_DB_PATH;
  if (!path) return null;
  const full = resolve(path);
  return full.startsWith(resolve(process.cwd()) + sep) ? null : full;
}

function guard(testInfo: TestInfo): void {
  const base = String(testInfo.project.use.baseURL ?? "");
  test.skip(SHARED.test(base) || base.length === 0 || isolatedDb() === null, "These journeys write and move the clock; they run only against an isolated stack.");
  test.skip(testInfo.project.name !== "desktop-1920", "The journeys write, so they run in one viewport project.");
}

/** Moves the isolated scenario clock and language, as the presenter clock would. */
function setScenario(moment: string, language: "en" | "de" = "en"): void {
  const path = isolatedDb();
  if (!path) throw new Error("No isolated database.");
  const db = new Database(path, { fileMustExist: true });
  db.prepare("update scenario_runs set current_moment = ?, language = ?, event_triggered = case when ? >= '14:05' then 1 else event_triggered end").run(moment, language, moment);
  db.close();
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
    const overflow = await page.evaluate(() => {
      const scroller = (window as unknown as { __scroller?: Element }).__scroller ?? document.scrollingElement;
      const doc = document.scrollingElement;
      return Math.max(scroller ? scroller.scrollWidth - scroller.clientWidth : 0, doc ? doc.scrollWidth - doc.clientWidth : 0);
    });
    expect(overflow, `${name} at ${size.width} overflows horizontally`).toBeLessThanOrEqual(1);
    await page.evaluate(() => {
      const scroller = (window as unknown as { __scroller?: Element }).__scroller ?? document.scrollingElement;
      if (scroller) scroller.scrollTop = 0;
    });
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
}

/** The same view in German, then back to English. */
async function captureGerman(page: Page, moment: string, name: string, heading: string): Promise<void> {
  if (!CAPTURE) return;
  setScenario(moment, "de");
  try {
    await page.reload();
    await expect(page.locator('[data-presentation-region="rcsa-stage-workspace"]').getByRole("heading", { name: heading })).toBeVisible({ timeout: 60_000 });
    const text = await page.locator("main").innerText();
    expect(/[äöüÄÖÜß]/.test(text), "no umlaut renders").toBe(false);
    await capture(page, name);
  } finally {
    setScenario(moment, "en");
    await page.reload();
  }
}

/* ==========================================================================
   One stage, the way a person works it
   ========================================================================== */

async function openStage(page: Page, path: string, stageId: string, heading: string): Promise<void> {
  await page.goto(`${path}${path.includes("?") ? "&" : "?"}stage=${stageId}`, { timeout: 180_000 });
  await expect(page.locator('[data-presentation-region="rcsa-stage-workspace"]').getByRole("heading", { name: heading })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("preparation-state")).toHaveText(/Completed/, { timeout: 180_000 });
  await expect(page.getByTestId("complete-stage").locator('button[type="submit"]')).toBeDisabled();
  await expect(page.getByTestId("continue-disabled-reasons")).toBeVisible();
}

async function recordTask(page: Page, taskKey: string, fill: (task: Locator) => Promise<void>): Promise<void> {
  const task = page.getByTestId(`task-${taskKey}`);
  // Nothing is preselected for the person.
  await expect(task.locator('input[type="radio"]:checked')).toHaveCount(0);
  await fill(task);
  await task.locator('button[type="submit"]').click();
  await expect(page.getByTestId("stage-tasks")).toContainText("Recorded", { timeout: 60_000 });
}

/** Checks every radio of a group of rows with the given value. */
async function checkAll(task: Locator, namePrefix: string, value: string): Promise<void> {
  const radios = task.locator(`input[type="radio"][name^="${namePrefix}"][value="${value}"]`);
  const count = await radios.count();
  expect(count, `${namePrefix} has rows`).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) await radios.nth(index).check();
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
  await confirmIn(page, `decision-${decisionKey}`, `${label}: my decision on the record in front of me.`);
  /* Recorded and final: the form gives way to the record, which on a loaded machine can take a while. */
  await expect(page.getByTestId(`decision-${decisionKey}`)).toHaveCount(0, { timeout: 180_000 });
  await expect(page.getByTestId("stage-decisions")).toContainText(label, { timeout: 90_000 });
}

async function approveChanges(page: Page, toolKeys: string[]): Promise<void> {
  for (const key of toolKeys) await expect(page.getByTestId(`tool-${key}`)).toContainText("Proposed", { timeout: 90_000 });
  await confirmIn(page, "execute-tools", "I approve the changes this decision implies.");
  for (const key of toolKeys) {
    await expect(page.getByTestId(`tool-${key}`)).toContainText(/Confirmed by the target system|Executed/, { timeout: 90_000 });
  }
}

async function completeStage(page: Page, nextLine: RegExp): Promise<void> {
  const complete = page.getByTestId("complete-stage");
  await expect(complete.locator('button[type="submit"]')).toBeEnabled({ timeout: 60_000 });
  await confirmIn(page, "complete-stage", "The stage outcome is confirmed and the rationale is mine.");
  await expect(page.getByTestId("process-status-line")).toContainText(nextLine, { timeout: 120_000 });
}

/* ==========================================================================
   The journey
   ========================================================================== */

test.describe.configure({ mode: "serial" });

test("RCSA Cycle Assistant, Stages 2 to 5 of the Q4 cycle, up to the workshop", async ({ page }, testInfo) => {
  guard(testInfo);
  test.setTimeout(900_000);
  setScenario("07:45");

  await page.goto(PROCESS, { timeout: 180_000 });
  await expect(page.getByTestId("process-status-line")).toContainText("Stage 2 of 8");
  await expect(page.getByTestId("rcsa-portfolio")).toContainText("RCSA-ARC-DE-PAYOPS-2026-Q4");

  /* ---- Stage 1, Scope and Trigger: completed in the seed for this cycle ---- */
  await page.goto(`${PROCESS}?stage=scope-trigger`, { timeout: 180_000 });
  await expect(page.getByTestId("stage-status")).toHaveText("Completed");
  await capture(page, "stage1-scope-trigger-seeded");

  /* ---- Stage 2, Evidence Refresh ---- */
  await openStage(page, PROCESS, "evidence-refresh", "Evidence Refresh");
  await capture(page, "stage2-evidence-refresh");
  await recordTask(page, "evidence-sufficiency", async (task) => {
    for (const key of ["kri-readings", "incidents", "losses", "open-actions", "prior-assessment"]) {
      await task.locator(`input[name="sufficiency:${key}"][value="sufficient"]`).check();
    }
    await task.locator('input[name="sufficiency:control-tests"][value="limited"]').check();
    await task.locator('input[name="note:control-tests"]').fill("Two test evidence items are still outstanding.");
  });
  await decide(page, "investigation-strategy", "DEC-2026-0771-O1", "One causal investigation");
  await approveChanges(page, ["register-investigation"]);
  await completeStage(page, /Stage 3 of 8/);

  /* ---- Stage 3, Risk and Control Change ---- */
  await openStage(page, PROCESS, "risk-control-change", "Risk and Control Change");
  await expect(page.getByTestId("stage-preparation")).toContainText("CTL-PAY-014");
  await capture(page, "stage3-risk-control-change");
  await recordTask(page, "change-review", async (task) => {
    await checkAll(task, "classification:", "material");
  });
  await decide(page, "likelihood-inference", "DEC-2026-0744-O1", "Evidence about detection, not about likelihood");
  await completeStage(page, /Stage 4 of 8/);

  /* ---- Stage 4, First-line Input ---- */
  await openStage(page, PROCESS, "first-line-input", "First-line Input");
  await capture(page, "stage4-first-line-input");
  await recordTask(page, "first-line-review", async (task) => {
    for (const id of ["EVD-2026-41855", "EVD-2026-RCSA-1L-01", "TST-2026-0318"]) {
      await task.locator(`input[name="class:${id}"][value="workshop"]`).check();
    }
    for (const id of ["EVD-2026-RCSA-1L-02", "EVD-2026-RCSA-1L-03", "TST-2026-0281"]) {
      await task.locator(`input[name="class:${id}"][value="accepted"]`).check();
    }
  });
  await decide(page, "workshop-agenda", "DEC-2026-0745-O1", "Place the contested risk third");
  await approveChanges(page, ["send-challenge-pack"]);
  await completeStage(page, /Stage 5 of 8/);

  /* ---- Stage 5, before the workshop is held: the preparation waits for its source ---- */
  await page.goto(`${PROCESS}?stage=challenge-workshop`, { timeout: 180_000 });
  await expect(page.getByTestId("preparation-state")).toHaveText(/Waiting for source/, { timeout: 120_000 });
  await expect(page.getByTestId("continue-disabled-reasons")).toContainText("from 10:30 to 12:00");
  await expect(page.getByTestId("complete-stage").locator('button[type="submit"]')).toBeDisabled();
  await capture(page, "stage5-challenge-workshop-waiting");
});

test("RCSA Cycle Assistant, Stages 5 to 8, and the event-driven reassessment it opens", async ({ page }, testInfo) => {
  guard(testInfo);
  test.setTimeout(1_200_000);

  // The state the first half left, read after the restart.
  await page.goto(PROCESS, { timeout: 180_000 });
  await expect(page.getByTestId("process-status-line")).toContainText("Stage 5 of 8", { timeout: 60_000 });
  await page.goto(`${PROCESS}?stage=first-line-input`);
  await expect(page.getByTestId("stage-status")).toHaveText("Completed");
  await expect(page.getByTestId("stage-artifacts")).toContainText("Workshop agenda");

  /* ---- The workshop is held; its minutes are drafted and confirmed in Meetings ---- */
  setScenario("12:00");
  await page.goto(WORKSHOP, { timeout: 180_000, waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("meeting-lifecycle")).toHaveAttribute("data-phase", "after", { timeout: 60_000 });
  const after = page.getByTestId("after-pane");
  await expect(async () => {
    if (!(await after.getByTestId("minutes-body").isVisible())) await after.getByTestId("prepare-minutes").click({ timeout: 5_000 });
    await expect(after.getByTestId("minutes-body")).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 90_000 });
  /*
   * A draft can leave an owner or a due date open (the offline draft leaves the
   * tenant configuration request undated). The person completes it in the
   * editor before confirming; nothing is confirmed while the draft is not ready.
   */
  if (!(await after.getByTestId("minutes-ready").isVisible())) {
    await expect(async () => {
      if (!(await after.getByTestId("minutes-editor").isVisible())) await after.getByTestId("minutes-edit").click({ timeout: 5_000 });
      await expect(after.getByTestId("minutes-editor")).toBeVisible({ timeout: 8_000 });
    }).toPass({ timeout: 45_000 });
    const editor = after.getByTestId("minutes-editor");
    const dates = editor.locator('input[type="date"][name^="due-"]');
    for (let index = 0; index < (await dates.count()); index += 1) {
      if ((await dates.nth(index).inputValue()).length === 0) await dates.nth(index).fill("2026-10-13");
    }
    const owners = editor.locator('select[name^="owner-"]');
    for (let index = 0; index < (await owners.count()); index += 1) {
      if ((await owners.nth(index).inputValue()).length === 0) await owners.nth(index).selectOption("P-002");
    }
    await after.getByTestId("minutes-save").click();
    await expect(after.getByTestId("minutes-ready")).toBeVisible({ timeout: 45_000 });
  }
  const confirm = after.getByTestId("confirm-form");
  await confirm.locator('input[name="confirmDecisions"]').check();
  await confirm.locator('input[name="confirmActions"]').check();
  await confirm.locator('input[name="confirmDistribution"]').check();
  await confirm.locator('textarea[name="reason"]').fill("These minutes are my record of the challenge workshop.");
  await confirm.locator('input[name="confirmed"]').check();
  await confirm.getByTestId("confirm-submit").click();
  await expect(after.getByTestId("minutes-record")).toBeVisible({ timeout: 60_000 });
  await expect(after.getByTestId("minutes-result")).toContainText("brought up to date through the process engine");

  /* ---- Stage 5, Challenge Workshop ---- */
  await openStage(page, PROCESS, "challenge-workshop", "Challenge Workshop");
  await expect(page.getByTestId("stage-sources")).toContainText("Workshop meeting and transcript");
  await expect(page.locator('[data-met="true"]', { hasText: "The workshop minutes are confirmed in Meetings" })).toBeVisible();
  await capture(page, "stage5-challenge-workshop");
  await recordTask(page, "workshop-outcome", async (task) => {
    await task.locator('input[name="actions"][value="complete"]').check();
    await checkAll(task, "issue:", "carry");
  });
  await decide(page, "challenge-conclusion", "DEC-2026-0772-O3", "Partially Effective, residual Medium-High, and an off cycle reassessment");
  await completeStage(page, /Stage 6 of 8/);

  /* ---- Stage 6, Rating and Appetite ---- */
  await openStage(page, PROCESS, "rating-appetite", "Rating and Appetite");
  await expect(page.getByTestId("stage-preparation")).toContainText("3 x 4 = 12 of 25, High, outside appetite");
  await capture(page, "stage6-rating-appetite");
  await captureGerman(page, "12:00", "stage6-rating-appetite-de", "Bewertung und Risikobereitschaft");
  await recordTask(page, "rating-judgment", async (task) => {
    await task.locator('input[name="effectiveness"][value="partially-effective"]').check();
    await task.locator('input[name="likelihood"][value="3"]').check();
    await task.locator('input[name="impact"][value="4"]').check();
    await task.locator('input[name="rating"][value="high"]').check();
    await task.locator('input[name="appetite"][value="outside"]').check();
    await checkAll(task, "line:", "stands");
  });
  await decide(page, "residual-and-appetite", "rating-remediation", "Ratify and commit a remediation plan");
  await approveChanges(page, ["record-residual"]);
  await completeStage(page, /Stage 7 of 8/);

  /* ---- Stage 7, Actions and Approval, after the 14:05 event ---- */
  setScenario("15:00");
  await openStage(page, PROCESS, "actions-approval", "Actions and Approval");
  await capture(page, "stage7-actions-approval");
  await captureGerman(page, "15:00", "stage7-actions-approval-de", "Massnahmen und Genehmigung");
  await recordTask(page, "action-review", async (task) => {
    await task.locator('input[name="wording"][value="sufficient"]').check();
    await task.locator('input[name="owner"][value="P-007"]').check();
    await task.locator('input[name="due"][value="commit"]').check();
    await task.locator('input[name="due-on"]').fill("2026-12-31");
    await checkAll(task, "existing:", "separate");
    await task.locator("fieldset", { hasText: "no owner" }).locator('input[value="fold"]').check();
  });
  await decide(page, "reasoning-revision", "DEC-2026-0782-O1", "Revise the reasoning, hold the score");
  await decide(page, "action-plan", "plan-approve", "Approve the plan and submit for sign-off");
  await approveChanges(page, ["create-plan-action", "agree-completion-condition", "register-action-plan"]);
  await completeStage(page, /Stage 8 of 8/);

  /* ---- Stage 8, Monitoring and Reassessment ---- */
  await openStage(page, PROCESS, "monitoring-reassessment", "Monitoring and Reassessment");
  await expect(page.getByTestId("stage-preparation")).toContainText("INC-2026-0412");
  await capture(page, "stage8-monitoring-reassessment");
  await recordTask(page, "monitoring-review", async (task) => {
    await task.locator('input[name="frequency"][value="weekly"]').check();
    await task.locator('input[name="threshold"]').fill("A further Red reading, or two weeks above 3.5.");
    await task.locator('input[name="material-change"][value="yes"]').check();
    await task.locator('input[name="material-change-note"]').fill("The 14:05 fallback event waived secondary review on live overrides.");
    await task.locator('input[name="escalation"][value="not-required"]').check();
  });
  await decide(page, "monitoring-plan", "monitoring-off-cycle", "Open an off-cycle reassessment");
  await approveChanges(page, ["activate-indicator-monitoring", "open-reassessment"]);
  // Completing the cycle starts the event-driven reassessment, which the page now follows.
  await completeStage(page, /Stage 1 of 8/);

  /* ---- The portfolio holds both runs ---- */
  const portfolio = page.getByTestId("rcsa-portfolio");
  await expect(portfolio.locator("tbody tr")).toHaveCount(2);
  const cycleRow = portfolio.locator(`tr[data-run="${CYCLE_RUN}"]`);
  await expect(cycleRow).toContainText("Completed");
  await expect(cycleRow).toContainText("RSK-0211: 3 x 4 = 12 of 25, High, outside appetite");
  const reassessmentRow = portfolio.locator('tr[aria-current="page"]');
  await expect(reassessmentRow).toContainText(`Event-driven, from ${CYCLE_RUN}`);
  const reassessmentRun = await reassessmentRow.getAttribute("data-run");
  expect(reassessmentRun).toMatch(/^RUN-RCSA-OFFCYCLE-/);
  const reassessment = `${PROCESS}?run=${encodeURIComponent(reassessmentRun ?? "")}`;

  /* ---- Stage 1 on the event-driven reassessment ---- */
  await openStage(page, reassessment, "scope-trigger", "Scope and Trigger");
  await expect(page.getByTestId("stage-preparation")).toContainText("event-driven reassessment");
  await capture(page, "stage1-scope-trigger-reassessment");
  await recordTask(page, "scope-confirmation", async (task) => {
    await checkAll(task, "process:", "out");
    await task.locator('input[name="process:PRC-0041"][value="in"]').check();
    await checkAll(task, "entity:", "out");
    await task.locator('input[name="entity:ARC-DE"][value="in"]').check();
    await task.locator('input[name="period"][value="confirm"]').check();
    await checkAll(task, "participant:", "required");
  });
  await decide(page, "scope-and-trigger", "scope-off-cycle", "Confirm an off-cycle scope");
  await completeStage(page, /Stage 2 of 8/);

  /* ---- Stage 2 of the reassessment runs on a decision of its own, never on the Q4 cycle's ---- */
  const ownDecision = `DEC-${(reassessmentRun ?? "").replace(/^RUN-/, "")}-S2`;
  await openStage(page, reassessment, "evidence-refresh", "Evidence Refresh");
  await expect(page.getByTestId("stage-decisions")).toContainText(ownDecision);
  await expect(page.getByTestId("stage-decisions")).not.toContainText("DEC-2026-0771");
  await capture(page, "stage2-reassessment-own-decision");
  await recordTask(page, "evidence-sufficiency", async (task) => {
    for (const key of ["kri-readings", "incidents", "losses", "open-actions", "prior-assessment", "control-tests"]) {
      await task.locator(`input[name="sufficiency:${key}"][value="sufficient"]`).check();
    }
  });
  await decide(page, "investigation-strategy", `${ownDecision}-O01`, "One causal investigation");
  await approveChanges(page, ["register-investigation"]);
  await completeStage(page, /Stage 3 of 8/);
  await page.goto(`${reassessment}&stage=evidence-refresh`, { timeout: 180_000 });
  await expect(page.getByTestId("stage-status")).toHaveText("Completed");
  await capture(page, "stage2-reassessment-completed");

  /* ---- The completed cycle stays reachable, and survives a reload ---- */
  await page.goto(`${PROCESS}?run=${CYCLE_RUN}&stage=monitoring-reassessment`, { timeout: 180_000 });
  await expect(page.getByTestId("process-status-line")).toContainText("Completed, all 8 stages");
  await expect(page.getByTestId("stage-artifacts")).toContainText("Monitoring plan");
  await page.reload();
  await expect(page.getByTestId("stage-status")).toHaveText("Completed");
  await capture(page, "completed-cycle");

  // Home reads the completed cycle and the new run.
  await page.goto("/workday/rcsa", { timeout: 180_000 });
  await expect(page.locator("main")).toBeVisible();
  await capture(page, "home-after-journey");
});

/* Reads only: the record the journey left, at the three projected sizes. */
test("RCSA Cycle Assistant, every stage of the completed cycle fits 1920, 1440 and 1366 without sideways scrolling", async ({ page }, testInfo) => {
  guard(testInfo);
  test.setTimeout(600_000);
  const stages = ["scope-trigger", "evidence-refresh", "risk-control-change", "first-line-input", "challenge-workshop", "rating-appetite", "actions-approval", "monitoring-reassessment"];
  for (const size of [{ width: 1920, height: 1080 }, { width: 1440, height: 900 }, { width: 1366, height: 768 }]) {
    await page.setViewportSize(size);
    for (const stageId of stages) {
      await page.goto(`${PROCESS}?run=${CYCLE_RUN}&stage=${stageId}`, { timeout: 180_000 });
      await expect(page.getByTestId("stage-status")).toHaveText("Completed", { timeout: 60_000 });
      const overflow = await page.evaluate(() => {
        const doc = document.scrollingElement;
        const main = document.querySelector(".wd-main");
        const portfolio = document.querySelector('[data-testid="rcsa-portfolio"]');
        return {
          document: doc ? doc.scrollWidth - doc.clientWidth : 0,
          main: main ? main.scrollWidth - main.clientWidth : 0,
          portfolio: portfolio ? portfolio.scrollWidth - portfolio.clientWidth : 0,
        };
      });
      expect(overflow.document, `${stageId} at ${size.width}: document`).toBeLessThanOrEqual(1);
      expect(overflow.main, `${stageId} at ${size.width}: main`).toBeLessThanOrEqual(1);
      expect(overflow.portfolio, `${stageId} at ${size.width}: portfolio`).toBeLessThanOrEqual(1);
    }
  }
});
