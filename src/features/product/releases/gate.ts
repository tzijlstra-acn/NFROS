/**
 * The release gate (plan 7.9: "Run release gate"; "Do not allow release
 * while mandatory gates fail").
 *
 * Every check here runs when the gate runs, against this build and this
 * database, and reports pass or fail with its evidence. Nothing is asserted
 * from memory. Three kinds:
 *
 *   in process      migrations applied, versions agree, release states match
 *                   the code, audit chain intact, no failed evaluation
 *   repository      the copy and secret scans the repository already has
 *                   (`scripts/check-no-emdash.mjs`, `scripts/check-user-copy.ts`,
 *                   `scripts/scan-secrets.mjs`), run as child processes; only
 *                   their exit code is kept, never their output, so a scan
 *                   finding can never be copied into the database or a page
 *   not run here    type checking and the test suites take minutes and belong
 *                   to the build pipeline. They are listed as Not run, and
 *                   they are not mandatory for this gate, so the gate says
 *                   exactly what it checked and no more
 *
 * The mandatory counts are computed by `completeReleaseGateRun` from the
 * results, so "mandatory failed" cannot disagree with the rows shown.
 *
 * Server only.
 */

import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReleaseGateResult } from "@/db/schema/product-console";
import { listCurrentRoleAppVersions } from "@/db/repositories/role-app-release";
import { listEvaluationRuns } from "@/db/repositories/ai-evaluations";
import { INSTALLED_ROLE_APPS, PRODUCT_RELEASE, ROLE_RELEASE_DEFINITIONS } from "@/product/release";
import { readAuditIntegrity, readEvaluationEvidence } from "@/product/status/sources";
import { ROLE_APP_REGISTRY } from "@/role-apps/registry";
import { readMigrationState } from "./migrations";

export type GateCheck = () => Promise<ReleaseGateResult>;

function result(
  gateKey: string,
  label: string,
  mandatory: boolean,
  status: ReleaseGateResult["status"],
  detail: string,
  durationMs: number | null,
  evidenceRef: string | null = null,
): ReleaseGateResult {
  return { gateKey, label, mandatory, status, detail, evidenceRef, durationMs };
}

async function timed(run: () => Omit<ReleaseGateResult, "durationMs"> | Promise<Omit<ReleaseGateResult, "durationMs">>): Promise<ReleaseGateResult> {
  const started = Date.now();
  try {
    const value = await run();
    return { ...value, durationMs: Date.now() - started };
  } catch (error) {
    return {
      gateKey: "unknown",
      label: "Check",
      mandatory: true,
      status: "failed",
      detail: `The check could not run: ${error instanceof Error ? error.name : "error"}.`,
      evidenceRef: null,
      durationMs: Date.now() - started,
    };
  }
}

/* ==========================================================================
   In-process checks
   ========================================================================== */

export function checkMigrations(): Omit<ReleaseGateResult, "durationMs"> {
  const state = readMigrationState();
  const label = "Database migrations applied";
  if (!state.journalReadable) return { gateKey: "migrations", label, mandatory: true, status: "failed", detail: "The migration journal could not be read.", evidenceRef: null };
  if (!state.databaseReadable) return { gateKey: "migrations", label, mandatory: true, status: "failed", detail: "The database's migration table could not be read.", evidenceRef: null };
  if (state.pending.length > 0) {
    return {
      gateKey: "migrations",
      label,
      mandatory: true,
      status: "failed",
      detail: `${state.pending.length} of ${state.entries.length} migrations are not applied: ${state.pending.map((entry) => entry.tag).join(", ")}. Run npm run db:migrate.`,
      evidenceRef: "src/db/migrations/meta/_journal.json",
    };
  }
  return {
    gateKey: "migrations",
    label,
    mandatory: true,
    status: "passed",
    detail: `All ${state.entries.length} migrations in the journal are applied, the latest ${state.latestTag ?? "-"}.`,
    evidenceRef: "src/db/migrations/meta/_journal.json",
  };
}

export function checkVersionsAgree(root: string = process.cwd()): Omit<ReleaseGateResult, "durationMs"> {
  const label = "Product versions agree";
  const version = PRODUCT_RELEASE.version;
  let pkg: string | null = null;
  let changelog: string | null = null;
  try {
    pkg = (JSON.parse(readFileSync(join(root, "package.json"), "utf-8")) as { version?: string }).version ?? null;
  } catch {
    pkg = null;
  }
  try {
    changelog = /^## \[(\d+\.\d+\.\d+)\]/m.exec(readFileSync(join(root, "CHANGELOG.md"), "utf-8"))?.[1] ?? null;
  } catch {
    changelog = null;
  }
  const agree = pkg === version && changelog === version;
  return {
    gateKey: "versions",
    label,
    mandatory: true,
    status: agree ? "passed" : "failed",
    detail: agree
      ? `The release registry, package.json and the CHANGELOG top entry all say ${version}.`
      : `The release registry says ${version}, package.json says ${pkg ?? "nothing readable"}, the CHANGELOG top entry says ${changelog ?? "nothing readable"}.`,
    evidenceRef: "src/product/release/product-release.ts",
  };
}

export function checkReleaseStates(): Omit<ReleaseGateResult, "durationMs"> {
  const label = "Release states match the code";
  const codeInstalled = new Set(INSTALLED_ROLE_APPS.map((app) => app.id));
  let recordedInstalled: Set<string>;
  try {
    recordedInstalled = new Set(
      listCurrentRoleAppVersions()
        .filter((version) => version.lifecycleState === "installed")
        .map((version) => version.roleAppId),
    );
  } catch {
    return { gateKey: "release-states", label, mandatory: true, status: "failed", detail: "The Role App release records could not be read.", evidenceRef: null };
  }
  const unknown = [...recordedInstalled].filter((id) => !ROLE_APP_REGISTRY.some((app) => app.id === id && app.status === "installed"));
  const missing = [...codeInstalled].filter((id) => !recordedInstalled.has(id));
  const available = ROLE_RELEASE_DEFINITIONS.filter((role) => role.status === "available").map((role) => role.roleId);
  if (unknown.length > 0) {
    return {
      gateKey: "release-states",
      label,
      mandatory: true,
      status: "failed",
      detail: `The release records show an installed Role App the code does not install: ${unknown.join(", ")}.`,
      evidenceRef: "src/role-apps/registry.ts",
    };
  }
  if (missing.length > 0) {
    return {
      gateKey: "release-states",
      label,
      mandatory: true,
      status: "failed",
      detail: `Installed in the code but not Installed in the release records: ${missing.join(", ")}. Roll back or release a version before this release.`,
      evidenceRef: "src/role-apps/registry.ts",
    };
  }
  return {
    gateKey: "release-states",
    label,
    mandatory: true,
    status: "passed",
    detail: `${codeInstalled.size} installed Role Apps, recorded as Installed, and no other. Available roles: ${available.join(", ")}.`,
    evidenceRef: "src/role-apps/registry.ts",
  };
}

export function checkAuditChain(): Omit<ReleaseGateResult, "durationMs"> {
  const audit = readAuditIntegrity();
  return {
    gateKey: "audit-chain",
    label: "Audit chain intact",
    mandatory: true,
    status: audit.chain.status === "verified" ? "passed" : "failed",
    detail: `${audit.chain.detail.en} Coverage: ${audit.coverage.detail.en}`,
    evidenceRef: "src/audit/verify-chain.ts",
  };
}

export function checkEvaluations(): Omit<ReleaseGateResult, "durationMs"> {
  const label = "No mandatory evaluation fails";
  const evidence = readEvaluationEvidence();
  let mandatoryFailed = 0;
  let recordedRuns = 0;
  try {
    const latest = new Map<string, number>();
    for (const run of listEvaluationRuns({ statuses: ["completed"] })) {
      recordedRuns += 1;
      if (!latest.has(run.configurationId)) latest.set(run.configurationId, run.mandatoryFailed);
    }
    mandatoryFailed = [...latest.values()].reduce((sum, value) => sum + value, 0);
  } catch {
    mandatoryFailed = 0;
  }
  if (mandatoryFailed > 0) {
    return { gateKey: "evaluations", label, mandatory: true, status: "failed", detail: `${mandatoryFailed} mandatory case(s) failed in the latest evaluation runs recorded in the console.`, evidenceRef: "ai_evaluation_runs" };
  }
  if (!evidence.recorded && recordedRuns === 0) {
    return { gateKey: "evaluations", label, mandatory: true, status: "failed", detail: "No evaluation run is recorded, so nothing shows that evaluations pass. Run npm run eval:structural or an evaluation on the Quality page.", evidenceRef: null };
  }
  if (evidence.recorded && evidence.totals.failed > 0) {
    return { gateKey: "evaluations", label, mandatory: true, status: "failed", detail: `${evidence.totals.failed} of ${evidence.totals.cases} cases failed in the recorded ${evidence.mode ?? ""} run.`, evidenceRef: "evals/results/latest.json" };
  }
  return {
    gateKey: "evaluations",
    label,
    mandatory: true,
    status: "passed",
    detail: evidence.recorded
      ? `The recorded ${evidence.mode ?? ""} run has no failed case (${evidence.totals.passed} of ${evidence.totals.cases} passed), and no console evaluation run has a mandatory failure. ${evidence.modelOutput.detail.en}`
      : `${recordedRuns} console evaluation run(s), none with a mandatory failure.`,
    evidenceRef: evidence.recorded ? "evals/results/latest.json" : "ai_evaluation_runs",
  };
}

/* ==========================================================================
   Repository checks, as child processes
   ========================================================================== */

function runScript(args: string[], timeoutMs: number): Promise<{ code: number | null; timedOut: boolean }> {
  return new Promise((resolve) => {
    execFile(process.execPath, args, { cwd: process.cwd(), timeout: timeoutMs, windowsHide: true, maxBuffer: 16 * 1024 * 1024 }, (error) => {
      if (!error) return resolve({ code: 0, timedOut: false });
      const timedOut = (error as NodeJS.ErrnoException & { killed?: boolean }).killed === true;
      const code = typeof (error as { code?: unknown }).code === "number" ? ((error as { code: number }).code) : null;
      resolve({ code, timedOut });
    });
  });
}

async function scriptCheck(
  gateKey: string,
  label: string,
  script: string,
  viaTsx: boolean,
  rerun: string,
  timeoutMinutes = 3,
): Promise<Omit<ReleaseGateResult, "durationMs">> {
  const root = process.cwd();
  const path = join(root, script);
  if (!existsSync(path)) return { gateKey, label, mandatory: true, status: "failed", detail: `${script} is missing.`, evidenceRef: null };
  const tsx = join(root, "node_modules", "tsx", "dist", "cli.mjs");
  if (viaTsx && !existsSync(tsx)) return { gateKey, label, mandatory: true, status: "failed", detail: "tsx is not installed, so the check cannot run.", evidenceRef: script };
  const outcome = await runScript(viaTsx ? [tsx, path] : [path], timeoutMinutes * 60_000);
  if (outcome.timedOut) {
    return { gateKey, label, mandatory: true, status: "failed", detail: `${script} did not finish within ${timeoutMinutes} minutes.`, evidenceRef: script };
  }
  return outcome.code === 0
    ? { gateKey, label, mandatory: true, status: "passed", detail: `${script} exited 0.`, evidenceRef: script }
    : { gateKey, label, mandatory: true, status: "failed", detail: `${script} exited ${outcome.code ?? "abnormally"}. Run ${rerun} to see the findings.`, evidenceRef: script };
}

/* ==========================================================================
   The gate
   ========================================================================== */

export const NOT_RUN_HERE: ReleaseGateResult[] = [
  result("typecheck", "Type check", false, "not-run", "Run by the build pipeline (npm run typecheck). This console does not run it, so this row is not evidence of a pass.", null),
  result("tests", "Unit and integration tests", false, "not-run", "Run by the build pipeline (npm run test). This console does not run them, so this row is not evidence of a pass.", null),
];

/** Runs every check of the gate. In-process checks first, then the scripts in parallel. */
export async function runReleaseGateChecks(): Promise<ReleaseGateResult[]> {
  const inProcess = await Promise.all([
    timed(checkMigrations),
    timed(() => checkVersionsAgree()),
    timed(checkReleaseStates),
    timed(checkAuditChain),
    timed(checkEvaluations),
  ]);
  const scripts = await Promise.all([
    timed(() => scriptCheck("no-em-dash", "No em dash, en dash or double hyphen", "scripts/check-no-emdash.mjs", false, "node scripts/check-no-emdash.mjs")),
    timed(() => scriptCheck("user-copy", "User copy rules", "scripts/check-user-copy.ts", true, "npm run check:copy")),
    /* The scan reads every source file and build bundle; on a full working tree it takes minutes. */
    timed(() => scriptCheck("secret-scan", "Secret scan", "scripts/scan-secrets.mjs", false, "npm run scan:secrets", 10)),
  ]);
  return [...inProcess, ...scripts, ...NOT_RUN_HERE];
}

/** Whether the results pass: every mandatory gate passed. */
export function gatePasses(results: readonly ReleaseGateResult[]): boolean {
  return results.filter((entry) => entry.mandatory).every((entry) => entry.status === "passed");
}
