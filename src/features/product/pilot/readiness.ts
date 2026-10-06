/**
 * Pilot readiness, read from the actual controls.
 *
 * Server only. Two groups, both computed on the request that renders them:
 *
 *   Product checks   the checks `/settings/pilot` shows, from
 *                    `runReadinessChecks` in `src/product/status/sources.ts`.
 *                    The same function, not a copy, so the settings page and
 *                    the pilot workspace cannot disagree.
 *   Controls         the Wave 5 exit criteria a bank pilot depends on: role
 *                    switching, reset, identity on approvals, integrations,
 *                    backup and restore, the support bundle and the audit
 *                    trail. Each one reads what the product does today, never
 *                    what it is meant to do.
 *
 * The facts are collected here; the readings are decided by the pure rules
 * in `readiness-rules.ts`. Nothing here writes to the live database. The
 * backup check restores into a scratch file in the operating system's
 * temporary directory and removes it before returning.
 */

import { copyFileSync, existsSync, readdirSync, readFileSync, realpathSync, rmSync, statSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import Database from "better-sqlite3";
import { getSqlite, resolveDbPath } from "@/db/client";
import { DEFAULT_RUN_ID } from "@/db/schema/core";
import { getProductMode } from "@/identity/product-mode";
import { getScenarioState } from "@/scenario/engine/state";
import { overallStatus, type ProductStatus, type StatusReading } from "@/product/status/vocabulary";
import {
  readAuditIntegrity,
  readConnectorStatusCounts,
  runReadinessChecks,
  type ReadinessCheck,
} from "@/product/status/sources";
import { APPROVAL_IDENTITY_SOURCE, ENFORCEMENT_POINTS } from "./enforcement";
import {
  approvalIdentityReading,
  backupReading,
  containsCredentialShape,
  integrationReading,
  resetReading,
  roleSwitchReading,
  supportBundleReading,
  type BackupFacts,
  type ConnectorCounts,
  type SupportBundleFacts,
} from "./readiness-rules";

type Bilingual = { en: string; de: string };

export type PilotControlId =
  | "role-switch"
  | "reset"
  | "approval-identity"
  | "integrations"
  | "backup-restore"
  | "support-bundle"
  | "audit-chain"
  | "audit-coverage";

export interface PilotControl {
  id: PilotControlId;
  label: Bilingual;
  /** The Wave 5 exit criterion or plan item the control answers. */
  criterion: Bilingual;
  reading: StatusReading;
  /** Where the reading comes from, for the evidence pack and the screen. */
  source: string;
}

export interface PilotReadiness {
  checkedAt: string;
  /** The `/settings/pilot` checks, unchanged. */
  productChecks: ReadinessCheck[];
  controls: PilotControl[];
  /** The overall reading across both groups. */
  overall: ProductStatus;
  verified: number;
  total: number;
}

/* ==========================================================================
   Facts
   ========================================================================== */

function runIdNow(): string {
  try {
    return getScenarioState()?.runId ?? DEFAULT_RUN_ID;
  } catch {
    return DEFAULT_RUN_ID;
  }
}

function readApprovalIdentityFacts(runId: string) {
  try {
    const byApprover = getSqlite()
      .prepare(
        "SELECT approved_by_user_id AS userId, count(*) AS count FROM approvals WHERE run_id = ? GROUP BY approved_by_user_id",
      )
      .all(runId) as Array<{ userId: string; count: number }>;
    const holders = getSqlite()
      .prepare("SELECT holder_user_id AS id FROM roles WHERE run_id = ?")
      .all(runId) as Array<{ id: string }>;
    return { byApprover, roleHolderIds: new Set(holders.map((row) => row.id)) };
  } catch {
    return null;
  }
}

function readConnectorCounts(): ConnectorCounts | null {
  const counts = readConnectorStatusCounts();
  if (counts === null) return null;
  const tally: ConnectorCounts = { live: 0, simulated: 0, notVerified: 0, unavailable: 0 };
  for (const entry of counts) {
    if (entry.status === "live") tally.live += entry.count;
    else if (entry.status === "simulated") tally.simulated += entry.count;
    else if (entry.status === "not-verified") tally.notVerified += entry.count;
    else tally.unavailable += entry.count;
  }
  return tally;
}

/** A path compared the way the file system resolves it, so a short and a long Windows name agree. */
function canonicalPath(path: string): string {
  const absolute = resolve(path);
  let real = absolute;
  try {
    if (existsSync(absolute)) real = realpathSync.native(absolute);
  } catch {
    real = absolute;
  }
  return process.platform === "win32" ? real.toLowerCase() : real;
}

interface BackupManifestShape {
  timestamp: string;
  backupPath: string;
  originalPath: string;
  sha256: string;
}

function isManifest(value: unknown): value is BackupManifestShape {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.timestamp === "string" &&
    typeof candidate.backupPath === "string" &&
    typeof candidate.originalPath === "string" &&
    typeof candidate.sha256 === "string"
  );
}

function countMigrations(sqlite: Database.Database): number | null {
  try {
    const row = sqlite.prepare("SELECT count(*) AS n FROM __drizzle_migrations").get() as { n: number } | undefined;
    return row?.n ?? 0;
  } catch {
    return null;
  }
}

/**
 * The backup facts, following `scripts/backup.ts` exactly: the same folder
 * (`backups/` under the working directory), the same "latest manifest" rule
 * and the same restore target (`data/nfr-workos.db` under the working
 * directory).
 *
 * `root` and `databasePath` are parameters so a test can point the check at
 * a temporary directory; the page passes neither.
 */
export function collectBackupFacts(
  options: { root?: string; databasePath?: string; liveMigrations?: number | null } = {},
): BackupFacts {
  const root = options.root ?? process.cwd();
  const configured = options.databasePath ?? resolveDbPath();
  const backupDir = join(root, "backups");

  let manifests: string[] = [];
  try {
    if (existsSync(backupDir)) {
      manifests = readdirSync(backupDir)
        .filter((name) => name.startsWith("manifest-") && name.endsWith(".json"))
        .sort()
        .reverse();
    }
  } catch {
    return { state: "unreadable-manifest" };
  }
  const latest = manifests[0];
  if (!latest) return { state: "no-backup" };

  let manifest: BackupManifestShape;
  try {
    const parsed: unknown = JSON.parse(readFileSync(join(backupDir, latest), "utf-8"));
    if (!isManifest(parsed)) return { state: "unreadable-manifest" };
    manifest = parsed;
  } catch {
    return { state: "unreadable-manifest" };
  }

  const timestamp = manifest.timestamp;
  if (!existsSync(manifest.backupPath)) return { state: "missing-file", timestamp };

  const hash = createHash("sha256").update(readFileSync(manifest.backupPath)).digest("hex");
  if (hash !== manifest.sha256) return { state: "hash-mismatch", timestamp };

  if (canonicalPath(manifest.originalPath) !== canonicalPath(configured)) {
    return { state: "other-database", timestamp, backedUp: manifest.originalPath, configured };
  }

  /*
   * The restore, into a scratch file. Opened read only after the copy, so the
   * check cannot change the backup either. The integrity check reads every
   * page, which is what makes this a restore test rather than a file copy.
   */
  const scratch = join(tmpdir(), `nfros-restore-check-${randomUUID()}.db`);
  try {
    copyFileSync(manifest.backupPath, scratch);
    const restored = new Database(scratch, { readonly: true, fileMustExist: true });
    try {
      const integrity = restored.prepare("PRAGMA integrity_check").all() as Array<{ integrity_check: string }>;
      const ok = integrity.length === 1 && integrity[0]?.integrity_check === "ok";
      if (!ok) {
        return {
          state: "restore-failed",
          timestamp,
          reason: `the integrity check reported ${integrity.length} problems.`,
        };
      }
      const tables = (
        restored.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table'").get() as { n: number }
      ).n;
      const migrations = countMigrations(restored);
      if (migrations === null) {
        return { state: "restore-failed", timestamp, reason: "the restored file has no migration record." };
      }
      const liveMigrations =
        options.liveMigrations !== undefined ? options.liveMigrations : countMigrations(getSqlite());
      const restoreTarget = join(root, "data", "nfr-workos.db");
      return {
        state: "restored",
        timestamp,
        tables,
        migrations,
        liveMigrations,
        restoreTargetMatches: canonicalPath(restoreTarget) === canonicalPath(configured),
        configured,
      };
    } finally {
      restored.close();
    }
  } catch (error) {
    return {
      state: "restore-failed",
      timestamp,
      reason: error instanceof Error ? `the file could not be opened (${error.name}).` : "the file could not be opened.",
    };
  } finally {
    try {
      rmSync(scratch, { force: true });
    } catch {
      /* The operating system clears its temporary directory; a leftover copy is not a failure of the check. */
    }
  }
}

/**
 * The support bundle facts, from the latest bundle `scripts/support-bundle.ts`
 * wrote under `support-bundles/` in the working directory.
 */
export function collectSupportBundleFacts(root: string = process.cwd()): SupportBundleFacts {
  const dir = join(root, "support-bundles");
  let bundles: string[] = [];
  try {
    if (existsSync(dir)) {
      bundles = readdirSync(dir)
        .filter((name) => name.startsWith("bundle-") && statSync(join(dir, name)).isDirectory())
        .sort()
        .reverse();
    }
  } catch {
    bundles = [];
  }
  const latest = bundles[0];
  if (!latest) return { state: "none" };

  const bundleDir = join(dir, latest);
  let contents: string[];
  let createdAt: string | null = null;
  try {
    const manifest = JSON.parse(readFileSync(join(bundleDir, "manifest.json"), "utf-8")) as {
      contents?: unknown;
      createdAt?: unknown;
    };
    if (!Array.isArray(manifest.contents) || !manifest.contents.every((entry) => typeof entry === "string")) {
      return { state: "unreadable", bundle: latest };
    }
    contents = manifest.contents as string[];
    createdAt = typeof manifest.createdAt === "string" ? manifest.createdAt : null;
  } catch {
    return { state: "unreadable", bundle: latest };
  }

  const missing = contents.filter((name) => !existsSync(join(bundleDir, name)));
  if (missing.length > 0) return { state: "incomplete", bundle: latest, missing };

  const flagged = [...contents, "manifest.json"].filter((name) => {
    try {
      return containsCredentialShape(readFileSync(join(bundleDir, name), "utf-8"));
    } catch {
      return false;
    }
  });
  if (flagged.length > 0) return { state: "credential-shape", bundle: latest, files: flagged };

  return { state: "clean", bundle: latest, createdAt, files: contents.length };
}

/* ==========================================================================
   The readiness model
   ========================================================================== */

const CONTROL_LABELS: Record<PilotControlId, { label: Bilingual; criterion: Bilingual }> = {
  "role-switch": {
    label: { en: "Analysts cannot switch role", de: "Fachkraefte koennen die Rolle nicht wechseln" },
    criterion: { en: "Wave 5: analyst cannot role switch", de: "Welle 5: kein Rollenwechsel durch Fachkraefte" },
  },
  reset: {
    label: { en: "Analysts cannot reset the day", de: "Fachkraefte koennen den Tag nicht zuruecksetzen" },
    criterion: { en: "Wave 5: analyst cannot reset", de: "Welle 5: kein Zuruecksetzen durch Fachkraefte" },
  },
  "approval-identity": {
    label: { en: "Identity binds approvals", de: "Identitaet bindet Genehmigungen" },
    criterion: { en: "Wave 5: identity binds approvals", de: "Welle 5: Identitaet bindet Genehmigungen" },
  },
  integrations: {
    label: { en: "Integration status", de: "Status der Integrationen" },
    criterion: {
      en: "Wave 5: one verified inbound and one verified outbound integration; integration status is honest",
      de: "Welle 5: je eine gepruefte eingehende und ausgehende Integration; der Integrationsstatus ist ehrlich",
    },
  },
  "backup-restore": {
    label: { en: "Backup and restore", de: "Sicherung und Wiederherstellung" },
    criterion: { en: "Wave 5: backup and restore", de: "Welle 5: Sicherung und Wiederherstellung" },
  },
  "support-bundle": {
    label: { en: "Support bundle", de: "Supportpaket" },
    criterion: { en: "Wave 5: support bundle works", de: "Welle 5: das Supportpaket funktioniert" },
  },
  "audit-chain": {
    label: { en: "Audit chain intact", de: "Audit-Kette intakt" },
    criterion: {
      en: "Pilot readiness: the audit trail is tamper evident",
      de: "Pilotbereitschaft: der Audit-Trail ist manipulationssicher nachweisbar",
    },
  },
  "audit-coverage": {
    label: { en: "Audit trail covered by the chain", de: "Audit-Trail von der Kette abgedeckt" },
    criterion: {
      en: "Pilot readiness: every audit event is in the chain",
      de: "Pilotbereitschaft: jedes Audit-Ereignis ist in der Kette",
    },
  },
};

function control(id: PilotControlId, reading: StatusReading, source: string): PilotControl {
  return { id, ...CONTROL_LABELS[id], reading, source };
}

/** The design-partner controls, each computed on this request. */
export function readPilotControls(): PilotControl[] {
  const mode = getProductMode();
  const rawMode = process.env["PRODUCT_MODE"] ?? "";
  const runId = runIdNow();

  const identityFacts = readApprovalIdentityFacts(runId);
  const audit = readAuditIntegrity(runId);

  return [
    control(
      "role-switch",
      roleSwitchReading(mode, rawMode, ENFORCEMENT_POINTS.roleSwitch),
      `${ENFORCEMENT_POINTS.roleSwitch.file}: ${ENFORCEMENT_POINTS.roleSwitch.functionName}; PRODUCT_MODE`,
    ),
    control(
      "reset",
      resetReading(mode, rawMode, ENFORCEMENT_POINTS.reset),
      `${ENFORCEMENT_POINTS.reset.file}: ${ENFORCEMENT_POINTS.reset.functionName}; PRODUCT_MODE`,
    ),
    control(
      "approval-identity",
      identityFacts === null
        ? {
            status: "unavailable",
            detail: {
              en: "The approvals could not be read.",
              de: "Die Genehmigungen konnten nicht gelesen werden.",
            },
          }
        : approvalIdentityReading({ source: APPROVAL_IDENTITY_SOURCE, ...identityFacts }),
      "approvals, roles",
    ),
    control("integrations", integrationReading(readConnectorCounts()), "connector_instances"),
    control("backup-restore", backupReading(collectBackupFacts()), "backups/, scripts/backup.ts"),
    control("support-bundle", supportBundleReading(collectSupportBundleFacts()), "support-bundles/, scripts/support-bundle.ts"),
    control("audit-chain", audit.chain, "audit_chain_records"),
    control("audit-coverage", audit.coverage, "audit_events, audit_chain_records"),
  ];
}

/**
 * Everything the readiness section shows.
 *
 * The audit chain and its coverage are already product checks; they are
 * listed once, under the controls, because that is where a pilot reviewer
 * looks for them. The overall reading follows `overallStatus`: a summary is
 * never more confident than its least confident part.
 */
export function readPilotReadiness(): PilotReadiness {
  const productChecks = runReadinessChecks().filter(
    (check) => check.id !== "audit-chain" && check.id !== "audit-coverage",
  );
  const controls = readPilotControls();
  const statuses = [...productChecks.map((check) => check.reading.status), ...controls.map((entry) => entry.reading.status)];
  return {
    checkedAt: new Date().toISOString(),
    productChecks,
    controls,
    overall: overallStatus(statuses),
    verified: statuses.filter((status) => status === "verified").length,
    total: statuses.length,
  };
}
