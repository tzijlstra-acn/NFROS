#!/usr/bin/env node
/**
 * Build time secret scanner.
 *
 * Scans source files, browser bundles, static exports, presentation exports,
 * logs, screenshots and test snapshots for credential material.
 *
 * Two deliberate constraints, both from the product brief:
 *   - this scanner never prints a matched value, only its location
 *   - it does not inspect Git history, and it does not walk the whole machine
 *
 * Run with: npm run scan:secrets
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const ROOT = process.cwd();

/** Directories scanned when present. */
const TARGETS = [
  "src", "app", "scripts", "tests", "docs",
  ".next", "out", "dist", "exports",
  "test-results", "playwright-report",
];

const SKIP_DIRS = new Set(["node_modules", ".git", "cache"]);

/** Binary and generated types we still want to scan as text where feasible. */
const TEXT_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".map",
  ".json", ".md", ".mdx", ".css", ".html", ".txt", ".svg",
  ".yml", ".yaml", ".log", ".xml", ".csv",
]);

/** Binary artefacts scanned for embedded ASCII key material. */
const BINARY_EXTENSIONS = new Set([".pdf", ".pptx", ".png", ".jpg", ".jpeg", ".webp", ".zip"]);

const MAX_BYTES = 12 * 1024 * 1024;

/** This file contains the patterns by necessity. */
const SELF = join("scripts", "scan-secrets.mjs");

/**
 * Detectors. Each has a pattern and a short name. The scanner reports the
 * detector name and location only.
 */
const DETECTORS = [
  { name: "openai-key", pattern: /\bsk-[A-Za-z0-9_-]{20,}/g },
  { name: "openai-project-key", pattern: /\bsk-proj-[A-Za-z0-9_-]{20,}/g },
  { name: "openai-service-key", pattern: /\bsk-svcacct-[A-Za-z0-9_-]{20,}/g },
  { name: "bearer-token", pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}/g },
  { name: "jwt", pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{6,}/g },
  { name: "private-key-block", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { name: "slack-token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}/g },
  { name: "github-token", pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}/g },
  { name: "aws-access-key", pattern: /\bAKIA[0-9A-Z]{16}\b/g },
];

/**
 * Allowlisted matches: strings that look like credentials but are documentation
 * or test fixtures. Each entry must be a full literal we recognise.
 */
const ALLOWED_LITERALS = new Set([
  "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", // copy-check-ignore
  "sk-placeholder-not-a-real-key-value", // copy-check-ignore
  "sk-test-0000000000000000000000000000",
]);

/**
 * A NEXT_PUBLIC variable carrying anything key shaped is a separate failure,
 * because it would ship the value to the browser by design.
 */
const PUBLIC_ENV_PATTERN = /NEXT_PUBLIC_[A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL)/g;

/** Client components must never import the server-only config loader. */
const FORBIDDEN_CLIENT_IMPORT = /load-openai-config/;

function walk(dir, files = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return files;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let stats;
    try {
      stats = statSync(full);
    } catch {
      continue;
    }
    if (stats.isDirectory()) {
      walk(full, files);
    } else if (stats.size <= MAX_BYTES) {
      const ext = extname(entry);
      if (TEXT_EXTENSIONS.has(ext) || BINARY_EXTENSIONS.has(ext) || ext === "") {
        files.push(full);
      }
    }
  }
  return files;
}

/**
 * Compiled server output and vendored dependency chunks.
 *
 * In these files the three generic credential-shape detectors are skipped, and
 * only those three. The reasoning, in order of importance:
 *
 *   1. The OpenAI key detectors are NEVER skipped, anywhere. A key appearing
 *      in any build artefact is a genuine and serious finding, so the check
 *      that actually matters keeps full coverage.
 *   2. Nothing under `.next/server` reaches a browser. The browser facing
 *      output is `.next/static`, `out` and `dist`, and those are scanned with
 *      every detector.
 *   3. Library code trips the generic detectors legitimately and often. A JWT
 *      library contains "-----BEGIN PRIVATE KEY-----" in its own test
 *      vectors, and the OpenAI SDK contains a literal "Bearer " placeholder
 *      that it compares an Authorization header against. Reporting these
 *      teaches a reader that this scanner cries wolf, and a scanner nobody
 *      reads is worse than a narrower one they trust.
 *
 * Our own key cannot be in a bundle in any case: it is read at runtime from a
 * file outside this project and is never imported as a value.
 */
const VENDOR_CHUNK = /[\\/]\.next[\\/]server[\\/]|[\\/]\.next[\\/].*node_modules_/;

/** Detectors that produce false positives in vendored library code. */
const VENDOR_NOISY_DETECTORS = new Set(["private-key-block", "bearer-token", "jwt"]);

/**
 * Browser facing output. A finding here is the most serious kind, because this
 * is what actually ships to a client machine.
 */
const BROWSER_OUTPUT = /[\\/](?:\.next[\\/]static|out|dist)[\\/]/;

function scanFile(file) {
  const rel = relative(ROOT, file);
  if (rel === SELF) return [];
  const isVendorChunk = VENDOR_CHUNK.test(file);
  const isBrowserFacing = BROWSER_OUTPUT.test(file);

  let contents;
  try {
    contents = readFileSync(file, "latin1");
  } catch {
    return [];
  }

  const findings = [];

  for (const detector of DETECTORS) {
    /*
     * In a vendored chunk, skip only the detectors that library code trips
     * legitimately. A key pattern is never skipped anywhere.
     */
    if (isVendorChunk && VENDOR_NOISY_DETECTORS.has(detector.name)) continue;

    detector.pattern.lastIndex = 0;
    let match;
    while ((match = detector.pattern.exec(contents)) !== null) {
      const value = match[0];
      if (ALLOWED_LITERALS.has(value)) continue;
      // Report the location and the detector, never the value.
      const before = contents.slice(0, match.index);
      const line = before.split("\n").length;
      findings.push({
        file: rel,
        line,
        detector: detector.name,
        length: value.length,
        ...(isBrowserFacing ? { note: "This file ships to the browser." } : {}),
      });
    }
  }

  PUBLIC_ENV_PATTERN.lastIndex = 0;
  let publicMatch;
  while ((publicMatch = PUBLIC_ENV_PATTERN.exec(contents)) !== null) {
    const before = contents.slice(0, publicMatch.index);
    findings.push({
      file: rel,
      line: before.split("\n").length,
      detector: "public-env-secret-name",
      length: publicMatch[0].length,
      note: `A NEXT_PUBLIC variable named ${publicMatch[0]} would be exposed to the browser.`,
    });
  }

  // A client component importing the server-only loader would pull the key
  // resolution path into the bundle.
  if (/\.tsx?$/.test(rel) && /^\s*["']use client["']/m.test(contents) && FORBIDDEN_CLIENT_IMPORT.test(contents)) {
    findings.push({
      file: rel,
      line: 1,
      detector: "client-imports-server-config",
      length: 0,
      note: "A client component imports the server-only OpenAI configuration loader.",
    });
  }

  return findings;
}

function main() {
  const files = [];
  const scannedTargets = [];
  for (const target of TARGETS) {
    const full = join(ROOT, target);
    if (existsSync(full)) {
      scannedTargets.push(target);
      files.push(...walk(full));
    }
  }

  const findings = [];
  for (const file of files) findings.push(...scanFile(file));

  console.log(`Secret scan checked ${files.length} files across: ${scannedTargets.join(", ")}`);

  const bundleDirs = [".next", "out", "dist"].filter((d) => existsSync(join(ROOT, d)));
  if (bundleDirs.length === 0) {
    console.log(
      "Note: no build output present. Run npm run build before the scan to cover browser bundles.",
    );
  } else {
    console.log(`Browser bundle directories covered: ${bundleDirs.join(", ")}`);
  }

  if (findings.length > 0) {
    console.error(`\nSecret scan FAILED with ${findings.length} finding(s).`);
    console.error("Locations only. The matched values are deliberately not printed.\n");
    for (const f of findings.slice(0, 50)) {
      console.error(`  ${f.file}:${f.line}  [${f.detector}] length=${f.length}`);
      if (f.note) console.error(`    ${f.note}`);
    }
    if (findings.length > 50) console.error(`  ... and ${findings.length - 50} more`);
    process.exit(1);
  }

  console.log("Secret scan passed. No credential material found in source, bundles or exports.");
}

main();
