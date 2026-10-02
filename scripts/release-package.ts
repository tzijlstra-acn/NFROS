#!/usr/bin/env tsx
import { mkdirSync, writeFileSync, copyFileSync, existsSync } from "fs";
import { join } from "path";

const RELEASE_DIR = join(process.cwd(), "release", "nfros-v4");

async function createReleasePackage(): Promise<void> {
  mkdirSync(RELEASE_DIR, { recursive: true });
  mkdirSync(join(RELEASE_DIR, "docs"), { recursive: true });

  // Deployment manifest
  const manifest = {
    name: "NFROS Design Partner Release",
    version: "4.0.0",
    releaseDate: new Date().toISOString().split("T")[0],
    productModes: ["demonstration", "design-partner", "offline-evaluation"],
    flagshipRoles: ["rcsa", "tprm"],
    demoRoles: ["control-assurance", "incident-resilience"],
    plannedRoles: ["regulatory-change", "nfr-governance"],
    minimumNodeVersion: "20.0.0",
    database: "SQLite (better-sqlite3)",
    note: "This is a Design Partner Release for controlled evaluation. Not for production use with real bank data.",
  };

  writeFileSync(
    join(RELEASE_DIR, "deployment-manifest.json"),
    JSON.stringify(manifest, null, 2)
  );

  // Copy key docs if they exist
  const docsToCopy = ["README.md", "CHANGELOG.md"];
  for (const doc of docsToCopy) {
    if (existsSync(join(process.cwd(), doc))) {
      copyFileSync(join(process.cwd(), doc), join(RELEASE_DIR, doc));
    }
  }

  // Create checksums placeholder
  writeFileSync(
    join(RELEASE_DIR, "checksums.txt"),
    `# NFR WorkOS V4.0 Release Checksums\n# Generated: ${new Date().toISOString()}\n# Run: sha256sum release/nfros-v4/* to verify\n`
  );

  console.log("Release package created:", RELEASE_DIR);
  console.log("Contents:");
  console.log("  - deployment-manifest.json");
  console.log("  - README.md (if present)");
  console.log("  - CHANGELOG.md (if present)");
  console.log("  - checksums.txt");
}

createReleasePackage().catch((err: unknown) => {
  console.error(
    "Release package failed:",
    err instanceof Error ? err.message : "Unknown error"
  );
  process.exit(1);
});
