/**
 * How a Work Hub operation reaches the authority gate.
 *
 * Server only. Every write the hub makes is a tool call through `executeTool`,
 * in exactly the sequence the runtime fixes: gate, handler, audit event,
 * observability record. This module adds the one step that sits in front of
 * it for a change that needs a person: the approval.
 *
 *   1. Ask the gate, with no approval, whether the tool could run. This is a
 *      pure evaluation and writes nothing.
 *   2. If it could run without one (a routine tool at the most permissive
 *      autonomy level), run it.
 *   3. If it needs an approval, require that the person confirmed the change
 *      in the interface, record an approval in their name bound to this exact
 *      payload's fingerprint, and run the tool with it. The runtime consumes
 *      the approval, so it cannot authorise a second change.
 *   4. If the gate refuses outright, still call `executeTool`, so the refusal
 *      is written to the audit trail as evidence that the control works, and
 *      return the gate's own reason.
 *
 * Why this does not call `grantApproval` in the decision engine. Two reasons,
 * both about telling the truth in the audit trail. That function attaches
 * every approval to a decision, and an action closure or a meeting outcome is
 * not a decision row; passing an action identifier as a decision identifier
 * would misattribute the approval. And it grants as the holder of the ACTIVE
 * role while the engine acts as the decision's role, the mismatch recorded in
 * `decide.ts` that makes the gate refuse with `approval-role-mismatch`. Here
 * the approver and the acting role are the same by construction: the holder
 * of the role whose work is being changed.
 *
 * Since migration 0005 a Work approval names what it is about in
 * `approvals.target_kind` and `target_id` (the action, the meeting, the
 * minutes), and the tool context carries the same target into the gate, so
 * an approval granted for one object is refused for another.
 */

import { getDb } from "@/db/client";
import { approvals } from "@/db/schema/decisions";
import type { RoleId } from "@/db/schema/core";
import { getRole } from "@/db/repositories/workday";
import { executeTool, type ToolCallResult, type ToolContext } from "@/agents/tools/runtime";
import "@/agents/tools/mutations";
import { evaluateAuthority, ROLE_AUTHORITY_SCOPES } from "@/server/security/authority";
import { recordAuditEvent } from "@/server/security/audit";
import { requireScenarioState } from "@/scenario/engine/state";
import { publishOsEvent } from "@/features/events/backbone";
import { createLogger } from "@/server/logging/redact";
import "./modules/actions/tools";
import "./modules/meetings/tools";
import "./modules/inbox/tools";
import { MEETING_LIFECYCLE_TOOLS } from "./modules/meetings/tool-names";
import { INBOX_DRAFT_TOOL, INBOX_SELF_PUBLISHING_TOOLS } from "./modules/inbox/tool-names";

const log = createLogger("work-governance");

/**
 * Tools whose executed change is not published here.
 *
 * A reminder draft changes nothing. The meeting lifecycle tools either write
 * a draft, which is not an event any other surface reads, or, for the
 * confirmation, publish their own events inside the handler's transaction,
 * so the backbone and the record cannot disagree. The inbox tools publish
 * their own event the same way, and the reply draft writes nothing.
 */
const NOT_PUBLISHED_HERE: ReadonlySet<string> = new Set([
  "draftActionReminder",
  ...MEETING_LIFECYCLE_TOOLS,
  ...INBOX_SELF_PUBLISHING_TOOLS,
  INBOX_DRAFT_TOOL,
]);

export interface GovernedStep {
  toolName: string;
  payload: Record<string, unknown>;
}

export interface GovernedResult {
  ok: boolean;
  toolName: string;
  outcome: ToolCallResult["outcome"] | "needs-confirmation";
  summary: string;
  receipt: string[];
  data: unknown;
  approvalId: string | null;
  auditEventId: string | null;
}

export interface GovernedContext {
  roleId: RoleId;
  /** The person confirmed the change in the interface. Required for any approval. */
  confirmed: boolean;
  /** The reason the person gave, recorded on the approval. */
  rationale: string;
  /** The object the change is about, for the approval's audit line. */
  subjectKind: string;
  subjectId: string;
  /**
   * False when a later step of the same operation publishes the one backbone
   * account of this change. An action raised from an inbox message is the
   * case: the link step publishes it with the action as its subject and the
   * message as its correlation. Defaults to publishing.
   */
  publish?: boolean;
}

/** The holder of a role, who acts and approves for it. */
export function roleHolder(roleId: RoleId): string {
  const role = getRole(roleId);
  if (!role) throw new Error(`The role ${roleId} is not in the scenario.`);
  return role.holderUserId;
}

export function workToolContext(roleId: RoleId, target: { kind: string; id: string } | null = null): ToolContext {
  const state = requireScenarioState();
  return {
    runId: state.runId,
    roleId,
    autonomyLevel: state.autonomyLevel,
    actingUserId: roleHolder(roleId),
    atMoment: state.currentMoment,
    sessionId: `work-${roleId}`,
    actorKind: "human",
    language: state.language,
    target,
  };
}

let approvalSequence = 0;

/**
 * Records a person's approval for one payload.
 *
 * The same fields `grantApproval` writes, with `decisionId` left empty because
 * there is no decision, and the audit line naming the object instead.
 */
function grantWorkApproval(
  context: ToolContext,
  input: { toolName: string; fingerprint: string; rationale: string; subjectKind: string; subjectId: string },
): string {
  approvalSequence += 1;
  const id = `APR-W-${Date.now().toString(36).toUpperCase()}-${String(approvalSequence).padStart(5, "0")}`;
  const tool = evaluateAuthority({
    toolName: input.toolName,
    roleId: context.roleId,
    autonomyLevel: context.autonomyLevel,
    payload: {},
    actingUserId: context.actingUserId,
    approval: null,
  }).tool;

  getDb()
    .insert(approvals)
    .values({
      id,
      runId: context.runId,
      decisionId: null,
      targetKind: input.subjectKind,
      targetId: input.subjectId,
      toolName: input.toolName,
      authorityClass: tool?.authorityClass ?? "APPROVAL_REQUIRED",
      approvedByUserId: context.actingUserId,
      roleId: context.roleId,
      authorityScope: [...ROLE_AUTHORITY_SCOPES[context.roleId]],
      approvedAt: new Date().toISOString(),
      approvedAtMoment: context.atMoment,
      rationaleConfirmed: true,
      rationale: input.rationale,
      autonomyLevel: context.autonomyLevel,
      consumedAt: null,
      payloadFingerprint: input.fingerprint,
    })
    .run();

  recordAuditEvent({
    runId: context.runId,
    atMoment: context.atMoment,
    category: "approval",
    action: "recordApproval",
    objectKind: "approval",
    objectId: id,
    summary: `${context.actingUserId} approved "${input.toolName}" on ${input.subjectKind} ${input.subjectId} and confirmed the reason as their own.`,
    actorUserId: context.actingUserId,
    actorKind: "human",
    roleId: context.roleId,
    approvalId: id,
    reversible: true,
    detail: { subjectKind: input.subjectKind, subjectId: input.subjectId, toolName: input.toolName },
  });

  return id;
}

/** Runs one governed step. */
export async function runGoverned(step: GovernedStep, governed: GovernedContext): Promise<GovernedResult> {
  const context = workToolContext(governed.roleId, { kind: governed.subjectKind, id: governed.subjectId });
  const verdict = evaluateAuthority({
    toolName: step.toolName,
    roleId: context.roleId,
    autonomyLevel: context.autonomyLevel,
    payload: step.payload,
    actingUserId: context.actingUserId,
    approval: null,
    target: context.target ?? null,
  });

  let approvalId: string | null = null;

  if (!verdict.allowed && verdict.code === "approval-missing") {
    if (!governed.confirmed || governed.rationale.trim().length === 0) {
      return {
        ok: false,
        toolName: step.toolName,
        outcome: "needs-confirmation",
        summary:
          "This change needs your approval. Confirm it and give a reason, and it will be recorded in your name.",
        receipt: [],
        data: null,
        approvalId: null,
        auditEventId: null,
      };
    }
    approvalId = grantWorkApproval(context, {
      toolName: step.toolName,
      fingerprint: verdict.fingerprint,
      rationale: governed.rationale.trim(),
      subjectKind: governed.subjectKind,
      subjectId: governed.subjectId,
    });
  }

  /*
   * A refusal for any other reason still goes through the runtime, which
   * writes the blocked attempt to the audit trail. The result carries the
   * gate's reason, never one composed here.
   */
  const result = await executeTool(step.toolName, step.payload, context, approvalId);
  const ok = result.outcome === "executed";

  if (ok && governed.publish !== false && !NOT_PUBLISHED_HERE.has(step.toolName)) {
    publishWorkEvent(context, governed, step.toolName, result);
  }

  return {
    ok,
    toolName: step.toolName,
    outcome: result.outcome,
    summary: result.summary,
    receipt: result.receiptStatements ?? [],
    data: result.data ?? null,
    approvalId,
    auditEventId: result.auditEventId ?? null,
  };
}

/**
 * Runs a chain of steps, stopping at the first that does not execute.
 *
 * Request evidence, send reminder and escalate are each two tool calls: the
 * change itself, then the history entry that records it on the action. The
 * second only runs when the first did, so the history never records a
 * reminder that was not sent.
 */
export async function runGovernedChain(
  steps: readonly GovernedStep[],
  governed: GovernedContext,
): Promise<{ ok: boolean; results: GovernedResult[]; receipt: string[]; blocked: string[] }> {
  const results: GovernedResult[] = [];
  for (const step of steps) {
    const result = await runGoverned(step, governed);
    results.push(result);
    if (!result.ok) break;
  }
  const ok = results.length === steps.length && results.every((result) => result.ok);
  return {
    ok,
    results,
    receipt: results.flatMap((result) => result.receipt),
    blocked: results.filter((result) => !result.ok).map((result) => result.summary),
  };
}

/**
 * Publishes the change on the OS event backbone.
 *
 * One `action-updated` or `meeting-completed` event per executed change,
 * linked to the audit row the runtime already wrote rather than writing a
 * second one, which is the backbone's rule against separate accounts of the
 * same event. The backbone is a projection: if it cannot be written (a
 * database that has not taken its migration yet), the governed change has
 * still happened and is still audited, so the failure is logged and the
 * operation reports success.
 */
function publishWorkEvent(
  context: ToolContext,
  governed: GovernedContext,
  toolName: string,
  result: ToolCallResult,
): void {
  try {
    const meeting = toolName === "recordMeetingHeld";
    publishOsEvent({
      runId: context.runId,
      type: meeting ? "meeting-completed" : "action-updated",
      roleId: context.roleId,
      atMoment: context.atMoment,
      actorKind: "human",
      actorUserId: context.actingUserId,
      subject: { kind: governed.subjectKind, id: governed.subjectId },
      summary: {
        en: result.summary,
        de: meeting ? "Besprechung als abgehalten erfasst." : "Massnahme aktualisiert.",
      },
      payload: { toolName, receipt: result.receiptStatements ?? [] },
      idempotencyKey: `work:${toolName}:${result.auditEventId ?? `${governed.subjectId}:${Date.now()}`}`,
      auditEventId: result.auditEventId ?? null,
    });
  } catch (error) {
    log.warn("The work event was not published to the backbone.", { toolName, error });
  }
}
