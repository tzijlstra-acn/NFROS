/**
 * The V2 workday shell.
 *
 * This suite exists to check the claims the redesign makes about the chrome,
 * not the claims it makes about its own taste. Each test corresponds to a
 * numbered acceptance criterion and is written so that a failure names the
 * criterion rather than a selector.
 *
 * Three conventions are carried over from `visual.spec.ts` and
 * `journeys.spec.ts` deliberately.
 *
 * Accessible selectors only. A test keyed on a class name passes after a
 * refactor that broke the screen for a keyboard user, which is the wrong way
 * round. The exceptions below are marked, and each one is a case where the
 * thing under test IS the structure: the count of `.app-liveday` elements, for
 * example, cannot be expressed as a role.
 *
 * Skip honestly. Where a route or a piece of seeded state genuinely is not
 * there, the test skips with a message naming what was missing. A test that
 * asserts nothing in order to stay green is worse than a skipped one.
 *
 * Restore what you change. Language, demo mode and the scenario clock are
 * columns on the run row, shared by every other test in the file and by the
 * other files. Anything that writes one of them puts it back.
 *
 * One group of tests is deliberately written to FAIL against the current
 * build, because the behaviour they describe is the behaviour the brief
 * requires and the build does not have it. They are not marked `fixme`: a
 * suppressed failure is a defect nobody reads. See
 * `docs/handoffs/workday-v2-qa.md` for each one.
 */

import { expect, test, type Locator, type Page } from "@playwright/test";
import { ROLE_IDS } from "@/db/schema/core";

/** The eight interactive routes the brief counts. */
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

/**
 * The em dash, built rather than typed.
 *
 * The repository gate refuses the literal character in any scanned file,
 * including this one, so the only way to assert its absence is to construct
 * it. Four agents learned this the hard way.
 */
const EM_DASH = String.fromCharCode(0x2014);

/** Opens a path, skipping when the route does not exist in this build. */
async function open(page: Page, path: string): Promise<void> {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  const status = response?.status() ?? 0;
  if (status === 404) {
    test.skip(true, `${path} is not implemented in this build. The server returned 404.`);
  }
  expect(status, `${path} returned HTTP ${status}`).toBeLessThan(400);
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

/** The V2 navigation rail. */
function rail(page: Page): Locator {
  return page.getByRole("navigation", { name: /^(Work areas|Arbeitsbereiche)$/ });
}

/** The demo menu trigger. Its accessible name is its visible text. */
function demoTrigger(page: Page): Locator {
  return page.getByRole("button", { name: "Demo", exact: true });
}

/**
 * The mode chip in the top bar.
 *
 * Scoped to `header.app-topbar` on purpose. The focus workspace and several
 * sections also render a `header`, and those carry their own count chips, so
 * an unscoped `header .app-chip` picks up a suggestion count and reports that
 * the product is in a mode called "6".
 */
function modeChip(page: Page): Locator {
  return page.locator("header.app-topbar .app-chip").last();
}

/**
 * Selects an item from the demo menu.
 *
 * Addressed by role and accessible name rather than by text content, because
 * the active item in a `Menu` glues an "on" marker straight onto its label
 * with no separator, so its text content reads "Offlineon" and a `^Offline$`
 * match silently stops finding the item the moment it becomes the active one.
 * That concatenation is itself recorded as a defect in the QA handoff.
 */
async function chooseFromDemoMenu(page: Page, label: string): Promise<void> {
  /*
   * Wait for the network to settle before pressing the trigger. The menu is a
   * client component and its click handler does not exist until the shell has
   * hydrated, so a press landing before that does nothing and the menu never
   * appears. Routes are opened with `domcontentloaded` here so that the first
   * paint measurements elsewhere stay honest, and the cost is that an
   * interaction has to say when it wants a hydrated page.
   */
  await page.waitForLoadState("networkidle");
  await demoTrigger(page).click();
  const menu = page.getByRole("menu", { name: /Demonstration settings|Demonstrationseinstellungen/ });
  await expect(menu).toBeVisible();
  await menu.getByRole("menuitemradio", { name: label }).first().click();
}

/**
 * Opens the command palette and waits for its input.
 *
 * The shortcut is registered in an effect, so pressing it in the first frames
 * after `domcontentloaded` lands before the listener exists. Retrying once is
 * the honest fix: the product is not wrong to register its shortcut on mount,
 * and a test that raced it would be flaky rather than informative.
 */
async function openPalette(page: Page): Promise<Locator> {
  /*
   * Pressed exactly once. The handler toggles, so a retry loop closes the
   * palette it just opened, which is how a helper written to be robust
   * becomes the flakiest thing in the file. The wait is on the network
   * settling instead, which is a good enough proxy for the client components
   * having mounted.
   */
  await page.waitForLoadState("networkidle");
  const palette = page.getByRole("dialog", { name: /Commands and search|Befehle und Suche/ });
  await page.keyboard.press("Control+k");
  await expect(palette).toBeVisible();
  await expect(palette.getByRole("combobox")).toBeVisible();
  return palette;
}

/**
 * The partner dock, opened if the viewport has collapsed it.
 *
 * At 1366 the shell renders the partner as a 48px presence rail, which is the
 * stated design rather than a defect, so a test about the dock's contents has
 * to ask for it first. The rail toggle is the user's own control for that.
 */
async function openPartner(page: Page): Promise<Locator> {
  /*
   * Wait for the client shell to adopt the viewport first. The shell renders
   * on the server with `narrow` false and the partner open and corrects both
   * after mount, so at 1366 there are a few frames in which the full dock is
   * laid out outside the viewport and the presence rail's expand control does
   * not exist yet. `workday-v2-visual.spec.ts` asserts that transient once, in
   * a test named for it; asking for the dock during it here would report the
   * same defect again on every test that touches the partner.
   */
  /*
   * The network first, so the dock's handlers exist. Routes are opened with
   * `domcontentloaded`, so a click landing before hydration does nothing.
   */
  await page.waitForLoadState("networkidle");
  await page
    .waitForFunction(
      () => {
        /*
         * Which rendering is mounted, not where it sits. The `aside` is laid
         * out inside a 48px grid column, so its own box fits the viewport
         * while its children overflow it, and a geometry check would never
         * wait at all.
         */
        const narrow = window.matchMedia("(max-width: 1366px)").matches;
        if (narrow) return document.querySelector(".app-partner-presence") !== null;
        return document.querySelector(".app-partner, .app-partner-presence") !== null;
      },
      undefined,
      { timeout: 10_000 },
    )
    .catch(() => {});

  const toggle = page.getByRole("button", { name: /^(Open the AI Partner|KI Partner oeffnen)$/ });
  if (await toggle.isVisible().catch(() => false)) await toggle.click();

  /*
   * `.app-partner` and not the accessible name. Both the full dock and the
   * presence rail are named "AI partner panel", which is right for a screen
   * reader, and at the narrowest width both are mounted at once: the rail
   * stays in the grid so the column does not collapse and the full dock goes
   * into a floating panel beside it. Addressing by name and taking the first
   * match returns the rail, which has no tabs and no composer.
   */
  const dock = page.locator(".app-partner").first();
  await expect(dock).toBeVisible();
  return dock;
}

/* ==========================================================================
   1. The six role landings
   ========================================================================== */

test.describe("the six role landings", () => {
  for (const roleId of ROLE_IDS) {
    test(`${roleId} opens on the focus workspace inside the V2 shell`, async ({ page }) => {
      await open(page, `/workday/${roleId}`);
      await requireSeeded(page);

      /*
       * The four pieces of permanent chrome, by role. If any of these is
       * missing the route is not rendering the V2 shell at all, which would
       * make every other assertion in this file meaningless.
       */
      await expect(page.locator("header.app-topbar")).toBeVisible();
      await expect(rail(page)).toBeVisible();
      await expect(page.getByRole("main")).toBeVisible();
      await expect(page.getByRole("group", { name: /^(Event track|Ereignisleiste)$/ })).toBeVisible();

      // The permanent disclosure. Not configurable away, so not conditional.
      await expect(page.getByText("Synthetic institution and data").first()).toBeVisible();

      /*
       * The screen opens on the judgment. Criterion 6: no title above 20px
       * and no lede paragraph, so the first heading is a short statement of
       * what needs the user rather than a description of the screen.
       */
      const title = page.getByRole("heading", { level: 1 });
      await expect(title).toHaveText(/This needs you now|Nothing needs you now/);

      // The AI Partner is present in one of its two renderings.
      const dock = page.getByRole("complementary", { name: /AI partner panel|KI Partner Bereich/ });
      await expect(dock.first()).toBeVisible();
    });
  }

  test("every role landing reports the same scenario clock", async ({ page }) => {
    const seen: string[] = [];
    for (const roleId of ROLE_IDS) {
      await open(page, `/workday/${roleId}`);
      await requireSeeded(page);
      // The live day bar clock, which is the authoritative one. The top bar
      // carries the same class, so the bar's own copy is taken by position.
      const clock = page.locator(".app-liveday .app-liveday-clock").last();
      seen.push(((await clock.textContent()) ?? "").trim());
    }
    const distinct = new Set(seen);
    expect(
      distinct.size,
      `the clock differs by role, which would mean the day is per screen: ${seen.join(", ")}`,
    ).toBe(1);
  });
});

/* ==========================================================================
   2. The icon rail
   ========================================================================== */

test.describe("the navigation rail", () => {
  test("uses icons and word labels, with no single character glyph navigation", async ({
    page,
  }) => {
    await open(page, "/workday/rcsa");
    await requireSeeded(page);

    const items = rail(page).locator(".app-rail-item");
    const count = await items.count();
    expect(count, "the rail renders no items").toBeGreaterThan(6);

    const problems = await items.evaluateAll((elements) =>
      elements
        .map((element) => {
          const labelNode = element.querySelector(".app-rail-label");
          const text = (labelNode?.textContent ?? "").trim();
          const hasIcon = element.querySelector("svg") !== null;
          const reasons: string[] = [];
          if (!hasIcon) reasons.push("has no icon");
          if (text.length === 0) reasons.push("has no word label");
          /*
           * The V1 rail navigated with single ASCII characters, hash, at,
           * tilde, equals, bang, star, plus, question mark and ampersand.
           * A label of one non alphanumeric character is that pattern
           * returning, whatever the character happens to be.
           */
          if (/^[^\p{L}\p{N}]$/u.test(text)) reasons.push(`uses the glyph label "${text}"`);
          return reasons.length === 0 ? null : `${text || "(unlabelled)"}: ${reasons.join(", ")}`;
        })
        .filter((entry): entry is string => entry !== null),
    );

    expect(problems, "the rail still navigates by glyph").toStrictEqual([]);
  });

  test("names its counts in the accessible label, because the badge disappears when collapsed", async ({
    page,
  }) => {
    await open(page, "/workday/rcsa");
    await requireSeeded(page);

    /*
     * The visible badge is `aria-hidden` and is replaced by a decorative dot
     * on a collapsed rail, so the count has to be in the name. Without this a
     * screen reader user on a collapsed rail never learns that five decisions
     * are waiting.
     */
    const decisions = rail(page).getByRole("link", { name: /^Decisions(,\s*\d+)?$/ });
    await expect(decisions).toBeVisible();
    const name = (await decisions.getAttribute("aria-label")) ?? "";
    expect(name, `the Decisions item is named "${name}" and carries no count`).toMatch(
      /^Decisions, \d+$/,
    );
  });

  test("is operable with the keyboard, and Enter follows the item", async ({ page }) => {
    await open(page, "/workday/rcsa");
    await requireSeeded(page);

    const decisions = rail(page).getByRole("link", { name: /^Decisions/ });
    await decisions.focus();
    await expect(decisions).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/workday\/rcsa\/decisions(\?.*)?$/);
    await expect(
      rail(page).getByRole("link", { name: /^Decisions/ }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("collapses and expands from the keyboard, reporting its state", async ({ page }) => {
    await open(page, "/workday/rcsa");
    await requireSeeded(page);

    const toggle = rail(page).getByRole("button", {
      name: /^(Expand the navigation|Collapse the navigation)$/,
    });
    await toggle.focus();
    const before = await toggle.getAttribute("aria-expanded");
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-expanded", before === "true" ? "false" : "true");

    // Put the rail back, because the preference persists in local storage and
    // the next test would otherwise start from a different chrome.
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-expanded", before ?? "false");
  });

  test("reaches every one of the eight workday routes without typing a URL", async ({ page }) => {
    await open(page, "/workday/rcsa");
    await requireSeeded(page);

    /*
     * This is a criterion about the shell, not about the rail specifically:
     * the eight interactive routes are the product, and a route a user cannot
     * navigate to is a route that does not exist for them. Both the rail and
     * the command palette count as navigation.
     */
    const railHrefs = await rail(page)
      .locator("a[href]")
      .evaluateAll((elements) => elements.map((element) => element.getAttribute("href") ?? ""));

    const unreachable: string[] = [];
    for (const segment of ROUTE_SEGMENTS) {
      const href = `/workday/rcsa${segment}`;
      if (railHrefs.includes(href)) continue;

      // Not in the rail. The palette is the other navigation surface, so the
      // route name is searched there before concluding anything.
      const term = segment.replace("/", "") || "today";
      const palette = await openPalette(page);
      await palette.getByRole("combobox").fill(term);
      const labels = await palette
        .getByRole("option")
        .evaluateAll((elements) => elements.map((element) => (element.textContent ?? "").trim()));
      await page.keyboard.press("Escape");
      await expect(palette).toBeHidden();

      const named = labels.some((label) => new RegExp(term, "i").test(label));
      if (!named) unreachable.push(href);
    }

    expect(
      unreachable,
      "a workday route has no navigation control in the rail and is not named in the command palette, so it is reachable only by typing its URL",
    ).toStrictEqual([]);
  });
});

/* ==========================================================================
   3. The command palette
   ========================================================================== */

test.describe("the command palette", () => {
  test("opens on Control K, searches, runs a command and closes on Escape", async ({ page }) => {
    await open(page, "/workday/rcsa");
    await requireSeeded(page);

    const palette = page.getByRole("dialog", { name: /Commands and search|Befehle und Suche/ });
    await expect(palette).toBeHidden();

    await openPalette(page);

    const input = palette.getByRole("combobox");
    await expect(input).toBeFocused();
    await expect(input).toHaveAttribute("placeholder", /Search or run a command/);

    // With no query the palette shows commands rather than the object index,
    // which would otherwise bury them under several hundred rows.
    const initial = await palette.getByRole("option").count();
    expect(initial, "the palette opens with no commands").toBeGreaterThan(4);

    // Searching narrows, and reaches a real scenario object by reference.
    await input.fill("CTL-PAY-014");
    await expect(
      palette.getByRole("option").filter({ hasText: "CTL-PAY-014" }).first(),
    ).toBeVisible();

    // Running a command. "Show evidence" is chosen because it is observable
    // and reversible; the palette's own Reset entry is deliberately not
    // exercised here, for the reason recorded in the QA handoff.
    await input.fill("Show evidence");
    await palette.getByRole("option", { name: /Show evidence/ }).first().click();
    await expect(palette).toBeHidden();
    await expect(page.getByRole("dialog", { name: /^(Context|Kontext)$/ })).toBeVisible();
    await page.keyboard.press("Escape");

    // And Escape closes it without running anything.
    await openPalette(page);
    await page.keyboard.press("Escape");
    await expect(palette).toBeHidden();
  });

  test("does not open while the user is typing in the chat composer", async ({ page }) => {
    await open(page, "/workday/rcsa");
    await requireSeeded(page);

    const dock = await openPartner(page);
    await dock.getByRole("tab", { name: /^Chat$/ }).click();
    const composer = dock.getByRole("textbox", { name: /Ask about the current work/ });
    await composer.click();
    await composer.type("k");

    /*
     * The palette key is Control K, so a bare "k" must never open it. The
     * guard matters because the composer is present on every route and a
     * presenter typing a question should not have a modal appear over it.
     */
    await expect(page.getByRole("dialog", { name: /Commands and search/ })).toBeHidden();
    await expect(composer).toHaveValue("k");
  });

  test("offers no armed destructive command", async ({ page }) => {
    await open(page, "/workday/rcsa");
    await requireSeeded(page);

    const palette = await openPalette(page);
    await palette.getByRole("combobox").fill("reset");

    const resetRow = palette.getByRole("option", { name: /Reset the day/ }).first();
    await expect(resetRow).toBeVisible();

    /*
     * The entry promises a second confirmation elsewhere. A palette row whose
     * label says "confirm in the demo menu" must not perform the reset when
     * it is selected, because the whole point of the wording is that a
     * mistyped search cannot discard the decisions an audience just watched.
     *
     * The test asserts the promise structurally rather than by pressing it.
     * Pressing it would destroy the scenario state the rest of this suite
     * depends on, which is itself the measure of how serious the defect is.
     * The reproduction is in the QA handoff.
     */
    const label = ((await resetRow.textContent()) ?? "").trim();
    const promisesConfirmation = /confirm|bestaetig/i.test(label);
    const inert = (await resetRow.getAttribute("aria-disabled")) === "true";

    expect(
      promisesConfirmation && !inert,
      [
        `the palette row reads "${label}", which promises that selecting it only arms the reset.`,
        "Nothing in the row marks it inert, and src/components/command/CommandPalette.tsx calls",
        "actionResetScenario() directly from its run handler, while app/actions.ts performs the",
        "reset with no confirmation gate. Selecting this row therefore discards every decision",
        "taken during a demonstration on one keystroke. Not exercised here, because doing so",
        "would destroy the scenario state the rest of the suite reads.",
      ].join(" "),
    ).toBe(false);

    await page.keyboard.press("Escape");
  });
});

/* ==========================================================================
   4. The contextual drawer
   ========================================================================== */

test.describe("the context drawer", () => {
  /** The compact trigger that opens the drawer on its evidence tab. */
  function evidenceTrigger(page: Page): Locator {
    return page.getByRole("button", { name: /^Evidence, \d+$/ }).first();
  }

  test("opens from a trigger on the tab that trigger names", async ({ page }) => {
    await open(page, "/workday/rcsa");
    await requireSeeded(page);

    const trigger = evidenceTrigger(page);
    if (!(await trigger.isVisible().catch(() => false))) {
      test.skip(true, "This role has no context triggers at the current moment.");
    }

    await trigger.click();
    const drawer = page.getByRole("dialog", { name: /^(Context|Kontext)$/ });
    await expect(drawer).toBeVisible();

    // Tab order follows how a risk professional interrogates a position, and
    // uncertainty sits second rather than last. Both are asserted, because
    // the ordering is a product decision rather than a layout detail.
    const tabs = await drawer
      .getByRole("tab")
      .evaluateAll((elements) => elements.map((element) => (element.textContent ?? "").trim()));
    expect(tabs[0], `tabs are ${tabs.join(", ")}`).toMatch(/^Evidence/);
    expect(tabs[1], `tabs are ${tabs.join(", ")}`).toMatch(/^Uncertainty/);

    await expect(drawer.getByRole("tab", { name: /^Evidence/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("agrees with its own count", async ({ page }) => {
    await open(page, "/workday/rcsa");
    await requireSeeded(page);

    const trigger = evidenceTrigger(page);
    if (!(await trigger.isVisible().catch(() => false))) {
      test.skip(true, "This role has no context triggers at the current moment.");
    }

    /*
     * The trigger says "Evidence, N" and the drawer tab carries its own
     * badge. Both are supposed to come from one assembly, because two
     * assemblers show subtly different evidence on different screens and the
     * user can rely on neither.
     */
    const triggerCount = Number(/(\d+)/.exec((await trigger.getAttribute("aria-label")) ?? "")?.[1] ?? "-1");
    await trigger.click();
    const drawer = page.getByRole("dialog", { name: /^(Context|Kontext)$/ });
    const tabText = ((await drawer.getByRole("tab", { name: /^Evidence/ }).textContent()) ?? "").trim();
    const tabCount = Number(/(\d+)/.exec(tabText)?.[1] ?? "-1");

    expect(
      tabCount,
      `the trigger offers ${triggerCount} evidence items and the drawer it opens shows ${tabCount}`,
    ).toBe(triggerCount);
  });

  test("moves focus into the panel when it opens", async ({ page }) => {
    await open(page, "/workday/rcsa");
    await requireSeeded(page);

    const trigger = evidenceTrigger(page);
    if (!(await trigger.isVisible().catch(() => false))) {
      test.skip(true, "This role has no context triggers at the current moment.");
    }

    await trigger.click();
    await expect(page.getByRole("dialog", { name: /^(Context|Kontext)$/ })).toBeVisible();

    // A modal dialog that leaves focus behind it is not reachable by keyboard
    // at all: the user's next Tab walks the page under the scrim.
    const inside = await page.evaluate(
      () => document.activeElement?.closest(".app-drawer") !== null,
    );
    expect(inside, "focus stayed outside the drawer after it opened").toBe(true);
  });

  test("traps Tab inside the panel", async ({ page }) => {
    await open(page, "/workday/rcsa");
    await requireSeeded(page);

    const trigger = evidenceTrigger(page);
    if (!(await trigger.isVisible().catch(() => false))) {
      test.skip(true, "This role has no context triggers at the current moment.");
    }

    await trigger.click();
    await expect(page.getByRole("dialog", { name: /^(Context|Kontext)$/ })).toBeVisible();

    // Far enough to walk out of a six tab drawer head and back round.
    for (let step = 0; step < 14; step += 1) await page.keyboard.press("Tab");

    const inside = await page.evaluate(
      () => document.activeElement?.closest(".app-drawer") !== null,
    );
    expect(inside, "Tab walked out of the modal drawer into the page behind it").toBe(true);
  });

  test("returns focus to the trigger on Escape", async ({ page }) => {
    await open(page, "/workday/rcsa");
    await requireSeeded(page);

    const trigger = evidenceTrigger(page);
    if (!(await trigger.isVisible().catch(() => false))) {
      test.skip(true, "This role has no context triggers at the current moment.");
    }

    const triggerName = (await trigger.getAttribute("aria-label")) ?? "";
    await trigger.click();
    await expect(page.getByRole("dialog", { name: /^(Context|Kontext)$/ })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: /^(Context|Kontext)$/ })).toBeHidden();

    /*
     * Without this, closing an evidence drawer drops a keyboard user at the
     * top of the document and they lose the place in the list they were
     * reading. The primitive documents focus return as one of its two load
     * bearing behaviours, so the assertion is on the documented contract.
     *
     * Read this result together with "moves focus into the panel when it
     * opens". While that one fails, this one passes for the wrong reason:
     * focus never left the trigger, so returning to it is trivially
     * satisfied and the restore path is not actually exercised. It is kept as
     * a guard for when the open behaviour is fixed, and it is recorded as a
     * vacuous pass in the QA handoff rather than counted as coverage.
     */
    const restored = await page.evaluate(
      () => document.activeElement?.getAttribute("aria-label") ?? "",
    );
    expect(restored, "focus was not returned to the control that opened the drawer").toBe(
      triggerName,
    );
  });
});

/* ==========================================================================
   5. The role switch
   ========================================================================== */

test.describe("switching role", () => {
  test("keeps the scenario clock, the autonomy level and the mode", async ({ page }) => {
    await open(page, "/workday/rcsa");
    await requireSeeded(page);
    await settle(page);

    const clock = page.locator(".app-liveday .app-liveday-clock").last();
    const before = ((await clock.textContent()) ?? "").trim();
    const modeBefore = ((await modeChip(page).textContent()) ?? "").trim();

    // The role switcher is the first menu control in the top bar.
    const switcher = page.locator('header [aria-haspopup="menu"]').first();
    await switcher.click();
    const menu = page.getByRole("menu", { name: /^(Role|Rolle)$/ });
    const other = menu.getByRole("menuitemradio", { checked: false }).first();
    const otherName = ((await other.textContent()) ?? "").trim();
    await other.click();

    await page.waitForURL((url) => /\/workday\/[a-z-]+$/.test(url.pathname) && !url.pathname.endsWith("/rcsa"));
    await requireSeeded(page);
    await settle(page);

    /*
     * The claim is that the state is on the run row, not in the screen that
     * happened to be open. Role is a column; the clock, the autonomy level
     * and the mode are other columns, and switching one must not touch them.
     */
    await expect(page.locator(".app-liveday .app-liveday-clock").last()).toHaveText(before);
    await expect(modeChip(page)).toHaveText(modeBefore);
    expect(otherName.length, "the role menu offered an unnamed role").toBeGreaterThan(3);

    /*
     * The switcher now names the chosen role. Compared on the first word
     * rather than on the whole string, because the trigger renders the role
     * title and the entity short name as two adjacent spans with no
     * separator, so its text content is the two glued together.
     */
    const after = ((await page.locator('header [aria-haspopup="menu"]').first().textContent()) ?? "").trim();
    const firstWord = /^([A-Za-z]+)/.exec(otherName)?.[1] ?? otherName;
    expect(after, `the switcher reads "${after}" after choosing "${otherName}"`).toContain(
      firstWord,
    );

    // Restore the seeded acting role so the rest of the suite is predictable.
    await open(page, "/workday/rcsa");
  });
});

/* ==========================================================================
   6. A decision, end to end
   ========================================================================== */

test.describe("recording a decision", () => {
  /*
   * Gated to one viewport on purpose. Recording a decision is a one way
   * mutation of the run: the row's status becomes decided and it cannot be
   * reopened without a reset. Running it in all three projects would leave
   * the second and third with nothing to record and would quietly change the
   * seeded state three times over.
   */
  test("produces an execution receipt, and refuses without a confirmed rationale", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-1920",
      "Recording a decision mutates the run, so it is exercised at one viewport only.",
    );

    await open(page, "/workday/nfr-governance/decisions");
    await requireSeeded(page);

    /*
     * Addressed through the heading rather than as a region. The section is a
     * bare `<section>` with an `<h2>` inside and no accessible name, so it
     * does not expose the region role at all. That is itself a finding, and it
     * is why axe reports content outside a landmark on these routes.
     */
    const openSection = page
      .locator("section.app-section")
      .filter({ has: page.getByRole("heading", { level: 2, name: /Your decisions|Ihre Entscheidungen/ }) })
      .first();
    if (!(await openSection.isVisible().catch(() => false))) {
      test.skip(true, "No decision is open for this role at the current moment.");
    }

    const flow = openSection.locator("article.panel").first();
    const options = flow.locator("button[aria-pressed]");
    expect(await options.count(), "the decision offers no options").toBeGreaterThan(1);

    // Nothing is pre-selected, because a default answer takes the judgment away.
    const preselected = await options.evaluateAll(
      (elements) => elements.filter((element) => element.getAttribute("aria-pressed") === "true").length,
    );
    expect(preselected, "an option is pre-selected").toBe(0);

    /*
     * The rationale field, the confirmation and the submit control are not
     * rendered until an option is chosen. That ordering is deliberate: there
     * is nothing to justify until there is a conclusion, and a rationale box
     * sitting above an unanswered question invites writing the justification
     * first.
     */
    expect(
      await flow.getByRole("button", { name: /Approve and execute|Genehmigen und ausfuehren/ }).count(),
      "the submit control is offered before an option has been chosen",
    ).toBe(0);

    await options.first().click();
    await expect(options.first()).toHaveAttribute("aria-pressed", "true");

    const submit = flow.getByRole("button", { name: /Approve and execute|Genehmigen und ausfuehren/ });
    await expect(submit).toBeVisible();
    // Refused: an option is chosen but no rationale has been written.
    await expect(submit).toBeDisabled();

    const rationale = flow.locator("textarea").first();
    await rationale.fill("Too short");
    await expect(submit).toBeDisabled();

    await rationale.fill(
      "Recorded during the automated design review. The opposing evidence was read and the residual position is accepted on the stated basis.",
    );
    // Still refused: the rationale exists but has not been owned.
    await expect(submit).toBeDisabled();

    await flow.getByRole("checkbox").first().check();
    await expect(submit).toBeEnabled();

    await submit.click();

    /*
     * The receipt is the point. Every line is a change that completed and
     * wrote an audit event, and nothing is listed that did not execute, so a
     * recorded decision with no receipt would mean the product reported a
     * change it did not make.
     */
    const receipt = flow.getByText(/Execution receipt \(\d+ completed change/);
    await expect(receipt).toBeVisible({ timeout: 30_000 });

    // And the record now carries the rationale as the decision maker's own.
    await expect(flow.getByText(/executed|partly executed/).first()).toBeVisible();
  });
});

/* ==========================================================================
   7. Modes
   ========================================================================== */

test.describe("the demonstration modes", () => {
  test("presenter safe is the resolved mode and is named in the chrome", async ({ page }) => {
    await open(page, "/workday/rcsa");
    await requireSeeded(page);

    // The top bar names the mode in force. A product that silently downgraded
    // would be discovered mid sentence by a presenter.
    await expect(modeChip(page)).toHaveText(/Presenter Safe|Live AI|Offline/);
  });

  test("offline mode states that it is showing the last known state and stops the composer", async ({
    page,
  }) => {
    await open(page, "/workday/rcsa");
    await requireSeeded(page);

    await chooseFromDemoMenu(page, "Offline");
    await expect(modeChip(page)).toHaveText(/Offline/, { timeout: 20_000 });

    const dock = await openPartner(page);
    /*
     * Offline outranks every other state in the derivation, and the detail
     * line has to say what the user is looking at. A dock that showed
     * "Monitoring" with no connection would be claiming work it cannot do.
     */
    await expect(dock.getByText(/No connection\. Showing the last known state\./)).toBeVisible();

    await dock.getByRole("tab", { name: /^Chat$/ }).click();
    await expect(dock.getByRole("textbox", { name: /Ask about the current work/ })).toBeDisabled();

    // Restore presenter safe, which is the seeded mode for the suite.
    await chooseFromDemoMenu(page, "Presenter Safe");
    await expect(modeChip(page)).toHaveText(/Presenter Safe/, { timeout: 20_000 });
  });

  test("restores presenter safe even if an earlier assertion failed", async ({ page }) => {
    /*
     * Teardown written as a test so its failure is visible. The demo mode is
     * process state on the server, shared with every other file in the run, so
     * a suite that left the product offline would make the next file's
     * assertions about the partner state fail for a reason that is not a
     * defect. Playwright has no file level teardown that still runs after a
     * failing test in the same describe, so the restore is a test of its own
     * placed after the one that changes the mode.
     */
    await open(page, "/workday/rcsa");
    await requireSeeded(page);
    if (!/Presenter Safe/.test(((await modeChip(page).textContent()) ?? ""))) {
      await chooseFromDemoMenu(page, "Presenter Safe");
    }
    await expect(modeChip(page)).toHaveText(/Presenter Safe/, { timeout: 20_000 });
  });
});

/* ==========================================================================
   8. German
   ========================================================================== */

test.describe("German", () => {
  test("translates the chrome and uses ASCII transliteration throughout", async ({ page }) => {
    await open(page, "/workday/rcsa");
    await requireSeeded(page);

    /*
     * Addressed by accessible name, not by visible text. The rail is
     * collapsed by default and the stylesheet hides `.app-rail-label` at that
     * width, so a visible text assertion here fails against a rail that is
     * working exactly as designed. The name is the right contract anyway: it
     * is what a screen reader user gets on a collapsed rail.
     */
    await expect(rail(page).getByRole("link", { name: /^Decisions/ })).toBeVisible();

    await chooseFromDemoMenu(page, "Deutsch");

    const germanRail = page.getByRole("navigation", { name: "Arbeitsbereiche" });
    await expect(germanRail.getByRole("link", { name: /^Entscheidungen/ })).toBeVisible({
      timeout: 20_000,
    });
    await expect(germanRail.getByRole("link", { name: /^Heute/ })).toBeVisible();
    await expect(page.getByText("Synthetische Institution und Daten").first()).toBeVisible();
    await settle(page);

    /*
     * The ASCII transliteration rule. The whole corpus contains no umlaut and
     * no sharp s, so a single one appearing in the German interface means a
     * new string was written outside the convention and the two halves of the
     * product now spell the same word two ways.
     */
    const offenders = await page.evaluate((codePoints: number[]) => {
      /*
       * The forbidden characters are passed in as code points and the class is
       * built here, rather than typed as a literal. Typing them would put the
       * very characters this test forbids into the repository, which is the
       * same trap the em dash rule sets: a test that asserts the absence of a
       * character must not contain it.
       */
      const bad = new Set(codePoints.map((point) => String.fromCharCode(point)));
      const found: string[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node !== null) {
        const text = (node.textContent ?? "").trim();
        if (text.length > 0 && Array.from(text).some((character) => bad.has(character))) {
          found.push(text.slice(0, 80));
        }
        node = walker.nextNode();
      }
      return Array.from(new Set(found));
      // A umlaut, O umlaut, U umlaut, a umlaut, o umlaut, u umlaut, sharp s.
    }, [0x00c4, 0x00d6, 0x00dc, 0x00e4, 0x00f6, 0x00fc, 0x00df]);
    expect(offenders, "the German interface contains umlaut or sharp s characters").toStrictEqual(
      [],
    );

    // And no em dash, in either language. Built rather than typed, because the
    // repository gate refuses the literal character in this file too.
    const dashes = await page.evaluate(
      (dash) => (document.body.innerText.match(new RegExp(dash, "g")) ?? []).length,
      EM_DASH,
    );
    expect(dashes, "the German interface renders an em dash").toBe(0);

    // Restore English.
    await chooseFromDemoMenu(page, "English");
    await expect(rail(page).getByRole("link", { name: /^Decisions/ })).toBeVisible({
      timeout: 20_000,
    });
  });

  test("restores English even if an earlier assertion failed", async ({ page }) => {
    // Teardown as a test, for the same reason as the mode restore above.
    await open(page, "/workday/rcsa");
    await requireSeeded(page);
    if ((await page.getByRole("navigation", { name: "Arbeitsbereiche" }).count()) > 0) {
      await chooseFromDemoMenu(page, "English");
    }
    await expect(rail(page).getByRole("link", { name: /^Decisions/ })).toBeVisible({
      timeout: 20_000,
    });
  });
});

/* ==========================================================================
   9. The administrator settings area
   ========================================================================== */

test.describe("the settings area", () => {
  const AREAS = [
    "organisation",
    "branding",
    "integrations",
    "mappings",
    "role-packs",
    "authority",
    "deployment",
  ];

  test("lists its areas and keeps the synthetic data disclosure", async ({ page }) => {
    await open(page, "/settings");
    await expect(page.getByRole("navigation", { name: "Settings areas" })).toBeVisible();
    await expect(page.getByText("Synthetic institution and data").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Back to the workday/ })).toBeVisible();
  });

  for (const area of AREAS) {
    test(`/settings/${area} renders without a server error`, async ({ page }) => {
      await open(page, `/settings/${area}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByText("Synthetic institution and data").first()).toBeVisible();
    });
  }
});

/* ==========================================================================
   10. The version flag, and what must not have changed
   ========================================================================== */

test.describe("the version flag", () => {
  test("ui=v1 still serves the previous interface from the same route", async ({ page }) => {
    await open(page, "/workday/rcsa?ui=v1");
    await requireSeeded(page);

    // The V1 markers: a scrubbing timeline and no V2 scope on the document.
    await expect(page.getByRole("navigation", { name: "Workday timeline" })).toBeVisible();
    expect(
      await page.locator(".workday-v2").count(),
      "the V2 scope is present on a ui=v1 render, so the two interfaces are mixed",
    ).toBe(0);
  });

  test("ui=v2 is the default", async ({ page }) => {
    await open(page, "/workday/rcsa");
    await requireSeeded(page);
    expect(await page.locator(".workday-v2").count()).toBeGreaterThan(0);
    await expect(page.getByRole("navigation", { name: "Workday timeline" })).toBeHidden();
  });
});

test.describe("the presentation, which must be untouched", () => {
  test("/story returns 200 and carries no workday scope", async ({ page }) => {
    const response = await page.goto("/story?safe=1", { waitUntil: "domcontentloaded" });
    expect(response?.status(), "/story did not return a successful status").toBe(200);

    await expect(page.getByRole("region", { name: /NFR WorkOS presentation/ })).toBeVisible();
    expect(
      await page.locator(".workday-v2").count(),
      "the workday scope leaked onto the presentation",
    ).toBe(0);
  });

  test("/story keeps its display typography, which proves the workday cap is scoped", async ({
    page,
  }) => {
    await open(page, "/story?safe=1");
    await settle(page);

    /*
     * The workday caps `--text-2xl` at 20px inside `.workday-v2`. If that cap
     * were declared on `:root` it would silently shrink the deck, which is
     * read from eight metres. A heading above 24px here is therefore the
     * evidence that the scoping worked, not a defect.
     */
    const largest = await page.evaluate(() => {
      let max = 0;
      for (const element of Array.from(document.querySelectorAll("body *"))) {
        const own = Array.from(element.childNodes)
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => (node.textContent ?? "").trim())
          .join("")
          .trim();
        if (own.length === 0) continue;
        const size = Number.parseFloat(window.getComputedStyle(element).fontSize);
        if (Number.isFinite(size) && size > max) max = size;
      }
      return max;
    });
    expect(
      largest,
      "the presentation no longer renders display type, so the workday type cap is not scoped",
    ).toBeGreaterThan(24);
  });
});
