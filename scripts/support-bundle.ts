#!/usr/bin/env tsx
/**
 * scripts/support-bundle.ts
 *
 * Creates a redacted diagnostic bundle for support purposes.
 *
 * The bundle contains only operational metadata: health snapshot, release
 * information and an explicit list of what was excluded. No credentials,
 * session secrets, database contents, evidence text, meeting transcripts,
 * personal data, AI prompts or message bodies are ever written.
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { getHealthSummary } from "../src/health/service.js";

async function createBundle(): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const bundleDir = join(process.cwd(), "support-bundles", `bundle-${timestamp}`);

  mkdirSync(bundleDir, { recursive: true });

  // Health snapshot
  const health = await getHealthSummary(true);
  writeFileSync(join(bundleDir, "health.json"), JSON.stringify(health, null, 2));

  // Release metadata -- no secrets
  const release = {
    version: "4.0.0",
    name: "NFROS Design Partner Release",
    buildTime: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    schemaVersion: "V3+runtime+audit",
  };
  writeFileSync(join(bundleDir, "release.json"), JSON.stringify(release, null, 2));

  // Explicit exclusion manifest
  const exclusions = {
    excluded: [
      "API keys and tokens",
      "Session secrets",
      "Database contents",
      "Evidence document text",
      "Meeting transcripts",
      "Personal data",
      "AI prompts",
      "Message bodies",
    ],
    note: "This bundle contains only operational metadata. No content or credentials are included.",
  };
  writeFileSync(
    join(bundleDir, "EXCLUSIONS.md"),
    `# Support Bundle Exclusions\n\n${JSON.stringify(exclusions, null, 2)}`,
  );

  // Bundle manifest
  const manifest = {
    bundleId: `BUNDLE-${timestamp}`,
    createdAt: new Date().toISOString(),
    contents: ["health.json", "release.json", "EXCLUSIONS.md"],
    sanitized: true,
  };
  writeFileSync(join(bundleDir, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log("Support bundle created:", bundleDir);
  console.log("Contents:", manifest.contents);
  console.log("Note: Bundle contains no credentials or content.");
}

createBundle().catch((err: unknown) => {
  console.error("Bundle creation failed:", err instanceof Error ? err.name : "Error");
  process.exit(1);
});
