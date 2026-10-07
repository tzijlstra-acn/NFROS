"use server";

/**
 * Server actions for the Integrations page.
 *
 * Thin: validate the identifiers against a bounded character set, call the
 * governed operation, refresh the console, the settings integration centre
 * and the workday (which shows source freshness), and return the result in
 * the reader's language. Nothing here takes a credential or an endpoint.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { readAdminLanguage } from "@/product/status/sources";
import { readApprovalFields, toFormState, type ConsoleFormState } from "@/features/product/governance";
import { resolveMappingIssue, retryIntegrationCommand, runConnectorSync, setConnectorWritesPaused, testConnection } from "./operations";

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
  revalidatePath("/settings/integrations");
  revalidatePath("/workday", "layout");
}

export async function actionTestConnection(_previous: ConsoleFormState | null, data: FormData): Promise<ConsoleFormState> {
  const id = identifier.safeParse(data.get("connectorInstanceId"));
  if (!id.success) return invalid();
  const result = await testConnection(id.data);
  return toFormState(result, readAdminLanguage());
}

export async function actionRunSync(_previous: ConsoleFormState | null, data: FormData): Promise<ConsoleFormState> {
  const id = identifier.safeParse(data.get("connectorInstanceId"));
  if (!id.success) return invalid();
  const result = await runConnectorSync(id.data);
  if (result.ok) refresh();
  return toFormState(result, readAdminLanguage());
}

export async function actionSetWritesPaused(_previous: ConsoleFormState | null, data: FormData): Promise<ConsoleFormState> {
  const id = identifier.safeParse(data.get("connectorInstanceId"));
  const paused = data.get("paused");
  if (!id.success || (paused !== "true" && paused !== "false")) return invalid();
  const result = await setConnectorWritesPaused(id.data, paused === "true", readApprovalFields(data));
  if (result.ok) refresh();
  return toFormState(result, readAdminLanguage());
}

export async function actionRetryCommand(_previous: ConsoleFormState | null, data: FormData): Promise<ConsoleFormState> {
  const id = identifier.safeParse(data.get("commandId"));
  if (!id.success) return invalid();
  const result = await retryIntegrationCommand(id.data);
  refresh();
  return toFormState(result, readAdminLanguage());
}

export async function actionResolveMapping(_previous: ConsoleFormState | null, data: FormData): Promise<ConsoleFormState> {
  const key = z.string().min(3).max(160).regex(/^(issue|ref|event):[A-Za-z0-9._:-]+$/).safeParse(data.get("key"));
  const outcome = data.get("outcome");
  if (!key.success || (outcome !== "resolved" && outcome !== "accepted")) return invalid();
  const result = await resolveMappingIssue(key.data, outcome, readApprovalFields(data));
  if (result.ok) refresh();
  return toFormState(result, readAdminLanguage());
}
