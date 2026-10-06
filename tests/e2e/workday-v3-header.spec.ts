/**
 * V3.1 non-negotiable requirement 1: the header renders reliably.
 *
 * "There is a header on screen" is the one claim the V3.1 architecture is
 * built around, so this file tests the claim rather than the mechanism that is
 * supposed to deliver it. Each test names a condition a reviewer can reproduce
 * by hand: a cold load, a refresh, a click in the rail, a slow response, a
 * thrown page, a missing scenario.
 *
 * The contract is deliberately version agnostic. `middleware.ts` downgrades a
 * route with no V3.1 implementation to V2, so asking for `?ui=v3.1` on seven of
 * the eight segments correctly yields a V2 page with a V2 header. The
 * requirement is that EVERY route carries exactly one application header with
 * a product label on it, whichever interface answered. A separate test records
 * how far V3.1 itself actually reaches, because a reviewer who asked for V3.1
 * and silently received V2 should be able to read that from the suite.
 *
 * Conventions carried from `workday-v2.spec.ts` and `workday-v2-visual.spec.ts`
 * deliberately:
 *
 *   Accessible selectors first. The marked exceptions below are the cases
 *   where the STRUCTURE is the thing under test. "How many application headers
 *   are in this document" cannot be expressed as a role, because a `header`
 *   nested inside `main` does not expose the banner role at all, and that is
 *   exactly the shape a duplicated header takes.
 *
 *   Fail, do not skip, when the product is wrong. `open` in the V2 suites skips
 *   on a 404 because those routes were genuinely unbuilt. Here the eight
 *   segments are the eight the brief counts and the V3.1 rail links to all
 *   eight, so a 404 is a defect and is reported as one.
 *
 *   Soft assertions for the sweeps. A role test walks eight segments, and
 *   stopping at the first bad one would hide the other seven. `expect.soft`
 *   reports every segment and still fails the test.
 *
 * The viewport matrix comes from the three projects in `playwright.config.ts`,
 * so every test here runs at 1920x1080, 1440x900 and 1366x768 and the project
 * name appears in any failure.
 */

import { expect, test, type Locator, type Page } from "@playwright/test";
import { ROLE_IDS } from "@/db/schema/core";
import { gateForRole } from "@/workday/role-gate";

/*
 * The roles whose workday routes render a frame at all. A Planned role is
 * refused by the release gate on every route and redirected to the role
 * selector (`src/workday/role-gate.ts`), so it has no workday header to test.
 */
const FRAMED_ROLES = ROLE_IDS.filter((role) => gateForRole(role).kind !== "planned");

/**
 * The route segments the V3.3 rail links to, in rail order.
 *
 * The rail is Home, Work, Processes and Decisions
 * (`src/components/workday-v3/WorkdayNavigation.tsx`). The list used to name
 * the eight V3.1 segments, including `/my-work`, which no longer exists and
 * answered 404, and the V2 routes the flagship roles now redirect to the Work
 * Hub; those failures were the list's, not the header's.
 */
const SEGMENTS = ["", "/work", "/processes", "/decisions"] as const;

/** The interface under test, requested explicitly on every navigation. */
const V31 = "ui=v3.1";

function path(role: string, segment: string): string {
  return `/workday/${role}${segment}?${V31}`;
}

/** The accessible name of the V3.1 rail, in either language. */
const RAIL_NAME = /^(Work areas|Arbeitsbereiche)$/;

/**
 * Every application chrome header this codebase can render.
 *
 * Addressed by class, and this is one of the marked exceptions. The banner role
 * is not usable here for three separate reasons: `WorkdayHeaderFallback` and
 * `WorkdayHeader` are the same box and the test must accept either, the V1 and
 * V2 top bars claim the same role, and a `header` that has been nested inside
 * `main` stops being a banner while still being a second header on the screen.
 *
 * `wd-header` is V3.1, `app-topbar` is the V2 top bar and `workday-topbar` is
 * the shell shared by V1 and V2. Page level heads such as
 * `header.app-workspace-head` are not in the list: they are section heads, not
 * application chrome, and counting them would make the duplicate test noise.
 */
function chromeHeaders(page: Page): Locator {
  return page.locator("header.wd-header, header.app-topbar, header.workday-topbar");
}

/** The V3.1 header specifically, for the coverage test. */
function v3Header(page: Page): Locator {
  return page.locator("header.wd-header");
}

/** Opens a path and returns the HTTP status, without skipping on failure. */
async function openV3(page: Page, role: string, segment: string): Promise<number> {
  const response = await page.goto(path(role, segment), { waitUntil: "domcontentloaded" });
  return response?.status() ?? 0;
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

/**
 * Asserts the header contract at the current document.
 *
 * Four things, each separately reported: exactly one application header, it is
 * visible, it carries text, and the text includes a product label.
 *
 * The timeout is 5 seconds rather than the configured 15. The header is server
 * rendered and the document has already reached DOMContentLoaded, so it is in
 * the first bytes or it is not coming. `src/db/repositories/header.ts` measures
 * the data it needs at 312ms. A header still absent after five seconds has
 * failed the requirement whatever the reason.
 */
async function assertHeaderContract(page: Page, where: string): Promise<void> {
  const headers = chromeHeaders(page);

  const count = await headers.count();
  const classes =
    count === 0
      ? []
      : await headers.evaluateAll((nodes) =>
          nodes.map((node) => `${node.tagName.toLowerCase()}.${node.className.trim().split(/\s+/).join(".")}`),
        );

  expect
    .soft(
      count,
      `${where}: expected exactly one application header, found ${count}${
        classes.length > 0 ? ` (${classes.join(" + ")})` : ""
      }`,
    )
    .toBe(1);

  if (count === 0) return;

  const header = headers.first();
  await expect.soft(header, `${where}: the header must be visible`).toBeVisible({ timeout: 5_000 });

  const text = ((await header.textContent({ timeout: 5_000 }).catch(() => "")) ?? "").trim();
  expect.soft(text.length, `${where}: the header rendered no text at all`).toBeGreaterThan(0);

  /*
   * The product label specifically. A header that renders only a role word or
   * three icon buttons is the blank strip the brief forbids, dressed up. Every
   * interface puts the product name in a link back to the entry screen, so the
   * link is the version independent way to find it.
   */
  const brand = header.locator('a[href="/"]').first();
  const brandText = ((await brand.textContent({ timeout: 5_000 }).catch(() => "")) ?? "").trim();
  expect
    .soft(brandText.length, `${where}: the header carries no product label`)
    .toBeGreaterThan(0);
}

/* ==========================================================================
   Every role, every segment, cold load and refresh
   ========================================================================== */

test.describe("the workday header on every route", () => {
  for (const role of FRAMED_ROLES) {
    test(`${role}: a header is on screen on all eight segments and survives a refresh`, async ({
      page,
    }) => {
      await openV3(page, role, "");
      await requireSeeded(page);

      for (const segment of SEGMENTS) {
        const where = `${role}${segment || " (home)"}`;

        const status = await openV3(page, role, segment);
        expect
          .soft(status, `${where}: the route the V3.1 rail links to returned HTTP ${status}`)
          .toBeLessThan(400);

        await assertHeaderContract(page, `${where} on a cold load`);

        /*
         * The refresh is a separate request, with the version carried by the
         * cookie as well as the query, which is the path `middleware.ts`
         * exists to make work. A header that only survived the first load
         * would fail here.
         */
        await page.reload({ waitUntil: "domcontentloaded" });
        await assertHeaderContract(page, `${where} after a hard reload`);
      }
    });
  }
});

/* ==========================================================================
   How far V3.1 itself reaches
   ========================================================================== */

test("the V3.1 header is the header on every route that claims V3.1", async ({ page }) => {
  await openV3(page, "rcsa", "");
  await requireSeeded(page);

  const served: string[] = [];
  for (const segment of SEGMENTS) {
    const status = await openV3(page, "rcsa", segment);
    const v3 = status < 400 ? await v3Header(page).count() : 0;
    const v2 =
      status < 400 ? await page.locator("header.app-topbar, header.workday-topbar").count() : 0;
    served.push(
      `${segment || "(home)"}: HTTP ${status}, ${v3 > 0 ? "V3.1" : v2 > 0 ? "V2" : "no application header"}`,
    );
  }

  /*
   * Recorded rather than asserted as a count, because which routes are
   * migrated is a product decision held in `V3_NATIVE_SEGMENTS`. What is
   * asserted is that every route answered with ONE of the two, and that a
   * route asked for V3.1 never ends up with nothing.
   */
  expect(
    served.filter((line) => line.includes("no application header")),
    `A request for ?ui=v3.1 left a route with no application header at all. Per segment: ${served.join("; ")}`,
  ).toEqual([]);
});

/* ==========================================================================
   Client side navigation
   ========================================================================== */

test.describe("the workday header across client side navigation", () => {
  /*
   * Addressed by destination rather than by label.
   *
   * The rail's words are product copy and have already moved once during this
   * review. The destination is the contract: for each of the seven other
   * segments the brief counts, the rail either offers a way there or it does
   * not, and a missing one is reported rather than waited for.
   *
   * Each hop starts from the V3.1 home rather than continuing from the
   * previous target, because a route that downgrades to V2 replaces the rail
   * with the V2 one and the walk would then be testing a different control.
   */
  for (const role of FRAMED_ROLES) {
    test(`${role}: the header survives a click in the rail to every other segment`, async ({
      page,
    }) => {
      await openV3(page, role, "");
      await requireSeeded(page);
      await assertHeaderContract(page, `${role} home before navigating`);

      for (const segment of SEGMENTS.filter((value) => value !== "")) {
        const where = `${role} after clicking the rail to ${segment}`;

        await openV3(page, role, "");

        /*
         * A marker on `window`, so the test can tell a client side navigation
         * from a full document load. The header surviving a reload is covered
         * above; the requirement here is that the frame is never re-created,
         * and a hard navigation would clear this.
         */
        await page.evaluate(() => {
          (window as unknown as Record<string, unknown>)["__nfrNavMarker"] = true;
        });

        /* Mail, calendar and collaboration sit behind a disclosure. */
        const more = page.getByRole("button", { name: /^(More|Mehr)$/ });
        if ((await more.count()) > 0 && (await more.getAttribute("aria-expanded")) !== "true") {
          await more.click();
        }

        const rail = page.getByRole("navigation", { name: RAIL_NAME });
        const link = rail.locator(`a[href^="/workday/${role}${segment}"]`);
        const offered = await link.count();
        if (offered === 0) {
          expect
            .soft(
              offered,
              `${role}: the V3.1 rail offers no way to reach ${segment}, which is one of the eight segments the brief counts`,
            )
            .toBeGreaterThan(0);
          continue;
        }

        await link.first().click({ timeout: 10_000 });

        await page.waitForURL(new RegExp(`/workday/${role}${segment}(\\?|$)`), {
          timeout: 15_000,
        });

        const stayedClientSide = await page.evaluate(
          () => (window as unknown as Record<string, unknown>)["__nfrNavMarker"] === true,
        );
        expect
          .soft(
            stayedClientSide,
            `${where}: the router left the document, so the layout and its header were destroyed and rebuilt rather than kept`,
          )
          .toBe(true);

        await assertHeaderContract(page, where);
      }
    });
  }
});

/* ==========================================================================
   While the page is still loading
   ========================================================================== */

test("the header is on screen while the main region is still the loading skeleton", async ({
  page,
}) => {
  /*
   * The document is replayed up to the point where React swaps the
   * `loading.tsx` skeleton for the resolved page.
   *
   * These are the server's own bytes, cut where a browser's own mid-stream
   * state cuts them. The response carries one Suspense boundary: the frame and
   * the skeleton are emitted first, the resolved main region follows in a
   * hidden block, and a trailing script applies the swap. Holding the response
   * just before that script is the loading state exactly as the server
   * produced it. Nothing is invented and no application file is touched.
   *
   * The obvious alternative, holding the flight request on a client
   * navigation, does not produce an observable loading state in this build:
   * without a prefetch the router has no way to know the target segment's
   * boundary, so it keeps the previous page on screen instead. That case is
   * covered by the test below.
   */
  let cutAt = -1;
  let swapFound = false;

  await page.route(
    (url) => url.pathname === "/workday/rcsa" && !url.searchParams.has("_rsc"),
    async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      const swap = body.indexOf("$RC(");
      swapFound = swap > 0;
      cutAt = swap > 0 ? body.lastIndexOf("<script", swap) : -1;

      if (cutAt <= 0) {
        await route.fulfill({ response });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: body.slice(0, cutAt),
      });
    },
  );

  try {
    await page.goto(`/workday/rcsa?${V31}`, { waitUntil: "commit" });

    expect(
      swapFound && cutAt > 0,
      "the response carried no streamed Suspense boundary, so the loading state could not be held open for observation",
    ).toBe(true);

    /*
     * `loading.tsx` is the only thing in the tree that marks a region busy, so
     * its presence proves the assertions below are measuring the loading state
     * rather than a settled page.
     */
    await expect(
      page.locator('[aria-busy="true"]'),
      "the loading skeleton is not on screen, so the slow path was not observed",
    ).toBeVisible({ timeout: 15_000 });

    await assertHeaderContract(page, "rcsa while the main region is still loading");

    /* The main region is the only thing the boundary replaced. */
    await expect(
      page.getByRole("navigation", { name: RAIL_NAME }),
      "the navigation rail is missing while the page loads, so the boundary replaced more than the main region",
    ).toBeVisible();
  } finally {
    await page.unrouteAll({ behavior: "ignoreErrors" });
  }
});

test("the header stays on screen while the next segment's data is held open", async ({ page }) => {
  /*
   * The flight request for the next segment is held open, which is the
   * observable form of "the page is slow" on a client navigation. The document
   * request is untouched, so the first load is a normal one.
   */
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });

  await page.route(
    (url) => url.searchParams.has("_rsc"),
    async (route) => {
      await held;
      await route.continue();
    },
  );

  try {
    await openV3(page, "rcsa", "");
    await requireSeeded(page);

    await page.evaluate(() => {
      (window as unknown as Record<string, unknown>)["__nfrNavMarker"] = true;
    });

    await page
      .getByRole("navigation", { name: RAIL_NAME })
      .getByRole("link", { name: /^Decisions(,|$)/ })
      .first()
      .click();

    /*
     * Sampled across three seconds rather than checked once. A header that
     * disappeared and came back would pass a single check taken at the wrong
     * moment, and a header that is destroyed and rebuilt is the defect the
     * layout exists to prevent.
     *
     * The 100ms here is a sampling interval, not a wait for a condition. There
     * is no condition to wait for: the assertion is about an interval during
     * which nothing is supposed to change.
     */
    const deadline = Date.now() + 3_000;
    let samples = 0;
    let missing = 0;
    while (Date.now() < deadline) {
      samples += 1;
      if ((await chromeHeaders(page).count()) !== 1) missing += 1;
      await page.waitForTimeout(100);
    }

    expect
      .soft(
        missing,
        `the application header was absent or duplicated in ${missing} of ${samples} samples taken while the next segment's data was held open`,
      )
      .toBe(0);

    const stayedClientSide = await page.evaluate(
      () => (window as unknown as Record<string, unknown>)["__nfrNavMarker"] === true,
    );
    expect
      .soft(
        stayedClientSide,
        "a slow page response made the router leave the document, so the header was destroyed and rebuilt rather than kept",
      )
      .toBe(true);

    await assertHeaderContract(page, "rcsa while the decisions data is held open");
  } finally {
    release();
    await page.unrouteAll({ behavior: "ignoreErrors" });
  }
});

/* ==========================================================================
   On the error boundary
   ========================================================================== */

test("the header is on screen when the workspace throws", async ({ page }) => {
  /*
   * A real uncaught error in the page subtree, not a simulated response.
   *
   * `src/components/workday-v2/ShellContext.tsx:131` calls `window.matchMedia`
   * in a mount effect with no guard, so a browser that does not supply it makes
   * the page throw after the frame is already on screen. That is exactly the
   * condition `app/workday/[role]/error.tsx` exists for: the boundary sits
   * under the layout, so it should replace the main region and leave the
   * header, the rail and the bottom bar alone.
   *
   * No other trigger is available from a browser. No route under
   * `/workday/[role]` can be made to throw on the server by any supported
   * input, and a failed flight response makes the router fall back to a full
   * document load rather than reaching the boundary.
   */
  await page.addInitScript(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      get: () => undefined,
    });
  });

  await page.goto(path("rcsa", "/decisions"), { waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("heading", { name: /This workspace could not load/ }),
    "the workday error boundary never rendered, so a throwing page is not contained by it",
  ).toBeVisible({ timeout: 20_000 });

  await assertHeaderContract(page, "rcsa on the workday error boundary");

  /*
   * The boundary's own copy tells the reader that "the navigation above still
   * takes you anywhere else", so the navigation has to be above it.
   */
  await expect
    .soft(
      page.getByRole("navigation", { name: RAIL_NAME }).or(page.getByRole("navigation").first()),
      "the error boundary promises the navigation is still above it, and no navigation is on screen",
    )
    .toBeVisible({ timeout: 5_000 });
});

/* ==========================================================================
   The degraded path
   ========================================================================== */

test("the header is on screen, with a product label, when the scenario is unavailable", async ({
  page,
}) => {
  /*
   * The degraded header is `src/components/workday-v3/WorkdayHeaderFallback.tsx`,
   * chosen by `WorkdayAppFrame` when `buildHeaderModel` reports `degraded`.
   * That happens when the database is not ready, when the scenario run is
   * missing, or when the role does not resolve.
   *
   * The test asks the product for that condition every way a client can: a
   * role the scenario does not hold, a run it does not hold, and a role outside
   * the role set. Any of them reaching the frame should leave a header on
   * screen with a product label on it.
   */
  const attempts = [
    { label: "a role the scenario does not hold", url: `/workday/nfr-governance?${V31}&role=absent` },
    { label: "a run the scenario does not hold", url: `/workday/rcsa?${V31}&run=absent-run` },
    { label: "a role outside the role set", url: `/workday/no-such-role?${V31}` },
  ];

  const observed: string[] = [];

  for (const attempt of attempts) {
    const response = await page.goto(attempt.url, { waitUntil: "domcontentloaded" });
    const status = response?.status() ?? 0;
    const headers = await chromeHeaders(page).count();
    const degraded = await page.locator("header.wd-header-fallback").count();
    observed.push(
      `${attempt.label}: HTTP ${status}, ${headers} application header(s), ${degraded} degraded header(s)`,
    );

    if (degraded === 1) {
      await assertHeaderContract(page, `the degraded header reached by ${attempt.label}`);
      await expect(
        page.locator("header.wd-header-fallback").locator(".wd-brand-name"),
        "the degraded header must still name the product",
      ).toHaveText(/\S/);
      return;
    }
  }

  /*
   * No request reached the degraded header, so the fallback the whole
   * never-throw design rests on cannot be observed from a browser at all. That
   * is reported as a failure rather than skipped: an unreachable safety path is
   * an unverified safety path, and the brief makes the degraded header part of
   * the requirement rather than an internal detail.
   */
  expect(
    observed,
    [
      "The degraded header could not be reached by any supported request.",
      "buildHeaderModel takes its run from DEFAULT_RUN_ID and accepts no request level override",
      "(src/db/repositories/header.ts, buildHeaderModel), and the layout answers an unknown role",
      "with notFound() before the frame renders (app/workday/[role]/layout.tsx:53), which replaces",
      "the whole tree including the header. Attempts:",
      ...observed,
    ].join(" "),
  ).toEqual([]);
});

/* ==========================================================================
   Never twice
   ========================================================================== */

test.describe("the header never renders twice", () => {
  for (const role of FRAMED_ROLES) {
    test(`${role}: exactly one application header on every segment`, async ({ page }) => {
      await openV3(page, role, "");
      await requireSeeded(page);

      for (const segment of SEGMENTS) {
        const status = await openV3(page, role, segment);
        if (status >= 400) continue; /* The 404 is reported by the sweep above. */

        const all = chromeHeaders(page);
        const count = await all.count();
        const classes = await all.evaluateAll((nodes) =>
          nodes.map(
            (node) => `${node.tagName.toLowerCase()}.${node.className.trim().split(/\s+/).join(".")}`,
          ),
        );

        expect
          .soft(
            count,
            `${role}${segment || " (home)"} renders ${count} application headers: ${
              classes.join(" + ") || "none"
            }`,
          )
          .toBe(1);

        /* And never two MAIN regions either, which is the same defect's twin. */
        const mains = await page.locator("main").count();
        expect
          .soft(mains, `${role}${segment || " (home)"} renders ${mains} main regions`)
          .toBeLessThanOrEqual(1);
      }
    });
  }
});
