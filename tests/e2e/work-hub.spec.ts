/**
 * Work Hub journeys: Agenda and Actions, at the three projected viewports.
 *
 * Plan sections 4.4, 4.5 and 4.7, tested as a reader would use them:
 *
 *   The agenda shows the calendar's own entries, a selected entry shows its
 *   conflict, its preparation, its process and the work that depends on it,
 *   and its links land on real pages.
 *   The selection survives a tab change, because it is in the URL.
 *   The context drawer shows the selected item, never "Nothing selected",
 *   and the AI Partner is asked about the selected object.
 *   Actions close only with evidence, a material closure waits for the
 *   person's confirmation, updates append to the history, and a reminder is
 *   drafted, edited and sent as a simulated message.
 *   Nothing overflows at 1920x1080, 1440x900 or 1366x768.
 *
 * The Actions journey writes, so it runs against an isolated stack seeded
 * fresh (see the handoff): `NFR_BASE_URL` must point at it, never at the
 * shared server on port 3000. A test that finds its action already changed by
 * an earlier run skips with that reason rather than failing on stale state.
 */

import { expect, test, type Locator, type Page } from "@playwright/test";

const UI = "ui=v3.3";

function base(): string {
  return process.env.NFR_BASE_URL ?? "http://localhost:3000";
}

/** The write journey must never run against the shared demonstration server. */
function requireIsolatedStack(): void {
  const url = base();
  test.skip(
    url.includes(":3000") || !process.env.NFR_BASE_URL,
    "The Actions journey writes. Point NFR_BASE_URL at an isolated, freshly seeded stack.",
  );
}

async function open(page: Page, path: string): Promise<void> {
  const response = await page.goto(`${path}${path.includes("?") ? "&" : "?"}${UI}`, { waitUntil: "domcontentloaded" });
  expect(response?.status() ?? 0, `${path} returned an error`).toBeLessThan(400);
  await expect(page.getByTestId("work-hub")).toBeVisible();
}

/**
 * Opens an operation's form, retrying until it is on screen.
 *
 * The operations panel is a client component. On a loaded development server
 * a click can land on the server rendered button before React has hydrated
 * it, and that click does nothing; retrying is the honest fix rather than a
 * fixed sleep.
 */
async function openOperation(page: Page, operation: string, form: string): Promise<Locator> {
  const detail = page.getByTestId("work-detail");
  const target = detail.getByTestId(form);
  await expect(async () => {
    if (!(await target.isVisible())) await detail.locator(`[data-operation="${operation}"]`).click({ timeout: 5_000 });
    await expect(target).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 30_000 });
  return target;
}

async function noHorizontalOverflow(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(() => {
    const doc = document.scrollingElement;
    const main = document.querySelector(".wd-main");
    const detail = document.querySelector('[data-testid="work-detail"]');
    const rect = detail?.getBoundingClientRect();
    return {
      document: doc ? doc.scrollWidth - doc.clientWidth : 0,
      main: main ? main.scrollWidth - main.clientWidth : 0,
      detailRight: rect ? rect.right - window.innerWidth : 0,
    };
  });
  expect(overflow.document, `${label}: document overflows horizontally`).toBeLessThanOrEqual(0);
  expect(overflow.main, `${label}: main region overflows horizontally`).toBeLessThanOrEqual(0);
  expect(overflow.detailRight, `${label}: detail pane is clipped on the right`).toBeLessThanOrEqual(0);
}

test.describe("Agenda", () => {
  test("shows the calendar's own entries with conflicts, preparation, links and dependent work", async ({ page }) => {
    await open(page, "/workday/rcsa/work");

    const rows = page.getByTestId("work-queue").locator("[data-item-id]");
    await expect(rows.first()).toBeVisible();
    const ids = await rows.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-item-id")));
    expect(ids.length).toBeGreaterThan(0);
    /* Every row is a seeded calendar entry; the earlier static fallbacks are gone. */
    for (const id of ids) expect(id).toMatch(/^CAL-2026-\d{4}$/);
    await expect(page.getByText("RCSA Evidence Review Focus Block")).toHaveCount(0);

    await page.locator('[data-item-id="CAL-2026-0009"]').click();
    await expect(page).toHaveURL(/item=CAL-2026-0009/);
    const detail = page.getByTestId("work-detail");
    await expect(detail).toHaveAttribute("data-item-id", "CAL-2026-0009");
    await expect(detail.getByTestId("conflicts")).toContainText("Operational Risk weekly huddle");
    await expect(detail.getByTestId("preparation")).toBeVisible();
    await expect(detail.getByTestId("dependent-work").locator("li").first()).toBeVisible();
    await expect(detail.getByTestId("next-action")).toBeVisible();
    await noHorizontalOverflow(page, "agenda detail");

    /* The process link lands on the process page. */
    const processLink = detail.getByTestId("linked-process").getByRole("link").first();
    const href = await processLink.getAttribute("href");
    expect(href).toContain("/workday/rcsa/processes/rcsa-cycle");
    const processResponse = await page.request.get(`${base()}${href}`);
    expect(processResponse.status()).toBeLessThan(400);

    /* The object link lands on the hub filtered to that object. */
    const objectLink = detail.locator('[data-related-kind="object"] a').first();
    await objectLink.click();
    await expect(page).toHaveURL(/object=CTL-PAY-014/);
    await expect(page.getByTestId("work-queue")).toBeVisible();
  });

  test("offers Day and Week views from the URL", async ({ page }) => {
    await open(page, "/workday/tprm/work?scope=week");
    const groups = page.getByTestId("work-queue").locator("section.wd-work-group");
    await expect(groups).toHaveCount(7);
    await expect(page.getByText("No agenda entries on this day.").first()).toBeVisible();
    await noHorizontalOverflow(page, "week view");
  });

  test("keeps the selection across tabs and binds the drawer and the AI Partner to it", async ({ page }) => {
    await open(page, "/workday/tprm/work?item=CAL-2026-0003");
    await expect(page.getByTestId("work-detail")).toHaveAttribute("data-item-id", "CAL-2026-0003");

    await page.locator('a[data-tab="actions"]').click();
    await expect(page).toHaveURL(/view=actions/);
    await expect(page).toHaveURL(/item=CAL-2026-0003/);
    await expect(page.getByTestId("work-detail")).toHaveAttribute("data-item-id", "CAL-2026-0003");
    await expect(page.getByTestId("selected-elsewhere")).toBeVisible();

    await page.locator('a[data-tab="agenda"]').click();
    await expect(page.getByTestId("work-hub")).toHaveAttribute("data-tab", "agenda");
    await expect(page.locator('[data-item-id="CAL-2026-0003"][aria-current="true"]')).toBeVisible();

    /*
     * The drawer shows the selected item, not the empty state. Retried as one
     * step, because the click can land while the navigation above is still
     * replacing the pane it sits in.
     */
    const drawer = page.getByRole("dialog", { name: /Context|Kontext/ });
    await expect(async () => {
      if (!(await drawer.isVisible())) await page.locator('[data-related-kind="evidence"] button').click();
      await expect(drawer.getByTestId("bound-context")).toHaveAttribute("data-item-id", "CAL-2026-0003", { timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await expect(drawer.getByText("Nothing selected")).toHaveCount(0);
    for (const tab of ["Details", "Activity", "Audit", "Evidence"]) {
      await drawer.getByRole("tab", { name: tab }).click();
      await expect(drawer.getByText("Nothing selected")).toHaveCount(0);
    }
    await page.keyboard.press("Escape");

    /* The AI Partner is asked about the object the selected meeting is about. */
    const partnerRequest = page.waitForRequest((request) => request.url().includes("/api/workday/partner"));
    await page.getByRole("button", { name: /^AI Partner|^KI Partner/ }).click();
    const request = await partnerRequest;
    expect(decodeURIComponent(request.url())).toContain("selection=supplier:TP-0042");
  });

  test("keeps the drawer bound after leaving the Work Hub", async ({ page }) => {
    await open(page, "/workday/tprm/work?view=actions&item=MSN-2026-0188");
    await page.locator('[data-related-kind="evidence"] button').click();
    await expect(page.getByTestId("bound-context")).toHaveAttribute("data-item-id", "MSN-2026-0188");
    await page.keyboard.press("Escape");

    /* A development server compiles Home on its first visit, which can take a while. */
    await page.getByRole("link", { name: /^Home|^Startseite/ }).first().click();
    await expect(page).toHaveURL(/\/workday\/tprm(\?|$)/, { timeout: 90_000 });
    const stored = await page.evaluate(() => window.sessionStorage.getItem("nfr.work.bound"));
    expect(stored).toContain("MSN-2026-0188");
  });
});

test.describe("Actions", () => {
  test("has no static fallback and filters by saved view", async ({ page }) => {
    await open(page, "/workday/rcsa/work?view=actions&filter=waiting-others");
    const ids = await page
      .getByTestId("work-queue")
      .locator("[data-item-id]")
      .evaluateAll((elements) => elements.map((element) => element.getAttribute("data-item-id")));
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(id).toMatch(/^(MSN|REQ)-/);
    await expect(page.getByText("Collect Q3 KRI data from Risk Operations")).toHaveCount(0);
    await noHorizontalOverflow(page, "actions queue");
  });

  test("closes only with evidence, and records the closure in the history", async ({ page }) => {
    requireIsolatedStack();
    await open(page, "/workday/tprm/work?view=actions&item=MSN-2026-0209");
    const detail = page.getByTestId("work-detail");
    const complete = detail.locator('[data-operation="complete"]');
    test.skip(!(await complete.isEnabled()), "MSN-2026-0209 is already closed. Reseed the isolated stack.");

    const form = await openOperation(page, "complete", "form-complete");
    await form.locator('textarea[name="note"]').fill("September availability reviewed against the contracted level.");
    await form.getByTestId("operation-submit").click();
    await expect(detail.getByTestId("operation-result")).toHaveAttribute("data-ok", "false");
    await expect(detail.getByTestId("operation-result")).toContainText("evidence");

    /* A refused closure leaves the form open with what was typed. */
    await expect(form).toBeVisible();
    await form.locator('input[name="otherEvidence"]').fill("EVD-2026-41810");
    await form.getByTestId("operation-submit").click();
    await expect(detail.getByTestId("operation-result")).toHaveAttribute("data-ok", "true");
    await expect(detail.getByTestId("work-history")).toContainText("Completed");
    await expect(detail.getByTestId("work-history")).toContainText("EVD-2026-41810");
    await expect(detail.locator('[data-operation="reopen"]')).toBeEnabled();
  });

  test("holds a material closure until the person confirms it", async ({ page }) => {
    requireIsolatedStack();
    await open(page, "/workday/tprm/work?view=actions&item=MSN-2026-0195");
    const detail = page.getByTestId("work-detail");
    await expect(detail.getByTestId("materiality")).toContainText("Material because");
    const complete = detail.locator('[data-operation="complete"]');
    test.skip(!(await complete.isEnabled()), "MSN-2026-0195 is already closed. Reseed the isolated stack.");

    const form = await openOperation(page, "complete", "form-complete");
    await form.locator('textarea[name="note"]').fill("Every open question answered or carried as a condition.");
    await form.locator('input[name="otherEvidence"]').fill("EVD-2026-41445");
    await expect(form.getByTestId("operation-submit")).toBeDisabled();
    await form.locator('input[name="confirmed"]').check();
    await expect(form.getByTestId("operation-submit")).toBeEnabled();
    await form.getByRole("button", { name: /Cancel|Abbrechen/ }).click();
  });

  test("appends an update with a blocker, then drafts and sends a simulated reminder", async ({ page }) => {
    requireIsolatedStack();
    await open(page, "/workday/tprm/work?view=actions&filter=waiting-others&item=MSN-2026-0184");
    const detail = page.getByTestId("work-detail");
    const historyBefore = await detail.getByTestId("work-history").locator("li").count();

    const update = await openOperation(page, "add-update", "form-add-update");
    await update.locator('textarea[name="note"]').fill("Supplier will not release the scope statement before the commercial review.");
    await update.locator('input[name="blocker"]').check();
    await update.getByTestId("operation-submit").click();
    await expect(detail.getByTestId("operation-result")).toHaveAttribute("data-ok", "true");
    await expect(detail.getByTestId("blocker")).toContainText("scope statement");
    await expect(detail.getByTestId("work-history").locator("li")).toHaveCount(historyBefore + 1);

    const reminder = await openOperation(page, "draft-reminder", "form-send-reminder");
    await expect(reminder.locator('textarea[name="body"]')).toHaveValue(/verbal assurance/);
    await reminder.getByTestId("operation-submit").click();
    await expect(detail.getByTestId("operation-result")).toHaveAttribute("data-ok", "true");
    await expect(detail.getByTestId("latest-follow-up")).toContainText("Outstanding item");
    await noHorizontalOverflow(page, "action detail after operations");
  });
});
