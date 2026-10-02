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
   Process definition
   --------------------------------------------------------------------------- */

/**
 * One stage of a role process.
 *
 * A stage is the unit of work the process page renders. Each stage has one
 * human responsibility -- the thing only the professional can do -- and a set
 * of object kinds the AI works across in that stage.
 */
export interface RoleProcessStage {
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
  /**
   * The one thing only the human can do in this stage.
   * The AI prepares everything else; this is the authority gate.
   */
  humanResponsibility: string;
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
