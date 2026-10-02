#!/usr/bin/env tsx
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

interface PackageEntry {
  license?: string;
}

interface LockFile {
  packages?: Record<string, PackageEntry>;
}

const lockFile = JSON.parse(
  readFileSync(join(process.cwd(), "package-lock.json"), "utf-8")
) as LockFile;

const licenseMap = new Map<string, string[]>();

for (const [name, info] of Object.entries(lockFile.packages ?? {})) {
  if (name === "") continue;
  const license = info.license ?? "Unknown";
  const packageName = name.replace("node_modules/", "");
  const existing = licenseMap.get(license) ?? [];
  existing.push(packageName);
  licenseMap.set(license, existing);
}

let report =
  "# License Report\n\nGenerated: " + new Date().toISOString() + "\n\n";

for (const [license, packages] of licenseMap.entries()) {
  report += `## ${license}\n\n${packages.map((p) => `- ${p}`).join("\n")}\n\n`;
}

mkdirSync(join(process.cwd(), "release"), { recursive: true });
writeFileSync(join(process.cwd(), "release", "LICENSE_REPORT.md"), report);
console.log("License report generated: release/LICENSE_REPORT.md");
