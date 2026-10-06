/**
 * ApprovalGate: lifecycle step 9, request approval where needed.
 *
 * An approval here is the same object the rest of the product uses: a row in
 * `approvals`, granted by a named person, with the rationale confirmed as
 * their own, bound to one payload by the authority gate's fingerprint. The
 * gate in `src/server/security/authority.ts` then decides, independently,
 * whether the approval satisfies the tool. This module never decides that.
 *
 * One difference from `grantApproval` in the scenario engine, stated because
 * it is an accountability choice: the approver is the holder of the process
 * run's role, not of whichever role is active in the shell. A process page
 * belongs to one role, and the person completing an onboarding stage is the
 * Third-Party Risk Manager even if the shell was last switched to another
 * role. Granting under the active role would make the authority gate refuse
 * with `approval-role-mismatch`, which is the defect the scenario engine's
 * own comment describes.
 */

import { getDb } from "@/db/client";
import { approvals } from "@/db/schema/decisions";
import {
  fingerprintPayload,
  ROLE_AUTHORITY_SCOPES,
  TOOL_REGISTRY,
} from "@/server/security/authority";
import type { Bilingual } from "@/role-apps/contracts";
import { publishOsEvent } from "@/features/events/backbone";
import { eventKey } from "./keys";
import type { StageContext } from "./types";

let approvalSequence = 0;

function withoutStop(text: string): string {
  return text.trim().replace(/\.$/, "");
}

export class ApprovalRefused extends Error {
  constructor(readonly reason: Bilingual) {
    super(reason.en);
  }
}

export interface StageApprovalInput {
  context: StageContext;
  toolName: string;
  payload: Record<string, unknown>;
  rationale: string;
  rationaleConfirmed: boolean;
  /** The decision the approval belongs to: a seeded decision id or a stage decision task id. */
  decisionId: string | null;
  /** What is being approved, for the event summary. */
  subject: Bilingual;
}

/**
 * Grants one payload bound approval and publishes it to the backbone, with
 * its audit row, in one call.
 *
 * Refuses, rather than records, an unconfirmed or empty rationale. That check
 * is repeated by the authority gate; it is made here too so that no approval
 * row is ever written that the gate would then have to reject.
 */
export function grantStageApproval(input: StageApprovalInput): { approvalId: string; fingerprint: string } {
  if (!input.rationaleConfirmed) {
    throw new ApprovalRefused({
      en: "Confirm that the rationale is your own before the change is approved.",
      de: "Bestaetigen Sie, dass die Begruendung Ihre eigene ist, bevor die Aenderung genehmigt wird.",
    });
  }
  if (input.rationale.trim().length === 0) {
    throw new ApprovalRefused({ en: "A rationale is required.", de: "Eine Begruendung ist erforderlich." });
  }

  const tool = TOOL_REGISTRY[input.toolName];
  if (!tool) {
    throw new ApprovalRefused({
      en: `The tool ${input.toolName} is not in the authority registry.`,
      de: `Das Werkzeug ${input.toolName} ist nicht im Berechtigungsregister.`,
    });
  }

  const { context } = input;
  const fingerprint = fingerprintPayload(input.toolName, input.payload);
  approvalSequence += 1;
  const approvalId = `APR-PRC-${Date.now().toString(36).toUpperCase()}-${String(approvalSequence).padStart(5, "0")}`;
  const now = new Date().toISOString();

  getDb()
    .insert(approvals)
    .values({
      id: approvalId,
      runId: context.runId,
      decisionId: input.decisionId,
      toolName: input.toolName,
      authorityClass: tool.authorityClass,
      approvedByUserId: context.actingUserId,
      roleId: context.roleId,
      authorityScope: [...ROLE_AUTHORITY_SCOPES[context.roleId]],
      approvedAt: now,
      approvedAtMoment: context.state.currentMoment,
      rationaleConfirmed: true,
      rationale: input.rationale.trim(),
      autonomyLevel: context.state.autonomyLevel,
      consumedAt: null,
      payloadFingerprint: fingerprint,
      // Bound to the stage run it was granted in; the gate refuses it for another object
      targetKind: context.stageRun ? "stage-run" : null,
      targetId: context.stageRun?.id ?? null,
    })
    .run();

  publishOsEvent({
    runId: context.runId,
    type: "approval-granted",
    roleId: context.roleId,
    atMoment: context.state.currentMoment,
    actorKind: "human",
    actorUserId: context.actingUserId,
    subject: { kind: context.run.subjectKind, id: context.run.subjectId },
    process: { runId: context.run.id, stageId: context.stage.id },
    correlationId: context.stageRun?.id ?? null,
    summary: {
      en: `${context.actingUserId} approved: ${withoutStop(input.subject.en)}. The rationale was confirmed as their own.`,
      de: `${context.actingUserId} hat genehmigt: ${withoutStop(input.subject.de)}. Die Begruendung wurde als eigene bestaetigt.`,
    },
    payload: { approvalId, toolName: input.toolName, fingerprint },
    idempotencyKey: eventKey.approvalGranted(approvalId),
    audit: {
      category: "approval",
      action: "recordApproval",
      objectKind: "approval",
      objectId: approvalId,
      actorKind: "human",
      authorityClass: tool.authorityClass,
      decisionId: input.decisionId,
      approvalId,
      reversible: true,
    },
  });

  return { approvalId, fingerprint };
}
