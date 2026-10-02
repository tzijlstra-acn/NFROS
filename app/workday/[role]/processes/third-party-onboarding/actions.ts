/**
 * Server actions for the Third-Party Onboarding process page.
 *
 * submitStageDecision: records the human decision for the active stage,
 * marks the stage run as completed, advances the run to the next stage,
 * writes two events to the audit log, and redirects to the updated page.
 *
 * "use server" is required at the top of every action module.
 * All DB functions are synchronous (better-sqlite3).
 *
 * Synthetic institution and data.
 */

"use server";

import { redirect } from "next/navigation";
import { DEFAULT_RUN_ID } from "@/db/schema/core";
import {
  completeStageRun,
  updateRunStage,
  recordEvent,
} from "@/db/repositories/role-app-runtime";
import { TPRM_ONBOARDING_PROCESS } from "@/role-apps/tprm/definition";

export async function submitStageDecision(formData: FormData) {
  const stageRunId = formData.get("stageRunId") as string;
  const runId = formData.get("runId") as string;
  const currentStageId = formData.get("currentStageId") as string;
  const roleId = formData.get("roleId") as string;

  const stages = TPRM_ONBOARDING_PROCESS.stages;
  const currentIndex = stages.findIndex((s) => s.id === currentStageId);
  const nextStage =
    currentIndex >= 0 && currentIndex + 1 < stages.length
      ? stages[currentIndex + 1] ?? null
      : null;

  const note = (formData.get("note") as string | null) ?? "";

  // Mark the current stage run as completed.
  completeStageRun(stageRunId, null);

  const completedAt = new Date().toISOString();

  // Append a stage-completed event for the audit log.
  recordEvent({
    id: `EVT-TPRM-${Date.now()}`,
    runId: DEFAULT_RUN_ID,
    roleAppRunId: runId,
    stageId: currentStageId,
    eventKind: "stage-completed",
    actorKind: "human",
    actorId: undefined,
    payload: { note },
    at: completedAt,
  });

  if (nextStage) {
    // Advance the parent run to the next stage.
    updateRunStage(runId, nextStage.id, "in-progress");

    // Append a stage-entered event for the audit log.
    recordEvent({
      id: `EVT-TPRM-${Date.now() + 1}`,
      runId: DEFAULT_RUN_ID,
      roleAppRunId: runId,
      stageId: nextStage.id,
      eventKind: "stage-entered",
      actorKind: "system",
      actorId: undefined,
      payload: undefined,
      at: new Date().toISOString(),
    });

    redirect(
      `/workday/${roleId}/processes/third-party-onboarding?stage=${nextStage.id}`,
    );
  } else {
    redirect(`/workday/${roleId}/processes/third-party-onboarding`);
  }
}
