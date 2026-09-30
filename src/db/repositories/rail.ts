/**
 * Intelligence rail assembly.
 *
 * Pages should not each reimplement the mapping from database rows to rail
 * props, because then the rail would show subtly different things on different
 * screens and the user could not rely on it. This module is the single mapper.
 */

import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { DEFAULT_RUN_ID, type RoleId } from "@/db/schema/core";
import { agentRuns, approvals, toolCalls } from "@/db/schema/decisions";
import { evidenceDocuments } from "@/db/schema/work";
import { incidentEvents } from "@/db/schema/practice";
import {
  getApplicablePolicies,
  getEvidenceDocuments,
  getSharedEventIncident,
} from "./workday";
import { getAuditTrail } from "@/server/security/audit";
import type { EvidenceCitation, UncertaintyEntry, ContradictionEntry } from "@/components/evidence/primitives";
import type {
  AgentActivityRecord,
  ApprovalRecord,
  AuditRecord,
  IntelligenceRailProps,
  PolicySection,
} from "@/components/shell/IntelligenceRail";
import type { Language } from "@/i18n/labels";
import { momentToMinutes } from "@/domain/nfr/calculators";

const db = () => getDb();

/** Maps an evidence document row to a citation, with a short excerpt. */
export function toCitation(
  row: typeof evidenceDocuments.$inferSelect,
  excerptLength = 260,
): EvidenceCitation {
  const body = row.body.trim();
  return {
    id: row.id,
    reference: row.reference,
    title: row.title,
    sourceType: row.sourceType,
    sourceSystem: row.sourceSystem,
    documentDate: row.documentDate,
    entityIds: row.entityIds,
    status: row.status,
    provenance: row.provenance,
    isStale: row.isStale,
    excerpt: body.length > excerptLength ? `${body.slice(0, excerptLength).trimEnd()} ...` : body,
  };
}

export function citationsFor(ids: string[], runId = DEFAULT_RUN_ID): EvidenceCitation[] {
  const rows = getEvidenceDocuments(ids, runId);
  // Preserve the caller's ordering, which encodes relevance.
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids
    .map((id) => byId.get(id))
    .filter((row): row is typeof evidenceDocuments.$inferSelect => row !== undefined)
    .map((row) => toCitation(row));
}

function toPolicySections(roleId: RoleId, runId: string): PolicySection[] {
  return getApplicablePolicies(roleId, runId).map((policy) => ({
    id: policy.id,
    reference: policy.reference,
    section: policy.section,
    sectionTitle: policy.sectionTitle,
    body: policy.body,
    version: policy.version,
    scope: policy.scope,
  }));
}

function toApprovalRecords(runId: string, roleId: RoleId): ApprovalRecord[] {
  return db()
    .select()
    .from(approvals)
    .where(and(eq(approvals.runId, runId), eq(approvals.roleId, roleId)))
    .orderBy(desc(approvals.approvedAt))
    .limit(30)
    .all()
    .map((row) => ({
      id: row.id,
      toolName: row.toolName,
      approvedByUserId: row.approvedByUserId,
      approvedAtMoment: row.approvedAtMoment,
      rationale: row.rationale,
      rationaleConfirmed: row.rationaleConfirmed,
      consumed: row.consumedAt !== null,
    }));
}

/**
 * Agent activity: the agent runs plus the tool calls.
 *
 * Tool calls are included alongside agent runs because a blocked tool call is
 * the single most informative thing in this panel, and it does not necessarily
 * belong to an agent run when the human triggered it from the interface.
 */
function toAgentActivity(runId: string): AgentActivityRecord[] {
  const runs = db()
    .select()
    .from(agentRuns)
    .where(eq(agentRuns.runId, runId))
    .orderBy(desc(agentRuns.startedAt))
    .limit(20)
    .all()
    .map((row) => ({
      id: row.id,
      agentName: row.agentName,
      task: row.task,
      model: row.model,
      fromCache: row.fromCache,
      durationMs: row.durationMs,
      status: row.status,
    }));

  const calls = db()
    .select()
    .from(toolCalls)
    .where(eq(toolCalls.runId, runId))
    .orderBy(desc(toolCalls.requestedAt))
    .limit(30)
    .all()
    .map((row) => ({
      id: row.id,
      agentName: row.toolName,
      task: row.resultSummary || row.argumentSummary,
      model: "deterministic tool",
      fromCache: false,
      durationMs: row.durationMs,
      status: row.outcome,
      outcome: row.outcome,
      authorityClass: row.authorityClass,
    }));

  // Refused and held actions first: they are the evidence the gate works.
  return [...calls, ...runs].sort((a, b) => {
    const weight = (record: AgentActivityRecord): number =>
      record.outcome === "blocked" ? 0 : record.outcome === "proposed" ? 1 : 2;
    return weight(a) - weight(b);
  });
}

function toAuditRecords(runId: string, limit: number): AuditRecord[] {
  return getAuditTrail(runId, limit).map((row) => ({
    id: row.id,
    atMoment: row.atMoment,
    category: row.category,
    action: row.action,
    summary: row.summary,
    actorKind: row.actorKind,
    blocked: row.blocked,
    blockedReason: row.blockedReason,
    reversible: row.reversible,
  }));
}

/**
 * Contradictions derived from the incident chronology.
 *
 * The chronology already links conflicting statements to each other, so the
 * contradictions the rail shows are the ones the scenario actually contains
 * rather than ones a model asserted.
 */
export function contradictionsFromEvent(
  atMoment: string,
  runId = DEFAULT_RUN_ID,
): ContradictionEntry[] {
  const incident = getSharedEventIncident(runId);
  if (!incident) return [];

  const now = momentToMinutes(atMoment);
  const rows = db()
    .select()
    .from(incidentEvents)
    .where(and(eq(incidentEvents.runId, runId), eq(incidentEvents.incidentId, incident.id)))
    .all()
    .filter((row) => momentToMinutes(row.revealedAtMoment) <= now);

  const byId = new Map(rows.map((row) => [row.id, row]));
  const seen = new Set<string>();
  const result: ContradictionEntry[] = [];

  for (const row of rows) {
    if (!row.conflictsWithId) continue;
    const other = byId.get(row.conflictsWithId);
    if (!other) continue;
    // Only report each pair once, whichever side we meet first.
    const pairKey = [row.id, other.id].sort().join("|");
    if (seen.has(pairKey)) continue;
    seen.add(pairKey);

    result.push({
      id: pairKey,
      summary: `${row.sourceLabel} and ${other.sourceLabel} do not agree on the same point.`,
      firstClaim: {
        statement: row.statement,
        provenance: row.provenance,
        sourceIds: row.evidenceDocumentIds,
      },
      secondClaim: {
        statement: other.statement,
        provenance: other.provenance,
        sourceIds: other.evidenceDocumentIds,
      },
      significance:
        "Two accounts of the same fact cannot both inform a decision. Until the difference is resolved, any conclusion that relies on either account carries that uncertainty.",
      resolutionState: row.conflictResolution.length > 0 ? "both-partly-correct" : "unresolved",
      resolutionNote: row.conflictResolution,
      detectedAtMoment: row.atMoment,
    });
  }

  return result;
}

export interface BuildRailOptions {
  roleId: RoleId;
  atMoment: string;
  language: Language;
  contextLabel: string;
  /** Evidence identifiers relevant to the current work object. */
  evidenceIds?: string[];
  whyThisMatters?: string[];
  uncertainty?: UncertaintyEntry[];
  includeEventContradictions?: boolean;
  auditLimit?: number;
  runId?: string;
}

/** Assembles the full rail props for a work object. */
export function buildIntelligenceRail(options: BuildRailOptions): IntelligenceRailProps {
  const runId = options.runId ?? DEFAULT_RUN_ID;

  return {
    language: options.language,
    contextLabel: options.contextLabel,
    evidence: citationsFor(options.evidenceIds ?? [], runId),
    whyThisMatters: options.whyThisMatters ?? [],
    uncertainty: options.uncertainty ?? [],
    contradictions:
      options.includeEventContradictions === false
        ? []
        : contradictionsFromEvent(options.atMoment, runId),
    policies: toPolicySections(options.roleId, runId),
    approvals: toApprovalRecords(runId, options.roleId),
    agentActivity: toAgentActivity(runId),
    auditTrail: toAuditRecords(runId, options.auditLimit ?? 40),
  };
}

/**
 * Uncertainty derived from the state of the evidence corpus.
 *
 * Missing and stale evidence are the two uncertainties the product can detect
 * without a model, so they are always present rather than depending on whether
 * an agent happened to mention them.
 */
export function uncertaintyFromEvidence(
  evidenceIds: string[],
  runId = DEFAULT_RUN_ID,
): UncertaintyEntry[] {
  const rows = getEvidenceDocuments(evidenceIds, runId);
  const entries: UncertaintyEntry[] = [];

  for (const row of rows) {
    if (row.status === "requested" || row.status === "missing") {
      entries.push({
        topic: `${row.title} has not arrived`,
        description: `This document was requested${row.requestedFromLabel ? ` from ${row.requestedFromLabel}` : ""}${row.requestedOn ? ` on ${row.requestedOn}` : ""} and is not in the corpus. Any conclusion that would have relied on it is unsupported.`,
        kind: "missing-evidence",
        resolutionPath: `Obtain ${row.reference} and reassess the position.`,
        materialToDecision: true,
        sourceIds: [row.id],
      });
    } else if (row.isStale) {
      entries.push({
        topic: `${row.title} is older than the freshness requirement`,
        description:
          row.stalenessNote.length > 0
            ? row.stalenessNote
            : `This document is dated ${row.documentDate} and no longer satisfies the policy freshness requirement.`,
        kind: "stale-evidence",
        resolutionPath: `Request a current version of ${row.reference}.`,
        materialToDecision: true,
        sourceIds: [row.id],
      });
    }
  }

  return entries;
}
