/**
 * AIStagePreparation: lifecycle steps 4 and 5, prepare the stage and validate
 * the output.
 *
 * Every preparation is a durable background job (`background_jobs`, kind
 * "ai-preparation", payload kind "stage-preparation"). The job survives a
 * refresh and a restart because it is a row: a server that dies mid-attempt
 * leaves a lease that expires, the next resume or the worker releases it, and
 * the attempt is retried. The user always sees one of the plan's states
 * (section 8.2), derived from the row in `./derive.ts`: Queued, Running,
 * Waiting for source, Waiting for approval, Retrying, Completed or Failed.
 *
 * The mode branch, and why validation sits after it:
 *
 *   live      the model is asked for the stage preparation schema in strict
 *             JSON schema mode. Same code path as the other modes up to the
 *             call. Never reached in safe or offline mode.
 *   safe      the validated preparation captured for the seeded day is served
 *             from `cached_ai_outputs`, provided the sources it was captured
 *             from are unchanged. If they changed, it is composed afresh and
 *             the note says so.
 *   offline   the stage's composer builds the preparation from the loaded
 *             sources. No model.
 *
 * All three candidates pass through `validatePreparation`, so cited evidence
 * must resolve to a loaded source whatever produced it. A live candidate that
 * fails falls back to the cache and then to composition, and the fallback is
 * recorded on the output rather than hidden.
 */

import { and, eq } from "drizzle-orm";
import { getDb, getSqlite } from "@/db/client";
import { cachedAiOutputs } from "@/db/schema/decisions";
import { backgroundJobs } from "@/db/schema/background-jobs";
import {
  completeJob,
  enqueueJob,
  failJob,
  getJobById,
  leaseJobById,
  parkJob,
  releaseExpiredLeases,
  unparkJob,
  type BackgroundJob,
} from "@/db/repositories/background-jobs";
import {
  ensureStageTask,
  getStageTask,
  setStageRunPreparation,
  updateStageTask,
  type PersistedRoleAppRun,
  type RoleAppStageRun,
} from "@/db/repositories/role-app-runtime";
import type { RoleId } from "@/db/schema/core";
import type { RoleProcessStage } from "@/role-apps/contracts";
import { getResolvedDemoMode } from "@/server/config/runtime";
import type { DemoMode } from "@/server/config/demo-mode";
import { getOpenAIClient, probeModelAvailability } from "@/server/openai/client";
import { getResolvedModels } from "@/server/config/models";
import { createLogger, redactString } from "@/server/logging/redact";
import { publishOsEvent } from "@/features/events/backbone";
import { digestContent, storeArtifact } from "./artifacts";
import { buildStageContext } from "./context";
import { eventKey, preparationJobKeys, taskKey } from "./keys";
import { getPreparer, type PreparerInput } from "./registry";
import { knownEvidenceIds, loadStageSources, unavailableRequiredSources } from "./sources";
import {
  stagePreparationJsonSchema,
  validatePreparation,
  type StagePreparationOutput,
} from "./preparation-schema";
import type { LoadedSource, PreparationSource, StageContext } from "./types";
import type { PreparationArtifactContent } from "./derive";

const log = createLogger("process-preparation");

const LEASE_SECONDS = 60;
const LEASE_OWNER = `process-engine-${process.pid}`;

export interface StagePreparationJobPayload {
  kind: "stage-preparation";
  processRunId: string;
  stageId: string;
  stageRunId: string;
  jobKey: string;
  /** True when a person started the preparation, which an "Assist" autonomy level requires. */
  humanStarted: boolean;
}

/* ==========================================================================
   Enqueue
   ========================================================================== */

/**
 * Queues the preparation of a stage. Synchronous, so it joins the caller's
 * transaction: opening a stage and queuing its preparation commit together.
 *
 * Returns null for a stage with no AI job or no registered preparer, which is
 * recorded on the job task as the reason rather than queued to fail.
 */
export function enqueueStagePreparation(params: {
  runId: string;
  run: PersistedRoleAppRun;
  stage: RoleProcessStage;
  stageRun: RoleAppStageRun;
  generation: number;
  humanStarted: boolean;
  at?: string;
}): BackgroundJob | null {
  const job = params.stage.aiJobs[0];
  if (!job || !getPreparer(job.preparer) || !params.stage.implementation.implemented) return null;

  const keys = preparationJobKeys(params.stageRun.id, params.generation);
  const now = params.at ?? new Date().toISOString();
  const payload: StagePreparationJobPayload = {
    kind: "stage-preparation",
    processRunId: params.run.id,
    stageId: params.stage.id,
    stageRunId: params.stageRun.id,
    jobKey: job.key,
    humanStarted: params.humanStarted,
  };

  const row = enqueueJob(
    {
      id: keys.id,
      runId: params.runId,
      idempotencyKey: keys.idempotencyKey,
      jobKind: "ai-preparation",
      status: "pending",
      priority: 3,
      scheduledAt: now,
      attemptCount: 0,
      maxAttempts: 3,
      relatedRoleId: params.run.roleId,
      relatedProcessRunId: params.run.id,
      relatedObjectKind: "process-stage",
      relatedObjectId: params.stageRun.id,
      payload: JSON.stringify(payload),
      createdAt: now,
      updatedAt: now,
    },
    params.runId,
  );

  setStageRunPreparation(params.stageRun.id, { preparationJobId: row.id, status: "ready" });
  return row;
}

/* ==========================================================================
   The model seam
   ========================================================================== */

export interface PreparationModelRequest {
  instructions: string;
  input: string;
  schema: Record<string, unknown>;
  schemaName: string;
}

export type PreparationModel = (
  request: PreparationModelRequest,
) => Promise<{ output: unknown; model: string } | { error: string }>;

/**
 * The live model call. Reached only in live mode, through the one client
 * factory that may read the credential. Every failure returns an error the
 * caller falls back from; provider error text is redacted on the way out.
 */
export const livePreparationModel: PreparationModel = async (request) => {
  const client = getOpenAIClient();
  if (client === null) return { error: "Live calls are not permitted in the current mode." };
  try {
    await probeModelAvailability();
    const models = getResolvedModels();
    const response = await client.responses.create({
      model: models.primary,
      instructions: request.instructions,
      input: request.input,
      text: { format: { type: "json_schema", name: request.schemaName, strict: true, schema: request.schema } },
      max_output_tokens: 8_000,
    });
    const text = response.output_text;
    if (typeof text !== "string" || text.trim().length === 0) return { error: "The model returned no content." };
    try {
      return { output: JSON.parse(text) as unknown, model: models.primary };
    } catch {
      return { error: "The model returned content that is not a single JSON object." };
    }
  } catch (error) {
    return { error: redactString(error instanceof Error ? error.message : "Unknown error") };
  }
};

/* ==========================================================================
   Safe mode cache
   ========================================================================== */

export function preparationBeatKey(processId: string, stageId: string): string {
  return `stage-preparation:${processId}:${stageId}`;
}

/** A digest of what the sources returned, so a cache entry knows what it was captured from. */
export function sourceDigest(sources: readonly LoadedSource[]): string {
  return digestContent(
    sources.map((source) => ({
      key: source.spec.key,
      status: source.status,
      records: source.result.records.map((record) => [record.id, record.value, record.evidenceIds]),
    })),
  );
}

interface CachedPreparation {
  output: unknown;
  sourceDigest: string;
}

function readCachedPreparation(runId: string, processId: string, stageId: string): CachedPreparation | null {
  const row = getDb()
    .select()
    .from(cachedAiOutputs)
    .where(and(eq(cachedAiOutputs.runId, runId), eq(cachedAiOutputs.beatKey, preparationBeatKey(processId, stageId))))
    .get();
  if (!row) return null;
  const payload = row.payload as Partial<CachedPreparation>;
  if (typeof payload.sourceDigest !== "string") return null;
  return { output: payload.output, sourceDigest: payload.sourceDigest };
}

/**
 * Captures the validated preparation of the seeded day into the safe mode
 * cache. Called by the seed only. Refuses to cache output that does not
 * validate, so presenter safe mode cannot serve something offline mode would
 * reject.
 */
export function captureSeededPreparation(context: StageContext, capturedAt: string): void {
  const job = context.stage.aiJobs[0];
  const preparer = job ? getPreparer(job.preparer) : undefined;
  if (!job || !preparer) return;

  const input: PreparerInput = { context, sources: context.sources };
  const output = preparer.compose(input);
  const validation = validatePreparation(output, {
    stage: context.stage,
    knownEvidenceIds: knownEvidenceIds(context.sources),
    knownItemIds: new Set(preparer.itemIds(input)),
  });
  if (!validation.ok) {
    throw new Error(
      `The seeded preparation for ${context.stage.id} does not validate: ${validation.failures.map((failure) => `${failure.path} ${failure.message}`).join("; ")}`,
    );
  }

  const beatKey = preparationBeatKey(context.process.id, context.stage.id);
  getDb()
    .insert(cachedAiOutputs)
    .values({
      id: `CACHE-${beatKey}`,
      runId: context.runId,
      beatKey,
      roleId: context.roleId,
      schemaName: "stage-preparation-v1",
      payload: { output: validation.output, sourceDigest: sourceDigest(context.sources) },
      capturedFromModel: null,
      capturedAt,
      seeded: true,
      simulatedLatencyMs: 0,
    })
    .run();
}

/* ==========================================================================
   Running a job
   ========================================================================== */

export type PreparationRunOutcome =
  | "completed"
  | "waiting-for-source"
  | "waiting-for-approval"
  | "retrying"
  | "failed"
  | "skipped";

export interface PreparationRunResult {
  outcome: PreparationRunOutcome;
  jobId: string;
  detail: string;
}

export interface PreparationRunOptions {
  /** The live model. Tests inject a fake; the default is the real client. */
  model?: PreparationModel;
  /** Overrides the resolved mode. Tests use this to run all three modes. */
  mode?: DemoMode;
}

function parsePayload(job: BackgroundJob): StagePreparationJobPayload | null {
  if (!job.payload) return null;
  try {
    const parsed = JSON.parse(job.payload) as Partial<StagePreparationJobPayload>;
    return parsed.kind === "stage-preparation" && parsed.processRunId && parsed.stageId && parsed.stageRunId
      ? (parsed as StagePreparationJobPayload)
      : null;
  } catch {
    return null;
  }
}

/** True for a background job this module handles. The worker uses it to dispatch. */
export function isStagePreparationJob(job: BackgroundJob): boolean {
  return job.jobKind === "ai-preparation" && parsePayload(job) !== null;
}

/** Leases a pending preparation job by id and runs it. */
export async function runPreparationJob(jobId: string, options: PreparationRunOptions = {}): Promise<PreparationRunResult> {
  const existing = getJobById(jobId);
  if (!existing) return { outcome: "skipped", jobId, detail: "The job does not exist." };
  releaseExpiredLeases(existing.runId);
  const leased = leaseJobById(jobId, LEASE_OWNER, LEASE_SECONDS);
  if (!leased) {
    return { outcome: "skipped", jobId, detail: `The job is ${getJobById(jobId)?.status ?? "missing"}, not pending.` };
  }
  return processPreparationJob(leased, options);
}

function stageLabel(context: StageContext): { en: string; de: string } {
  return { en: context.stage.name, de: context.stage.nameDe };
}

/**
 * Processes one leased preparation job. The worker calls this directly after
 * its own lease; everything else goes through `runPreparationJob`.
 */
export async function processPreparationJob(
  job: BackgroundJob,
  options: PreparationRunOptions = {},
): Promise<PreparationRunResult> {
  const payload = parsePayload(job);
  if (!payload) {
    failJob(job.id, "BAD_PAYLOAD", "The job payload is not a stage preparation.");
    return { outcome: "failed", jobId: job.id, detail: "Bad payload." };
  }

  let context: StageContext;
  try {
    context = buildStageContext({ processRunId: payload.processRunId, stageId: payload.stageId, runId: job.runId });
  } catch (error) {
    failJob(job.id, "CONTEXT_UNAVAILABLE", redactString(error instanceof Error ? error.message : "Unknown error"));
    return { outcome: "failed", jobId: job.id, detail: "The stage context could not be built." };
  }

  const stageRun = context.stageRun;
  if (!stageRun || stageRun.id !== payload.stageRunId || stageRun.status === "completed") {
    completeJob(job.id, "The stage was completed or replaced before the preparation ran. Nothing was prepared.");
    return { outcome: "skipped", jobId: job.id, detail: "Stage no longer open." };
  }

  const spec = context.stage.aiJobs.find((candidate) => candidate.key === payload.jobKey);
  const preparer = spec ? getPreparer(spec.preparer) : undefined;
  if (!spec || !preparer) {
    failJob(job.id, "NOT_IMPLEMENTED", "No preparer is registered for this stage in this build.");
    return { outcome: "failed", jobId: job.id, detail: "No preparer." };
  }

  const common = {
    runId: context.runId,
    roleId: context.roleId as RoleId,
    atMoment: context.state.currentMoment,
    subject: { kind: context.run.subjectKind, id: context.run.subjectId },
    process: { runId: context.run.id, stageId: context.stage.id },
    correlationId: stageRun.id,
  };

  /* ---- Waiting for approval: the autonomy level does not allow drafting unasked. ---- */
  if (context.state.autonomyLevel === "assist" && !payload.humanStarted) {
    const reason =
      'The autonomy level is "Assist", at which the product does not prepare drafts automatically. Start the preparation to proceed.';
    getSqlite().transaction(() => {
      parkJob(job.id, "waiting-for-approval", reason);
      setStageRunPreparation(stageRun.id, { status: "ready" });
      publishOsEvent({
        ...common,
        type: "ai-preparation-held",
        actorKind: "ai",
        summary: {
          en: `Preparation of ${context.stage.name} is waiting for a person to start it.`,
          de: `Die Vorbereitung von ${context.stage.nameDe} wartet darauf, von einer Person gestartet zu werden.`,
        },
        payload: { jobId: job.id, state: "waiting-for-approval" },
        idempotencyKey: eventKey.preparationHeld(job.id, "approval", job.attemptCount),
        activity: {
          kind: "waiting",
          label: { en: `Waiting to prepare ${context.stage.name}`, de: `Wartet auf Vorbereitung von ${context.stage.nameDe}` },
          detail: reason,
          durationMs: 0,
          outcome: "waiting-for-approval",
          authorityClass: "DRAFT",
        },
      });
    })();
    return { outcome: "waiting-for-approval", jobId: job.id, detail: reason };
  }

  /* ---- Load the sources, measured. ---- */
  const loadStarted = Date.now();
  const sources = loadStageSources({ runId: context.runId, state: context.state, run: context.run, stage: context.stage });
  const loadMs = Date.now() - loadStarted;

  const missing = unavailableRequiredSources(sources);
  if (missing.length > 0) {
    const names = missing.map((source) => source.spec.label.en).join(", ");
    const reason = `Waiting for a required source: ${names}.`;
    getSqlite().transaction(() => {
      parkJob(job.id, "waiting-for-source", reason);
      setStageRunPreparation(stageRun.id, { status: "blocked" });
      publishOsEvent({
        ...common,
        type: "ai-preparation-held",
        actorKind: "ai",
        summary: {
          en: `Preparation of ${context.stage.name} is waiting for ${names}.`,
          de: `Die Vorbereitung von ${context.stage.nameDe} wartet auf ${missing.map((source) => source.spec.label.de).join(", ")}.`,
        },
        payload: { jobId: job.id, state: "waiting-for-source", sources: missing.map((source) => source.spec.key) },
        idempotencyKey: eventKey.preparationHeld(job.id, "source", job.attemptCount),
        activity: {
          kind: "waiting",
          label: { en: `Waiting for ${names}`, de: `Wartet auf ${missing.map((source) => source.spec.label.de).join(", ")}` },
          detail: reason,
          durationMs: loadMs,
          outcome: "waiting-for-source",
          authorityClass: "READ",
        },
      });
    })();
    return { outcome: "waiting-for-source", jobId: job.id, detail: reason };
  }

  const recordCount = sources.reduce((total, source) => total + source.result.records.length, 0);
  getSqlite().transaction(() => {
    setStageRunPreparation(stageRun.id, { status: "ai-preparing" });
    publishOsEvent({
      ...common,
      type: "ai-preparation-started",
      actorKind: "ai",
      summary: {
        en: `Preparing ${context.stage.name}: read ${recordCount} record(s) from ${sources.length} source(s).`,
        de: `Vorbereitung von ${context.stage.nameDe}: ${recordCount} Datensaetze aus ${sources.length} Quellen gelesen.`,
      },
      payload: { jobId: job.id, attempt: job.attemptCount, recordCount, sourceCount: sources.length },
      idempotencyKey: eventKey.preparationStarted(job.id, job.attemptCount),
      activity: {
        kind: "retrieved",
        label: { en: `Read the sources for ${context.stage.name}`, de: `Quellen fuer ${context.stage.nameDe} gelesen` },
        detail: `Returned ${recordCount} record(s) from ${sources.length} source(s).`,
        durationMs: loadMs,
        outcome: recordCount === 0 ? "empty" : "ok",
        authorityClass: "READ",
        evidenceIds: [...knownEvidenceIds(sources)].slice(0, 24),
      },
    });
  })();

  /* ---- The mode branch. ---- */
  const prepareStarted = Date.now();
  const input: PreparerInput = { context: { ...context, sources }, sources };
  const validationContext = {
    stage: context.stage,
    knownEvidenceIds: knownEvidenceIds(sources),
    knownItemIds: new Set(preparer.itemIds(input)),
  };
  const mode = options.mode ?? getResolvedDemoMode().mode;

  let accepted: { output: StagePreparationOutput; source: PreparationSource; mode: DemoMode; model: string | null } | null = null;
  const notes: string[] = [];

  if (mode === "live") {
    const { instructions, input: prompt } = preparer.prompt(input);
    const live = await (options.model ?? livePreparationModel)({
      instructions,
      input: prompt,
      schema: stagePreparationJsonSchema(),
      schemaName: "nfr_stage_preparation",
    });
    if ("error" in live) {
      notes.push(`Live preparation was not used: ${live.error}`);
    } else {
      const validation = validatePreparation(live.output, validationContext);
      if (validation.ok) accepted = { output: validation.output, source: "live", mode: "live", model: live.model };
      else notes.push(`Live output did not validate: ${validation.failures[0]?.message ?? "unknown failure"}`);
    }
  }

  if (!accepted && (mode === "safe" || mode === "live")) {
    const cached = readCachedPreparation(context.runId, context.process.id, context.stage.id);
    if (cached && cached.sourceDigest === sourceDigest(sources)) {
      const validation = validatePreparation(cached.output, validationContext);
      if (validation.ok) accepted = { output: validation.output, source: "cache", mode: "safe", model: null };
      else notes.push("The cached preparation no longer validates against the loaded sources.");
    } else {
      notes.push(
        cached
          ? "The sources changed since the cached preparation was captured, so it was composed from the current sources."
          : "No cached preparation exists for this stage, so it was composed from the loaded sources.",
      );
    }
  }

  if (!accepted) {
    const composed = preparer.compose(input);
    const validation = validatePreparation(composed, validationContext);
    if (validation.ok) {
      accepted = { output: validation.output, source: "composed", mode: mode === "offline" ? "offline" : mode, model: null };
    } else {
      const first = validation.failures[0];
      const detail = `The preparation did not validate: ${first ? `${first.path} ${first.message}` : "unknown failure"}`;
      log.warn("A stage preparation failed validation.", { jobId: job.id, failures: validation.failures.length });
      failJob(job.id, "VALIDATION_FAILED", detail);
      const after = getJobById(job.id);
      if (after?.status === "failed") {
        getSqlite().transaction(() => {
          setStageRunPreparation(stageRun.id, { status: "blocked" });
          publishOsEvent({
            ...common,
            type: "ai-preparation-failed",
            actorKind: "ai",
            summary: {
              en: `Preparation of ${context.stage.name} failed after ${after.attemptCount} attempt(s).`,
              de: `Die Vorbereitung von ${context.stage.nameDe} ist nach ${after.attemptCount} Versuchen fehlgeschlagen.`,
            },
            payload: { jobId: job.id, detail },
            idempotencyKey: eventKey.preparationFailed(job.id),
            activity: {
              kind: "blocked",
              label: { en: `Preparation of ${context.stage.name} failed`, de: `Vorbereitung von ${context.stage.nameDe} fehlgeschlagen` },
              detail,
              durationMs: Date.now() - prepareStarted,
              outcome: "failed",
              authorityClass: "DRAFT",
            },
          });
        })();
        return { outcome: "failed", jobId: job.id, detail };
      }
      return { outcome: "retrying", jobId: job.id, detail };
    }
  }

  /* ---- Persist, in one transaction. ---- */
  const durationMs = Date.now() - prepareStarted;
  const validatedAt = new Date().toISOString();
  const artifactSpec = context.stage.artifacts.find((artifact) => artifact.producedBy === "ai-preparation");
  const content: PreparationArtifactContent = {
    output: accepted.output,
    mode: accepted.mode,
    source: accepted.source,
    validatedAt,
    jobId: job.id,
    fallbackNote: notes.length > 0 ? notes.join(" ") : null,
  };
  const outcome = accepted;

  getSqlite().transaction(() => {
    const { artifact } = storeArtifact({
      runId: context.runId,
      roleAppRunId: context.run.id,
      stageId: context.stage.id,
      stageRunId: stageRun.id,
      artifactKey: artifactSpec?.key ?? spec.key,
      artifactKind: artifactSpec?.kind ?? "ai-preparation",
      label: artifactSpec?.label ?? spec.label,
      content: content as unknown as Record<string, unknown>,
      producedBy: "ai-preparation",
      mode: outcome.mode,
      createdByUserId: null,
      createdAt: validatedAt,
    });

    setStageRunPreparation(stageRun.id, { aiOutputId: artifact.id, status: "waiting-for-input" });

    const jobTask = getStageTask(stageRun.id, taskKey.job(spec.key));
    const ensured = jobTask
      ? { task: jobTask }
      : ensureStageTask({
          id: `TASK-${stageRun.id}-job-${spec.key}`,
          runId: context.runId,
          stageRunId: stageRun.id,
          taskKey: taskKey.job(spec.key),
          taskKind: "ai-job",
          label: spec.label.en,
          status: "pending",
          requiredForCompletion: true,
          createdAt: validatedAt,
        });
    updateStageTask(ensured.task.id, {
      status: "completed",
      completedAt: validatedAt,
      statusReason: null,
      output: JSON.stringify({ jobId: job.id, artifactId: artifact.id, mode: outcome.mode, source: outcome.source }),
    });

    completeJob(job.id, `Stage preparation validated (${outcome.mode}, ${outcome.source}).`);

    const cited = new Set<string>();
    for (const finding of outcome.output.findings) for (const id of finding.evidenceIds) cited.add(id);

    publishOsEvent({
      ...common,
      type: "ai-preparation-completed",
      actorKind: "ai",
      summary: {
        en: `${context.stage.name} prepared and validated: ${outcome.output.findings.length} finding(s), ${outcome.output.gaps.length} gap(s), ${outcome.output.contradictions.length} contradiction(s).`,
        de: `${context.stage.nameDe} vorbereitet und geprueft: ${outcome.output.findings.length} Feststellungen, ${outcome.output.gaps.length} Luecken, ${outcome.output.contradictions.length} Widersprueche.`,
      },
      payload: { jobId: job.id, artifactId: artifact.id, mode: outcome.mode, source: outcome.source, model: outcome.model },
      idempotencyKey: eventKey.preparationCompleted(job.id),
      audit: {
        category: "tool-call",
        action: "prepareProcessStage",
        objectKind: "process-stage",
        objectId: stageRun.id,
        actorKind: "specialist-agent",
        authorityClass: "DRAFT",
        reversible: true,
      },
      activity: {
        kind: "drafted",
        label: { en: `Prepared ${stageLabel(context).en}`, de: `${stageLabel(context).de} vorbereitet` },
        detail: outcome.output.summary.en,
        toolName: "prepareProcessStage",
        durationMs,
        outcome: `${outcome.mode}:${outcome.source}`,
        authorityClass: "DRAFT",
        evidenceIds: [...cited].slice(0, 24),
      },
    });

    for (const decision of context.stage.decisions) {
      publishOsEvent({
        ...common,
        type: "decision-requested",
        actorKind: "system",
        summary: {
          en: `Decision requested: ${decision.label.en}.`,
          de: `Entscheidung angefordert: ${decision.label.de}.`,
        },
        payload: { decisionKey: decision.key, judgmentKind: decision.judgmentKind, binding: decision.binding.kind },
        idempotencyKey: eventKey.decisionRequested(stageRun.id, decision.key),
      });
    }
  })();

  return { outcome: "completed", jobId: job.id, detail: `${outcome.mode}:${outcome.source}` };
}

/* ==========================================================================
   Restart and resume
   ========================================================================== */

/**
 * Starts or restarts the preparation of a stage on a person's request.
 *
 * Waiting for approval: the person starting it is the approval, so the job is
 * marked human-started and returned to the queue. Waiting for source: the job
 * is returned to the queue and the source check runs again. Failed: a new
 * generation is queued, because a failed job is a record of what happened
 * and is not reused.
 */
export function restartStagePreparation(context: StageContext): { jobId: string | null; message: { en: string; de: string } } {
  const stageRun = context.stageRun;
  if (!stageRun) return { jobId: null, message: { en: "The stage is not open.", de: "Die Stufe ist nicht geoeffnet." } };
  const job = context.job;

  if (job && (job.status === "waiting-for-approval" || job.status === "waiting-for-source")) {
    const payload = parsePayload(job);
    getSqlite().transaction(() => {
      if (payload && job.status === "waiting-for-approval") {
        getDb()
          .update(backgroundJobs)
          .set({ payload: JSON.stringify({ ...payload, humanStarted: true }) })
          .where(eq(backgroundJobs.id, job.id))
          .run();
      }
      unparkJob(job.id);
    })();
    return { jobId: job.id, message: { en: "The preparation was started.", de: "Die Vorbereitung wurde gestartet." } };
  }

  if (!job || job.status === "failed" || job.status === "cancelled") {
    const generation = job ? Number(/-G(\d+)$/.exec(job.id)?.[1] ?? "1") + 1 : 1;
    const created = getSqlite().transaction(() =>
      enqueueStagePreparation({
        runId: context.runId,
        run: context.run,
        stage: context.stage,
        stageRun,
        generation,
        humanStarted: true,
      }),
    )();
    return created
      ? { jobId: created.id, message: { en: "A new preparation was queued.", de: "Eine neue Vorbereitung wurde eingeplant." } }
      : { jobId: null, message: { en: "This stage cannot be prepared in this build.", de: "Diese Stufe kann in diesem Build nicht vorbereitet werden." } };
  }

  return { jobId: job.id, message: { en: "The preparation is already queued or complete.", de: "Die Vorbereitung ist bereits eingeplant oder abgeschlossen." } };
}

/**
 * Returns a job parked for a source to the queue when every required source
 * is readable again, and publishes the source change that released it.
 */
export function releaseIfSourcesReturned(context: StageContext): boolean {
  const job = context.job;
  if (!job || job.status !== "waiting-for-source" || !context.stageRun) return false;
  if (unavailableRequiredSources(context.sources).length > 0) return false;

  const stageRun = context.stageRun;
  getSqlite().transaction(() => {
    unparkJob(job.id);
    publishOsEvent({
      runId: context.runId,
      type: "source-changed",
      roleId: context.roleId,
      atMoment: context.state.currentMoment,
      actorKind: "system",
      subject: { kind: context.run.subjectKind, id: context.run.subjectId },
      process: { runId: context.run.id, stageId: context.stage.id },
      correlationId: stageRun.id,
      summary: {
        en: `The required sources for ${context.stage.name} are available again. The preparation resumes.`,
        de: `Die erforderlichen Quellen fuer ${context.stage.nameDe} sind wieder verfuegbar. Die Vorbereitung wird fortgesetzt.`,
      },
      payload: { jobId: job.id },
      idempotencyKey: eventKey.sourceChanged(job.id, `a${job.attemptCount}-m${job.maxAttempts}`),
    });
  })();
  return true;
}
