"use server";

/**
 * Server actions for the Quality page.
 *
 * Thin: validate the identifiers, call the governed operation (which checks
 * the acting persona, the approval and the evaluation gate), refresh the
 * console, and return the result in the reader's language. No rule lives here.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { readAdminLanguage } from "@/product/status/sources";
import { readApprovalFields, toFormState, type ConsoleFormState } from "@/features/product/governance";
import { isConsoleEvaluationMode } from "./harness";
import { approveCandidate, governedRunEvaluation, rejectCandidate, rollBackConfiguration } from "./operations";

const identifier = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9._:-]+$/);

function invalid(): ConsoleFormState {
  return readAdminLanguage() === "de"
    ? { ok: false, message: "Die Anfrage ist unvollstaendig." }
    : { ok: false, message: "The request is incomplete." };
}

function refresh(): void {
  revalidatePath("/product", "layout");
  revalidatePath("/settings/ai-quality");
}

export async function actionRunEvaluation(_previous: ConsoleFormState | null, data: FormData): Promise<ConsoleFormState> {
  const configurationId = identifier.safeParse(data.get("configurationId"));
  const mode = data.get("mode");
  if (!configurationId.success || !isConsoleEvaluationMode(mode)) return invalid();
  const result = await governedRunEvaluation(configurationId.data, mode);
  if (result.ok) refresh();
  return toFormState(result, readAdminLanguage());
}

export async function actionApproveCandidate(_previous: ConsoleFormState | null, data: FormData): Promise<ConsoleFormState> {
  const configurationId = identifier.safeParse(data.get("configurationId"));
  if (!configurationId.success) return invalid();
  const result = await approveCandidate(configurationId.data, readApprovalFields(data));
  if (result.ok) refresh();
  return toFormState(result, readAdminLanguage());
}

export async function actionRejectCandidate(_previous: ConsoleFormState | null, data: FormData): Promise<ConsoleFormState> {
  const configurationId = identifier.safeParse(data.get("configurationId"));
  if (!configurationId.success) return invalid();
  const result = await rejectCandidate(configurationId.data, String(data.get("reason") ?? "").slice(0, 2000));
  if (result.ok) refresh();
  return toFormState(result, readAdminLanguage());
}

export async function actionRollBackConfiguration(_previous: ConsoleFormState | null, data: FormData): Promise<ConsoleFormState> {
  const roleId = identifier.safeParse(data.get("roleId"));
  const taskKind = identifier.safeParse(data.get("taskKind"));
  if (!roleId.success || !taskKind.success) return invalid();
  const result = await rollBackConfiguration(roleId.data, taskKind.data, readApprovalFields(data));
  if (result.ok) refresh();
  return toFormState(result, readAdminLanguage());
}
