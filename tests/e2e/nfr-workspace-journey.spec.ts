/**
 * The NFR Workspace critical journey, end to end (brief section 18.1).
 *
 * Startup, sign-in (wrong, then right), the prepared Today with one Now and
 * at most three Next, a question asked about the case, a structured visual
 * answer with metrics, a chart, findings and evidence, a governed
 * write-back reviewed and committed with a receipt, the audit log entry,
 * a refresh that keeps the session, the reset, and the sign-out.
 *
 * The steps that change state (the commit and the reset) run only against
 * an isolated stack named through NFR_BASE_URL on a port other than 3000,
 * so this file cannot change somebody's presentation.
 */

import { expect, test } from "@playwright/test";

const BASE_URL = process.env.NFR_BASE_URL ?? "";
const ISOLATED_STACK = BASE_URL.length > 0 && !/:3000(\/|$)/.test(BASE_URL);

test.describe.configure({ mode: "serial" });
test.use({ storageState: { cookies: [], origins: [] } });

test("the loop: sign in, see the work, ask, read the analysis, act, get a receipt", async ({ page }) => {
  test.setTimeout(300_000);
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(String(error)));

  /* 1 to 3. Startup, then the sign-in. */
  await page.goto("/", { timeout: 180_000 });
  await expect(page.getByTestId("sign-in-form")).toBeVisible({ timeout: 20_000 });

  /* 4. Wrong details are refused in place. */
  await page.getByLabel("Username").fill("Admin");
  await page.getByLabel("Password", { exact: true }).fill("admin");
  await page.getByLabel("Password", { exact: true }).press("Enter");
  await expect(page.getByTestId("sign-in-error")).toBeVisible();

  /* 5 and 6. The demonstration account opens the workspace, after the context steps. */
  await page.getByLabel("Password", { exact: true }).fill("Admin");
  await page.getByLabel("Password", { exact: true }).press("Enter");
  await expect(page.getByTestId("preparing")).toBeVisible();
  await expect(page).toHaveURL(/\/workday\/tprm$/, { timeout: 120_000 });

  /* 7. One Now, at most three Next. */
  await expect(page.locator(".wd-now")).toHaveCount(1, { timeout: 60_000 });
  expect(await page.locator("[data-home-region='next'] .wd-item").count()).toBeLessThanOrEqual(3);

  /* 8 and 9. Ask about the case. */
  await page.getByTestId("now-ask-case").click();
  await expect(page.getByTestId("insight-canvas")).toBeVisible({ timeout: 120_000 });

  /* 10. A structured answer: a conclusion, key numbers, a chart, findings, a recommended action. */
  await expect(page.getByTestId("insight-conclusion")).toContainText("Record the decision");
  await expect(page.getByTestId("insight-metrics").locator(".ins-metric")).not.toHaveCount(0);
  await expect(page.locator("[data-testid^='viz-']").first()).toBeVisible();
  await expect(page.locator(".ins-finding").first()).toBeVisible();

  /* 11. The evidence drawer. */
  await page.getByTestId("evidence-open").click();
  await expect(page.getByTestId("evidence-drawer")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("evidence-drawer")).toBeHidden();

  /* 12 and 13. Review the proposed change: target, before and after, authority. */
  await page.locator("[data-testid^='review-']").first().click();
  const dialog = page.getByTestId("writeback-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Before");
  await expect(dialog).toContainText("After");
  await expect(page.getByTestId("writeback-commit")).toBeDisabled();

  if (ISOLATED_STACK) {
    /* 14 and 15. Commit through the gate; the receipt names the transaction. */
    await page.getByTestId("writeback-confirm").check();
    await page.getByTestId("writeback-commit").click();
    await expect(page.getByTestId("writeback-receipt")).toBeVisible({ timeout: 60_000 });
    const transaction = (await page.getByTestId("receipt-transaction").innerText()).trim();
    expect(transaction).toMatch(/^AUD-/);

    /* 16. The audit log holds the transaction. */
    await page.goto(`/workday/tprm/insights/records?source=audit&record=${encodeURIComponent(transaction)}`);
    await expect(page.locator("[data-selected='true']")).toContainText(transaction);

    /* 17 and 18. A refresh keeps the session. */
    await page.reload();
    await expect(page.getByTestId("records-page")).toBeVisible();

    /* 20. Reset returns the day to its seeded state. */
    await page.goto("/workday/tprm");
    await page.getByTestId("header-account").click();
    await page.getByTestId("account-reset").click();
    await page.getByTestId("account-reset").click();
    await expect(page.getByTestId("account-reset")).toHaveAttribute("data-state", "done", { timeout: 120_000 });
  } else {
    await page.getByRole("button", { name: "Cancel" }).click();
  }

  /* 19. Sign out returns to the entrance; the workspace is guarded again. */
  await page.goto("/workday/tprm");
  await page.getByTestId("header-account").click();
  await page.getByTestId("account-sign-out").click();
  await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
  await page.goto("/workday/tprm");
  await expect(page).toHaveURL(/\/login\?next=/);

  expect(consoleErrors, consoleErrors.join("\n")).toHaveLength(0);
});

test("an analytical question asked in the AI Partner is answered from the records", async ({ page }) => {
  test.setTimeout(240_000);
  await page.request.post("/api/session", { data: { username: "Admin", password: "Admin" } });
  await page.goto("/workday/tprm", { timeout: 180_000 });
  await page.getByTestId("header-ai").click();
  const box = page.locator("textarea").first();
  await box.fill("Which risk acceptances expire in the next 90 days?");
  await box.press("Enter");
  await expect(page.getByText(/risk acceptances expire within 90 days/i).first()).toBeVisible({ timeout: 90_000 });
  await expect(page.getByRole("link", { name: "Open the full analysis" }).first()).toBeVisible();
});
