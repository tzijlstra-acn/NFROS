#!/usr/bin/env tsx
// Generates a simple SBOM (Software Bill of Materials) from package-lock.json

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

interface PackageEntry {
  version?: string;
  license?: string;
}

interface LockFile {
  packages?: Record<string, PackageEntry>;
}

interface PackageJson {
  name?: string;
  version?: string;
}

const lockFile = JSON.parse(
  readFileSync(join(process.cwd(), "package-lock.json"), "utf-8")
) as LockFile;

const pkg = JSON.parse(
  readFileSync(join(process.cwd(), "package.json"), "utf-8")
) as PackageJson;

const components: Array<{
  type: string;
  name: string;
  version: string;
  licenses: Array<{ id: string }>;
}> = [];

for (const [name, info] of Object.entries(lockFile.packages ?? {})) {
  if (name === "") continue; // skip root
  const packageName = name.replace("node_modules/", "");
  components.push({
    type: "library",
    name: packageName,
    version: info.version ?? "unknown",
    licenses: info.license ? [{ id: info.license }] : [],
  });
}

const sbom = {
  bomFormat: "CycloneDX",
  specVersion: "1.4",
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    component: {
      type: "application",
      name: pkg.name ?? "nfr-workos",
      version: pkg.version ?? "4.0.0",
    },
  },
  components: components.slice(0, 500), // limit for readability
};

mkdirSync(join(process.cwd(), "release"), { recursive: true });
writeFileSync(
  join(process.cwd(), "release", "SBOM.json"),
  JSON.stringify(sbom, null, 2)
);
console.log(`SBOM generated: release/SBOM.json (${components.length} components)`);
