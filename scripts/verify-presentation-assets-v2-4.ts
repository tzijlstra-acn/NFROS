/**
 * Verifies the V2.4 product-proof captures against the manifest and registry.
 *
 * Every core asset must exist and be a real capture: PNG signature, manifest
 * dimensions, matching SHA-256, over 30 KB, not blank and not a placeholder.
 * Captured appendix assets get the same checks. Exits non-zero on any failure.
 *
 * Usage: npm run verify:presentation-assets-v2-4
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ASSET_DIR_V24,
  ASSET_REGISTRY_V24,
  ASSET_VERSION_V24,
  CORE_ASSET_IDS,
  type PresentationAssetDefinition,
  type PresentationManifestV24,
} from "../src/presentation-v2-4/product-proof/asset-registry";
import { readManifestV24 } from "../src/presentation-v2-4/product-proof/manifest-node";
import {
  computePngStats,
  hasPngSignature,
  imageProblems,
  readPngHeader,
} from "../src/presentation-v2-4/product-proof/png-stats";

const ROOT = process.cwd();
const failures: string[] = [];
const warnings: string[] = [];

function check(asset: PresentationAssetDefinition, manifest: PresentationManifestV24): string[] {
  const problems: string[] = [];
  const entry = manifest.assets[asset.id];
  if (!entry) return ["missing from manifest"];
  if (entry.file !== asset.file) problems.push(`manifest file ${entry.file} differs from registry ${asset.file}`);
  if (/placeholder/i.test(entry.file)) problems.push("file name marks a placeholder");
  if (entry.route !== asset.route) problems.push(`manifest route ${entry.route} differs from registry ${asset.route}`);

  const path = join(ROOT, ASSET_DIR_V24, asset.file);
  if (!existsSync(path)) return [...problems, `file not found: ${path}`];
  const buf = readFileSync(path);
  if (!hasPngSignature(buf)) return [...problems, "not a PNG (bad signature)"];

  const header = readPngHeader(buf);
  if (header.width !== entry.width || header.height !== entry.height) {
    problems.push(`dimensions ${header.width}x${header.height} differ from manifest ${entry.width}x${entry.height}`);
  }
  const sha = createHash("sha256").update(buf).digest("hex");
  if (sha !== entry.sha256) problems.push("sha256 does not match the manifest");
  if (buf.length !== entry.bytes) problems.push(`size ${buf.length} differs from manifest ${entry.bytes}`);

  problems.push(...imageProblems(computePngStats(buf), buf.length, asset.requiresWorkdayShell));

  for (const name of Object.keys(asset.subRegions ?? {})) {
    const box = entry.subRegions[name];
    if (!box) {
      problems.push(`sub-region "${name}" missing from manifest`);
      continue;
    }
    if (box.width <= 0 || box.height <= 0 || box.x < 0 || box.y < 0 || box.x + box.width > entry.width || box.y + box.height > entry.height) {
      problems.push(`sub-region "${name}" lies outside the image`);
    }
  }
  return problems;
}

function main(): void {
  console.log(`NFROS V2.4 product-proof verification (${ASSET_VERSION_V24})`);
  let manifest: PresentationManifestV24;
  try {
    manifest = readManifestV24(ROOT);
  } catch (error) {
    console.error(`FAIL manifest: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
  if (manifest.version !== ASSET_VERSION_V24) {
    failures.push(`manifest version ${manifest.version} is not ${ASSET_VERSION_V24}`);
  }
  console.log(`Manifest: captured ${manifest.capturedAt} at commit ${manifest.commit}${manifest.worktreeDirty ? " (dirty worktree)" : ""}`);

  for (const asset of ASSET_REGISTRY_V24) {
    const core = CORE_ASSET_IDS.includes(asset.id);
    if (asset.blockedReason) {
      if (manifest.assets[asset.id]) failures.push(`${asset.id}: blocked in the registry but present in the manifest`);
      console.log(`  skip ${asset.id}: not captured (${asset.blockedReason})`);
      continue;
    }
    if (!core && !manifest.assets[asset.id]) {
      warnings.push(`${asset.id}: appendix asset not captured`);
      console.log(`  WARN ${asset.id}: appendix asset not captured`);
      continue;
    }
    const problems = check(asset, manifest);
    if (problems.length > 0) {
      for (const problem of problems) failures.push(`${asset.id}: ${problem}`);
      console.log(`  FAIL ${asset.id}: ${problems.join("; ")}`);
    } else {
      const entry = manifest.assets[asset.id];
      console.log(`  ok   ${asset.id}${core ? " (core)" : ""}: ${entry?.width}x${entry?.height}, ${Math.round((entry?.bytes ?? 0) / 1024)} KB`);
    }
  }

  if (failures.length > 0) {
    console.error(`\nVerification FAILED (${failures.length} problems).`);
    process.exit(1);
  }
  console.log(`\nVerification passed: ${CORE_ASSET_IDS.length} core assets${warnings.length ? `, ${warnings.length} warnings` : ""}.`);
}

main();
