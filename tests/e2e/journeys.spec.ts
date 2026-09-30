/**
 * End to end journeys.
 *
 * These walk the routes a presenter walks, in the order they walk them, and
 * assert the things the product claims rather than the things that are easy to
 * assert. Two of those claims get particular attention:
 *
 *   - nothing is pre-selected on a decision, because the product's position is
 *     that the judgment is the human's and a default answer would quietly
 *     take it away
 *   - switching role retains the scenario state, because that is the
 *     difference between one work environment and six tools
 *
 * Selectors are accessible ones. A test that keys on a class name passes after
 * a refactor that broke the screen for a keyboard user, which is the wrong way
 * round.
 *
 * Where a route is genuinely not built yet, the test skips with a message
 * naming the route. A skipped test is honest; a test that asserts nothing in
 * order to stay green is not.
 */

import { expect, test, type Page } from "@playwright/test";
import { ROLE_IDS } from "@/db/schema/core";

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
      "The scenario database is not seeded, so there is no content to assert. Run npm run db:migrate and npm run db:seed.",
    );
  }
}

/** The clock as the workday top bar reports it. */
function topBarClock(page: Page) {
  return page.locator("header .mono.strong-text").first();
}

/**
 * The role switcher in the top bar.
 *
 * Keyed on `aria-haspopup`, which is the accessibility contract for a control
 * that opens a menu, and on its position: the switcher is the first such
 * control in the top bar, ahead of the autonomy selector.
 */
function roleSwitcher(page: Page) {
  return page.locator('header [aria-haspopup="true"]').first();
}

/** The role title the switcher displays, without its disclosure glyph. */
async function switcherTitle(page: Page): Promise<string> {
  const text = (await roleSwitcher(page).textContent()) ?? "";
  return text.trim().replace(/v$/, "").trim();
}

/** Moves the scenario clock using the bottom timeline. */
async function scrubTo(page: Page, moment: string): Promise<void> {
  const timeline = page.getByRole("navigation", { name: "Workday timeline" });
  await timeline.getByRole("button").filter({ hasText: moment }).first().click();
  await expect(topBarClock(page)).toHaveText(moment);
}

/* ==========================================================================
   Entry
   ========================================================================== */

test.describe("the entry screen", () => {
  test("renders the proposition, the synthetic data label and the runtime status", async ({
    page,
  }) => {
    await open(page, "/");

    await expect(page.getByRole("heading", { level: 1, name: /Live the NFR day/i })).toBeVisible();

    // The synthetic data label is mandatory on every surface that shows
    // Arcadia content, and this is the first one an executive sees.
    await expect(page.getByText("Synthetic institution and data").first()).toBeVisible();

    // The runtime status has to be honest about the mode in force.
    await expect(page.getByText("Runtime status")).toBeVisible();
    await expect(page.getByText("AI mode", { exact: true })).toBeVisible();
    await expect(page.getByText("Live AI configured", { exact: true })).toBeVisible();
    await expect(page.getByText("Scenario seeded", { exact: true })).toBeVisible();
  });

  test("offers both the presentation and the interactive day", async ({ page }) => {
    await open(page, "/");
    await expect(page.getByRole("link", { name: /Open the presentation/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Enter the interactive day/i })).toBeVisible();
  });

  test("states that the institution and the regulatory context are illustrative", async ({
    page,
  }) => {
    await open(page, "/");
    await expect(page.getByText(/Arcadia Banking Group is a synthetic institution/i)).toBeVisible();
    await expect(page.getByText(/not legal advice/i).first()).toBeVisible();
  });
});

/* ==========================================================================
   Role selection
   ========================================================================== */

test.describe("the workday index", () => {
  test("lists exactly six professional lenses, each linking to its own route", async ({ page }) => {
    await open(page, "/workday");
    await requireSeeded(page);

    const roleLinks = page.locator('a[href^="/workday/"]');
    const hrefs = await roleLinks.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("href") ?? ""),
    );
    const distinct = new Set(hrefs.filter((href) => /^\/workday\/[a-z-]+$/.test(href)));

    expect(distinct.size, `found ${Array.from(distinct).join(", ")}`).toBe(ROLE_IDS.length);
    for (const roleId of ROLE_IDS) {
      expect(distinct.has(`/workday/${roleId}`), `${roleId} is not listed`).toBe(true);
    }
  });

  test("states the shared event and the clock, so the scenario is visible before entering", async ({
    page,
  }) => {
    await open(page, "/workday");
    await requireSeeded(page);
    await expect(page.getByText(/Scenario day \d{2}\.\d{2}\.\d{4}/)).toBeVisible();
    await expect(page.getByText(/Clock at \d{2}:\d{2}/)).toBeVisible();
    await expect(page.getByText(/14:05 event/)).toBeVisible();
  });
});

/* ==========================================================================
   Each role's day
   ========================================================================== */

for (const roleId of ROLE_IDS) {
  test(`the ${roleId} workday loads with a role title and a decision brief`, async ({ page }) => {
    await open(page, `/workday/${roleId}`);
    await requireSeeded(page);

    // The acting role is named in the top bar switcher, which is also the
    // control that changes it.
    const switcher = roleSwitcher(page);
    await expect(switcher).toBeVisible();
    const switcherText = (await switcher.textContent()) ?? "";
    expect(switcherText.trim().length, "the role switcher shows no role").toBeGreaterThan(3);

    // The screen opens on the judgment, not on a message count.
    const brief = page.getByRole("region", { name: "Decision brief" });
    await expect(brief).toBeVisible();
    await expect(brief.getByRole("heading", { name: /Your decisions/ })).toBeVisible();

    // The intelligence rail and the timeline are the two persistent frames.
    await expect(page.getByRole("navigation", { name: "Workday timeline" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Work areas" })).toBeVisible();
  });
}

/* ==========================================================================
   Decisions
   ========================================================================== */

test.describe("the decision list", () => {
  test("shows options with nothing pre-selected and no rationale written", async ({ page }) => {
    await open(page, "/workday/rcsa/decisions");
    await requireSeeded(page);

    await expect(page.getByRole("heading", { name: /The judgments that are yours to make/ })).toBeVisible();

    const openSection = page.getByRole("region", { name: "Open decisions" });
    if (!(await openSection.isVisible().catch(() => false))) {
      test.skip(true, "No decision is open for this role at the current moment.");
    }

    // Every option is a pressable card, and none of them starts pressed.
    const options = openSection.locator('button[aria-pressed]');
    const count = await options.count();
    expect(count, "the open decision offers no options").toBeGreaterThan(1);

    const pressed = await options.evaluateAll((elements) =>
      elements.filter((element) => element.getAttribute("aria-pressed") === "true").length,
    );
    expect(pressed, "an option is pre-selected, which takes the judgment away").toBe(0);

    // And the rationale field is empty, because nobody writes it for them.
    const rationale = openSection.locator("textarea").first();
    if (await rationale.isVisible().catch(() => false)) {
      await expect(rationale).toHaveValue("");
    }
  });

  test("states the uncertainty and both sides of the evidence before the choice", async ({
    page,
  }) => {
    await open(page, "/workday/rcsa/decisions");
    await requireSeeded(page);

    const openSection = page.getByRole("region", { name: "Open decisions" });
    if (!(await openSection.isVisible().catch(() => false))) {
      test.skip(true, "No decision is open for this role at the current moment.");
    }

    await expect(openSection.getByText("Stated uncertainty").first()).toBeVisible();
    await expect(
      openSection.getByText("Evidence supporting the prepared position").first(),
    ).toBeVisible();
    await expect(openSection.getByText("Evidence that argues against it").first()).toBeVisible();
    await expect(
      openSection.getByText(/for you to accept, change or reject/i).first(),
    ).toBeVisible();
  });

  test("selecting an option marks it pressed and leaves the others alone", async ({ page }) => {
    await open(page, "/workday/rcsa/decisions");
    await requireSeeded(page);

    const openSection = page.getByRole("region", { name: "Open decisions" });
    if (!(await openSection.isVisible().catch(() => false))) {
      test.skip(true, "No decision is open for this role at the current moment.");
    }

    const options = openSection.locator('button[aria-pressed]');
    await options.first().click();
    await expect(options.first()).toHaveAttribute("aria-pressed", "true");

    const pressed = await options.evaluateAll((elements) =>
      elements.filter((element) => element.getAttribute("aria-pressed") === "true").length,
    );
    expect(pressed, "selecting one option pressed more than one").toBe(1);
  });
});

/* ==========================================================================
   The controls that change real state
   ========================================================================== */

test.describe("the Today and future toggle", () => {
  test("changes the content of the same screen rather than showing a diagram", async ({ page }) => {
    await open(page, "/workday/rcsa");
    await requireSeeded(page);

    const group = page.getByRole("group", {
      name: "Switch between the current reality and the AI enabled future",
    });
    await expect(group).toBeVisible();

    const today = group.getByRole("button", { name: /^(Today|Heute)$/ });
    const future = group.getByRole("button", { name: /AI-enabled future|Zukunft/ });

    // The seeded day opens in the future view.
    await expect(future).toHaveAttribute("aria-pressed", "true");
    const futureHeading = page.getByText("What was already done before you arrived");
    await expect(futureHeading).toBeVisible();

    await today.click();
    await expect(today).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("What this moment costs today")).toBeVisible();
    await expect(futureHeading).toBeHidden();

    // Restore, so the next test starts from the seeded state.
    await future.click();
    await expect(page.getByText("What was already done before you arrived")).toBeVisible();
  });
});

test.describe("the autonomy selector", () => {
  test("changes the level it displays, and says how many actions are withheld", async ({ page }) => {
    await open(page, "/workday/rcsa");
    await requireSeeded(page);

    const trigger = page.getByRole("button", { name: /Autonomy/ });
    await expect(trigger).toContainText("Act with approval");

    await trigger.click();
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    await expect(menu.getByText(/tool action\(s\) are currently withheld/)).toBeVisible();

    await menu.getByRole("menuitemradio", { name: /Act within policy/ }).click();
    await expect(page.getByRole("button", { name: /Autonomy/ })).toContainText(
      "Act within policy",
    );

    // Restore the seeded level.
    await page.getByRole("button", { name: /Autonomy/ }).click();
    await page
      .getByRole("menu")
      .getByRole("menuitemradio", { name: /Act with approval/ })
      .click();
    await expect(page.getByRole("button", { name: /Autonomy/ })).toContainText(
      "Act with approval",
    );
  });
});

test.describe("switching role", () => {
  test("retains the scenario clock and changes the acting role", async ({ page }) => {
    await open(page, "/workday/rcsa");
    await requireSeeded(page);

    // Move the day on, so there is state that could be lost.
    await scrubTo(page, "11:45");

    const beforePath = new URL(page.url()).pathname;
    const before = await switcherTitle(page);
    await roleSwitcher(page).click();

    const menu = page.getByRole("menu");
    await expect(menu).toContainText(/Switching role keeps the shared event/);
    const otherRole = menu.getByRole("menuitemradio", { checked: false }).first();
    const otherName = ((await otherRole.textContent()) ?? "").trim();
    await otherRole.click();

    // The route follows the role.
    await page.waitForURL((url) => url.pathname !== beforePath && /\/workday\/[a-z-]+$/.test(url.pathname));

    // And the clock does not move. This is the claim: the state is on the run,
    // not in the screen that happened to be open.
    await expect(topBarClock(page)).toHaveText("11:45");

    // The switcher now names the role that was chosen, and the menu entry it
    // was chosen from starts with that same title.
    const afterText = await switcherTitle(page);
    expect(afterText.length).toBeGreaterThan(3);
    expect(afterText, "the switcher still names the previous role").not.toBe(before);
    expect(otherName.startsWith(afterText), `"${otherName}" does not start with "${afterText}"`).toBe(true);

    // Restore the morning.
    await scrubTo(page, "07:45");
  });
});

test.describe("the timeline", () => {
  test("advancing to 14:05 reveals the shared event", async ({ page }) => {
    await open(page, "/workday/incident-resilience");
    await requireSeeded(page);

    await scrubTo(page, "14:05");
    // The chip carries a non-colour glyph alongside its text, so the match is
    // a substring one rather than an exact one.
    await expect(page.getByText("shared event").first()).toBeVisible();

    // The event is shared, so another function sees it at the same moment.
    await open(page, "/workday/tprm");
    await expect(topBarClock(page)).toHaveText("14:05");

    await open(page, "/workday");
    await expect(page.getByText("The 14:05 event has occurred")).toBeVisible();

    // Restore the morning clock. The event stays latched on purpose, because
    // scrubbing back in time must not un-happen a fact.
    await open(page, "/workday/rcsa");
    await scrubTo(page, "07:45");
  });
});

test.describe("the language toggle", () => {
  test("changes the navigation labels", async ({ page }) => {
    await open(page, "/workday/rcsa");
    await requireSeeded(page);

    const workAreas = page.getByRole("navigation", { name: "Work areas" });
    await expect(workAreas.getByText("Decisions", { exact: true })).toBeVisible();

    const languages = page.getByRole("group", { name: "Interface language" });
    await languages.getByRole("button", { name: "DE" }).click();

    await expect(workAreas.getByText("Entscheidungen", { exact: true })).toBeVisible();
    await expect(workAreas.getByText("Heute", { exact: true })).toBeVisible();
    await expect(page.getByText("Synthetische Institution und Daten").first()).toBeVisible();

    // Restore English.
    await page.getByRole("group", { name: "Interface language" }).getByRole("button", { name: "EN" }).click();
    await expect(workAreas.getByText("Decisions", { exact: true })).toBeVisible();
  });
});

/* ==========================================================================
   The accountability surfaces
   ========================================================================== */

const REPORT_ROUTES: Array<{ path: string; heading: RegExp }> = [
  { path: "/control-room", heading: /Control room/ },
  { path: "/trust", heading: /Trust and accountability/ },
  { path: "/value", heading: /Value model/ },
  { path: "/roadmap", heading: /Delivery roadmap/ },
];

for (const route of REPORT_ROUTES) {
  test(`${route.path} loads with its heading and the synthetic data label`, async ({ page }) => {
    await open(page, route.path);
    await expect(page.getByRole("heading", { level: 1, name: route.heading })).toBeVisible();
    await expect(page.getByText("Synthetic institution and data").first()).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Product surfaces" }).first()).toBeVisible();
  });
}

/* ==========================================================================
   The presentation
   ========================================================================== */

test.describe("the presentation", () => {
  test("opens on the first scene and states which scene it is", async ({ page }) => {
    await open(page, "/story?safe=1");
    const deck = page.getByRole("region", { name: /NFR WorkOS presentation\. Scene \d+ of \d+/ });
    await expect(deck).toBeVisible();
    await expect(deck).toHaveAttribute("aria-label", /Scene 1 of \d+/);
  });

  test("navigates with the keyboard, forwards, backwards and to the ends", async ({ page }) => {
    await open(page, "/story?safe=1");
    const deck = page.getByRole("region", { name: /NFR WorkOS presentation/ });
    await expect(deck).toHaveAttribute("aria-label", /Scene 1 of (\d+)/);

    const total = Number(
      /Scene \d+ of (\d+)/.exec((await deck.getAttribute("aria-label")) ?? "")?.[1] ?? "0",
    );
    expect(total, "the deck reports no scene count").toBeGreaterThan(1);

    await page.keyboard.press("ArrowRight");
    await expect(deck).toHaveAttribute("aria-label", /Scene 2 of \d+/);

    await page.keyboard.press("ArrowLeft");
    await expect(deck).toHaveAttribute("aria-label", /Scene 1 of \d+/);

    await page.keyboard.press("End");
    await expect(deck).toHaveAttribute("aria-label", new RegExp(`Scene ${total} of ${total}`));

    await page.keyboard.press("Home");
    await expect(deck).toHaveAttribute("aria-label", /Scene 1 of \d+/);
  });

  test("opens the keyboard help and closes it with Escape", async ({ page }) => {
    await open(page, "/story?safe=1");
    await page.keyboard.press("?");
    const help = page.getByRole("dialog", { name: /Keyboard and mouse controls/ });
    await expect(help).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(help).toBeHidden();
  });

  test("announces the current scene for a screen reader", async ({ page }) => {
    await open(page, "/story?safe=1");
    const live = page.locator("[aria-live='polite']").first();
    await expect(live).toContainText(/Scene 1 of \d+/);
    await page.keyboard.press("ArrowRight");
    await expect(live).toContainText(/Scene 2 of \d+/);
  });

  test("carries the synthetic data label and the regulatory label", async ({ page }) => {
    await open(page, "/story?safe=1&export=1");
    await expect(page.getByText("Synthetic institution and data").first()).toBeAttached();
    await expect(page.getByText(/not legal advice/i).first()).toBeAttached();
  });

  test("publishes the scene metadata the export pipeline reads", async ({ page }) => {
    await open(page, "/story?export=1");
    const raw = await page.locator("[data-story-scenes]").getAttribute("data-story-scenes");
    expect(raw, "the export contract element is missing").not.toBeNull();

    const scenes = JSON.parse(raw ?? "[]") as Array<{
      sceneNumber: number;
      title: string;
      presenterNotes: string[];
    }>;
    expect(scenes.length).toBeGreaterThan(1);
    for (const scene of scenes) {
      expect(scene.title.length, `scene ${scene.sceneNumber} has no title`).toBeGreaterThan(3);
      expect(
        scene.presenterNotes.length,
        `scene ${scene.sceneNumber} has no presenter notes`,
      ).toBeGreaterThan(0);
    }
  });
});
