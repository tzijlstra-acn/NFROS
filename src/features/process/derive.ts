/**
 * State readers: persisted rows to engine state.
 *
 * The StageContextBuilder calls these to turn rows (the stage run, its tasks,
 * the preparation job, the decision rows, the outbox commands) into the
 * states the validator and the workspace reason about. They read; they never
 * write. Writing happens only through the engine's commands, which is what
 * keeps a page render free of side effects.
 */

import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { decisionOptions, decisions } from "@/db/schema/decisions";
import type { Bilingual, RoleProcessStage, StageDecisionSpec } from "@/role-apps/contracts";
import type { BackgroundJob } from "@/db/repositories/background-jobs";
import type {
  RoleAppArtifact,
  RoleAppStageRun,
  RoleAppStageTask,
} from "@/db/repositories/role-app-runtime";
import { findCommandById } from "@/integrations/runtime/IdempotencyStore";
import { isDemoMode } from "@/server/config/demo-mode";
import { stagePreparationSchema } from "./preparation-schema";
import { missingImplementations } from "./registry";
import { taskKey } from "./keys";
import type {
  DecisionOptionView,
  DecisionState,
  PreparationSource,
  PreparationStatus,
  ToolState,
  ToolTaskState,
} from "./types";

/* ==========================================================================
   Task outputs
   ========================================================================== */

export interface DecisionTaskOutput {
  optionId: string;
  outcome: "advance" | "hold";
  rationale: string;
  decidedByUserId: string;
  decidedAt: string;
  revision: number;
  history: Array<{ optionId: string; outcome: "advance" | "hold"; rationale: string; decidedAt: string }>;
}

export interface HumanTaskOutput {
  input: unknown;
  digest: string;
  revision: number;
  recordedAt: string;
  summary: Bilingual[];
}

export interface ToolTaskOutput {
  outcome: ToolTaskState;
  summary: string;
  auditEventId: string | null;
  receiptStatements: string[];
  commandId: string | null;
  receiptId: string | null;
  externalId: string | null;
  approvalId: string | null;
  payloadFingerprint: string;
  executedAt: string;
  /** What the local tool handler returned, for example the identifier it created. */
  resultData?: unknown;
}

export interface PreparationArtifactContent {
  output: unknown;
  mode: string;
  source: PreparationSource;
  validatedAt: string;
  jobId: string;
  fallbackNote: string | null;
}

export function parseTaskOutput<T>(task: RoleAppStageTask | undefined): T | null {
  if (!task?.output) return null;
  try {
    return JSON.parse(task.output) as T;
  } catch {
    return null;
  }
}

export function findTask(tasks: readonly RoleAppStageTask[], key: string): RoleAppStageTask | undefined {
  return tasks.find((task) => task.taskKey === key);
}

/* ==========================================================================
   Preparation
   ========================================================================== */

export function stageIsExecutable(stage: RoleProcessStage): boolean {
  return stage.implementation.implemented && missingImplementations(stage).length === 0;
}

/**
 * The user-facing preparation state, derived from the job row.
 *
 * A lease that has expired is shown as retrying, not running: the process
 * that held it stopped (a restart, a crash), and the next resume will release
 * it. Showing "Running" for a job nobody is running would be the permanent
 * spinner the plan forbids, only with a different word.
 */
export function derivePreparationStatus(params: {
  stage: RoleProcessStage;
  stageRun: RoleAppStageRun | null;
  job: BackgroundJob | null;
  artifacts: readonly RoleAppArtifact[];
  now?: number;
}): PreparationStatus {
  const { stage, stageRun, job, artifacts } = params;
  const now = params.now ?? Date.now();

  const blank: PreparationStatus = {
    state: "not-started",
    jobId: job?.id ?? null,
    attempts: job?.attemptCount ?? 0,
    reason: null,
    mode: null,
    source: null,
    output: null,
    artifactId: null,
    completedAt: null,
  };

  if (stage.aiJobs.length === 0) return blank;
  if (!stageIsExecutable(stage)) {
    return {
      ...blank,
      state: "unavailable",
      reason:
        stage.implementation.reason?.en ??
        `This stage cannot be prepared in this build: ${missingImplementations(stage).join(", ")}.`,
    };
  }
  if (!stageRun || !job) return blank;

  switch (job.status) {
    case "pending":
      return job.attemptCount === 0
        ? { ...blank, state: "queued" }
        : { ...blank, state: "retrying", reason: job.lastErrorRedacted };
    case "leased": {
      const expired = job.leaseExpiresAt !== null && Date.parse(job.leaseExpiresAt) < now;
      return expired
        ? {
            ...blank,
            state: "retrying",
            reason: "The previous attempt stopped before it finished. It will be tried again.",
          }
        : { ...blank, state: "running" };
    }
    case "waiting-for-source":
      return { ...blank, state: "waiting-for-source", reason: job.resultSummary };
    case "waiting-for-approval":
      return { ...blank, state: "waiting-for-approval", reason: job.resultSummary };
    case "failed":
    case "cancelled":
      return { ...blank, state: "failed", reason: job.lastErrorRedacted ?? job.resultSummary };
    case "completed": {
      const artifact = artifacts.find((candidate) => candidate.id === stageRun.aiOutputId);
      const content = artifact?.content ? safeParse<PreparationArtifactContent>(artifact.content) : null;
      const parsed = content ? stagePreparationSchema.safeParse(content.output) : null;
      if (!artifact || !content || !parsed?.success) {
        return {
          ...blank,
          state: "failed",
          reason: "The preparation completed but its stored output is missing or no longer valid.",
        };
      }
      return {
        ...blank,
        state: "completed",
        mode: isDemoMode(content.mode) ? content.mode : null,
        source: content.source,
        output: parsed.data,
        artifactId: artifact.id,
        completedAt: content.validatedAt,
        reason: content.fallbackNote,
      };
    }
    default:
      return { ...blank, state: "failed", reason: `Unknown job status ${job.status}.` };
  }
}

function safeParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/* ==========================================================================
   Decisions
   ========================================================================== */

/** Plain language for the consequence kinds seeded decisions declare. */
const CONSEQUENCE_PHRASES: Record<string, Bilingual> = {
  "request-factual-validation": { en: "Request factual validation from the first line", de: "Faktische Bestaetigung bei der ersten Linie anfordern" },
  "create-issue": { en: "Raise an issue", de: "Ein Thema erfassen" },
  "create-action": { en: "Create an action with an owner and a due date", de: "Massnahme mit Verantwortung und Termin anlegen" },
  "set-control-effectiveness": { en: "Change the recorded control effectiveness", de: "Erfasste Kontrollwirksamkeit aendern" },
  "version-assessment": { en: "Create a new assessment version", de: "Neue Bewertungsversion anlegen" },
  "set-residual-risk": { en: "Record the residual risk position", de: "Restrisikoposition erfassen" },
  "add-committee-item": { en: "Add an item to the committee agenda", de: "Punkt auf die Komitee-Agenda setzen" },
  "activate-monitoring": { en: "Activate enhanced monitoring", de: "Verstaerkte Ueberwachung aktivieren" },
  "send-collaboration-message": { en: "Post an internal message", de: "Interne Nachricht senden" },
  "request-evidence": { en: "Request an evidence document", de: "Nachweisdokument anfordern" },
  "create-reassessment": { en: "Open an off-cycle reassessment", de: "Ausserplanmaessige Neubewertung eroeffnen" },
};

function seededDecisionState(spec: StageDecisionSpec, decisionId: string, runId: string): DecisionState {
  const row = getDb()
    .select()
    .from(decisions)
    .where(and(eq(decisions.runId, runId), eq(decisions.id, decisionId)))
    .get();
  const optionRows = getDb()
    .select()
    .from(decisionOptions)
    .where(and(eq(decisionOptions.runId, runId), eq(decisionOptions.decisionId, decisionId)))
    .orderBy(asc(decisionOptions.sortOrder))
    .all();

  const options: DecisionOptionView[] = optionRows.map((option) => ({
    id: option.id,
    label: { en: option.label, de: option.labelDe.length > 0 ? option.labelDe : option.label },
    description: { en: option.description, de: option.description },
    outcome: "advance",
    consequences: option.consequences.map((consequence) => {
      const phrase = CONSEQUENCE_PHRASES[consequence.kind];
      return phrase ?? { en: consequence.kind, de: consequence.kind };
    }),
    isRecommended: option.isRecommended,
  }));

  const recorded = row?.status === "decided" && row.chosenOptionId !== null;
  return {
    spec,
    recordId: row?.id ?? null,
    status: recorded ? "recorded" : "pending",
    chosenOptionId: recorded ? (row?.chosenOptionId ?? null) : null,
    outcome: recorded ? "advance" : null,
    rationale: recorded ? (row?.recordedRationale ?? null) : null,
    decidedByUserId: recorded ? (row?.decidedByUserId ?? null) : null,
    decidedAt: recorded ? (row?.decidedAt ?? null) : null,
    options,
    preparedPosition: row ? { en: row.preparedPosition, de: row.preparedPosition } : null,
    uncertainty: row ? { en: row.uncertaintyNote, de: row.uncertaintyNote } : null,
    revisable: false,
  };
}

function stageDecisionState(
  spec: StageDecisionSpec,
  tasks: readonly RoleAppStageTask[],
  recommendedOptionId: string | null,
  consequencesFor: (optionId: string) => Bilingual[],
  preparedPosition: Bilingual | null,
): DecisionState {
  const task = findTask(tasks, taskKey.decision(spec.key));
  const output = parseTaskOutput<DecisionTaskOutput>(task);
  const options: DecisionOptionView[] =
    spec.binding.kind === "stage-decision"
      ? spec.binding.options.map((option) => ({
          id: option.id,
          label: option.label,
          description: option.description,
          outcome: option.outcome,
          consequences: consequencesFor(option.id),
          isRecommended: option.id === recommendedOptionId,
        }))
      : [];

  const recorded = task?.status === "completed" && output !== null;
  return {
    spec,
    recordId: task?.id ?? null,
    status: recorded ? "recorded" : "pending",
    chosenOptionId: recorded ? output.optionId : null,
    outcome: recorded ? output.outcome : null,
    rationale: recorded ? output.rationale : null,
    decidedByUserId: recorded ? output.decidedByUserId : null,
    decidedAt: recorded ? output.decidedAt : null,
    options,
    preparedPosition,
    uncertainty: null,
    revisable: recorded && output.outcome === "hold",
  };
}

export function deriveDecisionStates(params: {
  stage: RoleProcessStage;
  tasks: readonly RoleAppStageTask[];
  runId: string;
  recommendedOptionId: string | null;
  preparedPosition: Bilingual | null;
  consequencesFor: (decisionKey: string, optionId: string) => Bilingual[];
}): DecisionState[] {
  return params.stage.decisions.map((spec) =>
    spec.binding.kind === "seeded-decision"
      ? seededDecisionState(spec, spec.binding.decisionId, params.runId)
      : stageDecisionState(
          spec,
          params.tasks,
          params.recommendedOptionId,
          (optionId) => params.consequencesFor(spec.key, optionId),
          params.preparedPosition,
        ),
  );
}

/* ==========================================================================
   Tools
   ========================================================================== */

/** Whether a tool's proposal condition holds. */
export function toolApplies(
  proposeWhen: RoleProcessStage["tools"][number]["proposeWhen"],
  decisionStates: readonly DecisionState[],
  preparationCompleted: boolean,
): boolean {
  if (!preparationCompleted) return false;
  if (proposeWhen === "always") return true;
  const decision = decisionStates.find((state) => state.spec.key === proposeWhen.decisionKey);
  return (
    decision?.status === "recorded" &&
    decision.chosenOptionId !== null &&
    (proposeWhen.optionIds.length === 0 || proposeWhen.optionIds.includes(decision.chosenOptionId))
  );
}

export function deriveToolStates(params: {
  stage: RoleProcessStage;
  tasks: readonly RoleAppStageTask[];
  decisionStates: readonly DecisionState[];
  preparationCompleted: boolean;
}): ToolState[] {
  return params.stage.tools.map((spec) => {
    const task = findTask(params.tasks, taskKey.tool(spec.key));
    const output = parseTaskOutput<ToolTaskOutput>(task);
    const applies = toolApplies(spec.proposeWhen, params.decisionStates, params.preparationCompleted);

    if (!output) {
      return {
        key: spec.key,
        state: applies ? "proposed" : "not-applicable",
        satisfied: false,
        summary: null,
        commandId: null,
        receiptId: null,
        externalId: null,
        approvalId: null,
        auditEventId: null,
      };
    }

    /*
     * An outbox command can move after the stage recorded it: a queued
     * command is delivered by the drain or a retry in the integration centre.
     * The command row is the authority, so its current status is read here
     * rather than trusting the snapshot taken at dispatch.
     */
    let state: ToolTaskState = output.outcome;
    let externalId = output.externalId;
    if (spec.channel === "outbox" && output.commandId) {
      const command = findCommandById(output.commandId);
      if (command) {
        state =
          command.status === "acknowledged"
            ? "acknowledged"
            : command.status === "dead-letter" || command.status === "cancelled"
              ? "failed"
              : command.status === "awaiting-approval"
                ? "blocked"
                : "queued";
        externalId = command.targetExternalId ?? externalId;
      }
    }

    const satisfied =
      spec.channel === "local"
        ? state === "executed"
        : spec.deliveredWhen === "queued"
          ? state === "queued" || state === "acknowledged"
          : state === "acknowledged";

    return {
      key: spec.key,
      state,
      satisfied,
      summary: output.summary,
      commandId: output.commandId,
      receiptId: output.receiptId,
      externalId,
      approvalId: output.approvalId,
      auditEventId: output.auditEventId,
    };
  });
}
