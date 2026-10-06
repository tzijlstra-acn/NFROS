/**
 * The meeting lifecycle (plan section 4.6): one complete journey per role.
 *
 *   Operational Risk, the RCSA challenge workshop: prepare before it, capture
 *   a statement during it, draft, edit and confirm the minutes after it, and
 *   follow the action the minutes raised back to its meeting.
 *   Third-Party Risk, the supplier challenge call: the conversation, the
 *   draft and the confirmation; then the Veridian triage minutes, whose
 *   confirmation updates the open evidence review stage.
 *   Search finds the confirmed minutes. German renders. Nothing overflows at
 *   1920x1080, 1440x900 or 1366x768.
 *
 * The journeys write and move the scenario clock, so they run only against an
 * isolated stack: `NFR_BASE_URL` at its server and `NFR_DB_PATH` at its
 * database, never the shared server on port 3000 or the repository's own
 * database. They reseed that database first, so every run starts from the
 * seeded day. The write journeys run in the 1920 project; the 1440 and 1366
 * projects check the layout of the record they left.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve, sep } from "node:path";
import Database from "better-sqlite3";
import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

const UI = "ui=v3.3";
const SHOTS = "docs/screenshots/os-excellence/os-meetings";

function base(): string {
  return process.env.NFR_BASE_URL ?? "http://localhost:3000";
}

/** The isolated database, or null when none is named or it is inside the repository. */
function isolatedDb(): string | null {
  const path = process.env.NFR_DB_PATH;
  if (!path) return null;
  const full = resolve(path);
  return full.startsWith(resolve(process.cwd()) + sep) ? null : full;
}

function requireIsolatedStack(): void {
  test.skip(
    !process.env.NFR_BASE_URL || base().includes(":3000") || isolatedDb() === null,
    "The meeting journeys write and move the scenario clock. Point NFR_BASE_URL and NFR_DB_PATH at an isolated stack.",
  );
}

function writesHere(testInfo: TestInfo): void {
  test.skip(testInfo.project.name !== "desktop-1920", "The write journeys run once, in the 1920 project.");
}

/** Moves the isolated scenario clock and language, as the presenter clock would. */
function setScenario(moment: string, language: "en" | "de" = "en"): void {
  const path = isolatedDb();
  if (!path) throw new Error("No isolated database.");
  const db = new Database(path, { fileMustExist: true });
  db.prepare("update scenario_runs set current_moment = ?, language = ?").run(moment, language);
  db.close();
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

async function open(page: Page, path: string): Promise<Locator> {
  const response = await page.goto(`${path}${path.includes("?") ? "&" : "?"}${UI}`, { waitUntil: "domcontentloaded" });
  expect(response?.status() ?? 0, `${path} returned an error`).toBeLessThan(400);
  await expect(page.getByTestId("work-hub")).toBeVisible();
  return page.getByTestId("work-detail");
}

/**
 * Clicks a client control, retrying until its effect is on screen. A click
 * can land on the server rendered button before React has hydrated it.
 */
async function clickUntil(control: Locator, effect: Locator): Promise<void> {
  await expect(async () => {
    if (!(await effect.isVisible())) await control.click({ timeout: 5_000 });
    await expect(effect).toBeVisible({ timeout: 8_000 });
  }).toPass({ timeout: 45_000 });
}

async function phase(page: Page, id: "before" | "during" | "after"): Promise<Locator> {
  const pane = page.getByTestId(`${id}-pane`);
  await clickUntil(page.getByTestId(`phase-tab-${id}`), pane);
  return pane;
}

async function noHorizontalOverflow(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(() => {
    const doc = document.scrollingElement;
    const main = document.querySelector(".wd-main");
    const detail = document.querySelector('[data-testid="work-detail"]');
    const rect = detail?.getBoundingClientRect();
    return {
      document: doc ? doc.scrollWidth - doc.clientWidth : 0,
      main: main ? main.scrollWidth - main.clientWidth : 0,
      detail: detail ? detail.scrollWidth - detail.clientWidth : 0,
      detailRight: rect ? rect.right - window.innerWidth : 0,
    };
  });
  expect(overflow.document, `${label}: document overflows horizontally`).toBeLessThanOrEqual(0);
  expect(overflow.main, `${label}: main region overflows horizontally`).toBeLessThanOrEqual(0);
  expect(overflow.detail, `${label}: detail pane overflows horizontally`).toBeLessThanOrEqual(0);
  expect(overflow.detailRight, `${label}: detail pane is clipped on the right`).toBeLessThanOrEqual(0);
}

async function shot(page: Page, name: string, testInfo: TestInfo, focus?: Locator): Promise<void> {
  if (focus) await focus.scrollIntoViewIfNeeded();
  mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width ?? 0}x${size?.height ?? 0}.png` });
  void testInfo;
}

test.describe.configure({ mode: "serial" });

test.describe("Operational Risk: the RCSA challenge workshop", () => {
  /* Reseeded once, by the project that writes, so the others see the record it left. */
  test.beforeAll(async ({ browserName }, workerInfo) => {
    void browserName;
    test.setTimeout(300_000);
    if (workerInfo.project.name === "desktop-1920" && process.env.NFR_BASE_URL && isolatedDb() && !base().includes(":3000")) reseed();
  });

  test("prepares, captures, drafts, edits and confirms, and the minutes become evidence and actions", async ({ page }, testInfo) => {
    requireIsolatedStack();
    writesHere(testInfo);
    test.setTimeout(240_000);
    const path = "/workday/rcsa/work?view=meetings&item=MTG-2026-0005";

    /* Before: purpose, stage, questions with their documents, all prepared in safe mode. */
    setScenario("07:45");
    let detail = await open(page, path);
    await expect(page.getByTestId("meeting-lifecycle")).toHaveAttribute("data-phase", "before");
    const before = page.getByTestId("before-pane");
    await expect(before.getByTestId("preparation-mode")).toContainText("Safe");
    await expect(before.getByTestId("meeting-questions").locator("li")).toHaveCount(7);
    await expect(before.getByTestId("meeting-stage")).toContainText("Not open yet");
    await expect(before.getByTestId("meeting-contradictions").locator("li").first()).toBeVisible();
    await noHorizontalOverflow(page, "before");
    await shot(page, "after-en-rcsa-before", testInfo, page.getByTestId("meeting-lifecycle"));
    await shot(page, "after-en-rcsa-before-questions", testInfo, before.getByTestId("meeting-questions"));

    /* During: the conversation as spoken by 11:45, a flagged statement, a capture. */
    setScenario("11:45");
    detail = await open(page, path);
    await expect(page.getByTestId("meeting-lifecycle")).toHaveAttribute("data-phase", "during");
    const during = page.getByTestId("during-pane");
    await expect(during.getByTestId("transcript-turn")).toHaveCount(22);
    await expect(during.getByTestId("transcript-pending")).toBeVisible();
    await expect(during.getByTestId("turn-flag").first()).toBeVisible();
    const turn = during.locator('[data-turn-id="MTM-2026-0005-06"]');
    await clickUntil(turn.locator('button[data-capture="fact"]'), turn.getByTestId("capture-form"));
    await turn.getByTestId("capture-submit").click();
    await expect(turn.getByTestId("turn-captured")).toBeVisible({ timeout: 30_000 });
    await shot(page, "after-en-rcsa-during-capture", testInfo, turn);
    const flagged = during.locator('[data-flagged="true"]').first();
    await shot(page, "after-en-rcsa-during-flag", testInfo, flagged);

    /* After: draft in safe mode, keeping the capture; edit; confirm. */
    setScenario("13:30");
    detail = await open(page, path);
    await expect(page.getByTestId("meeting-lifecycle")).toHaveAttribute("data-phase", "after");
    const after = page.getByTestId("after-pane");
    /* The capture already opened a draft; drafting adds the AI Partner's part to it. */
    await expect(after.getByTestId("minutes-prepared-note")).toContainText("Written by");
    await clickUntil(after.getByTestId("prepare-minutes"), after.getByTestId("minutes-prepared-note").filter({ hasText: "Drafted by the AI Partner" }));
    await expect(after.getByTestId("minutes-facts")).toContainText("Captured by you");
    await expect(after.getByTestId("minutes-decisions")).toContainText("DEC-2026-0772");
    await expect(after.getByTestId("minutes-prepared-note")).toContainText("Safe");
    await shot(page, "after-en-rcsa-after-draft", testInfo, after.getByTestId("minutes-body"));

    await clickUntil(after.getByTestId("minutes-edit"), after.getByTestId("minutes-editor"));
    const summary = after.getByTestId("minutes-editor").locator('textarea[name="summary"]');
    await summary.fill(`${await summary.inputValue()} Minutes checked by the facilitator.`);
    await after.getByTestId("minutes-save").click();
    await expect(after.getByTestId("minutes-prepared-note")).toContainText("version 3", { timeout: 30_000 });

    const form = after.getByTestId("confirm-form");
    await expect(after.getByTestId("minutes-ready")).toBeVisible();
    await expect(form.getByTestId("confirm-will-change")).toContainText("EVD-MIN-2026-0005");
    await expect(form.getByTestId("confirm-submit")).toBeDisabled();
    await form.locator('input[name="confirmDecisions"]').check();
    await form.locator('input[name="confirmActions"]').check();
    await form.locator('input[name="confirmDistribution"]').check();
    await form.locator('textarea[name="reason"]').fill("These minutes are my record of the workshop, checked against the conversation.");
    await form.locator('input[name="confirmed"]').check();
    await shot(page, "after-en-rcsa-confirm", testInfo, form);
    await form.getByTestId("confirm-submit").click();

    const record = after.getByTestId("minutes-record");
    await expect(record).toBeVisible({ timeout: 45_000 });
    await expect(record.getByTestId("minutes-evidence-doc")).toContainText("EVD-MIN-2026-0005");
    await expect(record.getByTestId("minutes-distribution")).toContainText("simulated message");
    await expect(record.getByTestId("minutes-raised").locator("a")).toHaveCount(2);
    await noHorizontalOverflow(page, "after, confirmed");
    await shot(page, "after-en-rcsa-confirmed", testInfo, record);

    /* The action the minutes raised keeps its meeting lineage. */
    await record.getByTestId("minutes-raised").locator("a").first().click();
    await expect(page).toHaveURL(/item=MSN-2026-0005-A01/);
    detail = page.getByTestId("work-detail");
    await expect(detail).toHaveAttribute("data-item-id", "MSN-2026-0005-A01");
    await expect(detail.locator('[data-related-kind="meeting"]')).toContainText("RSK-0211");
    await expect(detail.locator('[data-related-kind="process"]')).toBeVisible();
    await shot(page, "after-en-rcsa-raised-action", testInfo);

    /* Search finds the confirmed minutes, and the evidence they became. */
    const search = await page.request.get(`${base()}/api/workday/search?role=rcsa`);
    expect(search.status()).toBe(200);
    const payload = (await search.json()) as { entries: Array<{ kind: string; id: string; href: string }> };
    const minutes = payload.entries.find((entry) => entry.kind === "minutes" && entry.id === "MIN-2026-0005");
    expect(minutes).toBeDefined();
    expect(payload.entries.some((entry) => entry.kind === "evidence" && entry.id === "EVD-MIN-2026-0005")).toBe(true);
    /* And the search result opens the meeting with its minutes. */
    if (minutes) {
      await page.goto(`${minutes.href}${minutes.href.includes("?") ? "&" : "?"}${UI}`);
      await expect(page.getByTestId("work-detail")).toHaveAttribute("data-item-id", "MTG-2026-0005");
    }
  });
});

test.describe("Third-Party Risk: the supplier challenge call and the triage minutes", () => {
  test("captures nothing it should not, then drafts and confirms the supplier challenge minutes", async ({ page }, testInfo) => {
    requireIsolatedStack();
    writesHere(testInfo);
    test.setTimeout(240_000);
    setScenario("11:45");
    await open(page, "/workday/tprm/work?view=meetings&item=MTG-2026-0002");
    await expect(page.getByTestId("meeting-lifecycle")).toHaveAttribute("data-phase", "after");

    const before = await phase(page, "before");
    await expect(before.getByTestId("meeting-stage-none")).toBeVisible();
    await expect(before.getByTestId("preparation-mode")).toBeVisible();
    const during = await phase(page, "during");
    await expect(during.getByTestId("transcript-turn")).toHaveCount(27);
    await shot(page, "after-en-tprm-during", testInfo, during.getByTestId("turn-flag").first());

    const after = await phase(page, "after");
    await clickUntil(after.getByTestId("prepare-minutes"), after.getByTestId("minutes-body"));
    await expect(after.getByTestId("minutes-actions")).toContainText("Follow-up of MSN-2026-0188");
    await expect(after.getByTestId("minutes-actions")).toContainText("Novalink client service, M. Falk");
    await shot(page, "after-en-tprm-draft", testInfo, after.getByTestId("minutes-actions"));

    const form = after.getByTestId("confirm-form");
    await form.locator('input[name="confirmDecisions"]').check();
    await form.locator('input[name="confirmActions"]').check();
    await form.locator('input[name="confirmDistribution"]').check();
    await form.locator('textarea[name="reason"]').fill("My record of the challenge call. No item was accepted on a verbal assurance.");
    await form.locator('input[name="confirmed"]').check();
    await form.getByTestId("confirm-submit").click();
    const record = after.getByTestId("minutes-record");
    await expect(record).toBeVisible({ timeout: 45_000 });
    await expect(record.getByTestId("minutes-raised").locator("a")).toHaveCount(3);
    await expect(after.getByTestId("minutes-result")).not.toContainText("Process stage");
    await noHorizontalOverflow(page, "tprm confirmed");
    await shot(page, "after-en-tprm-confirmed", testInfo, record);
  });

  test("confirms the Veridian triage minutes, and the open evidence review stage is updated", async ({ page }, testInfo) => {
    requireIsolatedStack();
    writesHere(testInfo);
    test.setTimeout(180_000);
    setScenario("11:45");
    await open(page, "/workday/tprm/work?view=meetings&mview=archive&item=MINUTES-TPRM-EVIDENCE-TRIAGE-2026");
    await expect(page.getByTestId("work-detail")).toHaveAttribute("data-item-id", "MTG-TPRM-VERIDIAN-TRIAGE-2026");
    const before = await phase(page, "before");
    await expect(before.getByTestId("meeting-stage")).toContainText("Evidence Review");
    await expect(before.getByTestId("meeting-stage")).toContainText("Open");
    const after = await phase(page, "after");
    await expect(after.getByTestId("minutes-panel")).toHaveAttribute("data-confirmed", "false");

    const form = after.getByTestId("confirm-form");
    await form.locator('input[name="confirmDecisions"]').check();
    await form.locator('input[name="confirmActions"]').check();
    await form.locator('input[name="confirmDistribution"]').check();
    await form.locator('textarea[name="reason"]').fill("The triage call minutes, as I took them on 01.10.2026.");
    await form.locator('input[name="confirmed"]').check();
    await form.getByTestId("confirm-submit").click();
    await expect(after.getByTestId("minutes-result")).toContainText("brought up to date through the process engine", { timeout: 45_000 });
    await expect(after.getByTestId("minutes-record")).toBeVisible();
    await shot(page, "after-en-tprm-triage-confirmed", testInfo, after.getByTestId("minutes-result"));
  });
});

test.describe("German and the layout of the record", () => {
  test("renders the lifecycle in German", async ({ page }, testInfo) => {
    requireIsolatedStack();
    writesHere(testInfo);
    setScenario("13:30", "de");
    try {
      await open(page, "/workday/rcsa/work?view=meetings&item=MTG-2026-0005");
      await expect(page.getByTestId("phase-tab-after")).toContainText("Danach");
      await expect(page.getByTestId("after-pane")).toContainText("Protokoll");
      await shot(page, "after-de-rcsa-after", testInfo, page.getByTestId("minutes-record"));
      await phase(page, "before");
      await expect(page.getByTestId("before-pane")).toContainText("Zweck");
      await shot(page, "after-de-rcsa-before", testInfo, page.getByTestId("meeting-lifecycle"));
      await open(page, "/workday/tprm/work?view=meetings&item=MTG-2026-0002");
      await phase(page, "during");
      await shot(page, "after-de-tprm-during", testInfo, page.getByTestId("during-pane"));
      const text = await page.locator("body").innerText();
      expect(/[äöüÄÖÜß]/.test(text), "no umlaut renders").toBe(false);
    } finally {
      setScenario("13:30", "en");
    }
  });

  test("keeps every phase inside the viewport", async ({ page }, testInfo) => {
    requireIsolatedStack();
    setScenario("13:30");
    for (const path of ["/workday/rcsa/work?view=meetings&item=MTG-2026-0005", "/workday/tprm/work?view=meetings&item=MTG-2026-0002"]) {
      await open(page, path);
      for (const id of ["before", "during", "after"] as const) {
        await phase(page, id);
        await noHorizontalOverflow(page, `${path} ${id}`);
      }
    }
    if (testInfo.project.name === "desktop-1366") {
      await open(page, "/workday/rcsa/work?view=meetings&item=MTG-2026-0005");
      await shot(page, "after-en-rcsa-after", testInfo, page.getByTestId("minutes-record"));
      await phase(page, "during");
      await shot(page, "after-en-rcsa-during", testInfo, page.getByTestId("during-pane"));
      await open(page, "/workday/tprm/work?view=meetings&item=MTG-2026-0002");
      await phase(page, "before");
      await shot(page, "after-en-tprm-before", testInfo, page.getByTestId("meeting-lifecycle"));
    }
  });
});
