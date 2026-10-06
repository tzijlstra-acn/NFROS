/**
 * The Actions module read model.
 *
 * Pure: shared hub data and the module's extras in, the queue and the detail
 * out. No static fallback of any kind. A role with no actions gets an empty
 * state that says so, because a static list in that position is exactly the
 * defect the plan names first: the user cannot tell real accountability from
 * decoration.
 *
 * The four views are filters over one classification (`classifyAction`), so
 * an overdue action that needs the holder appears in both Needs me and
 * Overdue, and the counts on the saved views are counts of the same rows the
 * queue shows.
 */

import type { Language } from "@/i18n/labels";
import type {
  WorkActionRow,
  WorkActionUpdateRow,
  WorkAuditRow,
  WorkCommitteeItemRow,
  WorkEvidenceRow,
  WorkFollowUpRow,
} from "@/db/repositories/work-hub";
import { AUTHORITY_LABELS } from "@/features/decisions/copy";
import { COPY, KIND_LABELS, TAB_LABELS, fill, say } from "../../copy";
import { evidenceRef, sourceFreshness } from "../../freshness";
import {
  addDays,
  displayDate,
  firstLine,
  type ActivityEntry,
  type AuditRef,
  type DetailBase,
  type DetailFact,
  type EvidenceRef,
  type ModuleQueueView,
  type QueueRowView,
  type RelatedLink,
  type Tone,
  type WorkChip,
} from "../../model";
import {
  actionLink,
  auditLink,
  compactLinks,
  decisionLink,
  evidenceLink,
  findProcessFor,
  meetingLink,
  messageLink,
  objectLink,
  processLink,
} from "../../related";
import { directAiContext } from "../../selection";
import {
  actionTitle,
  decisionTitle,
  matchesObject,
  meetingTitle,
  messageSubject,
  objectKindLabel,
  objectName,
  personName,
  type GateView,
  type WorkSharedData,
} from "../../shared";
import { ACTION_VIEWS, workHref, type ActionViewId, type WorkQuery } from "../../url";
import { ACTION_EMPTY, ACTION_VIEW_LABELS, ACTIONS_COPY, ENTRY_LABELS } from "./copy";
import {
  actionMateriality,
  classifyAction,
  dueText,
  duplicateCandidates,
  evidenceRequiredToComplete,
  kindOfEntry,
  proposedCompletionCondition,
  vagueWording,
  type ActionState,
  type DuplicateCandidate,
  type Materiality,
  type VagueFinding,
} from "./policy";

/* ==========================================================================
   Inputs
   ========================================================================== */

export interface ActionsExtras {
  updates: ReadonlyMap<string, WorkActionUpdateRow[]>;
  followUps: ReadonlyMap<string, WorkFollowUpRow[]>;
  /** Evidence requests and other actions raised against an action. */
  linked: ReadonlyMap<string, WorkActionRow[]>;
  escalations: ReadonlyMap<string, WorkCommitteeItemRow[]>;
  /** Documents cited in progress entries. */
  evidence: ReadonlyMap<string, WorkEvidenceRow>;
  /** Documents linked to an action's object, by object identifier. */
  relatedEvidence: ReadonlyMap<string, WorkEvidenceRow[]>;
  /** Audit events, loaded for the selected action only. */
  audit: ReadonlyMap<string, WorkAuditRow[]>;
}

export const EMPTY_ACTIONS_EXTRAS: ActionsExtras = {
  updates: new Map(),
  followUps: new Map(),
  linked: new Map(),
  escalations: new Map(),
  evidence: new Map(),
  relatedEvidence: new Map(),
  audit: new Map(),
};

/* ==========================================================================
   Operations
   ========================================================================== */

export const ACTION_OPERATIONS = [
  "assign",
  "change-date",
  "request-evidence",
  "add-update",
  "draft-reminder",
  "send-reminder",
  "complete",
  "reopen",
  "escalate",
] as const;
export type ActionOperationId = (typeof ACTION_OPERATIONS)[number];

/** The registry tools each operation runs, in order. */
export const OPERATION_TOOLS: Readonly<Record<ActionOperationId, readonly string[]>> = {
  assign: ["reassignAction"],
  "change-date": ["changeActionDueDate"],
  "request-evidence": ["requestEvidenceDocument", "addActionUpdate"],
  "add-update": ["addActionUpdate"],
  "draft-reminder": ["draftActionReminder"],
  "send-reminder": ["sendSimulatedCollaborationMessage", "addActionUpdate"],
  complete: ["completeAction"],
  reopen: ["reopenAction"],
  escalate: ["addCommitteeAgendaItem", "addActionUpdate"],
};

export interface ActionOperationView {
  id: ActionOperationId;
  label: string;
  /** The authority class of the operation's governing tool, as labelled in the product. */
  authorityLabel: string;
  enabled: boolean;
  disabledReason: string;
  /** True when the gate needs a person's approval for this change at this autonomy. */
  needsApproval: boolean;
  /** True when the change is material and the confirmation states it. */
  material: boolean;
  willChange: string;
  approval: string;
}

/* ==========================================================================
   The detail
   ========================================================================== */

export interface ActionDetail extends DetailBase {
  kind: "action";
  state: ActionState;
  materiality: Materiality;
  evidenceRequired: boolean;
  completion: {
    agreed: string | null;
    agreedNote: string | null;
    proposal: string;
  };
  owner: {
    name: string | null;
    jobTitle: string;
    external: string | null;
    unowned: boolean;
  };
  due: { date: string | null; text: string; tone: Tone };
  sources: {
    decision: RelatedLink | null;
    meeting: RelatedLink | null;
    process: RelatedLink | null;
    processNote: string | null;
    /** The inbox message the action was raised from (`source_message_id`). */
    message: RelatedLink | null;
  };
  blocker: string | null;
  latestFollowUp: { at: string; subject: string; body: string; recipients: string } | null;
  checks: {
    vague: VagueFinding[];
    duplicates: Array<DuplicateCandidate & { href: string; reasonLabel: string }>;
  };
  operations: ActionOperationView[];
  /** Internal people the action can be assigned to, excluding the current owner. */
  assignable: Array<{ id: string; label: string }>;
  /** Candidate evidence for completion: documents linked to the action or its object. */
  evidenceChoices: EvidenceRef[];
  reminderRecipient: string;
  escalationLabel: string;
  requestEvidenceHint: string;
  /** A sensible default for the change date form: seven days after the scenario day. */
  suggestedDate: string;
}

/* ==========================================================================
   Helpers
   ========================================================================== */

function inView(view: ActionViewId, state: ActionState): boolean {
  switch (view) {
    case "needs-me":
      return state.needsMe;
    case "waiting-others":
      return state.waitingOn !== null;
    case "overdue":
      return state.overdue;
    case "completed":
      return state.completed || state.cancelled;
  }
}

function statusChip(state: ActionState, language: Language): WorkChip {
  switch (state.effective) {
    case "completed":
      return { label: say(COPY.statusCompleted, language), tone: "success" };
    case "cancelled":
      return { label: say(COPY.statusCancelled, language), tone: "neutral" };
    case "blocked":
      return { label: say(COPY.statusBlocked, language), tone: "warning" };
    case "overdue":
      return { label: say(COPY.statusOverdue, language), tone: "danger" };
    case "in-progress":
      return { label: say(COPY.statusInProgress, language), tone: "info" };
    case "open":
      return { label: say(COPY.statusOpen, language), tone: "neutral" };
  }
}

function kindLabel(shared: WorkSharedData, kind: string): string {
  const label = shared.config.actionKinds[kind]?.label;
  return label ? say(label, shared.language) : kind;
}

/** Sort: most overdue first, then blocked, then nearest due date, undated last. */
function compareOpen(
  a: { row: WorkActionRow; state: ActionState },
  b: { row: WorkActionRow; state: ActionState },
): number {
  if (a.state.overdueDays !== b.state.overdueDays) return b.state.overdueDays - a.state.overdueDays;
  if (a.state.blocked !== b.state.blocked) return a.state.blocked ? -1 : 1;
  const ad = a.row.dueOn ?? "9999-12-31";
  const bd = b.row.dueOn ?? "9999-12-31";
  return ad.localeCompare(bd) || a.row.id.localeCompare(b.row.id);
}

interface Classified {
  row: WorkActionRow;
  state: ActionState;
}

function classifyAll(shared: WorkSharedData, extras: ActionsExtras): Classified[] {
  return shared.actions.map((row) => ({
    row,
    state: classifyAction(
      row,
      extras.updates.get(row.id) ?? [],
      shared.holderUserId,
      shared.scenarioDate,
      personName(shared, row.ownerUserId),
    ),
  }));
}

/* ==========================================================================
   The queue
   ========================================================================== */

export interface ActionsCounts {
  open: number;
  needsMe: number;
  waiting: number;
  overdue: number;
  blocked: number;
  completed: number;
}

export function countActions(shared: WorkSharedData, extras: ActionsExtras): ActionsCounts {
  const all = classifyAll(shared, extras);
  return {
    open: all.filter((entry) => entry.state.open).length,
    needsMe: all.filter((entry) => entry.state.needsMe).length,
    waiting: all.filter((entry) => entry.state.waitingOn !== null).length,
    overdue: all.filter((entry) => entry.state.overdue).length,
    blocked: all.filter((entry) => entry.state.blocked).length,
    completed: all.filter((entry) => entry.state.completed || entry.state.cancelled).length,
  };
}

export function buildActionsView(shared: WorkSharedData, extras: ActionsExtras, query: WorkQuery): ModuleQueueView {
  const { language, roleId } = shared;
  const all = classifyAll(shared, extras).filter((entry) =>
    matchesObject(query.object, entry.row.id, entry.row.relatedObjectId),
  );

  const view = query.actionsView;
  const inCurrentView = all.filter((entry) => inView(view, entry.state));
  const kinds = [...new Set(inCurrentView.map((entry) => entry.row.kind))].sort();
  const shown = query.kind ? inCurrentView.filter((entry) => entry.row.kind === query.kind) : inCurrentView;

  const sorted =
    view === "completed"
      ? [...shown].sort((a, b) => (b.row.completedOn ?? "").localeCompare(a.row.completedOn ?? ""))
      : [...shown].sort(compareOpen);

  const rows: QueueRowView[] = sorted.map(({ row, state }) => {
    const materiality = actionMateriality(row, shared.config, language);
    const chips: WorkChip[] = [{ label: kindLabel(shared, row.kind), tone: "neutral" }];
    if (state.unowned && state.open) chips.push({ label: say(ACTIONS_COPY.unowned, language), tone: "danger" });
    if (state.blocked) chips.push({ label: say(ACTIONS_COPY.blockedChip, language), tone: "warning" });
    if (materiality.material && state.open) chips.push({ label: say(ACTIONS_COPY.material, language), tone: "accent" });

    const owner = row.ownerLabel.trim().length > 0 ? row.ownerLabel.trim() : personName(shared, row.ownerUserId);

    return {
      id: row.id,
      kind: "action",
      lead: row.dueOn ? displayDate(row.dueOn) : say(ACTIONS_COPY.noDate, language),
      title: actionTitle(row, language),
      sub: [row.reference, owner ?? say(ACTIONS_COPY.unowned, language)].join(", "),
      chips,
      trailing: dueText(row.dueOn, state, row.completedOn, shared.scenarioDate, language),
      trailingTone: state.overdue ? "danger" : state.completed ? "success" : "neutral",
      href: workHref(roleId, query, { item: row.id }),
      selected: query.item === row.id,
      flag: state.overdue ? "danger" : state.blocked ? "warning" : null,
    };
  });

  const counts = countActions(shared, extras);
  const savedViews = ACTION_VIEWS.map((id) => ({
    id,
    label: say(ACTION_VIEW_LABELS[id], language),
    count: all.filter((entry) => inView(id, entry.state)).length,
    href: workHref(roleId, query, { actionsView: id, kind: null }),
    active: id === view,
  }));

  const filters =
    kinds.length > 1
      ? [
          {
            id: "all",
            label: say(COPY.allKinds, language),
            count: inCurrentView.length,
            href: workHref(roleId, query, { kind: null }),
            active: query.kind === null,
          },
          ...kinds.map((kind) => ({
            id: kind,
            label: kindLabel(shared, kind),
            count: inCurrentView.filter((entry) => entry.row.kind === kind).length,
            href: workHref(roleId, query, { kind }),
            active: query.kind === kind,
          })),
        ]
      : [];

  const emptyCopy = shared.actions.length === 0 ? ACTION_EMPTY.none : ACTION_EMPTY[view];

  return {
    tab: "actions",
    savedViews,
    filters,
    objectFilter: query.object
      ? {
          id: query.object,
          label: objectName(shared, query.object),
          clearHref: workHref(roleId, query, { object: null }),
        }
      : null,
    groups: rows.length > 0 ? [{ id: view, label: say(ACTION_VIEW_LABELS[view], language), rows, emptyText: null }] : [],
    empty: rows.length === 0 ? { title: say(emptyCopy.title, language), body: say(emptyCopy.body, language) } : null,
    proposals: [],
    summary: fill(say(ACTIONS_COPY.summary, language), {
      open: counts.open,
      needsMe: counts.needsMe,
      overdue: counts.overdue,
      blocked: counts.blocked,
    }),
  };
}

/* ==========================================================================
   Operations availability
   ========================================================================== */

function operationsFor(
  shared: WorkSharedData,
  row: WorkActionRow,
  state: ActionState,
  materiality: Materiality,
  evidenceRequired: boolean,
  escalated: WorkCommitteeItemRow | null,
): ActionOperationView[] {
  const { language, gate } = shared;
  const hasRecipient = row.ownerUserId !== null || row.ownerLabel.trim().length > 0;
  const escalation = shared.config.professionalActions.escalation;

  const spec: Record<ActionOperationId, { label: string; willChange: string; blockedBy: string | null }> = {
    assign: {
      label: say(ACTIONS_COPY.opAssign, language),
      willChange: say(ACTIONS_COPY.willAssign, language),
      blockedBy: state.open ? null : say(ACTIONS_COPY.notOpen, language),
    },
    "change-date": {
      label: say(ACTIONS_COPY.opChangeDate, language),
      willChange: say(ACTIONS_COPY.willChangeDate, language),
      blockedBy: state.open ? null : say(ACTIONS_COPY.notOpen, language),
    },
    "request-evidence": {
      label: say(ACTIONS_COPY.opRequestEvidence, language),
      willChange: say(ACTIONS_COPY.willRequestEvidence, language),
      blockedBy: state.open ? null : say(ACTIONS_COPY.notOpen, language),
    },
    "add-update": {
      label: say(ACTIONS_COPY.opAddUpdate, language),
      willChange: say(ACTIONS_COPY.willAddUpdate, language),
      blockedBy: state.open ? null : say(ACTIONS_COPY.notOpen, language),
    },
    "draft-reminder": {
      label: say(ACTIONS_COPY.opDraftReminder, language),
      willChange: say(ACTIONS_COPY.willDraft, language),
      blockedBy: !state.open ? say(ACTIONS_COPY.notOpen, language) : hasRecipient ? null : say(ACTIONS_COPY.noRecipient, language),
    },
    "send-reminder": {
      label: say(ACTIONS_COPY.opSendReminder, language),
      willChange: say(ACTIONS_COPY.willSend, language),
      blockedBy: !state.open ? say(ACTIONS_COPY.notOpen, language) : hasRecipient ? null : say(ACTIONS_COPY.noRecipient, language),
    },
    complete: {
      label: say(evidenceRequired ? ACTIONS_COPY.opComplete : ACTIONS_COPY.opCompleteNoEvidence, language),
      willChange: say(ACTIONS_COPY.willComplete, language),
      blockedBy: state.open ? null : say(ACTIONS_COPY.notOpen, language),
    },
    reopen: {
      label: say(ACTIONS_COPY.opReopen, language),
      willChange: say(ACTIONS_COPY.willReopen, language),
      blockedBy: state.completed ? null : say(ACTIONS_COPY.notCompleted, language),
    },
    escalate: {
      label: say(ACTIONS_COPY.opEscalate, language),
      willChange: fill(say(ACTIONS_COPY.willEscalate, language), { committee: say(escalation.label, language) }),
      blockedBy: !state.open
        ? say(ACTIONS_COPY.notOpen, language)
        : escalated
          ? fill(say(ACTIONS_COPY.alreadyEscalated, language), { committee: escalated.committeeRef })
          : null,
    },
  };

  return ACTION_OPERATIONS.map((id) => {
    const tools = OPERATION_TOOLS[id];
    const verdicts = tools
      .map((tool) => gate[tool])
      .filter((verdict): verdict is NonNullable<typeof verdict> => verdict !== undefined);
    const governing = verdicts[0];
    const unreachable = verdicts.find((verdict) => !verdict.reachable);
    /*
     * A tool the gate has no verdict for is treated as unavailable rather
     * than as allowed. The gate refuses an unknown tool, so offering the
     * operation would only lead to a refusal after the person had filled in
     * the form.
     */
    const gateReason =
      verdicts.length < tools.length
        ? say(ACTIONS_COPY.notRegistered, language)
        : unreachable
          ? unreachable.reason
          : "";
    const needsApproval = verdicts.some((verdict) => verdict.needsApproval);
    const isDraft = governing?.authorityClass === "DRAFT";
    const entry = spec[id];
    const disabledReason = entry.blockedBy ?? gateReason;

    return {
      id,
      label: entry.label,
      authorityLabel: governing ? say(AUTHORITY_LABELS[governing.authorityClass], language) : "",
      enabled: disabledReason.length === 0,
      disabledReason,
      needsApproval,
      material: materiality.material && (id === "complete" || id === "change-date" || id === "assign" || id === "reopen"),
      willChange: entry.willChange,
      approval: isDraft
        ? say(ACTIONS_COPY.approvalDraft, language)
        : needsApproval
          ? say(ACTIONS_COPY.approvalYours, language)
          : say(ACTIONS_COPY.approvalNone, language),
    };
  });
}

/* ==========================================================================
   Resolving one action
   ========================================================================== */

function historyEntries(
  shared: WorkSharedData,
  row: WorkActionRow,
  updates: readonly WorkActionUpdateRow[],
): ActivityEntry[] {
  const { language } = shared;
  const entries: ActivityEntry[] = [];

  /*
   * The progress note on the action row is the latest note the source system
   * held before today. It is shown as the first entry, attributed to the
   * record rather than to a person, because the seed does not say who wrote
   * it and inventing an author would be the kind of fake activity the plan
   * forbids.
   */
  if (row.progressNote.trim().length > 0) {
    entries.push({
      id: `${row.id}-recorded`,
      at: say(ACTIONS_COPY.recordedBefore, language),
      actor: say(ACTIONS_COPY.onRecord, language),
      text: row.progressNote,
      tone: "neutral",
      evidenceIds: [],
      label: say(ACTIONS_COPY.recordedBefore, language),
    });
  }

  for (const update of updates) {
    const kind = kindOfEntry(update);
    const actor =
      update.authorKind === "human"
        ? (personName(shared, update.authorUserId) ?? say({ en: "A person", de: "Eine Person" }, language))
        : update.authorKind === "ai"
          ? say({ en: "AI Partner", de: "KI Partner" }, language)
          : say({ en: "System", de: "System" }, language);
    const tone: Tone =
      kind === "CMP" ? "success" : kind === "BLK" ? "warning" : kind === "ESC" ? "danger" : kind === "REO" ? "info" : "neutral";
    entries.push({
      id: update.id,
      at: update.at.length >= 16 ? `${displayDate(update.at)} ${update.at.slice(11, 16)}` : update.at,
      actor,
      text: update.note,
      tone,
      evidenceIds: update.evidenceIds,
      label: say(ENTRY_LABELS[kind], language),
    });
  }

  return entries;
}

/** Builds the detail for one action, or null when it is not one of this role's actions. */
export function resolveActionDetail(
  itemId: string,
  shared: WorkSharedData,
  extras: ActionsExtras,
  query: WorkQuery,
): ActionDetail | null {
  const row = shared.actions.find((candidate) => candidate.id === itemId);
  if (!row) return null;

  const { language, roleId, config } = shared;
  const updates = extras.updates.get(row.id) ?? [];
  const ownerName = personName(shared, row.ownerUserId);
  const state = classifyAction(row, updates, shared.holderUserId, shared.scenarioDate, ownerName);
  const materiality = actionMateriality(row, config, language);
  const evidenceRequired = evidenceRequiredToComplete(row.kind, config);
  const title = actionTitle(row, language);
  const kindName = kindLabel(shared, row.kind);
  const objectLabel = objectName(shared, row.relatedObjectId);
  const objectKind = objectKindLabel(shared, row.relatedObjectKind);

  /*
   * Completion condition: the action's recorded condition, as a person
   * agreed it. A history whose agreeing entry predates the column is still
   * read, so an agreement is never lost to the change. Then the proposal.
   */
  const agreedEntry = [...updates].reverse().find((update) => kindOfEntry(update) === "CC" && update.authorKind === "human");
  const agreed = row.completionCondition
    ? { note: row.completionCondition, authorUserId: row.completionConditionBy, at: row.completionConditionAt ?? "" }
    : agreedEntry
      ? { note: agreedEntry.note, authorUserId: agreedEntry.authorUserId, at: agreedEntry.at }
      : null;
  const proposal = proposedCompletionCondition(row, row.relatedObjectId ?? objectLabel, config, language);

  /*
   * Sources. Only what exists. The meeting and the process stage are the
   * action's recorded lineage (`source_meeting_id`, `source_process_run_id`
   * and its stage). An action without recorded lineage keeps the earlier
   * readings, labelled as what they are: the minutes that list it, and the
   * running process whose scope holds its object.
   */
  const sourceDecision = row.sourceDecisionId
    ? shared.decisions.find((decision) => decision.id === row.sourceDecisionId)
    : undefined;
  const minutes =
    (row.sourceMinutesId ? shared.minutes.find((entry) => entry.id === row.sourceMinutesId) : undefined) ??
    shared.minutes.find((entry) => entry.actionIds.includes(row.id));
  const sourceMeetingId = row.sourceMeetingId ?? minutes?.meetingId ?? null;
  const minutesMeeting = sourceMeetingId ? shared.meetings.find((meeting) => meeting.id === sourceMeetingId) : undefined;
  const recordedScope = row.sourceProcessRunId
    ? (shared.processScopes.find((candidate) => candidate.roleAppRunId === row.sourceProcessRunId) ?? null)
    : null;
  const scope = recordedScope ?? findProcessFor([row.relatedObjectId, row.id], shared.processScopes);

  const sourceLinks = {
    decision: sourceDecision
      ? decisionLink(roleId, sourceDecision.id, decisionTitle(sourceDecision, language), say(ACTIONS_COPY.sourceDecision, language))
      : row.sourceDecisionId
        ? decisionLink(roleId, row.sourceDecisionId, row.sourceDecisionId, say(ACTIONS_COPY.sourceDecision, language))
        : null,
    meeting: minutesMeeting
      ? meetingLink(roleId, minutesMeeting.id, meetingTitle(minutesMeeting, language), say(ACTIONS_COPY.sourceMeeting, language))
      : null,
    process: scope ? processLink(scope, language, recordedScope ? (row.sourceStageId ?? null) : null) : null,
    processNote: recordedScope
      ? say(ACTIONS_COPY.processRecorded, language)
      : scope
        ? fill(say(ACTIONS_COPY.processInScope, language), { object: row.relatedObjectId ?? row.id })
        : null,
    /* Recorded lineage from the inbox; the message is linked even when the clock has not revealed it to this role. */
    message: row.sourceMessageId
      ? (() => {
          const message = shared.messages.find((candidate) => candidate.id === row.sourceMessageId);
          return messageLink(roleId, row.sourceMessageId, message ? messageSubject(message, language) : row.sourceMessageId, say(COPY.sourceMessage, language));
        })()
      : null,
  };

  /* Evidence: cited in the history first, then documents on the action's object. */
  const cited = new Map<string, EvidenceRef>();
  for (const update of updates) {
    for (const evidenceId of update.evidenceIds) {
      const doc = extras.evidence.get(evidenceId);
      if (doc && !cited.has(doc.id)) {
        cited.set(doc.id, evidenceRef(doc, say({ en: "Cited in the history", de: "Im Verlauf zitiert" }, language), language));
      }
    }
  }
  const onObject = (row.relatedObjectId ? (extras.relatedEvidence.get(row.relatedObjectId) ?? []) : [])
    .filter((doc) => !cited.has(doc.id))
    .slice(0, 8)
    .map((doc) =>
      evidenceRef(doc, fill(say({ en: "Linked to {object}", de: "Verknuepft mit {object}" }, language), { object: row.relatedObjectId ?? "" }), language),
    );
  const evidence = [...cited.values(), ...onObject];

  /* Linked work. */
  const linkedActions = extras.linked.get(row.id) ?? [];
  const escalations = extras.escalations.get(row.id) ?? [];
  const relatedDecisions = shared.decisions.filter(
    (decision) => row.relatedObjectId !== null && decision.relatedObjectId === row.relatedObjectId && decision.id !== row.sourceDecisionId,
  );
  const relatedMeetings = shared.meetings.filter(
    (meeting) => row.relatedObjectId !== null && meeting.subjectId === row.relatedObjectId && meeting.id !== minutesMeeting?.id,
  );
  const sourceMessages = shared.messages.filter(
    (message) => message.linkedActionId === row.id || (message.relatedObjectKind === "action" && message.relatedObjectId === row.id),
  );
  const audit: AuditRef[] = (extras.audit.get(row.id) ?? []).map((entry) => ({
    id: entry.id,
    at: entry.atMoment,
    summary: entry.summary,
    actor: personName(shared, entry.actorUserId) ?? entry.actorKind,
    blocked: entry.blocked,
  }));

  const related = compactLinks([
    sourceLinks.process,
    sourceLinks.decision,
    ...relatedDecisions.map((decision) => decisionLink(roleId, decision.id, decisionTitle(decision, language), say(COPY.relatedDecision, language))),
    sourceLinks.meeting,
    ...relatedMeetings.map((meeting) => meetingLink(roleId, meeting.id, meetingTitle(meeting, language), say(COPY.relatedMeeting, language))),
    ...linkedActions.map((linked) => actionLink(roleId, linked.id, actionTitle(linked, language), say(COPY.relatedAction, language))),
    sourceLinks.message,
    ...sourceMessages.map((message) => messageLink(roleId, message.id, messageSubject(message, language), say(COPY.sourceMessage, language))),
    row.relatedObjectId ? objectLink(roleId, row.relatedObjectId, objectLabel, objectKind, language) : null,
    evidenceLink(evidence.length, language),
    auditLink(audit.length, language),
  ]);

  /* Follow-up: the latest simulated message about this action. */
  const followUps = extras.followUps.get(row.id) ?? [];
  const lastFollowUp = followUps.length > 0 ? followUps[followUps.length - 1] : undefined;

  /* AI checks. Proposals only. */
  const duplicates = duplicateCandidates(row, shared.actions).map((candidate) => ({
    ...candidate,
    href: workHref(roleId, query, { item: candidate.id }),
    reasonLabel:
      candidate.reason === "same-object"
        ? say(ACTIONS_COPY.duplicateSameObject, language)
        : say(ACTIONS_COPY.duplicateSimilarTitle, language),
  }));

  const ownerPerson = row.ownerUserId ? shared.people.get(row.ownerUserId) : undefined;
  const external = row.ownerLabel.trim().length > 0 ? row.ownerLabel.trim() : null;

  const facts: DetailFact[] = [
    { label: say(COPY.factReference, language), value: row.reference, mono: true },
    { label: say({ en: "Kind", de: "Art" }, language), value: kindName },
    {
      label: say(COPY.factOwner, language),
      value: ownerName
        ? `${ownerName}${ownerPerson?.jobTitle ? `, ${ownerPerson.jobTitle}` : ""}`
        : say(ACTIONS_COPY.unowned, language),
      tone: state.unowned ? "danger" : "neutral",
    },
    ...(external ? [{ label: say({ en: "Delivered by", de: "Geliefert durch" }, language), value: external }] : []),
    {
      label: say(COPY.factDue, language),
      value: row.dueOn
        ? `${displayDate(row.dueOn)}, ${dueText(row.dueOn, state, row.completedOn, shared.scenarioDate, language)}`
        : say(ACTIONS_COPY.noDate, language),
      tone: state.overdue ? "danger" : "neutral",
    },
    { label: say(COPY.factEntity, language), value: row.entityId, mono: true },
  ];

  const escalated = escalations[0] ?? null;

  return {
    kind: "action",
    id: row.id,
    reference: row.reference,
    title,
    kindLabel: say(KIND_LABELS.action, language),
    homeTab: "actions",
    homeHref: workHref(roleId, query, { tab: "actions", item: row.id }),
    status: statusChip(state, language),
    facts,
    context: row.description,
    evidence,
    related,
    activity: historyEntries(shared, row, updates),
    audit,
    freshness: sourceFreshness(evidence, language),
    ai: directAiContext("action", row.id, title, say(KIND_LABELS.action, language), language),

    state,
    materiality,
    evidenceRequired,
    completion: {
      agreed: agreed?.note ?? null,
      agreedNote: agreed
        ? fill(say(ACTIONS_COPY.conditionAgreedBy, language), {
            person: personName(shared, agreed.authorUserId) ?? "",
            date: agreed.at ? displayDate(agreed.at) : "",
          })
        : null,
      proposal,
    },
    owner: {
      name: ownerName,
      jobTitle: ownerPerson?.jobTitle ?? "",
      external,
      unowned: state.unowned,
    },
    due: {
      date: row.dueOn,
      text: dueText(row.dueOn, state, row.completedOn, shared.scenarioDate, language),
      tone: state.overdue ? "danger" : "neutral",
    },
    sources: sourceLinks,
    blocker: state.blockerNote,
    latestFollowUp: lastFollowUp
      ? {
          at: lastFollowUp.sentAtMoment,
          subject: lastFollowUp.subject,
          body: firstLine(lastFollowUp.body, 200),
          recipients: lastFollowUp.toUserIds.map((id) => personName(shared, id) ?? id).join(", "),
        }
      : null,
    checks: { vague: vagueWording(row.title, language), duplicates },
    operations: operationsFor(shared, row, state, materiality, evidenceRequired, escalated),
    assignable: shared.assignable
      .filter((person) => person.id !== row.ownerUserId)
      .map((person) => ({ id: person.id, label: `${person.name}, ${person.jobTitle}` })),
    evidenceChoices: evidence,
    reminderRecipient: external ?? ownerName ?? say(shared.config.professionalActions.reminderRecipient, language),
    escalationLabel: say(shared.config.professionalActions.escalation.label, language),
    requestEvidenceHint: say(shared.config.professionalActions.requestEvidenceHint, language),
    suggestedDate: addDays(shared.scenarioDate, 7),
  };
}

/** The tab label, for the shell. */
export function actionsTabLabel(language: Language): string {
  return say(TAB_LABELS.actions, language);
}

/** Verdicts the module needs from the gate, for the hub to evaluate. */
export function actionToolNames(): string[] {
  return [...new Set(Object.values(OPERATION_TOOLS).flat())];
}

export type { GateView };
