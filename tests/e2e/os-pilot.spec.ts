/**
 * The design-partner pilot workspace (plan 7.7, Wave 5) and Value (plan 12).
 *
 * One journey, as the Pilot Lead: save the setup with an agreed window,
 * record a baseline by hand and import the rest, start the pilot, take a
 * governed exit decision (a figure in the commercial implication is refused,
 * the approval is bound to the reviewed change), and download the evidence
 * pack, which carries the decision and no credential. Then the permission
 * split: the Platform Product Owner reads the overview and the exit decision
 * but cannot act or open setup; another persona cannot open the pilot. The
 * readiness section reads the actual controls, and Value keeps every
 * commercial measure unmeasured. German renders. Nothing overflows at
 * 1920x1080, 1440x900 or 1366x768.
 *
 * The baseline figures typed here are test input in an isolated database,
 * labelled as such in their period and source; they are not a client's
 * figures. The journey writes, so it runs only against an isolated stack:
 * `NFR_BASE_URL` at its server and `NFR_DB_PATH` at its database, never the
 * shared server on port 3000. It reseeds that database first.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve, sep } from "node:path";
import Database from "better-sqlite3";
import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

const SHOTS = "docs/screenshots/os-excellence/os-pilot";

function base(): string {
  return process.env.NFR_BASE_URL ?? "http://localhost:3000";
}

function isolatedDb(): string | null {
  const path = process.env.NFR_DB_PATH;
  if (!path) return null;
  const full = resolve(path);
  return full.startsWith(resolve(process.cwd()) + sep) ? null : full;
}

function requireIsolatedStack(): void {
  test.skip(
    !process.env.NFR_BASE_URL || base().includes(":3000") || isolatedDb() === null,
    "The pilot journey writes. Point NFR_BASE_URL and NFR_DB_PATH at an isolated stack.",
  );
}

function reseed(): void {
  const path = isolatedDb();
  if (!path) throw new Error("No isolated database.");
  execFileSync(process.execPath, [resolve("node_modules/tsx/dist/cli.mjs"), "scripts/seed.ts"], {
    env: { ...process.env, NFR_DB_PATH: path },
    stdio: "ignore",
    timeout: 300_000,
  });
}

function setLanguage(language: "en" | "de"): void {
  const path = isolatedDb();
  if (!path) throw new Error("No isolated database.");
  const db = new Database(path, { fileMustExist: true });
  db.prepare("update scenario_runs set language = ?").run(language);
  db.close();
}

async function actAs(page: Page, persona: string): Promise<void> {
  await page.goto(`${base()}/product/pilot`, { waitUntil: "domcontentloaded" });
  const strip = page.getByTestId("console-acting-persona");
  if ((await strip.getAttribute("data-persona")) === persona) return;
  await page.getByTestId("console-persona-select").selectOption(persona);
  await page.getByTestId("console-persona-switch").click();
  await expect(page.locator(`[data-testid="console-acting-persona"][data-persona="${persona}"]`)).toBeVisible({ timeout: 60_000 });
}

async function open(page: Page, path: string): Promise<void> {
  const response = await page.goto(`${base()}${path}`, { waitUntil: "domcontentloaded" });
  expect(response?.status() ?? 0, `${path} returned an error`).toBeLessThan(400);
  await expect(page.getByTestId("pilot-workspace").or(page.getByTestId("product-value"))).toBeVisible();
}

/** Submits a console form, retrying until its result is on screen; a click can land before hydration. */
async function submitUntil(control: Locator, result: Locator): Promise<void> {
  await expect(async () => {
    if (!(await result.isVisible())) await control.click({ timeout: 5_000 });
    await expect(result).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 60_000 });
}

async function noHorizontalOverflow(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(() => {
    const doc = document.scrollingElement;
    const main = document.querySelector(".app-main");
    let beyond = 0;
    document.querySelectorAll(".app-main *").forEach((element) => {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.right > window.innerWidth + 1) beyond += 1;
    });
    return { document: doc ? doc.scrollWidth - doc.clientWidth : 0, main: main ? main.scrollWidth - main.clientWidth : 0, beyond };
  });
  expect(overflow.document, `${label}: document overflows`).toBeLessThanOrEqual(0);
  expect(overflow.main, `${label}: main region overflows`).toBeLessThanOrEqual(0);
  expect(overflow.beyond, `${label}: elements past the right edge`).toBe(0);
}

async function shot(page: Page, name: string, focus?: Locator): Promise<void> {
  if (focus) await focus.scrollIntoViewIfNeeded();
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width ?? 0}x${size?.height ?? 0}.png` });
}

function writesHere(testInfo: TestInfo): void {
  test.skip(testInfo.project.name !== "desktop-1920", "The write journey runs once, in the 1920 project.");
}

test.describe.configure({ mode: "serial", timeout: 480_000 });

test.describe("pilot workspace", () => {
  test.beforeEach(() => requireIsolatedStack());

  test("setup, baseline, start, governed exit decision and evidence pack", async ({ page }, testInfo) => {
    writesHere(testInfo);
    test.setTimeout(420_000);
    reseed();
    setLanguage("en");
    await actAs(page, "pilot-lead");

    /* Overview: in setup, readiness read from the controls. */
    await open(page, "/product/pilot");
    await expect(page.getByTestId("pilot-status")).toHaveAttribute("data-status", "setup");
    await expect(page.getByTestId("control-role-switch")).toHaveAttribute("data-status", "not-verified");
    await expect(page.getByTestId("control-approval-identity")).toHaveAttribute("data-status", "not-verified");
    await expect(page.getByTestId("control-integrations")).toHaveAttribute("data-status", "simulated");
    await expect(page.getByTestId("control-backup-restore")).toHaveAttribute("data-status", "not-verified");
    await shot(page, "overview-before");

    /* Setup: agree the window; the exit decision is not available yet. */
    await open(page, "/product/pilot/setup");
    await expect(page.getByTestId("pilot-start-conditions")).toBeVisible();
    await page.getByTestId("setup-start").fill("2026-10-12");
    await page.getByTestId("setup-end").fill("2026-12-04");
    const setupResult = page.getByTestId("pilot-setup-form-result");
    await submitUntil(page.getByTestId("pilot-setup-form-submit"), setupResult);
    await expect(setupResult).toHaveAttribute("data-ok", "true");
    await shot(page, "setup", page.getByTestId("pilot-cohort"));

    /* Baseline: one by hand, the rest imported. */
    await open(page, "/product/pilot/baseline");
    await expect(page.getByTestId("baseline-status-cycle-time")).toHaveAttribute("data-status", "not-measured");
    await page.getByTestId("measure-edit-cycle-time").locator("summary").click();
    await page.getByTestId("baseline-value-input-cycle-time").fill("21");
    await page.getByTestId("baseline-period-input-cycle-time").fill("Test entry, not a client figure");
    await page.getByTestId("baseline-note-input-cycle-time").fill("Playwright test input in an isolated database");
    const baselineResult = page.getByTestId("baseline-form-cycle-time-result");
    await submitUntil(page.getByTestId("baseline-form-cycle-time-submit"), baselineResult);
    await expect(baselineResult).toHaveAttribute("data-ok", "true");
    await expect(page.getByTestId("baseline-status-cycle-time")).toHaveAttribute("data-status", "measured", { timeout: 20_000 });

    await page.getByTestId("baseline-import-source").fill("Playwright test input, isolated database");
    await page
      .getByTestId("baseline-import-rows")
      .fill(
        [
          "measure, value, period",
          "preparation-time, 90, Test entry",
          "handoffs, 6, Test entry",
          "systems-opened, 5, Test entry",
          "overdue-actions, 9, Test entry",
          "evidence-completeness, 70, Test entry",
        ].join("\n"),
      );
    const importResult = page.getByTestId("baseline-import-form-result");
    await submitUntil(page.getByTestId("baseline-import-form-submit"), importResult);
    await expect(importResult).toHaveAttribute("data-ok", "true");
    await expect(page.getByTestId("baseline-recorded-count")).toContainText("6 of 6", { timeout: 20_000 });
    /* The synthetic equivalent stays beside the baseline and is labelled. */
    await expect(page.getByTestId("synthetic-overdue-actions")).toContainText("measured from synthetic data");
    await shot(page, "baseline", page.getByTestId("measure-cycle-time"));

    /* Start the pilot. */
    await open(page, "/product/pilot/setup");
    /* Once started, the page re-renders without the start control, so the status is the result. */
    const running = page.locator('[data-testid="pilot-status"][data-status="running"]');
    await expect(async () => {
      const start = page.getByTestId("pilot-start-form-submit");
      if (!(await running.isVisible()) && (await start.isVisible())) await start.click({ timeout: 5_000 });
      await expect(running).toBeVisible({ timeout: 10_000 });
    }).toPass({ timeout: 60_000 });

    /* The exit decision: a figure is refused, words are reviewed, the approval is bound. */
    await open(page, "/product/pilot/exit");
    await page.getByTestId("exit-outcome").selectOption("extend");
    await page.getByTestId("exit-extended-end").fill("2027-01-29");
    await page.getByTestId("exit-rationale").fill("The first-line input stage needs four more weeks of use before a scale decision can rest on it.");
    await page.getByTestId("exit-commercial").fill("A saving of 20 percent.");
    await page.getByTestId("exit-next-wave").fill("Run the next wave with the Austrian entity and a verified inbound integration.");
    const proposal = page.getByTestId("exit-proposal-result");
    await submitUntil(page.getByTestId("exit-review"), proposal);
    await expect(proposal).toContainText("without amounts or percentages");

    await page.getByTestId("exit-commercial").fill("No commercial implication can be stated until the partner's own readings show a change against its baseline.");
    await expect(async () => {
      if (!(await page.getByTestId("exit-approval").isVisible())) await page.getByTestId("exit-review").click({ timeout: 5_000 });
      await expect(page.getByTestId("exit-approval")).toBeVisible({ timeout: 10_000 });
    }).toPass({ timeout: 60_000 });
    await expect(page.getByTestId("exit-approval-lines")).toContainText("Extend pilot");
    await expect(page.getByTestId("exit-fingerprint")).toHaveText(/^[0-9a-f]{12}$/);
    await shot(page, "exit-approval", page.getByTestId("exit-approval"));

    /* Without the confirmation the approval is refused. */
    await page.getByTestId("exit-approval-rationale").fill("I own this decision and its reasons.");
    const recorded = page.getByTestId("exit-record-result");
    await submitUntil(page.getByTestId("exit-record"), recorded);
    await expect(recorded).toHaveAttribute("data-ok", "false");

    await page.getByTestId("exit-approval-confirm").check();
    await page.getByTestId("exit-record").click();
    await expect(page.getByTestId("exit-record-result")).toHaveAttribute("data-ok", "true", { timeout: 30_000 });
    await expect(page.getByTestId("exit-decision-outcome").first()).toHaveText("Extend pilot", { timeout: 20_000 });
    await expect(page.getByTestId("exit-decision-approval").first()).toHaveText(/^AUD-/);
    await expect(page.getByTestId("pilot-status")).toHaveAttribute("data-status", "running");
    await shot(page, "exit-recorded", page.getByTestId("exit-decisions"));

    /* The evidence pack: server side, the decision in it, no credential. */
    const download = await page.request.get(`${base()}/product/pilot/evidence-pack`);
    expect(download.status()).toBe(200);
    expect(download.headers()["content-disposition"] ?? "").toContain("attachment");
    const body = await download.text();
    expect(body).not.toMatch(/\bsk-[A-Za-z0-9_-]{20,}/);
    expect(body).not.toMatch(/OPENAI_API_KEY|SESSION_SECRET|Bearer\s/);
    const pack = JSON.parse(body) as { kind: string; digest: string; content: Record<string, unknown> };
    expect(pack.kind).toBe("nfros-pilot-evidence-pack");
    expect(pack.digest).toMatch(/^[0-9a-f]{64}$/);
    const content = pack.content as {
      exitDecisions: Array<{ outcome: string; approvalId: string | null }>;
      baseline: Array<{ baseline: { status: string } }>;
      readiness: { controls: unknown[] };
      knownLimitations: unknown[];
    };
    expect(content.exitDecisions).toHaveLength(1);
    expect(content.exitDecisions[0]?.outcome).toBe("extend");
    expect(content.exitDecisions[0]?.approvalId).toMatch(/^AUD-/);
    expect(content.baseline.every((entry) => entry.baseline.status === "measured")).toBe(true);
    expect(content.readiness.controls).toHaveLength(8);
    expect(content.knownLimitations.length).toBeGreaterThan(0);

    /* The Platform Product Owner reads, and cannot act or open setup. */
    await actAs(page, "platform-product-owner");
    await open(page, "/product/pilot/exit");
    await expect(page.getByTestId("exit-review")).toBeDisabled();
    await open(page, "/product/pilot/setup");
    await expect(page.getByTestId("pilot-restricted")).toBeVisible();

    /* Another persona cannot open the pilot. */
    await actAs(page, "ai-quality-owner");
    await open(page, "/product/pilot");
    await expect(page.getByTestId("pilot-restricted")).toBeVisible();

    /* Value: control measures computed, commercial measures unmeasured. */
    await open(page, "/product/value");
    await expect(page.getByTestId("value-material-approved")).toHaveAttribute("data-status", "verified");
    await expect(page.getByTestId("value-payload-bound")).toHaveAttribute("data-status", "verified");
    for (const id of ["two-role-pilot-conversion", "role-app-expansion-interest", "implementation-effort", "platform-reuse", "managed-service-adoption", "willingness-to-baseline"]) {
      await expect(page.getByTestId(`value-${id}`)).toHaveAttribute("data-state", "not-measured");
    }
    await shot(page, "value");
  });

  test("layout at every viewport, and German", async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    await actAs(page, "pilot-lead");
    for (const path of ["/product/pilot", "/product/pilot/setup", "/product/pilot/baseline", "/product/pilot/weekly", "/product/pilot/exit", "/product/value"]) {
      await open(page, path);
      await noHorizontalOverflow(page, `${path} at ${testInfo.project.name}`);
    }
    await open(page, "/product/pilot/weekly");
    await shot(page, "weekly");
    if (testInfo.project.name === "desktop-1366") {
      await open(page, "/product/pilot");
      await shot(page, "overview", page.getByTestId("pilot-readiness"));
      setLanguage("de");
      try {
        await open(page, "/product/pilot/baseline");
        await expect(page.getByTestId("pilot-workspace")).toContainText("Ausgangslage");
        await noHorizontalOverflow(page, "baseline in German");
        await shot(page, "baseline-de");
        await open(page, "/product/pilot");
        await noHorizontalOverflow(page, "overview in German");
        await shot(page, "overview-de", page.getByTestId("pilot-readiness"));
      } finally {
        setLanguage("en");
      }
    }
  });
});
