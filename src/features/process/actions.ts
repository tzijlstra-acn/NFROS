"use server";

/**
 * Process server actions.
 *
 * The browser changes process state only through these, and each is a thin
 * wrapper: validate the identifiers, call the orchestrator, revalidate the
 * workday, return the result in the reader's language. None of them holds a
 * rule. Whether a task may be recorded, a decision taken, a change executed or
 * a stage completed is decided by the engine, which re-reads the database and
 * re-validates on every call, so a crafted request cannot do what the
 * disabled button would not.
 *
 * Every write revalidates the role's workday through `revalidateWorkday`
 * (`src/workday/revalidate.ts`), so Home, Work, Processes and Decisions read
 * the new state on the next view.
 */

import { after } from "next/server";
import { z } from "zod";
import { ROLE_IDS, type RoleId } from "@/db/schema/core";
import { getScenarioState } from "@/scenario/engine/state";
import { revalidateWorkday } from "@/workday/revalidate";
import { createLogger } from "@/server/logging/redact";
import {
  approveAndExecuteTools,
  requestPreparation,
  routeRoleRefusal,
  runQueuedPreparation,
  submitHumanTask,
  submitStageCompletion,
  submitStageDecision,
  syncStage,
} from "./orchestrator";
import type { CommandResult } from "./common";
import { processRunUnavailableReason } from "@/role-apps/enablement";

const log = createLogger("process-actions");

export interface StageActionState {
  ok: boolean;
  message: string;
  reasons: string[];
}

const identifier = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9._:-]+$/, "An identifier may contain letters, digits, dot, underscore, colon and hyphen only.");

const target = z.object({
  processRunId: identifier,
  stageId: identifier,
  roleId: z.enum(ROLE_IDS),
});

function language(): "en" | "de" {
  return getScenarioState()?.language === "de" ? "de" : "en";
}

function toState(result: CommandResult): StageActionState {
  const lang = language();
  return {
    ok: result.ok,
    message: lang === "de" ? result.message.de : result.message.en,
    reasons: (result.reasons ?? []).map((reason) => (lang === "de" ? reason.de : reason.en)),
  };
}

function invalid(): StageActionState {
  return language() === "de"
    ? { ok: false, message: "Die Anfrage ist unvollstaendig.", reasons: [] }
    : { ok: false, message: "The request is incomplete.", reasons: [] };
}

function failed(error: unknown): StageActionState {
  log.error("A process action failed.", { error });
  return language() === "de"
    ? { ok: false, message: "Die Aktion konnte nicht ausgefuehrt werden. Der Fehler ist im Serverprotokoll erfasst.", reasons: [] }
    : { ok: false, message: "The action could not be completed. The error is recorded in the server log.", reasons: [] };
}

function readTarget(data: FormData) {
  return target.safeParse({
    processRunId: data.get("processRunId"),
    stageId: data.get("stageId"),
    roleId: data.get("roleId"),
  });
}

/**
 * The refusal shown when the workday's role does not own the run, or when the
 * product owner has disabled or retired the run's Role App
 * (`src/role-apps/enablement.ts`), or null.
 */
function wrongRole(parsed: { processRunId: string; roleId: string }): StageActionState | null {
  const refusal = routeRoleRefusal(parsed.processRunId, parsed.roleId as RoleId);
  if (refusal) return toState(refusal);
  const unavailable = processRunUnavailableReason(parsed.processRunId);
  return unavailable ? toState({ ok: false, message: unavailable }) : null;
}

function confirmed(data: FormData): boolean {
  return data.get("rationaleConfirmed") === "on" || data.get("rationaleConfirmed") === "true";
}

/**
 * Brings the stage up to date on page load: resumes a queued or interrupted
 * preparation and publishes what state written elsewhere implies. Called by
 * the page from the browser, never during render.
 */
export async function actionResumeStage(input: { processRunId: string; stageId: string; roleId: string }): Promise<{ ran: boolean }> {
  const parsed = target.safeParse(input);
  if (!parsed.success) return { ran: false };
  if (processRunUnavailableReason(parsed.data.processRunId)) return { ran: false };
  try {
    const result = await syncStage(parsed.data.processRunId, parsed.data.stageId);
    if (result.ran) revalidateWorkday(parsed.data.roleId as RoleId, "process-stage");
    return { ran: result.ran };
  } catch (error) {
    log.error("Resuming a stage failed.", { error });
    return { ran: false };
  }
}

export async function actionRecordStageTask(_previous: StageActionState | null, data: FormData): Promise<StageActionState> {
  const parsed = readTarget(data);
  const taskKeyValue = identifier.safeParse(data.get("taskKey"));
  if (!parsed.success || !taskKeyValue.success) return invalid();
  const mismatch = wrongRole(parsed.data);
  if (mismatch) return mismatch;
  try {
    const result = await submitHumanTask(parsed.data.processRunId, parsed.data.stageId, taskKeyValue.data, data);
    revalidateWorkday(parsed.data.roleId as RoleId, "process-stage");
    return toState(result);
  } catch (error) {
    return failed(error);
  }
}

export async function actionRecordStageDecision(_previous: StageActionState | null, data: FormData): Promise<StageActionState> {
  const parsed = readTarget(data);
  const decisionKey = identifier.safeParse(data.get("decisionKey"));
  const optionId = identifier.safeParse(data.get("optionId"));
  if (!parsed.success || !decisionKey.success) return invalid();
  const mismatch = wrongRole(parsed.data);
  if (mismatch) return mismatch;
  if (!optionId.success) {
    return language() === "de"
      ? { ok: false, message: "Waehlen Sie eine Option.", reasons: [] }
      : { ok: false, message: "Choose an option.", reasons: [] };
  }
  try {
    const result = await submitStageDecision(parsed.data.processRunId, parsed.data.stageId, {
      decisionKey: decisionKey.data,
      optionId: optionId.data,
      rationale: String(data.get("rationale") ?? ""),
      rationaleConfirmed: confirmed(data),
    });
    revalidateWorkday(parsed.data.roleId as RoleId, "decision");
    return toState(result);
  } catch (error) {
    return failed(error);
  }
}

export async function actionExecuteStageTools(_previous: StageActionState | null, data: FormData): Promise<StageActionState> {
  const parsed = readTarget(data);
  if (!parsed.success) return invalid();
  const mismatch = wrongRole(parsed.data);
  if (mismatch) return mismatch;
  try {
    const result = await approveAndExecuteTools(parsed.data.processRunId, parsed.data.stageId, {
      rationale: String(data.get("rationale") ?? ""),
      rationaleConfirmed: confirmed(data),
    });
    revalidateWorkday(parsed.data.roleId as RoleId, "approval");
    return toState(result);
  } catch (error) {
    return failed(error);
  }
}

export async function actionCompleteStage(_previous: StageActionState | null, data: FormData): Promise<StageActionState> {
  const parsed = readTarget(data);
  if (!parsed.success) return invalid();
  const mismatch = wrongRole(parsed.data);
  if (mismatch) return mismatch;
  try {
    const result = await submitStageCompletion(parsed.data.processRunId, parsed.data.stageId, {
      rationale: String(data.get("rationale") ?? ""),
      rationaleConfirmed: confirmed(data),
    });
    revalidateWorkday(parsed.data.roleId as RoleId, "process-stage");

    // The next stage's preparation runs after the response, so completing a
    // stage is not held up by preparing the next one. The page resumes it too.
    const nextJobId = "nextJobId" in result ? result.nextJobId : null;
    if (result.ok && nextJobId) {
      after(async () => {
        try {
          await runQueuedPreparation(nextJobId);
        } catch (error) {
          log.warn("The next stage preparation did not run after completion.", { error });
        }
      });
    }
    return toState(result);
  } catch (error) {
    return failed(error);
  }
}

export async function actionStartPreparation(_previous: StageActionState | null, data: FormData): Promise<StageActionState> {
  const parsed = readTarget(data);
  if (!parsed.success) return invalid();
  const mismatch = wrongRole(parsed.data);
  if (mismatch) return mismatch;
  try {
    const result = await requestPreparation(parsed.data.processRunId, parsed.data.stageId);
    if (result.ok) await syncStage(parsed.data.processRunId, parsed.data.stageId);
    revalidateWorkday(parsed.data.roleId as RoleId, "process-stage");
    return toState(result);
  } catch (error) {
    return failed(error);
  }
}
