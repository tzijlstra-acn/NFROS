#!/usr/bin/env tsx
/**
 * scripts/evidence-pack.ts
 *
 * Generates a pilot evidence pack at release/pilot-evidence.json.
 *
 * The pack contains:
 * - Product version (from package.json)
 * - Run date
 * - The six pilot readiness check results
 * - Seeded data summary (role app run count, stage run count, AI routines count)
 * - Regulatory scope note
 * - Synthetic institution disclosure
 *
 * The pack contains NO credentials, NO session secrets, NO personal data and
 * NO evidence document text.
 *
 * Run with: npm run pilot:evidence-pack
 */

import { writeFileSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";
import { closeDb, getSqlite, resolveDbPath } from "../src/db/client.js";
import { existsSync } from "fs";

/* ==========================================================================
   Types
   ========================================================================== */

type CheckStatus = "pass" | "warn" | "error";

interface CheckResult {
  id: string;
  label: string;
  detail: string;
  status: CheckStatus;
}

interface DataSummary {
  roleAppRunCount: number;
  stageRunCount: number;
  aiRoutinesCount: number;
}

interface EvidencePack {
  productVersion: string;
  runDate: string;
  readinessChecks: CheckResult[];
  readinessSummary: {
    total: number;
    pass: number;
    warn: number;
    error: number;
    allPass: boolean;
  };
  dataSummary: DataSummary;
  regulatoryScope: {
    jurisdiction: string;
    frameworks: string[];
    note: string;
    disclaimer: string;
  };
  syntheticInstitutionDisclosure: string;
  pilotAccounts: Array<{
    userId: string;
    displayName: string;
    roleIds: readonly string[];
    isAdministrator: boolean;
    institution: string;
  }>;
  schemaVersion: string;
}

/* ==========================================================================
   Helpers
   ========================================================================== */

function getVersion(): string {
  try {
    const pkgPath = join(process.cwd(), "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version?: string };
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

function dbAvailable(): boolean {
  const path = resolveDbPath();
  return existsSync(path);
}

/* ==========================================================================
   Readiness checks
   ========================================================================== */

function runChecks(): CheckResult[] {
  const checks: CheckResult[] = [];

  // 1. Database: accessible
  {
    let status: CheckStatus = "error";
    let detail = "Database could not be reached.";
    try {
      if (!dbAvailable()) {
        status = "error";
        detail = "Database file not found. Run db:migrate and db:seed.";
      } else {
        const row = getSqlite()
          .prepare("SELECT count(*) as n FROM sqlite_master WHERE type = 'table'")
          .get() as { n: number } | undefined;
        const tableCount = row?.n ?? 0;
        if (tableCount > 0) {
          status = "pass";
          detail = `Schema present -- ${String(tableCount)} tables found.`;
        } else {
          status = "warn";
          detail = "Database accessible but no tables found. Run db:migrate and db:seed.";
        }
      }
    } catch (err) {
      status = "error";
      detail = `Database not accessible: ${err instanceof Error ? err.message : "unknown error"}.`;
    }
    checks.push({ id: "database", label: "Database: accessible", detail, status });
  }

  // 2. Seed data: loaded
  {
    let status: CheckStatus = "warn";
    let detail = "role_app_runs table empty or not yet migrated.";
    try {
      const row = getSqlite()
        .prepare("SELECT count(*) as n FROM role_app_runs")
        .get() as { n: number } | undefined;
      const count = row?.n ?? 0;
      if (count > 0) {
        status = "pass";
        detail = `${String(count)} process run(s) seeded.`;
      }
    } catch {
      status = "warn";
      detail = "role_app_runs table not found. Run db:migrate and db:seed.";
    }
    checks.push({ id: "seed-data", label: "Seed data: loaded", detail, status });
  }

  // 3. Identity mode: configured
  {
    const productMode = process.env["PRODUCT_MODE"] ?? "";
    let status: CheckStatus = "warn";
    let detail = "";
    if (productMode === "design-partner") {
      status = "pass";
      detail = "PRODUCT_MODE = design-partner. Role assignment is fixed per account.";
    } else if (productMode === "offline-evaluation") {
      status = "pass";
      detail = "PRODUCT_MODE = offline-evaluation. Sessions are unattended-safe.";
    } else if (productMode === "") {
      status = "warn";
      detail = "PRODUCT_MODE is not set. Running in demonstration mode -- not suitable for pilot sessions.";
    } else {
      status = "warn";
      detail = `PRODUCT_MODE = ${productMode}. Set to 'design-partner' for pilot sessions.`;
    }
    checks.push({ id: "identity-mode", label: "Identity mode: configured", detail, status });
  }

  // 4. AI routines: seeded
  {
    let status: CheckStatus = "warn";
    let detail = "ai_routines table empty or not yet migrated.";
    try {
      const row = getSqlite()
        .prepare("SELECT count(*) as n FROM ai_routines")
        .get() as { n: number } | undefined;
      const count = row?.n ?? 0;
      if (count > 0) {
        status = "pass";
        detail = `${String(count)} AI routine(s) seeded.`;
      }
    } catch {
      status = "warn";
      detail = "ai_routines table not found. Run db:migrate and db:seed.";
    }
    checks.push({ id: "ai-routines", label: "AI routines: seeded", detail, status });
  }

  // 5. Audit chain: initialised
  {
    let status: CheckStatus = "warn";
    let detail = "audit_chain_records table not found.";
    try {
      const row = getSqlite()
        .prepare("SELECT count(*) as n FROM audit_chain_records")
        .get() as { n: number } | undefined;
      const count = row?.n ?? 0;
      status = "pass";
      detail =
        count > 0
          ? `Audit chain initialised -- ${String(count)} record(s).`
          : "Audit chain table present. Records written when events occur.";
    } catch {
      status = "warn";
    }
    checks.push({ id: "audit-chain", label: "Audit chain: initialised", detail, status });
  }

  // 6. At least one process run active
  {
    let status: CheckStatus = "warn";
    let detail = "No active process runs found. Run db:seed.";
    try {
      const row = getSqlite()
        .prepare("SELECT count(*) as n FROM role_app_runs WHERE status != 'archived'")
        .get() as { n: number } | undefined;
      const count = row?.n ?? 0;
      if (count > 0) {
        status = "pass";
        detail = `${String(count)} active process run(s).`;
      }
    } catch {
      status = "warn";
      detail = "role_app_runs table not found. Run db:migrate and db:seed.";
    }
    checks.push({ id: "active-run", label: "At least one process run active", detail, status });
  }

  return checks;
}

/* ==========================================================================
   Data summary
   ========================================================================== */

function getDataSummary(): DataSummary {
  let roleAppRunCount = 0;
  let stageRunCount = 0;
  let aiRoutinesCount = 0;

  if (!dbAvailable()) return { roleAppRunCount, stageRunCount, aiRoutinesCount };

  try {
    const r1 = getSqlite()
      .prepare("SELECT count(*) as n FROM role_app_runs")
      .get() as { n: number } | undefined;
    roleAppRunCount = r1?.n ?? 0;
  } catch {
    /* table may not exist */
  }

  try {
    const r2 = getSqlite()
      .prepare("SELECT count(*) as n FROM role_app_stage_runs")
      .get() as { n: number } | undefined;
    stageRunCount = r2?.n ?? 0;
  } catch {
    /* table may not exist */
  }

  try {
    const r3 = getSqlite()
      .prepare("SELECT count(*) as n FROM ai_routines")
      .get() as { n: number } | undefined;
    aiRoutinesCount = r3?.n ?? 0;
  } catch {
    /* table may not exist */
  }

  return { roleAppRunCount, stageRunCount, aiRoutinesCount };
}

/* ==========================================================================
   Main
   ========================================================================== */

async function main(): Promise<void> {
  console.log("Generating pilot evidence pack...");

  const version = getVersion();
  const runDate = new Date().toISOString();
  const checks = runChecks();
  const dataSummary = getDataSummary();

  const passCount = checks.filter((c) => c.status === "pass").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;
  const errorCount = checks.filter((c) => c.status === "error").length;

  // Pilot accounts -- no credentials
  const pilotAccounts = [
    {
      userId: "PILOT-001",
      displayName: "RCSA Analyst (Pilot)",
      roleIds: ["rcsa"] as readonly string[],
      isAdministrator: false,
      institution: "Arcadia Savings Bank",
    },
    {
      userId: "PILOT-002",
      displayName: "TPRM Analyst (Pilot)",
      roleIds: ["tprm"] as readonly string[],
      isAdministrator: false,
      institution: "Arcadia Savings Bank",
    },
    {
      userId: "PILOT-ADM",
      displayName: "Pilot Administrator",
      roleIds: [] as readonly string[],
      isAdministrator: true,
      institution: "Arcadia Savings Bank",
    },
  ];

  const pack: EvidencePack = {
    productVersion: version,
    runDate,
    readinessChecks: checks,
    readinessSummary: {
      total: checks.length,
      pass: passCount,
      warn: warnCount,
      error: errorCount,
      allPass: errorCount === 0 && warnCount === 0,
    },
    dataSummary,
    regulatoryScope: {
      jurisdiction: "DE",
      frameworks: ["DORA (Digital Operational Resilience Act)", "EBA ICT and security risk guidelines"],
      note:
        "DORA and EBA guidelines apply to DE/AT entities. FINMA circulars apply to CH entities only and DORA does not directly apply to Swiss entities.",
      disclaimer:
        "Illustrative regulatory context, not legal advice.",
    },
    syntheticInstitutionDisclosure:
      "Arcadia Savings Bank is a synthetic institution. All persons, suppliers, controls, risks, incidents and regulatory references in this environment are invented for the purpose of this pilot. No real organisation is described.",
    pilotAccounts,
    schemaVersion: "v4-pilot-readiness",
  };

  const releaseDir = join(process.cwd(), "release");
  mkdirSync(releaseDir, { recursive: true });

  const outputPath = join(releaseDir, "pilot-evidence.json");
  writeFileSync(outputPath, JSON.stringify(pack, null, 2));

  console.log(`Evidence pack written: ${outputPath}`);
  console.log(
    `Readiness: ${String(passCount)} pass / ${String(warnCount)} warn / ${String(errorCount)} error`,
  );

  if (errorCount > 0) {
    console.warn("One or more checks returned error status. Review the evidence pack.");
  }

  try {
    closeDb();
  } catch {
    /* ignore */
  }
}

main().catch((err: unknown) => {
  console.error(
    "Evidence pack generation failed:",
    err instanceof Error ? err.message : "unknown error",
  );
  process.exit(1);
});
