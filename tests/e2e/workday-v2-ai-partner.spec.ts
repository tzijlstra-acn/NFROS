/**
 * The AI Partner dock.
 *
 * The dock is a presence rather than a destination, which has a consequence
 * for testing: almost nothing about it can be checked by visiting a page named
 * after it. It has to be checked on the eight routes it rides along with, in
 * both of its two renderings, and against what it claims about its own state.
 *
 * Three of the dock's rules are the product's central honesty claims, and they
 * get the hardest assertions here.
 *
 * Checks and actions are never merged. `checksCompleted` is what was examined
 * and `actionsCompleted` is what was changed, and `recommendedAction` is a
 * third thing again: what is proposed. Blurring them is the one dishonesty
 * this product exists to avoid, so the test asserts three separate headings
 * and three separate lists rather than the presence of the words.
 *
 * Motion requires two conditions. The sheen and the live dot need a real
 * running flag AND a state in which this surface is the one doing the work.
 * An interface that pulses while nothing is happening is lying about work, and
 * it is the easiest lie for an AI product to tell, so the test asserts the
 * absence of motion in the resting state rather than its presence in the
 * running one.
 *
 * Nothing is revealed before validation. A card on screen is a claim that a
 * structured validation passed, so the route level invariant is asserted
 * directly: a response that is not ready carries no suggestion.
 *
 * Where the dock's documented behaviour cannot be reached in the running
 * product the test says so by failing rather than by being deleted. The
 * generation choreography is the main case. See the QA handoff.
 */

import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { ROLE_IDS } from "@/db/schema/core";

/** The eight interactive routes the dock must ride along with. */
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

/** Two roles, which is what the brief asks for on the route sweep. */
const SWEEP_ROLES = ["rcsa", "tprm"] as const;

/** The nine states the dock may report, in their English form. */
const STATE_LABELS = [
  "Monitoring",
  "Checking evidence",
  "Preparing",
  "Ready",
  "Needs you",
  "Executing",
  "Completed",
  "Paused",
  "Offline",
];

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

/**
 * Either rendering of the dock, whichever is mounted.
 *
 * Both carry the same accessible name, which is correct for a screen reader
 * and a trap for a test. At the narrowest width, with the partner open, BOTH
 * are mounted at once: the shell keeps the 48px presence rail in the grid so
 * the column does not collapse, and puts the full dock in a floating panel
 * beside it. A `getByRole("complementary").first()` therefore returns the
 * rail, which has no tabs and no suggestion cards, and every assertion about
 * the dock's contents then fails for a reason that has nothing to do with the
 * dock.
 */
function dockOrRail(page: Page): Locator {
  return page.locator(".app-partner, .app-partner-presence").first();
}

/** The expanded dock specifically, never the presence rail. */
function fullDock(page: Page): Locator {
  return page.locator(".app-partner").first();
}

/**
 * Waits for the client shell to finish adopting the viewport.
 *
 * The shell renders on the server with `narrow` false and the partner open and
 * corrects both after mount. At 1366 the server's defaults disagree with the
 * stylesheet, so for a few frames the full dock is laid out outside the
 * viewport and the presence rail's expand control does not exist yet. A test
 * that asked for the dock in those frames would be measuring the transient,
 * which `workday-v2-visual.spec.ts` already asserts once in a test of its own.
 *
 * Bounded and non asserting, for the same reason as there: one transient must
 * not be reported as a failure on every surface.
 */
async function shellAdopted(page: Page): Promise<void> {
  /*
   * The network first, then the rendering.
   *
   * Routes are opened with `domcontentloaded` so that the first paint
   * measurements in the visual suite stay honest, which means a test that
   * clicks something has to say when it wants a hydrated page. Without this
   * the Chat tab is clicked before its handler exists, the tab does not
   * change, and the composer the test then looks for has never been
   * rendered. At the wider viewports the rendering check below resolves
   * instantly, because the full dock is correct from the server onwards, so
   * this line is the only thing that waits there.
   */
  await page.waitForLoadState("networkidle");
  await page
    .waitForFunction(
      () => {
        /*
         * Which rendering is mounted, not where it sits. The `aside` is laid
         * out inside a 48px grid column, so its own box fits the viewport
         * while its children overflow it; a geometry check here would never
         * wait. At the narrow width the presence rail existing is the signal
         * that the client has adopted the viewport.
         */
        const narrow = window.matchMedia("(max-width: 1366px)").matches;
        if (narrow) return document.querySelector(".app-partner-presence") !== null;
        return document.querySelector(".app-partner, .app-partner-presence") !== null;
      },
      undefined,
      { timeout: 10_000 },
    )
    .catch(() => {});
}

/**
 * Expands the dock when the viewport has collapsed it.
 *
 * At 1366 the shell renders a 48px presence rail so the work object stays the
 * largest region, which is the stated design. A test about the tabs therefore
 * has to open it, using the control the user would use.
 */
async function expandedDock(page: Page): Promise<Locator> {
  await shellAdopted(page);
  const expand = page.getByRole("button", { name: /^(Open the AI Partner|KI Partner oeffnen)$/ });
  if (await expand.isVisible().catch(() => false)) await expand.click();
  const dock = fullDock(page);
  await expect(dock).toBeVisible();
  await expect(dock.getByRole("tab", { name: /^Chat$/ })).toBeVisible();
  return dock;
}

/** Posts a generation request and returns the parsed body. */
async function requestSuggestion(
  request: APIRequestContext,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const response = await request.post("/api/workday/suggestion", { data: body });
  expect(response.status(), `the suggestion route returned HTTP ${response.status()}`).toBeLessThan(
    500,
  );
  return (await response.json()) as Record<string, unknown>;
}

/* ==========================================================================
   Presence
   ========================================================================== */

test.describe("the dock is present everywhere", () => {
  for (const roleId of SWEEP_ROLES) {
    for (const segment of ROUTE_SEGMENTS) {
      test(`${roleId}${segment || " (today)"} carries the partner`, async ({ page }) => {
        await open(page, `/workday/${roleId}${segment}`);
        await requireSeeded(page);
        await shellAdopted(page);

        const dock = dockOrRail(page);
        await expect(dock).toBeVisible();

        /*
         * The collapsed rendering still has to state its state. A collapsed
         * partner that shows nothing reads as a partner that is off, which
         * would make the 1366 projector size tell a different story about the
         * product from the 1920 one.
         */
        const presenceLabel = dock.locator(".app-partner-presence-label");
        if (await presenceLabel.count()) {
          const text = ((await presenceLabel.textContent()) ?? "").trim();
          expect(STATE_LABELS, `the presence rail reads "${text}"`).toContain(text);
        } else {
          await expect(dock.getByRole("tab", { name: /^Chat$/ })).toBeVisible();
        }
      });
    }
  }

  test("the three tabs are Suggestions, Activity and Chat, in that order", async ({ page }) => {
    await open(page, "/workday/rcsa");
    await requireSeeded(page);
    const dock = await expandedDock(page);

    const labels = await dock
      .getByRole("tab")
      .evaluateAll((elements) => elements.map((element) => (element.textContent ?? "").trim()));

    expect(labels.length, `tabs: ${labels.join(", ")}`).toBe(3);
    expect(labels[0]).toMatch(/^Suggestions/);
    expect(labels[1]).toMatch(/^Activity$/);
    /*
     * Chat and not Ask. The brief is explicit that the main conversational
     * capability must not be hidden behind a label that reads like a help
     * affordance, so the wording is a product decision and is asserted.
     */
    expect(labels[2]).toBe("Chat");
  });

  test("the Chat tab is present for every one of the six roles", async ({ page }) => {
    for (const roleId of ROLE_IDS) {
      await open(page, `/workday/${roleId}`);
      await requireSeeded(page);
      const dock = await expandedDock(page);
      await expect(
        dock.getByRole("tab", { name: /^Chat$/ }),
        `${roleId} has no Chat tab`,
      ).toBeVisible();
    }
  });
});

/* ==========================================================================
   State and motion
   ========================================================================== */

test.describe("the reported state", () => {
  test("is one of the nine states and is accompanied by a detail line", async ({ page }) => {
    await open(page, "/workday/rcsa");
    await requireSeeded(page);
    const dock = await expandedDock(page);

    const header = dock.locator(".app-partner-head");
    const text = ((await header.textContent()) ?? "").trim();
    const named = STATE_LABELS.filter((label) => text.includes(label));
    expect(named.length, `the header reads "${text}" and names no known state`).toBeGreaterThan(0);

    // The autonomy level and the demo mode live here, not in the top bar,
    // because they are contextually relevant to the thing they govern.
    await expect(header.getByText(/^(Autonomy|Autonomie)$/)).toBeVisible();
    await expect(header.getByText(/^(Mode|Modus)$/)).toBeVisible();
  });

  test("announces the mode exactly once", async ({ page }) => {
    await open(page, "/workday/rcsa");
    await requireSeeded(page);
    const dock = await expandedDock(page);

    /*
     * `textContent` deliberately, not the visible text. The mode is displayed
     * once and announced twice: the `Dot` primitive puts its `label` in an
     * `app-sr-only` span and the header then renders the same string again as
     * visible text beside it. So this is about what a screen reader hears,
     * which is "Mode Presenter safe Presenter safe", and not about what the
     * header looks like, which is correct.
     */
    const header = ((await dock.locator(".app-partner-head").textContent()) ?? "").trim();
    const occurrences = (header.match(/Presenter safe|Offline|Live/g) ?? []).length;
    expect(
      occurrences,
      `the accessible text of the partner header reads "${header}", which states the mode ${occurrences} times`,
    ).toBe(1);
  });

  test("does not animate while nothing is running", async ({ page }) => {
    await open(page, "/workday/rcsa");
    await requireSeeded(page);
    await expandedDock(page);

    /*
     * Both animated things require a real running flag AND a state in which
     * this surface is the one doing the work. With no generation in flight
     * there must be neither, because a dock that pulses at rest is
     * advertising work it has not begun.
     *
     * Matched on `="true"` rather than on the attribute existing. React
     * serialises `data-running={false}` as the string "false", so the
     * attribute is present on every mark whether or not it is animating, and
     * the stylesheet keys on the value. A presence match here would report
     * every resting dock as animating, which is the opposite error.
     */
    expect(
      await page.locator('.app-partner .app-sheen[data-running="true"]').count(),
      "the dock sheen is animating while nothing is running",
    ).toBe(0);
    expect(
      await page.locator('.app-partner .app-dot[data-live="true"]').count(),
      "the dock live dot is animating while nothing is running",
    ).toBe(0);
  });
});

/* ==========================================================================
   A suggestion card
   ========================================================================== */

test.describe("a suggestion card", () => {
  /** The first card in the dock, whichever role has one. */
  async function firstCard(page: Page): Promise<Locator> {
    const dock = await expandedDock(page);
    const card = dock.locator(".app-suggestion").first();
    if (!(await card.isVisible().catch(() => false))) {
      test.skip(true, "No validated suggestion exists for this role at the current moment.");
    }
    return card;
  }

  test("answers the six questions in order", async ({ page }) => {
    await open(page, "/workday/tprm");
    await requireSeeded(page);
    const card = await firstCard(page);

    const order = [
      /^(What changed|Was sich geaendert hat)$/,
      /^(Why it matters|Warum das wichtig ist)$/,
      /^(What I checked|Was ich geprueft habe)$/,
      /^(What I already did|Was ich bereits getan habe)$/,
      /^(What I recommend|Was ich empfehle)$/,
      /^(What I need from you|Was ich von Ihnen brauche)$/,
    ];
    for (const heading of order) {
      await expect(card.getByText(heading).first(), `the card omits ${heading}`).toBeVisible();
    }

    /*
     * Plus the honesty furniture: the confidence band, the stated uncertainty
     * and the authority class the action would be taken under. The confidence
     * figure is a chip carrying the word as a band ("Moderate confidence")
     * with the number beside it in mono and the label on the title, rather
     * than a visible "Confidence:" prefix, so the match is on the band.
     */
    await expect(card.getByText(/\bconfidence\b|\bKonfidenz\b/i).first()).toBeVisible();
    await expect(card.locator('[title="Confidence"], [title="Konfidenz"]').first()).toBeAttached();
    await expect(card.getByText(/^(Uncertainty|Unsicherheit)$/).first()).toBeVisible();
  });

  test("renders what was checked and what was changed as two distinct lists", async ({ page }) => {
    await open(page, "/workday/tprm");
    await requireSeeded(page);
    const card = await firstCard(page);

    /*
     * The structural assertion, not a textual one. Both headings existing is
     * not enough: they have to head different lists, because a single list
     * under two headings is exactly the merge the rule forbids.
     */
    const shape = await card.evaluate((element) => {
      const headingFor = (needle: string): Element | null => {
        for (const candidate of Array.from(element.querySelectorAll("span, div"))) {
          if ((candidate.textContent ?? "").trim() === needle) return candidate;
        }
        return null;
      };
      const listAfter = (heading: Element | null): Element | null => {
        if (heading === null) return null;
        const container = heading.parentElement;
        return container?.querySelector("ul") ?? null;
      };
      const checked = headingFor("What I checked");
      const did = headingFor("What I already did");
      const checkedList = listAfter(checked);
      const didList = listAfter(did);
      return {
        hasCheckedHeading: checked !== null,
        hasDidHeading: did !== null,
        hasCheckedList: checkedList !== null,
        hasDidList: didList !== null,
        sameList: checkedList !== null && checkedList === didList,
        checkedItems: checkedList?.querySelectorAll("li").length ?? 0,
        didItems: didList?.querySelectorAll("li").length ?? 0,
      };
    });

    expect(shape.hasCheckedHeading, "the card has no What I checked heading").toBe(true);
    expect(shape.hasDidHeading, "the card has no What I already did heading").toBe(true);
    expect(
      shape.sameList,
      "what was examined and what was changed share one list, which merges two different facts",
    ).toBe(false);
    expect(
      shape.checkedItems,
      "the checks list is empty although the card claims checks were made",
    ).toBeGreaterThan(0);
  });

  test("makes cited evidence reachable without leaving the workday", async ({ page }) => {
    await open(page, "/workday/tprm");
    await requireSeeded(page);
    const card = await firstCard(page);

    const citation = card.getByRole("button", { name: /^EVD-\d{4}-\d+$/ }).first();
    if (!(await citation.isVisible().catch(() => false))) {
      test.skip(true, "This suggestion cites no evidence document.");
    }

    await citation.click();

    /*
     * Evidence opens in the context drawer rather than navigating away, which
     * is a stated requirement: it must remain one click away and must not
     * cost the user their place in the list they were reading.
     */
    await expect(page.getByRole("dialog", { name: /^(Context|Kontext)$/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /^Evidence/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(page.url(), "opening evidence navigated away from the workday").toContain("/workday/");
    await page.keyboard.press("Escape");
  });

  test("offers one primary action and an overflow menu, and Approve is not a shortcut", async ({
    page,
  }) => {
    await open(page, "/workday/tprm");
    await requireSeeded(page);
    const card = await firstCard(page);

    await expect(card.getByRole("button", { name: /^(More actions|Weitere Aktionen)$/ })).toBeVisible();

    const approve = card.getByRole("button", { name: /^(Approve|Genehmigen)$/ });
    if (!(await approve.isVisible().catch(() => false))) {
      test.skip(true, "This suggestion's authority class offers no Approve action.");
    }

    /*
     * Approve routes to the decision flow, where the rationale and the
     * confirmation that the rationale is the accountable person's own are
     * captured. A one click Approve on a card would bypass the single most
     * important control in the product, so the test asserts where it lands.
     */
    await expect(
      card.getByText(/Approving opens the decision record\. Nothing is sent before you confirm there\./),
    ).toBeVisible();

    await approve.click();
    await expect(page).toHaveURL(/\/workday\/tprm\/decisions/);

    /*
     * And it lands on an unanswered question. The decision flow does not
     * render the rationale field, the confirmation or the submit control
     * until an option has been chosen, so arriving here with no option
     * pressed and no submit control on screen is the correct evidence that
     * Approve routed to the gate rather than through it.
     */
    const flow = page.locator("article.panel").first();
    await expect(flow).toBeVisible();
    const pressed = await flow
      .locator("button[aria-pressed]")
      .evaluateAll(
        (elements) => elements.filter((element) => element.getAttribute("aria-pressed") === "true").length,
      );
    expect(pressed, "arriving from Approve pre-selected an option for the user").toBe(0);
    expect(
      await page.getByRole("button", { name: /Approve and execute|Genehmigen und ausfuehren/ }).count(),
      "Approve on a card carried the user to an armed execute control",
    ).toBe(0);
  });
});

/* ==========================================================================
   The activity stream and the receipt
   ========================================================================== */

test.describe("the activity stream", () => {
  test("is chronological, grouped by moment, with detail behind an expand", async ({ page }) => {
    await open(page, "/workday/rcsa");
    await requireSeeded(page);
    const dock = await expandedDock(page);

    await dock.getByRole("tab", { name: /^Activity$/ }).click();
    const panel = page.locator("#panel-activity");
    await expect(panel).toBeVisible();

    const rows = panel.locator(".app-activity-row");
    const count = await rows.count();
    if (count === 0) test.skip(true, "No activity is recorded for this role at this moment.");

    // Compact to a time and a label by default. The object, the step, the
    // duration, the outcome, the authority class and the audit reference are
    // what keep the default view readable by staying behind the expand.
    const first = rows.first();
    await expect(first).toHaveAttribute("aria-expanded", "false");
    await first.click();
    await expect(first).toHaveAttribute("aria-expanded", "true");
    const detailId = await first.getAttribute("aria-controls");
    expect(detailId, "the expandable row controls nothing").toBeTruthy();
    await expect(page.locator(`#${detailId}`)).toBeVisible();

    // Chronological. The moments on the rows must not decrease.
    const moments = await panel
      .locator(".app-activity-time, .app-data")
      .evaluateAll((elements) =>
        elements
          .map((element) => (element.textContent ?? "").trim())
          .filter((text) => /^\d{2}:\d{2}$/.test(text)),
      );
    const sorted = [...moments].sort();
    expect(moments, "the activity stream is not in chronological order").toStrictEqual(sorted);
  });
});

/* ==========================================================================
   Chat
   ========================================================================== */

test.describe("the chat", () => {
  test("offers at most three contextual prompts and the stated placeholder", async ({ page }) => {
    await open(page, "/workday/rcsa");
    await requireSeeded(page);
    const dock = await expandedDock(page);
    await dock.getByRole("tab", { name: /^Chat$/ }).click();

    await expect(dock.getByRole("textbox", { name: /Ask about the current work/ })).toBeVisible();

    const prompts = dock.locator(".app-prompt-chips button");
    const count = await prompts.count();
    /*
     * The cap is a rule about the surface rather than a detail of one
     * function, which is why it is applied in the selector and again in the
     * composer. Four chips would mean one of the two stopped working.
     */
    expect(count, "the composer offers more than three contextual prompts").toBeLessThanOrEqual(3);
  });

  test("keeps the conversation when the user navigates to another work object", async ({ page }) => {
    await open(page, "/workday/rcsa");
    await requireSeeded(page);
    const dock = await expandedDock(page);
    await dock.getByRole("tab", { name: /^Chat$/ }).click();

    const prompt = dock.locator(".app-prompt-chips button").first();
    if (!(await prompt.isVisible().catch(() => false))) {
      test.skip(true, "No contextual prompt is offered, so there is no cheap way to start a turn.");
    }
    const asked = ((await prompt.textContent()) ?? "").trim();
    await prompt.click();

    /*
     * Matched on the question rather than on the answer, deliberately. The
     * user's own turn is written into the transcript immediately and does not
     * depend on the answer arriving, so this is the weakest possible claim
     * about continuity: not "the answer survived" but "the question the user
     * typed survived". If that is lost, everything above it is too.
     */
    const transcript = dock.locator(".app-partner-body");
    await expect(transcript.getByText(asked, { exact: false }).first()).toBeVisible({
      timeout: 45_000,
    });

    /*
     * Now move to a different work object inside the same role. The dock is
     * documented as holding the thread itself so that it survives a tab
     * change, a collapse to the presence rail and navigation between work
     * objects, and the reason given is that nothing is remounted. If the
     * transcript is empty after this, the thread did not survive.
     */
    await page.getByRole("navigation", { name: /^(Work areas|Arbeitsbereiche)$/ }).getByRole("link", { name: /^Workbench/ }).click();
    await expect(page).toHaveURL(/\/workbench(\?.*)?$/);
    const moved = await expandedDock(page);
    await moved.getByRole("tab", { name: /^Chat$/ }).click();

    await expect(
      moved.locator(".app-partner-body").getByText(asked, { exact: false }).first(),
      "the conversation was lost when the user moved to another work object",
    ).toBeVisible({ timeout: 15_000 });
  });
});

/* ==========================================================================
   Generation
   ========================================================================== */

test.describe("generation", () => {
  test("offers no Generate button anywhere in the dock", async ({ page }) => {
    await open(page, "/workday/rcsa");
    await requireSeeded(page);
    const dock = await expandedDock(page);

    /*
     * The brief is explicit: preparation is automatic and `refresh` is the
     * only manual control. A Generate button would move the product back to
     * the thing it is arguing against, which is a person asking a tool to
     * start working.
     */
    const generate = dock.getByRole("button", { name: /^(Generate|Erzeugen|Run|Start)$/ });
    expect(await generate.count(), "the dock offers a manual Generate control").toBe(0);
  });

  test("publishes the stages in order, with validation before ready", async ({ request }) => {
    const body = await requestSuggestion(request, {
      roleId: "rcsa",
      objectType: "risk",
      objectId: "RSK-0211",
    });
    const generation = body.generation as { state: string; completedStages: string[] } | undefined;
    expect(generation, "the route returned no generation state").toBeTruthy();

    const stages = generation?.completedStages ?? [];
    expect(stages.length, `stages: ${stages.join(", ")}`).toBeGreaterThan(3);

    /*
     * A suggestion is published only after structured validation succeeds, so
     * `validating` must appear and must appear before `ready`. A stage list
     * that reached ready without validating would mean the gate was skipped.
     */
    const validating = stages.indexOf("validating");
    const ready = stages.indexOf("ready");
    expect(validating, `stages: ${stages.join(", ")}`).toBeGreaterThanOrEqual(0);
    if (ready >= 0) expect(validating).toBeLessThan(ready);
  });

  test("returns no suggestion unless the run reached ready", async ({ request }) => {
    /*
     * The reveal invariant, asserted at the seam rather than in the component.
     * The read model filters on `validated_at`, so an unvalidated row cannot
     * reach the interface even if something upstream wrote one, and a
     * response that is not ready must therefore carry nothing to render.
     */
    for (const target of [
      { roleId: "rcsa", objectType: "risk", objectId: "RSK-0211" },
      { roleId: "tprm", objectType: "supplier", objectId: "TP-0042" },
      { roleId: "rcsa", objectType: "supplier", objectId: "TP-NOT-A-REAL-SUPPLIER" },
    ]) {
      const body = await requestSuggestion(request, target);
      const generation = body.generation as { state: string } | undefined;
      if (generation?.state !== "ready") {
        expect(
          body.suggestion,
          `${target.objectId} returned a suggestion while the run was "${generation?.state}"`,
        ).toBeNull();
      }
    }
  });

  test("a repeated refresh replaces the prepared suggestion rather than adding another", async ({
    request,
  }) => {
    /*
     * `refresh` is the product's only manual control, and `onRetryGeneration`
     * in `PartnerClient` passes it, so this is what the retry control does.
     * Pressing retry twice must not leave two cards in the dock saying the
     * same thing: the deduplication the design describes keys on a digest of
     * the whole input state, so an unchanged state has to resolve to one row.
     *
     * This test is also why the two channel tests below leave rows behind.
     * They pass `refresh` deliberately, because without it the pipeline does
     * not run and there would be no stages to listen for.
     */
    const first = (await requestSuggestion(request, {
      roleId: "rcsa",
      objectType: "risk",
      objectId: "RSK-0211",
      refresh: true,
    }).then((body) => body.suggestion)) as { id?: string } | null;

    const second = (await requestSuggestion(request, {
      roleId: "rcsa",
      objectType: "risk",
      objectId: "RSK-0211",
      refresh: true,
    }).then((body) => body.suggestion)) as { id?: string } | null;

    expect(first?.id, "the first refresh returned no suggestion").toBeTruthy();
    expect(second?.id, "the second refresh returned no suggestion").toBeTruthy();
    expect(
      second?.id,
      `two refreshes of an unchanged state produced ${first?.id} and ${second?.id}, so every press of the retry control adds a card`,
    ).toBe(first?.id);
  });

  test("reports a failure as a failure, with a retry flag the dock can act on", async ({
    request,
  }) => {
    const body = await requestSuggestion(request, {
      roleId: "rcsa",
      objectType: "supplier",
      objectId: "TP-NOT-A-REAL-SUPPLIER",
    });

    // The product never pretends. A request that produced nothing says so and
    // names what remains usable.
    expect(body.error, "a request for a nonexistent object reported no error").toBeTruthy();
    expect(typeof body.retryable, "the failure carries no retry flag").toBe("boolean");

    /*
     * And the generation state has to carry the failure, because that is the
     * field the dock reads to decide whether to show "Suggestion unavailable"
     * and the retry control. A failure reported only in a sibling field
     * leaves the dock rendering a resting state over a run that failed.
     */
    const generation = body.generation as { state: string } | undefined;
    expect(
      generation?.state,
      `the route reported an error but set generation.state to "${generation?.state}"`,
    ).toBe("error");
  });

  /**
   * Listens on the workday channel for a few seconds while a generation runs.
   *
   * `named` subscribes to every kind in the contract by name, which is how the
   * route actually frames its payloads. `bare` subscribes only to `message`,
   * which is what the dock's own bridge does. Collecting both in one
   * connection pass is what separates "the channel says nothing" from "the
   * dock cannot hear it".
   */
  async function listenWhileGenerating(
    page: Page,
  ): Promise<{ named: string[]; bare: string[] }> {
    return page.evaluate(async () => {
      const named: string[] = [];
      const bare: string[] = [];
      const kinds = [
        "scenario.time.changed",
        "scenario.event.arrived",
        "data.load.changed",
        "stream.heartbeat",
        "agent.run.started",
        "agent.stage.changed",
        "agent.tool.completed",
        "agent.suggestion.ready",
        "agent.suggestion.failed",
        "mutation.completed",
        "approval.required",
        "integration.command.changed",
      ];

      const source = new EventSource("/api/workday/events?roleId=tprm");
      const record = (bucket: string[]) => (event: Event) => {
        const data = (event as MessageEvent<string>).data;
        try {
          const parsed = JSON.parse(data) as { kind?: string };
          if (typeof parsed.kind === "string") bucket.push(parsed.kind);
        } catch {
          // A frame that is not JSON is the channel's problem, not this test's.
        }
      };
      for (const kind of kinds) source.addEventListener(kind, record(named));
      source.addEventListener("message", record(bare));

      await new Promise((resolve) => window.setTimeout(resolve, 1_500));
      await fetch("/api/workday/suggestion", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          roleId: "tprm",
          objectType: "supplier",
          objectId: "TP-0042",
          refresh: true,
        }),
      });
      await new Promise((resolve) => window.setTimeout(resolve, 7_000));
      source.close();
      return { named, bare };
    });
  }

  test("the event channel publishes the partner stages", async ({ page }) => {
    await open(page, "/workday/tprm");
    await requireSeeded(page);

    /*
     * The dock's whole liveness contract is the channel. It consumes
     * `agent.run.started`, `agent.stage.changed`, `agent.tool.completed`,
     * `agent.suggestion.ready`, `agent.suggestion.failed` and
     * `mutation.completed`, and with none of those arriving the generation
     * view can never hold a slot, no suggestion ever arrives live, and the
     * progressive reveal and the failure fallback are unreachable.
     */
    const { named } = await listenWhileGenerating(page);

    expect(
      named.length,
      "the channel published nothing at all, so it is not connected",
    ).toBeGreaterThan(0);

    const partnerKinds = Array.from(new Set(named.filter((kind) => kind.startsWith("agent."))));
    expect(
      partnerKinds,
      `the channel published ${JSON.stringify(Array.from(new Set(named)))} during a generation run and no agent stage event, so the generation choreography can never reach the dock`,
    ).not.toStrictEqual([]);
  });

  test("the dock's own subscription receives what the channel publishes", async ({ page }) => {
    await open(page, "/workday/tprm");
    await requireSeeded(page);

    const { named, bare } = await listenWhileGenerating(page);

    /*
     * The bridge in `PartnerClient.useWorkdaySubscribe` registers exactly one
     * listener, for `message`. The route frames every payload with an
     * `event:` line naming its kind, and a server sent event that names its
     * type is dispatched under that name and never as `message`. So a
     * connection that receives named frames and nothing on `message` means
     * the dock holds an open socket it can never hear.
     *
     * The live day's own hook gets this right: it registers a listener per
     * kind and keeps `onmessage` as well, and says in a comment that a bare
     * `onmessage` would not be enough. The partner bridge did not.
     */
    expect(
      named.length,
      "nothing arrived on any named kind, so this test cannot tell the two cases apart",
    ).toBeGreaterThan(0);
    expect(
      bare.length,
      `${named.length} frames arrived on named kinds and ${bare.length} on "message", which is the only listener the dock registers`,
    ).toBeGreaterThan(0);
  });
});
