/**
 * The Authority and Policy Gate.
 *
 * This is a deterministic service, not a language model. The model may request
 * an action; this module decides whether the action is permitted. That
 * separation is the whole point: an instruction in a document, a supplier
 * email or a meeting transcript cannot talk its way past a function that never
 * reads free text.
 *
 * Three independent conditions must all hold before a mutation executes:
 *   1. the tool's authority class is reachable at the current autonomy level
 *   2. the acting role holds the authority scope the tool requires
 *   3. where the class demands it, a valid, unconsumed, payload bound approval
 *      exists, granted by a person, with rationale confirmed
 */

import { createHash } from "node:crypto";
import type { AuthorityClass } from "@/db/schema/decisions";
import type { AutonomyLevel, RoleId } from "@/db/schema/core";

export type { AuthorityClass };

/** Authority scopes. A role holds a set of these. */
export const AUTHORITY_SCOPES = [
  "evidence.read",
  "work.read",
  "draft.create",
  "recommendation.create",
  "supplier.assess",
  "supplier.restrict",
  "rcsa.rate",
  "control.rate",
  "control.test.conclude",
  "incident.classify",
  "incident.escalate",
  "obligation.interpret",
  "portfolio.prioritise",
  "action.create",
  "monitoring.activate",
  "committee.agenda",
  "notification.recommend",
  "scenario.control",
] as const;

export type AuthorityScope = (typeof AUTHORITY_SCOPES)[number];

/** Which authority classes each autonomy level can reach at all. */
const AUTONOMY_REACHABLE_CLASSES: Record<AutonomyLevel, readonly AuthorityClass[]> = {
  assist: ["READ"],
  prepare: ["READ", "DRAFT"],
  recommend: ["READ", "DRAFT", "PROPOSE"],
  /*
   * POLICY_BOUND_AUTONOMOUS is reachable here, but only with an approval.
   *
   * This is the distinction between the two top levels, and an earlier version
   * got it wrong. Omitting the class from this list made a routine, reversible
   * action such as asking the first line to confirm a fact impossible at the
   * default autonomy level even with a human approval attached, which is
   * plainly not what "act with approval" should mean. Reachability and the
   * approval requirement are two separate questions; `evaluateAuthority`
   * answers the second one below.
   */
  "act-with-approval": [
    "READ",
    "DRAFT",
    "PROPOSE",
    "APPROVAL_REQUIRED",
    "POLICY_BOUND_AUTONOMOUS",
  ],
  "act-within-policy": [
    "READ",
    "DRAFT",
    "PROPOSE",
    "APPROVAL_REQUIRED",
    "POLICY_BOUND_AUTONOMOUS",
  ],
};

/**
 * Human readable description of each autonomy level, shown next to the
 * control so the user understands what they are changing.
 */
export const AUTONOMY_DESCRIPTIONS: Record<AutonomyLevel, { label: string; labelDe: string; detail: string }> = {
  assist: {
    label: "Assist",
    labelDe: "Unterstuetzen",
    detail: "Retrieve evidence and answer questions. No official drafting.",
  },
  prepare: {
    label: "Prepare",
    labelDe: "Vorbereiten",
    detail: "Draft records and prepare challenge questions. No changes to records.",
  },
  recommend: {
    label: "Recommend",
    labelDe: "Empfehlen",
    detail: "Recommend decisions with alternatives and uncertainty. No changes to records.",
  },
  "act-with-approval": {
    label: "Act with approval",
    labelDe: "Handeln nach Genehmigung",
    detail: "Prepare changes, pause for approval, execute only after a person approves.",
  },
  "act-within-policy": {
    label: "Act within policy",
    labelDe: "Handeln im Rahmen der Richtlinie",
    detail:
      "Execute low risk, reversible, routine actions. Material actions still require approval.",
  },
};

export interface ToolDefinition {
  name: string;
  authorityClass: AuthorityClass;
  /** Scopes the acting role must hold. All are required. */
  requiredScopes: readonly AuthorityScope[];
  /** Plain description shown in the trust page authority matrix. */
  description: string;
  /** True when the effect can be reversed within this prototype. */
  reversible: boolean;
  /** True when this tool writes to the database. */
  mutates: boolean;
  /**
   * True when the change is material. Material changes always require an
   * approval, even at the most permissive autonomy level.
   */
  material: boolean;
}

/**
 * The complete tool registry.
 *
 * Every tool the agents can call appears here exactly once. A tool that is not
 * in this registry cannot be called, which is the reason the registry, not the
 * prompt, is the security boundary.
 */
export const TOOL_REGISTRY: Readonly<Record<string, ToolDefinition>> = Object.freeze({
  /* ---- READ: retrieval and context ---- */
  getDailyBrief: r("getDailyBrief", ["work.read"], "Returns the ranked decision brief for the current role and moment."),
  getRoleContext: r("getRoleContext", ["work.read"], "Returns the acting role, entity, mandate and decision rights."),
  readInbox: r("readInbox", ["work.read"], "Reads inbox and collaboration messages visible at the current moment."),
  getCalendar: r("getCalendar", ["work.read"], "Reads calendar entries and conflicts for the current role."),
  getUpcomingMeetings: r("getUpcomingMeetings", ["work.read"], "Lists meetings and their preparation state."),
  getOpenDecisions: r("getOpenDecisions", ["work.read"], "Lists open decisions awaiting human judgment."),
  searchEvidence: r("searchEvidence", ["evidence.read"], "Hybrid lexical and semantic search over the synthetic evidence corpus."),
  getEvidenceItem: r("getEvidenceItem", ["evidence.read"], "Returns one evidence document with full provenance."),
  getAssessmentHistory: r("getAssessmentHistory", ["evidence.read"], "Returns every version of an assessment for a subject."),
  compareAssessments: r("compareAssessments", ["evidence.read"], "Returns a line by line comparison of two assessment versions."),
  getRiskControlGraph: r("getRiskControlGraph", ["evidence.read"], "Returns the process, risk and control graph for a subject."),
  getKriHistory: r("getKriHistory", ["evidence.read"], "Returns indicator readings and threshold breaches."),
  getControlTestResults: r("getControlTestResults", ["evidence.read"], "Returns a control test, its population and its exceptions."),
  getSupplierExposure: r("getSupplierExposure", ["evidence.read"], "Returns supplier, service, subprocessor and fourth party exposure."),
  getSupplierAssessment: r("getSupplierAssessment", ["evidence.read"], "Returns a supplier assessment with evidence status per obligation."),
  compareSupplierSubmissions: r("compareSupplierSubmissions", ["evidence.read"], "Compares the current and previous supplier submissions."),
  getContractObligations: r("getContractObligations", ["evidence.read"], "Returns contractual obligations and their evidence status."),
  getIncidentTimeline: r("getIncidentTimeline", ["evidence.read"], "Returns the incident chronology with provenance per entry."),
  getServiceDependencies: r("getServiceDependencies", ["evidence.read"], "Returns the service dependency graph and affected edges."),
  getPortfolioThread: r("getPortfolioThread", ["evidence.read"], "Returns one matter as seen by every contributing function."),
  getBackgroundWork: r("getBackgroundWork", ["work.read"], "Returns the background actions completed for this role."),
  getAuditTrail: r("getAuditTrail", ["work.read"], "Returns audit events for an object or the current session."),
  getApplicablePolicy: r("getApplicablePolicy", ["evidence.read"], "Returns policy sections applicable to the current work object."),

  /* ---- READ: deterministic calculators, not model judgment ---- */
  calculateRiskMatrixPosition: r("calculateRiskMatrixPosition", ["evidence.read"], "Computes a residual position on the group five by five matrix."),
  calculateToleranceRemaining: r("calculateToleranceRemaining", ["evidence.read"], "Computes impact tolerance headroom for a service."),

  /* ---- DRAFT: produces text, changes nothing ---- */
  prepareChallengeQuestions: d("prepareChallengeQuestions", ["draft.create"], "Drafts challenge questions for a meeting, grounded in cited evidence."),
  draftDecisionRationale: d("draftDecisionRationale", ["draft.create"], "Drafts a rationale for the human to edit, confirm or reject."),
  draftSupplierCommunication: d("draftSupplierCommunication", ["draft.create"], "Drafts a supplier communication. Sending is a separate approved step."),
  draftFinding: d("draftFinding", ["draft.create"], "Drafts a control assurance finding for human review."),
  draftCommitteeNarrative: d("draftCommitteeNarrative", ["draft.create"], "Drafts a consolidated committee narrative for approval."),
  summariseEndOfDay: d("summariseEndOfDay", ["draft.create"], "Drafts the end of day summary from recorded decisions and actions."),

  /* ---- PROPOSE: a recommendation with alternatives, changes nothing ---- */
  proposeControlRating: p("proposeControlRating", ["recommendation.create"], "Proposes a control effectiveness rating with supporting and opposing evidence."),
  proposeResidualRisk: p("proposeResidualRisk", ["recommendation.create"], "Proposes a residual risk position with stated uncertainty."),
  proposeFinding: p("proposeFinding", ["recommendation.create"], "Proposes a finding severity and scope for human decision."),
  proposeIncidentClassification: p("proposeIncidentClassification", ["recommendation.create"], "Proposes incident severity and classification for human decision."),
  proposeSupplierCriticality: p("proposeSupplierCriticality", ["recommendation.create"], "Proposes a supplier criticality position for human decision."),
  proposeObligationApplicability: p("proposeObligationApplicability", ["recommendation.create"], "Proposes obligation applicability per entity for human interpretation."),
  proposeAgendaPriority: p("proposeAgendaPriority", ["recommendation.create"], "Proposes a committee agenda order for the portfolio lead to decide."),

  /* ---- POLICY_BOUND_AUTONOMOUS: low risk, reversible, routine ---- */
  requestFactualValidation: a("requestFactualValidation", ["action.create"], "Sends a simulated request to first line asking for factual validation.", true),
  sendSimulatedCollaborationMessage: a("sendSimulatedCollaborationMessage", ["action.create"], "Posts a simulated internal collaboration message. Never reaches a real recipient.", true),
  requestEvidenceDocument: a("requestEvidenceDocument", ["action.create"], "Records a request for a missing evidence document.", true),
  advanceScenarioTime: a("advanceScenarioTime", ["scenario.control"], "Moves the shared timeline to a later moment.", true),
  switchRole: a("switchRole", ["scenario.control"], "Changes the acting role while retaining scenario state and audit history.", true),

  /* ---- APPROVAL_REQUIRED: material state change ---- */
  updateControlRating: m("updateControlRating", ["control.rate"], "Changes recorded control effectiveness and versions the assessment."),
  updateAssessment: m("updateAssessment", ["rcsa.rate"], "Creates a new assessment version carrying the human conclusion."),
  proposeAndRecordResidualRisk: m("proposeAndRecordResidualRisk", ["rcsa.rate"], "Records an approved residual risk position."),
  initiateReassessment: m("initiateReassessment", ["rcsa.rate"], "Creates an off cycle reassessment."),
  createAction: m("createAction", ["action.create"], "Creates a remediation or follow up action with an owner and a due date.", true),
  createIssue: m("createIssue", ["action.create"], "Raises an issue against a control, supplier or obligation.", true),
  recordSupplierAssessment: m("recordSupplierAssessment", ["supplier.assess"], "Records a supplier assessment conclusion and conditions."),
  setSupplierCriticality: m("setSupplierCriticality", ["supplier.assess"], "Changes recorded supplier criticality."),
  applySupplierRestriction: m("applySupplierRestriction", ["supplier.restrict"], "Applies a restriction or exit consideration to a supplier."),
  activateMonitoring: m("activateMonitoring", ["monitoring.activate"], "Activates enhanced monitoring on a supplier, control or indicator.", true),
  recordTestConclusion: m("recordTestConclusion", ["control.test.conclude"], "Records the human assurance conclusion on a control test."),
  classifyTestException: m("classifyTestException", ["control.test.conclude"], "Records an exception classification and whether it is systemic."),
  recordFinding: m("recordFinding", ["control.test.conclude"], "Records a finding with its human decided severity."),
  openIncident: m("openIncident", ["incident.classify"], "Opens an incident record.", true),
  classifyIncident: m("classifyIncident", ["incident.classify"], "Records human owned incident severity and classification."),
  escalateIncident: m("escalateIncident", ["incident.escalate"], "Escalates an incident to the named authority."),
  recordNotificationRecommendation: m("recordNotificationRecommendation", ["notification.recommend"], "Records a recommendation about supervisory notification. Never notifies anyone."),
  selectRecoveryOption: m("selectRecoveryOption", ["incident.escalate"], "Records the selected recovery option and its control trade off."),
  recordObligationInterpretation: m("recordObligationInterpretation", ["obligation.interpret"], "Records the human interpretation and applicability of an obligation."),
  addCommitteeAgendaItem: m("addCommitteeAgendaItem", ["committee.agenda"], "Adds an item to a committee agenda.", true),
  setPortfolioMateriality: m("setPortfolioMateriality", ["portfolio.prioritise"], "Records portfolio materiality for a cross function theme."),
  recordApproval: m("recordApproval", ["action.create"], "Records a human approval. Cannot approve itself."),
  captureLessonsLearned: m("captureLessonsLearned", ["incident.classify"], "Records lessons learned against an incident.", true),
  resetScenario: m("resetScenario", ["scenario.control"], "Restores the original seeded day.", true),

  /* ---- PROHIBITED: present so refusal is explicit and testable ---- */
  sendExternalEmail: x("sendExternalEmail", "Sending mail outside this machine is not implemented and is refused by design."),
  notifySupervisor: x("notifySupervisor", "Contacting a supervisory authority is refused by design. The product only records a recommendation."),
  writeDatabaseDirectly: x("writeDatabaseDirectly", "Direct database access is refused by design. All mutations pass through typed tools."),
  readLocalSecrets: x("readLocalSecrets", "Reading credential material is refused by design."),
  modifyAuditTrail: x("modifyAuditTrail", "The audit trail is append only. Modification is refused by design."),
  approveOwnProposal: x("approveOwnProposal", "An agent cannot grant its own approval. Approval requires a person."),
});

/* Small constructors keep the registry readable. */
function r(name: string, requiredScopes: AuthorityScope[], description: string): ToolDefinition {
  return { name, authorityClass: "READ", requiredScopes, description, reversible: true, mutates: false, material: false };
}
function d(name: string, requiredScopes: AuthorityScope[], description: string): ToolDefinition {
  return { name, authorityClass: "DRAFT", requiredScopes, description, reversible: true, mutates: false, material: false };
}
function p(name: string, requiredScopes: AuthorityScope[], description: string): ToolDefinition {
  return { name, authorityClass: "PROPOSE", requiredScopes, description, reversible: true, mutates: false, material: false };
}
function a(name: string, requiredScopes: AuthorityScope[], description: string, reversible = true): ToolDefinition {
  return { name, authorityClass: "POLICY_BOUND_AUTONOMOUS", requiredScopes, description, reversible, mutates: true, material: false };
}
function m(name: string, requiredScopes: AuthorityScope[], description: string, reversible = false): ToolDefinition {
  return { name, authorityClass: "APPROVAL_REQUIRED", requiredScopes, description, reversible, mutates: true, material: true };
}
function x(name: string, description: string): ToolDefinition {
  return { name, authorityClass: "PROHIBITED", requiredScopes: [], description, reversible: false, mutates: false, material: false };
}

/** Authority scopes held by each role. */
export const ROLE_AUTHORITY_SCOPES: Record<RoleId, readonly AuthorityScope[]> = {
  tprm: [
    "evidence.read", "work.read", "draft.create", "recommendation.create",
    "supplier.assess", "supplier.restrict", "action.create", "monitoring.activate",
    "committee.agenda", "scenario.control",
  ],
  rcsa: [
    "evidence.read", "work.read", "draft.create", "recommendation.create",
    "rcsa.rate", "control.rate", "action.create", "monitoring.activate",
    "committee.agenda", "scenario.control",
  ],
  "control-assurance": [
    "evidence.read", "work.read", "draft.create", "recommendation.create",
    "control.test.conclude", "action.create", "committee.agenda", "scenario.control",
  ],
  "incident-resilience": [
    "evidence.read", "work.read", "draft.create", "recommendation.create",
    "incident.classify", "incident.escalate", "notification.recommend",
    "action.create", "monitoring.activate", "committee.agenda", "scenario.control",
  ],
  "regulatory-change": [
    "evidence.read", "work.read", "draft.create", "recommendation.create",
    "obligation.interpret", "action.create", "committee.agenda", "scenario.control",
  ],
  "nfr-governance": [
    "evidence.read", "work.read", "draft.create", "recommendation.create",
    "portfolio.prioritise", "committee.agenda", "action.create",
    "incident.escalate", "scenario.control",
  ],
};

/** The approval context a material tool requires. */
export interface ApprovalContext {
  approvedBy: string;
  decisionId: string;
  approvedAt: string;
  rationaleConfirmed: boolean;
  role: string;
  authorityScope: string[];
  /** Binds the approval to one specific proposed change. */
  payloadFingerprint: string;
  /** Set once the approval has been used, preventing replay. */
  consumedAt?: string | null;
}

export interface AuthorityRequest {
  toolName: string;
  roleId: RoleId;
  autonomyLevel: AutonomyLevel;
  /** The proposed payload, used to compute the fingerprint. */
  payload: unknown;
  approval?: ApprovalContext | null;
  /** The user identifier on whose behalf the action is taken. */
  actingUserId: string;
}

export type AuthorityDecision =
  | { allowed: true; tool: ToolDefinition; requiresApproval: boolean; fingerprint: string }
  | { allowed: false; tool: ToolDefinition | null; reason: string; code: AuthorityDenialCode; fingerprint: string };

export type AuthorityDenialCode =
  | "unknown-tool"
  | "prohibited"
  | "autonomy-too-low"
  | "missing-scope"
  | "approval-missing"
  | "approval-not-confirmed"
  | "approval-role-mismatch"
  | "approval-decision-mismatch"
  | "approval-payload-mismatch"
  | "approval-already-consumed"
  | "approval-scope-insufficient"
  | "self-approval";

/**
 * Computes a stable fingerprint over a proposed payload.
 *
 * The approval a person grants is bound to this value, so an agent cannot get
 * approval for a small change and then execute a larger one.
 */
export function fingerprintPayload(toolName: string, payload: unknown): string {
  const canonical = canonicalise(payload);
  return createHash("sha256").update(`${toolName}:${canonical}`).digest("hex").slice(0, 32);
}

/** Order independent JSON serialisation, so key order cannot alter the hash. */
function canonicalise(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalise).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalise(v)}`).join(",")}}`;
}

/**
 * The gate. Returns a decision; it never performs the action itself.
 */
export function evaluateAuthority(request: AuthorityRequest): AuthorityDecision {
  const tool = TOOL_REGISTRY[request.toolName];
  const fingerprint = fingerprintPayload(request.toolName, request.payload);

  if (!tool) {
    return {
      allowed: false,
      tool: null,
      code: "unknown-tool",
      reason: `The tool "${request.toolName}" is not in the tool registry and cannot be called.`,
      fingerprint,
    };
  }

  // 1. Prohibited tools are never reachable, at any autonomy level.
  if (tool.authorityClass === "PROHIBITED") {
    return {
      allowed: false,
      tool,
      code: "prohibited",
      reason: tool.description,
      fingerprint,
    };
  }

  // 2. The autonomy level must be able to reach this authority class.
  const reachable = AUTONOMY_REACHABLE_CLASSES[request.autonomyLevel];
  if (!reachable.includes(tool.authorityClass)) {
    return {
      allowed: false,
      tool,
      code: "autonomy-too-low",
      reason: `The autonomy level "${AUTONOMY_DESCRIPTIONS[request.autonomyLevel].label}" cannot reach a ${tool.authorityClass} action. Raise the autonomy level to proceed.`,
      fingerprint,
    };
  }

  // 3. The acting role must hold every required scope.
  const roleScopes = ROLE_AUTHORITY_SCOPES[request.roleId];
  const missing = tool.requiredScopes.filter((scope) => !roleScopes.includes(scope));
  if (missing.length > 0) {
    return {
      allowed: false,
      tool,
      code: "missing-scope",
      reason: `The role does not hold the authority scope required for this action: ${missing.join(", ")}.`,
      fingerprint,
    };
  }

  // A non-mutating tool needs nothing further.
  if (!tool.mutates) {
    return { allowed: true, tool, requiresApproval: false, fingerprint };
  }

  /*
   * A policy bound autonomous tool may execute without approval, but only at
   * the most permissive level and only when it is genuinely low risk. Note the
   * `material` check: raising autonomy never makes a material change free.
   */
  if (tool.authorityClass === "POLICY_BOUND_AUTONOMOUS" && !tool.material) {
    if (request.autonomyLevel === "act-within-policy") {
      return { allowed: true, tool, requiresApproval: false, fingerprint };
    }
    // Below that level, the same tool still runs but only with approval.
    return validateApproval(request, tool, fingerprint);
  }

  return validateApproval(request, tool, fingerprint);
}

function validateApproval(
  request: AuthorityRequest,
  tool: ToolDefinition,
  fingerprint: string,
): AuthorityDecision {
  const approval = request.approval;

  if (!approval) {
    return {
      allowed: false,
      tool,
      code: "approval-missing",
      reason:
        "This action changes a record and requires a human approval. The proposed action has been returned instead of executed.",
      fingerprint,
    };
  }

  if (approval.consumedAt) {
    return {
      allowed: false,
      tool,
      code: "approval-already-consumed",
      reason: "This approval has already been used. A new approval is required for a further change.",
      fingerprint,
    };
  }

  if (!approval.rationaleConfirmed) {
    return {
      allowed: false,
      tool,
      code: "approval-not-confirmed",
      reason:
        "The approver must confirm they own the rationale before a material change executes.",
      fingerprint,
    };
  }

  if (approval.role !== request.roleId) {
    return {
      allowed: false,
      tool,
      code: "approval-role-mismatch",
      reason: "The approval was granted under a different role than the one now acting.",
      fingerprint,
    };
  }

  if (approval.payloadFingerprint !== fingerprint) {
    return {
      allowed: false,
      tool,
      code: "approval-payload-mismatch",
      reason:
        "The approved change and the requested change do not match. Approval does not transfer to a different payload.",
      fingerprint,
    };
  }

  const approverScopes = approval.authorityScope as AuthorityScope[];
  const missing = tool.requiredScopes.filter((scope) => !approverScopes.includes(scope));
  if (missing.length > 0) {
    return {
      allowed: false,
      tool,
      code: "approval-scope-insufficient",
      reason: `The approver does not hold the authority scope required: ${missing.join(", ")}.`,
      fingerprint,
    };
  }

  // An agent identity can never be the approver. Approval requires a person.
  if (approval.approvedBy.startsWith("agent:") || approval.approvedBy.trim().length === 0) {
    return {
      allowed: false,
      tool,
      code: "self-approval",
      reason: "Approval requires a named person. An agent cannot approve its own proposal.",
      fingerprint,
    };
  }

  return { allowed: true, tool, requiresApproval: true, fingerprint };
}

/** Tools reachable at a given autonomy level. Drives the interface. */
export function toolsAvailableAt(
  autonomyLevel: AutonomyLevel,
  roleId: RoleId,
): { available: ToolDefinition[]; withheld: Array<{ tool: ToolDefinition; reason: string }> } {
  const available: ToolDefinition[] = [];
  const withheld: Array<{ tool: ToolDefinition; reason: string }> = [];

  for (const tool of Object.values(TOOL_REGISTRY)) {
    const decision = evaluateAuthority({
      toolName: tool.name,
      roleId,
      autonomyLevel,
      payload: {},
      actingUserId: "preview",
      approval: null,
    });
    if (decision.allowed) {
      available.push(tool);
    } else if (decision.code === "approval-missing") {
      // Reachable, but gated. From the interface's point of view it is usable.
      available.push(tool);
    } else {
      withheld.push({ tool, reason: decision.reason });
    }
  }

  return { available, withheld };
}

/** All tools, for the trust page authority matrix. */
export function listToolRegistry(): ToolDefinition[] {
  return Object.values(TOOL_REGISTRY).sort((a, b) => a.name.localeCompare(b.name));
}
