/**
 * Seed data for role-app runtime tables.
 *
 * Seeds:
 *   - One RCSA run (Payments Execution Q4, Stage 2 in progress)
 *   - One TPRM run (Veridian onboarding, Stage 4 in progress)
 *   - Stage run rows for completed and active stages of each run
 *   - AI routines for RCSA and TPRM roles
 *   - One confirmed RCSA meeting-minutes record
 *   - One draft TPRM meeting-minutes record
 *
 * and, through `seedProcessRuntime`, the process engine's view of the same
 * day: backbone events for the stages completed before the day began, the two
 * current stages opened by the engine itself (their tasks and their queued
 * AI preparation), and the safe mode cache of each current stage's validated
 * preparation. Using the engine's own `openStage` is deliberate: the seeded
 * open stage is then exactly what the engine would have produced, rather than
 * a second description of it maintained by hand.
 *
 * All identifiers are stable slugs that match the process definitions in
 * src/role-apps/rcsa/definition.ts and src/role-apps/tprm/definition.ts.
 *
 * Synthetic institution and data.
 */

import { DEFAULT_RUN_ID, type RoleId } from "@/db/schema/core";
import {
  getRun,
  getStageRuns,
  type NewAIRoutine,
  type NewMeetingMinutes,
  type NewRun,
  type NewStageRun,
} from "@/db/repositories/role-app-runtime";
import { getProcessDefinition, getRoleApp } from "@/role-apps/registry";
import { publishOsEvent } from "@/features/events/backbone";
import "@/features/process/implementations";
import { buildStageContext } from "@/features/process/context";
import { captureSeededPreparation } from "@/features/process/preparation";
import { openStage } from "@/features/process/transition";

/* ==========================================================================
   Role-app runs
   ========================================================================== */

export const roleAppRunsData: NewRun[] = [
  {
    id: "RUN-RCSA-PAYOPS-Q4-2026",
    runId: DEFAULT_RUN_ID,
    roleAppId: "rcsa-cycle-assistant",
    roleId: "rcsa",
    subjectKind: "assessment",
    subjectId: "RCSA-ARC-DE-PAYOPS-2026-Q4",
    currentStageId: "evidence-refresh",
    status: "in-progress",
    mode: "offline",
    startedAt: "2026-10-01T08:00:00.000Z",
    updatedAt: "2026-10-01T14:30:00.000Z",
    completedAt: null,
    blockedReason: null,
  },
  {
    id: "RUN-TPRM-VERIDIAN-2026",
    runId: DEFAULT_RUN_ID,
    roleAppId: "tprm-third-party-onboarding",
    roleId: "tprm",
    subjectKind: "supplier",
    subjectId: "TP-0099",
    currentStageId: "evidence-review",
    status: "in-progress",
    mode: "offline",
    startedAt: "2026-09-15T08:00:00.000Z",
    updatedAt: "2026-10-01T11:00:00.000Z",
    completedAt: null,
    blockedReason: null,
  },
];

/* ==========================================================================
   Stage runs
   ========================================================================== */

export const roleAppStageRunsData: NewStageRun[] = [
  /* ---- RCSA: Stage 1 scope-trigger (completed) ---- */
  {
    id: "STAGERUN-RCSA-1",
    runId: DEFAULT_RUN_ID,
    roleAppRunId: "RUN-RCSA-PAYOPS-Q4-2026",
    stageId: "scope-trigger",
    status: "completed",
    openedAt: "2026-10-01T08:00:00.000Z",
    completedAt: "2026-10-01T10:00:00.000Z",
    completedByUserId: "P-003",
    aiOutputId: null,
  },
  /* ---- RCSA: Stage 2 evidence-refresh (in progress, waiting for input) ---- */
  {
    id: "STAGERUN-RCSA-2",
    runId: DEFAULT_RUN_ID,
    roleAppRunId: "RUN-RCSA-PAYOPS-Q4-2026",
    stageId: "evidence-refresh",
    status: "waiting-for-input",
    openedAt: "2026-10-01T10:00:00.000Z",
    completedAt: null,
    completedByUserId: null,
    aiOutputId: null,
  },
  /* ---- TPRM: Stage 1 request-and-intake (completed) ---- */
  {
    id: "STAGERUN-TPRM-1",
    runId: DEFAULT_RUN_ID,
    roleAppRunId: "RUN-TPRM-VERIDIAN-2026",
    stageId: "request-and-intake",
    status: "completed",
    openedAt: "2026-09-15T08:00:00.000Z",
    completedAt: "2026-09-17T12:00:00.000Z",
    completedByUserId: "P-002",
    aiOutputId: null,
  },
  /* ---- TPRM: Stage 2 classification-and-criticality (completed) ---- */
  {
    id: "STAGERUN-TPRM-2",
    runId: DEFAULT_RUN_ID,
    roleAppRunId: "RUN-TPRM-VERIDIAN-2026",
    stageId: "classification-and-criticality",
    status: "completed",
    openedAt: "2026-09-17T12:00:00.000Z",
    completedAt: "2026-09-22T09:00:00.000Z",
    completedByUserId: "P-002",
    aiOutputId: null,
  },
  /* ---- TPRM: Stage 3 tailored-due-diligence (completed) ---- */
  {
    id: "STAGERUN-TPRM-3",
    runId: DEFAULT_RUN_ID,
    roleAppRunId: "RUN-TPRM-VERIDIAN-2026",
    stageId: "tailored-due-diligence",
    status: "completed",
    openedAt: "2026-09-22T09:00:00.000Z",
    completedAt: "2026-09-30T16:00:00.000Z",
    completedByUserId: "P-002",
    aiOutputId: null,
  },
  /* ---- TPRM: Stage 4 evidence-review (in progress) ---- */
  {
    id: "STAGERUN-TPRM-4",
    runId: DEFAULT_RUN_ID,
    roleAppRunId: "RUN-TPRM-VERIDIAN-2026",
    stageId: "evidence-review",
    status: "waiting-for-input",
    openedAt: "2026-09-30T16:00:00.000Z",
    completedAt: null,
    completedByUserId: null,
    aiOutputId: null,
  },
];

/* ==========================================================================
   AI routines
   ========================================================================== */

const SCHEDULE_CONFIG = { frequency: "daily", time: "07:00" };
const PRE_MEETING_CONFIG = { offsetMinutes: -30 };

export const aiRoutinesData: NewAIRoutine[] = [
  /* ---- RCSA routines ---- */
  {
    id: "morning-brief-rcsa",
    runId: DEFAULT_RUN_ID,
    roleId: "rcsa",
    name: "Morning Brief",
    triggerType: "schedule",
    triggerConfig: SCHEDULE_CONFIG,
    status: "active",
    authorityClass: "READ",
    outputKind: "morning-brief",
    lastRunAt: "2026-10-06T07:00:00.000Z",
    nextRunAt: "2026-10-07T07:00:00.000Z",
  },
  {
    id: "calendar-scan-rcsa",
    runId: DEFAULT_RUN_ID,
    roleId: "rcsa",
    name: "Calendar Scan",
    triggerType: "schedule",
    triggerConfig: SCHEDULE_CONFIG,
    status: "active",
    authorityClass: "READ",
    outputKind: "calendar-digest",
    lastRunAt: "2026-10-06T07:05:00.000Z",
    nextRunAt: "2026-10-07T07:05:00.000Z",
  },
  {
    id: "pre-meeting-prep-rcsa",
    runId: DEFAULT_RUN_ID,
    roleId: "rcsa",
    name: "Pre-Meeting Preparation",
    triggerType: "before-meeting",
    triggerConfig: PRE_MEETING_CONFIG,
    status: "active",
    authorityClass: "DRAFT",
    outputKind: "meeting-preparation",
    lastRunAt: "2026-10-06T10:00:00.000Z",
    nextRunAt: null,
  },
  {
    id: "kri-control-watch",
    runId: DEFAULT_RUN_ID,
    roleId: "rcsa",
    name: "KRI and Control Watch",
    triggerType: "schedule",
    triggerConfig: { frequency: "hourly" },
    status: "active",
    authorityClass: "READ",
    outputKind: "alert-digest",
    lastRunAt: "2026-10-06T07:30:00.000Z",
    nextRunAt: "2026-10-06T08:30:00.000Z",
  },
  {
    id: "evidence-freshness-rcsa",
    runId: DEFAULT_RUN_ID,
    roleId: "rcsa",
    name: "Evidence Freshness Check",
    triggerType: "schedule",
    triggerConfig: { frequency: "weekly", dayOfWeek: 1 },
    status: "active",
    authorityClass: "READ",
    outputKind: "freshness-report",
    lastRunAt: "2026-09-29T06:00:00.000Z",
    nextRunAt: "2026-10-06T06:00:00.000Z",
  },
  /* ---- TPRM routines ---- */
  {
    id: "morning-brief-tprm",
    runId: DEFAULT_RUN_ID,
    roleId: "tprm",
    name: "Morning Brief",
    triggerType: "schedule",
    triggerConfig: SCHEDULE_CONFIG,
    status: "active",
    authorityClass: "READ",
    outputKind: "morning-brief",
    lastRunAt: "2026-10-06T07:00:00.000Z",
    nextRunAt: "2026-10-07T07:00:00.000Z",
  },
  {
    id: "pre-meeting-prep-tprm",
    runId: DEFAULT_RUN_ID,
    roleId: "tprm",
    name: "Pre-Meeting Preparation",
    triggerType: "before-meeting",
    triggerConfig: PRE_MEETING_CONFIG,
    status: "active",
    authorityClass: "DRAFT",
    outputKind: "meeting-preparation",
    lastRunAt: null,
    nextRunAt: null,
  },
  {
    id: "supplier-monitoring-watch",
    runId: DEFAULT_RUN_ID,
    roleId: "tprm",
    name: "Supplier Monitoring Watch",
    triggerType: "schedule",
    triggerConfig: { frequency: "daily", time: "08:00" },
    status: "active",
    authorityClass: "READ",
    outputKind: "supplier-alert-digest",
    lastRunAt: "2026-10-06T08:00:00.000Z",
    nextRunAt: "2026-10-07T08:00:00.000Z",
  },
  {
    id: "evidence-request-followup",
    runId: DEFAULT_RUN_ID,
    roleId: "tprm",
    name: "Evidence-Request Follow-up",
    triggerType: "schedule",
    triggerConfig: { frequency: "daily", time: "09:00" },
    status: "active",
    authorityClass: "DRAFT",
    outputKind: "follow-up-digest",
    lastRunAt: "2026-10-06T09:00:00.000Z",
    nextRunAt: "2026-10-07T09:00:00.000Z",
  },
];

/* ==========================================================================
   Meeting minutes
   ========================================================================== */

/*
 * Every reference in these two records resolves (audit T20). The meetings
 * they record (`MTG-RCSA-PAYOPS-Q4-2026-SCOPE`, `MTG-TPRM-VERIDIAN-TRIAGE-2026`)
 * are seeded as held meetings by `src/db/seed/meeting-lifecycle.ts`, which
 * also files the confirmed RCSA minutes as evidence and writes the TPRM
 * draft's structured content. The RCSA minutes raised MSN-2026-0197, the
 * second line pre-read, and cite the override log and the control test
 * report the scope rested on; no decision row was recorded at scoping, so
 * none is cited. The TPRM draft's two chase actions are proposed in its
 * draft and are raised only when a person confirms it.
 */
export const meetingMinutesData: NewMeetingMinutes[] = [
  /* ---- RCSA: concluded scope confirmation minutes (confirmed) ---- */
  {
    id: "MINUTES-RCSA-SCOPE-WORKSHOP-2026",
    runId: DEFAULT_RUN_ID,
    meetingId: "MTG-RCSA-PAYOPS-Q4-2026-SCOPE",
    roleId: "rcsa",
    title: "RCSA Scope Confirmation: Payments Execution Q4 2026",
    summary:
      "The scope for the Payments Execution Q4 RCSA was confirmed as PRC-0041 (Payment repair and manual override). The trigger reason is the breach of KRI-PAY-007 (override rate) above the amber threshold for three consecutive months. Arcadia Bank AG (ARC-DE) is the primary entity. The assessment period runs from 01.07.2026 to 30.09.2026. Marlene Aigner (P-003) confirmed the scope and trigger with Andreas Kellner (P-007) as assessment owner. The challenge workshop is scheduled for 06.10.2026 at 10:30.",
    factItems: [
      "Process in scope: PRC-0041 Payment repair and manual override (PAY.03.02)",
      "Trigger: KRI-PAY-007 override rate in amber breach for three consecutive months (Q2 2026, July 2026, August 2026)",
      "Key risk: RSK-0211 Erroneous or unauthorised payment release",
      "Key control under challenge: CTL-PAY-014 Four-eyes independent review",
      "Entity: Arcadia Bank AG (ARC-DE)",
      "Assessment period: 01.07.2026 to 30.09.2026",
      "Challenge workshop: 06.10.2026 10:30"
    ],
    decisionIds: [],
    actionIds: ["MSN-2026-0197"],
    unresolvedItems: [],
    evidenceIds: ["EVD-2026-41805", "EVD-2026-41850"],
    participantUserIds: ["P-003", "P-007"],
    distributionUserIds: ["P-003", "P-007"],
    status: "confirmed",
    preparedBy: "ai",
    confirmedByUserId: "P-003",
    confirmedAt: "2026-10-01T10:15:00.000Z",
    distributedAt: null,
    createdAt: "2026-10-01T10:00:00.000Z",
  },
  /* ---- TPRM: evidence triage call minutes (draft) ---- */
  {
    id: "MINUTES-TPRM-EVIDENCE-TRIAGE-2026",
    runId: DEFAULT_RUN_ID,
    meetingId: "MTG-TPRM-VERIDIAN-TRIAGE-2026",
    roleId: "tprm",
    title: "Veridian Evidence Triage: Stage 4 Review Call",
    summary:
      "Stefan Brunner reviewed the outstanding evidence position for Veridian Document Systems GmbH (TP-0099) with Group Information Security, whose review is EVD-OB-0099-02, and Group Operational Resilience (P-005). Four evidence items are accepted. Two items are outstanding: the full penetration test report (EVD-OB-0099-05, expected 09.10.2026) and the BCM plan and test report (EVD-OB-0099-06). The group agreed that a conditional gate pass to Stage 5 is appropriate if both items are received by 09.10.2026. Draft minutes pending confirmation by Stefan Brunner.",
    factItems: [
      "Supplier: Veridian Document Systems GmbH (TP-0099), PRQ-2026-0087",
      "Stage 4 evidence: 4 items accepted, 2 outstanding",
      "EVD-OB-0099-05 (penetration test): not received, expected 09.10.2026",
      "EVD-OB-0099-06 (BCM plan): not received, no confirmed response",
      "IT Security condition: full pen test report required before contract signature",
      "Legal review: pending, expected 20.10.2026"
    ],
    decisionIds: [],
    actionIds: [],
    unresolvedItems: [
      "Netherlands backup data residency confirmation from supplier",
      "Subprocessor consent model: prior consent or notice and objection"
    ],
    evidenceIds: ["EVD-OB-0099-02", "EVD-OB-0099-05", "EVD-OB-0099-06", "EVD-OB-0099-08"],
    participantUserIds: ["P-002", "P-005"],
    distributionUserIds: ["P-002", "P-005"],
    status: "draft",
    preparedBy: "ai",
    preparedMode: "safe",
    confirmedByUserId: null,
    confirmedAt: null,
    distributedAt: null,
    createdAt: "2026-10-01T11:00:00.000Z",
  },
];

/* ==========================================================================
   The process engine's view of the seeded day
   ========================================================================== */

/** When the safe mode preparations count as captured: before the day starts. */
const CACHE_CAPTURED_AT = "2026-10-06T07:40:00.000Z";

/** "2026-10-01T10:00:00.000Z" to "10:00", the time of day an earlier event happened. */
function timeOfDay(iso: string): string {
  return iso.slice(11, 16);
}

/**
 * Writes the process runtime state the seeded day implies. Runs inside the
 * seed transaction, after the role-app rows, the evidence corpus and the
 * scenario run exist, because the engine reads all three.
 *
 * Returns the number of rows written, for the seed summary.
 */
export function seedProcessRuntime(runId: string = DEFAULT_RUN_ID): number {
  let written = 0;

  for (const seededRun of roleAppRunsData) {
    const run = getRun(seededRun.id, runId);
    const app = run ? getRoleApp(run.roleAppId) : undefined;
    const process = app ? getProcessDefinition(app.processId) : undefined;
    if (!run || !process) continue;

    /* History: the stages completed before the engine existed, on the backbone. */
    for (const stageRun of getStageRuns(run.id, runId)) {
      const stage = process.stages.find((candidate) => candidate.id === stageRun.stageId);
      if (!stage || stageRun.status !== "completed" || !stageRun.openedAt || !stageRun.completedAt) continue;
      const common = {
        runId,
        roleId: run.roleId as RoleId,
        actorKind: "system" as const,
        subject: { kind: run.subjectKind, id: run.subjectId },
        process: { runId: run.id, stageId: stage.id },
        correlationId: stageRun.id,
      };
      publishOsEvent({
        ...common,
        id: `OSE-SEED-${stageRun.id}-opened`,
        type: "stage-opened",
        atMoment: timeOfDay(stageRun.openedAt),
        occurredAt: stageRun.openedAt,
        summary: { en: `Stage ${stage.sequence} ${stage.name} opened.`, de: `Stufe ${stage.sequence} ${stage.nameDe} geoeffnet.` },
        payload: { stageRunId: stageRun.id, seededHistory: true },
        idempotencyKey: `stage-opened:${stageRun.id}`,
      });
      publishOsEvent({
        ...common,
        id: `OSE-SEED-${stageRun.id}-completed`,
        type: "stage-completed",
        actorKind: "human",
        actorUserId: stageRun.completedByUserId,
        atMoment: timeOfDay(stageRun.completedAt),
        occurredAt: stageRun.completedAt,
        summary: {
          en: `Stage ${stage.sequence} ${stage.name} completed by ${stageRun.completedByUserId ?? "the role holder"}, before the process engine recorded completions.`,
          de: `Stufe ${stage.sequence} ${stage.nameDe} von ${stageRun.completedByUserId ?? "der Rolleninhaberin"} abgeschlossen, bevor die Prozess-Engine Abschluesse erfasste.`,
        },
        payload: { stageRunId: stageRun.id, seededHistory: true },
        idempotencyKey: `stage-completed:${stageRun.id}`,
      });
      written += 2;
    }

    /* The current stage, opened by the engine with its tasks and queued preparation. */
    const current = process.stages.find((stage) => stage.id === run.currentStageId);
    const currentRow = getStageRuns(run.id, runId).find((row) => row.stageId === run.currentStageId);
    if (!current || !currentRow?.openedAt) continue;
    const opened = openStage({
      runId,
      run,
      stage: current,
      atMoment: timeOfDay(currentRow.openedAt),
      seed: { stageRunId: currentRow.id, openedAt: currentRow.openedAt },
    });
    written += 1 + current.humanTasks.length + current.decisions.length + current.aiJobs.length + (opened.jobId ? 1 : 0);

    /* The safe mode cache: the validated preparation of the seeded day. */
    if (current.implementation.implemented) {
      captureSeededPreparation(buildStageContext({ processRunId: run.id, stageId: current.id, runId }), CACHE_CAPTURED_AT);
      written += 1;
    }
  }

  return written;
}
