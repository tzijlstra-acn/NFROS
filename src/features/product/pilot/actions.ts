"use server";

/**
 * Server actions for the pilot workspace.
 *
 * Thin: each one reads its form, applies the pilot's rules (`rules.ts`) and
 * calls `governConsoleAction`, which checks the acting persona's authority,
 * checks the approval of a material change against the change as it is now,
 * and writes the change and its audit record in one transaction. A refusal is
 * audited there too. Nothing here decides who may act.
 *
 * Every export of a "use server" module is a callable endpoint, so only the
 * actions are exported; the reads stay in `workspace.ts`.
 */

import { revalidatePath } from "next/cache";
import {
  recordPilotBaseline,
  recordPilotExitDecision,
  recordPilotMeasureReading,
  raisePilotIssue,
  setPilotMeasureTarget,
  updatePilotIssue,
  updatePilotProgramme,
} from "@/db/repositories/pilot";
import { saveCohort, getCohort } from "@/db/repositories/role-app-release";
import type { AutonomyLevel } from "@/db/schema/core";
import type { PilotSupportContact } from "@/db/schema/product-console";
import {
  authorizeConsoleAction,
  governConsoleAction,
  readApprovalFields,
  toFormState,
  type ConsoleFormState,
} from "@/features/product/governance";
import { readAdminLanguage } from "@/product/status/sources";
import {
  cohortChange,
  cohortChangeLines,
  cohortFingerprint,
  exitDecisionChange,
  exitDecisionFingerprint,
  exitDecisionLines,
  EXIT_OUTCOME_LABELS,
} from "./changes";
import {
  EXIT_OUTCOME_EFFECT,
  parseBaselineImport,
  startConditions,
  validateBaseline,
  validateCohort,
  validateExitDecision,
  validateIssue,
  validateIssueUpdate,
  validateReading,
  validateSetup,
  validateTarget,
  type Bilingual,
  type ExitDecisionPayload,
  type ExitEvidenceRef,
} from "./rules";
import { PILOT_AUDIT_KINDS, readPilotWorkspace, type PilotWorkspace } from "./workspace";

let sequence = 0;

function newId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${String(sequence).padStart(4, "0")}`;
}

function text(data: FormData, name: string, limit = 2000): string {
  return String(data.get(name) ?? "").slice(0, limit);
}

function list(data: FormData, name: string): string[] {
  return data.getAll(name).map((value) => String(value)).filter((value) => value.length > 0);
}

function lines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function refused(problems: Bilingual[], language: "en" | "de"): ConsoleFormState {
  return { ok: false, message: problems.map((entry) => (language === "de" ? entry.de : entry.en)).join(" "), code: "rule" };
}

function revalidatePilot(): void {
  revalidatePath("/product/pilot", "layout");
  revalidatePath("/product/value");
  revalidatePath("/settings/pilot");
}

function workspaceOrRefusal(language: "en" | "de"): PilotWorkspace | ConsoleFormState {
  const workspace = readPilotWorkspace();
  if (!workspace) {
    return {
      ok: false,
      message: language === "de" ? "Es ist kein Pilot eingerichtet." : "No pilot is configured.",
      code: "rule",
    };
  }
  return workspace;
}

function isState(value: PilotWorkspace | ConsoleFormState): value is ConsoleFormState {
  return "ok" in value;
}

/* ==========================================================================
   Setup
   ========================================================================== */

export async function actionUpdatePilotSetup(_previous: ConsoleFormState | null, data: FormData): Promise<ConsoleFormState> {
  const language = readAdminLanguage();
  const workspace = workspaceOrRefusal(language);
  if (isState(workspace)) return workspace;

  const contacts: PilotSupportContact[] = [0, 1, 2, 3, 4, 5, 6, 7].map((index) => ({
    label: text(data, `contactLabel${index}`, 120),
    role: text(data, `contactRole${index}`, 120),
    channel: text(data, `contactChannel${index}`, 200),
  }));
  const checked = validateSetup(
    {
      businessArea: text(data, "businessArea", 400),
      businessAreaDe: text(data, "businessAreaDe", 400),
      legalEntityIds: list(data, "legalEntityIds"),
      roleIds: list(data, "roleIds"),
      roleAppIds: list(data, "roleAppIds"),
      sourceSystemIds: list(data, "sourceSystemIds"),
      entitlementProfileId: text(data, "entitlementProfileId", 120) || null,
      maxAutonomyLevel: text(data, "maxAutonomyLevel", 40),
      supportContacts: contacts,
      plannedStartOn: text(data, "plannedStartOn", 10) || null,
      plannedEndOn: text(data, "plannedEndOn", 10) || null,
    },
    workspace.options,
  );
  if (!checked.ok) return refused(checked.problems, language);
  const setup = checked.value;
  const pilot = workspace.pilot;

  const result = await governConsoleAction({
    actionId: "pilot.edit-setup",
    target: { kind: PILOT_AUDIT_KINDS.programme, id: pilot.id },
    payload: { pilotId: pilot.id, setup },
    summary: {
      en: `Pilot setup of ${pilot.id} saved: ${setup.legalEntityIds.length} legal entities, ${setup.roleIds.length} roles, ${setup.roleAppIds.length} Role Apps, ${setup.sourceSystemIds.length} source systems, ${setup.supportContacts.length} support contacts, autonomy at most ${setup.maxAutonomyLevel}, window ${setup.plannedStartOn ?? "not agreed"} to ${setup.plannedEndOn ?? "not agreed"}.`,
      de: `Pilot-Einrichtung von ${pilot.id} gespeichert.`,
    },
    rule: () =>
      pilot.status === "closed"
        ? { en: "A closed pilot cannot be changed.", de: "Ein abgeschlossener Pilot kann nicht geaendert werden." }
        : null,
    execute: (context) => {
      updatePilotProgramme(pilot.id, {
        businessArea: setup.businessArea,
        businessAreaDe: setup.businessAreaDe,
        legalEntityIds: setup.legalEntityIds,
        roleIds: setup.roleIds as PilotWorkspace["pilot"]["roleIds"],
        roleAppIds: setup.roleAppIds,
        sourceSystemIds: setup.sourceSystemIds,
        authority: {
          entitlementProfileId: setup.entitlementProfileId,
          maxAutonomyLevel: setup.maxAutonomyLevel as AutonomyLevel,
          autonomousExecution: false,
          note: workspace.authority.note,
        },
        supportContacts: setup.supportContacts,
        plannedStartOn: setup.plannedStartOn,
        plannedEndOn: setup.plannedEndOn,
        updatedAt: context.at,
      });
      if (workspace.cohort) {
        const cohort = getCohort(workspace.cohort.id);
        if (cohort) {
          saveCohort({ ...cohort, roleIds: setup.roleIds as typeof cohort.roleIds, legalEntityIds: setup.legalEntityIds });
        }
      }
      return pilot.id;
    },
    success: () => ({ en: "Pilot setup saved and recorded in the audit trail.", de: "Pilot-Einrichtung gespeichert und im Audit-Trail erfasst." }),
  });
  if (result.ok) revalidatePilot();
  return toFormState(result, language);
}

export async function actionStartPilot(_previous: ConsoleFormState | null, _data: FormData): Promise<ConsoleFormState> {
  const language = readAdminLanguage();
  const workspace = workspaceOrRefusal(language);
  if (isState(workspace)) return workspace;
  const pilot = workspace.pilot;

  const result = await governConsoleAction({
    actionId: "pilot.edit-setup",
    target: { kind: PILOT_AUDIT_KINDS.programme, id: pilot.id },
    payload: { pilotId: pilot.id, from: pilot.status, to: "running" },
    summary: { en: `Pilot ${pilot.id} started.`, de: `Pilot ${pilot.id} gestartet.` },
    rule: () => {
      const conditions = startConditions({
        status: pilot.status,
        plannedStartOn: pilot.plannedStartOn,
        plannedEndOn: pilot.plannedEndOn,
        cohortSize: workspace.cohort?.userIds.length ?? 0,
        baselines: workspace.measures.map((entry) => ({ label: entry.label, status: entry.measure.baselineStatus })),
      });
      if (conditions.length === 0) return null;
      return { en: conditions.map((entry) => entry.en).join(" "), de: conditions.map((entry) => entry.de).join(" ") };
    },
    execute: (context) => {
      updatePilotProgramme(pilot.id, { status: "running", startedAt: context.at, updatedAt: context.at });
      return pilot.id;
    },
    success: () => ({ en: "The pilot is running.", de: "Der Pilot laeuft." }),
  });
  if (result.ok) revalidatePilot();
  return toFormState(result, language);
}

/* ==========================================================================
   Cohort (material)
   ========================================================================== */

export async function actionChangeCohort(_previous: ConsoleFormState | null, data: FormData): Promise<ConsoleFormState> {
  const language = readAdminLanguage();
  const workspace = workspaceOrRefusal(language);
  if (isState(workspace)) return workspace;

  const userId = text(data, "userId", 64);
  const operation = text(data, "operation", 8) === "remove" ? "remove" : "add";
  const change = cohortChange(workspace, userId, operation);
  if (!change) return refused([{ en: "The pilot has no cohort.", de: "Der Pilot hat keine Kohorte." }], language);
  const checked = validateCohort(change.to, workspace.candidates, workspace.pilot.roleIds);
  if (!checked.ok) return refused(checked.problems, language);
  const person = workspace.people.find((entry) => entry.userId === userId);

  const result = await governConsoleAction({
    actionId: "pilot.manage-cohort",
    target: { kind: PILOT_AUDIT_KINDS.cohort, id: change.cohortId },
    payload: change,
    approval: readApprovalFields(data),
    summary: {
      en: `${cohortChangeLines(change, person?.displayName ?? userId, "en")[0] ?? ""} Cohort ${change.cohortId} now holds ${change.to.length} accounts.`,
      de: cohortChangeLines(change, person?.displayName ?? userId, "de")[0] ?? "",
    },
    rule: () =>
      workspace.pilot.status === "closed"
        ? { en: "A closed pilot's cohort cannot be changed.", de: "Die Kohorte eines abgeschlossenen Piloten kann nicht geaendert werden." }
        : null,
    execute: () => {
      const cohort = getCohort(change.cohortId);
      if (!cohort) throw new Error("The cohort is missing.");
      saveCohort({ ...cohort, userIds: checked.value });
      return change.to.length;
    },
    success: (size) => ({ en: `Cohort updated: ${size} accounts.`, de: `Kohorte aktualisiert: ${size} Konten.` }),
  });
  if (result.ok) revalidatePilot();
  return toFormState(result, language);
}

/* ==========================================================================
   Baseline and success criteria
   ========================================================================== */

export async function actionRecordBaseline(_previous: ConsoleFormState | null, data: FormData): Promise<ConsoleFormState> {
  const language = readAdminLanguage();
  const workspace = workspaceOrRefusal(language);
  if (isState(workspace)) return workspace;
  const entry = workspace.measures.find((candidate) => candidate.measure.id === text(data, "measureId", 120));
  if (!entry) return refused([{ en: "That measure is not part of this pilot.", de: "Diese Kennzahl gehoert nicht zu diesem Piloten." }], language);

  const checked = validateBaseline(
    { status: text(data, "status", 20), value: text(data, "value", 40), period: text(data, "period", 80), note: text(data, "note", 400) },
    entry.measure.unit,
  );
  if (!checked.ok) return refused(checked.problems, language);
  const baseline = checked.value;
  const describe =
    baseline.status === "measured"
      ? `measured at ${baseline.value} ${entry.measure.unit} for ${baseline.period}${baseline.note ? `, entered from ${baseline.note}` : ", entered by the pilot lead"}`
      : baseline.status === "unavailable"
        ? `unavailable: ${baseline.note}`
        : `reset to not measured${baseline.note ? `: ${baseline.note}` : ""}`;

  const result = await governConsoleAction({
    actionId: "pilot.record-baseline",
    target: { kind: PILOT_AUDIT_KINDS.measure, id: entry.measure.id },
    payload: { measureId: entry.measure.id, baseline },
    summary: { en: `Baseline for ${entry.measure.label} ${describe}.`, de: `Ausgangslage fuer ${entry.measure.labelDe} erfasst.` },
    execute: (context) => {
      recordPilotBaseline(
        entry.measure.id,
        baseline.status === "measured"
          ? { status: "measured", value: baseline.value, period: baseline.period, recordedAt: context.at, recordedByLabel: context.actor.label }
          : { status: baseline.status, period: baseline.period, recordedAt: context.at, recordedByLabel: context.actor.label },
      );
      return baseline.status;
    },
    success: () => ({ en: `Baseline for ${entry.measure.label} recorded.`, de: `Ausgangslage fuer ${entry.measure.labelDe} erfasst.` }),
  });
  if (result.ok) revalidatePilot();
  return toFormState(result, language);
}

export async function actionImportBaseline(_previous: ConsoleFormState | null, data: FormData): Promise<ConsoleFormState> {
  const language = readAdminLanguage();
  const workspace = workspaceOrRefusal(language);
  if (isState(workspace)) return workspace;
  const source = text(data, "source", 160).trim();
  if (source.length === 0) {
    return refused([{ en: "Name the document or system the figures come from.", de: "Nennen Sie das Dokument oder System, aus dem die Werte stammen." }], language);
  }
  const parsed = parseBaselineImport(
    text(data, "rows", 4000),
    workspace.measures.map((entry) => ({ key: entry.measure.key, unit: entry.measure.unit })),
  );
  if (!parsed.ok) return refused(parsed.problems, language);

  const result = await governConsoleAction({
    actionId: "pilot.record-baseline",
    target: { kind: PILOT_AUDIT_KINDS.programme, id: workspace.pilot.id },
    payload: { pilotId: workspace.pilot.id, source, rows: parsed.value },
    summary: {
      en: `Baseline imported from ${source}: ${parsed.value.map((row) => `${row.key} ${row.value} (${row.period})`).join("; ")}.`,
      de: `Ausgangslage aus ${source} importiert.`,
    },
    execute: (context) => {
      for (const row of parsed.value) {
        const entry = workspace.measures.find((candidate) => candidate.measure.key === row.key);
        if (!entry) throw new Error(`Unknown measure ${row.key}.`);
        recordPilotBaseline(entry.measure.id, {
          status: "measured",
          value: row.value,
          period: row.period,
          recordedAt: context.at,
          recordedByLabel: `${context.actor.label}, imported from ${source}`,
        });
      }
      return parsed.value.length;
    },
    success: (count) => ({ en: `${count} baselines imported.`, de: `${count} Ausgangswerte importiert.` }),
  });
  if (result.ok) revalidatePilot();
  return toFormState(result, language);
}

export async function actionSetTarget(_previous: ConsoleFormState | null, data: FormData): Promise<ConsoleFormState> {
  const language = readAdminLanguage();
  const workspace = workspaceOrRefusal(language);
  if (isState(workspace)) return workspace;
  const entry = workspace.measures.find((candidate) => candidate.measure.id === text(data, "measureId", 120));
  if (!entry) return refused([{ en: "That measure is not part of this pilot.", de: "Diese Kennzahl gehoert nicht zu diesem Piloten." }], language);
  const checked = validateTarget(text(data, "target", 40), entry.measure.unit);
  if (!checked.ok) return refused(checked.problems, language);
  const target = checked.value;

  const result = await governConsoleAction({
    actionId: "pilot.set-target",
    target: { kind: PILOT_AUDIT_KINDS.measure, id: entry.measure.id },
    payload: { measureId: entry.measure.id, target },
    summary: {
      en: target === null ? `Success criterion for ${entry.measure.label} cleared.` : `Success criterion for ${entry.measure.label} set to ${target} ${entry.measure.unit}, as agreed with the design partner.`,
      de: `Erfolgskriterium fuer ${entry.measure.labelDe} festgelegt.`,
    },
    execute: () => {
      setPilotMeasureTarget(entry.measure.id, target);
      return target;
    },
    success: () => ({ en: "Success criterion recorded.", de: "Erfolgskriterium erfasst." }),
  });
  if (result.ok) revalidatePilot();
  return toFormState(result, language);
}

/* ==========================================================================
   Weekly readings and issues
   ========================================================================== */

export async function actionRecordReading(_previous: ConsoleFormState | null, data: FormData): Promise<ConsoleFormState> {
  const language = readAdminLanguage();
  const workspace = workspaceOrRefusal(language);
  if (isState(workspace)) return workspace;
  const entry = workspace.measures.find((candidate) => candidate.measure.id === text(data, "measureId", 120));
  if (!entry) return refused([{ en: "That measure is not part of this pilot.", de: "Diese Kennzahl gehoert nicht zu diesem Piloten." }], language);
  const checked = validateReading(
    {
      weekStarting: text(data, "weekStarting", 10),
      status: text(data, "status", 20),
      value: text(data, "value", 40),
      source: text(data, "source", 160),
      note: text(data, "note", 400),
    },
    entry.measure.unit,
  );
  if (!checked.ok) return refused(checked.problems, language);
  const value = checked.value;

  const result = await governConsoleAction({
    actionId: "pilot.record-reading",
    target: { kind: PILOT_AUDIT_KINDS.measure, id: entry.measure.id },
    payload: { measureId: entry.measure.id, reading: value },
    summary: {
      en: `Reading for ${entry.measure.label}, week of ${value.weekStarting}: ${value.status === "measured" ? `${value.value} ${entry.measure.unit}` : `unavailable (${value.note})`}, from ${value.source}.`,
      de: `Wochenwert fuer ${entry.measure.labelDe} erfasst.`,
    },
    rule: () =>
      workspace.pilot.status === "setup"
        ? { en: "Weekly readings start when the pilot starts.", de: "Wochenwerte beginnen mit dem Start des Piloten." }
        : null,
    execute: (context) =>
      recordPilotMeasureReading({
        id: newId("PMR"),
        pilotId: workspace.pilot.id,
        measureId: entry.measure.id,
        weekStarting: value.weekStarting,
        status: value.status,
        value: value.value,
        source: value.source,
        note: value.note,
        recordedAt: context.at,
        recordedByLabel: context.actor.label,
      }).id,
    success: () => ({ en: "Reading recorded.", de: "Wochenwert erfasst." }),
  });
  if (result.ok) revalidatePilot();
  return toFormState(result, language);
}

export async function actionRaiseIssue(_previous: ConsoleFormState | null, data: FormData): Promise<ConsoleFormState> {
  const language = readAdminLanguage();
  const workspace = workspaceOrRefusal(language);
  if (isState(workspace)) return workspace;
  const checked = validateIssue({
    kind: text(data, "kind", 30),
    title: text(data, "title", 200),
    detail: text(data, "detail", 2000),
    severity: text(data, "severity", 20),
    ownerLabel: text(data, "ownerLabel", 120),
  });
  if (!checked.ok) return refused(checked.problems, language);
  const issue = checked.value;
  const id = newId("PIS");

  const result = await governConsoleAction({
    actionId: "pilot.raise-issue",
    target: { kind: PILOT_AUDIT_KINDS.issue, id },
    payload: { pilotId: workspace.pilot.id, issue },
    summary: { en: `Raised ${issue.kind} "${issue.title}" (${issue.severity}).`, de: `${issue.kind} "${issue.title}" erfasst.` },
    execute: (context) =>
      raisePilotIssue({
        id,
        pilotId: workspace.pilot.id,
        kind: issue.kind,
        title: issue.title,
        detail: issue.detail,
        severity: issue.severity,
        status: "open",
        ownerLabel: issue.ownerLabel,
        raisedAt: context.at,
        raisedByLabel: context.actor.label,
      }).id,
    success: () => ({ en: "Recorded.", de: "Erfasst." }),
  });
  if (result.ok) revalidatePilot();
  return toFormState(result, language);
}

export async function actionUpdateIssue(_previous: ConsoleFormState | null, data: FormData): Promise<ConsoleFormState> {
  const language = readAdminLanguage();
  const workspace = workspaceOrRefusal(language);
  if (isState(workspace)) return workspace;
  const issue = workspace.issues.find((candidate) => candidate.id === text(data, "issueId", 120));
  if (!issue) return refused([{ en: "That issue is not part of this pilot.", de: "Dieses Thema gehoert nicht zu diesem Piloten." }], language);
  const checked = validateIssueUpdate(issue.status, text(data, "status", 20), text(data, "resolution", 1000));
  if (!checked.ok) return refused(checked.problems, language);
  const update = checked.value;

  const result = await governConsoleAction({
    actionId: "pilot.update-issue",
    target: { kind: PILOT_AUDIT_KINDS.issue, id: issue.id },
    payload: { issueId: issue.id, from: issue.status, update },
    summary: { en: `"${issue.title}" set to ${update.status}${update.resolution ? `: ${update.resolution}` : ""}.`, de: `"${issue.title}" aktualisiert.` },
    execute: (context) => {
      updatePilotIssue(issue.id, {
        status: update.status,
        resolution: update.resolution,
        resolvedAt: update.status === "open" ? null : context.at,
      });
      return update.status;
    },
    success: () => ({ en: "Updated.", de: "Aktualisiert." }),
  });
  if (result.ok) revalidatePilot();
  return toFormState(result, language);
}

/* ==========================================================================
   The exit decision (material)
   ========================================================================== */

export interface ExitProposalState {
  ok: boolean;
  message: string;
  proposal: { payload: string; fingerprint: string; lines: string[] } | null;
}

function readExitDraft(data: FormData) {
  const evidence = list(data, "evidence")
    .map((raw) => {
      try {
        const parsed = JSON.parse(raw) as Partial<ExitEvidenceRef>;
        return typeof parsed.kind === "string" && typeof parsed.ref === "string"
          ? { kind: parsed.kind, ref: parsed.ref, label: typeof parsed.label === "string" ? parsed.label : "" }
          : null;
      } catch {
        return null;
      }
    })
    .filter((entry): entry is ExitEvidenceRef => entry !== null);
  return {
    outcome: text(data, "outcome", 20),
    rationale: text(data, "decisionRationale", 4000),
    commercialImplication: text(data, "commercialImplication", 2000),
    nextWaveRecommendation: text(data, "nextWaveRecommendation", 2000),
    unresolvedConditions: lines(text(data, "unresolvedConditions", 8000)),
    controlFindings: lines(text(data, "controlFindings", 8000)),
    evidence,
    extendedEndOn: text(data, "extendedEndOn", 10) || null,
  };
}

/**
 * Step one: the Pilot Lead's draft, checked and turned into the exact change
 * the approval will be bound to. Writes nothing.
 */
export async function actionProposeExitDecision(_previous: ExitProposalState | null, data: FormData): Promise<ExitProposalState> {
  const language = readAdminLanguage();
  const workspace = readPilotWorkspace();
  if (!workspace) return { ok: false, message: language === "de" ? "Es ist kein Pilot eingerichtet." : "No pilot is configured.", proposal: null };

  const authorized = await authorizeConsoleAction("pilot.record-exit-decision", { kind: PILOT_AUDIT_KINDS.programme, id: workspace.pilot.id });
  if (!authorized.ok) return { ok: false, message: language === "de" ? authorized.reason.de : authorized.reason.en, proposal: null };

  const checked = validateExitDecision(workspace.pilot, readExitDraft(data));
  if (!checked.ok) {
    return { ok: false, message: checked.problems.map((entry) => (language === "de" ? entry.de : entry.en)).join(" "), proposal: null };
  }
  const change = exitDecisionChange(workspace, checked.value);
  return {
    ok: true,
    message: language === "de" ? "Pruefen Sie die Entscheidung und genehmigen Sie sie." : "Review the decision and approve it.",
    proposal: { payload: JSON.stringify(checked.value), fingerprint: exitDecisionFingerprint(change), lines: exitDecisionLines(change, language) },
  };
}

/**
 * Step two: the approved decision. The payload comes back from the review,
 * is checked again against the pilot as it is now, and is recorded only if
 * its fingerprint is the one the person approved.
 */
export async function actionRecordExitDecision(_previous: ConsoleFormState | null, data: FormData): Promise<ConsoleFormState> {
  const language = readAdminLanguage();
  const workspace = workspaceOrRefusal(language);
  if (isState(workspace)) return workspace;

  let submitted: ExitDecisionPayload;
  try {
    submitted = JSON.parse(text(data, "payload", 40_000)) as ExitDecisionPayload;
  } catch {
    return refused([{ en: "The reviewed decision could not be read. Review it again.", de: "Die gepruefte Entscheidung konnte nicht gelesen werden. Pruefen Sie erneut." }], language);
  }
  const checked = validateExitDecision(workspace.pilot, {
    outcome: String(submitted.outcome ?? ""),
    rationale: String(submitted.rationale ?? ""),
    commercialImplication: String(submitted.commercialImplication ?? ""),
    nextWaveRecommendation: String(submitted.nextWaveRecommendation ?? ""),
    unresolvedConditions: Array.isArray(submitted.unresolvedConditions) ? submitted.unresolvedConditions.map(String) : [],
    controlFindings: Array.isArray(submitted.controlFindings) ? submitted.controlFindings.map(String) : [],
    evidence: Array.isArray(submitted.evidence) ? submitted.evidence : [],
    extendedEndOn: submitted.extendedEndOn ?? null,
  });
  if (!checked.ok) return refused(checked.problems, language);
  const decision = checked.value;
  const change = exitDecisionChange(workspace, decision);
  const id = newId("PED");
  const nextStatus = EXIT_OUTCOME_EFFECT[decision.outcome];

  const result = await governConsoleAction({
    actionId: "pilot.record-exit-decision",
    target: { kind: PILOT_AUDIT_KINDS.programme, id: workspace.pilot.id },
    payload: change,
    approval: readApprovalFields(data),
    summary: {
      en: `Exit decision for ${workspace.pilot.id}: ${EXIT_OUTCOME_LABELS[decision.outcome].en}. Pilot status ${workspace.pilot.status} to ${nextStatus}. ${decision.evidence.length} evidence items, ${decision.unresolvedConditions.length} unresolved conditions, ${decision.controlFindings.length} control findings.`,
      de: `Abschlussentscheidung fuer ${workspace.pilot.id}: ${EXIT_OUTCOME_LABELS[decision.outcome].de}.`,
    },
    execute: (context) => {
      recordPilotExitDecision({
        id,
        pilotId: workspace.pilot.id,
        outcome: decision.outcome,
        evidence: decision.evidence,
        unresolvedConditions: decision.unresolvedConditions,
        controlFindings: decision.controlFindings,
        commercialImplication: decision.commercialImplication,
        nextWaveRecommendation: decision.nextWaveRecommendation,
        rationale: decision.rationale,
        decidedAt: context.at,
        decidedByLabel: context.actor.label,
        decidedByUserId: context.actor.userId,
        approvalId: context.approvalId,
      });
      updatePilotProgramme(workspace.pilot.id, {
        status: nextStatus,
        ...(nextStatus === "closed" ? { closedAt: context.at } : {}),
        ...(decision.extendedEndOn ? { plannedEndOn: decision.extendedEndOn } : {}),
        updatedAt: context.at,
      });
      return id;
    },
    success: () => ({
      en: `Exit decision recorded: ${EXIT_OUTCOME_LABELS[decision.outcome].en}. The approval is bound to this exact decision.`,
      de: `Abschlussentscheidung erfasst: ${EXIT_OUTCOME_LABELS[decision.outcome].de}. Die Genehmigung ist an genau diese Entscheidung gebunden.`,
    }),
  });
  if (result.ok) revalidatePilot();
  return toFormState(result, language);
}
