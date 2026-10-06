/**
 * Release management (plan 7.9): the release view and its five actions.
 *
 *   Run release gate         runs the gate's checks (gate.ts), stores the run
 *                            and a "gate-run-recorded" event
 *   Generate evidence pack   runs the repository's own release package script
 *                            (`scripts/release-package.ts`) and writes a pack
 *                            that references it, with the gate run, the
 *                            readiness checks, the migrations, the Role App
 *                            versions in force and the known limitations;
 *                            records its path and digest
 *   Approve pilot release    material; refused unless the latest gate run
 *                            passed and an evidence pack was generated after it
 *   Deploy                   material; Simulated in this environment, which
 *                            has no deployment target, and recorded as such
 *   Roll back                material; Simulated, recorded with the version it
 *                            returns to
 *
 * The release identity (version, name, stage, limitations) is code, the
 * registry in `src/product/release/`; the console records only what happened
 * to a version. "No release while mandatory gates fail" is the rule of
 * Approve pilot release and of Deploy, read from the stored gate run.
 *
 * Server only.
 */

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  completeReleaseGateRun,
  getDeployedRelease,
  getLatestReleaseGateRun,
  listReleaseEvents,
  listReleaseGateRuns,
  recordReleaseEvent,
  startReleaseGateRun,
  type ProductReleaseEvent,
  type ReleaseGateRun,
} from "@/db/repositories/release-management";
import { listCurrentRoleAppVersions } from "@/db/repositories/role-app-release";
import type { ReleaseGateResult } from "@/db/schema/product-console";
import { KNOWN_LIMITATIONS, PRODUCT_RELEASE, getProductReleaseRegistry } from "@/product/release";
import { runReadinessChecks } from "@/product/status/sources";
import { fingerprintConsoleChange, governConsoleAction, type ConsoleActionResult, type ConsoleApprovalInput } from "../governance";
import type { Bilingual, ConsoleActionId } from "../permissions";
import { gatePasses, runReleaseGateChecks } from "./gate";
import { readMigrationState } from "./migrations";

export const EVIDENCE_DIR = join("release", "console-evidence");

export interface ReleaseView {
  version: string;
  stage: "candidate" | "released";
  deployed: ReturnType<typeof getDeployedRelease>;
  events: ProductReleaseEvent[];
  gateRuns: ReleaseGateRun[];
  latestGate: ReleaseGateRun | null;
  latestEvidence: ProductReleaseEvent | null;
  latestApproval: ProductReleaseEvent | null;
  available: boolean;
}

function latestOf(events: readonly ProductReleaseEvent[], kind: ProductReleaseEvent["kind"]): ProductReleaseEvent | null {
  return [...events].reverse().find((event) => event.kind === kind) ?? null;
}

export function readReleaseView(): ReleaseView {
  const version = PRODUCT_RELEASE.version;
  try {
    const events = listReleaseEvents(version);
    return {
      version,
      stage: PRODUCT_RELEASE.stage,
      deployed: getDeployedRelease(),
      events,
      gateRuns: listReleaseGateRuns(version),
      latestGate: getLatestReleaseGateRun(version) ?? null,
      latestEvidence: latestOf(events, "evidence-pack-generated"),
      latestApproval: latestOf(events, "pilot-release-approved"),
      available: true,
    };
  } catch {
    return { version, stage: PRODUCT_RELEASE.stage, deployed: null, events: [], gateRuns: [], latestGate: null, latestEvidence: null, latestApproval: null, available: false };
  }
}

/** The rollback plan, stated from what is recorded rather than written by hand. */
export function rollbackPlan(view: ReleaseView): Bilingual {
  const previous = [...listReleaseEventsSafe()].reverse().find((event) => event.kind === "deployed" && event.releaseVersion !== view.version);
  return previous
    ? {
        en: `Roll back to ${previous.releaseVersion}, the previous deployed release, and restore the database backup taken before deployment (npm run backup:restore).`,
        de: `Zuruecksetzen auf ${previous.releaseVersion}, das zuvor bereitgestellte Release, und die vor der Bereitstellung erstellte Datenbanksicherung wiederherstellen (npm run backup:restore).`,
      }
    : {
        en: "No earlier release was deployed through the console. Rolling back returns to the state before deployment: restore the database backup taken before deployment (npm run backup:restore).",
        de: "Ueber die Konsole wurde kein frueheres Release bereitgestellt. Zuruecksetzen fuehrt zum Zustand vor der Bereitstellung: die vor der Bereitstellung erstellte Datenbanksicherung wiederherstellen (npm run backup:restore).",
      };
}

function listReleaseEventsSafe(): ProductReleaseEvent[] {
  try {
    return listReleaseEvents();
  } catch {
    return [];
  }
}

function eventId(kind: string, at: string): string {
  return `PRE-${PRODUCT_RELEASE.version}-${kind}-${at.replace(/[^0-9]/g, "").slice(0, 17)}`;
}

/* ==========================================================================
   Run release gate
   ========================================================================== */

export async function runReleaseGate(): Promise<ConsoleActionResult<ReleaseGateRun>> {
  const version = PRODUCT_RELEASE.version;
  return governConsoleAction<ReleaseGateResult[], ReleaseGateRun>({
    actionId: "release.run-gate",
    target: { kind: "product-release", id: version },
    payload: { version },
    summary: { en: `Run the release gate for ${version}.`, de: `Release-Pruefung fuer ${version} ausfuehren.` },
    prepare: () => runReleaseGateChecks(),
    execute: (context, results) => {
      const id = `RGR-${version}-${context.at.replace(/[^0-9]/g, "").slice(0, 17)}`;
      startReleaseGateRun({ id, releaseVersion: version, startedAt: context.at, triggeredByLabel: context.actor.label });
      const passed = gatePasses(results);
      const mandatory = results.filter((entry) => entry.mandatory);
      const failed = mandatory.filter((entry) => entry.status !== "passed");
      const run = completeReleaseGateRun(id, {
        status: passed ? "passed" : "failed",
        results,
        completedAt: new Date().toISOString(),
        summary: passed
          ? `${mandatory.length} of ${mandatory.length} mandatory checks passed.`
          : `${failed.length} of ${mandatory.length} mandatory checks failed: ${failed.map((entry) => entry.label).join(", ")}.`,
      });
      if (!run) throw new Error("The gate run was not written.");
      recordReleaseEvent({
        id: eventId("gate", context.at),
        releaseVersion: version,
        kind: "gate-run-recorded",
        gateRunId: id,
        note: run.summary,
        at: context.at,
        actorLabel: context.actor.label,
        actorUserId: context.actor.userId,
      });
      return run;
    },
    success: (run) =>
      run.status === "passed"
        ? { en: `Release gate passed: ${run.summary}`, de: `Release-Pruefung bestanden: ${run.mandatoryTotal} von ${run.mandatoryTotal} Pflichtpruefungen bestanden.` }
        : { en: `Release gate failed: ${run.summary}`, de: `Release-Pruefung nicht bestanden: ${run.mandatoryFailed} von ${run.mandatoryTotal} Pflichtpruefungen fehlgeschlagen.` },
  });
}

/* ==========================================================================
   Generate evidence pack
   ========================================================================== */

function runReleasePackageScript(): Promise<boolean> {
  return new Promise((resolve) => {
    const root = process.cwd();
    const tsx = join(root, "node_modules", "tsx", "dist", "cli.mjs");
    const script = join(root, "scripts", "release-package.ts");
    if (!existsSync(tsx) || !existsSync(script)) return resolve(false);
    execFile(process.execPath, [tsx, script], { cwd: root, timeout: 120_000, windowsHide: true }, (error) => resolve(!error));
  });
}

interface EvidencePackFile {
  path: string;
  digest: string;
}

async function buildEvidencePack(actorLabel: string, at: string): Promise<EvidencePackFile> {
  const root = process.cwd();
  const packaged = await runReleasePackageScript();
  const manifestPath = join("release", "nfros-v4", "deployment-manifest.json");
  const manifestFull = join(root, manifestPath);
  const manifestDigest = packaged && existsSync(manifestFull) ? createHash("sha256").update(readFileSync(manifestFull)).digest("hex") : null;
  const gate = getLatestReleaseGateRun(PRODUCT_RELEASE.version) ?? null;
  const registry = getProductReleaseRegistry();

  const pack = {
    schema: "nfros-console-evidence-pack-v1",
    generatedAt: at,
    generatedBy: actorLabel,
    disclosure: "Synthetic institution and data. No credential, session secret, personal data or document text is included.",
    release: {
      product: registry.identity.name,
      version: registry.release.version,
      name: registry.release.name.en,
      stage: registry.release.stage,
      date: registry.release.date,
      components: registry.components.map((component) => ({ id: component.id, version: component.version })),
    },
    releasePackage: packaged
      ? { script: "scripts/release-package.ts", manifest: manifestPath.replace(/\\/g, "/"), sha256: manifestDigest }
      : { script: "scripts/release-package.ts", manifest: null, sha256: null, note: "The release package script did not complete." },
    gate: gate
      ? { id: gate.id, status: gate.status, mandatoryTotal: gate.mandatoryTotal, mandatoryFailed: gate.mandatoryFailed, completedAt: gate.completedAt, results: gate.results.map(({ gateKey, label, mandatory, status, detail }) => ({ gateKey, label, mandatory, status, detail })) }
      : { id: null, note: "No release gate run is recorded for this version." },
    migrations: (() => {
      const state = readMigrationState();
      return { applied: state.appliedCount, total: state.entries.length, pending: state.pending.map((entry) => entry.tag), latest: state.latestTag };
    })(),
    readiness: runReadinessChecks().map((check) => ({ id: check.id, label: check.label.en, status: check.reading.status, detail: check.reading.detail.en })),
    roleAppVersionsInForce: listCurrentRoleAppVersions().map((version) => ({
      roleAppId: version.roleAppId,
      version: version.version,
      state: version.lifecycleState,
      digest: version.processDefinitionDigest,
    })),
    knownLimitations: KNOWN_LIMITATIONS.map((limitation) => ({ id: limitation.id, status: limitation.status, title: limitation.title.en })),
    regulatoryContext: "Illustrative regulatory context, not legal advice.",
  };

  const body = JSON.stringify(pack, null, 2);
  const digest = createHash("sha256").update(body).digest("hex");
  const directory = join(root, EVIDENCE_DIR);
  mkdirSync(directory, { recursive: true });
  const name = `evidence-${PRODUCT_RELEASE.version}-${at.replace(/[^0-9]/g, "").slice(0, 14)}.json`;
  writeFileSync(join(directory, name), body);
  return { path: `${EVIDENCE_DIR.replace(/\\/g, "/")}/${name}`, digest };
}

export async function generateEvidencePack(): Promise<ConsoleActionResult<EvidencePackFile>> {
  const version = PRODUCT_RELEASE.version;
  return governConsoleAction<EvidencePackFile, EvidencePackFile>({
    actionId: "release.generate-evidence-pack",
    target: { kind: "product-release", id: version },
    payload: { version },
    summary: { en: `Generate the evidence pack for ${version}.`, de: `Nachweispaket fuer ${version} erzeugen.` },
    prepare: (actor) => buildEvidencePack(actor.label, new Date().toISOString()),
    execute: (context, pack) => {
      recordReleaseEvent({
        id: eventId("evidence", context.at),
        releaseVersion: version,
        kind: "evidence-pack-generated",
        gateRunId: getLatestReleaseGateRun(version)?.id ?? null,
        evidencePackRef: pack.path,
        evidencePackDigest: pack.digest,
        note: "Generated from the release package script, the latest gate run, the readiness checks, the migrations and the release registry.",
        at: context.at,
        actorLabel: context.actor.label,
        actorUserId: context.actor.userId,
      });
      return pack;
    },
    success: (pack) => ({ en: `Evidence pack written to ${pack.path}.`, de: `Nachweispaket geschrieben: ${pack.path}.` }),
  });
}

/* ==========================================================================
   Approve pilot release, Deploy, Roll back
   ========================================================================== */

export interface ReleaseProposal {
  actionId: ConsoleActionId;
  payload: Record<string, unknown>;
  fingerprint: string;
  lines: Bilingual[];
  blocked: Bilingual | null;
}

function gateBlock(view: ReleaseView): Bilingual | null {
  if (!view.latestGate) {
    return { en: "No release gate run is recorded for this version. Run the release gate first.", de: "Fuer diese Version ist keine Release-Pruefung erfasst. Fuehren Sie zuerst die Release-Pruefung aus." };
  }
  if (view.latestGate.status !== "passed" || view.latestGate.mandatoryFailed > 0) {
    return {
      en: `The latest release gate run failed (${view.latestGate.mandatoryFailed} of ${view.latestGate.mandatoryTotal} mandatory checks). No release while mandatory gates fail.`,
      de: `Die letzte Release-Pruefung ist nicht bestanden (${view.latestGate.mandatoryFailed} von ${view.latestGate.mandatoryTotal} Pflichtpruefungen). Kein Release, solange Pflichtpruefungen fehlschlagen.`,
    };
  }
  return null;
}

export function proposeApprovePilotRelease(view: ReleaseView = readReleaseView()): ReleaseProposal {
  const payload = { version: view.version, gateRunId: view.latestGate?.id ?? null, gateStatus: view.latestGate?.status ?? null, evidence: view.latestEvidence?.evidencePackDigest ?? null };
  const evidenceAfterGate =
    view.latestEvidence !== null && view.latestGate !== null && view.latestEvidence.at >= (view.latestGate.completedAt ?? view.latestGate.startedAt);
  const blocked =
    gateBlock(view) ??
    (!evidenceAfterGate
      ? { en: "Generate the evidence pack after the latest gate run, so the approval rests on it.", de: "Erzeugen Sie das Nachweispaket nach der letzten Release-Pruefung, damit die Freigabe darauf beruht." }
      : null);
  const plan = rollbackPlan(view);
  return {
    actionId: "release.approve-pilot",
    payload,
    fingerprint: fingerprintConsoleChange("release.approve-pilot", payload),
    lines: [
      { en: `Release ${view.version} is approved for the pilot cohort.`, de: `Release ${view.version} wird fuer die Pilotkohorte freigegeben.` },
      {
        en: `It rests on gate run ${view.latestGate?.id ?? "-"} and evidence pack ${view.latestEvidence?.evidencePackRef ?? "-"}.`,
        de: `Die Freigabe beruht auf der Pruefung ${view.latestGate?.id ?? "-"} und dem Nachweispaket ${view.latestEvidence?.evidencePackRef ?? "-"}.`,
      },
      { en: `Rollback plan: ${plan.en}`, de: `Rueckfallplan: ${plan.de}` },
    ],
    blocked,
  };
}

export function proposeDeploy(view: ReleaseView = readReleaseView()): ReleaseProposal {
  const payload = { version: view.version, approvalEvent: view.latestApproval?.id ?? null, gateRunId: view.latestGate?.id ?? null, deployed: view.deployed?.releaseVersion ?? null };
  const approvedAfterGate =
    view.latestApproval !== null && view.latestGate !== null && view.latestApproval.gateRunId === view.latestGate.id;
  const blocked =
    view.deployed?.releaseVersion === view.version
      ? { en: `Release ${view.version} is already recorded as deployed.`, de: `Release ${view.version} ist bereits als bereitgestellt erfasst.` }
      : (gateBlock(view) ??
        (!approvedAfterGate
          ? { en: "The pilot release is not approved on the latest gate run. Approve it first.", de: "Das Pilot-Release ist auf Basis der letzten Pruefung nicht freigegeben. Geben Sie es zuerst frei." }
          : null));
  return {
    actionId: "release.deploy",
    payload,
    fingerprint: fingerprintConsoleChange("release.deploy", payload),
    lines: [
      { en: `Release ${view.version} is recorded as deployed to the pilot cohort.`, de: `Release ${view.version} wird als fuer die Pilotkohorte bereitgestellt erfasst.` },
      {
        en: "Simulated: this environment has no deployment target. The deployment is recorded and no system is changed.",
        de: "Simuliert: Diese Umgebung hat kein Bereitstellungsziel. Die Bereitstellung wird erfasst, kein System wird veraendert.",
      },
    ],
    blocked,
  };
}

export function proposeReleaseRollBack(view: ReleaseView = readReleaseView()): ReleaseProposal {
  const plan = rollbackPlan(view);
  const payload = { version: view.version, deployed: view.deployed?.releaseVersion ?? null, deployedAt: view.deployed?.deployedAt ?? null };
  return {
    actionId: "release.roll-back",
    payload,
    fingerprint: fingerprintConsoleChange("release.roll-back", payload),
    lines: [
      { en: `Release ${view.deployed?.releaseVersion ?? view.version} is recorded as rolled back.`, de: `Release ${view.deployed?.releaseVersion ?? view.version} wird als zurueckgesetzt erfasst.` },
      { en: `Rollback plan: ${plan.en}`, de: `Rueckfallplan: ${plan.de}` },
      {
        en: "Simulated: no system is changed by this action in this environment.",
        de: "Simuliert: In dieser Umgebung veraendert diese Aktion kein System.",
      },
    ],
    blocked: view.deployed
      ? null
      : { en: "No release is recorded as deployed, so there is nothing to roll back.", de: "Es ist kein Release als bereitgestellt erfasst, es gibt daher nichts zurueckzusetzen." },
  };
}

export async function approvePilotRelease(approval: ConsoleApprovalInput): Promise<ConsoleActionResult<null>> {
  const view = readReleaseView();
  const proposed = proposeApprovePilotRelease(view);
  return governConsoleAction({
    actionId: "release.approve-pilot",
    target: { kind: "product-release", id: view.version },
    payload: proposed.payload,
    approval,
    summary: { en: `Approve pilot release ${view.version}.`, de: `Pilot-Release ${view.version} freigeben.` },
    rule: () => proposed.blocked,
    execute: (context) => {
      recordReleaseEvent({
        id: eventId("approved", context.at),
        releaseVersion: view.version,
        kind: "pilot-release-approved",
        gateRunId: view.latestGate?.id ?? null,
        evidencePackRef: view.latestEvidence?.evidencePackRef ?? null,
        evidencePackDigest: view.latestEvidence?.evidencePackDigest ?? null,
        rollbackPlan: rollbackPlan(view).en,
        note: context.rationale,
        at: context.at,
        actorLabel: context.actor.label,
        actorUserId: context.actor.userId,
        approvalId: context.approvalId,
      });
      return null;
    },
    success: () => ({ en: `Pilot release ${view.version} approved.`, de: `Pilot-Release ${view.version} freigegeben.` }),
  });
}

export async function deployRelease(approval: ConsoleApprovalInput): Promise<ConsoleActionResult<null>> {
  const view = readReleaseView();
  const proposed = proposeDeploy(view);
  return governConsoleAction({
    actionId: "release.deploy",
    target: { kind: "product-release", id: view.version },
    payload: proposed.payload,
    approval,
    summary: { en: `Deploy ${view.version} to the pilot cohort (simulated).`, de: `${view.version} fuer die Pilotkohorte bereitstellen (simuliert).` },
    rule: () => proposed.blocked,
    execute: (context) => {
      recordReleaseEvent({
        id: eventId("deployed", context.at),
        releaseVersion: view.version,
        kind: "deployed",
        rolloutStatus: "pilot",
        gateRunId: view.latestGate?.id ?? null,
        rollbackPlan: rollbackPlan(view).en,
        note: "Simulated deployment: this environment has no deployment target. Recorded, nothing changed.",
        at: context.at,
        actorLabel: context.actor.label,
        actorUserId: context.actor.userId,
        approvalId: context.approvalId,
      });
      return null;
    },
    success: () => ({ en: `Release ${view.version} recorded as deployed to the pilot cohort (Simulated).`, de: `Release ${view.version} als fuer die Pilotkohorte bereitgestellt erfasst (Simuliert).` }),
  });
}

export async function rollBackRelease(approval: ConsoleApprovalInput): Promise<ConsoleActionResult<null>> {
  const view = readReleaseView();
  const proposed = proposeReleaseRollBack(view);
  const previous = [...listReleaseEventsSafe()].reverse().find((event) => event.kind === "deployed" && event.releaseVersion !== view.version);
  return governConsoleAction({
    actionId: "release.roll-back",
    target: { kind: "product-release", id: view.version },
    payload: proposed.payload,
    approval,
    summary: { en: `Roll back release ${view.deployed?.releaseVersion ?? view.version} (simulated).`, de: `Release ${view.deployed?.releaseVersion ?? view.version} zuruecksetzen (simuliert).` },
    rule: () => proposed.blocked,
    execute: (context) => {
      recordReleaseEvent({
        id: eventId("rolled-back", context.at),
        releaseVersion: view.deployed?.releaseVersion ?? view.version,
        kind: "rolled-back",
        rolloutStatus: "rolled-back",
        rollbackToVersion: previous?.releaseVersion ?? null,
        note: `Simulated rollback. ${context.rationale}`,
        at: context.at,
        actorLabel: context.actor.label,
        actorUserId: context.actor.userId,
        approvalId: context.approvalId,
      });
      return null;
    },
    success: () => ({ en: "Release recorded as rolled back (Simulated).", de: "Release als zurueckgesetzt erfasst (Simuliert)." }),
  });
}
