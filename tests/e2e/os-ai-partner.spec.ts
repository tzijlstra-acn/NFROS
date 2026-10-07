/**
 * The AI Partner in Wave 3, in the browser: the scenario clock moves, the
 * routines run, and their work appears on Home, in Updates and in the dock
 * with its lineage; a person answers a suggestion and gives feedback; the
 * context follows the selection and the conversation survives navigation.
 *
 * Writes, so it runs only against an isolated stack. It needs
 * `NFR_AI_PARTNER_DB` naming that stack's database outside the repository
 * (the clock and the language are set there, as the workday has no clock
 * control in this release), and it refuses port 3000.
 *
 *   $env:NFR_BASE_URL="http://localhost:3114"
 *   $env:NFR_AI_PARTNER_DB="<scratchpad>\os-ai-partner.db"
 *   npx playwright test tests/e2e/os-ai-partner.spec.ts --output=<scratchpad>\pw-os-ai-partner
 *
 * Synthetic institution and data.
 */

import { resolve, sep } from "node:path";
import Database from "better-sqlite3";
import { expect, test, type Page } from "@playwright/test";

const DB = process.env.NFR_AI_PARTNER_DB;
const BASE = process.env.NFR_BASE_URL ?? "";
const SHOTS = "docs/screenshots/os-excellence/os-ai-partner";

function isolated(): string | null {
  if (!DB) return "NFR_AI_PARTNER_DB is not set, so there is no isolated database to write to.";
  if (!BASE || /:3000(\/|$)/.test(BASE)) return "NFR_BASE_URL must name an isolated stack, never port 3000.";
  if (resolve(DB).startsWith(resolve(process.cwd()) + sep)) return `${DB} is inside the repository.`;
  return null;
}

function db() {
  return new Database(DB as string);
}

function setScenario(fields: { moment?: string; language?: "en" | "de" }) {
  const handle = db();
  try {
    if (fields.moment) handle.prepare("update scenario_runs set current_moment = ?").run(fields.moment);
    if (fields.language) handle.prepare("update scenario_runs set language = ?").run(fields.language);
  } finally {
    handle.close();
  }
}

function scalar(sql: string): number {
  const handle = db();
  try {
    return (handle.prepare(sql).get() as { n: number }).n;
  } finally {
    handle.close();
  }
}

async function noOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

/** Opens Home and waits until the routines' work has been stated there. */
async function homeWithRoutineWork(page: Page, role: string) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await page.goto(`/workday/${role}`);
    const statement = page.locator('[data-home-region="partner-update"] [data-source="routine"]');
    if ((await statement.count()) > 0) return statement.first();
    await page.waitForTimeout(2500);
  }
  return page.locator('[data-home-region="partner-update"] [data-source="routine"]').first();
}

async function openDock(page: Page) {
  const dock = page.locator('[data-presentation-region="ai-partner-dock"]');
  if (!(await dock.isVisible().catch(() => false))) await page.getByTestId("header-ai").click();
  await expect(dock).toHaveAttribute("data-presentation-ready", "true", { timeout: 60_000 });
  return dock;
}

test.describe.configure({ mode: "serial" });

test.describe("the AI Partner as an operating partner", () => {
  test.beforeEach(({}, info) => {
    const reason = isolated();
    test.skip(reason !== null, reason ?? "");
    test.skip(info.project.name !== "desktop-1920" && !info.title.includes("overflow"), "The write journey runs once, at 1920.");
  });

  test("the clock moves, the routines run, and their work appears on Home with lineage", async ({ page }) => {
    setScenario({ moment: "10:05", language: "en" });
    const statement = await homeWithRoutineWork(page, "rcsa");
    await expect(statement).toBeVisible();
    await expect(page.locator('[data-home-region="partner-update"] a[data-lineage-kind="meeting"]').first()).toBeVisible();
    expect(scalar("select count(*) as n from ai_routine_runs where role_id = 'rcsa'")).toBeGreaterThan(0);
    await page.screenshot({ path: `${SHOTS}/after-home-routines-rcsa-en-1920x1080.png` });
  });

  test("Updates lists the routine's new work within the budget", async ({ page }) => {
    await page.goto("/workday/rcsa");
    await page.getByTestId("header-updates").click();
    const panel = page.getByTestId("updates-panel");
    await expect(panel).toHaveAttribute("data-state", /present|empty/);
    const routine = panel.locator('[data-category="routine-created-work"]');
    expect(await routine.count()).toBeGreaterThan(0);
    expect(await page.locator('[data-testid="updates-raised"] > li').count()).toBeLessThanOrEqual(5);
    await page.screenshot({ path: `${SHOTS}/after-updates-routines-rcsa-en-1920x1080.png` });
  });

  test("the dock shows the routine's suggestions and runs; the header count equals the dock's", async ({ page }) => {
    await page.goto("/workday/rcsa");
    const header = await page.getByTestId("header-ai").getAttribute("data-count");
    const dock = await openDock(page);
    await page.getByRole("tab", { name: /Suggestions/ }).click();
    await expect(dock.locator("article.app-suggestion").first()).toBeVisible();
    await expect(dock.getByText(/Prepared by/).first()).toBeVisible();
    expect(await dock.locator(".app-partner").getAttribute("data-needs-you")).toBe(header);
    await page.screenshot({ path: `${SHOTS}/after-dock-suggestions-rcsa-en-1920x1080.png` });

    await page.getByRole("tab", { name: /Activity/ }).click();
    const runs = dock.locator('[data-partner-region="routine-runs"] [data-routine-run]');
    expect(await runs.count()).toBeGreaterThan(0);
    await expect(dock.locator('[data-partner-region="routine-runs"] a[data-lineage-kind="meeting-preparation"]').first()).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/after-dock-routine-runs-rcsa-en-1920x1080.png` });
  });

  test("a person rejects a suggestion with a reason and gives feedback; both are stored", async ({ page }) => {
    await page.goto("/workday/rcsa");
    const dock = await openDock(page);
    await page.getByRole("tab", { name: /Suggestions/ }).click();
    const card = dock.locator('article.app-suggestion[data-disposition="new"]').filter({ hasText: /Prepared by/ }).first();
    await expect(card).toBeVisible();
    const id = await card.getAttribute("data-suggestion-id");

    await card.locator("details.app-feedback summary").click();
    await card.locator('[data-feedback-kind="useful"]').click();
    await expect.poll(() => scalar(`select count(*) as n from ai_feedback where target_id = '${id}' and kind = 'useful'`)).toBe(1);

    await card.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Reject" }).click();
    await card.locator('[data-answer-form="reject"] input').fill("Already covered in my own notes.");
    await card.locator('[data-answer-form="reject"] button[type="submit"]').click();
    await expect
      .poll(() => scalar(`select count(*) as n from ai_suggestion_dispositions where suggestion_id = '${id}' and to_disposition = 'rejected'`))
      .toBe(1);
    await expect(dock.locator('[data-partner-region="handled-suggestions"]')).toBeVisible({ timeout: 30_000 });
  });

  test("the context follows the selection and the conversation survives navigation", async ({ page }) => {
    await page.goto("/workday/rcsa/work?view=meetings&item=MTG-2026-0005");
    await expect
      .poll(() => scalar("select count(*) as n from partner_contexts where role_id = 'rcsa' and meeting_id = 'MTG-2026-0005'"), { timeout: 30_000 })
      .toBe(1);
    const dock = await openDock(page);
    await page.getByRole("tab", { name: /Chat/ }).click();
    await page.locator(".app-partner-foot textarea, .app-partner-foot input").first().fill("What changed?");
    await page.keyboard.press("Enter");
    await expect(dock.locator('.app-chat-turn[data-author="partner"]').first()).toBeVisible({ timeout: 60_000 });
    const turns = await dock.locator(".app-chat-turn").count();

    await page.goto("/workday/rcsa/decisions#DEC-2026-0771");
    await expect
      .poll(() => scalar("select count(*) as n from partner_contexts where role_id = 'rcsa' and decision_id = 'DEC-2026-0771'"), { timeout: 30_000 })
      .toBe(1);
    const again = await openDock(page);
    await page.getByRole("tab", { name: /Chat/ }).click();
    await expect.poll(() => again.locator(".app-chat-turn").count(), { timeout: 30_000 }).toBe(turns);
    await page.screenshot({ path: `${SHOTS}/after-dock-chat-context-rcsa-en-1920x1080.png` });
  });

  test("German, and no overflow at any viewport", async ({ page }, info) => {
    if (info.project.name === "desktop-1920") setScenario({ language: "de" });
    await page.goto("/workday/rcsa");
    await noOverflow(page);
    if (info.project.name === "desktop-1366") await page.screenshot({ path: `${SHOTS}/after-home-routines-rcsa-en-1366x768.png` });
    await page.goto("/workday/tprm");
    await openDock(page);
    await noOverflow(page);
    const size = info.project.name.replace("desktop-", "");
    const viewport = size === "1920" ? "1920x1080" : size === "1440" ? "1440x900" : "1366x768";
    await page.screenshot({ path: `${SHOTS}/after-dock-tprm-${info.project.name === "desktop-1920" ? "de" : "en"}-${viewport}.png` });
  });

  test.afterAll(() => {
    if (isolated() === null) setScenario({ language: "en" });
  });
});
