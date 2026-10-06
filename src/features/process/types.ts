/**
 * Runtime types for the process engine.
 *
 * The stage contract (what a stage requires) lives in `src/role-apps/contracts.ts`
 * because it is part of the Role App definition. The types here describe what
 * the engine knows about one stage of one run at one moment: the loaded
 * sources, the state of the AI preparation, the tasks, decisions, approvals,
 * tools and artifacts, and the result of validating all of that against the
 * contract.
 *
 * Nothing here is rendered directly. `view.ts` projects a `StageContext` onto
 * the `StageView` the workspace renders.
 */

import type { RoleId } from "@/db/schema/core";
import type { StageInputSourceKind } from "@/db/schema/process-inputs";
import type {
  Bilingual,
  RoleAppDefinition,
  RoleProcessDefinition,
  RoleProcessStage,
  StageDecisionSpec,
  StageSourceSpec,
} from "@/role-apps/contracts";
import type {
  PersistedRoleAppRun,
  RoleAppArtifact,
  RoleAppStageRun,
  RoleAppStageTask,
} from "@/db/repositories/role-app-runtime";
import type { BackgroundJob } from "@/db/repositories/background-jobs";
import type { ScenarioState } from "@/scenario/engine/state";
import type { DemoMode } from "@/server/config/demo-mode";
import type { StagePreparationOutput } from "./preparation-schema";

/* ==========================================================================
   Sources
   ========================================================================== */

/**
 * The status of one source, as the SourceLoader determined it.
 *
 * "loaded"       Records were read.
 * "empty"        The read succeeded and returned nothing. A finding, not a gap.
 * "stale"        Records were read and at least one is marked stale.
 * "unavailable"  The source could not be read: its system is unavailable, or no
 *                loader is implemented for it in this build.
 */
export type SourceStatus = "loaded" | "empty" | "stale" | "unavailable";

/** One record a source loader returns, compact enough to show and to cite. */
export interface SourceRecord {
  id: string;
  label: string;
  /** Short status or value, for example "Red, 3.84" or "requested". */
  value: string;
  /** Evidence document ids that support this record. */
  evidenceIds: string[];
  /** Free structured detail the stage preparer may use. Never shown raw. */
  facts?: Record<string, string | number | boolean | null>;
}

/** What a registered loader returns. */
export interface SourceLoadResult {
  status: Exclude<SourceStatus, "unavailable"> | "unavailable";
  records: SourceRecord[];
  /** Evidence document ids referenced by any record. */
  evidenceIds: string[];
  /** The freshest date in the records, ISO date. */
  asOf: string | null;
  /** Plain language note, for example why an empty result is expected. */
  note: Bilingual | null;
}

export interface LoadedSource {
  spec: StageSourceSpec;
  necessity: "required" | "helpful";
  status: SourceStatus;
  result: SourceLoadResult;
  /** "simulated", "live", "sandbox-ready" or null for records the product holds itself. */
  connectorMode: string | null;
  connectorName: string | null;
  /** Why the source is unavailable, when it is. */
  unavailableReason: Bilingual | null;
}

/* ==========================================================================
   Stage inputs
   ========================================================================== */

/**
 * A record a person attached to the stage as input (migration 0008): an
 * inbox message, confirmed minutes or a document. Read from
 * `process_stage_inputs` by the context builder, with the title of the record
 * it names, so the stage can show what it was given and by whom.
 */
export interface StageInput {
  id: string;
  sourceKind: StageInputSourceKind;
  sourceId: string;
  /** The record's own title. Null when the record it names cannot be found. */
  label: Bilingual | null;
  /** Who the record is from, for a message its sender. */
  from: string | null;
  addedByUserId: string | null;
  addedAt: string;
  addedAtMoment: string;
  note: string;
  osEventId: string | null;
  auditEventId: string | null;
}

/* ==========================================================================
   AI preparation
   ========================================================================== */

/**
 * The user-facing states of a durable AI preparation job (plan section 8.2).
 *
 * "not-started" exists only for a stage whose preparation has never been
 * queued, and "unavailable" for a stage whose preparer is not implemented.
 * Neither is a spinner: both say what is true.
 */
export type PreparationState =
  | "not-started"
  | "queued"
  | "running"
  | "waiting-for-source"
  | "waiting-for-approval"
  | "retrying"
  | "completed"
  | "failed"
  | "unavailable";

/** Where a validated preparation came from. */
export type PreparationSource = "live" | "cache" | "composed";

export interface PreparationStatus {
  state: PreparationState;
  jobId: string | null;
  attempts: number;
  /** Plain language reason for a held, retrying or failed state. */
  reason: string | null;
  /** The mode the output was produced in, once completed. */
  mode: DemoMode | null;
  source: PreparationSource | null;
  /** The validated output, once completed. */
  output: StagePreparationOutput | null;
  artifactId: string | null;
  completedAt: string | null;
}

/* ==========================================================================
   Decisions
   ========================================================================== */

export interface DecisionOptionView {
  id: string;
  label: Bilingual;
  description: Bilingual;
  outcome: "advance" | "hold";
  /** What choosing this option changes, in plain language. */
  consequences: Bilingual[];
  isRecommended: boolean;
}

export interface DecisionState {
  spec: StageDecisionSpec;
  /** The decisions table row id for a seeded decision; the stage task id for a stage decision. */
  recordId: string | null;
  status: "pending" | "recorded";
  chosenOptionId: string | null;
  outcome: "advance" | "hold" | null;
  rationale: string | null;
  decidedByUserId: string | null;
  decidedAt: string | null;
  options: DecisionOptionView[];
  /** The prepared position, cited, shown before the human chooses. */
  preparedPosition: Bilingual | null;
  uncertainty: Bilingual | null;
  /** True when the decision can be revised (a recorded hold). */
  revisable: boolean;
}

/* ==========================================================================
   Tools
   ========================================================================== */

export type ToolTaskState =
  | "not-applicable"
  | "proposed"
  | "executed"
  | "queued"
  | "acknowledged"
  | "failed"
  | "blocked";

export interface ToolState {
  key: string;
  state: ToolTaskState;
  /** True when this state satisfies the contract's delivery rule. */
  satisfied: boolean;
  summary: string | null;
  commandId: string | null;
  receiptId: string | null;
  externalId: string | null;
  approvalId: string | null;
  auditEventId: string | null;
}

/* ==========================================================================
   The stage context
   ========================================================================== */

/**
 * Everything the engine knows about one stage of one run.
 *
 * Built by the StageContextBuilder from persisted state only. The validator is
 * a pure function of this object, which is what makes "Continue does not
 * bypass criteria" testable without a browser.
 */
export interface StageContext {
  runId: string;
  state: ScenarioState;
  mode: DemoMode;
  app: RoleAppDefinition;
  process: RoleProcessDefinition;
  stage: RoleProcessStage;
  run: PersistedRoleAppRun;
  roleId: RoleId;
  /** The person who holds the run's role. Approvals are granted in their name. */
  actingUserId: string;
  stageRun: RoleAppStageRun | null;
  completedStageIds: string[];
  tasks: RoleAppStageTask[];
  artifacts: RoleAppArtifact[];
  job: BackgroundJob | null;
  sources: LoadedSource[];
  /** What people attached to this stage as input, oldest first. */
  inputs: StageInput[];
  preparation: PreparationStatus;
  decisions: DecisionState[];
  tools: ToolState[];
}

/* ==========================================================================
   Validation
   ========================================================================== */

export interface CriterionResult {
  kind: string;
  label: Bilingual;
  /** False when a `when` clause does not apply. A criterion that does not apply is not shown. */
  applies: boolean;
  met: boolean;
  /** Why it is not met, in plain language. Null when met. */
  reason: Bilingual | null;
}

export interface BlockingResult {
  kind: string;
  label: Bilingual;
  active: boolean;
  detail: Bilingual | null;
}

export interface StageValidation {
  entry: CriterionResult[];
  completion: CriterionResult[];
  blocking: BlockingResult[];
  entryMet: boolean;
  /** True when every applicable completion criterion is met and nothing blocks. */
  canComplete: boolean;
  /** Why Continue is disabled, in plain language, most important first. */
  reasons: Bilingual[];
}
