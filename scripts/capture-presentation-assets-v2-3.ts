/**
 * capture-presentation-assets-v2-3.ts
 *
 * Strict Playwright-based capture script for V2.3 product-proof assets.
 *
 * Key improvements over V2.2:
 * 1. Registry-driven: reads from ASSET_REGISTRY, no hardcoded targets
 * 2. Auth failure detection: stops entire run immediately on login redirect
 * 3. Strict region failure: exits immediately if data-presentation-region not found
 * 4. Waits for data-presentation-ready="true" before screenshotting
 * 5. File size validation: rejects suspiciously small files (<10 KB)
 * 6. SHA-256 manifest written on success
 *
 * Usage: npm run presentation:refresh-assets
 * Env:   NFR_CAPTURE_BASE=http://localhost:3000 (default)
 */

import { chromium } from "@playwright/test";
import { statSync, writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import { ASSET_REGISTRY, ASSET_DIR, ASSET_VERSION } from "../src/presentation-v2-3/product-proof/asset-registry";
import type { PresentationAssetDefinition } from "../src/presentation-v2-3/product-proof/asset-registry";

const BASE_URL = process.env["NFR_CAPTURE_BASE"] ?? "http://localhost:3000";
const ROOT = process.cwd();

/* --------------------------------------------------------------------------
   URL builder
   -------------------------------------------------------------------------- */

function buildUrl(route: string): string {
  // Route may already contain query params (e.g. /path?stage=x)
  const [pathname, existingQuery] = route.split("?");
  const url = new URL(pathname ?? route, BASE_URL);
  if (existingQuery) {
    const existing = new URLSearchParams(existingQuery);
    existing.forEach((v, k) => url.searchParams.set(k, v));
  }
  url.searchParams.set("presentationCapture", "1");
  url.searchParams.set("mode", "safe");
  return url.toString();
}

/* --------------------------------------------------------------------------
   Auth / login detection
   -------------------------------------------------------------------------- */

const LOGIN_INDICATORS = [
  "/login",
  "/signin",
  "/sign-in",
  "/auth/",
  "?redirect=",
  "?next=",
];

function isLoginPage(url: string): boolean {
  const lower = url.toLowerCase();
  return LOGIN_INDICATORS.some((indicator) => lower.includes(indicator));
}

/* --------------------------------------------------------------------------
   SHA-256 of file
   -------------------------------------------------------------------------- */

function sha256File(filePath: string): string {
  const content = readFileSync(filePath);
  return createHash("sha256").update(content).digest("hex");
}

/* --------------------------------------------------------------------------
   Per-asset capture
   -------------------------------------------------------------------------- */

async function captureAsset(
  page: import("@playwright/test").Page,
  asset: PresentationAssetDefinition,
  outDir: string
): Promise<{ id: string; sha256: string; sizeBytes: number }> {
  const targetUrl = buildUrl(asset.route);
  console.log(`  -> ${asset.id}: navigating to ${targetUrl}`);

  await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 60000 });

  const finalUrl = page.url();
  if (isLoginPage(finalUrl)) {
    throw new Error(
      `[FATAL] Auth redirect on "${asset.id}": page landed at ${finalUrl}. ` +
        `Stopping capture run: authenticate the app first.`
    );
  }

  // Wait for data-presentation-ready="true"
  const readySelector = `[data-presentation-region="${asset.region}"][data-presentation-ready="true"]`;
  const baseSelector = `[data-presentation-region="${asset.region}"]`;

  try {
    await page.waitForSelector(readySelector, { timeout: 30000 });
    console.log(`     region "${asset.region}" ready`);
  } catch {
    // Check whether region exists at all without ready attribute
    const el = await page.$(baseSelector);
    if (!el) {
      throw new Error(
        `[FATAL] Region "${asset.region}" not found on asset "${asset.id}". ` +
          `Add data-presentation-region="${asset.region}" to the product page. ` +
          `Stopping capture run.`
      );
    }
    console.warn(
      `  [WARN] Region "${asset.region}" exists but data-presentation-ready="true" not set within 30s. ` +
        `Capturing anyway. Add data-presentation-ready when content is stable.`
    );
  }

  // Get element
  const regionEl = await page.$(baseSelector);
  if (!regionEl) {
    throw new Error(
      `[FATAL] Region "${asset.region}" disappeared after wait on asset "${asset.id}". Stopping capture run.`
    );
  }

  const outFile = join(outDir, asset.file);
  await regionEl.screenshot({ path: outFile });

  const stats = statSync(outFile);
  if (stats.size < 10000) {
    throw new Error(
      `[FATAL] Captured file for "${asset.id}" is suspiciously small (${stats.size} bytes). ` +
        `Likely a blank or login-screen image. Stopping capture run.`
    );
  }

  const sha = sha256File(outFile);
  console.log(`     ok: ${(stats.size / 1024).toFixed(1)} KB  sha256:${sha.slice(0, 12)}...`);
  return { id: asset.id, sha256: sha, sizeBytes: stats.size };
}

/* --------------------------------------------------------------------------
   Main
   -------------------------------------------------------------------------- */

async function main() {
  console.log(`NFR WorkOS: V2.3 presentation asset capture`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Registry: ${ASSET_REGISTRY.length} assets`);
  console.log("");

  const outDir = join(ROOT, ASSET_DIR);
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
    console.log(`Created: ${ASSET_DIR}`);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  type ManifestEntry = {
    id: string;
    file: string;
    placeholder: false;
    width: number;
    height: number;
    sizeBytes: number;
    sha256: string;
    capturedAt: string;
  };

  const results: ManifestEntry[] = [];
  let failed = false;

  for (const asset of ASSET_REGISTRY) {
    try {
      const { sha256, sizeBytes } = await captureAsset(page, asset, outDir);
      results.push({
        id: asset.id,
        file: asset.file,
        placeholder: false,
        width: asset.width,
        height: asset.height,
        sizeBytes,
        sha256,
        capturedAt: new Date().toISOString(),
      });
    } catch (err) {
      failed = true;
      console.error(`\n${(err as Error).message}\n`);
      break; // stop entire run on first fatal error
    }
  }

  await browser.close();

  if (results.length > 0) {
    const manifest = {
      version: ASSET_VERSION,
      capturedAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      assets: results,
    };
    const manifestPath = join(outDir, "manifest.json");
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
    console.log(`\nManifest written: ${ASSET_DIR}/manifest.json`);
  }

  if (failed) {
    console.error(`\nCapture run FAILED. ${results.length}/${ASSET_REGISTRY.length} assets captured before failure.`);
    process.exit(1);
  }

  console.log(`\nCapture complete: ${results.length}/${ASSET_REGISTRY.length} assets captured.`);
}

main().catch((err) => {
  console.error("Capture run fatal error:", err);
  process.exit(1);
});
