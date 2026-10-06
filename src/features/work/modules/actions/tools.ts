/**
 * Tool handlers for the Work Hub's governed operations.
 *
 * Every write the hub performs is one of these handlers or one that already
 * existed in `src/agents/tools/mutations.ts`, and every handler is reached
 * only through `executeTool`, which means the authority gate has already run
 * and, for a material tool, a person's payload bound approval has been found
 * and will be consumed. The handlers do not check authority themselves, for
 * the reason `mutations.ts` gives: a second, differently written check would
 * eventually disagree with the gate.
 *
 * They do check the facts the gate cannot see. The gate knows that
 * `completeAction` is material; it does not know whether this action's kind
 * needs evidence to close, whether the evidence cited exists, or whether the
 * meeting being recorded as held has started yet. A handler that would write
 * something untrue throws, the runtime records the call as failed, and the
 * person sees that nothing changed.
 *
 * Progress entries are only ever inserted. No handler here updates or deletes
 * a row in `action_updates`.
 */

import { and, desc, eq } from "drizzle-orm";
import { getDb, getSqlite } from "@/db/client";
import { actions } from "@/db/schema/decisions";
import { actionUpdates } from "@/db/schema/role-app-runtime";
import { calendarEvents, meetings } from "@/db/schema/work";
import {
  hasToolHandler,
  registerToolHandler,
  type ToolContext,
  type ToolHandler,
  type ToolHandlerResult,
} from "@/agents/tools/runtime";
import { requireScenarioState } from "@/scenario/engine/state";
import { getWorkRoleConfig } from "../../roles";
import { displayDate, firstLine, timeOf, minutesOf } from "../../model";
import {
  composeReminder,
  evidenceRequiredToComplete,
  kindOfEntry,
  newEntryId,
  proposedCompletionCondition,
  type EntryKind,
} from "./policy";

const db = () => getDb();

/**
 * Registers once per process.
 *
 * The runtime refuses a second registration of the same tool, which is the
 * right rule for a typo and the wrong one for a development server that
 * re-evaluates this module after an edit. The guard keeps the first handler;
 * a restart picks up a changed one.
 */
function register(toolName: string, handler: ToolHandler): void {
  if (hasToolHandler(toolName)) return;
  registerToolHandler(toolName, handler);
}

type ActionRow = typeof actions.$inferSelect;

function str(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  return typeof value === "string" ? value.trim() : "";
}

function requireText(payload: Record<string, unknown>, key: string, label: string, max = 2000): string {
  const value = str(payload, key);
  if (value.length === 0) throw new Error(`${label} is required, so nothing was written.`);
  if (value.length > max) throw new Error(`${label} is longer than ${max} characters, so nothing was written.`);
  return value;
}

function stringList(payload: Record<string, unknown>, key: string): string[] {
  const value = payload[key];
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0).map((entry) => entry.trim()))];
}

function loadAction(context: ToolContext, actionId: string): ActionRow {
  const row = db()
    .select()
    .from(actions)
    .where(and(eq(actions.runId, context.runId), eq(actions.id, actionId)))
    .get();
  if (!row) {
    throw new Error(`The action "${actionId}" does not exist, so nothing was written.`);
  }
  return row;
}

function requireOpen(row: ActionRow): void {
  if (row.status === "completed" || row.status === "cancelled") {
    throw new Error(`The action ${row.id} is ${row.status}. Reopen it before changing it, so the history stays in order.`);
  }
}

/** The status the latest entry left the action in, which carries a blocker forward. */
function latestStatusAfter(context: ToolContext, actionId: string): string | null {
  const latest = db()
    .select()
    .from(actionUpdates)
    .where(and(eq(actionUpdates.runId, context.runId), eq(actionUpdates.actionId, actionId)))
    .orderBy(desc(actionUpdates.at), desc(actionUpdates.id))
    .limit(1)
    .get();
  return latest?.statusAfter ?? null;
}

/** The status an entry should record: still blocked if it was, otherwise the row's. */
export function carriedStatus(context: ToolContext, row: ActionRow, rowStatus: string): string {
  return row.blockedReason !== null || latestStatusAfter(context, row.id) === "blocked" ? "blocked" : rowStatus;
}

function assertEvidenceExists(context: ToolContext, ids: readonly string[]): void {
  const sqlite = getSqlite();
  for (const id of ids) {
    const row = sqlite
      .prepare("select count(*) as n from evidence_documents where run_id = ? and id = ?")
      .get(context.runId, id) as { n: number } | undefined;
    if ((row?.n ?? 0) === 0) {
      throw new Error(`The evidence "${id}" does not exist, so the entry was not written. A citation to a missing document would read as support it does not give.`);
    }
  }
}

export function insertEntry(
  context: ToolContext,
  input: { actionId: string; kind: EntryKind; note: string; evidenceIds: string[]; statusAfter: string; authorKind?: string; at?: string },
): string {
  const id = newEntryId(input.kind);
  db()
    .insert(actionUpdates)
    .values({
      id,
      runId: context.runId,
      actionId: input.actionId,
      at: input.at ?? new Date().toISOString(),
      authorUserId: context.actingUserId,
      authorKind: input.authorKind ?? (context.actorKind === "human" ? "human" : "ai"),
      note: input.note,
      evidenceIds: input.evidenceIds,
      statusAfter: input.statusAfter,
      kind: input.kind,
    })
    .run();
  return id;
}

function scenarioDate(context: ToolContext): string {
  return requireScenarioState(context.runId).scenarioDate;
}

function userName(userId: string | null): string {
  if (!userId) return "no owner";
  const row = getSqlite().prepare("select name from users where id = ?").get(userId) as { name: string } | undefined;
  return row?.name ?? userId;
}

/* ==========================================================================
   Draft
   ========================================================================== */

register("draftActionReminder", (payload, context): ToolHandlerResult => {
  const row = loadAction(context, requireText(payload, "actionId", "The action"));
  const config = getWorkRoleConfig(context.roleId);
  if (!config) throw new Error(`The role ${context.roleId} has no Work Hub configuration.`);

  const agreed =
    row.completionCondition ??
    db()
      .select()
      .from(actionUpdates)
      .where(and(eq(actionUpdates.runId, context.runId), eq(actionUpdates.actionId, row.id)))
      .orderBy(desc(actionUpdates.at), desc(actionUpdates.id))
      .all()
      .find((entry) => kindOfEntry(entry) === "CC" && entry.authorKind === "human")?.note ??
    null;

  const condition = agreed ?? proposedCompletionCondition(row, row.relatedObjectId ?? row.reference, config, context.language);
  const owner = row.ownerLabel.trim().length > 0 ? row.ownerLabel.trim() : userName(row.ownerUserId);
  const title = context.language === "de" && row.titleDe.length > 0 ? row.titleDe : row.title;
  const draft = composeReminder(
    { ownerName: owner, title, reference: row.reference, dueOn: row.dueOn, condition },
    config,
    context.language,
  );

  return {
    summary: `Reminder drafted for ${row.id}. Nothing was sent.`,
    objectKind: "action",
    objectId: row.id,
    data: draft,
  };
});

/* ==========================================================================
   Append-only progress
   ========================================================================== */

const UPDATE_KINDS: readonly EntryKind[] = ["UPD", "CC", "RMD", "REQ", "ESC"];

register("addActionUpdate", (payload, context): ToolHandlerResult => {
  const row = loadAction(context, requireText(payload, "actionId", "The action"));
  requireOpen(row);
  const note = requireText(payload, "note", "The update");
  const evidenceIds = stringList(payload, "evidenceIds");
  assertEvidenceExists(context, evidenceIds);

  const blocker = str(payload, "blocker");
  const requested = str(payload, "entryKind") as EntryKind;
  const kind: EntryKind =
    blocker === "set" ? "BLK" : blocker === "clear" ? "UNB" : UPDATE_KINDS.includes(requested) ? requested : "UPD";

  const statusAfter =
    blocker === "set" ? "blocked" : blocker === "clear" ? row.status : carriedStatus(context, row, row.status);

  /*
   * The entry and the structured state it changes are written together: a
   * blocker sets `blocked_reason`, lifting it clears it, and an agreed
   * completion condition becomes the action's `completion_condition`. The
   * entry stays the history of who changed it; the column is the value.
   */
  const at = new Date().toISOString();
  const write = getSqlite().transaction(() => {
    const id = insertEntry(context, { actionId: row.id, kind, note, evidenceIds, statusAfter, at });
    const where = and(eq(actions.runId, context.runId), eq(actions.id, row.id));
    if (kind === "BLK") db().update(actions).set({ blockedReason: note, blockedSince: at }).where(where).run();
    if (kind === "UNB") db().update(actions).set({ blockedReason: null, blockedSince: null }).where(where).run();
    if (kind === "CC" && context.actorKind === "human") {
      db()
        .update(actions)
        .set({ completionCondition: note, completionConditionBy: context.actingUserId, completionConditionAt: at })
        .where(where)
        .run();
    }
    return id;
  });
  const entryId = write();

  return {
    summary: `Progress entry ${entryId} appended to ${row.id}.`,
    objectKind: "action",
    objectId: row.id,
    evidenceIds,
    data: { entryId, statusAfter },
    receiptStatements: [`History entry added to ${row.id}`],
  };
});

/* ==========================================================================
   Material changes
   ========================================================================== */

register("reassignAction", (payload, context): ToolHandlerResult => {
  const row = loadAction(context, requireText(payload, "actionId", "The action"));
  requireOpen(row);
  const ownerUserId = str(payload, "ownerUserId");
  const reason = requireText(payload, "reason", "A reason");

  /*
   * Accountability can be transferred, never removed. An empty owner is
   * refused here whatever the caller and whatever the approval says, because
   * removing the owner of an action is one of the things the plan says the AI
   * may not do, and no person needs to do it either: an action that no longer
   * needs an owner is closed or cancelled, not orphaned.
   */
  if (ownerUserId.length === 0) {
    throw new Error("Accountability cannot be removed from an action. Name the person it transfers to.");
  }
  const exists = getSqlite()
    .prepare("select count(*) as n from users where run_id = ? and id = ? and line <> 'external'")
    .get(context.runId, ownerUserId) as { n: number } | undefined;
  if ((exists?.n ?? 0) === 0) {
    throw new Error(`"${ownerUserId}" is not a person who can hold accountability for an action.`);
  }
  if (ownerUserId === row.ownerUserId) {
    throw new Error(`${userName(ownerUserId)} already owns ${row.id}. Nothing was changed.`);
  }

  const write = getSqlite().transaction(() => {
    db()
      .update(actions)
      .set({ ownerUserId, isUnowned: false })
      .where(and(eq(actions.runId, context.runId), eq(actions.id, row.id)))
      .run();
    return insertEntry(context, {
      actionId: row.id,
      kind: "ASN",
      note: `Accountability transferred from ${userName(row.ownerUserId)} to ${userName(ownerUserId)}. Reason: ${reason}`,
      evidenceIds: [],
      statusAfter: carriedStatus(context, row, row.status),
    });
  });
  write();

  return {
    summary: `${row.id} reassigned to ${ownerUserId}.`,
    objectKind: "action",
    objectId: row.id,
    data: { actionId: row.id, ownerUserId },
    receiptStatements: [`Accountable owner of ${row.id} changed to ${userName(ownerUserId)}`],
  };
});

register("changeActionDueDate", (payload, context): ToolHandlerResult => {
  const row = loadAction(context, requireText(payload, "actionId", "The action"));
  requireOpen(row);
  const dueOn = str(payload, "dueOn");
  const reason = requireText(payload, "reason", "A reason");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueOn) || Number.isNaN(Date.parse(`${dueOn}T00:00:00.000Z`))) {
    throw new Error("The new due date is not a valid date, so nothing was changed.");
  }
  const today = scenarioDate(context);
  if (dueOn < today) {
    throw new Error(`A due date cannot be set before the scenario day ${displayDate(today)}.`);
  }
  if (dueOn === row.dueOn) {
    throw new Error(`${row.id} is already due on ${displayDate(dueOn)}. Nothing was changed.`);
  }

  /* A stored overdue status no longer holds once the date is in the future. */
  const status = row.status === "overdue" ? "in-progress" : row.status;

  const write = getSqlite().transaction(() => {
    db()
      .update(actions)
      .set({ dueOn, status })
      .where(and(eq(actions.runId, context.runId), eq(actions.id, row.id)))
      .run();
    return insertEntry(context, {
      actionId: row.id,
      kind: "DUE",
      note: `Due date moved from ${row.dueOn ? displayDate(row.dueOn) : "no date"} to ${displayDate(dueOn)}. Reason: ${reason}`,
      evidenceIds: [],
      statusAfter: carriedStatus(context, row, status),
    });
  });
  write();

  return {
    summary: `${row.id} due date moved to ${dueOn}.`,
    objectKind: "action",
    objectId: row.id,
    data: { actionId: row.id, dueOn },
    receiptStatements: [`Due date of ${row.id} changed to ${displayDate(dueOn)}`],
  };
});

register("completeAction", (payload, context): ToolHandlerResult => {
  const row = loadAction(context, requireText(payload, "actionId", "The action"));
  requireOpen(row);
  const note = requireText(payload, "note", "How the completion condition is met");
  const evidenceIds = stringList(payload, "evidenceIds");

  /*
   * The evidence rule is the role's, read here from the role's own
   * configuration rather than from the payload. A caller cannot switch it off
   * by sending a flag.
   */
  const config = getWorkRoleConfig(context.roleId);
  const required = config ? evidenceRequiredToComplete(row.kind, config) : true;
  if (required && evidenceIds.length === 0) {
    throw new Error(`${row.id} cannot close without cited evidence. Closing this kind of action requires the document that shows the condition is met.`);
  }
  assertEvidenceExists(context, evidenceIds);

  const today = scenarioDate(context);
  const write = getSqlite().transaction(() => {
    db()
      .update(actions)
      .set({ status: "completed", completedOn: today })
      .where(and(eq(actions.runId, context.runId), eq(actions.id, row.id)))
      .run();
    return insertEntry(context, { actionId: row.id, kind: "CMP", note, evidenceIds, statusAfter: "completed" });
  });
  write();

  return {
    summary: `${row.id} completed with ${evidenceIds.length} evidence citation(s).`,
    objectKind: "action",
    objectId: row.id,
    evidenceIds,
    data: { actionId: row.id },
    receiptStatements: [`${row.id} closed on ${displayDate(today)}`, ...evidenceIds.map((id) => `Evidence cited: ${id}`)],
  };
});

register("reopenAction", (payload, context): ToolHandlerResult => {
  const row = loadAction(context, requireText(payload, "actionId", "The action"));
  const reason = requireText(payload, "reason", "A reason");
  if (row.status !== "completed") {
    throw new Error(`${row.id} is not completed, so there is nothing to reopen.`);
  }
  const today = scenarioDate(context);
  const status = row.dueOn !== null && row.dueOn < today ? "overdue" : "in-progress";

  const write = getSqlite().transaction(() => {
    db()
      .update(actions)
      .set({ status, completedOn: null })
      .where(and(eq(actions.runId, context.runId), eq(actions.id, row.id)))
      .run();
    return insertEntry(context, { actionId: row.id, kind: "REO", note: `Reopened. Reason: ${reason}`, evidenceIds: [], statusAfter: status });
  });
  write();

  return {
    summary: `${row.id} reopened.`,
    objectKind: "action",
    objectId: row.id,
    data: { actionId: row.id, status },
    receiptStatements: [`${row.id} reopened as ${status}`],
  };
});

/* ==========================================================================
   Meeting held
   ========================================================================== */

/**
 * Records a meeting as held and tells the work that depended on it.
 *
 * Three writes in one transaction: the meeting row takes its outcome and
 * status, the agenda entries for it are marked completed, and each dependent
 * open action gets one append-only follow-up entry. The dependent actions are
 * named in the payload, so the person's approval covers exactly the actions
 * that will be written to, and each is checked to exist, to be open and to
 * belong to the acting role's work before anything is written.
 */
register("recordMeetingHeld", (payload, context): ToolHandlerResult => {
  const meetingId = requireText(payload, "meetingId", "The meeting");
  const outcome = requireText(payload, "outcome", "The outcome");
  const dependentIds = stringList(payload, "dependentActionIds");

  const meeting = db()
    .select()
    .from(meetings)
    .where(and(eq(meetings.runId, context.runId), eq(meetings.id, meetingId)))
    .get();
  if (!meeting) throw new Error(`The meeting "${meetingId}" does not exist, so nothing was written.`);
  if (meeting.roleId !== context.roleId) throw new Error(`${meetingId} is not on this role's agenda.`);
  if (meeting.status === "concluded") throw new Error(`${meetingId} is already recorded as held.`);

  const state = requireScenarioState(context.runId);
  if (meeting.scheduledFor.slice(0, 10) === state.scenarioDate && minutesOf(timeOf(meeting.scheduledFor)) > minutesOf(context.atMoment)) {
    throw new Error(`${meetingId} starts at ${timeOf(meeting.scheduledFor)}, after the current moment ${context.atMoment}. A meeting cannot be recorded as held before it starts.`);
  }

  const holder = getSqlite()
    .prepare("select holder_user_id as holder from roles where run_id = ? and id = ?")
    .get(context.runId, context.roleId) as { holder: string } | undefined;
  const dependents = dependentIds.map((id) => loadAction(context, id));
  for (const row of dependents) {
    requireOpen(row);
    if (row.raisedByRoleId !== context.roleId && row.ownerUserId !== (holder?.holder ?? null)) {
      throw new Error(`${row.id} is not this role's work, so no follow-up was written to it.`);
    }
  }

  const write = getSqlite().transaction(() => {
    db()
      .update(meetings)
      .set({
        status: "concluded",
        outcome,
        concludedAt: new Date().toISOString(),
        heldByUserId: context.actingUserId,
        heldAt: `${state.scenarioDate}T${context.atMoment}:00.000Z`,
      })
      .where(and(eq(meetings.runId, context.runId), eq(meetings.id, meetingId)))
      .run();
    db()
      .update(calendarEvents)
      .set({ preparationStatus: "completed" })
      .where(and(eq(calendarEvents.runId, context.runId), eq(calendarEvents.meetingId, meetingId)))
      .run();
    for (const row of dependents) {
      insertEntry(context, {
        actionId: row.id,
        kind: "MTG",
        note: `${meeting.reference} was held at ${timeOf(meeting.scheduledFor)}. Outcome: ${firstLine(outcome, 240)} Check whether this action is affected.`,
        evidenceIds: [],
        statusAfter: carriedStatus(context, row, row.status),
        authorKind: "system",
      });
    }
  });
  write();

  return {
    summary: `${meetingId} recorded as held, with a follow-up entry on ${dependents.length} dependent action(s).`,
    objectKind: "meeting",
    objectId: meetingId,
    data: { meetingId, dependentActionIds: dependents.map((row) => row.id) },
    receiptStatements: [
      `${meeting.reference} recorded as held`,
      "Agenda entry marked completed",
      ...(dependents.length > 0 ? [`Follow-up entry added to ${dependents.map((row) => row.id).join(", ")}`] : []),
    ],
  };
});

/** Ensures the module's registrations have run. Imported by the operations. */
export const workToolHandlersRegistered = true;
