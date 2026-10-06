/**
 * The stage implementation registry.
 *
 * The stage contract is data; the code that satisfies it is registered here
 * under the keys the contract names. Five kinds of code:
 *
 *   source loaders     read one source from the database
 *   preparers          compose the offline preparation and the live prompt
 *   task forms         validate and record one piece of human input
 *   payload builders   build the exact payload of one governed tool
 *   artifact builders  build an artifact the stage writes at completion
 *
 * and, where a stage needs them, decision rules, completion checks (a
 * criterion that reads another module's record, such as confirmed minutes)
 * and completion hooks (work the completion starts in its own transaction,
 * such as the run of an event-driven reassessment).
 *
 * A stage implementation module (for example
 * `src/role-apps/rcsa/stages/evidence-refresh.ts`) registers its code at
 * import time. `./implementations.ts` imports every stage module, so the
 * engine only has to import that one file.
 *
 * Registering a key twice throws under test, for the same reason the tool
 * runtime does: a second registration would silently replace the first, and
 * which one ran would depend on import order. See `registerOnce` for why a
 * development server is allowed to replace.
 */

import type { z } from "zod";
import type { Bilingual } from "@/role-apps/contracts";
import type { ScenarioState } from "@/scenario/engine/state";
import type { PersistedRoleAppRun } from "@/db/repositories/role-app-runtime";
import type { RoleProcessStage } from "@/role-apps/contracts";
import type { LoadedSource, SourceLoadResult, StageContext } from "./types";
import type { StagePreparationOutput } from "./preparation-schema";

/* ==========================================================================
   Source loaders
   ========================================================================== */

export interface SourceLoaderContext {
  runId: string;
  state: ScenarioState;
  run: PersistedRoleAppRun;
  stage: RoleProcessStage;
}

export type SourceLoader = (context: SourceLoaderContext) => SourceLoadResult;

/* ==========================================================================
   Preparers
   ========================================================================== */

export interface PreparerInput {
  context: StageContext;
  sources: LoadedSource[];
}

export interface StagePreparer {
  /**
   * The offline path. Deterministic, grounded only in the loaded sources, and
   * subject to exactly the same validation as live output.
   */
  compose(input: PreparerInput): StagePreparationOutput;
  /** The live path: instructions and the grounded input block for the model. */
  prompt(input: PreparerInput): { instructions: string; input: string };
  /** Identifiers of the items the preparation may assess, for validation. */
  itemIds(input: PreparerInput): string[];
}

/* ==========================================================================
   Task forms
   ========================================================================== */

/**
 * A form row the generic stage workspace renders: one item, one choice, and
 * optionally a note and a date. Every task form describes itself in these
 * terms, so the workspace renders any stage's form without knowing it.
 */
export interface TaskFormRow {
  id: string;
  label: string;
  /** What the AI proposed or why the item matters. Shown as help, never submitted for the user. */
  detail: string | null;
  choice: { name: string; options: Array<{ value: string; label: string }>; value: string };
  note: { name: string; value: string; placeholder: string } | null;
  date: { name: string; value: string; label: string } | null;
}

export interface TaskFormLayout {
  rows: TaskFormRow[];
  overall: { name: string; value: string; label: string } | null;
}

export interface TaskForm<T = unknown> {
  /** Parses the submitted fields. Field names are the form's own. */
  schema: z.ZodType<T>;
  /** The rows to render, filled from the recorded input or, failing that, the defaults. */
  fields(context: StageContext, language: "en" | "de", current: T | null): TaskFormLayout;
  /** Converts submitted form data into the object the schema parses. */
  fromFormData(data: FormData, context: StageContext): unknown;
  /** Content rules beyond the schema. Returns the reasons the input is refused. */
  validate(context: StageContext, input: T): Bilingual[];
  /**
   * The input the AI preparation proposes. The workspace does not prefill a
   * form from it (the proposals are shown as help beside each row, and
   * choosing is the person's work); tests and scripts use it to drive a stage.
   */
  defaults(context: StageContext): T | null;
  /** The recorded input in plain language, for the workspace and the stage record. */
  summarise(context: StageContext, input: T): Bilingual[];
}

/* ==========================================================================
   Payload builders and artifact builders
   ========================================================================== */

export interface ToolPayload {
  payload: Record<string, unknown>;
  /** Shown to the approver and used as the receipt statement. */
  intentStatement: Bilingual;
  /** The canonical object the command concerns, for the outbox. */
  sourceCanonicalType: string;
  sourceCanonicalId: string;
  targetExternalId?: string | null;
  decisionId?: string | null;
}

export type PayloadBuilder = (context: StageContext) => ToolPayload | { unavailable: Bilingual };

export interface BuiltArtifact {
  label: Bilingual;
  content: Record<string, unknown>;
}

export type ArtifactBuilder = (context: StageContext) => BuiltArtifact;

/* ==========================================================================
   Decision rules
   ========================================================================== */

/** Optional stage-specific rules for its decisions. */
export interface DecisionRules {
  /** Refuses an option that contradicts recorded input. Null when the option is allowed. */
  validateOption?(context: StageContext, decisionKey: string, optionId: string): Bilingual | null;
  /** What an option changes, in plain language, for a stage decision. */
  consequences?(context: StageContext, decisionKey: string, optionId: string): Bilingual[];
}

/* ==========================================================================
   Completion checks and completion hooks
   ========================================================================== */

export interface CompletionCheckResult {
  met: boolean;
  /** Why it is not met, in plain language. Null when met. */
  reason: Bilingual | null;
}

/**
 * A completion criterion of kind "check": a fact another module owns.
 *
 * Pure, like the rest of the CompletionValidator: it reads the stage context
 * and nothing else, so the same answer is given to the workspace, the
 * completion action and the completion handler. The record it needs reaches
 * the context through a source loader.
 */
export type CompletionCheck = (context: StageContext) => CompletionCheckResult;

/** What a completion hook did besides completing the stage, for the receipt and the person. */
export interface CompletionFollowOn {
  summary: Bilingual;
  receipt: string[];
  payload: Record<string, unknown>;
}

/**
 * Work a stage's completion starts inside the completion transaction, after
 * the stage is completed and the next stage is opened (or the run completed).
 * Synchronous, so it commits or rolls back with the completion. Whatever it
 * writes must already be covered by the completion record the person
 * approved: the hook re-derives it from the same context, it decides nothing.
 */
export type CompletionHook = (input: { context: StageContext; at: string }) => CompletionFollowOn | null;

/* ==========================================================================
   The registry
   ========================================================================== */

const sourceLoaders = new Map<string, SourceLoader>();
const preparers = new Map<string, StagePreparer>();
const taskForms = new Map<string, TaskForm<unknown>>();
const payloadBuilders = new Map<string, PayloadBuilder>();
const artifactBuilders = new Map<string, ArtifactBuilder>();
const decisionRules = new Map<string, DecisionRules>();
const completionChecks = new Map<string, CompletionCheck>();
const completionHooks = new Map<string, CompletionHook>();

/**
 * Registers a key once.
 *
 * Under test a second registration throws, which is where an accidental
 * collision between two stage modules is caught. Outside test it replaces the
 * first: a development server that re-evaluates an edited stage module must
 * pick up the new code rather than fail on its own hot reload.
 */
function registerOnce<T>(map: Map<string, T>, kind: string, key: string, value: T): void {
  if (map.has(key) && process.env.NODE_ENV === "test") {
    throw new Error(`A ${kind} is already registered under "${key}".`);
  }
  map.set(key, value);
}

export function registerSourceLoader(key: string, loader: SourceLoader): void {
  registerOnce(sourceLoaders, "source loader", key, loader);
}

export function registerPreparer(key: string, preparer: StagePreparer): void {
  registerOnce(preparers, "preparer", key, preparer);
}

export function registerTaskForm<T>(key: string, form: TaskForm<T>): void {
  registerOnce(taskForms, "task form", key, form as TaskForm<unknown>);
}

export function registerPayloadBuilder(key: string, builder: PayloadBuilder): void {
  registerOnce(payloadBuilders, "payload builder", key, builder);
}

export function registerArtifactBuilder(key: string, builder: ArtifactBuilder): void {
  registerOnce(artifactBuilders, "artifact builder", key, builder);
}

/** Keyed by `<processId>:<stageId>`. */
export function registerDecisionRules(processId: string, stageId: string, rules: DecisionRules): void {
  registerOnce(decisionRules, "decision rule set", `${processId}:${stageId}`, rules);
}

export const getSourceLoader = (key: string): SourceLoader | undefined => sourceLoaders.get(key);
export const getPreparer = (key: string): StagePreparer | undefined => preparers.get(key);
export const getTaskForm = (key: string): TaskForm<unknown> | undefined => taskForms.get(key);
export const getPayloadBuilder = (key: string): PayloadBuilder | undefined => payloadBuilders.get(key);
export const getArtifactBuilder = (key: string): ArtifactBuilder | undefined => artifactBuilders.get(key);
export const getDecisionRules = (processId: string, stageId: string): DecisionRules | undefined =>
  decisionRules.get(`${processId}:${stageId}`);

export function registerCompletionCheck(key: string, check: CompletionCheck): void {
  registerOnce(completionChecks, "completion check", key, check);
}

/** Keyed by `<processId>:<stageId>`. */
export function registerCompletionHook(processId: string, stageId: string, hook: CompletionHook): void {
  registerOnce(completionHooks, "completion hook", `${processId}:${stageId}`, hook);
}

export const getCompletionCheck = (key: string): CompletionCheck | undefined => completionChecks.get(key);
export const getCompletionHook = (processId: string, stageId: string): CompletionHook | undefined =>
  completionHooks.get(`${processId}:${stageId}`);

/**
 * Whether every key a stage contract names has code behind it.
 *
 * The contract's own `implementation.implemented` flag is the product claim;
 * this is the build's ability to honour it. The workspace treats a stage as
 * executable only when both are true, so a contract that says "implemented"
 * while a loader is missing fails visibly rather than half working.
 */
export function missingImplementations(stage: RoleProcessStage): string[] {
  const missing: string[] = [];
  for (const source of [...stage.requiredSources, ...stage.helpfulSources]) {
    if (!sourceLoaders.has(source.loader)) missing.push(`source loader ${source.loader}`);
  }
  for (const job of stage.aiJobs) {
    if (!preparers.has(job.preparer)) missing.push(`preparer ${job.preparer}`);
  }
  for (const task of stage.humanTasks) {
    if (!taskForms.has(task.form)) missing.push(`task form ${task.form}`);
  }
  for (const tool of stage.tools) {
    if (!payloadBuilders.has(tool.payloadBuilder)) missing.push(`payload builder ${tool.payloadBuilder}`);
  }
  for (const artifact of stage.artifacts) {
    if (artifact.producedBy === "stage-completion" && !artifactBuilders.has(artifact.builder)) {
      missing.push(`artifact builder ${artifact.builder}`);
    }
  }
  for (const criterion of [...stage.entryCriteria, ...stage.completionCriteria]) {
    if (criterion.kind === "check" && !completionChecks.has(criterion.checkKey)) {
      missing.push(`completion check ${criterion.checkKey}`);
    }
  }
  return missing;
}
