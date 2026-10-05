/**
 * verify-presentation-assets-v2-3.ts
 *
 * Strict verification of V2.3 presentation assets.
 *
 * Checks:
 * 1. Asset directory exists
 * 2. manifest.json exists and parses as valid JSON
 * 3. No placeholder: true entries in manifest (real captures only)
 * 4. No warning field in any manifest entry
 * 5. All required-for-core assets are present
 * 6. All assets in registry: file exists, size > 10KB, valid PNG signature
 * 7. SHA-256 in manifest matches file on disk
 *
 * Exit 0 only if ALL checks pass.
 *
 * Usage: npm run verify:presentation-assets:v2-3
 */

import { existsSync, readFileSync, statSync, openSync, readSync, closeSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import { ASSET_REGISTRY, ASSET_DIR, CORE_REQUIRED_ASSETS } from "../src/presentation-v2-3/product-proof/asset-registry";

const ROOT = process.cwd();
const outDir = join(ROOT, ASSET_DIR);

// Valid PNG signature: first 8 bytes
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

type CheckResult = { ok: boolean; message: string };

const results: CheckResult[] = [];

function check(ok: boolean, message: string): boolean {
  results.push({ ok, message });
  if (ok) {
    console.log(`  PASS  ${message}`);
  } else {
    console.error(`  FAIL  ${message}`);
  }
  return ok;
}

/* --------------------------------------------------------------------------
   Check 1: directory exists
   -------------------------------------------------------------------------- */

console.log(`\nV2.3 Presentation Asset Verification`);
console.log(`Asset dir: ${ASSET_DIR}\n`);

const dirExists = existsSync(outDir);
if (!check(dirExists, `Asset directory exists: ${ASSET_DIR}`)) {
  console.error(`\nFatal: directory not found. Run: npm run generate:placeholder-assets`);
  process.exit(1);
}

/* --------------------------------------------------------------------------
   Check 2: manifest.json exists and parses
   -------------------------------------------------------------------------- */

const manifestPath = join(outDir, "manifest.json");
const manifestExists = existsSync(manifestPath);
check(manifestExists, "manifest.json exists");

type ManifestAssetEntry = {
  id: string;
  file: string;
  placeholder?: boolean;
  warning?: string;
  sha256?: string;
  sizeBytes?: number;
};

type Manifest = {
  version: string;
  assets: ManifestAssetEntry[];
};

let manifest: Manifest | null = null;
if (manifestExists) {
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as Manifest;
    check(true, "manifest.json parses as valid JSON");
  } catch {
    check(false, "manifest.json parses as valid JSON");
  }
}

/* --------------------------------------------------------------------------
   Check 3: No placeholder: true entries
   -------------------------------------------------------------------------- */

if (manifest) {
  const placeholders = manifest.assets.filter((a) => a.placeholder === true);
  check(
    placeholders.length === 0,
    placeholders.length === 0
      ? "No placeholder assets in manifest"
      : `Found ${placeholders.length} placeholder asset(s): ${placeholders.map((a) => a.id).join(", ")}. Run: npm run presentation:refresh-assets`
  );

  /* ------------------------------------------------------------------------
     Check 4: No warning field
     ------------------------------------------------------------------------ */

  const withWarnings = manifest.assets.filter((a) => a.warning !== undefined);
  check(
    withWarnings.length === 0,
    withWarnings.length === 0
      ? "No warning fields in manifest"
      : `Found warning fields on: ${withWarnings.map((a) => a.id).join(", ")}`
  );
}

/* --------------------------------------------------------------------------
   Check 5: All required-for-core assets present
   -------------------------------------------------------------------------- */

console.log(`\n-- Core required assets (${CORE_REQUIRED_ASSETS.length}) --`);
for (const asset of CORE_REQUIRED_ASSETS) {
  const filePath = join(outDir, asset.file);
  check(existsSync(filePath), `Core asset present: ${asset.file} (${asset.id})`);
}

/* --------------------------------------------------------------------------
   Checks 6 & 7: Per-file checks
   -------------------------------------------------------------------------- */

console.log(`\n-- Per-file checks (${ASSET_REGISTRY.length} assets) --`);

const manifestByFile = new Map<string, ManifestAssetEntry>(
  (manifest?.assets ?? []).map((a) => [a.file, a])
);

for (const asset of ASSET_REGISTRY) {
  const filePath = join(outDir, asset.file);

  if (!existsSync(filePath)) {
    check(false, `${asset.file}: file exists`);
    continue;
  }

  check(true, `${asset.file}: file exists`);

  // Size check
  const stat = statSync(filePath);
  check(
    stat.size > 10000,
    stat.size > 10000
      ? `${asset.file}: size ok (${(stat.size / 1024).toFixed(1)} KB)`
      : `${asset.file}: size too small (${stat.size} bytes < 10 KB): likely blank or placeholder`
  );

  // PNG signature check
  const head = Buffer.alloc(8);
  const fd = openSync(filePath, "r");
  readSync(fd, head, 0, 8, 0);
  closeSync(fd);
  const pngOk = head.equals(PNG_SIGNATURE);
  check(pngOk, pngOk ? `${asset.file}: valid PNG signature` : `${asset.file}: invalid PNG signature`);

  // SHA-256 check
  if (manifest) {
    const entry = manifestByFile.get(asset.file);
    if (entry?.sha256) {
      const actual = createHash("sha256").update(readFileSync(filePath)).digest("hex");
      check(
        actual === entry.sha256,
        actual === entry.sha256
          ? `${asset.file}: SHA-256 matches manifest`
          : `${asset.file}: SHA-256 mismatch (disk: ${actual.slice(0, 12)}..., manifest: ${entry.sha256.slice(0, 12)}...)`
      );
    } else {
      check(false, `${asset.file}: no sha256 in manifest`);
    }
  }
}

/* --------------------------------------------------------------------------
   Summary
   -------------------------------------------------------------------------- */

console.log("");
const passed = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok).length;
console.log(`Result: ${passed} passed, ${failed} failed (${results.length} total checks)`);

if (failed > 0) {
  console.error(`\nVerification FAILED. Run: npm run presentation:refresh-assets`);
  process.exit(1);
} else {
  console.log(`\nVerification PASSED.`);
}
