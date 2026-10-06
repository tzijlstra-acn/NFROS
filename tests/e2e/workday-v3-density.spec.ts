/**
 * V3.1 non-negotiable requirement 2: the default screen is understandable
 * without training.
 *
 * That is not directly measurable, so the brief converts it into an information
 * budget that is. At 1366x768 the opening viewport carries one page title, one
 * line of context, one active item, at most three `Next` rows, at most one
 * inline AI suggestion and a collapsed `Done`, and exactly one element carries
 * the strongest visual treatment. This file measures each of those as a number
 * and prints the number in the failure message, so a regression says what
 * changed rather than that something changed.
 *
 * Two definitions are stated here rather than left to a selector, because the
 * assertion is only as honest as its definition.
 *
 * THE STRONGEST TREATMENT. On a calm light canvas the strongest treatments
 * available are a saturated fill and a thick saturated edge. An element
 * qualifies when its computed background is one of the accent, danger or
 * warning hues, or when any of its borders is 3px or more in one of those hues.
 * Nested qualifiers are then dropped: the primary button inside the `Now` card
 * is part of that one block, not a second place to look. What is left is the
 * count of places on the screen competing for the first glance, which is what
 * the requirement is actually about.
 *
 * A DIVIDER LINE. Every visible border edge, plus every horizontal rule. Both
 * interfaces are measured by the identical function, so the comparison is fair
 * even though the absolute number is an approximation of what a reader would
 * call a line.
 *
 * The budget tests are gated to the 1366 project. The brief sets the budget at
 * that size, 1366 is the smallest projected size and therefore the binding one,
 * and asserting the same numbers three times would not add information. The
 * overflow test is not gated, because that one is a claim about all three.
 */

import { expect, test, type Page } from "@playwright/test";
import { ROLE_IDS } from "@/db/schema/core";

const V31 = "ui=v3.1";
const CURRENT = "ui=current";

/** Opens a role home and fails rather than skipping on an error status. */
async function openHome(page: Page, role: string, ui: string): Promise<void> {
  const response = await page.goto(`/workday/${role}?${ui}`, { waitUntil: "domcontentloaded" });
  const status = response?.status() ?? 0;
  expect(status, `/workday/${role}?${ui} returned HTTP ${status}`).toBeLessThan(400);
}

/** Skips when the scenario database has not been seeded. */
async function requireSeeded(page: Page): Promise<void> {
  const notSeeded = page.getByText("The scenario has not been seeded", { exact: false }).first();
  if (await notSeeded.isVisible({ timeout: 1_000 }).catch(() => false)) {
    test.skip(
      true,
      "The scenario database is not seeded. Run npm run db:migrate and npm run db:seed.",
    );
  }
}

/** Waits for the webfonts and one layout frame, so measurements are final. */
async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
  );
}

/** Confirms this is actually the V3.1 interface before measuring its budget. */
async function requireV31(page: Page, role: string): Promise<void> {
  await expect(
    page.locator("header.wd-header"),
    `${role} did not render the V3.1 interface, so its information budget cannot be measured`,
  ).toHaveCount(1);
}

/* ==========================================================================
   Measurement primitives, all evaluated in the page
   ========================================================================== */

/**
 * Counts the elements carrying the strongest visual treatment.
 *
 * Returns the outermost qualifiers only, with a short description of each so a
 * failure names the competitors rather than just counting them.
 */
async function strongestTreatments(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const scope = document.querySelector("main") ?? document.body;

    /*
     * The hues are read from the live tokens rather than hard coded, so the
     * test does not have to be edited when a palette moves. A probe element
     * resolves each custom property to the rgb string the computed styles use.
     */
    const probe = document.createElement("span");
    probe.style.position = "absolute";
    probe.style.opacity = "0";
    (document.querySelector(".workday-v3") ?? document.body).appendChild(probe);
    const resolve = (token: string): string => {
      probe.style.color = `var(${token})`;
      return getComputedStyle(probe).color;
    };
    const strong = new Set(["--wd-accent", "--wd-danger", "--wd-warning"].map(resolve));
    probe.remove();

    const sides = ["Top", "Right", "Bottom", "Left"] as const;
    const qualifies = (element: Element): string | null => {
      const style = getComputedStyle(element);
      if (style.visibility === "hidden" || style.display === "none") return null;
      const rect = element.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return null;
      /* The opening viewport only. Below the fold is a scroll, not a glance. */
      if (rect.top >= window.innerHeight) return null;

      if (strong.has(style.backgroundColor)) return "filled";
      for (const side of sides) {
        const width = Number.parseFloat(
          style.getPropertyValue(`border-${side.toLowerCase()}-width`),
        );
        const colour = style.getPropertyValue(`border-${side.toLowerCase()}-color`);
        if (width >= 3 && strong.has(colour)) return `${side.toLowerCase()} edge`;
      }
      return null;
    };

    const matched: Array<{ element: Element; how: string }> = [];
    for (const element of Array.from(scope.querySelectorAll("*"))) {
      const how = qualifies(element);
      if (how) matched.push({ element, how });
    }

    /* Drop anything inside another qualifier: one block, one place to look. */
    const outermost = matched.filter(
      (candidate) =>
        !matched.some((other) => other.element !== candidate.element && other.element.contains(candidate.element)),
    );

    return outermost.map((entry) => {
      const node = entry.element;
      const label = `${node.tagName.toLowerCase()}${
        node.className && typeof node.className === "string"
          ? `.${node.className.trim().split(/\s+/).join(".")}`
          : ""
      }`;
      return `${label} (${entry.how})`;
    });
  });
}

/** Counts the words a reader can actually see in the document. */
async function visibleWords(page: Page): Promise<number> {
  return page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let words = 0;
    let node = walker.nextNode();
    while (node) {
      const text = (node.textContent ?? "").trim();
      const parent = node.parentElement;
      if (text.length > 0 && parent) {
        const tag = parent.tagName;
        if (tag !== "SCRIPT" && tag !== "STYLE" && tag !== "NOSCRIPT" && tag !== "TEMPLATE") {
          const style = getComputedStyle(parent);
          const rect = parent.getBoundingClientRect();
          const screenReaderOnly =
            style.clipPath.includes("inset(50%)") || (rect.width <= 1 && rect.height <= 1);
          const painted =
            style.visibility !== "hidden" &&
            style.display !== "none" &&
            Number.parseFloat(style.opacity) > 0.05 &&
            rect.width > 1 &&
            rect.height > 1;
          if (painted && !screenReaderOnly) words += text.split(/\s+/).filter(Boolean).length;
        }
      }
      node = walker.nextNode();
    }
    return words;
  });
}

/** Counts the divider lines a reader can see: border edges plus rules. */
async function visibleDividers(page: Page): Promise<number> {
  return page.evaluate(() => {
    const transparent = (colour: string): boolean =>
      colour === "transparent" || /rgba?\([^)]*,\s*0(\.0+)?\)$/.test(colour);

    let lines = 0;
    for (const element of Array.from(document.body.querySelectorAll("*"))) {
      const style = getComputedStyle(element);
      if (style.visibility === "hidden" || style.display === "none") continue;
      const rect = element.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;

      if (element.tagName === "HR") {
        lines += 1;
        continue;
      }
      for (const side of ["top", "right", "bottom", "left"]) {
        const width = Number.parseFloat(style.getPropertyValue(`border-${side}-width`));
        const kind = style.getPropertyValue(`border-${side}-style`);
        const colour = style.getPropertyValue(`border-${side}-color`);
        if (width >= 1 && kind !== "none" && kind !== "hidden" && !transparent(colour)) lines += 1;
      }
    }
    return lines;
  });
}

/** The relative luminance of an element's background, 0 black to 1 white. */
async function backgroundLuminance(page: Page, selector: string): Promise<number> {
  return page.evaluate((target) => {
    const element = document.querySelector(target);
    if (!element) return -1;
    const parts = getComputedStyle(element)
      .backgroundColor.match(/[\d.]+/g)
      ?.map(Number) ?? [];
    if (parts.length < 3) return -1;
    const channel = (value: number): number => {
      const v = value / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return (
      0.2126 * channel(parts[0] ?? 0) + 0.7152 * channel(parts[1] ?? 0) + 0.0722 * channel(parts[2] ?? 0)
    );
  }, selector);
}

/* ==========================================================================
   The information budget, at 1366x768, for every role
   ========================================================================== */

test.describe("the V3.1 information budget at 1366x768", () => {
  for (const role of ROLE_IDS) {
    test(`${role}: the opening viewport stays inside the budget`, async ({ page }, testInfo) => {
      test.skip(
        testInfo.project.name !== "desktop-1366",
        "The brief sets the budget at 1366x768, which is the smallest projected size and therefore the binding one.",
      );

      await openHome(page, role, V31);
      await requireSeeded(page);
      await requireV31(page, role);
      await settle(page);

      /* ---------- One page title, one line of context ---------- */
      const titles = page.locator("main h1");
      expect
        .soft(await titles.count(), `${role}: the opening viewport carries more than one page title`)
        .toBe(1);

      /* ---------- At most three Next rows ---------- */
      const next = page.getByRole("region", { name: /^(Next|Danach)$/ });
      const nextRows = next.locator(".wd-list > .wd-item");
      const nextCount = (await next.count()) === 0 ? 0 : await nextRows.count();
      expect
        .soft(nextCount, `${role}: the Next list holds ${nextCount} rows, and the budget is three`)
        .toBeLessThanOrEqual(3);

      /* ---------- Exactly one strongest treatment ---------- */
      const strongest = await strongestTreatments(page);
      expect
        .soft(
          strongest.length,
          `${role}: ${strongest.length} elements carry the strongest visual treatment in the opening viewport, and the budget is one. Found: ${
            strongest.join(" | ") || "none"
          }`,
        )
        .toBe(1);

      /* ---------- At most one inline AI suggestion ---------- */
      const suggestions = page.locator("main .wd-suggestion");
      const suggestionCount = await suggestions.count();
      expect
        .soft(
          suggestionCount,
          `${role}: ${suggestionCount} inline AI suggestions on the default screen, and the budget is one`,
        )
        .toBeLessThanOrEqual(1);

      /* ---------- Done collapsed on load ---------- */
      // Home's Done reads "Done today 7, 5 handled automatically, 2 completed by you".
      const done = page.getByRole("button", {
        name: /(Done today|Heute erledigt|Handled automatically|Automatisch bearbeitet)/,
      });
      const doneCount = await done.count();
      if (doneCount > 0) {
        expect
          .soft(
            await done.first().getAttribute("aria-expanded"),
            `${role}: the Done disclosure is open on load, so completed work is mixed into the active view`,
          )
          .toBe("false");
      } else {
        testInfo.annotations.push({
          type: "budget",
          description: `${role}: no Done disclosure is present on the home, so nothing was completed at the current moment`,
        });
      }
      /*
       * And nothing else is expanded either. This is the assertion that cannot
       * pass vacuously: whatever optional groups the home carries, the default
       * screen is the one where all of them are shut.
       */
      const expanded = await page.locator("main [aria-expanded='true']").evaluateAll((nodes) =>
        nodes.map((node) => (node.textContent ?? "").trim().slice(0, 40)),
      );
      expect
        .soft(
          expanded.length,
          `${role}: ${expanded.length} disclosures are expanded on load, and the default screen expands none: ${
            expanded.join(" | ") || "none"
          }`,
        )
        .toBe(0);

      /* ---------- The AI partner collapsed by default ---------- */
      expect
        .soft(
          await page.getByRole("dialog", { name: /^(AI Partner|KI Partner)$/ }).count(),
          `${role}: the AI partner dock is open on load, and the default is collapsed`,
        )
        .toBe(0);
      const aiTrigger = page.getByRole("button", { name: /^(AI Partner|KI Partner),/ });
      if ((await aiTrigger.count()) > 0) {
        expect
          .soft(
            await aiTrigger.first().getAttribute("aria-expanded"),
            `${role}: the AI partner trigger reports itself expanded on load`,
          )
          .toBe("false");
      }

      /* ---------- A light canvas ---------- */
      const luminance = await backgroundLuminance(page, ".wd-frame");
      expect
        .soft(
          luminance,
          `${role}: the canvas luminance is ${luminance.toFixed(3)}, which is not a light canvas`,
        )
        .toBeGreaterThan(0.8);

      /* ---------- The main work region holds 70 percent of the width ---------- */
      const share = await page.evaluate(() => {
        const main = document.querySelector("main");
        if (!main) return -1;
        return main.getBoundingClientRect().width / window.innerWidth;
      });
      expect
        .soft(
          share,
          `${role}: the main work region holds ${(share * 100).toFixed(1)} percent of the width with the panels closed, and the floor is 70`,
        )
        .toBeGreaterThanOrEqual(0.7);
    });
  }
});

/* ==========================================================================
   One right hand panel at a time
   ========================================================================== */

test.describe("the right hand panels", () => {
  for (const role of ROLE_IDS) {
    test(`${role}: only one right hand panel is open at a time`, async ({ page }, testInfo) => {
      test.skip(
        testInfo.project.name !== "desktop-1366",
        "The panel rule is measured once, at the binding size.",
      );

      await openHome(page, role, V31);
      await requireSeeded(page);
      await requireV31(page, role);
      await settle(page);

      /*
       * Counted as VISIBLE panels rather than as elements in the document. The
       * AI dock stays mounted and sets the `hidden` attribute when it closes,
       * so presence is not the question. What a reader sees is.
       */
      const openPanels = page.locator(".wd-panel:visible");
      expect
        .soft(await openPanels.count(), `${role}: a panel is on screen before anything was clicked`)
        .toBe(0);

      const evidence = page.getByRole("button", { name: /^(Evidence|Nachweise),/ });
      const aiTrigger = page.getByRole("button", { name: /^(AI Partner|KI Partner),/ });

      if ((await evidence.count()) === 0 || (await aiTrigger.count()) === 0) {
        test.skip(
          true,
          `${role} does not offer both an evidence trigger and an AI partner trigger on its home, so the rule cannot be exercised here.`,
        );
      }

      /**
       * Opens a panel, retrying the click.
       *
       * The retry is for hydration, not for the assertion. The trigger is
       * server rendered HTML before its handler exists, so a click landing in
       * that window is lost, and that window is not the thing under test here.
       * The assertion that the panel opened is not relaxed.
       */
      const openWith = async (trigger: typeof evidence, what: string): Promise<void> => {
        await expect(async () => {
          await trigger.first().click({ timeout: 2_000 });
          await expect(openPanels).not.toHaveCount(0, { timeout: 1_500 });
        }, `${role}: ${what} did not open a panel`).toPass({ timeout: 20_000 });
      };

      /**
       * Whether a control is the topmost thing at its own centre.
       *
       * This is the question a pointer asks. A control that is on screen,
       * enabled and covered by an overlay is a control the user cannot use,
       * and the message names what is on top of it.
       */
      const obscuredBy = async (trigger: typeof evidence): Promise<string | null> =>
        trigger.first().evaluate((node) => {
          const rect = node.getBoundingClientRect();
          const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
          if (top === null || node.contains(top) || top === node) return null;
          return `${top.tagName.toLowerCase()}${
            typeof top.className === "string" && top.className
              ? `.${top.className.trim().split(/\s+/).join(".")}`
              : ""
          }`;
        });

      /* ---------- The drawer first, then the dock ---------- */
      await openWith(evidence, "the evidence trigger");

      const aiObscured = await obscuredBy(aiTrigger);
      expect
        .soft(
          aiObscured,
          `${role}: with the context drawer open, the AI partner trigger in the header is covered by ${aiObscured}, so the reader cannot switch panels`,
        )
        .toBeNull();

      if (aiObscured === null) {
        await aiTrigger.first().click({ timeout: 5_000 });
        const names = await openPanels.evaluateAll((nodes) =>
          nodes.map((node) => node.getAttribute("aria-label") ?? "unnamed"),
        );
        expect
          .soft(
            names.length,
            `${role}: ${names.length} right hand panels are on screen at once: ${names.join(" + ")}`,
          )
          .toBe(1);
      }

      /* ---------- The dock first, then the drawer ---------- */
      await openHome(page, role, V31);
      await settle(page);
      await openWith(aiTrigger, "the AI partner trigger");

      const evidenceObscured = await obscuredBy(evidence);
      expect
        .soft(
          evidenceObscured,
          `${role}: with the AI partner open, the evidence trigger in the workspace is covered by ${evidenceObscured}, so the reader cannot switch panels`,
        )
        .toBeNull();

      if (evidenceObscured === null) {
        await evidence.first().click({ timeout: 5_000 });
        const names = await openPanels.evaluateAll((nodes) =>
          nodes.map((node) => node.getAttribute("aria-label") ?? "unnamed"),
        );
        expect
          .soft(
            names.length,
            `${role}: ${names.length} right hand panels are on screen at once after switching from the dock to the drawer: ${names.join(
              " + ",
            )}`,
          )
          .toBe(1);
      }
    });
  }
});

/* ==========================================================================
   Fewer words and fewer lines than the interface it replaces
   ========================================================================== */

test.describe("V3.1 against the current interface", () => {
  for (const role of ROLE_IDS) {
    test(`${role}: the V3.1 home shows fewer words and fewer divider lines`, async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== "desktop-1366",
        "The comparison is made at the binding size, 1366x768.",
      );

      await openHome(page, role, CURRENT);
      await requireSeeded(page);
      await settle(page);
      const currentWords = await visibleWords(page);
      const currentLines = await visibleDividers(page);

      await openHome(page, role, V31);
      await requireV31(page, role);
      await settle(page);
      const v31Words = await visibleWords(page);
      const v31Lines = await visibleDividers(page);

      testInfo.annotations.push({
        type: "density",
        description: `${role}: words ${currentWords} to ${v31Words}, divider edges ${currentLines} to ${v31Lines}`,
      });

      expect
        .soft(
          v31Words,
          `${role}: the V3.1 home shows ${v31Words} visible words against ${currentWords} on ?ui=current, a change of ${
            v31Words - currentWords
          }`,
        )
        .toBeLessThan(currentWords);

      expect
        .soft(
          v31Lines,
          `${role}: the V3.1 home shows ${v31Lines} visible divider edges against ${currentLines} on ?ui=current, a change of ${
            v31Lines - currentLines
          }`,
        )
        .toBeLessThan(currentLines);
    });
  }
});

/* ==========================================================================
   No horizontal scrollbar, at any projected size
   ========================================================================== */

test.describe("no horizontal overflow", () => {
  for (const role of ROLE_IDS) {
    test(`${role}: the V3.1 home does not scroll sideways`, async ({ page }, testInfo) => {
      await openHome(page, role, V31);
      await requireSeeded(page);
      await requireV31(page, role);
      await settle(page);

      const overflow = await page.evaluate(() => {
        const offenders: string[] = [];
        const root = document.documentElement;
        if (root.scrollWidth > root.clientWidth + 1) {
          offenders.push(`documentElement scrollWidth ${root.scrollWidth} against ${root.clientWidth}`);
        }
        if (document.body.scrollWidth > document.body.clientWidth + 1) {
          offenders.push(
            `body scrollWidth ${document.body.scrollWidth} against ${document.body.clientWidth}`,
          );
        }
        for (const selector of [".wd-frame", ".wd-body", "main", ".wd-header"]) {
          const element = document.querySelector(selector);
          if (!element) continue;
          if (element.scrollWidth > element.clientWidth + 1) {
            offenders.push(
              `${selector} scrollWidth ${element.scrollWidth} against ${element.clientWidth}`,
            );
          }
        }
        return offenders;
      });

      expect(
        overflow,
        `${role} at ${testInfo.project.name}: something is wider than the viewport. ${overflow.join("; ")}`,
      ).toEqual([]);
    });
  }
});
