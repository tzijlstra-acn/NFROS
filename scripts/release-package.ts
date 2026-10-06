#!/usr/bin/env tsx
import { mkdirSync, writeFileSync, copyFileSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import {
  PRODUCT_IDENTITY,
  PRODUCT_RELEASE,
  rolesWithReleaseStatus,
} from "../src/product/release/product-release";

const RELEASE_DIR = join(process.cwd(), "release", "nfros-v4");

/* Name, version and role states come from the release registry, not literals. */
const roleIds = (status: "available" | "demo" | "planned"): string[] =>
  rolesWithReleaseStatus(status).map((role) => role.roleId);

/* The Node requirement package.json declares, rather than a second copy of it. */
function nodeEngine(): string {
  const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8")) as {
    engines?: { node?: string };
  };
  return pkg.engines?.node ?? "unknown";
}

async function createReleasePackage(): Promise<void> {
  mkdirSync(RELEASE_DIR, { recursive: true });
  mkdirSync(join(RELEASE_DIR, "docs"), { recursive: true });

  // Deployment manifest
  const manifest = {
    name: `${PRODUCT_IDENTITY.name} ${PRODUCT_RELEASE.name.en}`,
    version: PRODUCT_RELEASE.version,
    releaseDate: PRODUCT_RELEASE.date,
    releaseStage: PRODUCT_RELEASE.stage,
    productModes: ["demonstration", "design-partner", "offline-evaluation"],
    flagshipRoles: roleIds("available"),
    demoRoles: roleIds("demo"),
    plannedRoles: roleIds("planned"),
    minimumNodeVersion: nodeEngine(),
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
    `# ${PRODUCT_IDENTITY.name} ${PRODUCT_RELEASE.version} Release Checksums\n# Generated: ${new Date().toISOString()}\n# Run: sha256sum release/nfros-v4/* to verify\n`
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
