#!/usr/bin/env node
/**
 * Rehearses the five-act meeting journey against a running NFR Workspace and
 * writes the fallback assets from it: one screenshot per step, an optional
 * screen recording, the step timings and a captures.json index.
 *
 *   node scripts/demo/rehearse.mjs [--base http://localhost:3200] [--out exports/demo-fallback-v6]
 *                                  [--video] [--no-reset] [--width 1920 --height 1080]
 *
 * The journey follows docs/NFR_WORKSPACE_PRESENTER_GUIDE.md: startup and
 * sign-in (act 1), Today (act 2), the first question as a visual answer with
 * evidence and the concentration follow-up (act 3), the governed write-back
 * with its receipt and audit entry (act 4), Save as agent (act 5). It commits
 * a real write-back, so it refuses to run against port 3000, and it resets the
 * demonstration at the end unless --no-reset is given, leaving a clean day.
 * Exits 1 on a failed step or a console error.
 */

import { mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback;
};
const flag = (name) => argv.includes(`--${name}`);

const BASE = opt("base", "http://localhost:3200").replace(/\/$/, "");
const OUT = resolve(opt("out", "exports/demo-fallback-v6"));
const WIDTH = Number(opt("width", "1920"));
const HEIGHT = Number(opt("height", "1080"));
const VIDEO = flag("video");
const RESET = !flag("no-reset");
const QUESTION = "Which critical third-party services are deteriorating, and why?";

if (/:3000$/.test(BASE)) {
  console.error("Refusing to rehearse against port 3000: the rehearsal commits a write-back. Use the showcase (3200) or an isolated stack.");
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) if (/\.(png|webm|json)$/.test(f)) rmSync(join(OUT, f));

const captures = [];
const timings = [];
const errors = [];
let shotNo = 0;

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  colorScheme: "light",
  ...(VIDEO ? { recordVideo: { dir: OUT, size: { width: WIDTH, height: HEIGHT } } } : {}),
});
const page = await context.newPage();
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

async function shot(act, step, caption) {
  shotNo += 1;
  const file = `${String(shotNo).padStart(2, "0")}-act${act}-${step}.png`;
  await page.waitForTimeout(350);
  await page.screenshot({ path: join(OUT, file) });
  const route = new URL(page.url()).pathname + new URL(page.url()).search;
  captures.push({ file, act, step, route, caption });
}
async function timed(label, fn) {
  const t = Date.now();
  await fn();
  const ms = Date.now() - t;
  timings.push({ step: label, ms });
  console.log(`  ${label}: ${ms} ms`);
}
const visible = (locator, timeout = 60_000) => locator.first().waitFor({ state: "visible", timeout });

let failed = null;
try {
  console.log(`Rehearsing against ${BASE} at ${WIDTH}x${HEIGHT}`);
  await context.clearCookies();

  // ── Act 1: the Workspace feels real ──
  await timed("startup to sign-in", async () => {
    await page.goto(BASE + "/", { timeout: 120_000 });
    await visible(page.getByTestId("sign-in-form"), 30_000);
  });
  await shot(1, "sign-in", "The startup ends on the sign-in. Synthetic institution and data.");
  await page.getByLabel("Username").fill("Admin");
  await page.getByLabel("Password", { exact: true }).fill("wrong");
  await page.getByLabel("Password", { exact: true }).press("Enter");
  await visible(page.getByTestId("sign-in-error"), 15_000);
  await shot(1, "sign-in-refused", "A wrong password is refused without saying which field was wrong.");
  await page.getByLabel("Password", { exact: true }).fill("Admin");
  await timed("sign-in to Today", async () => {
    await page.getByLabel("Password", { exact: true }).press("Enter");
    await visible(page.getByTestId("preparing"), 15_000);
    await page.waitForTimeout(600);
    await shot(1, "preparing", "Sign-in resolves the role, its authority and the decisions that need a person.");
    await page.waitForURL(/\/workday\/tprm$/, { timeout: 120_000 });
    await visible(page.locator(".wd-now"), 60_000);
  });

  // ── Act 2: the next decision arrives prepared ──
  await shot(2, "today", "Today for the Third-Party Risk Manager: one item needs you now, at most three next.");
  const done = page.locator("[data-home-region='done'] summary, [data-home-region='done'] button").first();
  if (await done.count()) {
    await done.click().catch(() => {});
    await shot(2, "today-done", "Done today: what ran without the person.");
    await done.click().catch(() => {});
  }
  const nowEvidence = page.locator(".wd-now").getByRole("button", { name: /^Evidence/ }).or(page.locator(".wd-now").getByRole("link", { name: /^Evidence/ }));
  if (await nowEvidence.count()) {
    await nowEvidence.first().click();
    await page.waitForTimeout(700);
    await shot(2, "now-evidence", "The evidence behind the item that needs a decision.");
    await page.keyboard.press("Escape");
    if (!/\/workday\/tprm$/.test(page.url())) await page.goto(BASE + "/workday/tprm");
    await visible(page.locator(".wd-now"));
  }

  // ── Act 3: a live question, a visual answer ──
  const ask = page.getByTestId("home-ask-input");
  await ask.fill(QUESTION);
  await timed("first question to visual answer", async () => {
    await ask.press("Enter");
    await visible(page.getByTestId("insight-canvas"), 120_000);
    await visible(page.locator("[data-testid^='viz-']"), 30_000);
  });
  const analysisUrl = page.url();
  await shot(3, "visual-answer", "The answer is a governed analysis from the records: conclusion, figures and a ranked chart.");
  const findings = page.locator(".ins-finding").first();
  if (await findings.count()) {
    await findings.scrollIntoViewIfNeeded();
    await shot(3, "findings", "What the records show, each finding with its sources.");
  }
  const sources = page.getByTestId("evidence-open");
  if (await sources.count()) {
    await timed("evidence drawer", async () => {
      await sources.first().click();
      await visible(page.getByTestId("evidence-drawer"), 15_000);
    });
    await shot(3, "evidence", "Evidence with its freshness; a stale recovery test is marked.");
    await page.keyboard.press("Escape");
  }
  const concentration = page.getByRole("button", { name: /^Concentration/ }).or(page.getByRole("link", { name: /^Concentration/ }));
  if (await concentration.count()) {
    await timed("concentration follow-up", async () => {
      await concentration.first().click();
      await page.waitForURL((u) => u.toString() !== analysisUrl, { timeout: 120_000 });
      await visible(page.locator("[data-testid='viz-network'], [data-testid^='viz-']"), 60_000);
    });
    await shot(3, "concentration", "Concentration: one underlying provider under several critical suppliers.");
    await page.goto(analysisUrl);
    await visible(page.getByTestId("insight-canvas"));
  }

  // ── Act 4: from insight to action ──
  const review = page.locator("[data-testid^='review-']").first();
  await review.scrollIntoViewIfNeeded();
  await shot(4, "recommended-step", "The recommended next step, with a review before anything is written.");
  await timed("open write-back review", async () => {
    await review.click();
    await visible(page.getByTestId("writeback-dialog"), 15_000);
  });
  await shot(4, "review", "The review: system of record, every field before and after, the evidence and the authority.");
  await page.getByTestId("writeback-confirm").check();
  await shot(4, "confirmed", "The professional confirms the judgment and the reason are their own.");
  await timed("commit to receipt", async () => {
    await page.getByTestId("writeback-commit").click();
    await visible(page.getByTestId("writeback-receipt"), 60_000);
  });
  await shot(4, "receipt", "The receipt: transaction, the new record, the approval bound to this payload, who and when.");
  const transaction = (await page.getByTestId("receipt-transaction").innerText()).trim();
  const openRecord = page.getByRole("link", { name: "Open the record" });
  const recordHref = (await openRecord.count()) ? await openRecord.first().getAttribute("href") : null;
  await timed("audit log entry", async () => {
    await page.goto(`${BASE}/workday/tprm/insights/records?source=audit&record=${encodeURIComponent(transaction)}`);
    await visible(page.getByTestId("records-page"), 30_000);
  });
  await shot(4, "audit-log", `The audit log holds the transaction ${transaction}.`);
  if (recordHref) {
    await page.goto(BASE + recordHref);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(800);
    await shot(4, "record", "The new record in the Work Hub.");
  }

  // ── Act 5: the long tail, governed ──
  await page.goto(analysisUrl);
  await visible(page.getByTestId("insight-canvas"));
  const saveAgent = page.getByRole("link", { name: "Save as agent" }).or(page.getByRole("button", { name: "Save as agent" }));
  await timed("open Agent Builder", async () => {
    await saveAgent.first().click();
    await visible(page.getByTestId("agent-builder"), 60_000);
  });
  await shot(5, "agent-builder", "Save as agent: outcome, scope and permissions, plan, run and save. It inherits your access.");
  const permissions = page.getByText("This agent inherits your access", { exact: false });
  if (await permissions.count()) {
    await permissions.first().scrollIntoViewIfNeeded();
    await shot(5, "agent-permissions", "This agent inherits your access. It does not create new access.");
  }
  const schedule = page.getByRole("button", { name: "Save and run weekly" });
  if (await schedule.count()) {
    await timed("save and schedule agent", async () => {
      await schedule.first().click();
      await visible(page.getByTestId("my-agents"), 60_000);
    });
    await page.getByTestId("my-agents").scrollIntoViewIfNeeded();
    await shot(5, "my-agents", "The agent under My agents with its weekly schedule and run history.");
  }

  // ── Reset to a clean day ──
  if (RESET) {
    await page.goto(BASE + "/workday/tprm");
    await visible(page.locator(".wd-now"));
    await page.getByTestId("header-account").click();
    await page.getByTestId("account-reset").click();
    await shot(5, "reset-confirm", "Reset demonstration asks for one confirmation before restoring the seeded day.");
    await timed("reset", async () => {
      await page.getByTestId("account-reset").click();
      await page.waitForFunction(() => {
        const b = document.querySelector("[data-testid='account-reset']");
        return !b || b.getAttribute("data-state") === "done";
      }, null, { timeout: 120_000 });
    });
  }
} catch (error) {
  failed = error;
  console.error("Rehearsal step failed: " + (error instanceof Error ? error.message.split("\n")[0] : error));
  await page.screenshot({ path: join(OUT, "failed.png") }).catch(() => {});
}

const video = VIDEO ? page.video() : null;
await context.close();
await browser.close();
if (video) {
  const raw = await video.path();
  renameSync(raw, join(OUT, "five-act-journey.webm"));
}

writeFileSync(join(OUT, "captures.json"), JSON.stringify({
  base: BASE, viewport: `${WIDTH}x${HEIGHT}`, question: QUESTION, generatedAt: new Date().toISOString(),
  video: VIDEO ? "five-act-journey.webm" : null, captures, timings, consoleErrors: errors,
}, null, 2) + "\n");

console.log(`${captures.length} screenshots, ${errors.length} console errors, written to ${OUT}`);
errors.forEach((e) => console.log("  console: " + e));
process.exit(failed || errors.length ? 1 : 0);
