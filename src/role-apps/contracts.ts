/**
 * Shared type contracts for role-app definitions and process runs.
 *
 * A role-app is a structured, stage-gated process that the AI partner guides
 * through on behalf of a named role. The types here are the public API surface
 * that the process page, the Now item on the home page, and the seed all share.
 *
 * Import order follows the project convention: types first, then constants.
 *
 * These types supersede the local definitions in the tprm/definition.ts module,
 * which carried a comment noting they would be promoted here.
 */

/* ---------------------------------------------------------------------------
   Status and maturity
   --------------------------------------------------------------------------- */

/**
 * Lifecycle state of a role-app in a given deployment.
 *
 * "installed"   The app is live in the workday and available to its role.
 * "available"   Packaged and licensed, not yet provisioned to this tenant.
 * "preview"     The app exists and can be demonstrated but is not yet shipped.
 * "disabled"    Provisioned but turned off by configuration.
 */
export type RoleAppStatus = "installed" | "available" | "preview" | "disabled";

/**
 * How production-ready the design and data of the role-app is.
 *
 * "production-shaped"  Data model, screens and interactions are complete enough
 *                      to demonstrate to a client without explanation of gaps.
 * "prototype"          The concept is clear but the experience has documented
 *                      gaps.
 * "concept"            Only the definition and seed data exist.
 */
export type RoleAppMaturity = "production-shaped" | "prototype" | "concept";

/* ---------------------------------------------------------------------------
   The stage contract
   --------------------------------------------------------------------------- */

/** One string in both interface languages. German is ASCII only, no umlauts. */
export interface Bilingual {
  en: string;
  de: string;
}

/**
 * A condition on one decision option, used to make a criterion, a tool or an
 * approval apply only when the human chose a particular path.
 *
 * Example: the outbox command that records an onboarding condition is only
 * required when the stage gate decision was "pass with conditions". An empty
 * `optionIds` list means "once the decision is recorded, whichever option".
 */
export interface StageDecisionCondition {
  decisionKey: string;
  optionIds: string[];
}

/**
 * A criterion the CompletionValidator evaluates against persisted state.
 *
 * Criteria are data, not code. The validator in `src/features/process` knows
 * how to check each kind, so a stage declares what must be true and never how
 * to check it. A criterion with a `when` clause applies only when the named
 * decision was recorded with one of the listed options.
 */
export type StageCriterion =
  | { kind: "stage-completed"; stageId: string; label: Bilingual; when?: StageDecisionCondition }
  | { kind: "sources-resolved"; label: Bilingual; when?: StageDecisionCondition }
  | { kind: "ai-job-completed"; jobKey: string; label: Bilingual; when?: StageDecisionCondition }
  | { kind: "human-task-completed"; taskKey: string; label: Bilingual; when?: StageDecisionCondition }
  | { kind: "decision-recorded"; decisionKey: string; label: Bilingual; when?: StageDecisionCondition }
  | { kind: "tool-executed"; toolKey: string; label: Bilingual; when?: StageDecisionCondition }
  | { kind: "artifact-stored"; artifactKey: string; label: Bilingual; when?: StageDecisionCondition }
  /*
   * A fact another module owns, read through a registered completion check
   * (`registerCompletionCheck`). The check is a pure function of the stage
   * context, so the record it reads must reach the context through one of the
   * stage's source loaders. Example: the challenge workshop waits for its
   * minutes to be confirmed in Meetings, which is the meetings module's record
   * and is not duplicated on the stage.
   */
  | { kind: "check"; checkKey: string; label: Bilingual; when?: StageDecisionCondition };

/**
 * A source the stage reads.
 *
 * `loader` names a source loader registered with the process engine. The
 * loader reads the database; the contract only says which source is needed
 * and whether its absence blocks the stage (it does when the source sits in
 * `requiredSources`) or merely limits the preparation (`helpfulSources`).
 */
export interface StageSourceSpec {
  key: string;
  label: Bilingual;
  /** Registered loader key, for example "rcsa.kri-readings". */
  loader: string;
  /**
   * The connector instance that supplies the source, when it comes from a
   * connected system. An unavailable connector makes the source Unavailable,
   * which parks the AI preparation as Waiting for source. Null for records the
   * product holds itself.
   */
  connectorInstanceId: string | null;
}

/** One AI job the stage runs. Every job runs as a durable background job. */
export interface StageAIJobSpec {
  key: string;
  label: Bilingual;
  /** Registered preparer key. The preparer composes offline output and the live prompt. */
  preparer: string;
  /** Released AI configuration from `src/ai/prompt-registry.ts`. */
  configurationId: string;
  /** The structured output schema the job's output must satisfy. */
  outputSchema: "stage-preparation-v1";
  /** Source keys the job reads. */
  readsSources: string[];
  /** What the job drafts, shown as "What AI prepared". */
  prepares: Bilingual[];
}

/** A piece of human work inside the stage that is not a decision. */
export interface StageHumanTaskSpec {
  key: string;
  kind: "human-review" | "human-input";
  label: Bilingual;
  instruction: Bilingual;
  required: boolean;
  /** Registered task form key. The form validates and records the input. */
  form: string;
}

/** One option of a stage decision. */
export interface StageDecisionOption {
  id: string;
  label: Bilingual;
  description: Bilingual;
  /**
   * "advance" allows the stage to complete. "hold" keeps the stage open and
   * activates the blocking condition that names this decision. A hold can be
   * revised by recording the decision again.
   */
  outcome: "advance" | "hold";
}

/**
 * A material judgment the stage requires.
 *
 * Two bindings. A seeded decision already exists in the `decisions` table and
 * is taken on the Decisions surface through the existing governed path; the
 * stage only waits for it. A stage decision is owned by the process runtime,
 * recorded on the stage with a confirmed rationale, and audited.
 */
export interface StageDecisionSpec {
  key: string;
  /** Matches `judgmentKind` on the decisions table. */
  judgmentKind: string;
  label: Bilingual;
  question: Bilingual;
  material: boolean;
  binding:
    | { kind: "seeded-decision"; decisionId: string }
    | { kind: "stage-decision"; options: StageDecisionOption[] };
}

/**
 * An approval the stage needs before a change executes.
 *
 * `covers` is either the stage completion itself or one governed tool. The
 * approval is always bound to the exact payload through the authority gate's
 * fingerprint, and it is always granted by a named person.
 */
export interface StageApprovalSpec {
  key: string;
  label: Bilingual;
  covers: { kind: "stage-completion" } | { kind: "tool"; toolKey: string };
  /** The authority registry tool that executes the approved change. */
  toolName: string;
  material: boolean;
}

/** A governed tool the stage may execute. */
export interface StageToolSpec {
  key: string;
  label: Bilingual;
  /** A real entry in `TOOL_REGISTRY`. The authority gate refuses anything else. */
  toolName: string;
  /**
   * "local" executes through the tool runtime. "outbox" is an external
   * command: it enters the integration outbox and is delivered to a connector.
   */
  channel: "local" | "outbox";
  connectorInstanceId: string | null;
  /** External object type the command writes, for the outbox channel. */
  targetExternalType: string | null;
  /** Registered payload builder key. */
  payloadBuilder: string;
  /** When the tool is offered to the human. */
  proposeWhen: "always" | StageDecisionCondition;
  /** For the outbox: whether a queued command counts, or only an acknowledged one. */
  deliveredWhen: "queued" | "acknowledged";
}

/** An artifact the stage produces. */
export interface StageArtifactSpec {
  key: string;
  /** "ai-preparation" | "evidence-pack" | "stage-record" | ... */
  kind: string;
  label: Bilingual;
  /** Which lifecycle step writes it. */
  producedBy: "ai-preparation" | "stage-completion";
  /** Registered artifact builder key, or the AI job key for a preparation artifact. */
  builder: string;
}

/** A condition that stops the stage regardless of the completion criteria. */
export type StageBlockingCondition =
  | { kind: "required-source-unavailable"; label: Bilingual }
  | { kind: "ai-job-failed"; jobKey: string; label: Bilingual }
  | { kind: "decision-held"; decisionKey: string; label: Bilingual }
  | { kind: "external-command-failed"; toolKey: string; label: Bilingual }
  | { kind: "stage-not-implemented"; label: Bilingual };

/**
 * Whether the engine can execute this stage end to end in this build.
 *
 * Recorded in data so the gap is visible to the product owner and honest to
 * the user. A stage that is not implemented still opens, still shows its
 * contract and its sources, and refuses completion with the stated reason.
 */
export interface StageImplementationStatus {
  implemented: boolean;
  /** Plain language reason when not implemented. Null when implemented. */
  reason: Bilingual | null;
  /** The workstream that owns completing it. */
  owner: string | null;
}

/**
 * The full stage contract.
 *
 * Every stage declares the twelve elements of the process engine contract
 * (plan section 4.9): entry criteria, required and helpful sources, AI jobs,
 * human tasks, decision kinds, approval requirements, tools, artifacts,
 * completion criteria, next stage and blocking conditions. `decisionKinds`
 * lives on `RoleProcessStage` because it predates the contract; `decisions`
 * carries the detail behind each kind.
 */
export interface StageContract {
  entryCriteria: StageCriterion[];
  requiredSources: StageSourceSpec[];
  helpfulSources: StageSourceSpec[];
  aiJobs: StageAIJobSpec[];
  humanTasks: StageHumanTaskSpec[];
  decisions: StageDecisionSpec[];
  approvalRequirements: StageApprovalSpec[];
  tools: StageToolSpec[];
  artifacts: StageArtifactSpec[];
  completionCriteria: StageCriterion[];
  /** The stage that opens when this one completes. Null for the last stage. */
  nextStageId: string | null;
  blockingConditions: StageBlockingCondition[];
  implementation: StageImplementationStatus;
}

/* ---------------------------------------------------------------------------
   Process definition
   --------------------------------------------------------------------------- */

/**
 * One stage of a role process.
 *
 * A stage is the unit of work the process page renders. Each stage has one
 * human responsibility (the thing only the professional can do) and a set
 * of object kinds the AI works across in that stage. Since the process engine
 * (V3.4) every stage also carries its full `StageContract`.
 */
export interface RoleProcessStage extends StageContract {
  /** Stable kebab-case slug used in routing and as the currentStageId key. */
  id: string;
  /** Zero-based display position. */
  sequence: number;
  /** English stage name. */
  name: string;
  /** German stage name. ASCII only, no umlauts. */
  nameDe: string;
  /**
   * What completing this stage produces. One sentence, concrete.
   * Describes the artefact or recorded state, not the activity.
   */
  outcome: string;
  /** German outcome. ASCII only. Optional; the English is shown where it is missing. */
  outcomeDe?: string;
  /**
   * The one thing only the human can do in this stage.
   * The AI prepares everything else; this is the authority gate.
   */
  humanResponsibility: string;
  /** German human responsibility. ASCII only. Optional; the English is shown where it is missing. */
  humanResponsibilityDe?: string;
  /**
   * The kinds of data objects the AI touches in this stage.
   * Matches the objectKind values used in the audit log and focus queue.
   */
  relatedObjectKinds: string[];
  /**
   * The judgmentKind values of decisions presented in this stage.
   * Matches the judgmentKind column on the decisions table.
   */
  decisionKinds: string[];
}

/** A structured multi-stage process owned by one role. */
export interface RoleProcessDefinition {
  /** Stable kebab-case identifier. */
  id: string;
  /** The role that owns this process. */
  roleId: "rcsa" | "tprm";
  /** English process name. */
  name: string;
  /** German process name. ASCII only, no umlauts. */
  nameDe: string;
  /** One paragraph description of what the process achieves and why. */
  description: string;
  /** Ordered stages. sequence on each stage is the canonical order. */
  stages: RoleProcessStage[];
}

/* ---------------------------------------------------------------------------
   Role-app definition
   --------------------------------------------------------------------------- */

/**
 * A packaged role-app that implements a process for a specific role.
 *
 * One process definition can be implemented by more than one role-app (for
 * example, a simplified version and an advanced version). The role-app is what
 * gets installed; the process definition is what it implements.
 */
export interface RoleAppDefinition {
  /** Stable kebab-case identifier. Unique across all role-apps. */
  id: string;
  /** The role this app is installed for. */
  roleId: "rcsa" | "tprm";
  /** The function pack this app belongs to. */
  functionPackId: string;
  /** English display name. */
  name: string;
  /** German display name. ASCII only, no umlauts. */
  nameDe: string;
  /** One sentence summary for the app store. English. */
  summary: string;
  /** One sentence summary for the app store. German. ASCII only, no umlauts. */
  summaryDe: string;
  /** Current lifecycle status. */
  status: RoleAppStatus;
  /** Design and data maturity. */
  maturity: RoleAppMaturity;
  /** Semantic version string, for example "1.0.0". */
  version: string;
  /**
   * The route this app opens to when launched from the home page.
   * Null when the app is not yet routed (preview or concept maturity).
   */
  entryRoute: string | null;
  /** The process definition this app implements. */
  processId: string;
  /** The stage IDs the app covers. Subset of the process stage IDs. */
  coveredStageIds: string[];
  /** Connector packs that must be provisioned for this app to function. */
  requiredConnectorPackIds: string[];
  /**
   * The judgmentKind values of decisions the app surfaces.
   * Carried here for display in the app store; authoritative on the decision rows.
   */
  humanDecisionKinds: string[];
  /**
   * The authority registry tool that completes one stage of this app.
   *
   * Installed apps only. Stage completion is a material outcome, so it runs
   * through `executeTool` with a payload bound approval like every other
   * material change. The process engine refuses to complete a stage of an app
   * that does not name one.
   */
  stageCompletionToolName?: string;
  /**
   * The `data-presentation-region` value on the stage workspace. Kept stable
   * because the released deck captures select on it.
   */
  workspaceRegion?: string;
}

/* ---------------------------------------------------------------------------
   Role-app run
   --------------------------------------------------------------------------- */

/**
 * The status of a role-app run.
 *
 * "not-started"          The run has been created but not yet entered.
 * "in-progress"          The run is active and at least one stage is underway.
 * "waiting-for-input"    The AI has prepared a stage and is waiting for the
 *                        human to provide information before it can continue.
 * "waiting-for-approval" A consequence requires a human approval before it can
 *                        be executed.
 * "completed"            All stages have been completed and the process is
 *                        closed.
 * "blocked"              The run cannot proceed without a configuration change
 *                        or a missing connector response.
 */
export type RoleAppRunStatus =
  | "not-started"
  | "in-progress"
  | "waiting-for-input"
  | "waiting-for-approval"
  | "completed"
  | "blocked";

/**
 * A live instance of a role-app process, for one subject at one point in time.
 *
 * A run is the object the process page renders. The home page Now item links to
 * the run's current stage when an in-progress run exists.
 */
export interface RoleAppRun {
  /** Stable identifier for this run. */
  id: string;
  /** The role-app being run. */
  roleAppId: string;
  /** The role that owns this run. */
  roleId: "rcsa" | "tprm";
  /**
   * The kind of object the run is about.
   * For RCSA this is "assessment"; for TPRM onboarding this is "supplier".
   */
  subjectKind: string;
  /** The identifier of the subject object. */
  subjectId: string;
  /** The stage the run is currently on. Must be a valid stage ID from the process. */
  currentStageId: string;
  /** Current run status. */
  status: RoleAppRunStatus;
  /** ISO timestamp when the run was started. */
  startedAt: string;
  /** ISO timestamp when the run was last updated. */
  updatedAt: string;
  /** ISO timestamp when the run completed, or null if still in progress. */
  completedAt: string | null;
}
