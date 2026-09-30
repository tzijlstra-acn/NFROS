/**
 * Durable context.
 *
 * Every model has a finite context window, and the product's claim is that a
 * full working day stays coherent. The way that is achieved here is by keeping
 * almost nothing important in the chat history.
 *
 * Approved decisions, ratings, actions, the event timeline, meeting outcomes,
 * evidence status and audit events all live in their own tables and are read
 * back as structured state. The conversation is a transcript, not a memory,
 * and compaction can therefore discard old turns without losing anything the
 * afternoon depends on.
 *
 * What compaction must preserve is listed explicitly in
 * `buildPreservedContext`, and there is a test that holds it to that.
 */

import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { DEFAULT_RUN_ID, type RoleId } from "@/db/schema/core";
import { agentMessages, agentSessions } from "@/db/schema/decisions";
import {
  getActions,
  getDecisions,
  getEntity,
  getMissingEvidence,
  getRole,
  getStaleEvidence,
  getSharedEventIncident,
} from "@/db/repositories/workday";
import { getScenarioState } from "@/scenario/engine/state";
import { recordAuditEvent } from "@/server/security/audit";
import { createLogger } from "@/server/logging/redact";

const log = createLogger("session");
const db = () => getDb();

/** Rough token estimate. Adequate for a budget, and free. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Context budget for assembling a request.
 *
 * Deliberately conservative. Running close to a model's limit makes behaviour
 * depend on the length of the day so far, which is exactly the fragility this
 * module exists to remove.
 */
export const CONTEXT_BUDGET = {
  /** Maximum tokens of raw transcript carried into a request. */
  transcriptTokens: 6_000,
  /** Compaction is triggered above this. */
  compactionThresholdTokens: 8_000,
  /** Turns always kept verbatim, however long the day gets. */
  alwaysKeepRecentTurns: 6,
  /** Maximum tokens of retrieved evidence per request. */
  evidenceTokens: 8_000,
} as const;

export interface SessionRecord {
  id: string;
  runId: string;
  userId: string;
  roleId: RoleId;
  rollingSummary: string;
  workingMemory: Record<string, unknown>;
  compactionCount: number;
  lastCompactedAt: string | null;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  turnCount: number;
}

/** One session per user, role and scenario run. */
export function getOrCreateSession(
  userId: string,
  roleId: RoleId,
  runId = DEFAULT_RUN_ID,
): SessionRecord {
  const id = `sess-${runId}-${roleId}-${userId}`;
  const existing = db().select().from(agentSessions).where(eq(agentSessions.id, id)).get();

  if (existing) {
    return {
      id: existing.id,
      runId: existing.runId,
      userId: existing.userId,
      roleId: existing.roleId,
      rollingSummary: existing.rollingSummary,
      workingMemory: existing.workingMemory,
      compactionCount: existing.compactionCount,
      lastCompactedAt: existing.lastCompactedAt,
      totalInputTokens: existing.totalInputTokens,
      totalOutputTokens: existing.totalOutputTokens,
      totalCostUsd: existing.totalCostUsd,
      turnCount: existing.turnCount,
    };
  }

  const now = new Date().toISOString();
  db()
    .insert(agentSessions)
    .values({
      id,
      runId,
      userId,
      roleId,
      createdAt: now,
      lastActiveAt: now,
      rollingSummary: "",
      workingMemory: {},
      compactionCount: 0,
      lastCompactedAt: null,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostUsd: 0,
      turnCount: 0,
    })
    .run();

  return {
    id,
    runId,
    userId,
    roleId,
    rollingSummary: "",
    workingMemory: {},
    compactionCount: 0,
    lastCompactedAt: null,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCostUsd: 0,
    turnCount: 0,
  };
}

export function appendMessage(
  sessionId: string,
  role: "user" | "assistant" | "system" | "tool",
  content: string,
  runId = DEFAULT_RUN_ID,
): void {
  const existing = db()
    .select()
    .from(agentMessages)
    .where(and(eq(agentMessages.runId, runId), eq(agentMessages.sessionId, sessionId)))
    .all();

  db()
    .insert(agentMessages)
    .values({
      id: `${sessionId}-m${existing.length + 1}`,
      runId,
      sessionId,
      sortOrder: existing.length + 1,
      role,
      content,
      createdAt: new Date().toISOString(),
      compacted: false,
      tokenEstimate: estimateTokens(content),
    })
    .run();

  db()
    .update(agentSessions)
    .set({ lastActiveAt: new Date().toISOString(), turnCount: existing.length + 1 })
    .where(eq(agentSessions.id, sessionId))
    .run();
}

export function getMessages(sessionId: string, runId = DEFAULT_RUN_ID) {
  return db()
    .select()
    .from(agentMessages)
    .where(and(eq(agentMessages.runId, runId), eq(agentMessages.sessionId, sessionId)))
    .orderBy(asc(agentMessages.sortOrder))
    .all();
}

/**
 * The state that must survive compaction.
 *
 * This is read from the domain tables rather than from the transcript, which
 * is what makes the guarantee structural. Compaction cannot lose an approved
 * decision because the approved decision was never in the transcript.
 */
export interface PreservedContext {
  role: string;
  roleTitle: string;
  entity: string;
  jurisdiction: string;
  regulatoryBloc: string;
  currentMoment: string;
  autonomyLevel: string;
  /** Decisions the human has recorded, with their rationale. */
  approvedDecisions: Array<{
    id: string;
    title: string;
    chosenOptionId: string | null;
    rationale: string;
    atMoment: string | null;
  }>;
  /** Decisions still open. */
  openDecisions: Array<{ id: string; title: string; judgmentKind: string }>;
  /** Actions in flight. */
  activeActions: Array<{ id: string; title: string; status: string; dueOn: string | null }>;
  /** Uncertainties that remain open. */
  openUncertainties: string[];
  /** Source references the day has relied on. */
  sourceReferences: string[];
  /** Whether the shared event has occurred, and its current classification. */
  sharedEvent: { occurred: boolean; severity: string | null; status: string | null } | null;
  /** Edits and corrections the user made. */
  userEdits: string[];
}

export function buildPreservedContext(
  roleId: RoleId,
  runId = DEFAULT_RUN_ID,
): PreservedContext | null {
  const state = getScenarioState(runId);
  if (!state) return null;

  const role = getRole(roleId, runId);
  const entity = role ? getEntity(role.entityId, runId) : undefined;
  const decisionEntries = getDecisions(roleId, "23:59", runId);
  const incident = getSharedEventIncident(runId);

  const missing = getMissingEvidence(runId);
  const stale = getStaleEvidence(runId);

  return {
    role: roleId,
    roleTitle: role?.title ?? roleId,
    entity: entity?.name ?? role?.entityId ?? "unknown",
    jurisdiction: entity?.jurisdiction ?? "unknown",
    regulatoryBloc: entity?.regulatoryBloc ?? "unknown",
    currentMoment: state.currentMoment,
    autonomyLevel: state.autonomyLevel,
    approvedDecisions: decisionEntries
      .filter((entry) => entry.decision.status === "decided")
      .map((entry) => ({
        id: entry.decision.id,
        title: entry.decision.title,
        chosenOptionId: entry.decision.chosenOptionId,
        rationale: entry.decision.recordedRationale,
        atMoment: entry.decision.decidedAtMoment,
      })),
    openDecisions: decisionEntries
      .filter((entry) => entry.decision.status === "open")
      .map((entry) => ({
        id: entry.decision.id,
        title: entry.decision.title,
        judgmentKind: entry.decision.judgmentKind,
      })),
    activeActions: getActions({ roleId }, runId)
      .filter((action) => action.status !== "completed" && action.status !== "cancelled")
      .map((action) => ({
        id: action.id,
        title: action.title,
        status: action.status,
        dueOn: action.dueOn,
      })),
    openUncertainties: [
      ...missing.map((doc) => `${doc.reference} was requested and has not arrived.`),
      ...stale.map((doc) => `${doc.reference} is older than the policy freshness requirement.`),
    ],
    sourceReferences: Array.from(
      new Set(
        decisionEntries.flatMap((entry) => [
          ...entry.decision.supportingEvidenceIds,
          ...entry.decision.opposingEvidenceIds,
        ]),
      ),
    ),
    sharedEvent: incident
      ? { occurred: state.eventTriggered, severity: incident.severity, status: incident.status }
      : null,
    userEdits: decisionEntries
      .filter((entry) => entry.decision.recordedRationale.length > 0)
      .map((entry) => `Rationale recorded on ${entry.decision.id} by ${entry.decision.decidedByUserId}.`),
  };
}

/** Renders the preserved context as a compact system block. */
export function renderPreservedContext(context: PreservedContext): string {
  const lines: string[] = [
    `Acting role: ${context.roleTitle} (${context.role})`,
    `Legal entity: ${context.entity}, ${context.jurisdiction}, regulatory bloc ${context.regulatoryBloc}`,
    `Scenario clock: ${context.currentMoment}`,
    `Autonomy level in force: ${context.autonomyLevel}`,
  ];

  if (context.sharedEvent) {
    lines.push(
      `Shared event: ${context.sharedEvent.occurred ? "has occurred" : "has not yet occurred"}` +
        (context.sharedEvent.severity
          ? `, severity recorded as ${context.sharedEvent.severity}`
          : ", severity not yet decided by the human") +
        (context.sharedEvent.status ? `, status ${context.sharedEvent.status}` : ""),
    );
  }

  if (context.approvedDecisions.length > 0) {
    lines.push("Decisions the human has already recorded today:");
    for (const decision of context.approvedDecisions) {
      lines.push(
        `  ${decision.id} at ${decision.atMoment ?? "unknown"}: ${decision.title}. Rationale: ${decision.rationale}`,
      );
    }
  }

  if (context.openDecisions.length > 0) {
    lines.push("Decisions still open:");
    for (const decision of context.openDecisions) {
      lines.push(`  ${decision.id}: ${decision.title} (${decision.judgmentKind})`);
    }
  }

  if (context.activeActions.length > 0) {
    lines.push("Actions in flight:");
    for (const action of context.activeActions.slice(0, 12)) {
      lines.push(`  ${action.id}: ${action.title} (${action.status}, due ${action.dueOn ?? "not set"})`);
    }
  }

  if (context.openUncertainties.length > 0) {
    lines.push("Open uncertainties that must not be treated as resolved:");
    for (const item of context.openUncertainties.slice(0, 10)) {
      lines.push(`  ${item}`);
    }
  }

  return lines.join("\n");
}

export interface CompactionResult {
  compacted: boolean;
  turnsFolded: number;
  summaryLength: number;
  tokensBefore: number;
  tokensAfter: number;
}

/**
 * Compacts a session.
 *
 * Old turns are folded into a rolling summary and marked compacted rather than
 * deleted, so the control room can still show that compaction happened and a
 * test can verify continuity across it.
 *
 * The summariser here is deterministic and extractive rather than a model
 * call. A model summary would be more fluent, but compaction runs at
 * unpredictable moments and a network failure in the middle of a demonstration
 * must not be able to lose the thread.
 */
export function compactSession(
  sessionId: string,
  roleId: RoleId,
  runId = DEFAULT_RUN_ID,
): CompactionResult {
  const messages = getMessages(sessionId, runId);
  const live = messages.filter((message) => !message.compacted);
  const tokensBefore = live.reduce((sum, message) => sum + message.tokenEstimate, 0);

  if (tokensBefore <= CONTEXT_BUDGET.compactionThresholdTokens) {
    return {
      compacted: false,
      turnsFolded: 0,
      summaryLength: 0,
      tokensBefore,
      tokensAfter: tokensBefore,
    };
  }

  const keepFrom = Math.max(0, live.length - CONTEXT_BUDGET.alwaysKeepRecentTurns);
  const toFold = live.slice(0, keepFrom);
  if (toFold.length === 0) {
    return {
      compacted: false,
      turnsFolded: 0,
      summaryLength: 0,
      tokensBefore,
      tokensAfter: tokensBefore,
    };
  }

  const session = db().select().from(agentSessions).where(eq(agentSessions.id, sessionId)).get();
  const previousSummary = session?.rollingSummary ?? "";

  // Extractive: keep the first sentence of each folded turn, attributed.
  const foldedLines = toFold.map((message) => {
    const firstSentence = message.content.split(/(?<=[.!?])\s/)[0] ?? message.content;
    return `${message.role}: ${firstSentence.slice(0, 220)}`;
  });

  const preserved = buildPreservedContext(roleId, runId);
  const newSummary = [
    previousSummary,
    `Earlier in the conversation (${toFold.length} turn(s) folded):`,
    ...foldedLines,
    preserved
      ? `State at the time of compaction: ${preserved.approvedDecisions.length} decision(s) recorded, ${preserved.openDecisions.length} still open, ${preserved.openUncertainties.length} open uncertaint(ies).`
      : "",
  ]
    .filter((line) => line.length > 0)
    .join("\n");

  for (const message of toFold) {
    db()
      .update(agentMessages)
      .set({ compacted: true })
      .where(eq(agentMessages.id, message.id))
      .run();
  }

  db()
    .update(agentSessions)
    .set({
      rollingSummary: newSummary,
      compactionCount: (session?.compactionCount ?? 0) + 1,
      lastCompactedAt: new Date().toISOString(),
    })
    .where(eq(agentSessions.id, sessionId))
    .run();

  const tokensAfter =
    live.slice(keepFrom).reduce((sum, message) => sum + message.tokenEstimate, 0) +
    estimateTokens(newSummary);

  recordAuditEvent({
    runId,
    atMoment: getScenarioState(runId)?.currentMoment ?? "00:00",
    category: "system",
    action: "compactSession",
    objectKind: "agent-session",
    objectId: sessionId,
    summary: `Session history compacted: ${toFold.length} turn(s) folded into the rolling summary. Approved decisions, open uncertainties, active actions and source references are held in structured state and were not affected.`,
    actorKind: "system",
    roleId,
    reversible: false,
    detail: { turnsFolded: toFold.length, tokensBefore, tokensAfter },
  });

  log.info("Session compacted.", { sessionId, turnsFolded: toFold.length, tokensBefore, tokensAfter });

  return {
    compacted: true,
    turnsFolded: toFold.length,
    summaryLength: newSummary.length,
    tokensBefore,
    tokensAfter,
  };
}

/**
 * Assembles the message list for a request, within the context budget.
 *
 * The order is: preserved structured state, then the rolling summary, then as
 * many recent verbatim turns as the budget allows. Structured state comes
 * first because it is the part that must not be truncated away.
 */
export function assembleContext(
  sessionId: string,
  roleId: RoleId,
  runId = DEFAULT_RUN_ID,
): { system: string; transcript: Array<{ role: string; content: string }>; tokenEstimate: number } {
  const session = db().select().from(agentSessions).where(eq(agentSessions.id, sessionId)).get();
  const preserved = buildPreservedContext(roleId, runId);

  const systemParts: string[] = [];
  if (preserved) systemParts.push(renderPreservedContext(preserved));
  if (session?.rollingSummary) {
    systemParts.push(`Rolling summary of earlier conversation:\n${session.rollingSummary}`);
  }
  const system = systemParts.join("\n\n");

  const messages = getMessages(sessionId, runId).filter((message) => !message.compacted);
  const transcript: Array<{ role: string; content: string }> = [];
  let used = 0;

  // Walk backwards so the most recent turns survive the budget.
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message) continue;
    if (used + message.tokenEstimate > CONTEXT_BUDGET.transcriptTokens) break;
    transcript.unshift({ role: message.role, content: message.content });
    used += message.tokenEstimate;
  }

  return { system, transcript, tokenEstimate: estimateTokens(system) + used };
}

/** Records token and cost usage against a session. */
export function recordUsage(
  sessionId: string,
  inputTokens: number,
  outputTokens: number,
  costUsd: number,
): void {
  const session = db().select().from(agentSessions).where(eq(agentSessions.id, sessionId)).get();
  if (!session) return;

  db()
    .update(agentSessions)
    .set({
      totalInputTokens: session.totalInputTokens + inputTokens,
      totalOutputTokens: session.totalOutputTokens + outputTokens,
      totalCostUsd: session.totalCostUsd + costUsd,
    })
    .where(eq(agentSessions.id, sessionId))
    .run();
}
