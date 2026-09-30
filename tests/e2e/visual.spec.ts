/**
 * The overflow and readability matrix.
 *
 * This suite exists because of how the product is used. It is projected, at
 * one of three fixed sizes, to people who will not scroll and cannot lean in.
 * A scene that needs a scrollbar at 1366 by 768 is not a cosmetic problem: the
 * bottom of it does not exist for the audience.
 *
 * Four checks run on every surface at every viewport:
 *
 *   1. no horizontal document overflow, anywhere, without exception
 *   2. no vertical document overflow on the surfaces that are designed as a
 *      single stage, which is the presentation and the workday shell
 *   3. no rendered text below 10px computed size
 *   4. every button and link has a real hit area and is not covered at its
 *      own centre point
 *
 * On the four report surfaces, a vertical scroll is the intended design: they
 * are documents read by a CRO or an auditor in one pass, not slides. Asserting
 * that they fit a viewport would be a test that fails for a reason that is not
 * a defect, so the vertical measurement is recorded as an annotation there
 * instead of asserted. The horizontal assertion still applies.
 *
 * A screenshot of every surface at every viewport lands in
 * `tests/e2e/__screenshots__/` for manual inspection. Those are artefacts, not
 * comparison baselines: the suite makes no claim that a pixel changed.
 */

import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { STORY_SCENES } from "@/scenario/data/story";
import { ROLE_IDS } from "@/db/schema/core";

/** Pixels of slack allowed before a difference counts as overflow. */
const TOLERANCE = 2;

/** Smallest computed font size that is legible on a projector. */
const MINIMUM_FONT_PX = 10;

const SCREENSHOT_DIR = join(process.cwd(), "tests", "e2e", "__screenshots__");

interface Metrics {
  scrollWidth: number;
  innerWidth: number;
  scrollHeight: number;
  innerHeight: number;
  hasHorizontalScrollbar: boolean;
  hasVerticalScrollbar: boolean;
}

interface TinyText {
  selector: string;
  fontSize: number;
  text: string;
}

interface ControlProblem {
  selector: string;
  reason: string;
  label: string;
}

interface OffStage {
  selector: string;
  text: string;
  bottom: number;
  right: number;
}

async function settle(page: Page): Promise<void> {
  // Awaited inside the page and not returned, because a FontFaceSet is not a
  // serialisable value to hand back across the bridge.
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  // One frame for layout to settle after the font swap and any entry reveal.
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
  );
}

async function measure(page: Page): Promise<Metrics> {
  return page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    return {
      scrollWidth: Math.max(root.scrollWidth, body.scrollWidth),
      innerWidth: window.innerWidth,
      scrollHeight: Math.max(root.scrollHeight, body.scrollHeight),
      innerHeight: window.innerHeight,
      hasHorizontalScrollbar: root.scrollWidth > root.clientWidth,
      hasVerticalScrollbar: root.scrollHeight > root.clientHeight,
    };
  });
}

async function findTinyText(page: Page, minimum: number): Promise<TinyText[]> {
  return page.evaluate((limit) => {
    const describe = (element: Element): string => {
      const tag = element.tagName.toLowerCase();
      const className =
        typeof element.className === "string" && element.className.length > 0
          ? `.${element.className.trim().split(/\s+/).slice(0, 2).join(".")}`
          : "";
      return `${tag}${className}`;
    };

    const offenders: Array<{ selector: string; fontSize: number; text: string }> = [];

    for (const element of Array.from(document.querySelectorAll("body *"))) {
      // Only elements that render text of their own. Otherwise a wrapper
      // reports its children's text and every offender is counted many times.
      const ownText = Array.from(element.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => (node.textContent ?? "").trim())
        .join(" ")
        .trim();
      if (ownText.length === 0) continue;

      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") continue;
      if (Number(style.opacity) === 0) continue;

      // Screen reader only content is not rendered for the eye.
      if (element.closest(".sr-only") !== null) continue;

      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      const fontSize = Number.parseFloat(style.fontSize);
      if (!Number.isFinite(fontSize) || fontSize >= limit) continue;

      offenders.push({
        selector: describe(element),
        fontSize,
        text: ownText.slice(0, 60),
      });
    }

    return offenders;
  }, minimum);
}

async function findUnusableControls(page: Page): Promise<ControlProblem[]> {
  return page.evaluate(() => {
    const describe = (element: Element): string => {
      const tag = element.tagName.toLowerCase();
      const className =
        typeof element.className === "string" && element.className.length > 0
          ? `.${element.className.trim().split(/\s+/).slice(0, 2).join(".")}`
          : "";
      return `${tag}${className}`;
    };

    const labelOf = (element: Element): string =>
      (
        element.getAttribute("aria-label") ??
        (element.textContent ?? "").trim() ??
        ""
      ).slice(0, 60);

    const problems: Array<{ selector: string; reason: string; label: string }> = [];

    for (const element of Array.from(document.querySelectorAll("button, a[href]"))) {
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") continue;
      if (element.closest(".sr-only") !== null) continue;
      if (element.hasAttribute("disabled")) continue;

      /*
       * Not rendered at all, which is different from rendered badly. A
       * control inside a collapsed panel has no client rects because an
       * ancestor is display none, and that is the panel being closed rather
       * than a control the user cannot press. Only rendered controls are
       * held to the checks below.
       */
      if (element.getClientRects().length === 0) continue;

      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        problems.push({
          selector: describe(element),
          reason: "has a zero sized bounding box",
          label: labelOf(element),
        });
        continue;
      }

      const centreX = rect.left + rect.width / 2;
      const centreY = rect.top + rect.height / 2;

      // Only meaningful for controls whose centre is on screen. A control
      // further down a scrolling document is not covered, it is below.
      if (
        centreX < 0 ||
        centreY < 0 ||
        centreX > window.innerWidth ||
        centreY > window.innerHeight
      ) {
        continue;
      }

      /*
       * A control inside a scrolling region is only judged where its centre
       * currently sits inside that region's visible area.
       *
       * `getBoundingClientRect` is not clipped by an ancestor's overflow, so a
       * tall card part way down a scroller has a geometric centre that can
       * fall outside the scroller, over whatever is painted there. That is
       * what the user scrolls to reach, not a control they cannot press, and
       * reporting it would flag every long list in the product.
       *
       * Note what this does NOT skip: a control whose centre is inside the
       * visible area and is genuinely covered by something painted over it.
       * That is the case worth failing on and it still fails.
       */
      let scroller: Element | null = element.parentElement;
      while (scroller !== null) {
        const scrollerStyle = window.getComputedStyle(scroller);
        const scrolls =
          (scrollerStyle.overflowY === "auto" || scrollerStyle.overflowY === "scroll") &&
          scroller.scrollHeight > scroller.clientHeight + 2;
        if (scrolls) break;
        scroller = scroller.parentElement;
      }

      if (scroller !== null) {
        const bounds = scroller.getBoundingClientRect();
        const centreInsideScroller =
          centreY >= bounds.top - 2 &&
          centreY <= bounds.bottom + 2 &&
          centreX >= bounds.left - 2 &&
          centreX <= bounds.right + 2;
        if (!centreInsideScroller) continue;
      }

      const atPoint = document.elementFromPoint(centreX, centreY);
      if (atPoint === null) {
        problems.push({
          selector: describe(element),
          reason: "nothing is hit testable at its centre point",
          label: labelOf(element),
        });
        continue;
      }

      /*
       * The Next development overlay is injected by the dev server and is not
       * part of the product. Reporting it as an obstruction would turn a real
       * check into noise, and would report a defect that does not exist in the
       * build a presenter runs.
       */
      if (atPoint.closest("nextjs-portal") !== null) continue;

      const related = element.contains(atPoint) || atPoint.contains(element);
      if (!related) {
        problems.push({
          selector: describe(element),
          reason: `covered at its centre point by ${describe(atPoint)}`,
          label: labelOf(element),
        });
      }
    }

    return problems;
  });
}

/**
 * Content that is rendered outside the viewport and cannot be reached.
 *
 * This is the check that matters most on a fixed stage, and the one a
 * document overflow measurement misses entirely. When a container clips with
 * `overflow: hidden`, the page reports no scrollbar and no scroll height, and
 * the bottom two rows of the scene simply do not exist for the audience.
 *
 * An element is excused when an ancestor can scroll, because then the content
 * is reachable, and when it is screen reader only, because then it was never
 * meant for the eye.
 */
async function findOffStageContent(page: Page, tolerance: number): Promise<OffStage[]> {
  return page.evaluate((slack) => {
    const describe = (element: Element): string => {
      const tag = element.tagName.toLowerCase();
      const className =
        typeof element.className === "string" && element.className.length > 0
          ? `.${element.className.trim().split(/\s+/).slice(0, 2).join(".")}`
          : "";
      return `${tag}${className}`;
    };

    const canScroll = (element: Element): boolean => {
      const style = window.getComputedStyle(element);
      return (
        style.overflowY === "auto" ||
        style.overflowY === "scroll" ||
        style.overflowX === "auto" ||
        style.overflowX === "scroll" ||
        style.overflow === "auto" ||
        style.overflow === "scroll"
      );
    };

    const found: Array<{ selector: string; text: string; bottom: number; right: number }> = [];

    for (const element of Array.from(document.querySelectorAll("body *"))) {
      if (element.closest(".sr-only") !== null) continue;

      const ownText = Array.from(element.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => (node.textContent ?? "").trim())
        .join(" ")
        .trim();
      if (ownText.length === 0) continue;

      const rect = element.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      if (element.getClientRects().length === 0) continue;

      const beyondBottom = rect.bottom > window.innerHeight + slack;
      const beyondRight = rect.right > window.innerWidth + slack;
      if (!beyondBottom && !beyondRight) continue;

      let ancestor: Element | null = element.parentElement;
      let reachable = false;
      while (ancestor !== null) {
        if (canScroll(ancestor)) {
          reachable = true;
          break;
        }
        ancestor = ancestor.parentElement;
      }
      if (reachable) continue;

      found.push({
        selector: describe(element),
        text: ownText.slice(0, 50),
        bottom: Math.round(rect.bottom),
        right: Math.round(rect.right),
      });
    }

    return found;
  }, tolerance);
}

async function capture(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  if (!existsSync(SCREENSHOT_DIR)) mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const safeName = name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  try {
    await page.screenshot({
      path: join(SCREENSHOT_DIR, `${testInfo.project.name}--${safeName}.png`),
      fullPage: false,
    });
  } catch (error) {
    // The screenshot is an inspection artefact. Failing to write one must not
    // hide the layout finding the test exists to report.
    testInfo.annotations.push({
      type: "screenshot-failed",
      description: `${safeName}: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

interface AuditOptions {
  /** Assert the content fits the viewport height. False for documents. */
  strictVertical: boolean;
  /** Assert no rendered content is clipped out of reach. */
  offStage: boolean;
}

/** Runs the checks appropriate to the kind of surface. */
async function auditSurface(
  page: Page,
  testInfo: TestInfo,
  label: string,
  options: AuditOptions,
): Promise<void> {
  await settle(page);
  await capture(page, testInfo, label);

  const metrics = await measure(page);

  testInfo.annotations.push({
    type: "metrics",
    description: `${label}: ${metrics.scrollWidth}x${metrics.scrollHeight} in ${metrics.innerWidth}x${metrics.innerHeight}`,
  });

  // A horizontal scrollbar is always a defect. Nothing in this product is
  // designed to be read sideways.
  expect(
    metrics.scrollWidth - metrics.innerWidth,
    `${label} overflows horizontally: content is ${metrics.scrollWidth}px wide in a ${metrics.innerWidth}px viewport`,
  ).toBeLessThanOrEqual(TOLERANCE);

  if (options.strictVertical) {
    expect(
      metrics.scrollHeight - metrics.innerHeight,
      `${label} overflows vertically: content is ${metrics.scrollHeight}px tall in a ${metrics.innerHeight}px viewport, so the bottom is off stage`,
    ).toBeLessThanOrEqual(TOLERANCE);
  }

  const tiny = await findTinyText(page, MINIMUM_FONT_PX);
  expect(
    tiny.map((item) => `${item.selector} at ${item.fontSize}px: "${item.text}"`),
    `${label} renders text below ${MINIMUM_FONT_PX}px`,
  ).toStrictEqual([]);

  const controls = await findUnusableControls(page);
  expect(
    controls.map((item) => `${item.selector} ("${item.label}") ${item.reason}`),
    `${label} has controls that cannot be used`,
  ).toStrictEqual([]);

  if (options.offStage) {
    const offStage = await findOffStageContent(page, TOLERANCE);
    expect(
      offStage.map(
        (item) =>
          `${item.selector} "${item.text}" ends at ${item.right}x${item.bottom} and is clipped out of reach`,
      ),
      `${label} renders content the audience cannot see and cannot scroll to`,
    ).toStrictEqual([]);
  }
}

/** Opens a path, skipping when the route is not built in this build. */
async function open(page: Page, path: string): Promise<void> {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  const status = response?.status() ?? 0;
  if (status === 404) {
    test.skip(true, `${path} is not implemented in this build. The server returned 404.`);
  }
  expect(status, `${path} returned HTTP ${status}`).toBeLessThan(400);
}

/* ==========================================================================
   The presentation, scene by scene
   ========================================================================== */

test.describe("the presentation stage", () => {
  for (const scene of STORY_SCENES) {
    test(`scene ${scene.sceneNumber} fits the stage`, async ({ page }, testInfo) => {
      // Safe mode resolves every reveal immediately, so the measurement is of
      // the final state of the scene rather than of a frame mid transition.
      await open(page, `/story?safe=1&scene=${scene.sceneNumber}`);

      const deck = page.getByRole("region", { name: /NFR WorkOS presentation/ });
      await expect(deck).toHaveAttribute(
        "aria-label",
        new RegExp(`Scene ${scene.sceneNumber} of `),
      );

      await auditSurface(page, testInfo, `scene-${scene.sceneNumber}-${scene.id}`, {
        strictVertical: true,
        offStage: true,
      });
    });
  }

  test("has no scrollbar on the deck itself", async ({ page }, testInfo) => {
    await open(page, "/story?safe=1");
    await settle(page);

    const metrics = await measure(page);
    expect(metrics.hasVerticalScrollbar, "the presentation document scrolls vertically").toBe(
      false,
    );
    expect(metrics.hasHorizontalScrollbar, "the presentation document scrolls horizontally").toBe(
      false,
    );

    // And no inner element scrolls either, which is the more common cause of
    // a scene losing its last line on a projector.
    const scrollers = await page.evaluate(() => {
      const found: string[] = [];
      for (const element of Array.from(document.querySelectorAll(".story-deck *"))) {
        const style = window.getComputedStyle(element);
        const scrollable =
          style.overflowY === "auto" ||
          style.overflowY === "scroll" ||
          style.overflow === "auto" ||
          style.overflow === "scroll";
        if (!scrollable) continue;
        if (element.scrollHeight - element.clientHeight > 2) {
          const tag = element.tagName.toLowerCase();
          const cls =
            typeof element.className === "string" ? element.className.trim().split(/\s+/)[0] : "";
          found.push(`${tag}.${cls ?? ""} (${element.scrollHeight} in ${element.clientHeight})`);
        }
      }
      return found;
    });

    testInfo.annotations.push({
      type: "inner-scrollers",
      description: scrollers.length === 0 ? "none" : scrollers.join("; "),
    });
    expect(scrollers, "an element inside the deck scrolls, so part of the scene is off stage").toStrictEqual(
      [],
    );
  });
});

/* ==========================================================================
   The workday shell, which is also a single stage
   ========================================================================== */

const WORKDAY_ROUTES: string[] = [
  ...ROLE_IDS.map((roleId) => `/workday/${roleId}`),
  "/workday/rcsa/decisions",
  "/workday/rcsa/mail",
  "/workday/rcsa/calendar",
  "/workday/rcsa/meetings",
  "/workday/rcsa/collaboration",
  "/workday/rcsa/workbench",
  "/workday/rcsa/assistant",
];

test.describe("the workday shell", () => {
  for (const route of WORKDAY_ROUTES) {
    test(`${route} fits the viewport`, async ({ page }, testInfo) => {
      await open(page, route);

      if (
        await page
          .getByText("The scenario has not been seeded", { exact: false })
          .first()
          .isVisible({ timeout: 1_000 })
          .catch(() => false)
      ) {
        test.skip(true, "The scenario database is not seeded, so the shell is not rendered.");
      }

      // The shell sets its own height to the viewport and hides overflow, so
      // a document that scrolls here means something escaped the grid.
      await auditSurface(page, testInfo, `workday${route.replace(/\//g, "-")}`, {
        strictVertical: true,
        offStage: true,
      });
    });
  }
});

/* ==========================================================================
   The entry screen
   ========================================================================== */

test.describe("the entry screen", () => {
  test("fits the viewport it is projected at", async ({ page }, testInfo) => {
    await open(page, "/");
    // The entry screen is the first projected frame of the demonstration and
    // is written as a single screen, so a scrollbar here is a defect.
    // The document itself scrolls here, so nothing is unreachable. The
    // finding, if there is one, is that it needs scrolling at all.
    await auditSurface(page, testInfo, "entry", { strictVertical: true, offStage: false });
  });
});

/* ==========================================================================
   The report surfaces, where vertical scroll is the design
   ========================================================================== */

const REPORT_ROUTES = ["/workday", "/control-room", "/trust", "/value", "/roadmap"];

test.describe("the report surfaces", () => {
  for (const route of REPORT_ROUTES) {
    test(`${route} reads without sideways scrolling`, async ({ page }, testInfo) => {
      await open(page, route);
      await auditSurface(page, testInfo, `report${route.replace(/\//g, "-")}`, {
        strictVertical: false,
        offStage: false,
      });
    });
  }

  test("every report surface keeps its controls reachable after scrolling to the end", async ({
    page,
  }, testInfo) => {
    for (const route of REPORT_ROUTES) {
      await open(page, route);
      await settle(page);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await settle(page);

      const metrics = await measure(page);
      expect(
        metrics.scrollWidth - metrics.innerWidth,
        `${route} overflows horizontally once scrolled to the end`,
      ).toBeLessThanOrEqual(TOLERANCE);

      const controls = await findUnusableControls(page);
      expect(
        controls.map((item) => `${item.selector} ("${item.label}") ${item.reason}`),
        `${route} has unusable controls at the foot of the page`,
      ).toStrictEqual([]);

      await capture(page, testInfo, `report${route.replace(/\//g, "-")}-foot`);
    }
  });
});
