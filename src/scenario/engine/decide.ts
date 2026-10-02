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
 */

import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  approvals,
  decisionOptions,
  decisions,
  executionReceiptLines,
} from "@/db/schema/decisions";
import type { RoleId } from "@/db/schema/core";
import { executeTool, type ToolContext } from "@/agents/tools/runtime";
import "@/agents/tools/mutations";
import { fingerprintPayload, ROLE_AUTHORITY_SCOPES } from "@/server/security/authority";
import { recordAuditEvent } from "@/server/security/audit";
import { requireScenarioState } from "./state";
import { createLogger } from "@/server/logging/redact";

const log = createLogger("decide");
const db = () => getDb();

/** Maps a role to the person who holds it. */
const ROLE_HOLDERS: Record<RoleId, string> = {
  tprm: "P-002",
  rcsa: "P-003",
  "control-assurance": "P-004",
  "incident-resilience": "P-005",
  "regulatory-change": "P-006",
  "nfr-governance": "P-001",
};

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
   * The approver is the holder of the ACTIVE role: the person sitting there
   * when the approval was granted.
   *
   * This was briefly changed to derive the approver from the decision's own
   * role instead, and the change was reverted. Both readings are defensible
   * and the difference is an accountability question rather than a technical
   * one, so it is recorded here rather than settled quietly in a patch.
   *
   *   Active role, which is what this does. An approval names the human who
   *   accepted responsibility. If a portfolio lead approves a third party
   *   decision, the trail should say the portfolio lead approved it, because
   *   they did.
   *
   *   Decision's role. An approval is attached to one decision, and the
   *   person accountable for that decision is its owner.
   *
   * There IS a real defect nearby, and it is reachable.
   * `recordDecisionAndExecute` acts as `decision.roleId`, while this grants
   * as `state.activeRoleId`. Navigating to `/workday/tprm/decisions` by URL
   * does not switch the active role, because that is a deliberate act with
   * its own audit event, so the two can disagree. When they do, the
   * authority gate refuses every consequence with `approval-role-mismatch`
   * and the decision cannot be recorded at all.
   *
   * Nothing is written incorrectly: the gate is doing exactly its job, and
   * the audit trail is never wrong. The symptom is a decision that silently
   * will not go through. Fixing it properly means deciding which of the two
   * readings above is the product's, and then making the engine and the
   * route agree on it. See `docs/handoffs/workday-v3-approval-attribution.md`.
   */
  const roleId = state.activeRoleId;
  const approvedBy = ROLE_HOLDERS[roleId];
  approvalSequence += 1;
  const id = `APR-${Date.now().toString(36).toUpperCase()}-${String(approvalSequence).padStart(5, "0")}`;

  db()
    .insert(approvals)
    .values({
      id,
      runId: state.runId,
      decisionId: input.decisionId,
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

export interface RecordDecisionResult {
  ok: boolean;
  message: string;
  receiptStatements: string[];
  blockedReasons: string[];
  approvalId?: string;
}

/**
 * Records a human decision and executes the chosen option's consequences.
 */
export async function recordDecisionAndExecute(input: {
  decisionId: string;
  optionId: string;
  rationale: string;
  rationaleConfirmed: boolean;
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
    return {
      ok: false,
      message:
        "The decision was not recorded. A material decision requires the accountable person to confirm that the rationale is their own.",
      receiptStatements: [],
      blockedReasons: ["approval-not-confirmed"],
    };
  }

  if (input.rationale.trim().length === 0) {
    return {
      ok: false,
      message: "The decision was not recorded. A rationale is required.",
      receiptStatements: [],
      blockedReasons: ["rationale-missing"],
    };
  }

  const decision = db()
    .select()
    .from(decisions)
    .where(and(eq(decisions.runId, state.runId), eq(decisions.id, input.decisionId)))
    .get();
  if (!decision) {
    return { ok: false, message: `Decision ${input.decisionId} was not found.`, receiptStatements: [], blockedReasons: [] };
  }

  const option = db()
    .select()
    .from(decisionOptions)
    .where(and(eq(decisionOptions.runId, state.runId), eq(decisionOptions.id, input.optionId)))
    .get();
  if (!option || option.decisionId !== decision.id) {
    return {
      ok: false,
      message: `Option ${input.optionId} does not belong to decision ${input.decisionId}.`,
      receiptStatements: [],
      blockedReasons: [],
    };
  }

  const roleId = decision.roleId;
  const actingUserId = ROLE_HOLDERS[roleId];
  const now = new Date().toISOString();

  /* 1. Record the human judgment. This happens before any execution, so a
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

  recordAuditEvent({
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

  /* 2. Execute the declared consequences, each under its own approval. */
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

  const receiptStatements: string[] = [`Decision rationale recorded against ${decision.id}`];
  const blockedReasons: string[] = [];
  let firstApprovalId: string | undefined;
  let sortOrder = 0;

  for (const consequence of orderConsequences(option.consequences as Consequence[])) {
    const mapped = mapConsequence(consequence, {
      decisionId: decision.id,
      entityId: decision.entityId,
      roleId,
    });

    if (!mapped) {
      blockedReasons.push(`The consequence "${consequence.kind}" is not implemented in this build.`);
      continue;
    }

    // Each consequence is approved on its own terms.
    const fingerprint = fingerprintPayload(mapped.toolName, mapped.payload);
    const approvalId = grantApproval({
      decisionId: decision.id,
      toolName: mapped.toolName,
      payloadFingerprint: fingerprint,
      rationale: input.rationale,
      rationaleConfirmed: true,
    });
    firstApprovalId ??= approvalId;

    const result = await executeTool(mapped.toolName, mapped.payload, context, approvalId);

    if (result.outcome === "executed") {
      for (const statement of result.receiptStatements ?? []) {
        sortOrder += 1;
        receiptStatements.push(statement);
        db()
          .insert(executionReceiptLines)
          .values({
            id: `RCP-${decision.id}-${sortOrder}`,
            runId: state.runId,
            decisionId: decision.id,
            approvalId,
            sortOrder,
            statement,
            objectKind: consequence.kind,
            objectId: consequence.targetId,
            changeKind: "updated",
            auditEventId: result.auditEventId ?? null,
            executedAt: new Date().toISOString(),
            executedAtMoment: state.currentMoment,
            reversible: false,
          })
          .run();
      }
    } else {
      blockedReasons.push(`${mapped.toolName}: ${result.summary}`);
      log.warn("A declared consequence did not execute.", {
        toolName: mapped.toolName,
        outcome: result.outcome,
        denialCode: result.denialCode,
      });
    }
  }

  const ok = blockedReasons.length === 0;
  return {
    ok,
    message: ok
      ? `Decision recorded. ${receiptStatements.length} change(s) executed and written to the audit trail.`
      : `Decision recorded. ${receiptStatements.length} change(s) executed; ${blockedReasons.length} did not execute.`,
    receiptStatements,
    blockedReasons,
    approvalId: firstApprovalId,
  };
}
