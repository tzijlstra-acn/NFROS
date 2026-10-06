/**
 * The decision and consequence engine.
 *
 * A decision in this product is not a label change. Choosing an option runs
 * that option's declared consequences through the governed tool path, and the
 * receipt the user sees afterwards is assembled from the mutations that
 * actually succeeded.
 *
 * Two properties are worth stating explicitly, because they are the reason
 * this module exists rather than the model deciding what to do:
 *
 *   1. The consequences are declared in seeded data, not inferred at runtime.
 *      The model can argue about which option is right; it cannot invent what
 *      an option does.
 *
 *   2. Each consequence gets its own approval, fingerprinted to its own
 *      payload. Approving a rating change does not silently authorise the
 *      committee escalation that travels with it.
 *
 * And three properties added after the TPRM defect recorded as J20, where a
 * decision was written as decided while every consequence was refused under
 * the wrong approver and the analyst was told nothing:
 *
 *   3. A decision is executed as the role that owns it, and every approval is
 *      granted by that role's holder. A caller that states another acting role
 *      is refused before anything is written.
 *
 *   4. A consequence the gate would refuse is found before the decision is
 *      written, by the same plan the workspace shows. A decision is never put
 *      on the record with consequences that were never going to run.
 *
 *   5. What actually happened is stated separately: the changes that executed
 *      (receipt lines), and the ones that did not (an outcome record in the
 *      audit trail, with the reason). Both survive a refresh.
 */

import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  approvals,
  decisionOptions,
  decisions,
  executionReceiptLines,
} from "@/db/schema/decisions";
import { roles, type RoleId } from "@/db/schema/core";
import { DECISION_OUTCOME_ACTION } from "@/db/repositories/decisions";
import { executeTool, type ToolContext } from "@/agents/tools/runtime";
import "@/agents/tools/mutations";
import {
  evaluateAuthority,
  fingerprintPayload,
  ROLE_AUTHORITY_SCOPES,
  type AuthorityDenialCode,
} from "@/server/security/authority";
import { recordAuditEvent } from "@/server/security/audit";
import { publishOsEvent } from "@/features/events/backbone";
import { requireScenarioState } from "./state";
import { findDecisionProcessBinding } from "./decision-links";
import { createLogger } from "@/server/logging/redact";

const log = createLogger("decide");
const db = () => getDb();

/** Maps a role to the person who holds it, used only if the roles table has no row. */
const ROLE_HOLDERS: Record<RoleId, string> = {
  tprm: "P-002",
  rcsa: "P-003",
  "control-assurance": "P-004",
  "incident-resilience": "P-005",
  "regulatory-change": "P-006",
  "nfr-governance": "P-001",
};

/**
 * The person who holds a role in this run.
 *
 * Read from the roles table, which is also where the workspace reads the name
 * it shows as the approver, so the name on the screen and the identifier on
 * the approval row cannot disagree. The constant map is the fallback for a run
 * whose roles have not been seeded.
 */
export function roleHolderUserId(roleId: RoleId, runId: string): string {
  const row = db()
    .select({ holder: roles.holderUserId })
    .from(roles)
    .where(and(eq(roles.runId, runId), eq(roles.id, roleId)))
    .get();
  return row?.holder ?? ROLE_HOLDERS[roleId];
}

export interface Consequence {
  kind: string;
  targetId: string;
  value?: string;
  note?: string;
}

/**
 * Translates a declared consequence into a tool name and payload.
 *
 * An unknown consequence kind returns null rather than throwing, and the
 * caller records it as not executed. A seeded typo should degrade the receipt,
 * not break the user's decision.
 */
function mapConsequence(
  consequence: Consequence,
  context: { decisionId: string; entityId: string; roleId: RoleId },
): { toolName: string; payload: Record<string, unknown> } | null {
  const base = { decisionId: context.decisionId, entityId: context.entityId };

  switch (consequence.kind) {
    case "set-control-effectiveness":
      return {
        toolName: "updateControlRating",
        payload: { ...base, controlId: consequence.targetId, effectiveness: consequence.value ?? "partially-effective" },
      };

    case "version-assessment":
      return {
        toolName: "updateAssessment",
        payload: {
          ...base,
          assessmentId: consequence.targetId,
          residualRisk: consequence.value ?? "",
          conclusion: consequence.note ?? "",
          rationale: consequence.note ?? "",
        },
      };

    case "set-residual-risk": {
      const [likelihood, impact] = (consequence.value ?? "3,3").split(",").map((n) => Number(n.trim()));
      return {
        toolName: "proposeAndRecordResidualRisk",
        payload: {
          ...base,
          assessmentLineId: consequence.targetId,
          residualLikelihood: likelihood ?? 3,
          residualImpact: impact ?? 3,
          commentary: consequence.note ?? "",
        },
      };
    }

    case "create-reassessment":
      return {
        toolName: "initiateReassessment",
        payload: { ...base, subjectId: consequence.targetId, subjectKind: "process", scope: consequence.note ?? "" },
      };

    case "create-action":
      return {
        toolName: "createAction",
        payload: {
          ...base,
          title: consequence.value ?? consequence.note ?? "Remediation action",
          description: consequence.note ?? "",
          relatedObjectId: consequence.targetId,
          relatedObjectKind: "control",
          kind: "remediation",
          dueOn: "2026-11-14",
        },
      };

    case "create-issue":
      return {
        toolName: "createIssue",
        payload: {
          ...base,
          title: consequence.value ?? "Issue",
          description: consequence.note ?? "",
          relatedObjectId: consequence.targetId,
        },
      };

    case "add-committee-item":
      return {
        toolName: "addCommitteeAgendaItem",
        payload: {
          ...base,
          title: consequence.value ?? "Item for the committee",
          summary: consequence.note ?? "",
          relatedObjectId: consequence.targetId,
          relatedObjectKind: "decision",
        },
      };

    case "activate-monitoring":
      return {
        toolName: "activateMonitoring",
        payload: {
          ...base,
          subjectId: consequence.targetId,
          subjectKind: consequence.value ?? "supplier",
          description: consequence.note ?? "",
          reviewFrequency: "weekly",
          nextReviewOn: "2026-10-13",
        },
      };

    case "send-collaboration-message":
      return {
        toolName: "sendSimulatedCollaborationMessage",
        payload: {
          ...base,
          subject: consequence.value ?? "Update from NFR",
          body: consequence.note ?? "",
          relatedObjectId: consequence.targetId,
          toUserIds: ["P-007", "P-008"],
        },
      };

    case "request-factual-validation":
      return {
        toolName: "requestFactualValidation",
        payload: {
          ...base,
          question: consequence.note ?? "Please confirm the factual position.",
          topic: consequence.value ?? "open point",
          relatedObjectId: consequence.targetId,
          toUserIds: ["P-007"],
        },
      };

    case "set-supplier-criticality":
      return {
        toolName: "setSupplierCriticality",
        payload: { ...base, supplierId: consequence.targetId, criticality: consequence.value ?? "critical" },
      };

    case "record-supplier-assessment":
      return {
        toolName: "recordSupplierAssessment",
        payload: {
          ...base,
          supplierId: consequence.targetId,
          conclusion: consequence.value ?? "Conditional approval",
          rationale: consequence.note ?? "",
        },
      };

    case "apply-supplier-restriction":
      return {
        toolName: "applySupplierRestriction",
        payload: { ...base, supplierId: consequence.targetId, restriction: consequence.value ?? "under-reassessment" },
      };

    case "record-test-conclusion":
      return {
        toolName: "recordTestConclusion",
        payload: { ...base, controlTestId: consequence.targetId, conclusion: consequence.value ?? "" },
      };

    case "classify-test-exception":
      return {
        toolName: "classifyTestException",
        payload: {
          ...base,
          testCaseId: consequence.targetId,
          classification: consequence.value ?? "control-failure",
          scope: consequence.note ?? "indeterminate",
        },
      };

    case "record-finding":
      return {
        toolName: "recordFinding",
        payload: {
          ...base,
          title: consequence.value ?? "Finding",
          description: consequence.note ?? "",
          controlTestId: consequence.targetId,
          severity: "medium",
        },
      };

    case "classify-incident":
      return {
        toolName: "classifyIncident",
        payload: {
          ...base,
          incidentId: consequence.targetId,
          severity: consequence.value ?? "medium",
          regulatoryClassification: consequence.note ?? "",
        },
      };

    case "escalate-incident":
      return {
        toolName: "escalateIncident",
        payload: { ...base, incidentId: consequence.targetId, escalateTo: consequence.value ?? "P-013" },
      };

    case "record-notification-recommendation":
      return {
        toolName: "recordNotificationRecommendation",
        payload: {
          ...base,
          incidentId: consequence.targetId,
          recommended: consequence.value === "true" || consequence.value === "recommend",
          rationale: consequence.note ?? "",
        },
      };

    case "select-recovery-option":
      return {
        toolName: "selectRecoveryOption",
        payload: { ...base, recoveryOptionId: consequence.targetId },
      };

    case "capture-lessons-learned":
      return {
        toolName: "captureLessonsLearned",
        payload: { ...base, incidentId: consequence.targetId, lessonsLearned: consequence.note ?? "" },
      };

    case "record-obligation-interpretation":
      return {
        toolName: "recordObligationInterpretation",
        payload: {
          ...base,
          obligationId: consequence.targetId,
          applicabilityDecision: consequence.value ?? "applicable",
          rationale: consequence.note ?? "",
          ownerUserId: "P-006",
          implementationPriority: "medium",
        },
      };

    case "set-portfolio-materiality":
      return {
        toolName: "setPortfolioMateriality",
        payload: { ...base, themeId: consequence.targetId, materiality: consequence.value ?? "high" },
      };

    case "request-evidence":
      return {
        toolName: "requestEvidenceDocument",
        payload: {
          ...base,
          documentDescription: consequence.value ?? "Evidence document",
          relatedObjectId: consequence.targetId,
          dueOn: "2026-10-20",
        },
      };

    default:
      return null;
  }
}

export interface GrantApprovalInput {
  decisionId: string;
  toolName: string;
  payloadFingerprint: string;
  rationale: string;
  rationaleConfirmed: true;
  /**
   * The role under which the approval is granted. Its holder is the approver.
   *
   * The decision engine always passes the role that owns the decision. A
   * standalone caller that omits it gets the scenario's active role, which is
   * the reading the trust page and the tool tests rely on.
   */
  roleId?: RoleId;
}

/**
 * Monotonic sequence for approval identifiers.
 *
 * An earlier version combined the millisecond clock with a random suffix,
 * which collided when two approvals were granted inside the same millisecond.
 * That is not a rare case: one decision grants an approval per consequence, so
 * a seven step chain grants seven approvals in a tight loop. A random suffix
 * also made the identifier non-deterministic for no benefit.
 */
let approvalSequence = 0;

/** Records a human approval bound to one specific payload. */
export function grantApproval(input: GrantApprovalInput): string {
  const state = requireScenarioState();

  /*
   * Who approves.
   *
   * This was an open accountability question for a long time, and leaving it
   * open is what produced J20. `recordDecisionAndExecute` executed as the
   * decision's role while this granted as the scenario's ACTIVE role, and the
   * V3.3 shell never switches the active role (the role is the route). So a
   * Third-Party Risk Manager recording a third-party decision had every
   * approval attributed to the Operational Risk Partner, and the authority
   * gate, correctly, refused every consequence with `approval-role-mismatch`.
   * The decision row had already been written as decided.
   *
   * The product's reading is now settled: a decision's approvals are granted
   * by the holder of the role that owns the decision, because that person is
   * accountable for it and is the one recording it. The decision engine
   * always passes that role. A caller that grants an approval outside a
   * decision and names no role keeps the earlier behaviour, the active role,
   * because a standalone approval has no owning decision role to read.
   */
  const roleId = input.roleId ?? state.activeRoleId;
  const approvedBy = roleHolderUserId(roleId, state.runId);
  approvalSequence += 1;
  const id = `APR-${Date.now().toString(36).toUpperCase()}-${String(approvalSequence).padStart(5, "0")}`;

  db()
    .insert(approvals)
    .values({
      id,
      runId: state.runId,
      decisionId: input.decisionId,
      /* Since migration 0005 every approval names what it is about; here, the decision. */
      targetKind: "decision",
      targetId: input.decisionId,
      toolName: input.toolName,
      authorityClass: "APPROVAL_REQUIRED",
      approvedByUserId: approvedBy,
      roleId,
      authorityScope: [...ROLE_AUTHORITY_SCOPES[roleId]],
      approvedAt: new Date().toISOString(),
      approvedAtMoment: state.currentMoment,
      rationaleConfirmed: input.rationaleConfirmed,
      rationale: input.rationale,
      autonomyLevel: state.autonomyLevel,
      consumedAt: null,
      payloadFingerprint: input.payloadFingerprint,
    })
    .run();

  recordAuditEvent({
    runId: state.runId,
    atMoment: state.currentMoment,
    category: "approval",
    action: "recordApproval",
    objectKind: "approval",
    objectId: id,
    summary: `${approvedBy} approved the action "${input.toolName}" and confirmed the rationale as their own.`,
    actorUserId: approvedBy,
    actorKind: "human",
    roleId,
    decisionId: input.decisionId,
    approvalId: id,
    reversible: true,
  });

  return id;
}

/**
 * Execution order for a consequence chain.
 *
 * Some consequences read state that an earlier consequence writes. Versioning
 * an assessment copies each line's control effectiveness from the control row,
 * so if the version is created before the rating change lands, the new version
 * carries the old rating and the chain silently produces a wrong record.
 *
 * Rather than depend on every seeded chain being written in the right order,
 * the engine sorts. The rule is: change the underlying objects first, then
 * capture them into a versioned record, then create the follow-up work, then
 * notify. Anything unlisted keeps its declared position at the end.
 */
const CONSEQUENCE_ORDER: readonly string[] = [
  // 1. Change the object a later step will read.
  "set-control-effectiveness",
  "set-supplier-criticality",
  "classify-test-exception",
  "classify-incident",
  "select-recovery-option",
  "record-obligation-interpretation",
  "set-portfolio-materiality",
  // 2. Capture the changed state into a versioned or concluding record.
  "version-assessment",
  "set-residual-risk",
  "record-supplier-assessment",
  "record-test-conclusion",
  "apply-supplier-restriction",
  // 3. Create the follow-up work that the conclusion implies.
  "create-reassessment",
  "create-issue",
  "record-finding",
  "create-action",
  "request-evidence",
  "activate-monitoring",
  "escalate-incident",
  "record-notification-recommendation",
  "capture-lessons-learned",
  // 4. Tell people last, so a message never describes a change that failed.
  "add-committee-item",
  "request-factual-validation",
  "send-collaboration-message",
];

export function orderConsequences(consequences: Consequence[]): Consequence[] {
  const rank = (consequence: Consequence): number => {
    const index = CONSEQUENCE_ORDER.indexOf(consequence.kind);
    return index === -1 ? CONSEQUENCE_ORDER.length : index;
  };
  // A stable sort, so two consequences of the same kind keep their declared
  // order relative to each other.
  return consequences
    .map((consequence, index) => ({ consequence, index }))
    .sort((a, b) => rank(a.consequence) - rank(b.consequence) || a.index - b.index)
    .map((entry) => entry.consequence);
}

/* ==========================================================================
   The plan: what an option will do, before anything is written
   ========================================================================== */

/**
 * Why a consequence will not run, when the plan finds that it will not.
 *
 * The gate's own denial codes, plus one for a seeded consequence kind this
 * build has no tool for.
 */
export type ConsequenceRefusalCode = AuthorityDenialCode | "not-implemented";

/** One declared consequence, mapped onto the tool and payload that would execute it. */
export interface ConsequencePlan {
  /** Position in execution order, zero based. */
  index: number;
  consequence: Consequence;
  /** The governed tool, or null when the kind is not implemented in this build. */
  toolName: string | null;
  /** The exact payload the tool receives. The approval binds to this. */
  payload: Record<string, unknown> | null;
  /** The authority gate's fingerprint of `payload`. */
  fingerprint: string | null;
  /**
   * The gate's verdict on this payload, executed as the owning role with an
   * approval from its holder.
   *
   * `requiresApproval` is false only for a routine tool at the most
   * permissive autonomy level. Everything material needs one.
   */
  verdict:
    | { allowed: true; requiresApproval: boolean }
    | { allowed: false; code: ConsequenceRefusalCode; reason: string };
}

export interface DecisionPlan {
  decisionId: string;
  optionId: string;
  /** The role that owns the decision. It executes, and its holder approves. */
  roleId: RoleId;
  approverUserId: string;
  autonomyLevel: string;
  consequences: ConsequencePlan[];
}

/**
 * Plans an option without writing anything.
 *
 * The workspace shows this plan (the exact payload, the target, whether an
 * approval is needed and whether the gate will allow it), and the engine
 * re-plans from the database at confirm time and compares. One function for
 * both, so what the person approved and what executes cannot drift apart
 * except by a change in the data, which the comparison then catches.
 *
 * The gate is asked with a prospective approval that has every property the
 * real one will have: granted by the owning role's holder, under that role's
 * scopes, rationale confirmed, bound to this payload. So a refusal here is a
 * refusal the real execution would meet, for a reason other than a missing
 * signature: the autonomy level, a missing scope, or a tool that does not
 * exist.
 */
export function planDecisionOption(params: {
  decisionId: string;
  optionId: string;
  runId?: string;
}): DecisionPlan | null {
  const state = requireScenarioState(params.runId);
  const runId = state.runId;

  const decision = db()
    .select()
    .from(decisions)
    .where(and(eq(decisions.runId, runId), eq(decisions.id, params.decisionId)))
    .get();
  if (!decision) return null;

  const option = db()
    .select()
    .from(decisionOptions)
    .where(and(eq(decisionOptions.runId, runId), eq(decisionOptions.id, params.optionId)))
    .get();
  if (!option || option.decisionId !== decision.id) return null;

  const roleId = decision.roleId;
  const approverUserId = roleHolderUserId(roleId, runId);
  const now = new Date().toISOString();

  const consequences = orderConsequences(option.consequences as Consequence[]).map(
    (consequence, index): ConsequencePlan => {
      const mapped = mapConsequence(consequence, {
        decisionId: decision.id,
        entityId: decision.entityId,
        roleId,
      });
      if (!mapped) {
        return {
          index,
          consequence,
          toolName: null,
          payload: null,
          fingerprint: null,
          verdict: {
            allowed: false,
            code: "not-implemented",
            reason: `The consequence "${consequence.kind}" is not implemented in this build.`,
          },
        };
      }

      const fingerprint = fingerprintPayload(mapped.toolName, mapped.payload);
      const gate = evaluateAuthority({
        toolName: mapped.toolName,
        roleId,
        autonomyLevel: state.autonomyLevel,
        payload: mapped.payload,
        actingUserId: approverUserId,
        approval: {
          approvedBy: approverUserId,
          decisionId: decision.id,
          approvedAt: now,
          rationaleConfirmed: true,
          role: roleId,
          authorityScope: [...ROLE_AUTHORITY_SCOPES[roleId]],
          payloadFingerprint: fingerprint,
          consumedAt: null,
        },
      });

      return {
        index,
        consequence,
        toolName: mapped.toolName,
        payload: mapped.payload,
        fingerprint,
        verdict: gate.allowed
          ? { allowed: true, requiresApproval: gate.requiresApproval }
          : { allowed: false, code: gate.code, reason: gate.reason },
      };
    },
  );

  return {
    decisionId: decision.id,
    optionId: option.id,
    roleId,
    approverUserId,
    autonomyLevel: state.autonomyLevel,
    consequences,
  };
}

/* ==========================================================================
   Recording and executing
   ========================================================================== */

/** Why a decision was refused before anything was written. */
export type DecisionRefusal =
  | "approval-not-confirmed"
  | "rationale-missing"
  | "not-found"
  | "option-mismatch"
  | "already-recorded"
  | "role-mismatch"
  | "payload-changed"
  | "consequence-refused";

/** What happened to one consequence. */
export interface ConsequenceOutcome {
  index: number;
  kind: string;
  targetId: string;
  toolName: string | null;
  fingerprint: string | null;
  approvalId: string | null;
  /**
   * "executed": the change happened and wrote receipt lines.
   * "blocked": the authority gate refused it at execution.
   * "failed": the gate allowed it and the change itself failed.
   * "not-attempted": the decision was refused before execution began.
   */
  outcome: "executed" | "blocked" | "failed" | "not-attempted";
  reason: string | null;
  code: string | null;
  receiptLineIds: string[];
  statements: string[];
}

export interface RecordDecisionResult {
  /** True only when the decision was recorded and every consequence executed. */
  ok: boolean;
  /** True when the decision row was written. False when it was refused first. */
  recorded: boolean;
  message: string;
  /**
   * The real receipt: one statement per line written to
   * `execution_receipt_lines`, each a change that executed and wrote an audit
   * event. Never a line about the decision itself.
   */
  receiptStatements: string[];
  /** Plain reasons for every consequence that did not execute, or the refusal code. */
  blockedReasons: string[];
  refusal?: DecisionRefusal;
  consequences: ConsequenceOutcome[];
  executedCount: number;
  failedCount: number;
  approvalId?: string;
}

/** The audit action that holds the outcome record. Read back by the receipt. */
export { DECISION_OUTCOME_ACTION };

function refuse(
  refusal: DecisionRefusal,
  message: string,
  blockedReasons: string[] = [refusal],
  consequences: ConsequenceOutcome[] = [],
): RecordDecisionResult {
  return {
    ok: false,
    recorded: false,
    message,
    receiptStatements: [],
    blockedReasons,
    refusal,
    consequences,
    executedCount: 0,
    failedCount: 0,
  };
}

function notAttempted(plan: ConsequencePlan): ConsequenceOutcome {
  return {
    index: plan.index,
    kind: plan.consequence.kind,
    targetId: plan.consequence.targetId,
    toolName: plan.toolName,
    fingerprint: plan.fingerprint,
    approvalId: null,
    outcome: "not-attempted",
    reason: plan.verdict.allowed ? null : plan.verdict.reason,
    code: plan.verdict.allowed ? null : plan.verdict.code,
    receiptLineIds: [],
    statements: [],
  };
}

/**
 * Records a human decision and executes the chosen option's consequences.
 *
 * The order is the argument:
 *
 *   1. Refuse, writing nothing, when the rationale is not confirmed or empty,
 *      the decision is already recorded, the caller acts as another role, the
 *      person approved a different set of changes from the one that would now
 *      execute, or the gate would refuse any of the changes.
 *   2. Record the human judgment.
 *   3. Execute each change under its own approval, granted by the holder of
 *      the role that owns the decision.
 *   4. Record the outcome, executed and not executed separately, in the audit
 *      trail, and publish the decision on the event backbone.
 *
 * Step 1 is why a decision is no longer written as decided while its
 * consequences are refused. A change that fails at step 3 for a reason the
 * plan could not see (a handler error, a target that vanished) still leaves
 * the decision recorded, because the judgment was made, and the failure is on
 * the outcome record and in the receipt rather than in a log line.
 */
export async function recordDecisionAndExecute(input: {
  decisionId: string;
  optionId: string;
  rationale: string;
  rationaleConfirmed: boolean;
  /**
   * The role the caller acts as: the route's role on a workday surface, the
   * run's role on a process page. Refused when it is not the decision's role.
   * Omitted by callers that act for the decision's owner by construction.
   */
  actingRoleId?: RoleId;
  /**
   * The payload fingerprints the person approved, in execution order. When
   * given, they must equal the plan at confirm time, change for change.
   */
  approvedFingerprints?: readonly string[];
}): Promise<RecordDecisionResult> {
  const state = requireScenarioState();

  /*
   * The confirmation is checked here, not only in the server action.
   *
   * An earlier version relied on `app/actions.ts` to reject an unconfirmed
   * rationale, which meant any other caller, a script, a test, or a future
   * route, could record a decision and execute its consequences with the
   * confirmation withheld. A control that only one caller enforces is not a
   * control. The authority gate would still have refused each individual
   * material tool, but the decision row and its audit event would already
   * have been written, which is exactly the misleading half state this
   * product exists to avoid.
   */
  if (!input.rationaleConfirmed) {
    return refuse(
      "approval-not-confirmed",
      "The decision was not recorded. A material decision requires the accountable person to confirm that the rationale is their own.",
    );
  }

  if (input.rationale.trim().length === 0) {
    return refuse("rationale-missing", "The decision was not recorded. A rationale is required.");
  }

  const decision = db()
    .select()
    .from(decisions)
    .where(and(eq(decisions.runId, state.runId), eq(decisions.id, input.decisionId)))
    .get();
  if (!decision) {
    return refuse("not-found", `Decision ${input.decisionId} was not found.`, []);
  }

  const option = db()
    .select()
    .from(decisionOptions)
    .where(and(eq(decisionOptions.runId, state.runId), eq(decisionOptions.id, input.optionId)))
    .get();
  if (!option || option.decisionId !== decision.id) {
    return refuse(
      "option-mismatch",
      `Option ${input.optionId} does not belong to decision ${input.decisionId}.`,
      [],
    );
  }

  /*
   * A recorded decision is a record. Recording it again would grant a second
   * set of approvals and run its consequences twice, which no reader intends
   * and which the earlier version allowed (J22).
   */
  if (decision.status !== "open") {
    return refuse(
      "already-recorded",
      `Decision ${decision.reference} is already recorded. A recorded decision is not recorded again.`,
    );
  }

  /*
   * The acting role is the role that owns the decision. A caller that says it
   * acts as another role is refused here, before anything is written, rather
   * than being allowed to write the decision and then meet the gate's
   * `approval-role-mismatch` on every consequence.
   */
  const roleId = decision.roleId;
  if (input.actingRoleId !== undefined && input.actingRoleId !== roleId) {
    return refuse(
      "role-mismatch",
      `The decision was not recorded. ${decision.reference} belongs to another role and can only be recorded from that role's workday.`,
    );
  }

  const plan = planDecisionOption({ decisionId: decision.id, optionId: option.id, runId: state.runId });
  if (!plan) {
    return refuse("option-mismatch", `Option ${input.optionId} could not be planned.`, []);
  }

  /*
   * The approval binds to the exact payload the person saw. When the caller
   * sends the fingerprints it approved, the set must equal what would now
   * execute, change for change. Anything else means the person approved
   * something other than what would happen.
   */
  if (input.approvedFingerprints !== undefined) {
    const required = plan.consequences
      .filter((entry) => entry.verdict.allowed && entry.verdict.requiresApproval)
      .map((entry) => entry.fingerprint ?? "");
    const approved = [...input.approvedFingerprints];
    const matches =
      required.length === approved.length && required.every((fingerprint, index) => fingerprint === approved[index]);
    if (!matches) {
      return refuse(
        "payload-changed",
        "The decision was not recorded. The changes you approved are not the changes that would now execute. Review them again before confirming.",
      );
    }
  }

  const refused = plan.consequences.filter((entry) => !entry.verdict.allowed);
  if (refused.length > 0) {
    return refuse(
      "consequence-refused",
      `The decision was not recorded. ${refused.length} of its ${plan.consequences.length} changes would be refused, so nothing was written.`,
      refused.map((entry) =>
        entry.verdict.allowed ? "" : `${entry.toolName ?? entry.consequence.kind}: ${entry.verdict.reason}`,
      ),
      plan.consequences.map(notAttempted),
    );
  }

  const actingUserId = plan.approverUserId;
  const now = new Date().toISOString();

  /* 2. Record the human judgment. This happens before any execution, so a
   *    decision is on the record even if a downstream mutation fails. */
  db()
    .update(decisions)
    .set({
      status: "decided",
      chosenOptionId: option.id,
      recordedRationale: input.rationale,
      decidedByUserId: actingUserId,
      decidedAtMoment: state.currentMoment,
      decidedAt: now,
    })
    .where(and(eq(decisions.runId, state.runId), eq(decisions.id, decision.id)))
    .run();

  const decisionAuditId = recordAuditEvent({
    runId: state.runId,
    atMoment: state.currentMoment,
    category: "decision",
    action: "recordDecision",
    objectKind: "decision",
    objectId: decision.id,
    summary: `${actingUserId} decided "${decision.title}" by choosing "${option.label}" and recorded a rationale they confirmed as their own.`,
    actorUserId: actingUserId,
    actorKind: "human",
    roleId,
    entityId: decision.entityId,
    decisionId: decision.id,
    reversible: false,
    detail: { optionId: option.id, optionLabel: option.label, judgmentKind: decision.judgmentKind },
  });

  /* 3. Execute the declared consequences, each under its own approval. */
  const context: ToolContext = {
    runId: state.runId,
    roleId,
    autonomyLevel: state.autonomyLevel,
    actingUserId,
    atMoment: state.currentMoment,
    sessionId: `session-${roleId}`,
    actorKind: "human",
    language: state.language,
  };

  const receiptStatements: string[] = [];
  const outcomes: ConsequenceOutcome[] = [];
  let firstApprovalId: string | undefined;
  let sortOrder = 0;

  for (const entry of plan.consequences) {
    // The plan refused nothing, so every entry has a tool and a payload.
    if (!entry.toolName || !entry.payload || !entry.fingerprint) continue;

    const needsApproval = entry.verdict.allowed && entry.verdict.requiresApproval;
    const approvalId = needsApproval
      ? grantApproval({
          decisionId: decision.id,
          toolName: entry.toolName,
          payloadFingerprint: entry.fingerprint,
          rationale: input.rationale,
          rationaleConfirmed: true,
          roleId,
        })
      : null;
    if (approvalId) firstApprovalId ??= approvalId;

    const result = await executeTool(entry.toolName, entry.payload, context, approvalId);

    const outcome: ConsequenceOutcome = {
      index: entry.index,
      kind: entry.consequence.kind,
      targetId: entry.consequence.targetId,
      toolName: entry.toolName,
      fingerprint: entry.fingerprint,
      approvalId,
      outcome: result.outcome === "executed" ? "executed" : result.outcome === "failed" ? "failed" : "blocked",
      reason: result.outcome === "executed" ? null : result.summary,
      code: result.denialCode ?? null,
      receiptLineIds: [],
      statements: [],
    };

    if (result.outcome === "executed") {
      for (const statement of result.receiptStatements ?? []) {
        sortOrder += 1;
        const lineId = `RCP-${decision.id}-${sortOrder}`;
        receiptStatements.push(statement);
        outcome.receiptLineIds.push(lineId);
        outcome.statements.push(statement);
        db()
          .insert(executionReceiptLines)
          .values({
            id: lineId,
            runId: state.runId,
            decisionId: decision.id,
            approvalId,
            sortOrder,
            statement,
            objectKind: entry.consequence.kind,
            objectId: entry.consequence.targetId,
            changeKind: "updated",
            auditEventId: result.auditEventId ?? null,
            executedAt: new Date().toISOString(),
            executedAtMoment: state.currentMoment,
            reversible: false,
          })
          .run();
      }
    } else {
      log.warn("A declared consequence did not execute.", {
        toolName: entry.toolName,
        outcome: result.outcome,
        denialCode: result.denialCode,
      });
    }
    outcomes.push(outcome);
  }

  const executed = outcomes.filter((entry) => entry.outcome === "executed");
  const failed = outcomes.filter((entry) => entry.outcome !== "executed");

  /* 4. The outcome record. Append only, like every other audit row, and the
   *    place the receipt reads the changes that did not execute from: a
   *    failure that exists only in a server response disappears on refresh. */
  recordAuditEvent({
    runId: state.runId,
    atMoment: state.currentMoment,
    category: "system",
    action: DECISION_OUTCOME_ACTION,
    objectKind: "decision",
    objectId: decision.id,
    summary:
      failed.length === 0
        ? `Outcome of ${decision.reference}: ${executed.length} of ${outcomes.length} changes executed.`
        : `Outcome of ${decision.reference}: ${executed.length} of ${outcomes.length} changes executed; ${failed.length} did not execute.`,
    actorUserId: actingUserId,
    actorKind: "system",
    roleId,
    entityId: decision.entityId,
    decisionId: decision.id,
    reversible: false,
    detail: {
      optionId: option.id,
      decisionAuditEventId: decisionAuditId,
      executedCount: executed.length,
      failedCount: failed.length,
      consequences: outcomes.map((entry) => ({
        index: entry.index,
        kind: entry.kind,
        targetId: entry.targetId,
        toolName: entry.toolName,
        fingerprint: entry.fingerprint,
        approvalId: entry.approvalId,
        outcome: entry.outcome,
        reason: entry.reason,
        code: entry.code,
        receiptLineIds: entry.receiptLineIds,
      })),
    },
  });

  publishDecisionRecorded({
    runId: state.runId,
    decision,
    optionId: option.id,
    optionLabel: option.label,
    optionLabelDe: option.labelDe,
    atMoment: state.currentMoment,
    actingUserId,
    auditEventId: decisionAuditId,
    executed: executed.length,
    failed: failed.length,
  });

  const ok = failed.length === 0;
  return {
    ok,
    recorded: true,
    message: ok
      ? `Decision recorded. ${executed.length} of ${outcomes.length} changes executed and written to the audit trail.`
      : `Decision recorded. ${executed.length} of ${outcomes.length} changes executed; ${failed.length} did not execute.`,
    receiptStatements,
    blockedReasons: failed.map((entry) => `${entry.toolName ?? entry.kind}: ${entry.reason ?? ""}`),
    consequences: outcomes,
    executedCount: executed.length,
    failedCount: failed.length,
    approvalId: firstApprovalId,
  };
}

/**
 * Publishes the recorded decision on the OS event backbone.
 *
 * The key, `decision-recorded:<decisionId>`, is the one the process engine
 * uses for a seeded decision, so whichever publishes first is the one account
 * of it. When an installed stage contract binds this decision, the event
 * carries the process run and the stage, so the stage's own timeline shows it
 * and the process engine finds it already published.
 */
function publishDecisionRecorded(params: {
  runId: string;
  decision: typeof decisions.$inferSelect;
  optionId: string;
  optionLabel: string;
  optionLabelDe: string;
  atMoment: string;
  actingUserId: string;
  auditEventId: string;
  executed: number;
  failed: number;
}): void {
  const { decision } = params;
  const binding = findDecisionProcessBinding(decision.id, decision.roleId, params.runId);
  const total = params.executed + params.failed;
  const labelDe = params.optionLabelDe.length > 0 ? params.optionLabelDe : params.optionLabel;

  try {
    publishOsEvent({
      runId: params.runId,
      type: "decision-recorded",
      roleId: decision.roleId,
      atMoment: params.atMoment,
      actorKind: "human",
      actorUserId: params.actingUserId,
      subject:
        decision.relatedObjectKind && decision.relatedObjectId
          ? { kind: decision.relatedObjectKind, id: decision.relatedObjectId }
          : { kind: "decision", id: decision.id },
      process: binding?.processRunId ? { runId: binding.processRunId, stageId: binding.stage.id } : null,
      correlationId: binding?.stageRunId ?? null,
      summary: {
        en: `Decision ${decision.reference} recorded: ${params.optionLabel}. ${params.executed} of ${total} changes executed${params.failed > 0 ? `, ${params.failed} did not execute` : ""}.`,
        de: `Entscheidung ${decision.reference} erfasst: ${labelDe}. ${params.executed} von ${total} Aenderungen ausgefuehrt${params.failed > 0 ? `, ${params.failed} nicht ausgefuehrt` : ""}.`,
      },
      payload: {
        decisionId: decision.id,
        optionId: params.optionId,
        executed: params.executed,
        failed: params.failed,
      },
      idempotencyKey: `decision-recorded:${decision.id}`,
      auditEventId: params.auditEventId,
    });
  } catch (error) {
    /*
     * The decision, its changes and its audit rows are already written. A
     * backbone failure must not turn a recorded decision into an error the
     * reader would retry; the process engine publishes the same key when it
     * notices the decision, so the event is not lost.
     */
    log.error("The decision event could not be published.", { decisionId: decision.id, error });
  }
}
