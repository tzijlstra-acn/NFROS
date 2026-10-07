"use server";

/**
 * Server actions for the feedback inbox and the workday feedback control.
 *
 * Thin: read the form, call the operation, refresh, answer in the reader's
 * language. Triage and forwarding go through `governConsoleAction`; a
 * workday submission is the analyst's own and is validated in
 * `submitWorkdayFeedback`.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { readAdminLanguage } from "@/product/status/sources";
import { toFormState, type ConsoleFormState } from "@/features/product/governance";
import { forwardAIFeedback, submitWorkdayFeedback, triageFeedback } from "./operations";
import { FEEDBACK_COPY } from "./copy";

const identifier = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9._:-]+$/);

function text(data: FormData, name: string): string | null {
  const value = data.get(name);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function invalid(): ConsoleFormState {
  return readAdminLanguage() === "de"
    ? { ok: false, message: "Die Anfrage ist unvollstaendig." }
    : { ok: false, message: "The request is incomplete." };
}

export async function actionTriageFeedback(_previous: ConsoleFormState | null, data: FormData): Promise<ConsoleFormState> {
  const id = identifier.safeParse(data.get("feedbackId"));
  if (!id.success) return invalid();
  const result = await triageFeedback(id.data, {
    status: text(data, "status") ?? "new",
    severity: text(data, "severity"),
    ownerLabel: text(data, "ownerLabel"),
    featureKey: text(data, "featureKey"),
    roleAppId: text(data, "roleAppId"),
    stageId: text(data, "stageId"),
    releaseVersion: text(data, "releaseVersion"),
    resolution: text(data, "resolution") ?? "",
  });
  if (result.ok) revalidatePath("/product", "layout");
  return toFormState(result, readAdminLanguage());
}

export async function actionForwardAIFeedback(_previous: ConsoleFormState | null, data: FormData): Promise<ConsoleFormState> {
  const id = identifier.safeParse(data.get("aiFeedbackId"));
  if (!id.success) return invalid();
  const result = await forwardAIFeedback(id.data);
  if (result.ok) revalidatePath("/product", "layout");
  return toFormState(result, readAdminLanguage());
}

/** The workday control's submission. */
export async function actionSubmitWorkdayFeedback(
  _previous: { ok: boolean; message: string } | null,
  data: FormData,
): Promise<{ ok: boolean; message: string }> {
  const language = data.get("language") === "de" ? "de" : "en";
  const result = submitWorkdayFeedback({
    kind: data.get("kind"),
    summary: data.get("summary"),
    detail: data.get("detail") ?? "",
    roleId: data.get("roleId"),
    route: data.get("route") || null,
  });
  if (!result.ok) return { ok: false, message: result.reason[language] };
  revalidatePath("/product/feedback");
  return { ok: true, message: FEEDBACK_COPY.sent[language] };
}
