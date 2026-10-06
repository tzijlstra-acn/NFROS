"use server";

/**
 * Server actions for the Work Hub inbox (plan section 4.8).
 *
 * Thin, like `./actions.ts`: each one validates its input, calls the inbox
 * operation that runs the change through the authority gate, and then
 * revalidates the role's workday with `revalidateWorkday`, so Home, Work,
 * Processes and Decisions all render the change on the next view. No
 * business rule is decided here, and nothing here writes a row. The
 * operations are in `src/features/work/modules/inbox/operations.ts`.
 *
 * Kept in their own file so the inbox and the meeting lifecycle, built side
 * by side, do not edit one module of server actions at the same time.
 */

import { z } from "zod";
import { ROLE_IDS, type RoleId } from "@/db/schema/core";
import { createLogger } from "@/server/logging/redact";
import { getScenarioState } from "@/scenario/engine/state";
import { revalidateWorkday } from "@/workday/revalidate";
import { workRoleIds } from "@/features/work/roles";
import type { OperationOutcome } from "@/features/work/modules/actions/operations";
import {
  addToProcess,
  changeTriage,
  confirmTriage,
  createActionFromMessage,
  delegateMessage,
  dismissMessage,
  draftReply,
  linkAsEvidence,
  sendReply,
} from "@/features/work/modules/inbox/operations";
import { INBOX_CLASSIFICATIONS } from "@/features/work/modules/inbox/triage-schema";

const log = createLogger("work-inbox-actions");

const roleSchema = z
  .enum(ROLE_IDS)
  .refine((role) => workRoleIds().includes(role), "This role has no Work Hub.");
const idSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/);
const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function invalid(error: z.ZodError): OperationOutcome {
  const message = error.issues.map((issue) => issue.message).join(" ");
  return { ok: false, message, receipt: [], blocked: [message] };
}

/** Runs an operation and revalidates the workday when it changed something. */
async function run(roleId: RoleId, operation: () => Promise<OperationOutcome>): Promise<OperationOutcome> {
  try {
    const outcome = await operation();
    if (outcome.ok && outcome.receipt.length > 0) revalidateWorkday(roleId, "inbox");
    return outcome;
  } catch (error) {
    log.error("An inbox operation failed.", { error });
    const message =
      getScenarioState()?.language === "de"
        ? "Die Aenderung konnte nicht erfasst werden. Nichts wurde geaendert."
        : "The change could not be recorded. Nothing was changed.";
    return { ok: false, message, receipt: [], blocked: [message] };
  }
}

export async function inboxConfirmTriage(input: unknown): Promise<OperationOutcome> {
  const parsed = z.object({ roleId: roleSchema, messageId: idSchema }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return run(parsed.data.roleId, () => confirmTriage(parsed.data));
}

export async function inboxChangeTriage(input: unknown): Promise<OperationOutcome> {
  const parsed = z
    .object({ roleId: roleSchema, messageId: idSchema, classification: z.enum(INBOX_CLASSIFICATIONS), reason: optionalText(1000) })
    .safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return run(parsed.data.roleId, () => changeTriage(parsed.data));
}

export async function inboxDismiss(input: unknown): Promise<OperationOutcome> {
  const parsed = z.object({ roleId: roleSchema, messageId: idSchema, reason: optionalText(1000) }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return run(parsed.data.roleId, () => dismissMessage(parsed.data));
}

export async function inboxCreateAction(input: unknown): Promise<OperationOutcome> {
  const parsed = z
    .object({
      roleId: roleSchema,
      messageId: idSchema,
      linkExisting: z.boolean(),
      title: optionalText(240),
      kind: z.string().trim().max(60),
      ownerUserId: z.string().trim().max(40),
      dueOn: dateSchema.nullable(),
      reason: optionalText(1000),
      confirmed: z.boolean(),
    })
    .refine((value) => value.linkExisting || value.title.length > 0, "An action title is required.")
    .safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return run(parsed.data.roleId, () => createActionFromMessage(parsed.data));
}

export async function inboxLinkEvidence(input: unknown): Promise<OperationOutcome> {
  const parsed = z
    .object({ roleId: roleSchema, messageId: idSchema, objectIds: z.array(idSchema).max(8), title: text(240) })
    .safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return run(parsed.data.roleId, () => linkAsEvidence(parsed.data));
}

export async function inboxAddToProcess(input: unknown): Promise<OperationOutcome> {
  const parsed = z
    .object({ roleId: roleSchema, messageId: idSchema, processRunId: idSchema, stageId: idSchema })
    .safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return run(parsed.data.roleId, () => addToProcess(parsed.data));
}

export async function inboxDelegate(input: unknown): Promise<OperationOutcome> {
  const parsed = z.object({ roleId: roleSchema, messageId: idSchema, toUserId: idSchema, note: text(2000) }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return run(parsed.data.roleId, () => delegateMessage(parsed.data));
}

export async function inboxDraftReply(input: unknown): Promise<OperationOutcome> {
  const parsed = z.object({ roleId: roleSchema, messageId: idSchema }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  /* A draft writes nothing and has no receipt, so nothing is revalidated. */
  return run(parsed.data.roleId, () => draftReply(parsed.data));
}

export async function inboxSendReply(input: unknown): Promise<OperationOutcome> {
  const parsed = z
    .object({ roleId: roleSchema, messageId: idSchema, subject: text(240), body: text(4000) })
    .safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return run(parsed.data.roleId, () => sendReply(parsed.data));
}
