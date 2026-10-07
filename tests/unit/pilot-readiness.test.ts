/**
 * Pilot readiness reads the actual controls (plan Wave 5).
 *
 * Three kinds of test:
 *
 *   the readings: a control is Verified only when its facts show it holding,
 *   and the role switch and reset stay Not verified while the server action
 *   does not apply the rule, whatever the product mode says;
 *
 *   the pins: `enforcement.ts` states what the code does, and these tests read
 *   the code and fail the day the two disagree;
 *
 *   the backup and support bundle checks, against temporary directories laid
 *   out exactly as `scripts/backup.ts` and `scripts/support-bundle.ts` write
 *   them, with a real SQLite file restored into a scratch copy.
 */

import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { APPROVAL_WRITERS, ENFORCEMENT_POINTS } from "@/features/product/pilot/enforcement";
import {
  approvalIdentityReading,
  backupReading,
  containsCredentialShape,
  integrationReading,
  resetReading,
  roleSwitchReading,
  supportBundleReading,
} from "@/features/product/pilot/readiness-rules";
import { collectBackupFacts, collectSupportBundleFacts } from "@/features/product/pilot/readiness";
import { pilotPageAllowed } from "@/features/product/pilot/access";

function functionBody(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}`);
  if (start < 0) throw new Error(`${name} not found`);
  const next = source.indexOf("\nexport ", start + 10);
  return source.slice(start, next < 0 ? undefined : next);
}

describe("role switch and reset", () => {
  const unenforced = { checksSession: false, checksProductMode: false, functionName: "actionSwitchRole" };
  const enforced = { checksSession: true, checksProductMode: true, functionName: "actionSwitchRole" };

  it("is not verified in demonstration mode", () => {
    expect(roleSwitchReading("demonstration", "", unenforced).status).toBe("not-verified");
    expect(resetReading("demonstration", "", unenforced).status).toBe("not-verified");
  });

  it("stays not verified in design-partner mode while the action does not apply the rule", () => {
    const reading = roleSwitchReading("design-partner", "design-partner", unenforced);
    expect(reading.status).toBe("not-verified");
    expect(reading.detail.en).toContain("not enforced");
    expect(resetReading("design-partner", "design-partner", unenforced).status).toBe("not-verified");
  });

  it("is verified only when the mode forbids it and the action enforces it", () => {
    expect(roleSwitchReading("design-partner", "design-partner", enforced).status).toBe("verified");
    expect(roleSwitchReading("demonstration", "", enforced).status).toBe("not-verified");
  });
});

describe("the enforcement statements match the code", () => {
  const actions = readFileSync(join(process.cwd(), "app", "actions.ts"), "utf-8");

  it("states correctly whether the role switch and reset check the session or the mode", () => {
    for (const point of Object.values(ENFORCEMENT_POINTS)) {
      const body = functionBody(actions, point.functionName);
      expect(/getSession\(|requireSession\(/.test(body), `${point.functionName} session check`).toBe(point.checksSession);
      expect(body.includes(`${point.rule}(`), `${point.functionName} mode rule`).toBe(point.checksProductMode);
    }
  });

  it("states correctly that approvals are granted in the seeded role holder's name", () => {
    for (const writer of APPROVAL_WRITERS) {
      const source = readFileSync(join(process.cwd(), writer.file), "utf-8");
      expect(source.includes(writer.marker), `${writer.file} uses ${writer.marker}`).toBe(true);
    }
  });
});

describe("identity on approvals", () => {
  const holders = new Set(["P-002", "P-003"]);

  it("is not verified while approvals carry the seeded holder", () => {
    expect(approvalIdentityReading({ source: "seeded-role-holder", byApprover: [], roleHolderIds: holders }).status).toBe("not-verified");
    const reading = approvalIdentityReading({ source: "seeded-role-holder", byApprover: [{ userId: "P-003", count: 4 }], roleHolderIds: holders });
    expect(reading.status).toBe("not-verified");
    expect(reading.detail.en).toContain("4 of 4");
  });

  it("is verified only when the session is the source and no approval names a holder", () => {
    expect(approvalIdentityReading({ source: "session", byApprover: [{ userId: "PILOT-001", count: 2 }], roleHolderIds: holders }).status).toBe("verified");
    expect(approvalIdentityReading({ source: "session", byApprover: [{ userId: "P-003", count: 1 }], roleHolderIds: holders }).status).toBe("not-verified");
  });
});

describe("integrations", () => {
  it("reads Simulated when no connector is live", () => {
    expect(integrationReading({ live: 0, simulated: 5, notVerified: 1, unavailable: 11 }).status).toBe("simulated");
  });
  it("never reads Verified, even with a live connector", () => {
    expect(integrationReading({ live: 1, simulated: 0, notVerified: 0, unavailable: 0 }).status).toBe("live");
    expect(integrationReading(null).status).toBe("unavailable");
  });
});

describe("credential shapes", () => {
  it("detects key, token and secret assignments without needing the value", () => {
    expect(containsCredentialShape(`token sk-${"a".repeat(24)}`)).toBe(true);
    expect(containsCredentialShape("SESSION_SECRET=abc")).toBe(true);
    expect(containsCredentialShape("No credentials are included.")).toBe(false);
  });
});

describe("who may open the pilot", () => {
  it("gives the Pilot Lead everything and the Platform Product Owner read-only views", () => {
    expect(pilotPageAllowed("pilot-lead", "setup")).toEqual({ canOpen: true, readOnly: false });
    expect(pilotPageAllowed("platform-product-owner", "exit")).toEqual({ canOpen: true, readOnly: true });
    expect(pilotPageAllowed("platform-product-owner", "setup").canOpen).toBe(false);
    expect(pilotPageAllowed("ai-quality-owner", "overview").canOpen).toBe(false);
    expect(pilotPageAllowed(null, "overview").canOpen).toBe(false);
  });
});

/* ==========================================================================
   Backup and restore, and the support bundle, against real files
   ========================================================================== */

describe("backup and restore check", () => {
  let root: string;
  let database: string;

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "nfros-pilot-backup-"));
    mkdirSync(join(root, "data"), { recursive: true });
    database = join(root, "data", "nfr-workos.db");
    const sqlite = new Database(database);
    sqlite.exec("CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY, hash TEXT); INSERT INTO __drizzle_migrations (hash) VALUES ('a'), ('b');");
    sqlite.exec("CREATE TABLE pilot_programmes (id TEXT PRIMARY KEY); INSERT INTO pilot_programmes VALUES ('PILOT-1');");
    sqlite.close();
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  /** Writes a backup and manifest the way `scripts/backup.ts create` does. */
  function takeBackup(source: string, timestamp: string): string {
    mkdirSync(join(root, "backups"), { recursive: true });
    const backupPath = join(root, "backups", `nfr-workos-${timestamp}.db`);
    writeFileSync(backupPath, readFileSync(source));
    const sha256 = createHash("sha256").update(readFileSync(backupPath)).digest("hex");
    writeFileSync(
      join(root, "backups", `manifest-${timestamp}.json`),
      JSON.stringify({ timestamp, backupPath, originalPath: source, sha256, releaseVersion: "4.1.0", schemaVersion: "V3+runtime" }),
    );
    return backupPath;
  }

  it("reads no backup as not verified", () => {
    expect(backupReading(collectBackupFacts({ root, databasePath: database, liveMigrations: 2 })).status).toBe("not-verified");
  });

  it("restores the latest backup into a scratch file and verifies it", () => {
    takeBackup(database, "2026-10-06T10-00-00-000Z");
    const facts = collectBackupFacts({ root, databasePath: database, liveMigrations: 2 });
    expect(facts.state).toBe("restored");
    expect(backupReading(facts).status).toBe("verified");
  });

  it("refuses a backup of another database, the backup script's default-path behaviour", () => {
    const other = join(root, "other.db");
    writeFileSync(other, readFileSync(database));
    takeBackup(other, "2026-10-06T11-00-00-000Z");
    const facts = collectBackupFacts({ root, databasePath: database, liveMigrations: 2 });
    expect(facts.state).toBe("other-database");
    expect(backupReading(facts).detail.en).toContain("does not read NFR_DB_PATH");
  });

  it("refuses a backup whose hash no longer matches", () => {
    const path = takeBackup(database, "2026-10-06T12-00-00-000Z");
    writeFileSync(path, Buffer.concat([readFileSync(path), Buffer.from("tampered")]));
    expect(collectBackupFacts({ root, databasePath: database, liveMigrations: 2 }).state).toBe("hash-mismatch");
  });

  it("reads a restore target that is not the configured database as not verified", () => {
    takeBackup(database, "2026-10-06T13-00-00-000Z");
    const elsewhere = join(root, "elsewhere");
    mkdirSync(elsewhere, { recursive: true });
    const facts = collectBackupFacts({ root: elsewhere, databasePath: database, liveMigrations: 2 });
    expect(facts.state).toBe("no-backup");
  });
});

describe("support bundle check", () => {
  let root: string;
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "nfros-pilot-bundle-"));
  });
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  function bundle(name: string, files: Record<string, string>, contents: string[]): void {
    const dir = join(root, "support-bundles", name);
    mkdirSync(dir, { recursive: true });
    for (const [file, text] of Object.entries(files)) writeFileSync(join(dir, file), text);
    writeFileSync(join(dir, "manifest.json"), JSON.stringify({ bundleId: name, createdAt: "2026-10-06T10:00:00.000Z", contents, sanitized: true }));
  }

  it("reads none, clean, incomplete and credential-bearing bundles honestly", () => {
    expect(supportBundleReading(collectSupportBundleFacts(root)).status).toBe("not-verified");

    bundle("bundle-2026-10-06T10-00-00-000Z", { "health.json": "{}", "release.json": "{}" }, ["health.json", "release.json"]);
    expect(supportBundleReading(collectSupportBundleFacts(root)).status).toBe("verified");

    bundle("bundle-2026-10-06T11-00-00-000Z", { "health.json": "{}" }, ["health.json", "release.json"]);
    expect(collectSupportBundleFacts(root).state).toBe("incomplete");

    bundle("bundle-2026-10-06T12-00-00-000Z", { "health.json": `{"k":"sk-${"b".repeat(30)}"}` }, ["health.json"]);
    const facts = collectSupportBundleFacts(root);
    expect(facts.state).toBe("credential-shape");
    expect(supportBundleReading(facts).detail.en).not.toContain("bbbbbbbb");
  });
});
