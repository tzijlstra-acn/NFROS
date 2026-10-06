"use server";

/**
 * Server actions for the Work Hub.
 *
 * Thin, like `app/actions.ts`: each one validates its input, calls the
 * module operation that runs the change through the authority gate, and then
 * revalidates the role's workday with `revalidateWorkday`, so Home, Work,
 * Processes and Decisions all render the change on the next view without a
 * reload. No business rule is decided here, and nothing here writes a row.
 *
 * The role arrives from the route, and every operation re-checks that the
 * action or meeting is on that role's desk before it does anything. The
 * acting person and the approver are the holder of that role, read on the
 * server; the browser cannot name either.
 */

import { z } from "zod";
import { ROLE_IDS, type RoleId } from "@/db/schema/core";
import { createLogger } from "@/server/logging/redact";
import { getScenarioState } from "@/scenario/engine/state";
import { revalidateWorkday } from "@/workday/revalidate";
import { workRoleIds } from "@/features/work/roles";
import {
  addUpdate,
  assignAction,
  changeDueDate,
  completeWithEvidence,
  draftReminder,
  escalateAction,
  reopenAction,
  requestEvidence,
  sendReminder,
  type OperationOutcome,
} from "@/features/work/modules/actions/operations";
import { recordMeetingHeld } from "@/features/work/modules/agenda/operations";
import {
  captureMeetingItem,
  confirmMinutes,
  prepareMinutes,
  saveMinutes,
} from "@/features/work/modules/meetings/operations";
import { MINUTES_DECISION_OUTCOMES, MINUTES_ITEM_KINDS } from "@/features/work/modules/meetings/ai-schema";

const log = createLogger("work-actions");

const roleSchema = z
  .enum(ROLE_IDS)
  .refine((role) => workRoleIds().includes(role), "This role has no Work Hub.");
const idSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/);
const text = (max: number) => z.string().trim().min(1).max(max);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const evidenceList = z.array(idSchema).max(20);

function invalid(error: z.ZodError): OperationOutcome {
  const message = error.issues.map((issue) => issue.message).join(" ");
  return { ok: false, message, receipt: [], blocked: [message] };
}

/** Runs an operation and revalidates the workday when it changed something. */
async function run<T extends OperationOutcome>(
  roleId: RoleId,
  change: "action" | "meeting" | "minutes",
  operation: () => Promise<T>,
): Promise<T | OperationOutcome> {
  try {
    const outcome = await operation();
    if (outcome.ok && outcome.receipt.length > 0) revalidateWorkday(roleId, change);
    return outcome;
  } catch (error) {
    log.error("A Work Hub operation failed.", { error });
    const message =
      getScenarioState()?.language === "de"
        ? "Die Aenderung konnte nicht erfasst werden. Nichts wurde geaendert."
        : "The change could not be recorded. Nothing was changed.";
    return { ok: false, message, receipt: [], blocked: [message] };
  }
}

export async function actionAssignAction(input: unknown): Promise<OperationOutcome> {
  const parsed = z
    .object({ roleId: roleSchema, actionId: idSchema, ownerUserId: idSchema, reason: text(1000), confirmed: z.boolean() })
    .safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return run(parsed.data.roleId, "action", () => assignAction(parsed.data));
}

export async function actionChangeDueDate(input: unknown): Promise<OperationOutcome> {
  const parsed = z
    .object({ roleId: roleSchema, actionId: idSchema, dueOn: dateSchema, reason: text(1000), confirmed: z.boolean() })
    .safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return run(parsed.data.roleId, "action", () => changeDueDate(parsed.data));
}

export async function actionRequestEvidence(input: unknown): Promise<OperationOutcome> {
  const parsed = z
    .object({
      roleId: roleSchema,
      actionId: idSchema,
      what: text(1000),
      fromUserId: idSchema.nullable(),
      fromLabel: z.string().trim().max(200),
      dueOn: dateSchema.nullable(),
    })
    .safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return run(parsed.data.roleId, "action", () => requestEvidence(parsed.data));
}

export async function actionAddUpdate(input: unknown): Promise<OperationOutcome> {
  const parsed = z
    .object({
      roleId: roleSchema,
      actionId: idSchema,
      note: text(2000),
      evidenceIds: evidenceList,
      blocker: z.enum(["set", "clear"]).nullable(),
      entryKind: z.enum(["UPD", "CC"]),
    })
    .safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return run(parsed.data.roleId, "action", () => addUpdate(parsed.data));
}

export async function actionDraftReminder(input: unknown): Promise<OperationOutcome> {
  const parsed = z.object({ roleId: roleSchema, actionId: idSchema }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  /* A draft writes nothing, so there is nothing to revalidate. */
  return run(parsed.data.roleId, "action", () => draftReminder(parsed.data));
}

export async function actionSendReminder(input: unknown): Promise<OperationOutcome> {
  const parsed = z
    .object({ roleId: roleSchema, actionId: idSchema, subject: text(240), body: text(4000) })
    .safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return run(parsed.data.roleId, "action", () => sendReminder(parsed.data));
}

export async function actionCompleteAction(input: unknown): Promise<OperationOutcome> {
  const parsed = z
    .object({ roleId: roleSchema, actionId: idSchema, note: text(2000), evidenceIds: evidenceList, confirmed: z.boolean() })
    .safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return run(parsed.data.roleId, "action", () => completeWithEvidence(parsed.data));
}

export async function actionReopenAction(input: unknown): Promise<OperationOutcome> {
  const parsed = z
    .object({ roleId: roleSchema, actionId: idSchema, reason: text(1000), confirmed: z.boolean() })
    .safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return run(parsed.data.roleId, "action", () => reopenAction(parsed.data));
}

export async function actionEscalateAction(input: unknown): Promise<OperationOutcome> {
  const parsed = z
    .object({ roleId: roleSchema, actionId: idSchema, reason: text(1000), confirmed: z.boolean() })
    .safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return run(parsed.data.roleId, "action", () => escalateAction(parsed.data));
}

export async function actionRecordMeetingHeld(input: unknown): Promise<OperationOutcome> {
  const parsed = z
    .object({ roleId: roleSchema, meetingId: idSchema, outcome: text(2000), confirmed: z.boolean() })
    .safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return run(parsed.data.roleId, "meeting", () => recordMeetingHeld(parsed.data));
}

/* ==========================================================================
   The meeting lifecycle (plan section 4.6). The operations are in
   `src/features/work/modules/meetings/operations.ts`.
   ========================================================================== */

export async function actionCaptureMeetingItem(input: unknown): Promise<OperationOutcome> {
  const parsed = z
    .object({
      roleId: roleSchema,
      meetingId: idSchema,
      kind: z.enum(MINUTES_ITEM_KINDS),
      turnId: idSchema.nullable(),
      text: text(1600),
      decisionId: idSchema.nullable(),
      outcome: z.enum(MINUTES_DECISION_OUTCOMES),
      existingActionId: idSchema.nullable(),
      ownerUserId: idSchema.nullable(),
      ownerLabel: z.string().trim().max(200),
      dueOn: dateSchema.nullable(),
      actionKind: idSchema,
      completionCondition: z.string().trim().max(600),
      evidenceIds: evidenceList,
    })
    .safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return run(parsed.data.roleId, "minutes", () => captureMeetingItem(parsed.data));
}

export async function actionPrepareMinutes(input: unknown): Promise<OperationOutcome> {
  const parsed = z.object({ roleId: roleSchema, meetingId: idSchema }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return run(parsed.data.roleId, "minutes", () => prepareMinutes(parsed.data));
}

export async function actionSaveMinutes(input: unknown): Promise<OperationOutcome> {
  /* The draft's own shape is checked by the operation against the minutes schema and the institution. */
  const parsed = z
    .object({ roleId: roleSchema, meetingId: idSchema, minutesId: idSchema, version: z.number().int().min(1), draft: z.unknown() })
    .safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return run(parsed.data.roleId, "minutes", () => saveMinutes(parsed.data));
}

export async function actionConfirmMinutes(input: unknown): Promise<OperationOutcome> {
  const parsed = z
    .object({
      roleId: roleSchema,
      minutesId: idSchema,
      version: z.number().int().min(1),
      confirmDecisions: z.boolean(),
      confirmActions: z.boolean(),
      confirmDistribution: z.boolean(),
      confirmed: z.boolean(),
      rationale: text(2000),
    })
    .safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return run(parsed.data.roleId, "minutes", () => confirmMinutes(parsed.data));
}
