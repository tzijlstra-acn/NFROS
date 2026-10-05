/**
 * Captures the V2.4 product-proof screenshots from the running app.
 *
 * Read-only and strict: it never resets the database and never falls back to a
 * full-page capture. Any drift from the approved seeded day fails the run.
 *
 * Usage: npm run presentation:capture-v2-4
 * Subset: npx tsx scripts/capture-presentation-assets-v2-4.ts --only=or-home,tprm-home
 * Env:   NFR_CAPTURE_BASE (default http://localhost:3000)
 */

import { chromium, type Browser, type Locator, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ASSET_DIR_V24,
  ASSET_REGISTRY_V24,
  ASSET_VERSION_V24,
  BLOCKED_ASSETS_V24,
  CAPTURE_DEVICE_SCALE_FACTOR_V24,
  CAPTURE_THEME_V24,
  CAPTURE_UI_VERSION_V24,
  CAPTURE_VIEWPORT_V24,
  PAGE_FORBIDDEN_TEXT_V24,
  WRITE_ACTION_NAMES_V24,
  regionSelectorV24,
  type CaptureStepV24,
  type CapturedAssetV24,
  type PresentationAssetDefinition,
  type PresentationAssetIdV24,
  type PresentationManifestV24,
  type SubRegionBoxV24,
} from "../src/presentation-v2-4/product-proof/asset-registry";
import { MANIFEST_FILE_V24 } from "../src/presentation-v2-4/product-proof/manifest-schema";
import { readManifestV24 } from "../src/presentation-v2-4/product-proof/manifest-node";
import { computePngStats, imageProblems } from "../src/presentation-v2-4/product-proof/png-stats";
import {
  DOCS_PATH_V24,
  renderAssetTableV24,
  replaceDocsBlockV24,
} from "../src/presentation-v2-4/product-proof/docs-table";

const BASE_URL = process.env["NFR_CAPTURE_BASE"] ?? "http://localhost:3000";
const ROOT = process.cwd();
const OUT_DIR = join(ROOT, ASSET_DIR_V24);
const DSF = CAPTURE_DEVICE_SCALE_FACTOR_V24;

const LOGIN_URL_PATTERNS = ["/login", "/signin", "/sign-in", "/auth/", "redirect="];
const NEXT_OVERLAY_SELECTOR = "[data-nextjs-dialog], [data-nextjs-dialog-overlay]";

class CaptureFailure extends Error {}

function fail(id: string, message: string): never {
  throw new CaptureFailure(`[${id}] ${message}`);
}

const normalise = (text: string) => text.replace(/\s+/g, " ").trim();
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function forbiddenPattern(text: string): RegExp {
  const start = /^\w/.test(text) ? "\\b" : "";
  const end = /\w$/.test(text) ? "\\b" : "";
  return new RegExp(`${start}${escapeRegExp(text)}${end}`);
}

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function git(command: string): string {
  try {
    return execSync(`git ${command}`, { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

function buildUrl(route: string): string {
  return new URL(route, BASE_URL).toString();
}

function parseOnly(): Set<PresentationAssetIdV24> | null {
  const arg = process.argv.find((value) => value.startsWith("--only="));
  if (!arg) return null;
  const ids = arg.slice("--only=".length).split(",").filter(Boolean);
  for (const id of ids) {
    if (!ASSET_REGISTRY_V24.some((asset) => asset.id === id)) {
      throw new Error(`--only names an unknown asset: ${id}`);
    }
  }
  return new Set(ids as PresentationAssetIdV24[]);
}

/* Page checks */

async function assertNotLogin(page: Page, id: string): Promise<void> {
  const url = page.url().toLowerCase();
  if (LOGIN_URL_PATTERNS.some((pattern) => url.includes(pattern))) {
    fail(id, `landed on a login page (${page.url()}). The demo needs no login; check the app.`);
  }
  if ((await page.locator('input[type="password"]').count()) > 0) {
    fail(id, "the page shows a password field, which looks like a login page.");
  }
}

async function assertNoDevOverlay(page: Page, id: string): Promise<void> {
  const overlay = page.locator(NEXT_OVERLAY_SELECTOR).first();
  if ((await overlay.count()) > 0 && (await overlay.isVisible())) {
    const text = normalise(await overlay.innerText().catch(() => ""));
    fail(id, `the Next.js error overlay is open: ${text.slice(0, 200)}`);
  }
  const buildError = page.getByText(/^(Build Error|Runtime Error|Unhandled Runtime Error)$/).first();
  if ((await buildError.count()) > 0 && (await buildError.isVisible())) {
    fail(id, "a Next.js build or runtime error is on screen.");
  }
}

async function assertPageText(page: Page, id: string): Promise<void> {
  const body = await page.locator("body").innerText();
  for (const text of PAGE_FORBIDDEN_TEXT_V24) {
    if (body.includes(text)) fail(id, `the page shows "${text}".`);
  }
}

async function assertWorkdayShell(page: Page, asset: PresentationAssetDefinition): Promise<void> {
  const root = page.locator(".workday-v3").first();
  if ((await root.count()) === 0) {
    fail(asset.id, "no .workday-v3 root: the page did not render the V3.3 interface.");
  }
  const theme = await root.getAttribute("data-wd-theme");
  if (theme !== CAPTURE_THEME_V24) {
    fail(asset.id, `wrong theme: data-wd-theme is "${theme ?? "missing"}", expected "${CAPTURE_THEME_V24}".`);
  }
  const cookies = await page.context().cookies(BASE_URL);
  const ui = cookies.find((cookie) => cookie.name === "nfr-workday-ui")?.value;
  if (ui !== CAPTURE_UI_VERSION_V24) {
    fail(asset.id, `wrong UI version: nfr-workday-ui is "${ui ?? "missing"}", expected "${CAPTURE_UI_VERSION_V24}".`);
  }
  if (cookies.some((cookie) => cookie.name === "nfr-wd-demo")) {
    fail(asset.id, "the nfr-wd-demo cookie is set, which shows demo controls.");
  }
  const synthetic = page.locator("span.wd-synthetic").first();
  if ((await synthetic.count()) === 0 || !normalise(await synthetic.innerText()).includes("Synthetic institution and data")) {
    fail(asset.id, 'the bottom bar label "Synthetic institution and data" is missing.');
  }
}

async function waitUntilNotBusy(page: Page, region: Locator, id: string): Promise<void> {
  const deadline = Date.now() + 20_000;
  for (;;) {
    const inRegion = await region.evaluate(
      (el) => el.matches('[aria-busy="true"]') || el.querySelector('[aria-busy="true"]') !== null,
    );
    const onPage = await page.locator('[aria-busy="true"]:visible').count();
    if (!inRegion && onPage === 0) return;
    if (Date.now() > deadline) {
      fail(id, "a loading skeleton ([aria-busy=\"true\"]) is still visible after 20 seconds.");
    }
    await page.waitForTimeout(250);
  }
}

async function waitForRegionReady(page: Page, asset: PresentationAssetDefinition): Promise<Locator> {
  const selector = regionSelectorV24(asset.region);
  const named = selector !== asset.region;
  const ready = page.locator(named ? `${selector}[data-presentation-ready="true"]` : selector);
  try {
    await ready.first().waitFor({ state: "visible", timeout: 30_000 });
  } catch {
    const present = await page.locator(selector).count();
    if (present === 0) fail(asset.id, `missing region ${selector}.`);
    fail(asset.id, `region ${selector} is present but never reached data-presentation-ready="true".`);
  }
  const count = await ready.count();
  if (count !== 1) fail(asset.id, `expected exactly one ready region ${selector}, found ${count}.`);
  return ready.first();
}

/* Setup steps */

async function waitHydrated(page: Page, target: Locator, id: string, what: string): Promise<void> {
  const handle = await target.elementHandle({ timeout: 20_000 });
  if (!handle) fail(id, `${what} is not on the page.`);
  try {
    await page.waitForFunction(
      (el) => Object.keys(el as object).some((key) => key.startsWith("__reactProps$")),
      handle,
      { timeout: 20_000 },
    );
  } catch {
    fail(id, `${what} never hydrated, so clicking it would do nothing.`);
  } finally {
    await handle.dispose();
  }
}

async function runStep(
  page: Page,
  asset: PresentationAssetDefinition,
  step: CaptureStepV24,
  region: () => Promise<Locator>,
): Promise<void> {
  const scope: Page | Locator = step.within === "page" ? page : await region();
  console.log(`     step: ${step.describe}`);
  switch (step.action) {
    case "click": {
      if (WRITE_ACTION_NAMES_V24.some((pattern) => pattern.test(step.name))) {
        fail(asset.id, `refusing to click "${step.name}", which writes to the database.`);
      }
      const target = scope
        .getByRole(step.role, step.match === "exact"
          ? { name: step.name, exact: true }
          : { name: new RegExp(`^${escapeRegExp(step.name)}`) })
        .first();
      await waitHydrated(page, target, asset.id, `${step.role} "${step.name}"`);
      await target.click();
      if (step.expect) {
        try {
          await page.locator(step.expect).first().waitFor({ state: "visible", timeout: 15_000 });
        } catch {
          fail(asset.id, `after clicking "${step.name}", ${step.expect} did not appear.`);
        }
      }
      break;
    }
    case "fill": {
      const field = scope.locator(step.selector).first();
      await waitHydrated(page, field, asset.id, step.selector);
      await field.fill(step.value);
      break;
    }
    case "scroll": {
      const el = scope.locator(step.selector).first();
      await el.evaluate((node, to) => {
        node.scrollTop = to === "top" ? 0 : node.scrollHeight;
      }, step.to);
      break;
    }
  }
  await page.waitForLoadState("networkidle");
}

async function reapplyScrolls(page: Page, asset: PresentationAssetDefinition, region: Locator): Promise<void> {
  for (const step of asset.setup ?? []) {
    if (step.action !== "scroll") continue;
    const scope: Page | Locator = step.within === "page" ? page : region;
    await scope.locator(step.selector).first().evaluate((node, to) => {
      node.scrollTop = to === "top" ? 0 : node.scrollHeight;
    }, step.to);
  }
}

/* Region text, size and sub-regions */

async function assertRegionText(region: Locator, asset: PresentationAssetDefinition): Promise<void> {
  const text = normalise(await region.innerText());
  const lower = text.toLowerCase();
  const missing = asset.expectedText.filter((expected) => !lower.includes(normalise(expected).toLowerCase()));
  if (missing.length > 0) {
    fail(
      asset.id,
      `expected text missing: ${missing.map((m) => `"${m}"`).join(", ")}. The database may have drifted from the seeded day; run npm run demo:reset deliberately, then capture again.`,
    );
  }
  const present = asset.forbiddenText.filter((forbidden) => forbiddenPattern(forbidden).test(text));
  if (present.length > 0) {
    fail(asset.id, `forbidden text present: ${present.map((p) => `"${p}"`).join(", ")}.`);
  }
}

/** Grows the viewport height only when the region is taller than its visible scroll area. */
async function fitRegion(page: Page, region: Locator): Promise<{ width: number; height: number }> {
  const viewport: { width: number; height: number } = { ...CAPTURE_VIEWPORT_V24 };
  await page.setViewportSize(viewport);
  const overflow = await region.evaluate((el) => {
    const height = el.getBoundingClientRect().height;
    let visible = window.innerHeight;
    for (let node = el.parentElement; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) {
        visible = node.clientHeight;
        break;
      }
    }
    return Math.max(0, Math.ceil(height - visible));
  });
  if (overflow > 0) {
    viewport.height = CAPTURE_VIEWPORT_V24.height + overflow + 32;
    await page.setViewportSize(viewport);
    await page.waitForTimeout(400);
  }
  await region.scrollIntoViewIfNeeded();
  return viewport;
}

async function measureSubRegions(
  region: Locator,
  asset: PresentationAssetDefinition,
  imageWidth: number,
  imageHeight: number,
): Promise<Record<string, SubRegionBoxV24>> {
  const regionBox = await region.boundingBox();
  if (!regionBox) fail(asset.id, "region has no bounding box.");
  const result: Record<string, SubRegionBoxV24> = {};
  for (const [name, locator] of Object.entries(asset.subRegions ?? {})) {
    const target = region
      .locator(locator.selector, locator.hasText ? { hasText: locator.hasText } : undefined)
      .first();
    if ((await target.count()) === 0) {
      fail(asset.id, `sub-region "${name}" (${locator.selector}${locator.hasText ? ` with "${locator.hasText}"` : ""}) not found.`);
    }
    const b = await target.boundingBox();
    if (!b) fail(asset.id, `sub-region "${name}" is not visible.`);
    const x0 = Math.max(0, Math.round((b.x - regionBox.x) * DSF));
    const y0 = Math.max(0, Math.round((b.y - regionBox.y) * DSF));
    const x1 = Math.min(imageWidth, Math.round((b.x + b.width - regionBox.x) * DSF));
    const y1 = Math.min(imageHeight, Math.round((b.y + b.height - regionBox.y) * DSF));
    if (x1 <= x0 || y1 <= y0) fail(asset.id, `sub-region "${name}" lies outside the captured region.`);
    result[name] = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  }
  return result;
}

/* One asset */

async function captureAsset(
  browser: Browser,
  asset: PresentationAssetDefinition,
  stagingDir: string,
): Promise<CapturedAssetV24> {
  const context = await browser.newContext({
    viewport: { ...CAPTURE_VIEWPORT_V24 },
    deviceScaleFactor: DSF,
    colorScheme: "light",
    reducedMotion: "reduce",
    locale: "en-GB",
    timezoneId: "Europe/Berlin",
  });
  await context.addCookies([{ name: "nfr-wd-theme", value: CAPTURE_THEME_V24, url: BASE_URL }]);
  const page = await context.newPage();
  try {
    const url = buildUrl(asset.route);
    console.log(`  -> ${asset.id}: ${url}`);
    const response = await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });
    if (!response) fail(asset.id, "no response from the app.");
    if (response.status() >= 400) fail(asset.id, `HTTP ${response.status()} for ${url}.`);

    await assertNotLogin(page, asset.id);
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    await assertNoDevOverlay(page, asset.id);
    await assertPageText(page, asset.id);
    if (asset.requiresWorkdayShell) await assertWorkdayShell(page, asset);

    const region = () => waitForRegionReady(page, asset);
    for (const step of asset.setup ?? []) {
      await runStep(page, asset, step, region);
    }

    const target = await region();
    await waitUntilNotBusy(page, target, asset.id);
    await page.waitForLoadState("networkidle");
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    await assertNoDevOverlay(page, asset.id);
    await assertPageText(page, asset.id);
    await assertRegionText(target, asset);

    const viewport = await fitRegion(page, target);
    await reapplyScrolls(page, asset, target);
    await page.waitForTimeout(300);

    const buffer = await target.screenshot({ animations: "disabled", caret: "hide", scale: "device", timeout: 30_000 });
    const stats = computePngStats(buffer);
    const problems = imageProblems(stats, buffer.length, asset.requiresWorkdayShell);
    if (problems.length > 0) fail(asset.id, problems.join("; "));

    const subRegions = await measureSubRegions(target, asset, stats.width, stats.height);
    writeFileSync(join(stagingDir, asset.file), buffer);
    console.log(
      `     ok ${stats.width}x${stats.height} ${(buffer.length / 1024).toFixed(0)} KB, viewport ${viewport.width}x${viewport.height}, sub-regions: ${Object.keys(subRegions).join(", ") || "none"}`,
    );
    return {
      file: asset.file,
      width: stats.width,
      height: stats.height,
      deviceScaleFactor: DSF,
      sha256: sha256(buffer),
      route: asset.route,
      region: asset.region,
      bytes: buffer.length,
      viewport,
      background: stats.borderColor,
      subRegions,
    };
  } finally {
    await context.close();
  }
}

/* Main */

async function main(): Promise<void> {
  const only = parseOnly();
  const targets = ASSET_REGISTRY_V24.filter((asset) => !asset.blockedReason && (!only || only.has(asset.id)));
  console.log(`NFROS V2.4 product-proof capture (${ASSET_VERSION_V24})`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Viewport ${CAPTURE_VIEWPORT_V24.width}x${CAPTURE_VIEWPORT_V24.height} @${DSF}x, theme ${CAPTURE_THEME_V24}, ui ${CAPTURE_UI_VERSION_V24}`);
  for (const blocked of BLOCKED_ASSETS_V24) {
    console.log(`  skip ${blocked.id}: not captured. ${blocked.blockedReason ?? ""}`);
  }

  const stagingDir = mkdtempSync(join(tmpdir(), "nfr-v24-capture-"));
  const browser = await chromium.launch({ headless: true });
  const captured: Partial<Record<PresentationAssetIdV24, CapturedAssetV24>> = {};
  const failures: string[] = [];
  try {
    for (const asset of targets) {
      try {
        captured[asset.id] = await captureAsset(browser, asset, stagingDir);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(error instanceof CaptureFailure ? message : `[${asset.id}] ${message}`);
        console.error(`     FAILED ${message}`);
      }
    }
  } finally {
    await browser.close();
  }

  if (failures.length > 0) {
    rmSync(stagingDir, { recursive: true, force: true });
    console.error(`\nCapture FAILED for ${failures.length} of ${targets.length} assets. Nothing was written.`);
    for (const failure of failures) console.error(`  ${failure}`);
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  for (const entry of Object.values(captured)) {
    if (entry) copyFileSync(join(stagingDir, entry.file), join(OUT_DIR, entry.file));
  }
  rmSync(stagingDir, { recursive: true, force: true });
  for (const blocked of BLOCKED_ASSETS_V24) {
    const stale = join(OUT_DIR, blocked.file);
    if (existsSync(stale)) rmSync(stale);
  }

  const previous = only ? readManifestV24(ROOT) : null;
  const assets: Partial<Record<PresentationAssetIdV24, CapturedAssetV24>> = {};
  for (const asset of ASSET_REGISTRY_V24) {
    const entry = captured[asset.id] ?? (asset.blockedReason ? undefined : previous?.assets[asset.id]);
    if (entry) assets[asset.id] = entry;
  }
  const notCaptured: Partial<Record<PresentationAssetIdV24, string>> = {};
  for (const blocked of BLOCKED_ASSETS_V24) notCaptured[blocked.id] = blocked.blockedReason ?? "";

  const manifest: PresentationManifestV24 = {
    version: ASSET_VERSION_V24,
    capturedAt: new Date().toISOString(),
    commit: git("rev-parse --short HEAD") || "unknown",
    worktreeDirty: git("status --porcelain").length > 0,
    baseUrl: BASE_URL,
    assets,
    notCaptured,
  };
  writeFileSync(join(OUT_DIR, MANIFEST_FILE_V24), `${JSON.stringify(manifest, null, 2)}\n`);

  const docsPath = join(ROOT, DOCS_PATH_V24);
  const updated = existsSync(docsPath)
    ? replaceDocsBlockV24(readFileSync(docsPath, "utf8"), renderAssetTableV24(manifest))
    : null;
  if (updated) {
    writeFileSync(docsPath, updated);
    console.log(`Asset table refreshed in ${DOCS_PATH_V24}.`);
  } else {
    console.warn(`Asset table not refreshed: ${DOCS_PATH_V24} or its markers are missing.`);
  }
  console.log(`\nCaptured ${Object.keys(captured).length} assets into ${ASSET_DIR_V24}; manifest written.`);
}

main().catch((error: unknown) => {
  console.error("Capture run fatal error:", error);
  process.exit(1);
});
