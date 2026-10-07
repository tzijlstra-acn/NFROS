/**
 * The routine runner: AI routines on the durable job queue, driven by the
 * scenario clock (plan 8.2, Wave 3 "real routines").
 *
 * Until this module the routines in `ai_routines` had no runner: nothing
 * scheduled them, and `last_run_at` was a seeded value that could sit in the
 * future (audit T29). Now:
 *
 *   schedule    `scheduleDueRoutines` reads the scenario clock and every active
 *               routine of an Available role, asks `./windows` which windows
 *               are due, and queues one `background_jobs` row per routine,
 *               day and window ("ai-routine", payload "routine-run"). The job
 *               idempotency key is the run's key, so asking twice queues once.
 *   run         `processRoutineJob` runs one leased job:
 *                 1. records the run in `ai_routine_runs`, once per key (a
 *                    second worker or tab finds the first run and stops);
 *                 2. runs the routine's one governed step through
 *                    `executeTool`, so the authority gate decides and audits
 *                    it (`./tools`);
 *                 3. composes the suggestion(s) the person sees (`./prepare`)
 *                    and validates each (`./schema`), in every mode;
 *                 4. in one transaction: stores the validated suggestions,
 *                    completes the run with its outputs (lineage), publishes
 *                    `routine-completed` on the backbone with `createdCount`,
 *                    records the notification decision in the 0006 ledger
 *                    under the Partner's daily budget, stamps the routine's
 *                    last run on the scenario clock and completes the job.
 *   drive       the worker (`scripts/worker.ts`) schedules and runs on every
 *               poll; without a worker the workday frame does the same through
 *               `/api/workday/partner/sync` (`runDueRoutines`), as the process
 *               page resumes a stage preparation. Both lease by id, so they
 *               never run one job twice.
 *
 * Modes, as the process engine's preparation (`src/features/process/
 * preparation.ts`): safe serves what the Meetings and Inbox AI layers
 * captured before the day while their records are unchanged, offline composes
 * from the records, and live follows the same code path and is never called:
 * no routine is connected to a model in this release, so a live
 * configuration is served as safe and the run says so.
 *
 * Authority. Routines read, draft and propose; every step is READ, DRAFT or
 * PROPOSE, none mutates a record, and nothing a routine prepares is ever
 * executed by it. At an autonomy level that cannot reach the step (Assist
 * for a draft, Prepare for a proposal), the gate refuses, the refusal is
 * audited, and the run is recorded as needing a person, with nothing created.
 */

import { createHash } from "node:crypto";
import { getSqlite } from "@/db/client";
import { DEFAULT_RUN_ID, type RoleId } from "@/db/schema/core";
import {
  completeJob,
  enqueueJob,
  failJob,
  getJobById,
  getJobsByStatus,
  leaseJobById,
  type BackgroundJob,
} from "@/db/repositories/background-jobs";
import {
  completeRoutineRun,
  findRoutineRunByKey,
  getOutputsForRoutineRuns,
  listRoutineRuns,
  startRoutineRun,
  type NewAIRoutineRunOutput,
} from "@/db/repositories/ai-routine-runs";
import { getRoutines, recordRoutineRun, type AIRoutine } from "@/db/repositories/role-app-runtime";
import { getCalendar, getEvidenceDocuments, getInbox, getMeetings, getRole, getUsers } from "@/db/repositories/workday";
import { getDecisionRefs, getWorkAction, getWorkActions } from "@/db/repositories/work-hub";
import { executeTool, type ToolCallResult, type ToolContext } from "@/agents/tools/runtime";
import { persistSuggestion } from "@/agents/suggestions/generate";
import { seededStageShape } from "@/agents/suggestions/stages";
import type { SuggestionDraft } from "@/agents/suggestions/validate";
import { listOsEvents, publishOsEvent } from "@/features/events/backbone";
import { recordRoutineNotification } from "@/features/partner/notifications";
import { getReleasedConfig } from "@/ai/prompt-registry";
import { TOOL_REGISTRY } from "@/server/security/authority";
import type { AuthorityClass } from "@/db/schema/decisions";
import { getResolvedDemoMode } from "@/server/config/runtime";
import { createLogger, redactString } from "@/server/logging/redact";
import { getScenarioState, type ScenarioState } from "@/scenario/engine/state";
import type { RoutineKind } from "@/features/partner/tasks";
import { ROUTINE_OUTPUT_KIND, ROUTINE_TOOL, routineRolesInRelease, runnableRoutines } from "./registry";
import {
  followUpCandidates,
  followUpWindows,
  materialChanges,
  meetingWindows,
  monitoringWindows,
  routineRunKey,
  triageWindows,
  type EventFact,
  type RoutineWindow,
} from "./windows";
import "./tools";
import type { MaterialChangeData, MeetingPreparationData, TriageProposalData } from "./tools";
import {
  prepareMaterialChanges,
  prepareMeetingBrief,
  prepareReminders,
  prepareTriage,
  type PreparedRoutineWork,
  type ReminderData,
} from "./prepare";
import { validateRoutineOutput, type RoutineOutput } from "./schema";

const log = createLogger("routine-runner");

const LEASE_SECONDS = 60;
const LEASE_OWNER = `routine-runner-${process.pid}`;

export interface RoutineJobPayload {
  kind: "routine-run";
  routineId: string;
  roleId: RoleId;
  routineKind: RoutineKind;
  windowKey: string;
  triggerKind: RoutineWindow["triggerKind"];
  triggerRef: string | null;
  targets: string[];
  scenarioDate: string;
}

function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16).toUpperCase();
}

/** Stable identities from the run key, so a repeat finds the same rows. */
export function routineIdentities(key: string) {
  const hash = shortHash(key);
  return { jobId: `JOB-RTN-${hash}`, runRecordId: `RR-${hash}`, suggestionId: (index: number) => `SUG-RTN-${hash}-${index + 1}` };
}

/** The scenario clock as the stored ISO form, so `last_run_at` can never read as a wall clock time. */
function scenarioStamp(state: ScenarioState): string {
  return `${state.scenarioDate}T${state.currentMoment}:00.000Z`;
}

function parsePayload(job: BackgroundJob): RoutineJobPayload | null {
  if (!job.payload) return null;
  try {
    const parsed = JSON.parse(job.payload) as Partial<RoutineJobPayload>;
    return parsed.kind === "routine-run" && parsed.routineId && parsed.roleId && parsed.routineKind ? (parsed as RoutineJobPayload) : null;
  } catch {
    return null;
  }
}

/** True for a background job this module runs. The worker uses it to dispatch. */
export function isRoutineJob(job: BackgroundJob): boolean {
  return job.jobKind === "ai-routine" && parsePayload(job) !== null;
}

/* ==========================================================================
   What is due
   ========================================================================== */

/** Objects of one lineage kind a routine already prepared in this scenario run. */
function preparedBy(routineId: string, outputKind: string, runId: string): Set<string> {
  const runs = listRoutineRuns({ routineId, runId, statuses: ["completed", "running", "queued"] });
  const outputs = getOutputsForRoutineRuns(runs.map((run) => run.id));
  const ids = new Set<string>();
  for (const list of outputs.values()) for (const output of list) if (output.objectKind === outputKind) ids.add(output.objectId);
  return ids;
}

function configNumber(config: Record<string, unknown>, key: string, fallback: number): number {
  const value = config[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function configText(config: Record<string, unknown>, key: string, fallback: string): string {
  const value = config[key];
  return typeof value === "string" && /^\d{1,2}:\d{2}$/.test(value) ? value : fallback;
}

/** The due windows of one routine at the scenario clock. Reads only. */
export function dueWindowsFor(kind: RoutineKind, row: AIRoutine, roleId: RoleId, state: ScenarioState): RoutineWindow[] {
  const runId = state.runId ?? DEFAULT_RUN_ID;
  const now = state.currentMoment;
  const prepared = preparedBy(row.id, ROUTINE_OUTPUT_KIND[kind], runId);
  switch (kind) {
    case "meeting-preparation":
      return meetingWindows(
        getCalendar(roleId, runId).map((entry) => ({ meetingId: entry.meetingId, kind: entry.kind, startsAt: entry.startsAt })),
        {
          now,
          scenarioDate: state.scenarioDate,
          offsetMinutes: configNumber(row.triggerConfig, "offsetMinutes", -30),
          concluded: new Set(getMeetings(roleId, runId).filter((meeting) => meeting.status === "concluded").map((meeting) => meeting.id)),
          prepared,
        },
      );
    case "action-follow-up": {
      const holder = getRole(roleId, runId)?.holderUserId ?? null;
      const candidates = followUpCandidates(getWorkActions(roleId, holder, runId), { holderUserId: holder, scenarioDate: state.scenarioDate });
      return followUpWindows(candidates, { now, time: configText(row.triggerConfig, "time", "09:00"), drafted: prepared });
    }
    case "inbox-triage":
      return triageWindows(getInbox(roleId, now, runId), { now, proposed: prepared });
    case "event-monitoring": {
      const facts: EventFact[] = listOsEvents({ runId, roleId, includeArrivals: { upToMoment: now } }).map((event) => ({
        id: event.id,
        atMoment: event.atMoment,
        origin: event.origin,
        type: event.type,
        liveEventType: typeof event.payload["liveEventType"] === "string" ? (event.payload["liveEventType"] as string) : null,
        severity: typeof event.payload["severity"] === "string" ? (event.payload["severity"] as string) : null,
        derivedFrom: typeof event.payload["derivedFrom"] === "string" ? (event.payload["derivedFrom"] as string) : null,
      }));
      return monitoringWindows(materialChanges(facts, now), { now, raised: prepared });
    }
  }
}

/**
 * Queues every due routine window as a durable job. Idempotent: a window
 * whose run exists, or whose job is queued or completed, queues nothing.
 */
export function scheduleDueRoutines(options: { runId?: string } = {}): BackgroundJob[] {
  const runId = options.runId ?? DEFAULT_RUN_ID;
  const state = getScenarioState(runId);
  if (!state) return [];
  const queued: BackgroundJob[] = [];
  const now = new Date().toISOString();
  for (const roleId of routineRolesInRelease()) {
    for (const { row, kind } of runnableRoutines(roleId, runId)) {
      let windows: RoutineWindow[];
      try {
        windows = dueWindowsFor(kind, row, roleId, state);
      } catch (error) {
        log.warn("A routine's due windows could not be read.", { routineId: row.id, error });
        continue;
      }
      for (const window of windows) {
        const key = routineRunKey(row.id, state.scenarioDate, window.windowKey);
        if (findRoutineRunByKey(key, runId)) continue;
        const payload: RoutineJobPayload = {
          kind: "routine-run",
          routineId: row.id,
          roleId,
          routineKind: kind,
          windowKey: window.windowKey,
          triggerKind: window.triggerKind,
          triggerRef: window.triggerRef,
          targets: window.targets,
          scenarioDate: state.scenarioDate,
        };
        queued.push(
          enqueueJob(
            {
              id: routineIdentities(key).jobId,
              runId,
              idempotencyKey: key,
              jobKind: "ai-routine",
              status: "pending",
              priority: 4,
              scheduledAt: now,
              attemptCount: 0,
              maxAttempts: 3,
              relatedRoleId: roleId,
              relatedObjectKind: ROUTINE_OUTPUT_KIND[kind],
              relatedObjectId: window.targets[0] ?? null,
              payload: JSON.stringify(payload),
              createdAt: now,
              updatedAt: now,
            },
            runId,
          ),
        );
      }
    }
  }
  return queued;
}

/* ==========================================================================
   Running one job
   ========================================================================== */

export type RoutineRunOutcomeKind = "created-work" | "no-change" | "needs-human" | "failed" | "retrying" | "skipped";

export interface RoutineJobResult {
  outcome: RoutineRunOutcomeKind;
  jobId: string;
  routineRunId: string | null;
  created: number;
}

interface StepOutcome {
  prepared: PreparedRoutineWork;
  blocked: ToolCallResult | null;
  failed: ToolCallResult | null;
}

async function runStep(kind: RoutineKind, payload: RoutineJobPayload, context: ToolContext, state: ScenarioState): Promise<StepOutcome> {
  const language = state.language;
  const tool = ROUTINE_TOOL[kind];
  const settle = (result: ToolCallResult) => ({
    blocked: result.outcome === "blocked" || result.outcome === "proposed" ? result : null,
    failed: result.outcome === "failed" ? result : null,
  });

  switch (kind) {
    case "meeting-preparation": {
      const result = await executeTool(tool, { meetingId: payload.targets[0] ?? "" }, { ...context, target: { kind: "meeting", id: payload.targets[0] ?? "" } });
      const status = settle(result);
      const data = result.outcome === "executed" ? (result.data as MeetingPreparationData) : null;
      return { ...status, prepared: data ? prepareMeetingBrief(data, language) : empty() };
    }
    case "action-follow-up": {
      const people = new Map(getUsers(context.runId).map((user) => [user.id, user.name]));
      const drafts: ReminderData[] = [];
      for (const actionId of payload.targets) {
        const result = await executeTool(tool, { actionId }, { ...context, target: { kind: "action", id: actionId } });
        const status = settle(result);
        if (status.blocked || status.failed) return { ...status, prepared: prepareReminders(drafts, language) };
        const action = getWorkAction(actionId, context.runId);
        if (!action) continue;
        drafts.push({
          action: {
            id: action.id,
            reference: action.reference,
            title: action.title,
            titleDe: action.titleDe,
            dueOn: action.dueOn,
            ownerName: action.ownerLabel.trim().length > 0 ? action.ownerLabel.trim() : (people.get(action.ownerUserId ?? "") ?? action.ownerUserId ?? ""),
          },
          overdue: action.dueOn !== null && action.dueOn < state.scenarioDate,
          draft: result.data as { subject: string; body: string },
        });
      }
      return { blocked: null, failed: null, prepared: prepareReminders(drafts, language) };
    }
    case "inbox-triage": {
      const result = await executeTool(tool, { messageIds: payload.targets }, context);
      const status = settle(result);
      const data = result.outcome === "executed" ? (result.data as { proposals: TriageProposalData[]; live: boolean }) : null;
      return { ...status, prepared: data ? prepareTriage(data.proposals, { language, now: state.currentMoment, live: data.live }) : empty() };
    }
    case "event-monitoring": {
      const result = await executeTool(tool, { eventIds: payload.targets }, context);
      const status = settle(result);
      const data = result.outcome === "executed" ? (result.data as { changes: MaterialChangeData[] }) : null;
      return { ...status, prepared: data ? prepareMaterialChanges(data.changes, language) : empty() };
    }
  }
}

function empty(): PreparedRoutineWork {
  return { outputs: [], subject: null, summary: { en: "", de: "" } };
}

function suggestionDraftFrom(output: RoutineOutput, toolName: string): SuggestionDraft {
  return {
    headline: output.headline,
    changeSummary: output.changeSummary,
    whyItMatters: output.whyItMatters,
    checksCompleted: output.checksCompleted,
    actionsCompleted: [],
    recommendedAction: output.recommendedAction,
    alternatives: output.alternatives,
    evidenceIds: output.evidenceIds,
    confidence: output.confidence,
    uncertainty: output.uncertainty,
    decisionRequired: false,
    recommendedToolName: toolName,
    grounding: { verifiedFacts: [], approvedRecords: [], stakeholderStatements: [], modelInference: [], conflictingEvidence: [] },
  } as SuggestionDraft;
}

/** Processes one leased routine job. The worker calls this after its own lease. */
export async function processRoutineJob(job: BackgroundJob): Promise<RoutineJobResult> {
  const payload = parsePayload(job);
  if (!payload) {
    failJob(job.id, "BAD_PAYLOAD", "The job payload is not a routine run.");
    return { outcome: "failed", jobId: job.id, routineRunId: null, created: 0 };
  }
  const runId = job.runId;
  const state = getScenarioState(runId);
  const routine = getRoutines(payload.roleId, runId).find((row) => row.id === payload.routineId);
  if (!state || !routine || routine.status !== "active") {
    completeJob(job.id, "The routine is not active, so it did not run.");
    return { outcome: "skipped", jobId: job.id, routineRunId: null, created: 0 };
  }

  const key = job.idempotencyKey;
  const ids = routineIdentities(key);
  const resolved = getResolvedDemoMode().mode;
  const mode: "safe" | "offline" = resolved === "offline" ? "offline" : "safe";
  const startedAt = new Date().toISOString();
  const { run, created } = startRoutineRun({
    id: ids.runRecordId,
    runId,
    routineId: routine.id,
    roleId: payload.roleId,
    triggerKind: payload.triggerKind,
    triggerRef: payload.triggerRef,
    status: "running",
    mode,
    configurationId: getReleasedConfig(payload.roleId, payload.routineKind)?.id ?? null,
    jobId: job.id,
    atMoment: state.currentMoment,
    startedAt,
    idempotencyKey: key,
  });
  if (!created && run.status !== "running") {
    completeJob(job.id, "The routine already ran for this window.");
    return { outcome: "skipped", jobId: job.id, routineRunId: run.id, created: 0 };
  }

  const holder = getRole(payload.roleId, runId)?.holderUserId ?? payload.roleId;
  const context: ToolContext = {
    runId,
    roleId: payload.roleId,
    autonomyLevel: state.autonomyLevel,
    actingUserId: holder,
    atMoment: state.currentMoment,
    sessionId: `routine:${run.id}`,
    actorKind: "specialist-agent",
    language: state.language,
  };
  const toolName = ROUTINE_TOOL[payload.routineKind];
  const authorityClass = TOOL_REGISTRY[toolName]?.authorityClass ?? "READ";
  const started = Date.now();

  let step: StepOutcome;
  try {
    step = await runStep(payload.routineKind, payload, context, state);
  } catch (error) {
    step = { prepared: empty(), blocked: null, failed: { toolName, outcome: "failed", summary: redactString(error instanceof Error ? error.message : "Unknown error"), evidenceIds: [], durationMs: 0 } };
  }

  /* ---- A failed step: retried, and recorded as failed once exhausted. ---- */
  if (step.failed) {
    failJob(job.id, "ROUTINE_STEP_FAILED", redactString(step.failed.summary).slice(0, 400));
    if (getJobById(job.id)?.status !== "failed") return { outcome: "retrying", jobId: job.id, routineRunId: run.id, created: 0 };
    finish({ payload, state, run: run.id, job, routine, outcome: "failed", prepared: empty(), stored: [], authorityClass, toolName, durationMs: Date.now() - started, mode, note: step.failed.summary });
    return { outcome: "failed", jobId: job.id, routineRunId: run.id, created: 0 };
  }

  /* ---- The gate refused: nothing is created, and the run says why. ---- */
  if (step.blocked) {
    finish({ payload, state, run: run.id, job, routine, outcome: "needs-human", prepared: empty(), stored: [], authorityClass, toolName, durationMs: Date.now() - started, mode, note: step.blocked.summary });
    return { outcome: "needs-human", jobId: job.id, routineRunId: run.id, created: 0 };
  }

  /* ---- Validate every candidate, in every mode. ---- */
  const evidence = new Set(
    getEvidenceDocuments([...new Set(step.prepared.outputs.flatMap((entry) => entry.candidate.evidenceIds))], runId).map((document) => document.id),
  );
  const decisions = new Set(getDecisionRefs(payload.roleId, state.currentMoment, runId).map((decision) => decision.id));
  const valid: Array<{ output: RoutineOutput; outputObjectId: string; coveredIds: string[] }> = [];
  for (const entry of step.prepared.outputs) {
    const validation = validateRoutineOutput(entry.candidate, { knownEvidenceIds: evidence, knownDecisionIds: decisions, language: state.language });
    if (validation.ok) valid.push({ output: validation.output, outputObjectId: entry.outputObjectId, coveredIds: entry.coveredIds ?? [entry.outputObjectId] });
    else log.warn("A routine output failed validation and was withheld.", { routineId: routine.id, failures: validation.failures.length });
  }

  finish({
    payload,
    state,
    run: run.id,
    job,
    routine,
    outcome: valid.length > 0 ? "created-work" : "no-change",
    prepared: step.prepared,
    stored: valid,
    authorityClass,
    toolName,
    durationMs: Date.now() - started,
    mode,
    note: valid.length < step.prepared.outputs.length ? "Some prepared output did not pass validation and was withheld." : null,
  });
  return { outcome: valid.length > 0 ? "created-work" : "no-change", jobId: job.id, routineRunId: run.id, created: valid.length };
}

const OUTCOME_SUMMARY: Record<"needs-human" | "failed", { en: string; de: string }> = {
  "needs-human": {
    en: "Not prepared: the authority gate did not allow this step at the current autonomy level. Nothing was created.",
    de: "Nicht vorbereitet: Die Berechtigungspruefung hat diesen Schritt auf der aktuellen Autonomiestufe nicht zugelassen. Es wurde nichts erstellt.",
  },
  failed: {
    en: "The routine could not complete after its retries. Nothing was created.",
    de: "Die Routine konnte nach ihren Wiederholungen nicht abgeschlossen werden. Es wurde nichts erstellt.",
  },
};

/** Stores the outcome, its lineage and its event in one transaction. */
function finish(input: {
  payload: RoutineJobPayload;
  state: ScenarioState;
  run: string;
  job: BackgroundJob;
  routine: AIRoutine;
  outcome: "created-work" | "no-change" | "needs-human" | "failed";
  prepared: PreparedRoutineWork;
  stored: Array<{ output: RoutineOutput; outputObjectId: string; coveredIds: string[] }>;
  authorityClass: AuthorityClass;
  toolName: string;
  durationMs: number;
  mode: "safe" | "offline";
  note: string | null;
}): void {
  const { payload, state } = input;
  const runId = input.job.runId;
  const ids = routineIdentities(input.job.idempotencyKey);
  const completedAt = new Date().toISOString();
  const summary =
    input.outcome === "needs-human" || input.outcome === "failed"
      ? OUTCOME_SUMMARY[input.outcome]
      : input.prepared.summary.en.length > 0
        ? input.prepared.summary
        : { en: "Checked and found nothing to prepare.", de: "Geprueft, nichts vorzubereiten." };

  getSqlite().transaction(() => {
    const suggestionIds: string[] = [];
    const outputs: NewAIRoutineRunOutput[] = [];
    input.stored.forEach((entry, index) => {
      const id = ids.suggestionId(index);
      persistSuggestion({
        id,
        runId,
        roleId: payload.roleId,
        eventId: null,
        objectType: entry.output.objectType,
        objectId: entry.output.objectId,
        atMoment: state.currentMoment,
        priority: entry.output.priority,
        decisionId: entry.output.decisionId,
        draft: suggestionDraftFrom(entry.output, input.toolName),
        authorityClass: input.authorityClass,
        source: input.mode === "offline" ? "seeded" : "cache",
        constrained: false,
        missingRequiredSources: [],
        sourceConnectorIds: [],
        stages: seededStageShape(),
        stateDigest: `routine:${input.job.idempotencyKey}:${index + 1}`,
        model: "",
        durationMs: input.durationMs,
        validatedAt: completedAt,
      });
      suggestionIds.push(id);
      for (const covered of entry.coveredIds) {
        outputs.push({ id: `${input.run}-O${String(outputs.length + 1).padStart(2, "0")}`, objectKind: ROUTINE_OUTPUT_KIND[payload.routineKind], objectId: covered, effect: "created", sortOrder: outputs.length, createdAt: completedAt });
      }
      outputs.push({ id: `${input.run}-O${String(outputs.length + 1).padStart(2, "0")}`, objectKind: "suggestion", objectId: id, effect: "created", sortOrder: outputs.length, createdAt: completedAt });
    });

    const created = suggestionIds.length;
    const { event } = publishOsEvent({
      runId,
      type: "routine-completed",
      roleId: payload.roleId,
      atMoment: state.currentMoment,
      actorKind: "ai",
      subject: created > 0 ? input.prepared.subject : null,
      correlationId: input.run,
      summary: summary,
      payload: {
        routineRunId: input.run,
        routineId: input.routine.id,
        routineKind: payload.routineKind,
        outcome: input.outcome,
        createdCount: created,
        createdIds: suggestionIds,
        windowKey: payload.windowKey,
        mode: input.mode,
        jobId: input.job.id,
        ...(input.note ? { note: redactString(input.note).slice(0, 300) } : {}),
      },
      idempotencyKey: `routine-completed:${input.run}`,
      activity: {
        kind: input.outcome === "created-work" ? "drafted" : input.outcome === "needs-human" ? "blocked" : "observed",
        label: { en: `${input.routine.name}: ${summary.en}`.slice(0, 240), de: `${input.routine.name}: ${summary.de}`.slice(0, 240) },
        detail: summary.en,
        toolName: input.toolName,
        durationMs: input.durationMs,
        outcome: input.outcome,
        authorityClass: input.authorityClass,
        evidenceIds: [...new Set(input.stored.flatMap((entry) => entry.output.evidenceIds))].slice(0, 24),
      },
    });

    completeRoutineRun(
      input.run,
      {
        status: input.outcome === "failed" ? "failed" : "completed",
        outcome: input.outcome,
        summary: summary.en,
        summaryDe: summary.de,
        completedAt,
        osEventId: event.id,
        errorRedacted: input.outcome === "failed" && input.note ? redactString(input.note).slice(0, 300) : null,
      },
      outputs,
    );

    if (created > 0) {
      recordRoutineNotification({ roleId: payload.roleId, eventId: event.id, subject: input.prepared.subject, atMoment: state.currentMoment, runId });
    }
    recordRoutineRun(input.routine.id, scenarioStamp(state));
    if (input.outcome !== "failed") completeJob(input.job.id, summary.en.slice(0, 300));
  })();
}

/* ==========================================================================
   Driving it
   ========================================================================== */

/** Leases a pending routine job by id and runs it. */
export async function runRoutineJob(jobId: string): Promise<RoutineJobResult | null> {
  const leased = leaseJobById(jobId, LEASE_OWNER, LEASE_SECONDS);
  return leased ? processRoutineJob(leased) : null;
}

/**
 * Schedules what is due and runs it, bounded. Used by the workday frame's sync
 * when no worker is running, and by tests. Returns what ran.
 */
export async function runDueRoutines(options: { runId?: string; limit?: number } = {}): Promise<RoutineJobResult[]> {
  const runId = options.runId ?? DEFAULT_RUN_ID;
  scheduleDueRoutines({ runId });
  const pending = getJobsByStatus("pending", runId).filter(isRoutineJob).slice(0, options.limit ?? 12);
  const results: RoutineJobResult[] = [];
  for (const job of pending) {
    const result = await runRoutineJob(job.id);
    if (result) results.push(result);
  }
  return results;
}
