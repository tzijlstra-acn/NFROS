/**
 * The product entrance, the role selector and the presenter controls.
 *
 * Three claims, each asserted where a person would check it:
 *
 *   - the entry page is a product entrance: the proposition, the way in, a
 *     live preview of the two Available roles and the four trust words, with
 *     no runtime state, setup command or reset control on it;
 *   - the role selector shows one live signal per Available role, read from
 *     the database, keeps Demo labelled and Planned inert;
 *   - every runtime control that left the entry page still works in the
 *     control room.
 *
 * The two steps that change state (switching the mode, resetting the day)
 * run only against an isolated stack named through NFR_BASE_URL on a port
 * other than 3000, so this file cannot reset somebody's presentation.
 */

import { expect, test, type Page } from "@playwright/test";

const BASE_URL = process.env.NFR_BASE_URL ?? "";
const ISOLATED_STACK = BASE_URL.length > 0 && !/:3000(\/|$)/.test(BASE_URL);

async function open(page: Page, path: string): Promise<void> {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response?.status() ?? 0, `${path} did not load`).toBeLessThan(400);
}

async function requireSeeded(page: Page): Promise<void> {
  const unavailable = page.getByText("the scenario has not been seeded", { exact: false }).first();
  if (await unavailable.isVisible({ timeout: 1_000 }).catch(() => false)) {
    test.skip(true, "The scenario database is not seeded, so there are no signals to assert.");
  }
}

/** Fails when the document is wider than the viewport. */
async function expectNoSidewaysOverflow(page: Page): Promise<void> {
  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(widths.scroll, "the page scrolls sideways").toBeLessThanOrEqual(widths.client);
}

/* ==========================================================================
   The entry page
   ========================================================================== */

test.describe("the product entrance", () => {
  test("states the proposition and offers the three ways in", async ({ page }) => {
    await open(page, "/");

    await expect(
      page.getByRole("heading", { level: 1, name: "Run NFR work from one governed environment" }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "NFROS prepares the work, runs complete risk processes and keeps material decisions with people",
      ),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: "Explore the product" })).toHaveAttribute("href", "/workday");
    await expect(page.getByRole("link", { name: "View the presentation" })).toHaveAttribute("href", "/story");

    // No design-partner workspace route exists in this build, so the action
    // is present, disabled, and says why.
    const designPartner = page.getByRole("button", { name: "Enter design-partner workspace" });
    await expect(designPartner).toBeDisabled();
    await expect(designPartner).toHaveAccessibleDescription("Not available in this release");
  });

  test("shows exactly the four trust words", async ({ page }) => {
    await open(page, "/");
    await expect(page.getByTestId("trust-strip").getByRole("listitem")).toHaveText([
      "Evidence-linked",
      "Human-approved",
      "Audit-ready",
      "Synthetic demonstration",
    ]);
  });

  test("carries no runtime state, setup command or reset control", async ({ page }) => {
    await open(page, "/");
    const text = (await page.locator("body").innerText()).toLowerCase();
    for (const banned of [
      "runtime status",
      "ai mode",
      "live ai configured",
      "live ai verified",
      "configuration source",
      "scenario seeded",
      "demonstration mode",
      "npm run",
      "reset the day",
    ]) {
      expect(text, `the entry page shows "${banned}"`).not.toContain(banned);
    }
    await expect(page.getByRole("button", { name: /reset/i })).toHaveCount(0);
    await expect(page.getByRole("group", { name: "Demonstration mode" })).toHaveCount(0);
  });

  test("links presenters to the control room from the footer", async ({ page }) => {
    await open(page, "/");
    await expect(page.locator("footer").getByRole("link", { name: "Control room" })).toHaveAttribute(
      "href",
      "/control-room",
    );
  });

  test("previews both flagship roles inside the first viewport, from live data", async ({ page }) => {
    await open(page, "/");
    await requireSeeded(page);

    await expect(page.getByTestId("landing-proof-source")).toHaveText(
      /^Synthetic scenario, \d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}$/,
    );
    for (const roleId of ["rcsa", "tprm"]) {
      const preview = page.getByTestId(`role-preview-${roleId}`);
      await expect(preview).toBeInViewport({ ratio: 1 });
      await expect(preview.locator('[data-signal="process"] .nfr-preview-value')).toHaveText(/Stage \d of 8/);
      await expect(preview.locator('[data-signal="focus"]')).toHaveAttribute("data-state", /present|empty/);
    }
    await expectNoSidewaysOverflow(page);
  });

  test("never exposes a key or a key fragment", async ({ page }) => {
    await open(page, "/");
    const html = await page.content();
    expect(html).not.toMatch(/\bsk-[A-Za-z0-9_-]{8,}/);
  });
});

/* ==========================================================================
   The role selector
   ========================================================================== */

test.describe("the role selector", () => {
  test("gives each Available role one live signal from the database", async ({ page }) => {
    await open(page, "/workday");
    await requireSeeded(page);

    await expect(page.getByTestId("selector-scenario")).toHaveText(/^Synthetic scenario, /);
    for (const roleId of ["rcsa", "tprm"]) {
      const signals = page.getByTestId(`signals-${roleId}`);
      await expect(signals.getByTestId("signal-focus")).toHaveAttribute("data-state", /present|empty/);
      await expect(signals.getByTestId("signal-process")).toContainText(/Stage \d of 8/);
      await expect(signals.getByTestId("signal-meeting")).toHaveAttribute("data-state", /present|empty/);
      await expect(page.getByTestId(`flagship-${roleId}`)).toBeInViewport({ ratio: 1 });
    }
    await expectNoSidewaysOverflow(page);
  });

  test("keeps Demo roles labelled Demo and Planned roles without a link", async ({ page }) => {
    await open(page, "/workday");

    const demo = page.getByRole("region", { name: "Demo" });
    await expect(demo.getByRole("link", { name: /View demo/ })).toHaveCount(2);

    for (const roleId of ["regulatory-change", "nfr-governance"]) {
      const row = page.getByTestId(`planned-${roleId}`);
      await expect(row).toContainText("Planned");
      await expect(row.getByRole("link")).toHaveCount(0);
    }
    await expect(page.locator('a[href="/workday/regulatory-change"]')).toHaveCount(0);
    await expect(page.locator('a[href="/workday/nfr-governance"]')).toHaveCount(0);
  });
});

/* ==========================================================================
   The control room
   ========================================================================== */

test.describe("the presenter controls in the control room", () => {
  test("report mode, key state, verification, source and database state", async ({ page }) => {
    await open(page, "/control-room");
    const runtime = page.getByTestId("runtime-state");
    for (const label of [
      "Requested mode",
      "Effective mode",
      "Key resolved",
      "Live AI verified",
      "Configuration source",
      "Scenario seeded",
    ]) {
      await expect(runtime.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(page.getByTestId("setup-commands")).toContainText("npm run db:migrate");
    await expect(page.getByTestId("setup-commands")).toContainText("npm run db:seed");
    await expect(page.getByRole("link", { name: "Operations" })).toHaveAttribute("href", "/ops");
    await expect(page.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");

    const html = await page.content();
    expect(html).not.toMatch(/\bsk-[A-Za-z0-9_-]{8,}/);
  });

  test("the mode selector still switches the mode", async ({ page }) => {
    test.skip(!ISOLATED_STACK, "Switching the mode changes the running server; isolated stack only.");
    await open(page, "/control-room");
    // The selector is a client component; a click before hydration does nothing.
    await page.waitForLoadState("networkidle");
    const selector = page.getByTestId("mode-selector").getByRole("group", { name: "Demonstration mode" });
    const offline = selector.getByRole("button", { name: "offline", exact: true });
    const safe = selector.getByRole("button", { name: "safe", exact: true });

    await expect(async () => {
      await offline.click();
      await expect(offline).toHaveAttribute("aria-pressed", "true", { timeout: 5_000 });
    }).toPass({ timeout: 45_000 });
    await expect(async () => {
      await safe.click();
      await expect(safe).toHaveAttribute("aria-pressed", "true", { timeout: 5_000 });
    }).toPass({ timeout: 45_000 });
  });

  test("the reset control still resets the day", async ({ page }) => {
    test.skip(!ISOLATED_STACK, "Resetting rewrites the scenario database; isolated stack only.");
    await open(page, "/control-room");
    await page.waitForLoadState("networkidle");
    await requireSeeded(page);
    const control = page.getByTestId("reset-control");
    await control.getByRole("button", { name: "Reset the day" }).click();
    await expect(control.getByText("Discard all decisions from this run?")).toBeVisible();
    await control.getByRole("button", { name: "Yes, reset" }).click();
    await expect(control.getByText(/The day was restored/)).toBeVisible({ timeout: 60_000 });
  });
});
