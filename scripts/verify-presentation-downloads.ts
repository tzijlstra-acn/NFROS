/**
 * Verify the presentation download artefacts in public/downloads/.
 *
 * Checks:
 *   1. Both PDF files exist.
 *   2. Both PDF files are non-empty (> 1000 bytes).
 *   3. Metadata JSON exists and contains all required fields.
 *   4. Content hash in metadata matches the current hash of the PDF files.
 *   5. No obvious secret patterns in the metadata JSON.
 *   6. No local filesystem paths in the metadata JSON.
 *
 * Exits 0 on all pass, 1 on any failure.
 *
 * Run with: npm run verify:presentation-downloads
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";

const DOWNLOADS_DIR = resolve(process.cwd(), "public", "downloads");

const CORE_PDF = "NFROS_Risk_Audience_Core.pdf";
const FULL_PDF = "NFROS_Risk_Audience_Core_and_Appendix.pdf";
const META_JSON = "NFROS_Risk_Audience_Export_Metadata.json";

const REQUIRED_META_FIELDS = [
  "deckVersion",
  "gitCommit",
  "exportTime",
  "coreSlideCount",
  "appendixSlideCount",
  "totalSlideCount",
  "syntheticDataDisclosure",
  "regulatoryDisclaimer",
  "contentHash",
] as const;

// Secret patterns to reject in the metadata string.
const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9]{20,}/,
  /api[_-]?key\s*[:=]\s*\S+/i,
  /password\s*[:=]\s*\S+/i,
  /secret\s*[:=]\s*\S+/i,
  /token\s*[:=]\s*\S+/i,
  /bearer\s+[A-Za-z0-9._-]{10,}/i,
];

// Patterns that suggest local filesystem paths have leaked.
const LOCAL_PATH_PATTERNS = [
  /[A-Z]:[\\\/]/,             // Windows drive letter
  /\/home\/[a-z]/,            // Unix home directory
  /\/Users\/[A-Za-z]/,        // macOS home
  /\/var\/folders\//,         // macOS temp
  /\\Users\\/,                // Windows user directory
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface CheckResult {
  label: string;
  pass: boolean;
  detail?: string;
}

function checkFileExists(label: string, filePath: string): CheckResult {
  const pass = existsSync(filePath);
  return { label, pass, detail: pass ? undefined : `File not found: ${label}` };
}

function checkMinSize(label: string, filePath: string, minBytes: number): CheckResult {
  if (!existsSync(filePath)) {
    return { label: `${label} size`, pass: false, detail: "File not found; cannot check size." };
  }
  const size = statSync(filePath).size;
  const pass = size > minBytes;
  return {
    label: `${label} size`,
    pass,
    detail: pass ? undefined : `File is ${size} bytes (expected > ${minBytes})`,
  };
}

function computeContentHash(pdfPaths: string[]): string {
  const hash = createHash("sha256");
  for (const pdfPath of pdfPaths) {
    hash.update(readFileSync(pdfPath));
  }
  return hash.digest("hex");
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

function runChecks(): CheckResult[] {
  const results: CheckResult[] = [];

  const corePdfPath = join(DOWNLOADS_DIR, CORE_PDF);
  const fullPdfPath = join(DOWNLOADS_DIR, FULL_PDF);
  const metaPath = join(DOWNLOADS_DIR, META_JSON);

  // 1. File existence.
  results.push(checkFileExists(CORE_PDF, corePdfPath));
  results.push(checkFileExists(FULL_PDF, fullPdfPath));
  results.push(checkFileExists(META_JSON, metaPath));

  // 2. File sizes.
  results.push(checkMinSize(CORE_PDF, corePdfPath, 1000));
  results.push(checkMinSize(FULL_PDF, fullPdfPath, 1000));

  // 3. Metadata fields.
  if (!existsSync(metaPath)) {
    results.push({
      label: "Metadata fields",
      pass: false,
      detail: "Metadata file missing; cannot check fields.",
    });
  } else {
    let meta: Record<string, unknown>;
    try {
      meta = JSON.parse(readFileSync(metaPath, "utf8")) as Record<string, unknown>;
    } catch (err) {
      results.push({
        label: "Metadata parse",
        pass: false,
        detail: `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
      });
      return results;
    }

    const missingFields = REQUIRED_META_FIELDS.filter((f) => !(f in meta));
    results.push({
      label: "Metadata required fields",
      pass: missingFields.length === 0,
      detail:
        missingFields.length > 0
          ? `Missing fields: ${missingFields.join(", ")}`
          : undefined,
    });

    // 4. Content hash.
    const metaHash = typeof meta["contentHash"] === "string" ? meta["contentHash"] : null;
    if (!metaHash) {
      results.push({
        label: "Content hash present",
        pass: false,
        detail: "contentHash field is missing or not a string.",
      });
    } else if (!existsSync(corePdfPath) || !existsSync(fullPdfPath)) {
      results.push({
        label: "Content hash match",
        pass: false,
        detail: "Cannot verify hash: one or both PDF files are missing.",
      });
    } else {
      const recomputedHash = computeContentHash([corePdfPath, fullPdfPath]);
      const hashMatch = recomputedHash === metaHash;
      results.push({
        label: "Content hash match",
        pass: hashMatch,
        detail: hashMatch
          ? undefined
          : `Hash mismatch.\n  Expected: ${metaHash}\n  Computed: ${recomputedHash}`,
      });
    }

    // 5. No secret patterns.
    const metaString = readFileSync(metaPath, "utf8");
    const secretMatch = SECRET_PATTERNS.find((pattern) => pattern.test(metaString));
    results.push({
      label: "No secrets in metadata",
      pass: !secretMatch,
      detail: secretMatch ? `Possible secret pattern matched: ${secretMatch.source}` : undefined,
    });

    // 6. No local paths.
    const localPathMatch = LOCAL_PATH_PATTERNS.find((pattern) => pattern.test(metaString));
    results.push({
      label: "No local paths in metadata",
      pass: !localPathMatch,
      detail: localPathMatch
        ? `Possible local path found: ${localPathMatch.source}`
        : undefined,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  console.log("Verifying presentation downloads ...\n");

  const results = runChecks();
  let allPass = true;

  for (const result of results) {
    const icon = result.pass ? "PASS" : "FAIL";
    console.log(`[${icon}] ${result.label}`);
    if (!result.pass && result.detail) {
      for (const line of result.detail.split("\n")) {
        console.log(`       ${line}`);
      }
      allPass = false;
    }
  }

  const total = results.length;
  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${passed}/${total} checks passed.`);

  if (allPass) {
    console.log("\nAll checks passed.");
    process.exit(0);
  } else {
    console.log("\nOne or more checks failed.");
    process.exit(1);
  }
}

main();
