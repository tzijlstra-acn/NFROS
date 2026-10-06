/**
 * The pilot evidence pack, built on the server for download.
 *
 * Server only. One JSON document a design partner's reviewer can read without
 * the product: the setup, the baseline as people recorded it, the measures and
 * readings, the readiness checks as computed on this request, the control
 * measures, the release registry's known limitations and the exit decisions.
 *
 * What it never contains, by construction: credentials, session data,
 * environment values, connector endpoints, evidence document text, message
 * bodies or personal data. Every field below is read from a record that holds
 * none of those, and before the pack is offered its serialised form is
 * checked for credential shapes; a match refuses the download rather than
 * serving it. It reuses the readiness checks of `/settings/pilot` and the
 * exclusion list of `scripts/support-bundle.ts`, so the three agree.
 *
 * The digest covers the content without its generation time, so two packs of
 * the same state have the same digest, and an exit decision can cite it.
 */

import { createHash } from "node:crypto";
import { PRODUCT_IDENTITY, PRODUCT_RELEASE, KNOWN_LIMITATIONS } from "@/product/release";
import { containsCredentialShape } from "./readiness-rules";
import { readPilotReadiness, type PilotReadiness } from "./readiness";
import { readControlMeasures } from "@/features/product/value/measures";
import type { PilotWorkspace } from "./workspace";

export const EVIDENCE_PACK_EXCLUSIONS = [
  "API keys and tokens",
  "Session secrets",
  "Environment values",
  "Connector endpoints and credentials",
  "Database contents beyond the pilot records listed",
  "Evidence document text",
  "Meeting transcripts and message bodies",
  "Personal data",
  "AI prompts",
] as const;

export interface PilotEvidencePack {
  kind: "nfros-pilot-evidence-pack";
  schemaVersion: 1;
  generatedAt: string;
  digest: string;
  content: Record<string, unknown>;
}

function digestOf(content: unknown): string {
  return createHash("sha256").update(JSON.stringify(content)).digest("hex");
}

function readinessSnapshot(readiness: PilotReadiness) {
  return {
    overall: readiness.overall,
    verified: readiness.verified,
    total: readiness.total,
    productChecks: readiness.productChecks.map((check) => ({
      id: check.id,
      label: check.label.en,
      status: check.reading.status,
      detail: check.reading.detail.en,
    })),
    controls: readiness.controls.map((control) => ({
      id: control.id,
      label: control.label.en,
      criterion: control.criterion.en,
      status: control.reading.status,
      detail: control.reading.detail.en,
      source: control.source,
    })),
  };
}

/** The pack's content, without the generation time. Deterministic for one state. */
export function buildEvidenceContent(workspace: PilotWorkspace, readiness: PilotReadiness = readPilotReadiness()): Record<string, unknown> {
  const pilot = workspace.pilot;
  return {
    product: { name: PRODUCT_IDENTITY.name, release: PRODUCT_RELEASE.version, stage: PRODUCT_RELEASE.stage },
    disclosure: "Synthetic institution and data. Every person, supplier, control, risk and figure in this environment is invented.",
    regulatoryNote: "Illustrative regulatory context, not legal advice.",
    pilot: {
      id: pilot.id,
      name: pilot.name,
      status: pilot.status,
      businessArea: pilot.businessArea,
      plannedStartOn: pilot.plannedStartOn,
      plannedEndOn: pilot.plannedEndOn,
      startedAt: pilot.startedAt,
      closedAt: pilot.closedAt,
      legalEntities: workspace.legalEntities
        .filter((entity) => entity.inPilot)
        .map((entity) => ({ id: entity.id, name: entity.name, country: entity.country, regulatoryContext: entity.regulatorContext })),
      roles: workspace.roles.filter((role) => role.inPilot).map((role) => ({ id: role.roleId, label: role.label, release: role.status })),
      roleApps: workspace.roleApps.filter((app) => app.inPilot).map((app) => ({ id: app.id, name: app.name.en, version: app.version, status: app.status })),
      sourceSystems: workspace.sourceSystems
        .filter((source) => source.inPilot)
        .map((source) => ({ id: source.id, system: source.sourceSystem, mode: source.mode, status: source.status })),
      authority: {
        entitlementProfileId: workspace.authority.entitlementProfileId,
        maxAutonomyLevel: workspace.authority.maxAutonomyLevel,
        autonomousExecution: workspace.authority.autonomousExecution,
      },
      supportContacts: workspace.supportContacts.map((contact) => ({ label: contact.label, role: contact.role })),
      cohort: workspace.cohort ? { id: workspace.cohort.id, size: workspace.cohort.userIds.length, accounts: workspace.cohort.userIds } : null,
    },
    baseline: workspace.measures.map((entry) => ({
      key: entry.measure.key,
      label: entry.measure.label,
      unit: entry.measure.unit,
      direction: entry.measure.direction,
      method: entry.measure.method,
      source: entry.measure.source,
      successCriterion: entry.measure.target,
      baseline: {
        status: entry.measure.baselineStatus,
        value: entry.measure.baselineValue,
        period: entry.measure.baselinePeriod,
        recordedAt: entry.measure.baselineRecordedAt,
        recordedBy: entry.measure.baselineRecordedByLabel,
      },
      thisEnvironment: {
        note: "Measured from synthetic data. Not a baseline and not a result.",
        kind: entry.synthetic.kind,
        status: entry.synthetic.reading.status,
        value: entry.synthetic.value,
        basis: entry.synthetic.basis.en,
        source: entry.synthetic.source,
      },
      history: entry.history.map((item) => ({ at: item.at, summary: item.summary })),
    })),
    readings: workspace.readings.map((entry) => ({
      measureId: entry.measureId,
      weekStarting: entry.weekStarting,
      status: entry.status,
      value: entry.value,
      source: entry.source,
      note: entry.note,
      recordedBy: entry.recordedByLabel,
    })),
    issues: workspace.issues.map((issue) => ({
      id: issue.id,
      kind: issue.kind,
      title: issue.title,
      severity: issue.severity,
      status: issue.status,
      raisedAt: issue.raisedAt,
      resolution: issue.resolution,
    })),
    readiness: readinessSnapshot(readiness),
    controlMeasures: readControlMeasures().map((measure) => ({
      id: measure.id,
      label: measure.label.en,
      state: measure.state,
      value: measure.value?.en ?? null,
      status: measure.reading.status,
      source: measure.source,
    })),
    knownLimitations: KNOWN_LIMITATIONS.map((limitation) => ({
      id: limitation.id,
      area: limitation.area,
      status: limitation.status,
      title: limitation.title.en,
      detail: limitation.detail.en,
    })),
    exitDecisions: workspace.exitDecisions.map((decision) => ({
      id: decision.id,
      outcome: decision.outcome,
      decidedAt: decision.decidedAt,
      decidedBy: decision.decidedByLabel,
      approvalId: decision.approvalId,
      rationale: decision.rationale,
      evidence: decision.evidence,
      unresolvedConditions: decision.unresolvedConditions,
      controlFindings: decision.controlFindings,
      commercialImplication: decision.commercialImplication,
      nextWaveRecommendation: decision.nextWaveRecommendation,
    })),
    excluded: [...EVIDENCE_PACK_EXCLUSIONS],
  };
}

/** The digest an exit decision cites. */
export function evidenceDigest(workspace: PilotWorkspace, readiness?: PilotReadiness): string {
  return digestOf(buildEvidenceContent(workspace, readiness));
}

/**
 * The pack, or a refusal when its serialised form holds anything shaped like
 * a credential.
 */
export function buildPilotEvidencePack(
  workspace: PilotWorkspace,
): { ok: true; pack: PilotEvidencePack; body: string } | { ok: false; reason: string } {
  const content = buildEvidenceContent(workspace);
  const pack: PilotEvidencePack = {
    kind: "nfros-pilot-evidence-pack",
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    digest: digestOf(content),
    content,
  };
  const body = JSON.stringify(pack, null, 2);
  if (containsCredentialShape(body)) {
    return { ok: false, reason: "The pack contains text shaped like a credential and was not offered." };
  }
  return { ok: true, pack, body };
}
