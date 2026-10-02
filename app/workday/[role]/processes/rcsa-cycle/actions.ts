/**
 * Server actions for the RCSA Cycle process page.
 *
 * submitStageDecision: completes the current stage run, opens the next stage
 * run, updates the run's current stage pointer, records audit events, and
 * redirects the browser to the next stage workspace.
 *
 * "use server" required at the top of this module so Next.js bundles these
 * functions only on the server and exposes them as POST endpoints.
 *
 * No em dashes. No umlauts.
 */

"use server";

import { redirect } from "next/navigation";
import { DEFAULT_RUN_ID } from "@/db/schema/core";
import {
  completeStageRun,
  createStageRun,
  getStageRun,
  advanceStageRun,
  updateRunStage,
  recordEvent,
} from "@/db/repositories/role-app-runtime";
import { RCSA_CYCLE_PROCESS } from "@/role-apps/rcsa/definition";

export async function submitStageDecision(formData: FormData) {
  const stageRunId = formData.get("stageRunId") as string;
  const runId = formData.get("runId") as string;
  const currentStageId = formData.get("currentStageId") as string;
  const roleId = formData.get("roleId") as string;
  const note = String(formData.get("note") ?? "");

  const stages = RCSA_CYCLE_PROCESS.stages;
  const currentIndex = stages.findIndex((s) => s.id === currentStageId);
  const nextStage = currentIndex >= 0 ? stages[currentIndex + 1] : undefined;

  const now = new Date().toISOString();

  // Complete the current stage run.
  completeStageRun(stageRunId, null);

  // Record stage-completed event.
  recordEvent({
    id: `EVT-${now}-stage-completed`,
    runId: DEFAULT_RUN_ID,
    roleAppRunId: runId,
    stageId: currentStageId,
    eventKind: "stage-completed",
    actorKind: "human",
    actorId: null,
    payload: { note },
    at: now,
  });

  if (nextStage) {
    const nowNext = new Date(Date.now() + 1).toISOString();

    // Open the next stage run. Check if a row already exists (e.g. partial
    // seeding); create one if it does not.
    const existingNext = getStageRun(runId, nextStage.id);
    if (existingNext) {
      advanceStageRun(existingNext.id, "in-progress");
    } else {
      createStageRun({
        id: `STAGERUN-RCSA-ADV-${nextStage.id}-${Date.now()}`,
        runId: DEFAULT_RUN_ID,
        roleAppRunId: runId,
        stageId: nextStage.id,
        status: "in-progress",
        openedAt: nowNext,
        completedAt: null,
        completedByUserId: null,
        aiOutputId: null,
      });
    }

    // Advance the run pointer to the next stage.
    updateRunStage(runId, nextStage.id, "in-progress");

    // Record stage-entered event.
    recordEvent({
      id: `EVT-${nowNext}-stage-entered`,
      runId: DEFAULT_RUN_ID,
      roleAppRunId: runId,
      stageId: nextStage.id,
      eventKind: "stage-entered",
      actorKind: "system",
      actorId: null,
      payload: {},
      at: nowNext,
    });

    redirect(`/workday/${roleId}/processes/rcsa-cycle?stage=${nextStage.id}`);
  } else {
    // All stages complete -- mark the run done and land on the process page.
    updateRunStage(runId, currentStageId, "completed");
    redirect(`/workday/${roleId}/processes/rcsa-cycle`);
  }
}
