#!/usr/bin/env tsx
/**
 * Verifies that the presentation asset directory for v2.2 is present, the
 * manifest is valid, and all listed files exist and are non-empty.
 *
 * Usage: npm run verify:presentation-assets
 *
 * Exit 0 if all checks pass.
 * Exit 1 if any check fails (with a summary of what is missing or wrong).
 *
 * No em dashes. No Tailwind. No umlauts.
 */

import { existsSync, statSync, readFileSync } from "fs";
import { join } from "path";

const ASSETS_DIR = join(process.cwd(), "public", "presentation-assets", "v2.2");
const MANIFEST_PATH = join(ASSETS_DIR, "manifest.json");

interface ManifestAsset {
  id: string;
  file: string;
  sha256?: string;
  description?: string;
}

interface Manifest {
  version: string;
  capturedAt: string;
  assets: ManifestAsset[];
}

function fail(message: string): void {
  console.error("  FAIL " + message);
}

function ok(message: string): void {
  console.log("  OK   " + message);
}

function main(): void {
  const failures: string[] = [];

  console.log("Verifying presentation assets: " + ASSETS_DIR);
  console.log("");

  /* 1. Directory exists */
  if (!existsSync(ASSETS_DIR)) {
    fail("Directory does not exist: " + ASSETS_DIR);
    failures.push("missing directory");
    console.log("");
    console.error("Run `npm run capture:presentation-assets` to generate assets.");
    process.exit(1);
  }
  ok("Directory exists");

  /* 2. Manifest exists */
  if (!existsSync(MANIFEST_PATH)) {
    fail("manifest.json not found in " + ASSETS_DIR);
    failures.push("missing manifest.json");
    console.log("");
    console.error("Run `npm run capture:presentation-assets` to generate the manifest.");
    process.exit(1);
  }
  ok("manifest.json present");

  /* 3. Manifest is valid JSON with required fields */
  let manifest: Manifest;
  try {
    const raw = readFileSync(MANIFEST_PATH, "utf-8");
    manifest = JSON.parse(raw) as Manifest;
  } catch (err) {
    fail("manifest.json is not valid JSON: " + (err instanceof Error ? err.message : "parse error"));
    failures.push("invalid manifest JSON");
    console.log("");
    process.exit(1);
  }

  if (!manifest.version) {
    fail("manifest.json missing 'version' field");
    failures.push("manifest missing version");
  } else {
    ok("manifest version: " + manifest.version);
  }

  if (!manifest.capturedAt) {
    fail("manifest.json missing 'capturedAt' field");
    failures.push("manifest missing capturedAt");
  } else {
    ok("manifest capturedAt: " + manifest.capturedAt);
  }

  if (!Array.isArray(manifest.assets)) {
    fail("manifest.json 'assets' field is not an array");
    failures.push("manifest assets not array");
    console.log("");
    process.exit(1);
  }

  if (manifest.assets.length === 0) {
    fail("manifest.json has no assets listed");
    failures.push("empty assets list");
  } else {
    ok("manifest lists " + manifest.assets.length + " asset(s)");
  }

  /* 4. Each listed file exists and is non-empty */
  for (const asset of manifest.assets) {
    if (!asset.file) {
      fail("asset entry missing 'file' field: " + JSON.stringify(asset));
      failures.push("asset entry missing file field");
      continue;
    }

    const filePath = join(ASSETS_DIR, asset.file);

    if (!existsSync(filePath)) {
      fail("File not found: " + asset.file + " (id: " + (asset.id ?? "?") + ")");
      failures.push("missing file: " + asset.file);
      continue;
    }

    const stat = statSync(filePath);
    if (stat.size === 0) {
      fail("File is empty (0 bytes): " + asset.file);
      failures.push("empty file: " + asset.file);
      continue;
    }

    ok(asset.file + " (" + Math.round(stat.size / 1024) + " KB)");
  }

  /* 5. Result */
  console.log("");
  if (failures.length === 0) {
    console.log("All checks passed. " + manifest.assets.length + " asset(s) verified.");
    process.exit(0);
  } else {
    console.error(failures.length + " check(s) failed:");
    for (const f of failures) {
      console.error("  - " + f);
    }
    console.log("");
    console.log("Run `npm run capture:presentation-assets` to regenerate assets.");
    process.exit(1);
  }
}

main();
