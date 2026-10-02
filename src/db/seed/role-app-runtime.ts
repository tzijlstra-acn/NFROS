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
 * All identifiers are stable slugs that match the process definitions in
 * src/role-apps/rcsa/definition.ts and src/role-apps/tprm/definition.ts.
 *
 * Synthetic institution and data.
 */

import { DEFAULT_RUN_ID } from "@/db/schema/core";
import type {
  NewAIRoutine,
  NewMeetingMinutes,
  NewRun,
  NewStageRun,
} from "@/db/repositories/role-app-runtime";

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

export const meetingMinutesData: NewMeetingMinutes[] = [
  /* ---- RCSA: concluded workshop minutes (confirmed) ---- */
  {
    id: "MINUTES-RCSA-SCOPE-WORKSHOP-2026",
    runId: DEFAULT_RUN_ID,
    meetingId: "MTG-RCSA-PAYOPS-Q4-2026-SCOPE",
    roleId: "rcsa",
    title: "RCSA Scope Confirmation -- Payments Execution Q4 2026",
    summary:
      "The scope for the Payments Execution Q4 RCSA was confirmed as PRC-0041 (Payment repair and manual override). The trigger reason is the breach of KRI-PAY-007 (override rate) above the amber threshold for three consecutive months. Arcadia Bank AG (ARC-DE) is the primary entity. The assessment period runs from 01.07.2026 to 30.09.2026. Anna Weber confirmed the scope and trigger. The challenge workshop is scheduled for 06.10.2026 at 10:30.",
    factItems: [
      "Process in scope: PRC-0041 Payment repair and manual override (PAY.03.02)",
      "Trigger: KRI-PAY-007 override rate in amber breach for three consecutive months (Q2 2026, July 2026, August 2026)",
      "Key risk: RSK-0211 Erroneous or unauthorised payment release",
      "Key control under challenge: CTL-PAY-014 Four-eyes independent review",
      "Entity: Arcadia Bank AG (ARC-DE)",
      "Assessment period: 01.07.2026 to 30.09.2026",
      "Challenge workshop: 06.10.2026 10:30"
    ],
    decisionIds: ["DEC-RCSA-SCOPE-2026-Q4"],
    actionIds: ["ACT-RCSA-PAYOPS-Q4-001"],
    unresolvedItems: [],
    evidenceIds: ["EVD-KRI-PAY-007-Q3", "EVD-CTL-PAY-014-TST-2026"],
    participantUserIds: ["P-003"],
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
    title: "Veridian Evidence Triage -- Stage 4 Review Call",
    summary:
      "Stefan Brunner reviewed the outstanding evidence position for Veridian Document Systems GmbH (TP-0099) with Group IT Security. Four evidence items are accepted. Two items are outstanding: the full penetration test report (EVD-OB-0099-05, expected 09.10.2026) and the BCM plan and test report (EVD-OB-0099-06). The group agreed that a conditional gate pass to Stage 5 is appropriate if both items are received by 09.10.2026. Draft minutes pending confirmation by Stefan Brunner.",
    factItems: [
      "Supplier: Veridian Document Systems GmbH (TP-0099), PRQ-2026-0087",
      "Stage 4 evidence: 4 items accepted, 2 outstanding",
      "EVD-OB-0099-05 (penetration test): not received, expected 09.10.2026",
      "EVD-OB-0099-06 (BCM plan): not received, no confirmed response",
      "IT Security condition: full pen test report required before contract signature",
      "Legal review: pending, expected 20.10.2026"
    ],
    decisionIds: [],
    actionIds: ["ACT-TPRM-OB-0099-PENTEST-CHASE", "ACT-TPRM-OB-0099-BCM-CHASE"],
    unresolvedItems: [
      "Netherlands backup data residency confirmation from supplier",
      "Subprocessor consent model -- prior consent vs notice and objection"
    ],
    evidenceIds: ["EVD-OB-0099-02", "EVD-OB-0099-05", "EVD-OB-0099-06", "EVD-OB-0099-08"],
    participantUserIds: ["P-002"],
    status: "draft",
    preparedBy: "ai",
    confirmedByUserId: null,
    confirmedAt: null,
    distributedAt: null,
    createdAt: "2026-10-01T11:00:00.000Z",
  },
];
