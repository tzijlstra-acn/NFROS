/**
 * The AI Partner's durable working context (plan 4.11, Persistent context).
 *
 * Server only. The workday frame tells the Partner what the person is looking
 * at (`PartnerFocusInput`: the route, the Home selection, the Work Hub item,
 * the process stage, the decision in front of them), and this module resolves
 * that into the complete context and keeps it in `partner_contexts`, outside
 * the chat transcript:
 *
 *   role and legal entity             the role's own;
 *   selected object                   what was selected, else what the
 *                                     selected work item is about;
 *   process run and stage             the stage on screen, else the stage a
 *                                     meeting or decision serves, else the
 *                                     running process that covers the object;
 *   meeting, action, inbox item,      the Work Hub item and what it links to;
 *   decision
 *   source freshness                  the systems the selected object was read
 *                                     from, with their freshness;
 *   prior human decisions             recorded decisions on the same object or
 *                                     process run;
 *   user edits                        records a person changed on the
 *                                     objects in context.
 *
 * References only. A field the focus does not name is cleared rather than
 * kept, so the context is always what is on screen now, and only the chat
 * thread survives every change, which is what makes the conversation
 * survive navigation.
 */

import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { auditEvents, DEFAULT_RUN_ID, type RoleId } from "@/db/schema/core";
import { decisions } from "@/db/schema/decisions";
import { calendarEvents, inboxMessages, meetings } from "@/db/schema/work";
import { actions } from "@/db/schema/decisions";
import type { PartnerSourceFreshness, PartnerUserEdit } from "@/db/schema/ai-partner";
import { getPartnerContext, savePartnerContext, type PartnerContextRow } from "@/db/repositories/partner-context";
import { getSourceAttributions } from "@/db/repositories/partner";
import { getEntity, getRole } from "@/db/repositories/workday";
import { getProcessScopes, getObjectLabels } from "@/db/repositories/work-hub";
import type { ScenarioState } from "@/scenario/engine/state";
import { momentToMinutes } from "@/domain/nfr/calculators";

const db = () => getDb();

export const FOCUS_SURFACES = ["home", "work", "processes", "decisions", "other"] as const;
export type FocusSurface = (typeof FOCUS_SURFACES)[number];

/** What the frame reports. Every field is checked against the database before it is kept. */
export interface PartnerFocusInput {
  surface: FocusSurface;
  selection: { objectType: string; objectId: string } | null;
  workItem: { kind: "event" | "meeting" | "action" | "message"; id: string } | null;
  process: { slug: string; stageId: string | null } | null;
  decisionId: string | null;
  chatThreadId: string | null;
}

/** The context as the dock shows it. */
export interface PartnerContextView {
  version: number;
  updatedAtMoment: string;
  roleLabel: string;
  entityLabel: string | null;
  selected: { kind: string; id: string; label: string } | null;
  stage: { processRunId: string; stageId: string; label: string } | null;
  meetingId: string | null;
  actionId: string | null;
  inboxMessageId: string | null;
  decisionId: string | null;
  sources: { current: number; stale: number; unavailable: number };
  priorDecisionIds: string[];
  userEditCount: number;
}

type Fields = Parameters<typeof savePartnerContext>[0]["fields"];

/** Resolves a focus into the full context, reading only. */
export function resolvePartnerContext(roleId: RoleId, focus: PartnerFocusInput, state: ScenarioState): Fields {
  const runId = state.runId ?? DEFAULT_RUN_ID;
  const role = getRole(roleId, runId);

  let meetingId: string | null = null;
  let actionId: string | null = null;
  let inboxMessageId: string | null = null;
  let decisionId: string | null = focus.decisionId;
  let selected: { kind: string; id: string } | null = focus.selection ? { kind: focus.selection.objectType, id: focus.selection.objectId } : null;
  let processRunId: string | null = null;
  let stageId: string | null = null;

  if (focus.workItem) {
    const { kind, id } = focus.workItem;
    if (kind === "meeting" || kind === "event") {
      const meetingRow =
        kind === "meeting"
          ? db().select().from(meetings).where(and(eq(meetings.runId, runId), eq(meetings.id, id))).get()
          : (() => {
              const entry = db().select().from(calendarEvents).where(and(eq(calendarEvents.runId, runId), eq(calendarEvents.id, id))).get();
              const linked = entry?.meetingId ?? null;
              return linked ? db().select().from(meetings).where(and(eq(meetings.runId, runId), eq(meetings.id, linked))).get() : undefined;
            })();
      if (meetingRow && meetingRow.roleId === roleId) {
        meetingId = meetingRow.id;
        selected ??= meetingRow.subjectKind && meetingRow.subjectId ? { kind: meetingRow.subjectKind, id: meetingRow.subjectId } : null;
        processRunId = meetingRow.processRunId;
        stageId = meetingRow.stageId;
      }
    } else if (kind === "action") {
      const row = db().select().from(actions).where(and(eq(actions.runId, runId), eq(actions.id, id))).get();
      if (row) {
        actionId = row.id;
        selected ??= row.relatedObjectKind && row.relatedObjectId ? { kind: row.relatedObjectKind, id: row.relatedObjectId } : { kind: "action", id: row.id };
        decisionId ??= row.sourceDecisionId;
        processRunId = row.sourceProcessRunId;
        stageId = row.sourceStageId;
      }
    } else {
      const row = db().select().from(inboxMessages).where(and(eq(inboxMessages.runId, runId), eq(inboxMessages.id, id))).get();
      if (row && row.roleId === roleId) {
        inboxMessageId = row.id;
        selected ??= row.relatedObjectKind && row.relatedObjectId ? { kind: row.relatedObjectKind, id: row.relatedObjectId } : null;
        decisionId ??= row.linkedDecisionId;
        actionId ??= row.linkedActionId;
      }
    }
  }

  if (decisionId) {
    const row = db().select().from(decisions).where(and(eq(decisions.runId, runId), eq(decisions.id, decisionId))).get();
    // Only a decision the role can see at the clock, as the Decisions queue shows it.
    if (row && row.roleId === roleId && momentToMinutes(row.presentedAtMoment) <= momentToMinutes(state.currentMoment)) {
      selected ??= row.relatedObjectKind && row.relatedObjectId ? { kind: row.relatedObjectKind, id: row.relatedObjectId } : null;
      processRunId ??= row.processRunId;
      stageId ??= row.processStageId;
    } else {
      decisionId = null;
    }
  }

  const scopes = getProcessScopes(roleId, runId);
  if (focus.process) {
    const scope = scopes.find((entry) => entry.entryRoute?.endsWith(`/${focus.process?.slug}`));
    if (scope) {
      processRunId = scope.roleAppRunId;
      stageId = focus.process.stageId && scope.stageNames[focus.process.stageId] ? focus.process.stageId : scope.currentStageId;
      selected ??= { kind: scope.subjectKind, id: scope.subjectId };
    }
  }
  if (!processRunId && selected) {
    const scope = scopes.find((entry) => entry.status !== "completed" && entry.scopeIds.includes(selected?.id ?? ""));
    if (scope) {
      processRunId = scope.roleAppRunId;
      stageId = scope.currentStageId;
    }
  }

  const sourceFreshness: PartnerSourceFreshness[] = selected
    ? getSourceAttributions(selected.kind, selected.id, runId).map((source) => ({
        sourceKey: source.connectorInstanceId,
        connectorInstanceId: source.connectorInstanceId,
        state: source.loadState === "error" ? "unavailable" : (source.freshness as PartnerSourceFreshness["state"]),
        asOf: source.lastUpdated,
      }))
    : [];

  const priorDecisionIds = db()
    .select({ id: decisions.id, relatedObjectId: decisions.relatedObjectId, processRunId: decisions.processRunId })
    .from(decisions)
    .where(and(eq(decisions.runId, runId), eq(decisions.roleId, roleId), eq(decisions.status, "decided")))
    .all()
    .filter((row) => (selected !== null && row.relatedObjectId === selected.id) || (processRunId !== null && row.processRunId === processRunId))
    .map((row) => row.id)
    .slice(0, 8);

  const edited = [meetingId, actionId, inboxMessageId, decisionId, selected?.id ?? null].filter((id): id is string => id !== null);
  const userEdits: PartnerUserEdit[] =
    edited.length === 0
      ? []
      : db()
          .select({ objectKind: auditEvents.objectKind, objectId: auditEvents.objectId, at: auditEvents.recordedAt })
          .from(auditEvents)
          .where(and(eq(auditEvents.runId, runId), eq(auditEvents.actorKind, "human"), eq(auditEvents.category, "mutation"), inArray(auditEvents.objectId, edited)))
          .orderBy(desc(auditEvents.recordedAt))
          .limit(10)
          .all()
          .map((row) => ({ objectKind: row.objectKind, objectId: row.objectId, version: null, at: row.at }));

  return {
    legalEntityId: role?.entityId ?? null,
    selectedObjectKind: selected?.kind ?? null,
    selectedObjectId: selected?.id ?? null,
    processRunId,
    stageId,
    meetingId,
    actionId,
    inboxMessageId,
    decisionId,
    ...(focus.chatThreadId ? { chatThreadId: focus.chatThreadId } : {}),
    sourceFreshness,
    priorDecisionIds,
    userEdits,
  };
}

/** True when the stored context already says what the resolved one says. */
function unchanged(row: PartnerContextRow | undefined, fields: Fields): boolean {
  if (!row) return false;
  return Object.entries(fields).every(([key, value]) => JSON.stringify((row as Record<string, unknown>)[key] ?? null) === JSON.stringify(value ?? null));
}

/** Resolves and keeps the focus. Writes only when something changed. */
export function syncPartnerContext(roleId: RoleId, focus: PartnerFocusInput, state: ScenarioState): PartnerContextRow | null {
  const runId = state.runId ?? DEFAULT_RUN_ID;
  const holder = getRole(roleId, runId)?.holderUserId;
  if (!holder) return null;
  const fields = resolvePartnerContext(roleId, focus, state);
  const existing = getPartnerContext(holder, roleId, runId);
  if (unchanged(existing, fields)) return existing ?? null;
  return savePartnerContext({ userId: holder, roleId, fields, updatedAt: new Date().toISOString(), updatedAtMoment: state.currentMoment, runId });
}

/** The person's context in a role, for the dock. Null before the first focus. */
export function readPartnerContextView(roleId: RoleId, state: ScenarioState): PartnerContextView | null {
  const runId = state.runId ?? DEFAULT_RUN_ID;
  const role = getRole(roleId, runId);
  if (!role) return null;
  const row = getPartnerContext(role.holderUserId, roleId, runId);
  if (!row) return null;
  const language = state.language;
  const labels = getObjectLabels(runId);
  const label = (id: string) => {
    const pair = labels.get(id);
    return pair ? (language === "de" ? pair.de : pair.en) : id;
  };
  const scope = row.processRunId ? getProcessScopes(roleId, runId).find((entry) => entry.roleAppRunId === row.processRunId) : undefined;
  const stageName = scope && row.stageId ? scope.stageNames[row.stageId] : undefined;
  const entity = row.legalEntityId ? getEntity(row.legalEntityId, runId) : undefined;
  return {
    version: row.version,
    updatedAtMoment: row.updatedAtMoment,
    roleLabel: language === "de" ? role.titleDe : role.title,
    entityLabel: entity?.shortName ?? null,
    selected: row.selectedObjectKind && row.selectedObjectId ? { kind: row.selectedObjectKind, id: row.selectedObjectId, label: label(row.selectedObjectId) } : null,
    stage:
      row.processRunId && row.stageId
        ? { processRunId: row.processRunId, stageId: row.stageId, label: stageName ? (language === "de" ? stageName.de : stageName.en) : row.stageId }
        : null,
    meetingId: row.meetingId,
    actionId: row.actionId,
    inboxMessageId: row.inboxMessageId,
    decisionId: row.decisionId,
    sources: {
      current: row.sourceFreshness.filter((source) => source.state !== "stale" && source.state !== "unavailable").length,
      stale: row.sourceFreshness.filter((source) => source.state === "stale").length,
      unavailable: row.sourceFreshness.filter((source) => source.state === "unavailable").length,
    },
    priorDecisionIds: row.priorDecisionIds,
    userEditCount: row.userEdits.length,
  };
}
