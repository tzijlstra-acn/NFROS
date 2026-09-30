/**
 * Read side data access for the accountability surfaces.
 *
 * The control room, the trust page and the value model all read the agent
 * observability tables and the audit log. Those reads live here rather than in
 * the pages, for the same reason the rail mapper exists: three pages that each
 * write their own query eventually disagree about what "blocked" means, and
 * the one thing these pages cannot afford is to disagree with each other.
 *
 * Everything in this module is a query. Nothing here mutates.
 */

import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { auditEvents, DEFAULT_RUN_ID } from "@/db/schema/core";
import {
  actions,
  agentMessages,
  agentRuns,
  agentSessions,
  approvals,
  backgroundActions,
  cachedAiOutputs,
  decisions,
  executionReceiptLines,
  monitoringActivations,
  toolCalls,
} from "@/db/schema/decisions";
import { incidentEvents } from "@/db/schema/practice";
import {
  collaborationMessages,
  evidenceDocuments,
  inboxMessages,
  meetingMessages,
  meetings,
} from "@/db/schema/work";
import { estimateCostUsd } from "@/server/config/models";

const db = () => getDb();

export type AgentRunRow = typeof agentRuns.$inferSelect;
export type AgentSessionRow = typeof agentSessions.$inferSelect;
export type ToolCallRow = typeof toolCalls.$inferSelect;
export type AuditEventRow = typeof auditEvents.$inferSelect;
export type ApprovalRow = typeof approvals.$inferSelect;
export type CachedOutputRow = typeof cachedAiOutputs.$inferSelect;

/* ==========================================================================
   Agent observability
   ========================================================================== */

/** Sessions for this run, oldest first. Carries the compaction counters. */
export function getAgentSessions(runId = DEFAULT_RUN_ID): AgentSessionRow[] {
  return db()
    .select()
    .from(agentSessions)
    .where(eq(agentSessions.runId, runId))
    .orderBy(asc(agentSessions.createdAt))
    .all();
}

/** Every agent invocation for this run, in the order it started. */
export function getAgentRuns(runId = DEFAULT_RUN_ID): AgentRunRow[] {
  return db()
    .select()
    .from(agentRuns)
    .where(eq(agentRuns.runId, runId))
    .orderBy(asc(agentRuns.startedAt))
    .all();
}

/** Every tool call for this run, in the order it was requested. */
export function getToolCalls(runId = DEFAULT_RUN_ID): ToolCallRow[] {
  return db()
    .select()
    .from(toolCalls)
    .where(eq(toolCalls.runId, runId))
    .orderBy(asc(toolCalls.requestedAt))
    .all();
}

export function getApprovalRows(runId = DEFAULT_RUN_ID): ApprovalRow[] {
  return db()
    .select()
    .from(approvals)
    .where(eq(approvals.runId, runId))
    .orderBy(asc(approvals.approvedAt))
    .all();
}

export function getCachedOutputs(runId = DEFAULT_RUN_ID): CachedOutputRow[] {
  return db()
    .select()
    .from(cachedAiOutputs)
    .where(eq(cachedAiOutputs.runId, runId))
    .orderBy(asc(cachedAiOutputs.beatKey))
    .all();
}

/** Conversation turns for one session. Used for the compaction figures. */
export function getSessionMessageStats(
  sessionId: string,
  runId = DEFAULT_RUN_ID,
): { total: number; compacted: number; live: number; tokenEstimate: number } {
  const rows = db()
    .select()
    .from(agentMessages)
    .where(eq(agentMessages.runId, runId))
    .all()
    .filter((row) => row.sessionId === sessionId);

  return {
    total: rows.length,
    compacted: rows.filter((row) => row.compacted).length,
    live: rows.filter((row) => !row.compacted).length,
    tokenEstimate: rows.reduce((sum, row) => sum + row.tokenEstimate, 0),
  };
}

/* ==========================================================================
   Delegation
   ========================================================================== */

export interface DelegationNode {
  run: AgentRunRow;
  /** Runs whose parent identifier points at this run. */
  children: AgentRunRow[];
}

/**
 * Groups agent runs into manager runs and delegated specialist runs.
 *
 * A run with no parent is a root. A run whose parent identifier does not match
 * any row is reported separately rather than silently promoted to a root,
 * because a dangling parent is a data problem an engineer should see.
 */
export function buildDelegationTree(runs: AgentRunRow[]): {
  roots: DelegationNode[];
  orphans: AgentRunRow[];
} {
  const byId = new Map(runs.map((run) => [run.id, run]));
  const childrenOf = new Map<string, AgentRunRow[]>();
  const orphans: AgentRunRow[] = [];

  for (const run of runs) {
    const parentId = run.parentRunId;
    if (parentId === null) continue;
    if (!byId.has(parentId)) {
      orphans.push(run);
      continue;
    }
    const list = childrenOf.get(parentId) ?? [];
    list.push(run);
    childrenOf.set(parentId, list);
  }

  const roots: DelegationNode[] = runs
    .filter((run) => run.parentRunId === null)
    .map((run) => ({ run, children: childrenOf.get(run.id) ?? [] }));

  return { roots, orphans };
}

/* ==========================================================================
   Trace totals
   ========================================================================== */

export interface ModelUsage {
  model: string;
  runs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface TraceTotals {
  agentRunCount: number;
  managerRunCount: number;
  specialistRunCount: number;
  completedRunCount: number;
  failedRunCount: number;
  interruptedForApprovalCount: number;
  guardrailTriggeredCount: number;
  fromCacheCount: number;
  liveCallCount: number;
  totalDurationMs: number;
  longestRunMs: number;
  inputTokens: number;
  outputTokens: number;
  /** Recomputed here from recorded tokens and the indicative price table. */
  recomputedCostUsd: number;
  /** The value each run recorded when it ran. */
  recordedCostUsd: number;
  toolCallCount: number;
  executedCount: number;
  proposedCount: number;
  blockedCount: number;
  failedToolCount: number;
  toolDurationMs: number;
  distinctEvidenceIds: string[];
  byAuthorityClass: Array<{ authorityClass: string; count: number }>;
  byModel: ModelUsage[];
}

/** Everything the control room header needs, computed from rows. */
export function summariseTrace(runs: AgentRunRow[], calls: ToolCallRow[]): TraceTotals {
  const byModel = new Map<string, ModelUsage>();
  let recomputedCostUsd = 0;

  for (const run of runs) {
    const cost = estimateCostUsd(run.model, run.inputTokens, run.outputTokens);
    recomputedCostUsd += cost;
    const entry =
      byModel.get(run.model) ??
      { model: run.model, runs: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
    entry.runs += 1;
    entry.inputTokens += run.inputTokens;
    entry.outputTokens += run.outputTokens;
    entry.costUsd += cost;
    byModel.set(run.model, entry);
  }

  const classCounts = new Map<string, number>();
  for (const call of calls) {
    classCounts.set(call.authorityClass, (classCounts.get(call.authorityClass) ?? 0) + 1);
  }

  const evidence = new Set<string>();
  for (const call of calls) {
    for (const id of call.evidenceIds) evidence.add(id);
  }

  const durations = runs.map((run) => run.durationMs ?? 0);

  return {
    agentRunCount: runs.length,
    managerRunCount: runs.filter((run) => run.parentRunId === null).length,
    specialistRunCount: runs.filter((run) => run.parentRunId !== null).length,
    completedRunCount: runs.filter((run) => run.status === "completed").length,
    failedRunCount: runs.filter((run) => run.status === "failed").length,
    interruptedForApprovalCount: runs.filter((run) => run.status === "interrupted-for-approval")
      .length,
    guardrailTriggeredCount: runs.filter((run) => run.guardrailTriggered).length,
    fromCacheCount: runs.filter((run) => run.fromCache).length,
    liveCallCount: runs.filter((run) => !run.fromCache).length,
    totalDurationMs: durations.reduce((sum, value) => sum + value, 0),
    longestRunMs: durations.reduce((max, value) => (value > max ? value : max), 0),
    inputTokens: runs.reduce((sum, run) => sum + run.inputTokens, 0),
    outputTokens: runs.reduce((sum, run) => sum + run.outputTokens, 0),
    recomputedCostUsd,
    recordedCostUsd: runs.reduce((sum, run) => sum + run.estimatedCostUsd, 0),
    toolCallCount: calls.length,
    executedCount: calls.filter((call) => call.outcome === "executed").length,
    proposedCount: calls.filter((call) => call.outcome === "proposed").length,
    blockedCount: calls.filter((call) => call.outcome === "blocked").length,
    failedToolCount: calls.filter((call) => call.outcome === "failed").length,
    toolDurationMs: calls.reduce((sum, call) => sum + (call.durationMs ?? 0), 0),
    distinctEvidenceIds: Array.from(evidence).sort(),
    byAuthorityClass: Array.from(classCounts.entries())
      .map(([authorityClass, count]) => ({ authorityClass, count }))
      .sort((a, b) => b.count - a.count),
    byModel: Array.from(byModel.values()).sort((a, b) => b.runs - a.runs),
  };
}

/* ==========================================================================
   Audit
   ========================================================================== */

/** Every audit event for this run, newest first, with no limit applied. */
export function getAllAuditEvents(runId = DEFAULT_RUN_ID): AuditEventRow[] {
  return db()
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.runId, runId))
    .orderBy(desc(auditEvents.recordedAt))
    .all();
}

/** State changes. Category "mutation" is the only category that changes data. */
export function getMutationEvents(runId = DEFAULT_RUN_ID): AuditEventRow[] {
  return getAllAuditEvents(runId).filter((row) => row.category === "mutation");
}

export function getBlockedEvents(runId = DEFAULT_RUN_ID): AuditEventRow[] {
  return getAllAuditEvents(runId).filter((row) => row.blocked);
}

/** Audit events grouped by the kind of object that changed. */
export function groupEventsByObjectKind(
  events: AuditEventRow[],
): Array<{ objectKind: string; count: number; reversible: number }> {
  const groups = new Map<string, { count: number; reversible: number }>();
  for (const event of events) {
    const entry = groups.get(event.objectKind) ?? { count: 0, reversible: 0 };
    entry.count += 1;
    if (event.reversible) entry.reversible += 1;
    groups.set(event.objectKind, entry);
  }
  return Array.from(groups.entries())
    .map(([objectKind, entry]) => ({ objectKind, count: entry.count, reversible: entry.reversible }))
    .sort((a, b) => b.count - a.count);
}

export function getExecutionReceiptLines(runId = DEFAULT_RUN_ID) {
  return db()
    .select()
    .from(executionReceiptLines)
    .where(eq(executionReceiptLines.runId, runId))
    .orderBy(asc(executionReceiptLines.executedAt))
    .all();
}

/* ==========================================================================
   Counters for the value model
   ========================================================================== */

/** All decision rows, irrespective of the scenario clock. */
export function getAllDecisionRows(runId = DEFAULT_RUN_ID) {
  return db()
    .select()
    .from(decisions)
    .where(eq(decisions.runId, runId))
    .orderBy(asc(decisions.priorityRank))
    .all();
}

export function getAllActionRows(runId = DEFAULT_RUN_ID) {
  return db().select().from(actions).where(eq(actions.runId, runId)).all();
}

export function getAllBackgroundActions(runId = DEFAULT_RUN_ID) {
  return db().select().from(backgroundActions).where(eq(backgroundActions.runId, runId)).all();
}

export function getAllCollaborationMessages(runId = DEFAULT_RUN_ID) {
  return db()
    .select()
    .from(collaborationMessages)
    .where(eq(collaborationMessages.runId, runId))
    .all();
}

/**
 * The whole evidence corpus, ignoring the scenario clock.
 *
 * The workday reads evidence through the reveal filter, which is correct there.
 * The trust page is describing the corpus itself, so it must see every row:
 * a reader asking "what data was used" is not asking "what was visible at
 * 10:30".
 */
export function getAllEvidenceDocumentRows(runId = DEFAULT_RUN_ID) {
  return db()
    .select()
    .from(evidenceDocuments)
    .where(eq(evidenceDocuments.runId, runId))
    .orderBy(asc(evidenceDocuments.reference))
    .all();
}

export function getAllInboxMessages(runId = DEFAULT_RUN_ID) {
  return db().select().from(inboxMessages).where(eq(inboxMessages.runId, runId)).all();
}

export function getAllMeetings(runId = DEFAULT_RUN_ID) {
  return db().select().from(meetings).where(eq(meetings.runId, runId)).all();
}

export function getAllMeetingMessages(runId = DEFAULT_RUN_ID) {
  return db().select().from(meetingMessages).where(eq(meetingMessages.runId, runId)).all();
}

export function getAllMonitoringActivations(runId = DEFAULT_RUN_ID) {
  return db()
    .select()
    .from(monitoringActivations)
    .where(eq(monitoringActivations.runId, runId))
    .all();
}

/**
 * Conflicting statement pairs in the incident chronology.
 *
 * Counted as pairs rather than rows, because a contradiction between two
 * sources is one contradiction, and reporting it as two would inflate the one
 * number on the value page that describes detection quality.
 */
export function countContradictionPairs(runId = DEFAULT_RUN_ID): number {
  const rows = db().select().from(incidentEvents).where(eq(incidentEvents.runId, runId)).all();
  const ids = new Set(rows.map((row) => row.id));
  const pairs = new Set<string>();
  for (const row of rows) {
    const other = row.conflictsWithId;
    if (other === null || !ids.has(other)) continue;
    pairs.add([row.id, other].sort().join("|"));
  }
  return pairs.size;
}

/**
 * Counts rows by a string key, highest count first.
 *
 * Used for every distribution on the trust and value pages, so a distribution
 * shown on one page cannot be computed differently on another.
 */
export function countBy<T>(
  rows: readonly T[],
  key: (row: T) => string,
): Array<{ value: string; count: number }> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = key(row);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => (b.count - a.count === 0 ? a.value.localeCompare(b.value) : b.count - a.count));
}

/** Formats a duration for the control room. Milliseconds below one second. */
export function formatDuration(ms: number | null): string {
  if (ms === null) return "not recorded";
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes} min ${seconds} s`;
}

/** Formats an estimated cost. Never rounded down to a bare zero. */
export function formatUsd(value: number): string {
  if (value === 0) return "0.0000";
  if (value < 0.0001) return "below 0.0001";
  return value.toFixed(4);
}
