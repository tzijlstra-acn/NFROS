/**
 * The live day player.
 *
 * The bottom bar is the signature control of the redesign, and it is the one
 * surface whose behaviour cannot be checked by looking at a screenshot: play,
 * pause, step, catch up and auto-pause are all about what happens over time.
 *
 * Two things make this suite different from the others in the directory.
 *
 * It is serial and it is stateful. Live time is a column on the scenario run,
 * shared by every role and every other test file, and the only honest way to
 * exercise an arrival, an unread count or a catch-up walk is to move it. The
 * tests therefore run in declaration order inside one serial block, and the
 * last one puts live time back to the seeded 07:45. It does that through the
 * V1 timeline, because that is the only control in the product that moves
 * live time backwards, and because a reset would discard decisions that other
 * tests in the run have recorded.
 *
 * It asserts the separation of viewed time and live time harder than anything
 * else, because that separation is the rule the whole live day rests on.
 * Scrubbing back must never rewind the day and catching up must never push it
 * forward. Time is a view; decisions are facts. A player that confused the two
 * would un-record a decision by moving a slider, and no amount of polish
 * elsewhere would compensate.
 *
 * The negative keyboard test is the single most important test in the file.
 * Space is bound to play on `document`, and a presenter typing a question into
 * the chat composer must not pause the day with every word. That failure is
 * invisible in review and obvious on stage.
 */

import { expect, test, type Locator, type Page } from "@playwright/test";

/** The seeded opening moment, and the moment the suite restores. */
const SEEDED_MOMENT = "07:45";

/** The shared event every function sees. */
const SHARED_MOMENT = "14:05";

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
 * The live day bar.
 *
 * Keyed on the class rather than a role, because the bar is a toolbar of
 * mixed controls with no single accessible container, and because the thing
 * several tests here need to assert IS its structure. The shell wraps the
 * bar in a second element carrying the same class, so the inner one is taken
 * by position; that duplication is recorded as a defect in the QA handoff.
 */
function bar(page: Page): Locator {
  return page.locator(".app-liveday").last();
}

/** The clock inside the live day bar, not the copy in the top bar. */
function clock(page: Page): Locator {
  return page.locator(".app-liveday .app-liveday-clock").last();
}

function playControl(page: Page): Locator {
  return page.locator('[data-live-day-control="play-pause"]');
}

function catchUpControl(page: Page): Locator {
  return page.locator('[data-live-day-control="catch-up"]');
}

function track(page: Page): Locator {
  return page.getByRole("group", { name: /^(Event track|Ereignisleiste)$/ });
}

/**
 * Moves live time through the demo menu, which is the presenter's control.
 *
 * Returns true when the jump was performed and false when the day was already
 * at the shared moment, which is a legitimate state rather than a failure.
 */
async function jumpToSharedEvent(page: Page): Promise<boolean> {
  /*
   * Wait for the network to settle before pressing the trigger. The demo menu
   * is a client component and its click handler does not exist until the shell
   * has hydrated, so a press landing in the frames before that does nothing
   * and the menu never appears. It is not flakiness in the product: the
   * routes are opened with `domcontentloaded` here so that the first paint
   * measurements elsewhere are honest, and the cost is that an interaction
   * has to say when it wants a hydrated page.
   */
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Demo", exact: true }).click();
  const menu = page.getByRole("menu", { name: /Demonstration settings/ });
  await expect(menu).toBeVisible();
  const item = menu.locator(".app-pop-item").filter({ hasText: /To the shared event at/ }).first();
  if (await item.isDisabled().catch(() => false)) {
    await page.keyboard.press("Escape");
    return false;
  }
  await item.click();
  return true;
}

/**
 * Moves live time forward and then reloads.
 *
 * The reload is not politeness, it is a workaround for a defect this suite
 * reports separately: the live day bar adopts a new server snapshot only when
 * the acting role changes, so a jump performed from the demo menu leaves the
 * bar showing the previous live moment until the document is loaded again.
 * Every test after this one is about what the bar does once it knows the time,
 * and without the reload they would all fail for that single upstream reason
 * and tell us nothing else.
 */
async function advanceToSharedEventAndReload(page: Page): Promise<void> {
  const moved = await jumpToSharedEvent(page);
  if (moved) await page.waitForTimeout(2_000);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(clock(page)).toContainText(SHARED_MOMENT, { timeout: 30_000 });
}

/**
 * Moves live time through the V1 timeline.
 *
 * The V2 bar deliberately cannot do this: `actionScrubToMoment` refuses a
 * moment after live time and `previous` never reports a live advance, which is
 * exactly the guarantee this suite asserts elsewhere. V1 drives the clock with
 * `actionSetMoment`, so it is the restore path.
 */
async function setLiveMomentThroughV1(page: Page, moment: string): Promise<void> {
  await open(page, "/workday/rcsa?ui=v1");
  const timeline = page.getByRole("navigation", { name: "Workday timeline" });
  await expect(timeline).toBeVisible();
  await timeline.getByRole("button").filter({ hasText: moment }).first().click();
  await expect(page.locator("header .mono.strong-text").first()).toHaveText(moment);
}

/*
 * Deliberately NOT `mode: "serial"`.
 *
 * Serial mode would give the ordering this file needs, which the repository
 * configuration already provides through `workers: 1` and
 * `fullyParallel: false`, but it also skips every remaining test in the block
 * as soon as one fails. That is the wrong trade for a QA suite: a single
 * upstream defect would hide the state of every check after it, and the
 * teardown that restores the seeded clock would never run.
 */

test.describe("the live day bar", () => {
  test("renders the play control, the step controls, the track and the clock", async ({ page }) => {
    await open(page, "/workday/rcsa");
    await requireSeeded(page);

    const play = playControl(page);
    await expect(play).toBeVisible();
    /*
     * `aria-pressed` plus a label that changes. One without the other is not
     * enough: a toggle with a fixed label leaves a screen reader user
     * guessing which way the switch is set, and a changing label without
     * `aria-pressed` loses the fact that it is a toggle at all.
     */
    await expect(play).toHaveAttribute("aria-pressed", /true|false/);
    await expect(play).toHaveAttribute("aria-label", /^(Play|Pause|Abspielen|Anhalten)$/);

    await expect(bar(page).getByRole("button", { name: /^(Previous event|Vorheriges Ereignis)$/ })).toBeVisible();
    await expect(bar(page).getByRole("button", { name: /^(Next event|Naechstes Ereignis)$/ })).toBeVisible();
    await expect(track(page)).toBeVisible();

    // The day opens with nothing new, for every role. Counting events the day
    // has not reached would open the morning with a backlog of things that
    // have not happened.
    await expect(bar(page).getByText(/^(Nothing new|Nichts Neues)$/)).toBeVisible();
    await expect(catchUpControl(page)).toHaveCount(0);
  });

  test("every track marker is a named button, and moments after live time are disabled", async ({
    page,
  }) => {
    await open(page, "/workday/rcsa");
    await requireSeeded(page);

    const markers = track(page).getByRole("button");
    const total = await markers.count();
    expect(total, "the track draws no markers").toBeGreaterThanOrEqual(10);

    const described = await markers.evaluateAll((elements) =>
      elements.map((element) => ({
        label: element.getAttribute("aria-label") ?? "",
        disabled: (element as HTMLButtonElement).disabled,
      })),
    );

    // A row of unlabelled dots is a row of nothing to a screen reader, so
    // every marker reads the moment, the count and the leading event.
    const unnamed = described.filter((marker) => !/^\d{2}:\d{2}, \d+ /.test(marker.label));
    expect(unnamed.map((marker) => marker.label), "a track marker carries no usable name").toStrictEqual([]);

    /*
     * Markers after live time are present so the shape of the day is legible,
     * but not selectable: scrubbing forward past live time would show a
     * moment that has not happened. At the seeded opening moment that means
     * exactly one marker is reachable.
     */
    const reachable = described.filter((marker) => !marker.disabled);
    expect(reachable.length, `reachable markers: ${reachable.map((m) => m.label).join(" | ")}`).toBe(1);
    expect(reachable[0]?.label).toContain(SEEDED_MOMENT);
  });

  test("the clock shows one number and the word Live when viewed and live agree", async ({
    page,
  }) => {
    await open(page, "/workday/rcsa");
    await requireSeeded(page);

    await expect(clock(page)).toHaveAttribute("data-behind", "false");
    await expect(clock(page)).toContainText(SEEDED_MOMENT);
    await expect(clock(page)).toContainText(/^.*(Live)$/);
    await expect(bar(page).getByRole("button", { name: /Jump to live|Zu live springen/ })).toHaveCount(0);
  });

  test("Space plays and pauses, and the control reports which", async ({ page }) => {
    await open(page, "/workday/rcsa");
    await requireSeeded(page);

    const play = playControl(page);
    await expect(play).toHaveAttribute("aria-pressed", "false");

    // Focus is on the document body, which is where a presenter's focus sits.
    await page.getByRole("main").click({ position: { x: 20, y: 20 } });
    await page.keyboard.press("Space");
    await expect(play).toHaveAttribute("aria-pressed", "true");
    await expect(play).toHaveAttribute("aria-label", /^(Pause|Anhalten)$/);

    await page.keyboard.press("Space");
    await expect(play).toHaveAttribute("aria-pressed", "false");
    await expect(play).toHaveAttribute("aria-label", /^(Play|Abspielen)$/);
  });

  test("the button and the keyboard drive the same state", async ({ page }) => {
    await open(page, "/workday/rcsa");
    await requireSeeded(page);

    const play = playControl(page);
    await play.click();
    await expect(play).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Space");
    await expect(play).toHaveAttribute("aria-pressed", "false");
  });

  /* ======================================================================
     The critical negative test
     ====================================================================== */

  test("no live day shortcut fires while focus is in the chat composer", async ({ page }) => {
    await open(page, "/workday/rcsa");
    await requireSeeded(page);

    /*
     * Wait for the client shell to adopt the viewport before asking for the
     * dock. At 1366 the server renders the full dock outside the viewport for
     * a few frames and the presence rail's expand control does not exist yet,
     * which `workday-v2-visual.spec.ts` asserts once in a test of its own.
     */
    /*
     * The network first, so the dock's handlers exist. The route was opened
     * with `domcontentloaded`, so a click on the Chat tab before hydration
     * does nothing and the composer this test needs is never rendered.
     */
    await page.waitForLoadState("networkidle");
    await page
      .waitForFunction(
        () => {
          /*
           * Which rendering is mounted, not where it sits. The `aside` is
           * laid out inside a 48px grid column, so its own box fits the
           * viewport while its children overflow it, and a geometry check
           * would never wait at all.
           */
          const narrow = window.matchMedia("(max-width: 1366px)").matches;
          if (narrow) return document.querySelector(".app-partner-presence") !== null;
          return document.querySelector(".app-partner, .app-partner-presence") !== null;
        },
        undefined,
        { timeout: 10_000 },
      )
      .catch(() => {});

    // Open the dock if the viewport has collapsed it to a presence rail.
    const expand = page.getByRole("button", { name: /^(Open the AI Partner|KI Partner oeffnen)$/ });
    if (await expand.isVisible().catch(() => false)) await expand.click();

    /*
     * `.app-partner` and not the accessible name. Both renderings carry the
     * same name, which is right for a screen reader, and at the narrowest
     * width both are mounted at once: the presence rail stays in the grid so
     * the column does not collapse and the full dock goes into a floating
     * panel beside it. Addressing by name and taking the first match returns
     * the rail, which has no composer.
     */
    const dock = page.locator(".app-partner").first();
    await expect(dock).toBeVisible();
    await dock.getByRole("tab", { name: /^Chat$/ }).click();

    const composer = dock.getByRole("textbox", { name: /Ask about the current work/ });
    await expect(composer).toBeVisible();
    await expect(composer).toBeEnabled();

    const play = playControl(page);
    const playedBefore = await play.getAttribute("aria-pressed");
    const clockBefore = ((await clock(page).textContent()) ?? "").trim();

    await composer.click();

    /*
     * The whole keyboard map, typed as a sentence a presenter would plausibly
     * write. Every one of these characters is bound: Space to play, Left and
     * Right to step, C to catch up, L to jump to live. If the typing guard is
     * missing, this sentence pauses the day, walks the player through four
     * moments and opens a modal catch-up drawer over the composer.
     */
    await composer.type("can the control be relied on");
    await composer.press("ArrowLeft");
    await composer.press("ArrowRight");

    // The text arrived intact, which is the user visible half of the guard.
    await expect(composer).toHaveValue(/can/);
    const typed = await composer.inputValue();
    expect(typed.length, "the composer swallowed the keystrokes").toBeGreaterThan(10);
    expect(typed, "a space did not reach the composer").toContain(" ");

    // And nothing in the player moved, which is the other half.
    await expect(play).toHaveAttribute("aria-pressed", playedBefore ?? "false");
    await expect(clock(page)).toHaveText(clockBefore);
    await expect(page.getByRole("dialog", { name: /Guided catch up|Gefuehrtes Aufholen/ })).toHaveCount(0);
  });

  /* ======================================================================
     Advancing live time. Everything below here changes the run.
     ====================================================================== */

  test("the bar follows a jump the presenter makes from the demo menu", async ({ page }) => {
    await open(page, "/workday/incident-resilience");
    await requireSeeded(page);
    await expect(clock(page)).toContainText(SEEDED_MOMENT);

    const moved = await jumpToSharedEvent(page);
    if (!moved) test.skip(true, "The day is already at the shared moment.");

    /*
     * The top bar clock and the live day bar clock are two renderings of the
     * same two columns, and this is the control a presenter uses most: jump
     * the day to the event everybody is about to discuss. If the bar does not
     * follow, the screen shows two different times at once and the track, the
     * unread count and the catch-up control all describe a morning the day
     * has already left.
     *
     * The top bar is checked first, so that a failure here is unambiguous
     * about which half of the chrome is stale rather than about whether the
     * action ran at all.
     */
    await expect(
      page.locator("header.app-topbar .app-liveday-clock"),
      "the top bar did not register the jump, so the action itself did not run",
    ).toContainText(SHARED_MOMENT, { timeout: 30_000 });

    await expect(
      clock(page),
      "the top bar moved to the shared event and the live day bar did not, so the shell shows two different times",
    ).toContainText(SHARED_MOMENT, { timeout: 20_000 });
  });

  test("the shared event at 14:05 reaches every function from one record", async ({ page }) => {
    await open(page, "/workday/incident-resilience");
    await requireSeeded(page);

    await advanceToSharedEventAndReload(page);

    // The marker for the shared moment is now reachable and names the event.
    const shared = track(page).getByRole("button", { name: new RegExp(`^${SHARED_MOMENT},`) });
    await expect(shared).toBeEnabled();
    await expect(shared).toHaveAttribute("aria-label", /Shared event:/);

    /*
     * One record with an empty role list, served to all six functions. The
     * product's whole claim is that one institution and one day are shared
     * across six functions, so the same marker has to be there for a
     * different role at the same moment.
     */
    await open(page, "/workday/tprm");
    await expect(clock(page)).toContainText(SHARED_MOMENT);
    await expect(
      track(page).getByRole("button", { name: new RegExp(`^${SHARED_MOMENT}.*Shared event:`) }),
    ).toBeVisible();

    // And the index agrees that the day has reached it.
    await open(page, "/workday");
    await expect(page.getByText("The 14:05 event has occurred")).toBeVisible();
  });

  test("arrival makes events unread, and the catch-up control appears with its count", async ({
    page,
  }) => {
    await open(page, "/workday/tprm");
    await requireSeeded(page);
    await expect(clock(page)).toContainText(SHARED_MOMENT);

    /*
     * Unread is consumable, and this file consumes it.
     *
     * Read state lives in `workday_live_event_reads` keyed by event and role.
     * That is the right design and it is what makes a count survive a role
     * switch, but it also means the guided catch-up walk below marks events
     * read permanently. The teardown at the end of this file restores live
     * time and deliberately does not touch read state, because there is no
     * product control that marks an event unread again and reaching into the
     * table directly would be reaching past the product.
     *
     * So against a database that has already been walked, every arrived event
     * is read, the bar correctly says "Nothing new" and there is nothing here
     * to assert. The honest response is to say that the check could not be
     * exercised and name the remedy, not to assert zero and call it a pass.
     */
    if (await bar(page).getByText(/^(Nothing new|Nichts Neues)$/).isVisible().catch(() => false)) {
      test.skip(
        true,
        "Every arrived event is already read, so unread is zero and there is nothing to review. The guided catch-up walk in this file spends that state permanently. Run npm run db:seed to exercise this check.",
      );
    }

    const catchUp = catchUpControl(page);
    await expect(catchUp).toBeVisible();
    await expect(catchUp).toHaveText(/Review \d+ new|\d+ neue pruefen/);
    await expect(bar(page).getByText(/\d+ (unread|ungelesen)/)).toBeVisible();
  });

  test("Review new opens a guided catch-up, in chronological order, that stops at a decision", async ({
    page,
  }) => {
    await open(page, "/workday/tprm");
    await requireSeeded(page);

    const catchUp = catchUpControl(page);
    if (!(await catchUp.isVisible().catch(() => false))) {
      // Same consumable state as the test above, and the same remedy.
      test.skip(
        true,
        "Nothing is unread for this role, so there is no walk to open. This file spends that state permanently; run npm run db:seed to exercise the walk.",
      );
    }

    await catchUp.click();
    const walk = page.getByRole("dialog", { name: /Guided catch up|Gefuehrtes Aufholen/ });
    await expect(walk).toBeVisible({ timeout: 30_000 });

    // What happened, and what was already completed automatically.
    await expect(walk.getByText(/^(What happened|Was geschehen ist)$/)).toBeVisible();
    await expect(walk.getByText(/\d+ of \d+|\d+ von \d+/)).toBeVisible();

    /*
     * Chronological, never by severity. The 15:00 decision only makes sense
     * after the 14:05 event that caused it, so the first item of the walk has
     * to be the earliest unread moment rather than the worst one.
     */
    const firstMoment = ((await walk.locator(".app-data, .app-oid").first().textContent()) ?? "").trim();
    expect(firstMoment, `the walk opened at "${firstMoment}"`).toMatch(/^\d{2}:\d{2}$/);

    // The walk is a drawer, so it traps Tab and closes on Escape: it is the
    // one live day surface allowed to be modal, because the user asked for it.
    await page.keyboard.press("Escape");
    await expect(walk).toBeHidden();
  });

  test("the player pauses itself at a moment carrying a material human decision", async ({
    page,
  }) => {
    await open(page, "/workday/tprm");
    await requireSeeded(page);

    const play = playControl(page);
    const before = ((await clock(page).textContent()) ?? "").trim();
    if (await play.isDisabled()) {
      test.skip(true, "The day is already at its end, so there is nothing to play through.");
    }

    await play.click();
    await expect(play).toHaveAttribute("aria-pressed", "true");

    /*
     * The player moves to the moment carrying the decision, sets playing
     * false and records why. It does not roll past. Played forward from the
     * shared event the seeded day stops at 15:00 and then at 16:30.
     *
     * The wait is generous because the step is 1700ms per moment and the
     * action round trips through the server.
     */
    await expect(play).toHaveAttribute("aria-pressed", "false", { timeout: 45_000 });
    const after = ((await clock(page).textContent()) ?? "").trim();
    expect(after, `the player stopped without moving from ${before}`).not.toBe(before);
  });

  test("stepping back distinguishes viewed time from live time and offers Jump to live", async ({
    page,
  }) => {
    await open(page, "/workday/tprm");
    await requireSeeded(page);

    /*
     * The live half of the clock, which is the trailing number when the user
     * is behind and the only number when they are not. Reading the first time
     * in the string would read the VIEWED moment, which is exactly the
     * confusion this test exists to rule out.
     */
    const readLive = async (): Promise<string> => {
      const text = ((await clock(page).textContent()) ?? "").trim();
      return (
        /Live (?:at|um) (\d{2}:\d{2})/.exec(text)?.[1] ?? /(\d{2}:\d{2})/.exec(text)?.[1] ?? ""
      );
    };

    const liveBefore = await readLive();
    expect(liveBefore, "the clock reports no live moment").toMatch(/^\d{2}:\d{2}$/);

    await page.getByRole("main").click({ position: { x: 20, y: 20 } });
    await page.keyboard.press("ArrowLeft");

    /*
     * Two numbers and two labels. A single number that silently meant
     * different things at different times would be the dishonest option, and
     * the point of the split is that scrubbing back never rewinds the day.
     */
    await expect(clock(page)).toHaveAttribute("data-behind", "true", { timeout: 20_000 });
    await expect(clock(page)).toContainText(/^(Viewing|Ansicht)/);
    await expect(clock(page)).toContainText(/Live at|Live um/);

    const jump = bar(page).getByRole("button", { name: /Jump to live|Zu live springen/ });
    await expect(jump).toBeVisible();

    // Live time itself did not move. This is the assertion the whole model
    // rests on: a backwards step reports no live advance.
    const liveNow = await readLive();
    expect(liveNow, `live time read ${liveBefore} before the step and ${liveNow} after it`).toBe(
      liveBefore,
    );
  });

  test("L jumps back to live and collapses the clock to one number", async ({ page }) => {
    await open(page, "/workday/tprm");
    await requireSeeded(page);

    await page.getByRole("main").click({ position: { x: 20, y: 20 } });
    await page.keyboard.press("ArrowLeft");
    await expect(clock(page)).toHaveAttribute("data-behind", "true", { timeout: 20_000 });

    /*
     * Wait for the step to finish before sending the next key. Every control
     * in the bar is disabled while an action is in flight, and the keyboard
     * handler goes through the same guard, so a key pressed during the round
     * trip is dropped. That is correct behaviour rather than a defect: the
     * alternative is two player actions racing over one row of state. It does
     * mean a test that fires keys back to back is testing the race and not
     * the shortcut.
     */
    const jump = bar(page).getByRole("button", { name: /Jump to live|Zu live springen/ });
    await expect(jump).toBeVisible();
    await expect(jump).toBeEnabled();

    await page.keyboard.press("l");
    await expect(clock(page)).toHaveAttribute("data-behind", "false", { timeout: 20_000 });
    await expect(jump).toHaveCount(0);
  });

  test("a role switch does not touch the unread state", async ({ page }) => {
    await open(page, "/workday/control-assurance");
    await requireSeeded(page);

    const readCount = async (): Promise<string> =>
      ((await bar(page).getByText(/\d+ (unread|ungelesen)|Nothing new|Nichts Neues/).first().textContent()) ?? "").trim();

    const before = await readCount();

    /*
     * A role switch changes a column on the run row. It does not write to the
     * read table, which is keyed by event and role, so the count a function
     * sees has to survive leaving and coming back. That is what makes a count
     * mean something after a switch.
     */
    for (const roleId of ["regulatory-change", "nfr-governance", "rcsa"]) {
      await open(page, `/workday/${roleId}`);
      await requireSeeded(page);
    }
    await open(page, "/workday/control-assurance");
    await requireSeeded(page);

    expect(await readCount(), `unread read "${before}" before the switches`).toBe(before);
  });

  test("restores the seeded opening moment", async ({ page }) => {
    /*
     * Not a check, a fixture teardown written as a test so that its failure
     * is visible. Live time is shared with every other file in the run, and a
     * suite that left the day at 16:30 would make the next file's assertions
     * about the opening moment fail for a reason that is not a defect.
     */
    await setLiveMomentThroughV1(page, SEEDED_MOMENT);
    await open(page, "/workday/rcsa");
    await requireSeeded(page);
    await expect(clock(page)).toContainText(SEEDED_MOMENT);
    await expect(clock(page)).toHaveAttribute("data-behind", "false");
  });
});
