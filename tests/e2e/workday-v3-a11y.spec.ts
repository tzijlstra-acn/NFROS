/**
 * V3.1 accessibility.
 *
 * Two kinds of check, kept apart on purpose.
 *
 * The axe-core sweep catches what a rules engine can catch: contrast, names,
 * roles, landmarks. It is run with the same harness as
 * `workday-v2-visual.spec.ts`, including the practice of annotating every
 * finding at every impact and failing only on serious and critical. Suppressing
 * a moderate finding to get a clean run would make the suite a worse source of
 * truth than no suite at all, so nothing is suppressed, only graded.
 *
 * The behaviour checks catch what a rules engine cannot: whether the skip link
 * actually reaches the main region, whether a keyboard user can see where they
 * are, whether closing a panel puts focus back where it came from, whether
 * Escape works, and whether a count that is shown as a decorative dot is still
 * announced. Each of those is a thing a real keyboard or screen reader user
 * would notice and axe reports nothing about.
 *
 * Focus visibility is driven with real Tab presses rather than `element.focus()`.
 * Chromium only matches `:focus-visible` for a keyboard or an input, so a test
 * built on programmatic focus would report every button as having no focus ring
 * and would be wrong.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { ROLE_IDS } from "@/db/schema/core";

const V31 = "ui=v3.1";

/** The accessible name of the V3.1 rail, in either language. */
const RAIL_NAME = /^(Work areas|Arbeitsbereiche)$/;

const AXE_SOURCE = readFileSync(
  join(process.cwd(), "node_modules", "axe-core", "axe.min.js"),
  "utf8",
);

async function open(page: Page, path: string): Promise<void> {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  const status = response?.status() ?? 0;
  expect(status, `${path} returned HTTP ${status}`).toBeLessThan(400);
}

async function requireSeeded(page: Page): Promise<void> {
  const notSeeded = page.getByText("The scenario has not been seeded", { exact: false }).first();
  if (await notSeeded.isVisible({ timeout: 1_000 }).catch(() => false)) {
    test.skip(
      true,
      "The scenario database is not seeded. Run npm run db:migrate and npm run db:seed.",
    );
  }
}

async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
  );
}

/** Confirms this is the V3.1 interface before testing V3.1 behaviour. */
async function requireV31(page: Page, where: string): Promise<void> {
  await expect(
    page.locator("header.wd-header"),
    `${where} did not render the V3.1 interface, so its behaviour cannot be tested here`,
  ).toHaveCount(1);
}

/**
 * Opens a panel and waits for it, retrying the click.
 *
 * The retry is for hydration and nothing else. The trigger is server rendered
 * HTML before its handler exists, so a click landing in that window is lost.
 * The assertion that the panel is on screen afterwards is not relaxed.
 */
async function openPanel(
  trigger: ReturnType<Page["locator"]>,
  panel: ReturnType<Page["locator"]>,
  what: string,
): Promise<void> {
  await expect(async () => {
    await trigger.first().click({ timeout: 2_000 });
    await expect(panel).toBeVisible({ timeout: 1_500 });
  }, `${what} did not open`).toPass({ timeout: 20_000 });
}

interface AxeViolation {
  id: string;
  impact: string | null;
  help: string;
  nodes: number;
  targets: string[];
}

/** Runs axe-core against the current document and returns the violations. */
async function runAxe(page: Page): Promise<AxeViolation[]> {
  await page.addScriptTag({ content: AXE_SOURCE });
  return page.evaluate(async () => {
    const api = (
      window as unknown as {
        axe: {
          run: (
            context: Document,
            options: unknown,
          ) => Promise<{
            violations: Array<{
              id: string;
              impact: string | null;
              help: string;
              nodes: Array<{ target: unknown }>;
            }>;
          }>;
        };
      }
    ).axe;
    const result = await api.run(document, { resultTypes: ["violations"] });
    return result.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.length,
      targets: violation.nodes.slice(0, 4).map((node) => String(node.target)),
    }));
  });
}

/* ==========================================================================
   axe-core
   ========================================================================== */

test.describe("axe-core on the V3.1 surfaces", () => {
  const ROUTES = [
    ...ROLE_IDS.map((role) => `/workday/${role}?${V31}`),
    ...ROLE_IDS.map((role) => `/workday/${role}/decisions?${V31}`),
  ];

  for (const route of ROUTES) {
    test(`${route} has no serious or critical violation`, async ({ page }, testInfo) => {
      await open(page, route);
      await requireSeeded(page);
      await settle(page);

      /*
       * Which interface answered is recorded, because `middleware.ts`
       * downgrades a route with no V3.1 implementation to V2 and a reader of
       * this report should know which one the finding belongs to.
       */
      const v31 = (await page.locator("header.wd-header").count()) > 0;
      testInfo.annotations.push({
        type: "interface",
        description: `${route} rendered ${v31 ? "V3.1" : "V2"}`,
      });

      const violations = await runAxe(page);

      for (const violation of violations) {
        testInfo.annotations.push({
          type: `axe-${violation.impact ?? "unknown"}`,
          description: `${route} ${violation.id} x${violation.nodes}: ${violation.help} at ${violation.targets.join(" | ")}`,
        });
      }

      const blocking = violations.filter(
        (violation) => violation.impact === "critical" || violation.impact === "serious",
      );

      expect(
        blocking.map(
          (violation) =>
            `[${violation.impact}] ${violation.id} x${violation.nodes}: ${violation.help} at ${violation.targets[0] ?? "?"}`,
        ),
        `${route} has critical or serious accessibility violations`,
      ).toStrictEqual([]);
    });
  }
});

/* ==========================================================================
   The skip link
   ========================================================================== */

test("the skip link is reachable and reaches the main region", async ({ page }) => {
  await open(page, `/workday/rcsa?${V31}`);
  await requireSeeded(page);
  await requireV31(page, "the rcsa home");
  await settle(page);

  await page.keyboard.press("Tab");

  const skip = page.getByRole("link", { name: /Skip to main content/i });
  await expect(skip, "the first Tab does not reach a skip link").toBeFocused();
  await expect(skip, "the skip link does not become visible when it is focused").toBeVisible();

  /* It has to point at something, and that something has to be the main region. */
  const target = await skip.getAttribute("href");
  expect(target, "the skip link has no fragment target").toBe("#main");
  const main = page.locator("#main");
  await expect(main, "nothing in the document carries the skip link's target id").toHaveCount(1);
  await expect(main, "the skip link's target is not the main landmark").toHaveJSProperty(
    "tagName",
    "MAIN",
  );

  /*
   * Following it has to move the keyboard, not just the scroll. A main region
   * is not focusable, so the browser moves the sequential navigation start
   * point instead, and the proof is that the NEXT Tab lands inside the main
   * region rather than back in the header.
   */
  await skip.press("Enter");
  await page.keyboard.press("Tab");

  const insideMain = await page.evaluate(() => {
    const active = document.activeElement;
    const main = document.querySelector("#main");
    return Boolean(active && main && main.contains(active));
  });
  const landedOn = await page.evaluate(() => {
    const active = document.activeElement;
    if (!active) return "nothing";
    return `${active.tagName.toLowerCase()} ${(active.textContent ?? "").trim().slice(0, 40)}`;
  });

  expect(
    insideMain,
    `following the skip link did not move the keyboard into the main region. The next Tab landed on ${landedOn}`,
  ).toBe(true);
});

/* ==========================================================================
   Visible focus
   ========================================================================== */

test("every interactive element in the header and the rail shows visible focus", async ({
  page,
}) => {
  await open(page, `/workday/rcsa?${V31}`);
  await requireSeeded(page);
  await requireV31(page, "the rcsa home");
  await settle(page);

  /** Everything the chrome expects a keyboard to reach. */
  const expected = await page.evaluate(() => {
    const selector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const scopes = ["header.wd-header", "nav.wd-nav"];
    const names: string[] = [];
    for (const scope of scopes) {
      const root = document.querySelector(scope);
      if (!root) continue;
      for (const element of Array.from(root.querySelectorAll(selector))) {
        names.push(
          `${scope} ${element.getAttribute("aria-label") ?? (element.textContent ?? "").trim().slice(0, 30)}`,
        );
      }
    }
    return names;
  });

  expect(
    expected.length,
    "neither the header nor the rail exposed any focusable control, so the walk would be vacuous",
  ).toBeGreaterThan(4);

  const visited: string[] = [];
  const noIndicator: string[] = [];

  /*
   * Bounded at twice the number of controls plus a margin. The walk starts at
   * the document and stops once it has left the chrome, so the bound only
   * exists so a focus trap fails the test instead of hanging it.
   */
  const limit = expected.length * 2 + 8;
  for (let step = 0; step < limit; step += 1) {
    await page.keyboard.press("Tab");

    const state = await page.evaluate(() => {
      const active = document.activeElement;
      if (!active || active === document.body) return null;
      const scope = active.closest("header.wd-header")
        ? "header.wd-header"
        : active.closest("nav.wd-nav")
          ? "nav.wd-nav"
          : null;
      const style = getComputedStyle(active);
      const outline = Number.parseFloat(style.outlineWidth);
      const indicated =
        (outline > 0 && style.outlineStyle !== "none") ||
        (style.boxShadow !== "none" && style.boxShadow !== "");
      return {
        scope,
        name: `${scope ?? "elsewhere"} ${active.getAttribute("aria-label") ?? (active.textContent ?? "").trim().slice(0, 30)}`,
        indicated,
        matches: active.matches(":focus-visible"),
      };
    });

    if (!state) continue;
    if (state.scope === null) {
      /* Left the chrome. Stop once at least one control has been seen. */
      if (visited.length > 0) break;
      continue;
    }

    if (visited.includes(state.name)) break;
    visited.push(state.name);
    if (!state.indicated || !state.matches) noIndicator.push(state.name);
  }

  expect
    .soft(
      noIndicator,
      `these header and rail controls take keyboard focus without showing it: ${noIndicator.join(" | ")}`,
    )
    .toEqual([]);

  const missed = expected.filter((name) => !visited.includes(name));
  expect
    .soft(
      missed,
      `the keyboard walk never reached ${missed.length} of ${expected.length} header and rail controls: ${missed.join(" | ")}`,
    )
    .toEqual([]);
});

/* ==========================================================================
   Panels: focus return and Escape
   ========================================================================== */

test("closing the context drawer returns focus to the control that opened it", async ({ page }) => {
  await open(page, `/workday/rcsa?${V31}`);
  await requireSeeded(page);
  await requireV31(page, "the rcsa home");
  await settle(page);

  const trigger = page.getByRole("button", { name: /^(Evidence|Nachweise),/ }).first();
  if ((await trigger.count()) === 0) {
    test.skip(true, "The rcsa home offers no evidence trigger at the current moment.");
  }

  const drawer = page.locator("aside.wd-panel").filter({
    has: page.getByRole("tablist", { name: /^(Context areas|Kontextbereiche)$/ }),
  });
  await openPanel(trigger, drawer, "the context drawer");

  await drawer.getByRole("button", { name: /^(Close|Schliessen)$/ }).click();
  await expect(drawer, "the context drawer did not close").toBeHidden();

  await expect(
    trigger,
    "focus was not returned to the control that opened the context drawer, so a keyboard user is dropped at the top of the document",
  ).toBeFocused();
});

test("closing the AI partner dock returns focus to the control that opened it", async ({
  page,
}) => {
  await open(page, `/workday/rcsa?${V31}`);
  await requireSeeded(page);
  await requireV31(page, "the rcsa home");
  await settle(page);

  const trigger = page.getByRole("button", { name: /^(AI Partner|KI Partner),/ }).first();
  const dock = page.locator("aside.wd-panel-dock");
  await openPanel(trigger, dock, "the AI partner dock");

  await dock.getByRole("button", { name: /^(Close|Schliessen)$/ }).click();
  /*
   * Hidden, not removed. The dock keeps its conversation by staying mounted
   * and setting the `hidden` attribute, so what is asserted is that a reader
   * can no longer see it.
   */
  await expect(dock, "the AI partner dock did not close").toBeHidden();

  await expect(
    trigger,
    "focus was not returned to the AI partner trigger, so a keyboard user is dropped at the top of the document",
  ).toBeFocused();
});

test("Escape closes an open panel", async ({ page }) => {
  await open(page, `/workday/rcsa?${V31}`);
  await requireSeeded(page);
  await requireV31(page, "the rcsa home");
  await settle(page);

  /* The AI dock, which every role home offers from the header. */
  const dock = page.locator("aside.wd-panel-dock");
  await openPanel(page.getByRole("button", { name: /^(AI Partner|KI Partner),/ }), dock, "the AI partner dock");
  await page.keyboard.press("Escape");
  await expect(dock, "Escape did not close the AI partner dock").toBeHidden();

  /* And the context drawer, which is a different trigger and a different tab set. */
  const evidence = page.getByRole("button", { name: /^(Evidence|Nachweise),/ });
  if ((await evidence.count()) > 0) {
    const drawer = page.locator("aside.wd-panel").filter({
      has: page.getByRole("tablist", { name: /^(Context areas|Kontextbereiche)$/ }),
    });
    await openPanel(evidence, drawer, "the context drawer");
    await page.keyboard.press("Escape");
    await expect(drawer, "Escape did not close the context drawer").toBeHidden();
  }
});

/* ==========================================================================
   The decorative dot on a collapsed rail
   ========================================================================== */

test("a count shown as a dot on the collapsed rail is still in the accessible name", async ({
  page,
}) => {
  await open(page, `/workday/rcsa?${V31}`);
  await requireSeeded(page);
  await requireV31(page, "the rcsa home");
  await settle(page);

  const rail = page.getByRole("navigation", { name: RAIL_NAME });

  /* The counts that are readable while the rail is expanded, for comparison. */
  const expandedCounts = await rail.locator("a.wd-nav-item").evaluateAll((nodes) =>
    nodes
      .map((node) => ({
        name: node.getAttribute("aria-label") ?? (node.textContent ?? "").trim(),
        count: (node.querySelector(".wd-nav-count")?.textContent ?? "").trim(),
      }))
      .filter((entry) => entry.count.length > 0),
  );

  expect(
    expandedCounts.length,
    "no rail item carries a count at the current moment, so the dot cannot be exercised",
  ).toBeGreaterThan(0);

  await page.getByRole("button", { name: /^(Collapse|Einklappen)$/ }).click();

  /* The rail is collapsed when its labels are gone. */
  await expect(
    rail.locator(".wd-nav-label").first(),
    "the rail did not collapse, so the dot state was never reached",
  ).toBeHidden();

  const dotted = await rail.locator("a.wd-nav-item").evaluateAll((nodes) =>
    nodes
      .filter((node) => node.querySelector(".wd-nav-dot") !== null)
      .map((node) => ({
        name: node.getAttribute("aria-label") ?? "",
        text: (node.textContent ?? "").trim(),
        dotHidden: node.querySelector(".wd-nav-dot")?.getAttribute("aria-hidden") === "true",
      })),
  );

  expect(
    dotted.length,
    `the collapsed rail shows no count dots, although ${expandedCounts.length} items carried a visible count when expanded`,
  ).toBeGreaterThan(0);

  const unannounced = dotted.filter((entry) => !/\d/.test(entry.name));
  expect(
    unannounced.map((entry) => `${entry.name || entry.text || "unnamed"}`),
    "these collapsed rail items show a count as a dot but do not put the number in the accessible name, so a screen reader user never learns the count",
  ).toEqual([]);

  const exposedDots = dotted.filter((entry) => !entry.dotHidden);
  expect
    .soft(
      exposedDots.map((entry) => entry.name || "unnamed"),
      "these count dots are exposed to assistive technology as well as being in the name, so the count is announced twice",
    )
    .toEqual([]);
});
