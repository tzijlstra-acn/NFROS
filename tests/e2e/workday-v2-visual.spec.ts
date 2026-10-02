/**
 * The V2 structural and accessibility matrix.
 *
 * This is deliberately not a pixel comparison suite. A screenshot baseline
 * tells you that something changed, which is the least useful thing to know
 * about a redesign in progress, and it fails for font hinting differences on
 * a different machine. What the brief asks for instead are the properties the
 * redesign claims, each of which can be measured from the live document:
 *
 *   1. no heading above 24px computed font size anywhere in the workday
 *   2. Geist is the resolved family on the interactive routes
 *   3. nothing overflows the viewport horizontally
 *   4. the synthetic data disclosure is visible on every route at every size
 *   5. no control is clipped
 *   6. the centre work area is the largest region
 *   7. under reduced motion, readiness is still stated in words
 *
 * The three viewports come from the project matrix in `playwright.config.ts`,
 * so each test in this file runs three times and the project name in a failure
 * names the size. That is why no test here sets a viewport itself: doing so
 * would silently collapse the matrix to one size.
 *
 * The measurements are taken after `document.fonts.ready` and one animation
 * frame. Measuring before the webfont resolves reports the fallback metrics,
 * which is how a type scale audit passes against a product that is not using
 * its own typeface.
 *
 * Accessibility is in this file rather than its own because it is a property
 * of the rendered surface, like the others. Violations are asserted at
 * critical and serious impact and annotated at moderate and minor. Nothing is
 * suppressed: the full list, by impact, is in `docs/handoffs/workday-v2-qa.md`.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { ROLE_IDS } from "@/db/schema/core";

/** Pixels of slack before a difference counts as overflow. */
const TOLERANCE = 2;

/**
 * The largest permitted computed font size inside the workday scope.
 *
 * `--app-text-3xl` is 24px and is reserved for a rare hero or empty state.
 * The token bridge collapses the presentation display sizes onto it, so a
 * reused component that asks for display type cannot produce a deck sized
 * heading on a working screen. This assertion is what proves the bridge is
 * doing that rather than being documented as doing it.
 */
const MAX_WORKDAY_FONT_PX = 24;

/** The eight interactive routes, for one role. */
const ROUTE_SEGMENTS = [
  "",
  "/collaboration",
  "/mail",
  "/calendar",
  "/decisions",
  "/workbench",
  "/meetings",
  "/assistant",
] as const;

const WORKDAY_ROUTES = ROUTE_SEGMENTS.map((segment) => `/workday/rcsa${segment}`);

/** Every role's landing, for the disclosure and overflow sweep. */
const ROLE_ROUTES = ROLE_IDS.map((roleId) => `/workday/${roleId}`);

/** The administrator area, which the accessibility sweep also covers. */
const SETTINGS_ROUTES = ["/settings", "/settings/integrations", "/settings/branding"];

const AXE_SOURCE = readFileSync(
  join(process.cwd(), "node_modules", "axe-core", "axe.min.js"),
  "utf8",
);

async function open(page: Page, path: string): Promise<void> {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  const status = response?.status() ?? 0;
  if (status === 404) test.skip(true, `${path} returned 404 in this build.`);
  expect(status, `${path} returned HTTP ${status}`).toBeLessThan(400);
}

async function requireSeeded(page: Page): Promise<void> {
  const notSeeded = page.getByText("The scenario has not been seeded", { exact: false }).first();
  if (await notSeeded.isVisible({ timeout: 1_000 }).catch(() => false)) {
    test.skip(true, "The scenario database is not seeded.");
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

/**
 * Waits for the client shell to finish adopting the viewport.
 *
 * The shell renders on the server with `narrow` false and the partner open,
 * then corrects both in an effect after mount. At 1366 those two defaults
 * disagree with the stylesheet and the dock is laid out outside the viewport
 * until the correction lands, which is defect 7.20 in the QA handoff and is asserted once, on
 * purpose, by the test named for it.
 *
 * Every other geometry test waits here first. Without that, one transient
 * state is reported as fourteen separate clipped control failures and the
 * settled geometry of the whole interface goes unmeasured, which is the worse
 * outcome: the noise hides the result.
 *
 * Bounded and non asserting. If the correction never comes, the dedicated test
 * is the one that says so.
 */
async function shellAdopted(page: Page): Promise<void> {
  await page
    .waitForFunction(
      () => {
        /*
         * The condition is which rendering is mounted, not where it sits.
         *
         * An earlier version of this waited for the partner's own bounding
         * box to be inside the viewport, which never waited at all: the
         * `aside` is laid out inside a 48px grid column and its own box is
         * therefore 48px wide and inside the viewport, while its 336px worth
         * of children overflow it. The box fits; the content does not.
         *
         * At the narrow width the client's effect swaps the slot to the
         * presence rail, so the rail existing is exactly the signal that the
         * adoption has happened. Above that width the full dock is the
         * correct rendering from the server onwards and there is nothing to
         * wait for.
         */
        const narrow = window.matchMedia("(max-width: 1366px)").matches;
        if (narrow) return document.querySelector(".app-partner-presence") !== null;
        return document.querySelector(".app-partner, .app-partner-presence") !== null;
      },
      undefined,
      { timeout: 10_000 },
    )
    .catch(() => {
      // Swallowed deliberately. The dedicated test reports it; here it would
      // only turn one defect into a failure on every surface.
    });
  await settle(page);
}

/* ==========================================================================
   1. Typography
   ========================================================================== */

test.describe("the type scale is capped inside the workday", () => {
  for (const route of WORKDAY_ROUTES) {
    test(`${route} renders no text above ${MAX_WORKDAY_FONT_PX}px`, async ({ page }, testInfo) => {
      await open(page, route);
      await requireSeeded(page);
      await settle(page);

      const offenders = await page.evaluate((limit) => {
        const describe = (element: Element): string => {
          const tag = element.tagName.toLowerCase();
          const className =
            typeof element.className === "string" && element.className.length > 0
              ? `.${element.className.trim().split(/\s+/).slice(0, 2).join(".")}`
              : "";
          return `${tag}${className}`;
        };

        const found: Array<{ selector: string; px: number; text: string }> = [];
        for (const element of Array.from(document.querySelectorAll(".workday-v2 *"))) {
          /*
           * Only elements that render text of their own. A wrapper reports
           * its children's text, so without this filter one large heading is
           * counted once for every ancestor it has.
           */
          const own = Array.from(element.childNodes)
            .filter((node) => node.nodeType === Node.TEXT_NODE)
            .map((node) => (node.textContent ?? "").trim())
            .join(" ")
            .trim();
          if (own.length === 0) continue;

          const style = window.getComputedStyle(element);
          if (style.display === "none" || style.visibility === "hidden") continue;
          if (Number(style.opacity) === 0) continue;
          if (element.closest(".app-sr-only") !== null) continue;
          if (element.closest(".sr-only") !== null) continue;

          const px = Number.parseFloat(style.fontSize);
          if (!Number.isFinite(px) || px <= limit) continue;
          found.push({ selector: describe(element), px, text: own.slice(0, 50) });
        }
        return found;
      }, MAX_WORKDAY_FONT_PX);

      testInfo.annotations.push({
        type: "type-scale",
        description: `${route}: ${offenders.length} elements above ${MAX_WORKDAY_FONT_PX}px`,
      });

      expect(
        offenders.map((item) => `${item.selector} at ${item.px}px: "${item.text}"`),
        `${route} renders deck sized type on a working screen`,
      ).toStrictEqual([]);
    });
  }

  test("Geist is the resolved family on an interactive route", async ({ page }) => {
    await open(page, "/workday/rcsa");
    await requireSeeded(page);
    await settle(page);

    const families = await page.evaluate(() => {
      const counts: Record<string, number> = {};
      for (const element of Array.from(document.querySelectorAll(".workday-v2 *"))) {
        const own = Array.from(element.childNodes)
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => (node.textContent ?? "").trim())
          .join("")
          .trim();
        if (own.length === 0) continue;
        const style = window.getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") continue;
        const first = style.fontFamily.split(",")[0]?.replace(/["']/g, "").trim() ?? "";
        if (first.length === 0) continue;
        counts[first] = (counts[first] ?? 0) + 1;
      }
      return counts;
    });

    const names = Object.keys(families);
    expect(names.length, "no rendered text reported a family").toBeGreaterThan(0);

    /*
     * Self hosted, so there is no network request to a font service and the
     * application renders with its intended typography in offline mode. A
     * fallback family resolving here means the woff2 files did not load,
     * which is invisible in a screenshot taken on a machine that happens to
     * have a similar face installed.
     */
    const foreign = names.filter((name) => !/^Geist( Sans| Mono)?$/.test(name));
    expect(
      foreign,
      `the workday resolved ${JSON.stringify(families)}, so a family other than Geist is in use`,
    ).toStrictEqual([]);

    // Both faces are in use: mono is reserved for time, identifiers and
    // measured values, and explanatory prose is never monospaced.
    expect(names, `families in use: ${names.join(", ")}`).toContain("Geist Sans");
    expect(names).toContain("Geist Mono");
  });
});

/* ==========================================================================
   2. Geometry
   ========================================================================== */

test.describe("the shell fits the stage", () => {
  for (const route of [...WORKDAY_ROUTES, ...ROLE_ROUTES.filter((r) => r !== "/workday/rcsa")]) {
    test(`${route} does not overflow horizontally and clips no control`, async ({
      page,
    }, testInfo) => {
      await open(page, route);
      await requireSeeded(page);
      await shellAdopted(page);

      const metrics = await page.evaluate(() => ({
        scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        innerWidth: window.innerWidth,
        scrollHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
        innerHeight: window.innerHeight,
      }));

      testInfo.annotations.push({
        type: "metrics",
        description: `${route}: ${metrics.scrollWidth}x${metrics.scrollHeight} in ${metrics.innerWidth}x${metrics.innerHeight}`,
      });

      /*
       * The shell is fixed to the viewport with `overflow: hidden`, so a
       * document that scrolls at all means something escaped the grid. The
       * V1 failure mode was exactly this and it was silent: the bar laid out
       * at roughly 2068px and carried controls off stage with no scrollbar to
       * reveal them.
       */
      expect(
        metrics.scrollWidth - metrics.innerWidth,
        `${route} is ${metrics.scrollWidth}px wide in a ${metrics.innerWidth}px viewport`,
      ).toBeLessThanOrEqual(TOLERANCE);
      expect(
        metrics.scrollHeight - metrics.innerHeight,
        `${route} is ${metrics.scrollHeight}px tall in a ${metrics.innerHeight}px viewport`,
      ).toBeLessThanOrEqual(TOLERANCE);

      const clipped = await page.evaluate((slack) => {
        const describe = (element: Element): string => {
          const name =
            element.getAttribute("aria-label") ?? (element.textContent ?? "").trim().slice(0, 40);
          const className =
            typeof element.className === "string"
              ? element.className.trim().split(/\s+/).slice(0, 2).join(".")
              : "";
          return `${element.tagName.toLowerCase()}.${className} ("${name}")`;
        };

        const problems: string[] = [];
        for (const element of Array.from(document.querySelectorAll(".workday-v2 button, .workday-v2 a[href]"))) {
          if (element.closest(".app-sr-only") !== null) continue;
          if ((element as HTMLButtonElement).disabled) continue;
          if (element.getClientRects().length === 0) continue;

          const rect = element.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) {
            problems.push(`${describe(element)} has a zero sized box`);
            continue;
          }

          /*
           * Clipped out of reach means the control sits outside the viewport
           * and no ancestor can scroll to it. A control further down a
           * scrolling list is not clipped, it is below, and reporting that
           * would flag every long list in the product.
           */
          const beyond =
            rect.right > window.innerWidth + slack ||
            rect.bottom > window.innerHeight + slack ||
            rect.left < -slack ||
            rect.top < -slack;
          if (!beyond) continue;

          let ancestor: Element | null = element.parentElement;
          let reachable = false;
          while (ancestor !== null) {
            const style = window.getComputedStyle(ancestor);
            if (
              /(auto|scroll)/.test(style.overflowY) ||
              /(auto|scroll)/.test(style.overflowX) ||
              /(auto|scroll)/.test(style.overflow)
            ) {
              reachable = true;
              break;
            }
            ancestor = ancestor.parentElement;
          }
          if (reachable) continue;

          problems.push(
            `${describe(element)} ends at ${Math.round(rect.right)}x${Math.round(rect.bottom)} and cannot be scrolled to`,
          );
        }
        return problems;
      }, TOLERANCE);

      expect(clipped, `${route} clips a control out of reach`).toStrictEqual([]);
    });
  }

  for (const route of WORKDAY_ROUTES) {
    test(`${route} keeps the centre work area the largest region`, async ({ page }, testInfo) => {
      await open(page, route);
      await requireSeeded(page);
      await shellAdopted(page);

      const regions = await page.evaluate(() => {
        const area = (selector: string): { selector: string; area: number; box: string } | null => {
          const element = document.querySelector(selector);
          if (element === null) return null;
          const rect = element.getBoundingClientRect();
          return {
            selector,
            area: Math.round(rect.width * rect.height),
            box: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
          };
        };
        return {
          viewport: window.innerWidth * window.innerHeight,
          centre: area(".app-main"),
          rail: area(".app-rail"),
          partner: area(".app-partner") ?? area(".app-partner-presence"),
          topbar: area(".app-topbar"),
          // The outer wrapper, which is the full width bottom bar.
          liveday: area(".app-liveday"),
        };
      });

      expect(regions.centre, "the centre work area is not rendered").toBeTruthy();
      const centre = regions.centre!;
      const share = Math.round((centre.area / regions.viewport) * 1000) / 10;

      testInfo.annotations.push({
        type: "centre-share",
        description: `${route}: centre ${centre.box} is ${share} percent of the viewport; rail ${regions.rail?.box ?? "none"}, partner ${regions.partner?.box ?? "none"}, top ${regions.topbar?.box ?? "none"}, live day ${regions.liveday?.box ?? "none"}`,
      });

      /*
       * The redesign's headline measurement. At 1366x768, the size most
       * likely to be in front of a client on a meeting room projector, the V1
       * work object had less than half the screen. The claim is that the
       * centre is now the largest region at every size, which is a stronger
       * statement than a percentage and does not need a different threshold
       * per viewport.
       */
      for (const other of [regions.rail, regions.partner, regions.topbar, regions.liveday]) {
        if (other === null) continue;
        expect(
          centre.area,
          `${route}: ${other.selector} at ${other.box} is larger than the centre at ${centre.box}`,
        ).toBeGreaterThan(other.area);
      }

      // And it is a majority of the stage, not merely the biggest of five
      // small things.
      expect(share, `${route}: the centre holds ${share} percent of the viewport`).toBeGreaterThan(
        50,
      );
    });
  }
});

test.describe("the first paint", () => {
  test("emits markup the stylesheet can lay out at this width", async ({
    page,
    request,
  }, testInfo) => {
    /*
     * Asserted against the served HTML and the resolved tokens, not against a
     * live measurement, because a live measurement of this is a race the test
     * loses about half the time.
     *
     * An earlier version measured the DOM immediately after
     * `domcontentloaded`. It did catch the defect, as fourteen clipped control
     * failures at 1366 in an earlier run, but when written as a deliberate
     * check it passed: the `requireSeeded` probe before it waits up to a
     * second, which is sometimes long enough for hydration to land first. A
     * test that reports a real defect only half the time is worse than one
     * that reports it never, because it teaches the reader to retry.
     *
     * So the contradiction is asserted directly instead, and it is a
     * contradiction between two things that cannot race:
     *
     *   the server emits `data-partner="open"`, because `ShellProvider`
     *   initialises `narrow` false and `partnerOpen` true and says why
     *   (reading local storage during render would be a hydration mismatch);
     *
     *   and at this width the stylesheet resolves `--app-partner-w` to the
     *   same value as `--app-partner-w-collapsed`.
     *
     * `workday-v2.css:61` gives the open state a partner column of
     * `var(--app-partner-w)`, so when those two tokens are equal the grid
     * hands the full dock the collapsed width and its 336px of content is
     * laid out past the right edge of a container that hides its overflow.
     * Nothing can scroll to it until the client corrects the state.
     */
    const response = await request.get("/workday/rcsa/assistant");
    expect(response.status(), "the route did not serve").toBeLessThan(400);
    const html = await response.text();

    const serverSaysOpen = /data-partner="open"/.test(html);
    const serverSentFullDock = /class="[^"]*\bapp-partner\b[^"]*"/.test(html);
    const serverSentPresenceRail = /class="[^"]*\bapp-partner-presence\b[^"]*"/.test(html);

    await open(page, "/workday/rcsa/assistant");
    await requireSeeded(page);
    await settle(page);

    const tokens = await page.evaluate(() => {
      const root = document.querySelector(".workday-v2");
      if (root === null) return null;
      const style = window.getComputedStyle(root);
      return {
        partnerWidth: style.getPropertyValue("--app-partner-w").trim(),
        collapsedWidth: style.getPropertyValue("--app-partner-w-collapsed").trim(),
        viewport: window.innerWidth,
      };
    });
    expect(tokens, "the workday scope is not present").toBeTruthy();

    testInfo.annotations.push({
      type: "first-paint",
      description: `served HTML: data-partner open ${serverSaysOpen}, full dock ${serverSentFullDock}, presence rail ${serverSentPresenceRail}. At ${tokens!.viewport}px, --app-partner-w ${tokens!.partnerWidth} and --app-partner-w-collapsed ${tokens!.collapsedWidth}`,
    });

    const contradiction =
      serverSaysOpen && serverSentFullDock && tokens!.partnerWidth === tokens!.collapsedWidth;

    expect(
      contradiction,
      `the server emits data-partner="open" with the full dock, and at ${tokens!.viewport}px the stylesheet resolves --app-partner-w to ${tokens!.partnerWidth}, which is the collapsed width. The dock is therefore laid out in a ${tokens!.collapsedWidth} column until the client corrects it.`,
    ).toBe(false);
  });
});

/* ==========================================================================
   3. The permanent disclosure
   ========================================================================== */

test.describe("the synthetic data disclosure", () => {
  /*
   * Deduplicated, because `/workday/rcsa` is both the first of the eight
   * interactive routes and one of the six role landings, and Playwright
   * refuses two tests with the same title in one file.
   */
  const DISCLOSURE_ROUTES = Array.from(
    new Set([...WORKDAY_ROUTES, ...ROLE_ROUTES, ...SETTINGS_ROUTES]),
  );

  for (const route of DISCLOSURE_ROUTES) {
    test(`${route} shows it inside the viewport`, async ({ page }) => {
      await open(page, route);
      if (route.startsWith("/workday")) await requireSeeded(page);
      await settle(page);

      const state = await page.evaluate(() => {
        const element = document.querySelector(".app-synthetic");
        if (element === null) return null;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return {
          text: (element.textContent ?? "").trim(),
          rendered:
            rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== "hidden" &&
            style.display !== "none" &&
            Number(style.opacity) > 0,
          inside:
            rect.top >= -1 &&
            rect.left >= -1 &&
            rect.bottom <= window.innerHeight + 1 &&
            rect.right <= window.innerWidth + 1,
          at: `${Math.round(rect.x)},${Math.round(rect.y)} ${Math.round(rect.width)}x${Math.round(rect.height)}`,
        };
      });

      /*
       * Permanent and not configurable away. It sits in the live day bar
       * rather than the top bar because the top bar is the one place in the
       * shell where every control competes for width, and therefore the one
       * place it could be pushed out of view. The assertion is that it is
       * genuinely in view, not merely in the document.
       */
      expect(state, `${route} has no synthetic data disclosure element`).toBeTruthy();
      expect(state!.text).toMatch(/Synthetic institution and data|Synthetische Institution und Daten/);
      expect(state!.rendered, `${route}: the disclosure is in the document but not rendered`).toBe(
        true,
      );
      expect(
        state!.inside,
        `${route}: the disclosure is rendered at ${state!.at}, outside the viewport`,
      ).toBe(true);
    });
  }
});

/* ==========================================================================
   4. Reduced motion
   ========================================================================== */

test.describe("reduced motion", () => {
  test("keeps every piece of readiness information in text", async ({ page }) => {
    /*
     * Emulated explicitly rather than relying on the project default, so the
     * test still means what it says if the shared `use` block changes.
     */
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page, "/workday/rcsa");
    await requireSeeded(page);
    await settle(page);

    // The rule is that shimmer is replaced by a neutral fill and nothing that
    // was only conveyed by movement is lost. So the live day state, the
    // partner state and the clock all have to be readable as words.
    await expect(page.locator(".app-liveday").last().getByText(/Nothing new|unread|ungelesen/)).toBeVisible();

    const partnerState = await page.evaluate(() => {
      const dock = document.querySelector(".app-partner") ?? document.querySelector(".app-partner-presence");
      return dock === null ? null : (dock.textContent ?? "").trim();
    });
    expect(partnerState, "the partner reports no state in text").toBeTruthy();
    expect(partnerState!, `the partner text is "${partnerState}"`).toMatch(
      /Monitoring|Checking evidence|Preparing|Ready|Needs you|Executing|Completed|Paused|Offline/,
    );

    /*
     * And nothing is relying on an infinite animation to say it is working.
     * A pill that pulses forever stops reading as information after ninety
     * seconds and starts reading as a defect.
     */
    const looping = await page.evaluate(() => {
      const found: string[] = [];
      for (const element of Array.from(document.querySelectorAll(".workday-v2 *"))) {
        const style = window.getComputedStyle(element);
        if (style.animationName === "none" || style.animationName === "") continue;
        if (style.animationIterationCount === "infinite") {
          const className =
            typeof element.className === "string" ? element.className.trim().split(/\s+/)[0] : "";
          found.push(`${element.tagName.toLowerCase()}.${className ?? ""} (${style.animationName})`);
        }
      }
      return Array.from(new Set(found));
    });
    expect(looping, "an element animates forever under prefers-reduced-motion reduce").toStrictEqual(
      [],
    );
  });
});

/* ==========================================================================
   5. Accessibility
   ========================================================================== */

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
    const api = (window as unknown as { axe: { run: (context: Document, options: unknown) => Promise<{ violations: Array<{ id: string; impact: string | null; help: string; nodes: Array<{ target: unknown }> }> }> } }).axe;
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

test.describe("axe-core", () => {
  for (const route of [...WORKDAY_ROUTES, ...SETTINGS_ROUTES]) {
    test(`${route} has no critical or serious violation`, async ({ page }, testInfo) => {
      await open(page, route);
      if (route.startsWith("/workday")) await requireSeeded(page);
      await settle(page);

      const violations = await runAxe(page);

      /*
       * Everything found is recorded, at every impact, whether or not it
       * fails the test. Suppressing a moderate finding to get a clean run
       * would make this suite a worse source of truth than no suite at all,
       * and the full list by impact is reproduced in the QA handoff.
       */
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

  test("the permanent disclosure meets the contrast threshold everywhere it appears", async ({
    page,
  }, testInfo) => {
    /*
     * Checked on the administrator area as well as the workday. The two
     * shells place the label differently, the workday in the live day bar and
     * the settings area in the top bar, so they resolve different
     * backgrounds and only one of them can be assumed from the other.
     */
    const failing: string[] = [];
    for (const route of ["/workday/rcsa", ...SETTINGS_ROUTES]) {
      await open(page, route);
      if (route.startsWith("/workday")) await requireSeeded(page);
      await settle(page);

      const violations = await runAxe(page);
      const contrast = violations.find((violation) => violation.id === "color-contrast");
      testInfo.annotations.push({
        type: "disclosure-contrast",
        description: `${route}: ${contrast ? `color-contrast x${contrast.nodes}, targets ${contrast.targets.join(" | ")}` : "no contrast violation"}`,
      });
      if ((contrast?.targets ?? []).some((target) => target.includes("app-synthetic"))) {
        failing.push(route);
      }
    }

    /*
     * Singled out because of what it is. The synthetic institution label is
     * the one piece of copy that is not configurable away, and the reason it
     * is not configurable away is that a reader must not mistake the
     * demonstration for a production system holding real client records. A
     * mandatory disclosure that fails the contrast threshold is a disclosure
     * that can be missed, which defeats the purpose of making it mandatory.
     */
    expect(
      failing,
      "the synthetic data disclosure fails the WCAG AA contrast threshold on these surfaces",
    ).toStrictEqual([]);
  });
});
