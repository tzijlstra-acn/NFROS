/**
 * The unified inbox (plan section 4.8): one journey per role.
 *
 *   Third-Party Risk: dismiss the message the AI proposes as noise, change a
 *   classification with a reason, raise an action from a message and follow
 *   the lineage both ways, see Home update, file a message as evidence, add
 *   one to the running onboarding's open stage and find it on the stage,
 *   delegate one, draft and send a simulated reply, and find the handled
 *   messages through search.
 *   Operational Risk: file a message as information, raise an action, link a
 *   message as evidence and add one to the RCSA cycle's open stage.
 *   German renders; nothing overflows at 1920x1080, 1440x900 or 1366x768.
 *
 * The journeys write, so they run only against an isolated stack:
 * `NFR_BASE_URL` at its server and `NFR_DB_PATH` at its database, never the
 * shared server on port 3000 or the repository's own database. They reseed
 * that database first, so every run starts from the seeded day. The write
 * journeys run in the 1920 project; every project checks the layout.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve, sep } from "node:path";
import Database from "better-sqlite3";
import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

const UI = "ui=v3.3";
const SHOTS = process.env.NFR_SHOTS_DIR ?? "docs/screenshots/os-excellence/os-inbox";

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
    "The inbox journeys write. Point NFR_BASE_URL and NFR_DB_PATH at an isolated stack.",
  );
}

function writesHere(testInfo: TestInfo): void {
  test.skip(testInfo.project.name !== "desktop-1920", "The write journeys run once, in the 1920 project.");
}

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

function query<T>(sql: string, ...args: unknown[]): T | undefined {
  const path = isolatedDb();
  if (!path) throw new Error("No isolated database.");
  const db = new Database(path, { fileMustExist: true, readonly: true });
  const row = db.prepare(sql).get(...args) as T | undefined;
  db.close();
  return row;
}

async function open(page: Page, path: string): Promise<Locator> {
  const response = await page.goto(`${path}${path.includes("?") ? "&" : "?"}${UI}`, { waitUntil: "domcontentloaded" });
  expect(response?.status() ?? 0, `${path} returned an error`).toBeLessThan(400);
  await expect(page.getByTestId("work-hub")).toBeVisible();
  return page.getByTestId("work-detail");
}

async function openMessage(page: Page, role: string, messageId: string, view = "all"): Promise<Locator> {
  const detail = await open(page, `/workday/${role}/work?view=inbox&iview=${view}&item=${messageId}`);
  await expect(detail).toHaveAttribute("data-item-id", messageId);
  return detail;
}

/** Clicks a client control, retrying until its effect is on screen (a click can land before hydration). */
async function clickUntil(control: Locator, effect: Locator): Promise<void> {
  await expect(async () => {
    if (!(await effect.isVisible())) await control.click({ timeout: 5_000 });
    await expect(effect).toBeVisible({ timeout: 8_000 });
  }).toPass({ timeout: 45_000 });
}

async function openOperation(detail: Locator, operation: string): Promise<Locator> {
  const form = detail.getByTestId(`inbox-form-${operation === "draft-reply" ? "send-reply" : operation}`);
  await clickUntil(detail.locator(`[data-operation="${operation}"]`).first(), form);
  return form;
}

async function submitOk(detail: Locator, form: Locator): Promise<void> {
  await form.getByTestId("operation-submit").click();
  const result = detail.getByTestId("operation-result");
  await expect(result).toBeVisible({ timeout: 30_000 });
  await expect(result, (await result.textContent()) ?? "").toHaveAttribute("data-ok", "true");
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
  expect(overflow.detailRight, `${label}: detail pane is clipped on the right`).toBeLessThanOrEqual(1);
}

async function shot(page: Page, name: string, testInfo: TestInfo): Promise<void> {
  mkdirSync(SHOTS, { recursive: true });
  const size = testInfo.project.use.viewport;
  await page.screenshot({ path: `${SHOTS}/${name}-${size?.width ?? 0}x${size?.height ?? 0}.png` });
}

/* ==========================================================================
   Third-Party Risk
   ========================================================================== */

test.describe("Third-Party Risk inbox", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(({}, testInfo) => {
    if (!process.env.NFR_BASE_URL || base().includes(":3000") || isolatedDb() === null) return;
    if (testInfo.project.name !== "desktop-1920") return;
    reseed();
    setScenario("07:45", "en");
  });

  test.beforeEach(({}, testInfo) => {
    requireIsolatedStack();
    writesHere(testInfo);
  });

  test("shows the six facts, the classification with its rationale, and one primary action", async ({ page }, testInfo) => {
    const detail = await openMessage(page, "tprm", "IMSG-2026-0003", "needs-triage");
    const classification = detail.getByTestId("classification");
    await expect(classification).toHaveAttribute("data-classification", "evidence");
    await expect(classification.getByTestId("classification-rationale")).toContainText("hard cut-off");
    await expect(classification).toContainText("Safe");
    await expect(detail.getByTestId("primary-action").locator('[data-operation="link-evidence"]')).toBeVisible();
    for (const fact of ["Source", "From", "Received", "Respond by", "Linked object"]) {
      await expect(detail.locator(".wd-work-facts dt", { hasText: fact })).toHaveCount(1);
    }
    await expect(detail.locator(".wd-work-facts")).toContainText("Mail, Simulated");
    /* The supplier's own message is labelled as a submission, with its transport beside it. */
    await openMessage(page, "tprm", "IMSG-2026-0006", "needs-triage");
    await expect(page.getByTestId("work-detail").locator(".wd-work-facts")).toContainText("Supplier submission, by Mail, Simulated");
    await shot(page, "after-en-tprm-needs-me", testInfo);
    await noHorizontalOverflow(page, "tprm needs me");
  });

  test("dismisses proposed noise and changes a classification with a reason", async ({ page }) => {
    let detail = await openMessage(page, "tprm", "IMSG-2026-0008", "needs-triage");
    await expect(page.getByTestId("work-queue").locator("section", { hasText: "Proposed as noise" }).locator('[data-item-id="IMSG-2026-0008"]')).toBeVisible();
    await submitOk(detail, await openOperation(detail, "dismiss"));
    await open(page, "/workday/tprm/work?view=inbox&iview=handled");
    await expect(page.getByTestId("work-queue").locator('[data-item-id="IMSG-2026-0008"]')).toContainText("Dismissed");

    detail = await openMessage(page, "tprm", "IMSG-2026-0002", "needs-triage");
    const form = await openOperation(detail, "change-triage");
    await form.locator('select[name="classification"]').selectOption("information");
    await expect(form.getByTestId("operation-submit")).toBeDisabled();
    await form.locator('textarea[name="reason"]').fill("The explanation is already in the indicator pack; nothing new to do today.");
    await submitOk(detail, form);
    await expect(detail.getByTestId("person-triage")).toContainText("Information");
    await expect(detail.getByTestId("person-triage")).toContainText("Changed from Action");
    /* The AI's proposal and its rationale stay on record beside the person's classification. */
    await expect(detail.getByTestId("classification")).toHaveAttribute("data-classification", "action");
    expect(query<{ t: string }>("select confirmed_triage as t from inbox_messages where id = 'IMSG-2026-0002'")?.t).toBe("information");
  });

  test("raises an action from a message, with lineage both ways, and Home updates", async ({ page }, testInfo) => {
    await page.goto(`/workday/tprm?${UI}`, { waitUntil: "domcontentloaded" });
    const homeInbox = page.locator('[data-home-cell="inbox"]');
    await expect(homeInbox).toBeVisible();
    const before = (await homeInbox.textContent()) ?? "";

    const detail = await openMessage(page, "tprm", "IMSG-2026-0001", "needs-triage");
    await expect(detail.getByTestId("primary-action").locator('[data-operation="create-action"]')).toBeVisible();
    const form = await openOperation(detail, "create-action");
    await expect(form.getByTestId("authority-statement")).toContainText("Material");
    await form.locator('select[name="kind"]').selectOption("reassessment");
    await form.locator('input[name="dueOn"]').fill("2026-10-20");
    await form.locator('textarea[name="reason"]').fill("Four open resilience items on a sole provider need one owned plan before cycle close.");
    await expect(form.getByTestId("operation-submit")).toBeDisabled();
    await form.locator('input[name="confirmed"]').check();
    await submitOk(detail, form);

    const lineage = detail.getByTestId("inbox-lineage");
    const action = lineage.locator('[data-conversion="action"]');
    await expect(action).toBeVisible();
    const actionId = (await action.getAttribute("data-target-id")) ?? "";
    expect(actionId).toMatch(/^MSN-/);
    const row = query<{ source: string; kind: string; owner: string }>("select source_message_id as source, kind, owner_user_id as owner from actions where id = ?", actionId);
    expect(row).toStrictEqual({ source: "IMSG-2026-0001", kind: "reassessment", owner: "P-002" });
    await shot(page, "after-en-tprm-converted-to-action", testInfo);

    await open(page, "/workday/tprm/work?view=inbox&iview=converted");
    await expect(page.getByTestId("work-queue").locator('[data-item-id="IMSG-2026-0001"]')).toContainText(`Action ${actionId}`);
    await open(page, "/workday/tprm/work?view=inbox");
    await expect(page.getByTestId("work-queue").locator('[data-item-id="IMSG-2026-0001"]')).toHaveCount(0);

    /* The other direction: the action names the message it came from. */
    const actionDetail = await open(page, `/workday/tprm/work?view=actions&item=${actionId}`);
    await expect(actionDetail).toHaveAttribute("data-item-kind", "action");
    const source = actionDetail.locator('a[href*="item=IMSG-2026-0001"]').first();
    await expect(source).toBeVisible();
    await expect(actionDetail.getByTestId("work-history")).toContainText("Raised from inbox message IMSG-2026-0001");
    await shot(page, "after-en-tprm-action-source-message", testInfo);

    await page.goto(`/workday/tprm?${UI}`, { waitUntil: "domcontentloaded" });
    await expect(homeInbox).not.toHaveText(before);
  });

  test("files a message as evidence, with the message as its source", async ({ page }, testInfo) => {
    const detail = await openMessage(page, "tprm", "IMSG-2026-0003", "needs-triage");
    const form = await openOperation(detail, "link-evidence");
    await submitOk(detail, form);
    await expect(detail.getByTestId("inbox-lineage").locator('[data-conversion="evidence"]')).toHaveAttribute("data-target-id", "EVD-IMSG-2026-0003");
    await expect(detail.locator(".wd-work-list li", { hasText: "EVD-IMSG-2026-0003" }).first()).toBeVisible();
    const doc = query<{ source: string; related: string }>("select source_message_id as source, related_object_ids as related from evidence_documents where id = 'EVD-IMSG-2026-0003'");
    expect(doc?.source).toBe("IMSG-2026-0003");
    expect(JSON.parse(doc?.related ?? "[]")).toContain("REG-2026-0031");
    await shot(page, "after-en-tprm-linked-as-evidence", testInfo);
  });

  test("adds a message to the onboarding's open stage, and the stage shows it", async ({ page }, testInfo) => {
    const detail = await openMessage(page, "tprm", "IMSG-2026-0006", "needs-triage");
    const form = await openOperation(detail, "add-to-process");
    await form.locator('select[name="stage"]').selectOption("RUN-TPRM-VERIDIAN-2026::evidence-review");
    await expect(form.getByTestId("process-scope-warning")).toBeVisible();
    await submitOk(detail, form);
    await expect(detail.getByTestId("operation-result")).toContainText("brought up to date through the process engine");
    const conversion = detail.getByTestId("inbox-lineage").locator('[data-conversion="process"]');
    await expect(conversion).toBeVisible();
    await shot(page, "after-en-tprm-added-to-process", testInfo);

    const href = (await conversion.locator("a").first().getAttribute("href")) ?? "";
    expect(href).toContain("stage=evidence-review");
    await page.goto(`${href}&${UI}`, { waitUntil: "domcontentloaded" });
    const events = page.getByTestId("stage-events");
    await expect(events).toBeVisible({ timeout: 60_000 });
    await events.locator("summary").click();
    await expect(events).toContainText("IMSG-2026-0006");
    await events.getByText("IMSG-2026-0006", { exact: false }).first().scrollIntoViewIfNeeded();
    await shot(page, "after-en-tprm-stage-shows-message", testInfo);

    /* The message is a stage input the stage reads itself, listed beside its sources (migration 0008). */
    const inputs = page.getByTestId("stage-inputs");
    await expect(inputs).toContainText("IMSG-2026-0006");
    await expect(inputs).toContainText("Inbox message");
    await inputs.scrollIntoViewIfNeeded();
    await shot(page, "after-en-tprm-stage-inputs", testInfo);
    expect(query<{ kind: string }>("select conversion_kind as kind from inbox_messages where id = 'IMSG-2026-0006'")?.kind).toBe("process");
  });

  test("delegates a message, drafts and sends a simulated reply, and handled messages stay searchable", async ({ page }) => {
    let detail = await openMessage(page, "tprm", "IMSG-2026-0011", "needs-triage");
    let form = await openOperation(detail, "delegate");
    await expect(form.locator('select[name="delegate"]')).toHaveValue("P-010");
    await form.locator('textarea[name="note"]').fill("Commercial indexation notice for the A2 schedule. Please take it in the Friday review.");
    await submitOk(detail, form);
    await expect(detail.getByTestId("inbox-lineage").locator('[data-conversion="delegated"]')).toContainText("Lukas Wiesinger");
    const sent = query<{ simulated: number; channel: string; kind: string }>(
      "select simulated_only as simulated, channel_name as channel, kind from collaboration_messages where related_object_id = 'IMSG-2026-0011'",
    );
    expect(sent).toStrictEqual({ simulated: 1, channel: "Inbox delegation", kind: "delegation" });

    detail = await openMessage(page, "tprm", "IMSG-2026-0003", "converted");
    await expect(detail.getByTestId("primary-action").locator('[data-operation="draft-reply"]')).toBeVisible();
    form = await openOperation(detail, "draft-reply");
    await expect(form.locator('textarea[name="body"]')).toHaveValue(/EVD-IMSG-2026-0003/);
    await expect(form.locator('input[name="subject"]')).toHaveValue(/^Re: /);
    await submitOk(detail, form);
    await expect(detail.getByTestId("inbox-lineage").locator('[data-conversion="reply"]')).toBeVisible();

    const search = await page.request.get(`${base()}/api/workday/search?role=tprm`);
    expect(search.status()).toBe(200);
    const payload = (await search.json()) as { entries: Array<{ kind: string; id: string; keywords: string; href: string }> };
    const messages = payload.entries.filter((entry) => entry.kind === "message");
    expect(messages.find((entry) => entry.id === "IMSG-2026-0008")?.href).toContain("iview=handled");
    expect(messages.find((entry) => entry.id === "IMSG-2026-0001")?.keywords).toMatch(/MSN-/);
    expect(messages.find((entry) => entry.id === "IMSG-2026-0003")?.keywords).toContain("EVD-IMSG-2026-0003");
  });
});

/* ==========================================================================
   Operational Risk
   ========================================================================== */

test.describe("Operational Risk inbox", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(({}, testInfo) => {
    requireIsolatedStack();
    writesHere(testInfo);
  });

  test("files information, raises an action, links evidence and adds a message to the RCSA cycle", async ({ page }, testInfo) => {
    setScenario("08:45", "en");

    /* Confirm triage: the information message is filed and leaves Needs me. */
    let detail = await openMessage(page, "rcsa", "IMSG-2026-0029", "needs-triage");
    await expect(detail.getByTestId("primary-action").locator('[data-operation="confirm-triage"]')).toBeVisible();
    await submitOk(detail, await openOperation(detail, "confirm-triage"));
    await expect(detail.getByTestId("inbox-lineage")).toHaveAttribute("data-place", "handled");

    /* Message to action. */
    detail = await openMessage(page, "rcsa", "IMSG-2026-0028", "needs-triage");
    let form = await openOperation(detail, "create-action");
    await form.locator('input[name="dueOn"]').fill("2026-10-15");
    await form.locator('textarea[name="reason"]').fill("The RCSA queue item needs one owned follow-up before the workshop.");
    await form.locator('input[name="confirmed"]').check();
    await submitOk(detail, form);
    const actionId = (await detail.getByTestId("inbox-lineage").locator('[data-conversion="action"]').getAttribute("data-target-id")) ?? "";
    expect(query<{ source: string }>("select source_message_id as source from actions where id = ?", actionId)?.source).toBe("IMSG-2026-0028");

    /* Message to evidence. */
    detail = await openMessage(page, "rcsa", "IMSG-2026-0026", "needs-triage");
    await submitOk(detail, await openOperation(detail, "link-evidence"));
    await expect(detail.getByTestId("inbox-lineage").locator('[data-conversion="evidence"]')).toHaveAttribute("data-target-id", "EVD-IMSG-2026-0026");

    /* Message to process: the decision message about a risk the cycle covers joins its open stage. */
    detail = await openMessage(page, "rcsa", "IMSG-2026-0023", "needs-triage");
    await expect(detail.getByTestId("primary-action").locator('[data-operation="add-to-process"]')).toBeVisible();
    form = await openOperation(detail, "add-to-process");
    await expect(form.getByTestId("process-scope-warning")).toHaveCount(0);
    await submitOk(detail, form);
    const conversion = detail.getByTestId("inbox-lineage").locator('[data-conversion="process"]');
    await expect(conversion).toBeVisible();
    await shot(page, "after-en-rcsa-added-to-process", testInfo);
    const href = (await conversion.locator("a").first().getAttribute("href")) ?? "";
    await page.goto(`${href}&${UI}`, { waitUntil: "domcontentloaded" });
    const events = page.getByTestId("stage-events");
    await expect(events).toBeVisible({ timeout: 60_000 });
    await events.locator("summary").click();
    await expect(events).toContainText("IMSG-2026-0023");
    await expect(page.getByTestId("stage-inputs")).toContainText("IMSG-2026-0023");
    await page.getByTestId("stage-inputs").scrollIntoViewIfNeeded();
    await shot(page, "after-en-rcsa-stage-inputs", testInfo);

    await open(page, "/workday/rcsa/work?view=inbox&iview=converted");
    const converted = page.getByTestId("work-queue");
    for (const id of ["IMSG-2026-0028", "IMSG-2026-0026", "IMSG-2026-0023"]) await expect(converted.locator(`[data-item-id="${id}"]`)).toBeVisible();
    await shot(page, "after-en-rcsa-converted-to-work", testInfo);
  });
});

/* ==========================================================================
   Layout, German
   ========================================================================== */

test.describe("inbox layout", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(() => {
    requireIsolatedStack();
  });

  test.afterAll(() => {
    if (isolatedDb() !== null && process.env.NFR_BASE_URL && !base().includes(":3000")) setScenario("07:45", "en");
  });

  for (const role of ["tprm", "rcsa"] as const) {
    test(`${role}: no overflow with a message and its forms open, in English and German`, async ({ page }, testInfo) => {
      const item = role === "tprm" ? "IMSG-2026-0010" : "IMSG-2026-0024";
      for (const language of ["en", "de"] as const) {
        setScenario("08:45", language);
        const detail = await openMessage(page, role, item);
        await noHorizontalOverflow(page, `${role} ${language} message`);
        await openOperation(detail, "create-action");
        await noHorizontalOverflow(page, `${role} ${language} create action form`);
        if (language === "de") {
          await expect(detail.getByTestId("inbox-operations")).toContainText("Naechster Schritt");
          await expect(detail.locator(".wd-work-facts")).toContainText("Simuliert");
        }
        await shot(page, `after-${language}-${role}-message-form`, testInfo);
        await open(page, `/workday/${role}/work?view=inbox&iview=all`);
        await noHorizontalOverflow(page, `${role} ${language} all`);
      }
      setScenario("07:45", "en");
    });
  }
});
