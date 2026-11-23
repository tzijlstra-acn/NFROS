/**
 * Write-back from an analysis: propose, review, approve, commit, receipt.
 *
 * Server only. The browser never sends the payload. It names the analysis
 * and the recommendation; this module reads the proposed action from the
 * stored, validated analysis, so what the person reviewed is exactly what
 * the approval binds and the tool writes. The commit runs through
 * `runGovernedChain`, the same path the Work Hub uses: the gate is asked, an
 * approval is recorded in the person's name bound to the payload fingerprint
 * when the tool needs one, the handler writes, the approval is consumed, and
 * the audit trail records each step. A refusal from the gate is returned
 * with its reason and is itself audited.
 */

import type { RoleId } from "@/db/schema/core";
import { runGovernedChain } from "@/features/work/governance";
import { requireScenarioState } from "@/scenario/engine/state";
import { getDb } from "@/db/client";
import { auditEvents } from "@/db/schema/core";
import { and, eq, isNotNull } from "drizzle-orm";
import { approvals } from "@/db/schema/decisions";
import { fingerprintPayload } from "@/server/security/authority";
import { permissionFor } from "./build/common";
import { getInsight } from "./service";
import type { ProposedInsightAction } from "./schema";

export interface WritebackReceipt {
  ok: boolean;
  status: "committed" | "refused" | "needs-confirmation" | "not-found";
  message: { en: string; de: string };
  toolName: string | null;
  authorityClass: string | null;
  target: ProposedInsightAction["target"] | null;
  changes: ProposedInsightAction["changes"];
  createdRecordId: string | null;
  approvalId: string | null;
  auditEventId: string | null;
  receiptLines: string[];
  actorUserId: string | null;
  atMoment: string | null;
  committedAt: string | null;
  evidenceIds: string[];
}

function empty(status: WritebackReceipt["status"], message: WritebackReceipt["message"]): WritebackReceipt {
  return {
    ok: false,
    status,
    message,
    toolName: null,
    authorityClass: null,
    target: null,
    changes: [],
    createdRecordId: null,
    approvalId: null,
    auditEventId: null,
    receiptLines: [],
    actorUserId: null,
    atMoment: null,
    committedAt: null,
    evidenceIds: [],
  };
}

/**
 * The recommendations of an analysis that were already committed.
 *
 * An insight write-back records an approval bound to the analysis and to the
 * payload fingerprint, consumed by the commit. Finding those approvals again
 * is how the canvas shows a committed step as done after a refresh, instead
 * of offering it a second time.
 */
export function committedRecommendations(roleId: RoleId, insightId: string): Record<string, { approvalId: string; at: string }> {
  const insight = getInsight(roleId, insightId);
  if (!insight?.response) return {};
  const state = requireScenarioState();
  const rows = getDb()
    .select({ id: approvals.id, fingerprint: approvals.payloadFingerprint, consumedAt: approvals.consumedAt, toolName: approvals.toolName })
    .from(approvals)
    .where(and(eq(approvals.runId, state.runId), eq(approvals.targetKind, "insight"), eq(approvals.targetId, insightId), isNotNull(approvals.consumedAt)))
    .all();
  const done: Record<string, { approvalId: string; at: string }> = {};
  for (const recommendation of insight.response.recommendations) {
    const action = recommendation.proposedAction;
    if (!action) continue;
    const fingerprint = fingerprintPayload(action.toolName, action.payload);
    const match = rows.find((row) => row.toolName === action.toolName && row.fingerprint === fingerprint);
    if (match) done[recommendation.id] = { approvalId: match.id, at: match.consumedAt ?? "" };
  }
  return done;
}

export function findProposal(roleId: RoleId, insightId: string, recommendationId: string): ProposedInsightAction | null {
  const insight = getInsight(roleId, insightId);
  const recommendation = insight?.response?.recommendations.find((entry) => entry.id === recommendationId);
  return recommendation?.proposedAction ?? null;
}

export async function commitInsightAction(input: {
  roleId: RoleId;
  insightId: string;
  recommendationId: string;
  rationale: string;
  confirmed: boolean;
}): Promise<WritebackReceipt> {
  const proposal = findProposal(input.roleId, input.insightId, input.recommendationId);
  if (!proposal) {
    return empty("not-found", {
      en: "This proposal is no longer part of the analysis, so nothing was changed.",
      de: "Dieser Vorschlag ist nicht mehr Teil der Analyse, daher wurde nichts geaendert.",
    });
  }
  const rationale = input.rationale.trim();
  const permission = permissionFor(input.roleId, proposal.toolName);
  if (!input.confirmed || rationale.length < 12) {
    return {
      ...empty("needs-confirmation", {
        en: "Confirm that the judgment and the reason are your own, and give a reason of at least a sentence.",
        de: "Bestaetigen Sie, dass Beurteilung und Begruendung Ihre eigenen sind, und geben Sie mindestens einen Satz als Begruendung an.",
      }),
      toolName: proposal.toolName,
      authorityClass: permission.authorityClass,
      target: proposal.target,
      changes: proposal.changes,
    };
  }

  const chain = await runGovernedChain([{ toolName: proposal.toolName, payload: proposal.payload }], {
    roleId: input.roleId,
    confirmed: input.confirmed,
    rationale,
    subjectKind: "insight",
    subjectId: input.insightId,
  });
  const result = chain.results[0];
  const state = requireScenarioState();
  const data = (result?.data ?? {}) as Record<string, unknown>;
  const createdRecordId =
    (typeof data["actionId"] === "string" && data["actionId"]) ||
    (typeof data["issueId"] === "string" && data["issueId"]) ||
    (typeof data["monitoringId"] === "string" && data["monitoringId"]) ||
    null;

  let committedAt: string | null = null;
  let actorUserId: string | null = null;
  if (result?.auditEventId) {
    const row = getDb()
      .select({ at: auditEvents.recordedAt, actor: auditEvents.actorUserId })
      .from(auditEvents)
      .where(and(eq(auditEvents.runId, state.runId), eq(auditEvents.id, result.auditEventId)))
      .get();
    committedAt = row?.at ?? null;
    actorUserId = row?.actor ?? null;
  }

  if (!chain.ok || !result) {
    return {
      ...empty("refused", {
        en: `The change was not made. ${chain.blocked[0] ?? result?.summary ?? ""}`.trim(),
        de: `Die Aenderung wurde nicht vorgenommen. ${chain.blocked[0] ?? result?.summary ?? ""}`.trim(),
      }),
      toolName: proposal.toolName,
      authorityClass: permission.authorityClass,
      target: proposal.target,
      changes: proposal.changes,
      auditEventId: result?.auditEventId ?? null,
      actorUserId: null,
      atMoment: state.currentMoment,
    };
  }

  return {
    ok: true,
    status: "committed",
    message: { en: "Source record updated.", de: "Quelldatensatz aktualisiert." },
    toolName: proposal.toolName,
    authorityClass: permission.authorityClass,
    target: { ...proposal.target, entityId: createdRecordId ?? proposal.target.entityId },
    changes: proposal.changes,
    createdRecordId,
    approvalId: result.approvalId,
    auditEventId: result.auditEventId,
    receiptLines: chain.receipt,
    actorUserId,
    atMoment: state.currentMoment,
    committedAt,
    evidenceIds: proposal.evidenceIds,
  };
}
