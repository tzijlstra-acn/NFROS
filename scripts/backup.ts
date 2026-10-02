#!/usr/bin/env tsx
/**
 * scripts/backup.ts [create|verify|restore]
 *
 * Manages point-in-time backups of the NFR WorkOS SQLite database.
 *
 * create  -- copies the database to ./backups/ with a timestamped name and
 *            writes a manifest containing the SHA-256 hash.
 * verify  -- re-hashes the most recent backup and confirms it matches the
 *            recorded hash.
 * restore -- verifies the most recent backup and copies it over the live
 *            database.
 *
 * No API keys, session tokens, or runtime secrets are stored in the database;
 * they live in environment variables only.
 */

import { existsSync, copyFileSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const DB_PATH = join(process.cwd(), "data", "nfr-workos.db");
const BACKUP_DIR = join(process.cwd(), "backups");
const SCHEMA_VERSION = "V3+runtime";
const RELEASE_VERSION = "4.0.0";

interface BackupManifest {
  timestamp: string;
  backupPath: string;
  originalPath: string;
  sha256: string;
  releaseVersion: string;
  schemaVersion: string;
  note: string;
}

function getTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function hashFile(path: string): string {
  const content = readFileSync(path);
  return createHash("sha256").update(content).digest("hex");
}

function latestManifest(): BackupManifest {
  const manifests = readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith("manifest-"))
    .sort()
    .reverse();

  if (manifests.length === 0) {
    console.error("No backup manifests found in:", BACKUP_DIR);
    process.exit(1);
  }

  return JSON.parse(readFileSync(join(BACKUP_DIR, manifests[0]!), "utf-8")) as BackupManifest;
}

async function create(): Promise<void> {
  if (!existsSync(DB_PATH)) {
    console.error("Database not found at:", DB_PATH);
    process.exit(1);
  }

  mkdirSync(BACKUP_DIR, { recursive: true });

  const timestamp = getTimestamp();
  const backupPath = join(BACKUP_DIR, `nfr-workos-${timestamp}.db`);

  copyFileSync(DB_PATH, backupPath);

  const hash = hashFile(backupPath);

  const manifest: BackupManifest = {
    timestamp,
    backupPath,
    originalPath: DB_PATH,
    sha256: hash,
    releaseVersion: RELEASE_VERSION,
    schemaVersion: SCHEMA_VERSION,
    note: "Backup excludes API keys and runtime secrets",
  };

  writeFileSync(join(BACKUP_DIR, `manifest-${timestamp}.json`), JSON.stringify(manifest, null, 2));

  console.log("Backup created:", backupPath);
  console.log("SHA-256:", hash);
}

async function verify(): Promise<void> {
  if (!existsSync(BACKUP_DIR)) {
    console.error("No backup directory found at:", BACKUP_DIR);
    process.exit(1);
  }

  const manifest = latestManifest();

  if (!existsSync(manifest.backupPath)) {
    console.error("Backup file not found:", manifest.backupPath);
    process.exit(1);
  }

  const currentHash = hashFile(manifest.backupPath);
  if (currentHash !== manifest.sha256) {
    console.error("BACKUP INTEGRITY FAILURE: hash mismatch");
    console.error("  Expected:", manifest.sha256);
    console.error("  Got:     ", currentHash);
    process.exit(1);
  }

  console.log("Backup verified:", manifest.backupPath);
  console.log("SHA-256 matches:", currentHash);
  console.log("Schema version:", manifest.schemaVersion);
  console.log("Release version:", manifest.releaseVersion);
}

async function restore(): Promise<void> {
  if (!existsSync(BACKUP_DIR)) {
    console.error("No backup directory found at:", BACKUP_DIR);
    process.exit(1);
  }

  const manifest = latestManifest();

  if (!existsSync(manifest.backupPath)) {
    console.error("Backup file not found:", manifest.backupPath);
    process.exit(1);
  }

  // Verify integrity before overwriting live data.
  const hash = hashFile(manifest.backupPath);
  if (hash !== manifest.sha256) {
    console.error("Cannot restore: backup integrity failure");
    process.exit(1);
  }

  mkdirSync(join(process.cwd(), "data"), { recursive: true });
  copyFileSync(manifest.backupPath, DB_PATH);
  console.log("Database restored from:", manifest.backupPath);
  console.log("Run db:seed to re-seed if needed");
}

const command = process.argv[2];
if (command === "create") {
  create().catch((err: unknown) => {
    console.error("backup create error:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
} else if (command === "verify") {
  verify().catch((err: unknown) => {
    console.error("backup verify error:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
} else if (command === "restore") {
  restore().catch((err: unknown) => {
    console.error("backup restore error:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
} else {
  console.error("Usage: backup.ts [create|verify|restore]");
  process.exit(1);
}
