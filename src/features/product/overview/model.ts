/**
 * The Product Owner Console overview (plan 7.1).
 *
 * Ten figures and four questions, every one read from a real source on this
 * request:
 *
 *   current release       the release registry, and the console's deployment record
 *   available roles       the role release registry
 *   installed Role Apps   the code registry, the release records and the enablement check
 *   active users          the demonstration personas: there are no named users in
 *                         this build, and the figure says so rather than counting
 *                         sessions as people
 *   active process runs   `role_app_runs`
 *   decisions waiting     open decisions of the Available roles, presented by now
 *   process failures      failed jobs, failed preparations, blocked runs
 *   AI quality status     the recorded evaluation run, in the status vocabulary
 *   connector health      connector instances by status
 *   pilot status          the pilot programme and its unmeasured baselines
 *
 *   What changed since the previous release   the CHANGELOG entry of this
 *                                             version and the console's own records
 *   What needs attention, what is blocked,    rules over the same readings; each
 *   what is performing well                   item names its source, and an empty
 *                                             list says so instead of filling up
 *
 * Server only.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getSqlite } from "@/db/client";
import { DEFAULT_RUN_ID } from "@/db/schema/core";
import { getDeployedRelease, getLatestReleaseGateRun } from "@/db/repositories/release-management";
import { PRODUCT_RELEASE, RELEASE_STAGE_LABELS, rolesWithReleaseStatus } from "@/product/release";
import { readAiMode, readAuditIntegrity, readConnectorStatusCounts, readEvaluationEvidence, type ConnectorStatusCount } from "@/product/status/sources";
import type { StatusReading } from "@/product/status";
import { readRoleAppAvailability } from "@/role-apps/enablement";
import { getInstalledRoleApps } from "@/role-apps/registry";
import { getScenarioState } from "@/scenario/engine/state";
import { PRODUCT_PERSONA_IDS, type Bilingual } from "../permissions";
import { readMigrationState } from "../releases/migrations";
import { gateRunInProgress } from "../releases/release";

export interface OverviewItem {
  text: Bilingual;
  /** Where the reader goes to act on it. */
  href: string;
  tone: "danger" | "warning" | "info" | "success";
}

export interface OverviewView {
  release: { version: string; stage: Bilingual; deployedVersion: string | null };
  availableRoles: string[];
  roleApps: { installed: number; runnable: number; notRunnable: string[] };
  personas: { roleHolders: number; productOwner: number };
  activeRuns: number | null;
  decisionsWaiting: number | null;
  failures: { failedJobs: number | null; failedPreparations: number | null; blockedRuns: number | null };
  aiQuality: { mode: StatusReading; harness: StatusReading; modelOutput: StatusReading };
  connectors: ConnectorStatusCount[] | null;
  pilot: { name: Bilingual | null; status: string | null; measures: number; notMeasured: number } | null;
  changed: { changelog: string[]; consoleRecords: number };
  attention: OverviewItem[];
  blocked: OverviewItem[];
  performingWell: OverviewItem[];
}

function count(sql: string, ...params: unknown[]): number | null {
  try {
    const row = getSqlite().prepare(sql).get(...params) as { n: number } | undefined;
    return Number(row?.n ?? 0);
  } catch {
    return null;
  }
}

/** The top-level bullets of this version's CHANGELOG entry, as written there (English). */
export function changelogBullets(markdown: string, version: string): string[] {
  const start = markdown.indexOf(`## [${version}]`);
  if (start < 0) return [];
  const rest = markdown.slice(start + 4);
  const end = rest.search(/^## /m);
  const section = end >= 0 ? rest.slice(0, end) : rest;
  /* A top-level bullet and its wrapped continuation lines; nested bullets are left out. */
  const bullets: string[] = [];
  for (const line of section.split(/\r?\n/)) {
    if (/^- \S/.test(line)) bullets.push(line.slice(2));
    else if (bullets.length > 0 && /^ {2,}\S/.test(line) && !/^\s+- /.test(line)) bullets[bullets.length - 1] += ` ${line.trim()}`;
    else if (line.trim() === "" || /^#/.test(line) || /^\s+- /.test(line)) continue;
  }
  return bullets.map((text) => text.replace(/\*\*/g, "").replace(/`/g, "").replace(/\s+/g, " ").trim());
}

export function readOverview(): OverviewView {
  const runId = (() => {
    try {
      return getScenarioState()?.runId ?? DEFAULT_RUN_ID;
    } catch {
      return DEFAULT_RUN_ID;
    }
  })();
  const moment = (() => {
    try {
      return getScenarioState()?.currentMoment ?? "23:59";
    } catch {
      return "23:59";
    }
  })();

  const available = rolesWithReleaseStatus("available");
  const installed = getInstalledRoleApps();
  const availability = installed.map((app) => ({ app, reading: readRoleAppAvailability(app.id) }));
  const notRunnable = availability.filter((entry) => !entry.reading.runnable).map((entry) => entry.app.name);

  let deployedVersion: string | null = null;
  let gate: ReturnType<typeof getLatestReleaseGateRun> | null = null;
  try {
    deployedVersion = getDeployedRelease()?.releaseVersion ?? null;
    gate = getLatestReleaseGateRun(PRODUCT_RELEASE.version) ?? null;
  } catch {
    deployedVersion = null;
    gate = null;
  }

  const availableIds = available.map((role) => role.roleId);
  const placeholders = availableIds.map(() => "?").join(",");
  const activeRuns = count("SELECT count(*) AS n FROM role_app_runs WHERE run_id = ? AND status != 'completed'", runId);
  const blockedRuns = count("SELECT count(*) AS n FROM role_app_runs WHERE run_id = ? AND status = 'blocked'", runId);
  const decisionsWaiting =
    availableIds.length > 0
      ? count(
          `SELECT count(*) AS n FROM decisions WHERE run_id = ? AND status = 'open' AND presented_at_moment <= ? AND role_id IN (${placeholders})`,
          runId,
          moment,
          ...availableIds,
        )
      : 0;
  const failedJobs = count("SELECT count(*) AS n FROM background_jobs WHERE status = 'failed'");
  const failedPreparations = count("SELECT count(*) AS n FROM os_events WHERE run_id = ? AND type = 'ai-preparation-failed'", runId);
  const heldForSource = count("SELECT count(*) AS n FROM os_events WHERE run_id = ? AND type = 'ai-preparation-held' AND idempotency_key LIKE '%:source:%'", runId);

  const ai = readAiMode();
  const evaluation = readEvaluationEvidence();
  const audit = readAuditIntegrity();
  const connectors = readConnectorStatusCounts();
  const migrations = readMigrationState();

  let pilot: OverviewView["pilot"] = null;
  try {
    const programme = getSqlite()
      .prepare("SELECT id, name, name_de AS nameDe, status FROM pilot_programmes ORDER BY created_at LIMIT 1")
      .get() as { id: string; name: string; nameDe: string; status: string } | undefined;
    if (programme) {
      const measures = count("SELECT count(*) AS n FROM pilot_measures WHERE pilot_id = ?", programme.id) ?? 0;
      const notMeasured = count("SELECT count(*) AS n FROM pilot_measures WHERE pilot_id = ? AND baseline_status != 'measured'", programme.id) ?? 0;
      pilot = { name: { en: programme.name, de: programme.nameDe }, status: programme.status, measures, notMeasured };
    }
  } catch {
    pilot = null;
  }

  let changelog: string[] = [];
  try {
    const path = join(process.cwd(), "CHANGELOG.md");
    if (existsSync(path)) changelog = changelogBullets(readFileSync(path, "utf-8"), PRODUCT_RELEASE.version);
  } catch {
    changelog = [];
  }
  const consoleRecords =
    (count("SELECT count(*) AS n FROM role_app_lifecycle_events WHERE actor_kind = 'human'") ?? 0) +
    (count("SELECT count(*) AS n FROM product_release_events WHERE release_version = ?", PRODUCT_RELEASE.version) ?? 0);

  /* What needs attention: things a person should act on. */
  const attention: OverviewItem[] = [];
  if (migrations.pending.length > 0) {
    attention.push({
      text: { en: `${migrations.pending.length} database migrations are not applied. Run npm run db:migrate.`, de: `${migrations.pending.length} Datenbankmigrationen sind nicht angewendet. Fuehren Sie npm run db:migrate aus.` },
      href: "/product/releases",
      tone: "danger",
    });
  }
  if (notRunnable.length > 0) {
    attention.push({
      text: { en: `Disabled or retired in the workday: ${notRunnable.join(", ")}.`, de: `Im Arbeitstag gesperrt oder ausser Betrieb: ${notRunnable.join(", ")}.` },
      href: "/product/role-apps",
      tone: "warning",
    });
  }
  if ((failedJobs ?? 0) > 0 || (failedPreparations ?? 0) > 0) {
    attention.push({
      text: { en: `${failedJobs ?? 0} failed background jobs and ${failedPreparations ?? 0} failed stage preparations are recorded.`, de: `${failedJobs ?? 0} fehlgeschlagene Hintergrundauftraege und ${failedPreparations ?? 0} fehlgeschlagene Stufenvorbereitungen sind erfasst.` },
      href: "/product/operations",
      tone: "danger",
    });
  }
  if (!gate) {
    attention.push({
      text: { en: `No release gate has been run for ${PRODUCT_RELEASE.version}.`, de: `Fuer ${PRODUCT_RELEASE.version} wurde noch keine Release-Pruefung ausgefuehrt.` },
      href: "/product/releases",
      tone: "info",
    });
  }
  if (evaluation.modelOutput.status !== "verified") {
    attention.push({ text: { en: `Model output quality: ${evaluation.modelOutput.detail.en}`, de: `Qualitaet der Modellausgaben: ${evaluation.modelOutput.detail.de}` }, href: "/product/quality", tone: "info" });
  }
  if (audit.coverage.status === "not-verified") {
    attention.push({ text: { en: `Audit trail: ${audit.coverage.detail.en}`, de: `Audit-Trail: ${audit.coverage.detail.de}` }, href: "/settings/audit-integrity", tone: "info" });
  }

  /* What is blocked: work or releases that cannot move. */
  const blocked: OverviewItem[] = [];
  if (gate && !gateRunInProgress(gate) && gate.status !== "passed") {
    blocked.push({
      text: { en: `Release ${PRODUCT_RELEASE.version} cannot be approved: ${gate.summary}`, de: `Release ${PRODUCT_RELEASE.version} kann nicht freigegeben werden: ${gate.mandatoryFailed} von ${gate.mandatoryTotal} Pflichtpruefungen fehlgeschlagen.` },
      href: "/product/releases",
      tone: "danger",
    });
  }
  if ((blockedRuns ?? 0) > 0) {
    blocked.push({ text: { en: `${blockedRuns} process runs are blocked.`, de: `${blockedRuns} Prozesslaeufe sind blockiert.` }, href: "/product/role-apps", tone: "danger" });
  }
  if ((heldForSource ?? 0) > 0) {
    blocked.push({ text: { en: `${heldForSource} stage preparations waited for a required source.`, de: `${heldForSource} Stufenvorbereitungen warteten auf eine erforderliche Quelle.` }, href: "/product/role-apps", tone: "warning" });
  }
  if (notRunnable.length > 0) {
    blocked.push({ text: { en: `Process work in ${notRunnable.join(", ")} cannot be opened or started until enabled.`, de: `Prozessarbeit in ${notRunnable.join(", ")} kann bis zur Freischaltung weder geoeffnet noch gestartet werden.` }, href: "/product/role-apps", tone: "warning" });
  }

  /* What is performing well: only what a check or a record shows. */
  const performingWell: OverviewItem[] = [];
  if (audit.chain.status === "verified") {
    performingWell.push({ text: { en: `Audit chain verified on this request: ${audit.chain.detail.en}`, de: `Audit-Kette bei dieser Anfrage verifiziert: ${audit.chain.detail.de}` }, href: "/settings/audit-integrity", tone: "success" });
  }
  if (migrations.pending.length === 0 && migrations.entries.length > 0) {
    performingWell.push({ text: { en: `All ${migrations.entries.length} database migrations are applied.`, de: `Alle ${migrations.entries.length} Datenbankmigrationen sind angewendet.` }, href: "/product/releases", tone: "success" });
  }
  if (gate && gate.status === "passed") {
    performingWell.push({ text: { en: `The latest release gate passed: ${gate.summary}`, de: `Die letzte Release-Pruefung ist bestanden: ${gate.mandatoryTotal} von ${gate.mandatoryTotal} Pflichtpruefungen.` }, href: "/product/releases", tone: "success" });
  }
  if (installed.length > 0 && notRunnable.length === 0 && (failedPreparations ?? 0) === 0) {
    performingWell.push({
      text: {
        en: `All ${installed.length} installed Role Apps are enabled, with ${activeRuns ?? 0} active runs and no failed preparation.`,
        de: `Alle ${installed.length} installierten Rollen-Apps sind freigeschaltet, mit ${activeRuns ?? 0} aktiven Laeufen und ohne fehlgeschlagene Vorbereitung.`,
      },
      href: "/product/role-apps",
      tone: "success",
    });
  }

  return {
    release: { version: PRODUCT_RELEASE.version, stage: RELEASE_STAGE_LABELS[PRODUCT_RELEASE.stage], deployedVersion },
    availableRoles: available.map((role) => role.releaseLabel),
    roleApps: { installed: installed.length, runnable: installed.length - notRunnable.length, notRunnable },
    personas: { roleHolders: available.length, productOwner: PRODUCT_PERSONA_IDS.length },
    activeRuns,
    decisionsWaiting,
    failures: { failedJobs, failedPreparations, blockedRuns },
    aiQuality: { mode: ai.mode, harness: evaluation.harness, modelOutput: evaluation.modelOutput },
    connectors,
    pilot,
    changed: { changelog, consoleRecords },
    attention,
    blocked,
    performingWell,
  };
}
