/**
 * Plain object fixtures for the Work Hub read models.
 *
 * The read models are pure, so their tests build `WorkSharedData` by hand
 * rather than seeding a database. Each builder returns a complete row with
 * neutral defaults, and a test overrides only the fields its claim is about,
 * which keeps every assertion readable as "given this one fact, the view
 * says this".
 */

import type {
  WorkActionRow,
  WorkActionUpdateRow,
  WorkEvidenceRow,
  WorkMinutesRow,
  WorkPerson,
  WorkProcessScope,
} from "@/db/repositories/work-hub";
import { entryKindOf } from "@/features/work/modules/actions/policy";
import { OPERATIONAL_RISK_WORK } from "@/features/work/roles/operational-risk";
import type { CalendarRow, GateView, InboxRow, MeetingRow, WorkSharedData } from "@/features/work/shared";
import { DEFAULT_QUERY, type WorkQuery } from "@/features/work/url";

export const DATE = "2026-10-06";

export function at(moment: string, date = DATE): string {
  return `${date}T${moment}:00.000Z`;
}

export function calendarRow(overrides: Partial<CalendarRow> & Pick<CalendarRow, "id">): CalendarRow {
  return {
    runId: "run-001",
    roleId: "rcsa",
    title: overrides.id,
    titleDe: "",
    startsAt: at("10:00"),
    endsAt: at("11:00"),
    momentLabel: null,
    location: "",
    attendeeUserIds: ["P-003"],
    kind: "meeting",
    hasConflict: false,
    conflictWithId: null,
    meetingId: null,
    preparationStatus: "not-started",
    agenda: "",
    ...overrides,
  };
}

export function meetingRow(overrides: Partial<MeetingRow> & Pick<MeetingRow, "id">): MeetingRow {
  return {
    runId: "run-001",
    roleId: "rcsa",
    reference: `REF-${overrides.id}`,
    title: overrides.id,
    titleDe: "",
    kind: "rcsa-workshop",
    momentLabel: "10:30",
    scheduledFor: at("10:30"),
    participantUserIds: ["P-003"],
    objective: "Agree the rating.",
    preparationSummary: "",
    evidenceDocumentIds: [],
    preparedQuestions: [],
    status: "not-started",
    outcome: "",
    concludedAt: null,
    supportsVoice: false,
    subjectKind: null,
    subjectId: null,
    heldByUserId: null,
    heldAt: null,
    processRunId: null,
    stageId: null,
    ...overrides,
  };
}

export function actionRow(overrides: Partial<WorkActionRow> & Pick<WorkActionRow, "id">): WorkActionRow {
  return {
    runId: "run-001",
    reference: `REF-${overrides.id}`,
    title: `Action ${overrides.id}`,
    titleDe: "",
    description: "",
    kind: "evidence-request",
    issueId: null,
    raisedByRoleId: "rcsa",
    ownerUserId: "P-003",
    ownerLabel: "",
    entityId: "ARC-DE",
    createdOn: "2026-09-01",
    dueOn: "2026-10-20",
    completedOn: null,
    status: "open",
    priority: "medium",
    isUnowned: false,
    relatedObjectKind: null,
    relatedObjectId: null,
    sourceDecisionId: null,
    createdBySession: false,
    progressNote: "",
    completionCondition: null,
    completionConditionBy: null,
    completionConditionAt: null,
    blockedReason: null,
    blockedSince: null,
    sourceMeetingId: null,
    sourceMinutesId: null,
    sourceProcessRunId: null,
    sourceStageId: null,
    sourceStageRunId: null,
    sourceMessageId: null,
    ...overrides,
  };
}

/** The entry kind defaults from the identifier prefix, the rule migration 0005 applied to existing rows. */
export function updateRow(overrides: Partial<WorkActionUpdateRow> & Pick<WorkActionUpdateRow, "id" | "actionId">): WorkActionUpdateRow {
  return {
    runId: "run-001",
    at: "2026-10-06T08:00:00.000Z",
    authorUserId: "P-003",
    authorKind: "human",
    note: "Progress.",
    evidenceIds: [],
    statusAfter: "open",
    kind: entryKindOf(overrides.id),
    ...overrides,
  };
}

export function inboxRow(overrides: Partial<InboxRow> & Pick<InboxRow, "id">): InboxRow {
  return {
    runId: "run-001",
    roleId: "rcsa",
    channel: "mail",
    fromUserId: null,
    fromLabel: "Sender",
    subject: `Subject ${overrides.id}`,
    subjectDe: "",
    body: "Body.",
    receivedAt: at("07:00"),
    revealedAtMoment: "07:45",
    isRead: false,
    proposedTriage: "action",
    triageRationale: "It asks the role for something it owns.",
    triageConfidence: 0.8,
    confirmedTriage: null,
    relatedObjectKind: null,
    relatedObjectId: null,
    linkedDecisionId: null,
    linkedActionId: null,
    conversionKind: null,
    convertedByUserId: null,
    convertedAt: null,
    triageConfirmedByUserId: null,
    triageConfirmedAt: null,
    triageReason: null,
    linkedEvidenceDocumentId: null,
    delegatedToUserId: null,
    isDuplicateOf: null,
    requiresResponseBy: null,
    fromSharedEvent: false,
    priorityRank: 50,
    ...overrides,
  };
}

export function evidenceRow(overrides: Partial<WorkEvidenceRow> & Pick<WorkEvidenceRow, "id">): WorkEvidenceRow {
  return {
    runId: "run-001",
    reference: overrides.id,
    title: `Document ${overrides.id}`,
    titleDe: "",
    sourceType: "kri-report",
    sourceSystem: "RiskCore",
    authorLabel: "Author",
    authorUserId: null,
    documentDate: "2026-10-01",
    ingestedAt: "2026-10-01T00:00:00.000Z",
    entityIds: ["ARC-DE"],
    dataClassification: "internal",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "approved-record",
    body: "",
    summary: "",
    relatedObjectIds: [],
    pageCount: 1,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
    sourceMinutesId: null,
    sourceMessageId: null,
    ...overrides,
  };
}

export function minutesRow(overrides: Partial<WorkMinutesRow> & Pick<WorkMinutesRow, "id" | "meetingId">): WorkMinutesRow {
  return {
    runId: "run-001",
    roleId: "rcsa",
    title: `Minutes ${overrides.id}`,
    summary: "Summary.",
    factItems: [],
    decisionIds: [],
    actionIds: [],
    unresolvedItems: [],
    evidenceIds: [],
    participantUserIds: ["P-003"],
    status: "draft",
    preparedBy: "ai",
    confirmedByUserId: null,
    confirmedAt: null,
    distributedAt: null,
    createdAt: "2026-10-01T10:00:00.000Z",
    draft: null,
    version: 1,
    contentDigest: null,
    preparedMode: null,
    editedByUserId: null,
    editedAt: null,
    evidenceDocumentId: null,
    distributionUserIds: [],
    distributionMessageId: null,
    confirmationApprovalId: null,
    ...overrides,
  };
}

export function processScope(overrides: Partial<WorkProcessScope> = {}): WorkProcessScope {
  return {
    roleAppRunId: "RUN-1",
    roleAppId: "rcsa-cycle-assistant",
    processName: { en: "RCSA cycle", de: "RCSA-Zyklus" },
    subjectKind: "assessment",
    subjectId: "ASSESS-1",
    status: "in-progress",
    currentStageId: "evidence-refresh",
    currentStageName: { en: "Evidence refresh", de: "Nachweisauffrischung" },
    stageNames: {
      "evidence-refresh": { en: "Evidence refresh", de: "Nachweisauffrischung" },
      "challenge-workshop": { en: "Challenge workshop", de: "Challenge-Workshop" },
    },
    entryRoute: "/workday/rcsa/processes/rcsa-cycle",
    scopeIds: ["ASSESS-1", "CTL-1"],
    ...overrides,
  };
}

/** Every hub tool reachable, routine ones without approval, material ones with. */
export function openGate(): GateView {
  const verdict = (toolName: string, cls: "DRAFT" | "POLICY_BOUND_AUTONOMOUS" | "APPROVAL_REQUIRED") => ({
    toolName,
    authorityClass: cls,
    reachable: true,
    needsApproval: cls !== "DRAFT",
    material: cls === "APPROVAL_REQUIRED",
    reason: "",
  });
  return {
    draftActionReminder: verdict("draftActionReminder", "DRAFT"),
    prepareChallengeQuestions: verdict("prepareChallengeQuestions", "DRAFT"),
    addActionUpdate: verdict("addActionUpdate", "POLICY_BOUND_AUTONOMOUS"),
    requestEvidenceDocument: verdict("requestEvidenceDocument", "POLICY_BOUND_AUTONOMOUS"),
    sendSimulatedCollaborationMessage: verdict("sendSimulatedCollaborationMessage", "POLICY_BOUND_AUTONOMOUS"),
    reassignAction: verdict("reassignAction", "APPROVAL_REQUIRED"),
    changeActionDueDate: verdict("changeActionDueDate", "APPROVAL_REQUIRED"),
    completeAction: verdict("completeAction", "APPROVAL_REQUIRED"),
    reopenAction: verdict("reopenAction", "APPROVAL_REQUIRED"),
    addCommitteeAgendaItem: verdict("addCommitteeAgendaItem", "APPROVAL_REQUIRED"),
    recordMeetingHeld: verdict("recordMeetingHeld", "APPROVAL_REQUIRED"),
    captureMeetingItem: verdict("captureMeetingItem", "POLICY_BOUND_AUTONOMOUS"),
    prepareMeetingMinutes: verdict("prepareMeetingMinutes", "POLICY_BOUND_AUTONOMOUS"),
    editMeetingMinutes: verdict("editMeetingMinutes", "POLICY_BOUND_AUTONOMOUS"),
    confirmMeetingMinutes: verdict("confirmMeetingMinutes", "APPROVAL_REQUIRED"),
    distributeMeetingMinutes: verdict("distributeMeetingMinutes", "POLICY_BOUND_AUTONOMOUS"),
    createAction: verdict("createAction", "APPROVAL_REQUIRED"),
    recordInboxTriage: verdict("recordInboxTriage", "POLICY_BOUND_AUTONOMOUS"),
    linkInboxMessage: verdict("linkInboxMessage", "POLICY_BOUND_AUTONOMOUS"),
    fileInboxMessageAsEvidence: verdict("fileInboxMessageAsEvidence", "POLICY_BOUND_AUTONOMOUS"),
    addInboxMessageToProcess: verdict("addInboxMessageToProcess", "POLICY_BOUND_AUTONOMOUS"),
    delegateInboxMessage: verdict("delegateInboxMessage", "POLICY_BOUND_AUTONOMOUS"),
    draftInboxReply: verdict("draftInboxReply", "DRAFT"),
    sendInboxReply: verdict("sendInboxReply", "POLICY_BOUND_AUTONOMOUS"),
  };
}

const PEOPLE: WorkPerson[] = [
  { id: "P-003", name: "Anna Weber", jobTitle: "Operational Risk Partner", line: "2lod" },
  { id: "P-007", name: "Jonas Keller", jobTitle: "Head of Payment Operations", line: "1lod" },
];

export function shared(overrides: Partial<WorkSharedData> = {}): WorkSharedData {
  return {
    roleId: "rcsa",
    holderUserId: "P-003",
    holderName: "Anna Weber",
    scenarioDate: DATE,
    currentMoment: "07:45",
    language: "en",
    autonomyLevel: "act-with-approval",
    config: OPERATIONAL_RISK_WORK,
    people: new Map(PEOPLE.map((person) => [person.id, person])),
    assignable: PEOPLE,
    objectLabels: new Map([["CTL-1", { en: "Four-eyes review", de: "Vier-Augen-Pruefung" }]]),
    processScopes: [],
    decisions: [],
    calendar: [],
    meetings: [],
    actions: [],
    minutes: [],
    messages: [],
    gate: openGate(),
    ...overrides,
  };
}

export function query(overrides: Partial<WorkQuery> = {}): WorkQuery {
  return { ...DEFAULT_QUERY, ...overrides };
}
