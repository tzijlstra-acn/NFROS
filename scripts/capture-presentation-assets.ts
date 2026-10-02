#!/usr/bin/env tsx
/**
 * Captures product screenshots for use as slide assets in the NFROS presentation.
 *
 * Usage:    npm run capture:presentation-assets
 * Requires: a running Next.js dev server at http://localhost:3000
 * Output:   public/presentation-assets/v2.2/ with a manifest.json
 *
 * The script deliberately does not start the server. A capture run that boots
 * its own server cannot be pointed at a server a reviewer is already looking
 * at, and the whole purpose of these images is to agree with what is on screen.
 *
 * Authentication: pages are accessed without credentials. If a page redirects
 * to a login screen the script prints a warning and skips that target rather
 * than failing the whole capture. Pages that use static/synthetic data (no DB
 * auth required) will render correctly. Use NFR_DEMO_MODE=live for full data.
 *
 * No em dashes. Synthetic institution and data.
 */

import { chromium } from "@playwright/test";
import { writeFileSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";

const BASE = process.env.NFR_CAPTURE_BASE ?? "http://localhost:3000";
const OUTPUT_DIR = join(process.cwd(), "public", "presentation-assets", "v2.2");
const HEALTH_URL = `${BASE}/api/health/live`;

/* ---------------------------------------------------------------------------
   Capture targets
   --------------------------------------------------------------------------- */

interface CaptureTarget {
  id: string;
  url: string;
  region: string;
  width: number;
  height: number;
  description: string;
}

const TARGETS: CaptureTarget[] = [
  {
    id: "rcsa-work-hub",
    url: "/workday/rcsa/work",
    region: "rcsa-work-hub",
    width: 1920,
    height: 1080,
    description: "RCSA Work Hub -- agenda view on first login",
  },
  {
    id: "rcsa-stage-1",
    url: "/workday/rcsa/processes/rcsa-cycle?stage=evidence-refresh",
    region: "rcsa-stage-workspace",
    width: 1920,
    height: 1080,
    description: "RCSA Stage Workspace -- evidence-refresh stage",
  },
  {
    id: "tprm-work-hub",
    url: "/workday/tprm/work",
    region: "tprm-work-hub",
    width: 1920,
    height: 1080,
    description: "TPRM Work Hub -- agenda view on first login",
  },
  {
    id: "role-home-rcsa",
    url: "/workday/rcsa",
    region: "role-home",
    width: 1920,
    height: 1080,
    description: "RCSA Role Home -- Now/Next/Done view",
  },
];

/* ---------------------------------------------------------------------------
   Server health check
   --------------------------------------------------------------------------- */

async function checkServerRunning(): Promise<boolean> {
  try {
    const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(5_000) });
    return res.ok;
  } catch {
    return false;
  }
}

/* ---------------------------------------------------------------------------
   SHA-256 of a file
   --------------------------------------------------------------------------- */

function sha256File(filePath: string): string {
  const buf = readFileSync(filePath);
  return createHash("sha256").update(buf).digest("hex");
}

/* ---------------------------------------------------------------------------
   Detect login redirect
   --------------------------------------------------------------------------- */

function isLoginPage(url: string): boolean {
  return (
    url.includes("/login") ||
    url.includes("/sign-in") ||
    url.includes("/auth") ||
    url.includes("/identity")
  );
}

/* ---------------------------------------------------------------------------
   Main
   --------------------------------------------------------------------------- */

interface ManifestAsset {
  id: string;
  file: string;
  sha256: string;
  description: string;
  capturedFrom: string;
  region: string;
  warning?: string;
}

async function main() {
  /* 1. Server health check */
  const running = await checkServerRunning();
  if (!running) {
    console.error(
      [
        "",
        "ERROR: No server detected at " + BASE,
        "",
        "Start the dev server first:",
        "  npm run dev",
        "",
        "Or for live demo data:",
        "  npm run demo:live",
        "",
        "Then re-run:",
        "  npm run capture:presentation-assets",
        "",
      ].join("\n"),
    );
    process.exit(1);
  }

  console.log("Server detected at " + BASE);

  /* 2. Create output directory */
  mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log("Output directory: " + OUTPUT_DIR);
  console.log("");

  /* 3. Launch browser */
  const browser = await chromium.launch();
  const assets: ManifestAsset[] = [];
  const rows: Array<{ id: string; status: string; note: string }> = [];

  /* 4. Capture each target */
  for (const target of TARGETS) {
    const fullUrl = `${BASE}${target.url}?presentationCapture=1`;
    const outFile = join(OUTPUT_DIR, `${target.id}.png`);

    const page = await browser.newPage({
      viewport: { width: target.width, height: target.height },
    });

    try {
      const response = await page.goto(fullUrl, {
        waitUntil: "networkidle",
        timeout: 60_000,
      });

      const httpStatus = response?.status() ?? 0;
      const finalUrl = page.url();

      /* Detect auth redirect */
      if (isLoginPage(finalUrl)) {
        const warning =
          "Page redirected to login -- screenshot may show auth screen rather than product";
        console.warn("  WARN " + target.id + ": " + warning);
        rows.push({ id: target.id, status: "WARN", note: "auth redirect" });

        /* Still capture whatever is on screen */
        await page.screenshot({ path: outFile, fullPage: false });
        const hash = sha256File(outFile);
        assets.push({
          id: target.id,
          file: `${target.id}.png`,
          sha256: hash,
          description: target.description,
          capturedFrom: finalUrl,
          region: target.region,
          warning,
        });
        await page.close();
        continue;
      }

      if (httpStatus >= 400) {
        console.error(
          "  SKIP " + target.id + ": HTTP " + httpStatus,
        );
        rows.push({ id: target.id, status: "SKIP", note: `HTTP ${httpStatus}` });
        await page.close();
        continue;
      }

      /* Wait for main region then settle */
      await page.waitForSelector("#main, main, .wd-main-inner", { timeout: 20_000 }).catch(() => {});
      await page.waitForTimeout(1_500);

      /* Find region element */
      const regionSelector = `[data-presentation-region="${target.region}"]`;
      const regionEl = await page.$(regionSelector);

      if (regionEl) {
        await regionEl.screenshot({ path: outFile });
        console.log("  OK   " + target.id + " (region element found)");
        rows.push({ id: target.id, status: "OK", note: "region element" });
      } else {
        /* Fall back to full viewport */
        await page.screenshot({ path: outFile, fullPage: false });
        console.log(
          "  OK   " +
            target.id +
            " (region " +
            target.region +
            " not found -- full viewport captured)",
        );
        rows.push({ id: target.id, status: "OK", note: "full viewport fallback" });
      }

      const hash = sha256File(outFile);
      assets.push({
        id: target.id,
        file: `${target.id}.png`,
        sha256: hash,
        description: target.description,
        capturedFrom: fullUrl,
        region: target.region,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      console.error("  FAIL " + target.id + ": " + message);
      rows.push({ id: target.id, status: "FAIL", note: message.slice(0, 60) });
    } finally {
      await page.close();
    }
  }

  await browser.close();

  /* 5. Write manifest */
  const manifest = {
    version: "v2.2",
    capturedAt: new Date().toISOString(),
    capturedFrom: BASE,
    assets,
  };

  writeFileSync(
    join(OUTPUT_DIR, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
    "utf-8",
  );

  /* 6. Print summary */
  console.log("");
  console.log("Summary");
  console.log("-------");
  const colWidth = Math.max(...rows.map((r) => r.id.length)) + 2;
  for (const row of rows) {
    console.log(
      row.id.padEnd(colWidth) + row.status.padEnd(7) + row.note,
    );
  }

  const failed = rows.filter((r) => r.status === "FAIL" || r.status === "SKIP");
  console.log("");
  console.log(
    `Captured ${assets.length} of ${TARGETS.length}. Manifest written to ${join(OUTPUT_DIR, "manifest.json")}`,
  );

  if (failed.length > 0) {
    console.warn(
      `\n${failed.length} target(s) failed or were skipped. See above for details.`,
    );
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
