/**
 * StageContextBuilder: everything the engine knows about one stage, read from
 * persisted state.
 *
 * Called at the start of every engine command and every page render. It
 * reads the run, the stage run, its tasks, artifacts and preparation job, the
 * decision rows, the outbox commands, the records people attached to the
 * stage as input, and it loads the stage sources. It writes nothing. Two
 * consequences follow, and both are acceptance criteria: a refresh shows
 * exactly what is persisted, and a server restart loses nothing, because
 * there is no in-memory state to lose.
 *
 * Two readings of persisted state happen here rather than in a stage module,
 * because they are the same for every process:
 *
 *   Stage inputs (migration 0008): an inbox message, confirmed minutes or a
 *   document attached to the stage (`listStageInputs`), with the title of
 *   the record it names.
 *
 *   Decisions per run (migration 0007): a contract binds a seeded decision by
 *   the identifier of the decision it was written for, which belongs to the
 *   run it was raised for. Another run of the same app is bound to its own
 *   decision for the stage instead, see `bindRunDecisions`.
 */

import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { DEFAULT_RUN_ID, roles, type RoleId } from "@/db/schema/core";
import { decisions as decisionRows } from "@/db/schema/decisions";
import { meetingMinutes } from "@/db/schema/role-app-runtime";
import { evidenceDocuments, inboxMessages } from "@/db/schema/work";
import {
  getArtifacts,
  getRun,
  getStageRun,
  getStageRuns,
  getStageTasks,
} from "@/db/repositories/role-app-runtime";
import { getJobById } from "@/db/repositories/background-jobs";
import { getDecisionsForStage } from "@/db/repositories/process-decisions";
import { listStageInputs } from "@/db/repositories/process-stage-inputs";
import { getProcessDefinition, getRoleApp } from "@/role-apps/registry";
import type { Bilingual, RoleProcessStage } from "@/role-apps/contracts";
import { getScenarioState } from "@/scenario/engine/state";
import { getResolvedDemoMode } from "@/server/config/runtime";
import { loadStageSources } from "./sources";
import { derivePreparationStatus, deriveDecisionStates, deriveToolStates } from "./derive";
import { getDecisionRules } from "./registry";
import type { DecisionState, StageContext, StageInput } from "./types";

/** Fallback holders, used only if the roles table has not been seeded. */
const ROLE_HOLDERS: Record<RoleId, string> = {
  tprm: "P-002",
  rcsa: "P-003",
  "control-assurance": "P-004",
  "incident-resilience": "P-005",
  "regulatory-change": "P-006",
  "nfr-governance": "P-001",
};

/** The person who holds a role in this run. Approvals are granted in their name. */
export function roleHolder(roleId: RoleId, runId = DEFAULT_RUN_ID): string {
  const row = getDb().select().from(roles).where(eq(roles.id, roleId)).get();
  return row && row.runId === runId ? row.holderUserId : ROLE_HOLDERS[roleId];
}

export class StageContextError extends Error {}

/**
 * The stage contract as this run meets it.
 *
 * A seeded-decision binding names the decision the contract was written for.
 * When that decision belongs to another run (`process_run_id` is set and is
 * not this run), this run is bound to its own decision for the stage: the one
 * `getDecisionsForStage(run, stage)` holds with the same reference, which is
 * how a run's own copy keeps its place in the process. Until the run has one,
 * the binding names no decision, so the stage waits for a judgment of its own
 * and never completes on one taken for another run. A binding to a decision
 * of this run, or of no run, is unchanged.
 */
function bindRunDecisions(stage: RoleProcessStage, processRunId: string, runId: string): { stage: RoleProcessStage; unbound: Set<string> } {
  const unbound = new Set<string>();
  const seeded = stage.decisions.flatMap((spec) => (spec.binding.kind === "seeded-decision" ? [spec.binding.decisionId] : []));
  if (seeded.length === 0) return { stage, unbound };

  const templates = new Map(
    getDb()
      .select({ id: decisionRows.id, reference: decisionRows.reference, processRunId: decisionRows.processRunId })
      .from(decisionRows)
      .where(and(eq(decisionRows.runId, runId), inArray(decisionRows.id, seeded)))
      .all()
      .map((row) => [row.id, row]),
  );
  const foreign = seeded.filter((id) => {
    const template = templates.get(id);
    return template !== undefined && template.processRunId !== null && template.processRunId !== processRunId;
  });
  if (foreign.length === 0) return { stage, unbound };

  const own = getDecisionsForStage(processRunId, stage.id, runId);
  return {
    stage: {
      ...stage,
      decisions: stage.decisions.map((spec) => {
        if (spec.binding.kind !== "seeded-decision" || !foreign.includes(spec.binding.decisionId)) return spec;
        const reference = templates.get(spec.binding.decisionId)?.reference;
        const mine = own.find((row) => row.reference === reference);
        if (!mine) unbound.add(spec.key);
        return { ...spec, binding: { kind: "seeded-decision" as const, decisionId: mine?.id ?? "" } };
      }),
    },
    unbound,
  };
}

/** A decision the run has none of its own for yet: pending, with nothing to choose from. */
function unboundDecision(state: DecisionState): DecisionState {
  return {
    ...state,
    recordId: null,
    status: "pending",
    chosenOptionId: null,
    outcome: null,
    rationale: null,
    decidedByUserId: null,
    decidedAt: null,
    options: [],
    preparedPosition: null,
    uncertainty: null,
    revisable: false,
  };
}

/** The records attached to the stage as input, with the title of each, oldest first. */
function readStageInputs(processRunId: string, stageId: string, runId: string): StageInput[] {
  const rows = listStageInputs(processRunId, stageId, runId);
  if (rows.length === 0) return [];
  const idsOf = (kind: string) => rows.filter((row) => row.sourceKind === kind).map((row) => row.sourceId);
  const messageIds = idsOf("message");
  const minutesIds = idsOf("minutes");
  const documentIds = idsOf("document");
  const messages = new Map(
    (messageIds.length > 0
      ? getDb()
          .select({ id: inboxMessages.id, subject: inboxMessages.subject, subjectDe: inboxMessages.subjectDe, fromLabel: inboxMessages.fromLabel })
          .from(inboxMessages)
          .where(and(eq(inboxMessages.runId, runId), inArray(inboxMessages.id, messageIds)))
          .all()
      : []
    ).map((row) => [row.id, row]),
  );
  const minutes = new Map(
    (minutesIds.length > 0
      ? getDb()
          .select({ id: meetingMinutes.id, title: meetingMinutes.title })
          .from(meetingMinutes)
          .where(and(eq(meetingMinutes.runId, runId), inArray(meetingMinutes.id, minutesIds)))
          .all()
      : []
    ).map((row) => [row.id, row]),
  );
  const documents = new Map(
    (documentIds.length > 0
      ? getDb()
          .select({ id: evidenceDocuments.id, title: evidenceDocuments.title, titleDe: evidenceDocuments.titleDe, authorLabel: evidenceDocuments.authorLabel })
          .from(evidenceDocuments)
          .where(and(eq(evidenceDocuments.runId, runId), inArray(evidenceDocuments.id, documentIds)))
          .all()
      : []
    ).map((row) => [row.id, row]),
  );

  return rows.map((row) => {
    const message = row.sourceKind === "message" ? messages.get(row.sourceId) : undefined;
    const record = row.sourceKind === "minutes" ? minutes.get(row.sourceId) : undefined;
    const document = row.sourceKind === "document" ? documents.get(row.sourceId) : undefined;
    const label: Bilingual | null = message
      ? { en: message.subject, de: message.subjectDe.length > 0 ? message.subjectDe : message.subject }
      : record
        ? { en: record.title, de: record.title }
        : document
          ? { en: document.title, de: document.titleDe.length > 0 ? document.titleDe : document.title }
          : null;
    return {
      id: row.id,
      sourceKind: row.sourceKind,
      sourceId: row.sourceId,
      label,
      from: message?.fromLabel ?? document?.authorLabel ?? null,
      addedByUserId: row.addedByUserId,
      addedAt: row.addedAt,
      addedAtMoment: row.addedAtMoment,
      note: row.note,
      osEventId: row.osEventId,
      auditEventId: row.auditEventId,
    };
  });
}

/**
 * Builds the context for one stage of one process run.
 *
 * `stageId` defaults to the run's current stage. Throws a StageContextError
 * for a run, app, process or stage that does not exist, because every caller
 * of the engine has to surface that clearly rather than render an empty page.
 */
export function buildStageContext(params: {
  processRunId: string;
  stageId?: string;
  runId?: string;
}): StageContext {
  const runId = params.runId ?? DEFAULT_RUN_ID;
  const state = getScenarioState(runId);
  if (!state) throw new StageContextError("The scenario has not been seeded.");

  const run = getRun(params.processRunId, runId);
  if (!run) throw new StageContextError(`The process run ${params.processRunId} does not exist.`);

  const app = getRoleApp(run.roleAppId);
  if (!app) throw new StageContextError(`The role app ${run.roleAppId} is not registered.`);

  const process = getProcessDefinition(app.processId);
  if (!process) throw new StageContextError(`The process ${app.processId} is not installed.`);

  const stageId = params.stageId ?? run.currentStageId;
  const contract = process.stages.find((candidate) => candidate.id === stageId);
  if (!contract) throw new StageContextError(`The stage ${stageId} is not part of ${process.id}.`);
  const { stage, unbound } = bindRunDecisions(contract, run.id, runId);

  const roleId = run.roleId as RoleId;
  const stageRun = getStageRun(run.id, stage.id, runId) ?? null;
  const completedStageIds = getStageRuns(run.id, runId)
    .filter((row) => row.status === "completed")
    .map((row) => row.stageId);
  const tasks = stageRun ? getStageTasks(stageRun.id, runId) : [];
  const artifacts = getArtifacts(run.id, stage.id, runId);
  const job = stageRun?.preparationJobId ? (getJobById(stageRun.preparationJobId) ?? null) : null;

  const sources = stageRun ? loadStageSources({ runId, state, run, stage }) : [];
  const inputs = stageRun ? readStageInputs(run.id, stage.id, runId) : [];
  const preparation = derivePreparationStatus({ stage, stageRun, job, artifacts });

  const rules = getDecisionRules(process.id, stage.id);
  const preparedPosition: Bilingual | null = preparation.output ? preparation.output.summary : null;

  /*
   * The partial context is what the decision rules see. They may read the
   * tasks and the preparation, but not the decisions they are helping derive.
   */
  const partial: StageContext = {
    runId,
    state,
    mode: getResolvedDemoMode().mode,
    app,
    process,
    stage,
    run,
    roleId,
    actingUserId: roleHolder(roleId, runId),
    stageRun,
    completedStageIds,
    tasks,
    artifacts,
    job,
    sources,
    inputs,
    preparation,
    decisions: [],
    tools: [],
  };

  const decisions = deriveDecisionStates({
    stage,
    tasks,
    runId,
    recommendedOptionId: preparation.output?.recommendedOptionId ?? null,
    preparedPosition,
    consequencesFor: (decisionKey, optionId) => rules?.consequences?.(partial, decisionKey, optionId) ?? [],
  }).map((state) => (unbound.has(state.spec.key) ? unboundDecision(state) : state));

  const tools = deriveToolStates({
    stage,
    tasks,
    decisionStates: decisions,
    preparationCompleted: preparation.state === "completed",
  });

  return { ...partial, decisions, tools };
}

/** The context of the run's current stage, or null when the run has no current stage row. */
export function buildCurrentStageContext(processRunId: string, runId = DEFAULT_RUN_ID): StageContext {
  return buildStageContext({ processRunId, runId });
}
