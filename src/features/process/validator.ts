/**
 * CompletionValidator: lifecycle steps 1 and 12, entry and completion criteria.
 *
 * A pure function of the StageContext. It reads no database and writes
 * nothing, so the same function decides whether Continue is enabled in the
 * workspace, whether the completion server action proceeds, and whether the
 * completion handler commits inside its transaction. Three callers, one rule:
 * Continue cannot bypass the criteria because there is no path to completion
 * that does not ask this function first.
 */

import type { Bilingual, StageCriterion, StageDecisionCondition } from "@/role-apps/contracts";
import { findTask } from "./derive";
import { taskKey } from "./keys";
import { stageIsExecutable } from "./derive";
import { getCompletionCheck, missingImplementations } from "./registry";
import type { BlockingResult, CriterionResult, StageContext, StageValidation } from "./types";

function conditionApplies(when: StageDecisionCondition | undefined, context: StageContext): boolean {
  if (!when) return true;
  const decision = context.decisions.find((state) => state.spec.key === when.decisionKey);
  return (
    decision?.status === "recorded" &&
    decision.chosenOptionId !== null &&
    (when.optionIds.length === 0 || when.optionIds.includes(decision.chosenOptionId))
  );
}

function unmet(en: string, de: string): Bilingual {
  return { en, de };
}

/** Evaluates one criterion. Exported for the unit tests. */
export function evaluateCriterion(criterion: StageCriterion, context: StageContext): CriterionResult {
  const applies = conditionApplies(criterion.when, context);
  const base = { kind: criterion.kind, label: criterion.label, applies };
  if (!applies) return { ...base, met: true, reason: null };

  switch (criterion.kind) {
    case "stage-completed": {
      const met = context.completedStageIds.includes(criterion.stageId);
      const stage = context.process.stages.find((candidate) => candidate.id === criterion.stageId);
      return {
        ...base,
        met,
        reason: met
          ? null
          : unmet(
              `Stage ${stage?.sequence ?? ""} ${stage?.name ?? criterion.stageId} is not completed.`,
              `Stufe ${stage?.sequence ?? ""} ${stage?.nameDe ?? criterion.stageId} ist nicht abgeschlossen.`,
            ),
      };
    }

    case "sources-resolved": {
      const unavailable = context.sources.filter(
        (source) => source.necessity === "required" && source.status === "unavailable",
      );
      const met = context.sources.length > 0 && unavailable.length === 0;
      return {
        ...base,
        met,
        reason: met
          ? null
          : context.sources.length === 0
            ? unmet("The stage sources have not been loaded.", "Die Quellen der Stufe wurden nicht geladen.")
            : unmet(
                `A required source is unavailable: ${unavailable.map((source) => source.spec.label.en).join(", ")}.`,
                `Eine erforderliche Quelle ist nicht verfuegbar: ${unavailable.map((source) => source.spec.label.de).join(", ")}.`,
              ),
      };
    }

    case "ai-job-completed": {
      const met = context.preparation.state === "completed";
      return {
        ...base,
        met,
        reason: met
          ? null
          : unmet(
              "The AI preparation has not completed and been validated.",
              "Die KI-Vorbereitung ist nicht abgeschlossen und geprueft.",
            ),
      };
    }

    case "human-task-completed": {
      const task = findTask(context.tasks, taskKey.human(criterion.taskKey));
      const met = task?.status === "completed";
      const spec = context.stage.humanTasks.find((candidate) => candidate.key === criterion.taskKey);
      return {
        ...base,
        met,
        reason: met
          ? null
          : unmet(
              `${spec?.label.en ?? criterion.taskKey} is not recorded.`,
              `${spec?.label.de ?? criterion.taskKey} ist nicht erfasst.`,
            ),
      };
    }

    case "decision-recorded": {
      const decision = context.decisions.find((state) => state.spec.key === criterion.decisionKey);
      const met = decision?.status === "recorded";
      return {
        ...base,
        met,
        reason: met
          ? null
          : unmet(
              `The decision "${decision?.spec.label.en ?? criterion.decisionKey}" is not recorded.`,
              `Die Entscheidung "${decision?.spec.label.de ?? criterion.decisionKey}" ist nicht erfasst.`,
            ),
      };
    }

    case "tool-executed": {
      const tool = context.tools.find((state) => state.key === criterion.toolKey);
      const spec = context.stage.tools.find((candidate) => candidate.key === criterion.toolKey);
      const met = tool?.satisfied === true;
      const waiting =
        spec?.channel === "outbox" && tool?.state === "queued"
          ? unmet(
              `${spec.label.en} is in the outbox and not yet confirmed by the target system.`,
              `${spec.label.de} liegt im Postausgang und ist vom Zielsystem noch nicht bestaetigt.`,
            )
          : unmet(
              `${spec?.label.en ?? criterion.toolKey} has not been executed.`,
              `${spec?.label.de ?? criterion.toolKey} wurde nicht ausgefuehrt.`,
            );
      return { ...base, met, reason: met ? null : waiting };
    }

    case "artifact-stored": {
      const artifactSpec = context.stage.artifacts.find((candidate) => candidate.key === criterion.artifactKey);
      const met =
        artifactSpec?.producedBy === "ai-preparation"
          ? context.preparation.state === "completed" && context.preparation.artifactId !== null
          : context.artifacts.some((artifact) => artifact.artifactKey === criterion.artifactKey);
      return {
        ...base,
        met,
        reason: met
          ? null
          : unmet(
              `${artifactSpec?.label.en ?? criterion.artifactKey} is not stored.`,
              `${artifactSpec?.label.de ?? criterion.artifactKey} ist nicht gespeichert.`,
            ),
      };
    }

    case "check": {
      /*
       * A registered check reads another module's record from the context.
       * A check that is missing or throws is not met: the stage cannot claim a
       * fact this build cannot establish.
       */
      const check = getCompletionCheck(criterion.checkKey);
      if (!check) {
        return {
          ...base,
          met: false,
          reason: unmet(`${criterion.label.en}: this build cannot check it.`, `${criterion.label.de}: dieser Build kann es nicht pruefen.`),
        };
      }
      let result: { met: boolean; reason: Bilingual | null };
      try {
        result = check(context);
      } catch {
        result = { met: false, reason: null };
      }
      return {
        ...base,
        met: result.met,
        reason: result.met ? null : (result.reason ?? unmet(`${criterion.label.en}: not yet.`, `${criterion.label.de}: noch nicht.`)),
      };
    }
  }
}

/** Evaluates the blocking conditions. Exported for the unit tests. */
export function evaluateBlocking(context: StageContext): BlockingResult[] {
  return context.stage.blockingConditions.map((condition): BlockingResult => {
    switch (condition.kind) {
      case "stage-not-implemented": {
        const missing = missingImplementations(context.stage);
        const active = !stageIsExecutable(context.stage);
        return {
          kind: condition.kind,
          label: condition.label,
          active,
          detail: active
            ? (context.stage.implementation.reason ?? {
                en: `This build is missing: ${missing.join(", ")}.`,
                de: `In diesem Build fehlt: ${missing.join(", ")}.`,
              })
            : null,
        };
      }
      case "required-source-unavailable": {
        const unavailable = context.sources.filter(
          (source) => source.necessity === "required" && source.status === "unavailable",
        );
        const active = unavailable.length > 0;
        return {
          kind: condition.kind,
          label: condition.label,
          active,
          detail: active
            ? {
                en: unavailable.map((source) => `${source.spec.label.en}: ${source.unavailableReason?.en ?? ""}`).join(" "),
                de: unavailable.map((source) => `${source.spec.label.de}: ${source.unavailableReason?.de ?? ""}`).join(" "),
              }
            : null,
        };
      }
      case "ai-job-failed": {
        const active = context.preparation.state === "failed";
        return {
          kind: condition.kind,
          label: condition.label,
          active,
          detail: active && context.preparation.reason
            ? { en: context.preparation.reason, de: context.preparation.reason }
            : null,
        };
      }
      case "decision-held": {
        const decision = context.decisions.find((state) => state.spec.key === condition.decisionKey);
        const active = decision?.status === "recorded" && decision.outcome === "hold";
        return { kind: condition.kind, label: condition.label, active, detail: null };
      }
      case "external-command-failed": {
        const tool = context.tools.find((state) => state.key === condition.toolKey);
        const active = tool?.state === "failed" || tool?.state === "blocked";
        return {
          kind: condition.kind,
          label: condition.label,
          active,
          detail: active && tool?.summary ? { en: tool.summary, de: tool.summary } : null,
        };
      }
    }
  });
}

/**
 * Validates the stage.
 *
 * `canComplete` requires all three: the entry criteria hold, every applicable
 * completion criterion is met, and no blocking condition is active. The
 * stage must also be open and not already completed, which are checked here
 * rather than left to the caller because the caller is three different places.
 */
export function validateStage(context: StageContext): StageValidation {
  const entry = context.stage.entryCriteria.map((criterion) => evaluateCriterion(criterion, context));
  const completion = context.stage.completionCriteria.map((criterion) => evaluateCriterion(criterion, context));
  const blocking = evaluateBlocking(context);

  const entryMet = entry.every((result) => result.met);
  const reasons: Bilingual[] = [];

  if (!context.stageRun) {
    reasons.push(unmet("This stage has not been opened.", "Diese Stufe wurde noch nicht geoeffnet."));
  } else if (context.stageRun.status === "completed") {
    reasons.push(unmet("This stage is already completed.", "Diese Stufe ist bereits abgeschlossen."));
  }

  for (const result of blocking) {
    if (result.active) reasons.push(result.detail ?? result.label);
  }
  for (const result of entry) {
    if (!result.met && result.reason) reasons.push(result.reason);
  }
  for (const result of completion) {
    if (result.applies && !result.met && result.reason) reasons.push(result.reason);
  }

  const canComplete =
    context.stageRun !== null &&
    context.stageRun.status !== "completed" &&
    entryMet &&
    completion.every((result) => result.met) &&
    blocking.every((result) => !result.active);

  return { entry, completion, blocking, entryMet, canComplete, reasons };
}
