/**
 * What every engine command shares: the result shape, the guards, and the
 * tool runtime context.
 *
 * Every command returns a `CommandResult` rather than throwing for an
 * expected refusal. A refusal is information the workspace has to show (why
 * the decision was not recorded, why Continue did nothing), and making the
 * caller catch to find out would put the explanation in the error path.
 */

import type { Bilingual } from "@/role-apps/contracts";
import type { ToolContext } from "@/agents/tools/runtime";
import { stageIsExecutable } from "./derive";
import type { StageContext } from "./types";

export interface CommandResult {
  ok: boolean;
  /** One sentence for the person, in both languages. */
  message: Bilingual;
  /** True when the command found its work already done and wrote nothing. */
  noop?: boolean;
  /** Further reasons, when a refusal has more than one cause. */
  reasons?: Bilingual[];
}

export function refused(message: Bilingual, reasons: Bilingual[] = []): CommandResult {
  return { ok: false, message, reasons };
}

export function done(message: Bilingual, noop = false): CommandResult {
  return { ok: true, message, noop };
}

/**
 * The guard every human command passes: the stage is open, not completed, and
 * executable in this build. Returns a refusal, or null when the command may
 * proceed.
 */
export function guardOpenStage(context: StageContext, options: { requirePreparation: boolean }): CommandResult | null {
  if (!context.stageRun) {
    return refused({
      en: "This stage has not been opened yet.",
      de: "Diese Stufe wurde noch nicht geoeffnet.",
    });
  }
  if (context.stageRun.status === "completed") {
    return refused({
      en: "This stage is already completed. Nothing was changed.",
      de: "Diese Stufe ist bereits abgeschlossen. Es wurde nichts geaendert.",
    });
  }
  if (!stageIsExecutable(context.stage)) {
    return refused(
      context.stage.implementation.reason ?? {
        en: "This stage is not executable in this build.",
        de: "Diese Stufe ist in diesem Build nicht ausfuehrbar.",
      },
    );
  }
  if (options.requirePreparation && context.stage.aiJobs.length > 0 && context.preparation.state !== "completed") {
    return refused({
      en: "The AI preparation for this stage has not completed. Review starts from the validated preparation.",
      de: "Die KI-Vorbereitung dieser Stufe ist nicht abgeschlossen. Die Pruefung beginnt mit der geprueften Vorbereitung.",
    });
  }
  return null;
}

/**
 * The tool runtime context for a human acting on a process stage.
 *
 * The role is the run's role and the acting user is its holder, for the
 * reason given in `./approvals.ts`. The autonomy level is the scenario's, read
 * from the database, never from the request.
 */
export function toolContextFor(context: StageContext): ToolContext {
  return {
    runId: context.runId,
    roleId: context.roleId,
    autonomyLevel: context.state.autonomyLevel,
    actingUserId: context.actingUserId,
    atMoment: context.state.currentMoment,
    sessionId: `process-${context.run.id}`,
    actorKind: "human",
    language: context.state.language,
  };
}

/**
 * The tool context for a call whose approval came from `grantStageApproval`.
 *
 * Names the stage run as the target, so the gate refuses an approval granted
 * in another stage run even when the payload is identical. Calls approved by
 * other paths (decisions, Work Hub tools) keep `toolContextFor`, whose
 * approvals name their own targets.
 */
export function stageToolContextFor(context: StageContext): ToolContext {
  return {
    ...toolContextFor(context),
    target: context.stageRun ? { kind: "stage-run", id: context.stageRun.id } : null,
  };
}

/** The subject reference every process event carries. */
export function subjectOf(context: StageContext): { kind: string; id: string } {
  return { kind: context.run.subjectKind, id: context.run.subjectId };
}

/** The process reference every process event carries. */
export function processOf(context: StageContext): { runId: string; stageId: string } {
  return { runId: context.run.id, stageId: context.stage.id };
}

/** Stage name in both languages, with its sequence. */
export function stageName(context: StageContext): Bilingual {
  return {
    en: `Stage ${context.stage.sequence} ${context.stage.name}`,
    de: `Stufe ${context.stage.sequence} ${context.stage.nameDe}`,
  };
}
