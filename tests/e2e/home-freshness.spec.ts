/**
 * Home freshness: the journey a professional actually takes.
 *
 * Plan section 4.3: Home updates immediately after a meeting, a decision, a
 * process stage or an action. This walks the reader's own path through the
 * product, entirely by clicking, and checks Home after each change:
 *
 *   record a decision on Decisions, return to Home through the rail;
 *   complete an action in the Work Hub, return to Home through the rail;
 *   complete the current process stage, return to Home through the rail.
 *
 * Nothing is reloaded between a change and Home showing it. A marker is put
 * on `window` immediately before each change and checked once Home shows the
 * result: a document load in between would discard it, so its survival is
 * what proves the change reached Home through the server action's
 * revalidation and a client navigation, not through a reload. The marker is
 * set after reaching the page where the change is made, because some Work Hub
 * and process links load a new document on the way there, and that is not
 * the claim under test.
 *
 * Completing a process stage through the engine needs its tasks, decisions,
 * approvals and worker-run preparation, and that contract belongs to the
 * process engine workstream, which is still building it. The stage step
 * therefore writes the completed stage run on the isolated database the way
 * the engine records it, and checks that Home shows it after a client
 * navigation. That the engine's own server action revalidates the workday is
 * covered on the server by `tests/integration/home-freshness.test.ts`.
 *
 * THIS SPEC WRITES. It records a decision, completes an action and completes a
 * stage. It runs
 * only against an isolated stack: it needs `NFR_HOME_FRESHNESS_DB` naming that
 * stack's database outside the repository, which it resets before it starts,
 * and it refuses port 3000.
 *
 *   $env:NFR_BASE_URL="http://localhost:3104"
 *   $env:NFR_HOME_FRESHNESS_DB="<scratchpad>\os-home-truth.db"
 *   npx playwright test tests/e2e/home-freshness.spec.ts --project=desktop-1366
 */

import { execFileSync } from "node:child_process";
import { resolve, sep } from "node:path";
import Database from "better-sqlite3";
import { expect, test, type Locator, type Page } from "@playwright/test";

const DB = process.env.NFR_HOME_FRESHNESS_DB;
const BASE = process.env.NFR_BASE_URL ?? "";

function isolated(): string | null {
  if (!DB) return "NFR_HOME_FRESHNESS_DB is not set, so there is no isolated database to write to.";
  if (!BASE || /:3000(\/|$)/.test(BASE)) return "NFR_BASE_URL must name an isolated stack, never port 3000.";
  const repository = resolve(process.cwd());
  if (resolve(DB).startsWith(repository + sep)) return `${DB} is inside the repository.`;
  return null;
}

/** Restores the seeded day on the isolated database, through the same reset the product uses. */
function resetIsolatedDay(): void {
  try {
    execFileSync("npx", ["tsx", "scripts/reset.ts"], {
      env: { ...process.env, NFR_DB_PATH: DB },
      stdio: "pipe",
      shell: true,
      timeout: 480_000,
    });
  } catch (error) {
    const output = error as { stdout?: Buffer; stderr?: Buffer };
    throw new Error(
      `The isolated day could not be reset. ${output.stderr?.toString().slice(-600) ?? ""} ${output.stdout?.toString().slice(-600) ?? ""}`,
    );
  }
}

/**
 * Navigation waits are longer than the default, because a client navigation
 * on a development server waits for the route to compile and render.
 */
const nav = expect.configure({ timeout: 120_000 });

function rail(page: Page): Locator {
  return page.getByRole("navigation", { name: /^(Work areas|Arbeitsbereiche)$/ });
}

async function goHome(page: Page): Promise<void> {
  await rail(page).getByRole("link", { name: /^(Home|Start)/ }).click();
  await nav(page).toHaveURL(/\/workday\/rcsa(\?|$)/);
  await nav(page.locator('[data-home-region="done"]')).toBeVisible();
}

/**
 * Moves the decision flow on one step, until `ready` is on screen.
 *
 * The retry is for hydration only: a click that lands before the handler
 * exists is lost, and that window is not what this spec tests. The step is
 * still required to appear.
 */
async function advance(page: Page, ready: Locator): Promise<void> {
  await expect(async () => {
    if (!(await ready.first().isVisible())) {
      await page.getByRole("button", { name: "Next", exact: true }).click({ timeout: 5_000 });
    }
    await expect(ready.first()).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 90_000 });
}

async function mark(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as { __homeFreshness?: string }).__homeFreshness = "kept";
  });
}

async function expectNoReload(page: Page): Promise<void> {
  expect(
    await page.evaluate(() => (window as unknown as { __homeFreshness?: string }).__homeFreshness),
    "the page was reloaded, so this change was not shown by revalidation",
  ).toBe("kept");
}

function openCount(text: string | null): number {
  const match = /(\d+)\s+open/.exec(text ?? "");
  return match ? Number(match[1]) : 0;
}

test.describe("Home freshness", () => {
  test("Home reflects a decision, an action and a process stage without a reload", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1366", "The journey writes state, so it runs once.");
    const refusal = isolated();
    test.skip(refusal !== null, refusal ?? "");
    test.setTimeout(1_200_000);

    /*
     * A development server compiles each route on its first request, which can
     * take longer than a navigation assertion waits. The routes are requested
     * once without running any client code, then the day is reset, so the
     * journey starts from the seeded morning on a warm server.
     */
    for (const path of ["/workday/rcsa", "/workday/rcsa/decisions", "/workday/rcsa/work", "/workday/rcsa/processes"]) {
      await page.request.get(path, { timeout: 240_000 });
    }
    resetIsolatedDay();

    await page.goto("/workday/rcsa", { waitUntil: "domcontentloaded" });
    const done = page.locator('[data-home-region="done"]');
    const partner = page.locator('[data-home-region="partner-update"]');
    const actionsCell = page.locator('[data-home-cell="actions"]');
    await expect(done).toBeVisible();

    // The seeded morning: nothing done by the person yet, and no decision executed.
    await expect(done).not.toContainText(/completed by you/);
    await expect(partner).not.toContainText(/after your decision on/);

    /* ---------- 1. A decision ---------------------------------------- */
    await test.step("record a decision on Decisions", async () => {
      await rail(page).getByRole("link", { name: /^Decisions/ }).click();
      await nav(page).toHaveURL(/\/decisions/);
      await mark(page);

      const options = page.getByRole("radio");
      await advance(page, options);
      const recommended = options.filter({ hasText: "Specialist recommendation" });
      await ((await recommended.count()) > 0 ? recommended.first() : options.first()).click();

      const rationale = page.locator("textarea");
      await advance(page, rationale);
      await rationale
        .first()
        .fill("One causal investigation names the mechanism, and three explanations would each describe one symptom.");

      const confirm = page.getByLabel(/I confirm this rationale is mine/);
      await advance(page, confirm);
      await confirm.check();
      await page.getByRole("button", { name: /Confirm and execute/ }).click();
      // The queue moves on to the next decision and counts this one as recorded.
      await nav(page.getByText(/1 recorded today/).first()).toBeVisible();
    });

    await goHome(page);
    await expectNoReload(page);
    await expect(done).toContainText(/1 completed by you/);
    await expect(partner).toContainText(/after your decision on/);
    await expect(partner.locator('[data-source="executed"] a[href*="/decisions#"]').first()).toBeVisible();

    /* ---------- 2. An action ----------------------------------------- */
    const openBefore = openCount(await actionsCell.textContent());
    expect(openBefore, "the seeded day has open actions to complete").toBeGreaterThan(0);

    await test.step("complete an action in the Work Hub", async () => {
      await rail(page).getByRole("link", { name: /^Work/ }).click();
      await nav(page).toHaveURL(/\/work/);
      await page.locator('main a[href*="view=actions"]').first().click();
      await page.locator('main a[href*="view=actions"][href*="item="]').first().click();
      await nav(page).toHaveURL(/item=/);
      await mark(page);

      /*
       * Opening the form is retried for hydration only: a click that lands
       * before the handler exists is lost. The assertion is not relaxed.
       */
      const condition = page.getByLabel(/How the completion condition is met/);
      await expect(async () => {
        if (!(await condition.isVisible())) {
          await page.getByRole("button", { name: "Complete", exact: true }).click({ timeout: 5_000 });
        }
        await expect(condition).toBeVisible({ timeout: 3_000 });
      }).toPass({ timeout: 60_000 });
      await condition.fill(
        "The committee paper was issued to its named recipients, which meets the recorded condition.",
      );
      await page.getByLabel(/I confirm this is my judgment/).check();
      await page.getByRole("button", { name: "Record", exact: true }).click();
      await expect(page.getByRole("button", { name: "Reopen", exact: true })).toBeEnabled({ timeout: 60_000 });
    });

    await goHome(page);
    await expectNoReload(page);
    await expect(actionsCell).toContainText(`${openBefore - 1} open`);
    await expect(done).toContainText(/2 completed by you/);

    /* ---------- 3. A process stage ------------------------------------ */
    await test.step("complete the current process stage", async () => {
      await rail(page).getByRole("link", { name: /^Processes/ }).click();
      await nav(page).toHaveURL(/\/processes/);
      await mark(page);

      /*
       * Completing a stage through the engine needs its whole stage contract
       * (preparation by the worker, tasks, decisions, the completion
       * approval), which the process engine workstream is still building. So
       * the completion is written here exactly as the engine records it on
       * the stage run, on the isolated database only. That the engine's own
       * completion action revalidates the workday is asserted by
       * `tests/integration/home-freshness.test.ts`.
       */
      const db = new Database(DB as string);
      try {
        db.prepare(
          `update role_app_stage_runs
             set status = 'completed', completed_at = ?, completed_by_user_id = 'P-003'
           where id = (
             select s.id from role_app_stage_runs s
             join role_app_runs r on r.id = s.role_app_run_id
             where r.role_id = 'rcsa' and s.status != 'completed'
             order by s.opened_at limit 1
           )`,
        ).run(new Date().toISOString());
      } finally {
        db.close();
      }
    });

    await goHome(page);
    await expectNoReload(page);
    await expect(done).toContainText(/3 completed by you/);
    await done.getByRole("button", { name: /Done today/ }).click();
    await expect(done.locator('[data-done-row="stage"][href*="/processes/rcsa-cycle?stage="]').first()).toBeVisible();
  });
});
