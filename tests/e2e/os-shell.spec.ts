/**
 * The V3.3 shell: header truth, the release gate, search, the command palette,
 * Updates and contrast.
 *
 * Journeys for the os-shell workstream (plan 4.12, audit T06, T07, R08, J28,
 * U01). Every check is read only apart from local storage and one read mark on
 * an arrival, so the spec is safe on an isolated stack. It refuses to run the
 * read mark against port 3000, where a presenter's database lives.
 *
 * Run against an isolated server:
 *   NFR_BASE_URL=http://localhost:3108 npx playwright test tests/e2e/os-shell.spec.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const AXE_SOURCE = readFileSync(join(process.cwd(), "node_modules", "axe-core", "axe.min.js"), "utf8");
const BASE = process.env.NFR_BASE_URL ?? "http://localhost:3000";
const ISOLATED = !/localhost:3000\b/.test(BASE);

async function open(page: Page, path: string): Promise<void> {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response?.status() ?? 0, `${path} returned HTTP ${response?.status()}`).toBeLessThan(400);
}

async function requireSeeded(page: Page): Promise<void> {
  const notSeeded = page.getByText("The scenario has not been seeded", { exact: false }).first();
  if (await notSeeded.isVisible({ timeout: 1_000 }).catch(() => false)) {
    test.skip(true, "The scenario database is not seeded.");
  }
}

/** Clicks until the control has hydrated and its target is on screen. */
async function openWith(trigger: ReturnType<Page["locator"]>, target: ReturnType<Page["locator"]>, what: string) {
  await expect(async () => {
    await trigger.first().click({ timeout: 2_000 });
    await expect(target).toBeVisible({ timeout: 2_500 });
  }, `${what} did not open`).toPass({ timeout: 45_000 });
}

async function openPalette(page: Page) {
  const palette = page.getByTestId("command-palette");
  await openWith(page.getByTestId("header-search"), palette, "the command palette");
  await expect(palette.locator(".wd-cmd-scope")).toBeVisible({ timeout: 60_000 });
  return palette;
}

async function noSidewaysOverflow(page: Page, where: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${where} overflows sideways by ${overflow}px`).toBeLessThanOrEqual(0);
}

/* ==========================================================================
   Header truth
   ========================================================================== */

test.describe("header counts match their destinations", () => {
  for (const role of ["rcsa", "tprm"]) {
    test(`${role}: the Decisions badge is the queue's open count`, async ({ page }) => {
      await open(page, `/workday/${role}/decisions`);
      await requireSeeded(page);
      const context = await page.locator(".wd-context-line").first().innerText();
      const openCount = Number(/^(\d+)/.exec(context)?.[1] ?? "NaN");
      expect(Number.isNaN(openCount), `the queue's context line "${context}" states no count`).toBe(false);
      const rail = page.getByRole("navigation", { name: /^(Work areas|Arbeitsbereiche)$/ });
      const decisions = rail.locator('a[href$="/decisions"]');
      await expect(decisions).toHaveAttribute("aria-label", openCount > 0 ? new RegExp(`, ${openCount}$`) : /^(Decisions|Entscheidungen)$/);
    });

    test(`${role}: the Updates count is the number of updates the panel opens on`, async ({ page }) => {
      await open(page, `/workday/${role}`);
      await requireSeeded(page);
      const bell = page.getByTestId("header-updates");
      const count = Number(await bell.getAttribute("data-count"));
      const panel = page.getByTestId("updates-panel");
      await openWith(bell, panel, "the Updates panel");
      await expect(panel).toHaveAttribute("data-state", /present|empty/, { timeout: 30_000 });
      await expect(panel.locator('[data-testid="updates-raised"] > li')).toHaveCount(count);
      if (count > 0) {
        await expect(page.getByTestId("bar-updates")).toContainText(String(count));
      } else {
        await expect(page.getByTestId("bar-updates-none")).toBeVisible();
      }
    });
  }

  test("the AI Partner control states the number of suggestions that need the person", async ({ page }) => {
    await open(page, "/workday/rcsa");
    await requireSeeded(page);
    const ai = page.getByTestId("header-ai");
    const count = Number(await ai.getAttribute("data-count"));
    const label = (await ai.getAttribute("aria-label")) ?? "";
    if (count === 0) expect(label).toMatch(/Monitoring|Beobachtet|Offline/);
    else expect(label).toContain(String(count));
  });
});

/* ==========================================================================
   The release gate
   ========================================================================== */

test.describe("Planned and Demo roles are gated on every route", () => {
  for (const path of [
    "/workday/regulatory-change",
    "/workday/regulatory-change/decisions",
    "/workday/nfr-governance/processes",
    "/workday/nfr-governance/work?ui=v2",
  ]) {
    test(`a Planned role cannot be entered: ${path}`, async ({ page }) => {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/workday\?unavailable=(regulatory-change|nfr-governance)$/);
      await expect(page.getByTestId("role-refused-notice")).toContainText(/is Planned|ist geplant/);
      await expect(page.locator("header.wd-header")).toHaveCount(0);
    });
  }

  for (const path of [
    "/workday/control-assurance",
    "/workday/control-assurance/decisions",
    "/workday/incident-resilience/work",
    "/workday/incident-resilience/processes?ui=v2",
    "/workday/control-assurance/decisions?ui=v1",
  ]) {
    test(`a Demo role shows its release page and no work controls: ${path}`, async ({ page }) => {
      await open(page, path);
      await expect(page.getByTestId("role-release-gate")).toHaveAttribute("data-release-status", "demo");
      await expect(page.getByTestId("header-release-status")).toHaveText(/^Demo$/);
      await expect(page.getByTestId("header-search")).toHaveCount(0);
      await expect(page.getByTestId("header-updates")).toHaveCount(0);
      await expect(page.getByTestId("header-ai")).toHaveCount(0);
      await expect(page.locator(".wd-dq, [data-presentation-region='decision-queue'], [data-presentation-region='role-app-library']")).toHaveCount(0);
      await noSidewaysOverflow(page, path);
    });
  }
});

/* ==========================================================================
   Search
   ========================================================================== */

test.describe("global search", () => {
  test.beforeEach(async ({ page }) => {
    await open(page, "/workday/rcsa");
    await requireSeeded(page);
    await page.evaluate(() => {
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith("nfr-wd-search-")) window.localStorage.removeItem(key);
      }
    });
  });

  test("states its scope, groups results by object type and opens a result on its surface", async ({ page }) => {
    const palette = await openPalette(page);
    await expect(palette.getByTestId("command-palette-scope")).toContainText(/Arcadia Bank AG/);

    await page.keyboard.type("payment");
    const groups = palette.locator(".wd-cmd-group");
    await expect(groups.first()).toBeVisible();
    const labels = await groups.allInnerTexts();
    expect(labels.length).toBeGreaterThan(1);
    expect(new Set(labels.map((label) => label.split("\n")[0])).size, "a type appears in two groups").toBe(labels.length);

    await page.keyboard.press("Control+A");
    await page.keyboard.type("CTL-PAY-014");
    const first = palette.locator('[role="option"][data-kind="control"]').first();
    await expect(first).toBeVisible();
    await expect(first).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/workday\/rcsa\/(processes\/rcsa-cycle\?stage=|work\?view=actions&object=CTL-PAY-014)/);
    await expect(palette).toBeHidden();
  });

  test("never shows an object outside the legal entity", async ({ page }) => {
    const palette = await openPalette(page);
    // Alpenrand Rechenzentrum AG is contracted for the Swiss entity only.
    await page.keyboard.type("Alpenrand");
    await expect(palette.getByTestId("command-palette-empty")).toBeVisible();
  });

  test("moves with the keyboard and keeps focus in the dialog", async ({ page }) => {
    const palette = await openPalette(page);
    const input = palette.getByRole("combobox");
    await expect(input).toBeFocused();
    const options = palette.locator('[role="option"]');
    await expect(options.first()).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowDown");
    await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
    await expect(options.last()).toHaveAttribute("aria-selected", "true");
    await expect(input).toHaveAttribute("aria-activedescendant", (await options.last().getAttribute("id")) ?? "");
    for (let step = 0; step < 4; step += 1) {
      await page.keyboard.press("Tab");
      const inside = await page.evaluate(() => Boolean(document.activeElement?.closest('[data-testid="command-palette"]')));
      expect(inside, "Tab left the palette").toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(palette).toBeHidden();
    await expect(page.getByTestId("header-search")).toBeFocused();
  });

  test("remembers recent objects and pins, in this browser, and says so", async ({ page }) => {
    let palette = await openPalette(page);
    await expect(palette).toContainText(/kept in this browser only/);
    await page.keyboard.type("RSK-0211");
    await expect(palette.locator('[role="option"][data-kind="risk"]').first()).toHaveAttribute("aria-selected", "true");
    await palette.getByTestId("command-palette-pin").click();
    await expect(palette.getByTestId("command-palette-pin")).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("combobox").focus();
    await page.keyboard.press("Enter");
    await page.waitForLoadState("domcontentloaded");

    await page.reload({ waitUntil: "domcontentloaded" });
    palette = await openPalette(page);
    await expect(palette.locator('[data-section="pinned"] [role="option"]')).toHaveCount(1);
    await expect(palette.locator('[data-section="pinned"]')).toContainText("RSK-0211");
  });
});

/* ==========================================================================
   The command palette
   ========================================================================== */

test.describe("the command palette", () => {
  test.beforeEach(async ({ page }) => {
    await open(page, "/workday/tprm");
    await requireSeeded(page);
  });

  test("opens with Control K and lists the eight commands in the plan's order", async ({ page }) => {
    const palette = page.getByTestId("command-palette");
    await expect(async () => {
      await page.locator("main").click({ position: { x: 5, y: 5 } }).catch(() => undefined);
      await page.keyboard.press("Control+K");
      await expect(palette).toBeVisible({ timeout: 2_500 });
    }).toPass({ timeout: 45_000 });
    await expect(palette.locator('[data-section="commands"] [role="option"]')).toHaveCount(8, { timeout: 60_000 });
    const ids = await palette.locator('[data-section="commands"] [role="option"]').evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-command")),
    );
    expect(ids).toEqual([
      "open-current-work",
      "open-next-meeting",
      "find-supplier",
      "find-control",
      "open-current-process",
      "review-decisions",
      "ask-ai",
      "open-evidence",
    ]);
    await page.keyboard.press("Control+K");
    await expect(palette).toBeHidden();
  });

  test("Find supplier narrows the search to suppliers, and Escape widens it again", async ({ page }) => {
    const palette = await openPalette(page);
    await palette.locator('[data-command="find-supplier"]').click();
    await expect(palette.getByTestId("command-palette-kind")).toBeVisible();
    const kinds = await palette.locator('[role="option"]').evaluateAll((nodes) => [...new Set(nodes.map((node) => node.getAttribute("data-kind")))]);
    expect(kinds).toEqual(["supplier"]);
    await page.keyboard.type("Veridian");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/workday\/tprm\/processes\/third-party-onboarding\?stage=/);
  });

  test("Review decisions, Open current process and Open next meeting go to their surfaces", async ({ page }) => {
    for (const [command, url] of [
      ["review-decisions", /\/workday\/tprm\/decisions$/],
      ["open-current-process", /\/workday\/tprm\/processes\/third-party-onboarding\?stage=/],
      ["open-next-meeting", /\/workday\/tprm\/work\?view=(meetings|agenda)&item=/],
    ] as const) {
      const palette = await openPalette(page);
      const row = palette.locator(`[data-command="${command}"]`);
      if ((await row.getAttribute("aria-disabled")) === "true") {
        await expect(row).toContainText(/No|Kein|keine/);
        await page.keyboard.press("Escape");
        continue;
      }
      await row.click();
      await expect(page).toHaveURL(url);
    }
  });

  test("Ask AI opens the AI Partner through its own control", async ({ page }) => {
    const palette = await openPalette(page);
    await palette.locator('[data-command="ask-ai"]').click();
    await expect(palette).toBeHidden();
    await expect(page.locator("aside.wd-panel-dock")).toBeVisible();
    await expect(page.getByTestId("header-ai")).toHaveAttribute("aria-expanded", "true");
  });

  test("Open evidence searches the documents in scope when nothing is selected", async ({ page }) => {
    await page.evaluate(() => window.sessionStorage.removeItem("nfr.work.bound"));
    await page.reload({ waitUntil: "domcontentloaded" });
    const palette = await openPalette(page);
    await palette.locator('[data-command="open-evidence"]').click();
    await expect(palette.getByTestId("command-palette-kind")).toBeVisible();
    const kinds = await palette.locator('[role="option"]').evaluateAll((nodes) => [...new Set(nodes.map((node) => node.getAttribute("data-kind")))]);
    expect(kinds).toEqual(["evidence"]);
    await noSidewaysOverflow(page, "the palette narrowed to evidence");
  });
});

/* ==========================================================================
   Updates
   ========================================================================== */

test.describe("Updates", () => {
  test("lists only material updates, each opening on its surface, and closes with Escape", async ({ page }) => {
    await open(page, "/workday/rcsa");
    await requireSeeded(page);
    const bell = page.getByTestId("header-updates");
    const panel = page.getByTestId("updates-panel");
    await openWith(bell, panel, "the Updates panel");
    await expect(panel).toHaveAttribute("data-state", /present|empty/, { timeout: 30_000 });

    const categories = await panel.locator(".wd-update-row").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-category")));
    for (const category of categories) {
      expect([
        "execution-failed",
        "process-blocked",
        "human-input-required",
        "deadline-approaching",
        "material-change",
        "routine-created-work",
      ]).toContain(category);
    }
    const hrefs = await panel.locator(".wd-update-title").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href")));
    for (const href of hrefs) expect(href ?? "").toMatch(/^\/workday\/rcsa(\/|$|\?|#)/);
    await expect(panel).toContainText(/At most 5 updates are raised at once/);
    await noSidewaysOverflow(page, "the open Updates panel");

    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
  });

  test("an update opens the work it names", async ({ page }) => {
    await open(page, "/workday/rcsa");
    await requireSeeded(page);
    const panel = page.getByTestId("updates-panel");
    await openWith(page.getByTestId("header-updates"), panel, "the Updates panel");
    await expect(panel).toHaveAttribute("data-state", /present|empty/, { timeout: 30_000 });
    const link = panel.locator('.wd-update-row[data-category="human-input-required"] .wd-update-title').first();
    if ((await link.count()) === 0) test.skip(true, "Nothing needs input at the current moment.");
    const href = (await link.getAttribute("href")) ?? "";
    await link.click();
    await expect(panel).toBeHidden();
    await expect(page).toHaveURL(new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/#.*$/, "")));
  });

  test("an arrival can be marked read and the count follows", async ({ page }) => {
    test.skip(!ISOLATED, "Writes a read mark; run only against an isolated stack.");
    await open(page, "/workday/rcsa");
    await requireSeeded(page);
    const panel = page.getByTestId("updates-panel");
    await openWith(page.getByTestId("header-updates"), panel, "the Updates panel");
    await expect(panel).toHaveAttribute("data-state", /present|empty/, { timeout: 30_000 });
    const readable = panel.getByRole("button", { name: /^(Mark as read|Als gelesen markieren)$/ });
    if ((await readable.count()) === 0) test.skip(true, "No unread arrival is material at the current moment.");
    const row = readable.first().locator("xpath=ancestor::li[1]");
    const title = (await row.locator(".wd-update-title").innerText()).trim();
    await readable.first().click();
    /* The read arrival leaves the panel, and the bell is re-rendered from the same read. */
    await expect(panel.locator(".wd-update-title", { hasText: title })).toHaveCount(0, { timeout: 30_000 });
    const bell = page.getByTestId("header-updates");
    await expect(async () => {
      const count = Number(await bell.getAttribute("data-count"));
      expect(await panel.locator('[data-testid="updates-raised"] > li').count()).toBe(count);
    }).toPass({ timeout: 30_000 });
  });
});

/* ==========================================================================
   Contrast and accessibility
   ========================================================================== */

test.describe("axe on the four main pages for both roles", () => {
  for (const role of ["rcsa", "tprm"]) {
    for (const segment of ["", "/work", "/processes", "/decisions"]) {
      const path = `/workday/${role}${segment}`;
      test(`${path} has no serious or critical violation and no contrast failure`, async ({ page }) => {
        await open(page, path);
        await requireSeeded(page);
        await page.waitForLoadState("networkidle").catch(() => undefined);
        await page.evaluate(() => document.fonts.ready);
        await page.addScriptTag({ content: AXE_SOURCE });
        const violations = await page.evaluate(async () => {
          const api = (window as unknown as { axe: { run: (c: Document, o: unknown) => Promise<{ violations: Array<{ id: string; impact: string | null; nodes: Array<{ target: unknown }> }> }> } }).axe;
          const result = await api.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
          return result.violations.map((violation) => ({ id: violation.id, impact: violation.impact, targets: violation.nodes.slice(0, 3).map((node) => String(node.target)) }));
        });
        const blocking = violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
        expect(blocking.map((violation) => `${violation.impact} ${violation.id} at ${violation.targets.join(" | ")}`)).toEqual([]);
        expect(violations.filter((violation) => violation.id === "color-contrast")).toEqual([]);
      });
    }
  }

  test("the open palette and the open Updates panel pass axe", async ({ page }) => {
    await open(page, "/workday/tprm");
    await requireSeeded(page);
    await openPalette(page);
    await page.keyboard.type("supplier");
    await page.addScriptTag({ content: AXE_SOURCE });
    const run = () =>
      page.evaluate(async () => {
        const api = (window as unknown as { axe: { run: (c: Document, o: unknown) => Promise<{ violations: Array<{ id: string; impact: string | null }> }> } }).axe;
        const result = await api.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
        return result.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id);
      });
    expect(await run()).toEqual([]);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await openWith(page.getByTestId("header-updates"), page.getByTestId("updates-panel"), "the Updates panel");
    await expect(page.getByTestId("updates-panel")).toHaveAttribute("data-state", /present|empty/, { timeout: 30_000 });
    expect(await run()).toEqual([]);
  });
});
