/**
 * Read side data access for the Decisions workspace.
 *
 * Everything here is a query. The decision itself, its options and the
 * receipt lines are read through `workday.ts`, which already had them; this
 * module adds the reads the five-part workspace needs and that nothing else
 * provided: the outcome of a recorded decision with its failures, the
 * approvals granted for it, and the current recorded position of the object
 * the decision is about.
 *
 * The outcome is the reason this file exists. A receipt that only lists the
 * changes that succeeded cannot say what did not happen, and a failure that
 * lives only in a server response is gone after a refresh (J21). The decision
 * engine therefore writes one outcome record per recorded decision into the
 * append-only audit trail, and this module reads it back. Decisions recorded
 * before that record existed are read from the approvals and the tool calls
 * that consumed, or failed to consume, them, which is the same truth reached
 * the long way round.
 */

import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { auditEvents, DEFAULT_RUN_ID } from "@/db/schema/core";
import { approvals, executionReceiptLines, toolCalls } from "@/db/schema/decisions";
import { contracts, controls, kris, processes, risks, suppliers } from "@/db/schema/domain";
import { assessments } from "@/db/schema/practice";

const db = () => getDb();

/** The audit action under which the decision engine records a decision's outcome. */
export const DECISION_OUTCOME_ACTION = "recordDecisionOutcome";

/* ==========================================================================
   The outcome of a recorded decision
   ========================================================================== */

export type ConsequenceOutcomeKind = "executed" | "blocked" | "failed" | "not-attempted";

/** One consequence of a recorded decision, as the record states it. */
export interface RecordedConsequence {
  index: number;
  /** The seeded consequence kind. Null on a derived record, which knows only the tool. */
  kind: string | null;
  targetId: string | null;
  toolName: string | null;
  approvalId: string | null;
  fingerprint: string | null;
  outcome: ConsequenceOutcomeKind;
  reason: string | null;
  code: string | null;
  receiptLineIds: string[];
}

export interface DecisionOutcomeRecord {
  /**
   * "outcome-record": the engine's own outcome row in the audit trail.
   * "derived": an older decision, read from its approvals and tool calls.
   * "none": nothing was executed and nothing was attempted.
   */
  source: "outcome-record" | "derived" | "none";
  consequences: RecordedConsequence[];
  /** The receipt: one row per change that executed. Never a line about the decision itself. */
  lines: Array<typeof executionReceiptLines.$inferSelect>;
  approvals: Array<typeof approvals.$inferSelect>;
  /** The audit row of the outcome record, when there is one. */
  outcomeAuditEventId: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseOutcomeKind(value: unknown): ConsequenceOutcomeKind {
  return value === "executed" || value === "blocked" || value === "failed" || value === "not-attempted"
    ? value
    : "failed";
}

/** Reads the consequences out of an outcome record's detail. Defensive, because it is JSON. */
function consequencesFromDetail(detail: unknown): RecordedConsequence[] | null {
  if (!isRecord(detail) || !Array.isArray(detail["consequences"])) return null;
  return (detail["consequences"] as unknown[]).filter(isRecord).map((entry, position) => ({
    index: typeof entry["index"] === "number" ? (entry["index"] as number) : position,
    kind: stringOrNull(entry["kind"]),
    targetId: stringOrNull(entry["targetId"]),
    toolName: stringOrNull(entry["toolName"]),
    approvalId: stringOrNull(entry["approvalId"]),
    fingerprint: stringOrNull(entry["fingerprint"]),
    outcome: parseOutcomeKind(entry["outcome"]),
    reason: stringOrNull(entry["reason"]),
    code: stringOrNull(entry["code"]),
    receiptLineIds: Array.isArray(entry["receiptLineIds"])
      ? (entry["receiptLineIds"] as unknown[]).filter((id): id is string => typeof id === "string")
      : [],
  }));
}

/**
 * The outcome of one recorded decision: what executed and what did not.
 *
 * Read on every render of the Decisions page, so the receipt a reader saw
 * when they confirmed is the receipt they see after a refresh, a restart or a
 * day later from "Recorded today".
 */
export function getDecisionOutcome(decisionId: string, runId = DEFAULT_RUN_ID): DecisionOutcomeRecord {
  const lines = db()
    .select()
    .from(executionReceiptLines)
    .where(and(eq(executionReceiptLines.runId, runId), eq(executionReceiptLines.decisionId, decisionId)))
    .orderBy(asc(executionReceiptLines.sortOrder))
    .all();

  const granted = db()
    .select()
    .from(approvals)
    .where(and(eq(approvals.runId, runId), eq(approvals.decisionId, decisionId)))
    .orderBy(asc(approvals.approvedAt))
    .all();

  const outcomeRow = db()
    .select({ id: auditEvents.id, detail: auditEvents.detail })
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.runId, runId),
        eq(auditEvents.action, DECISION_OUTCOME_ACTION),
        eq(auditEvents.objectId, decisionId),
      ),
    )
    .orderBy(desc(auditEvents.recordedAt))
    .get();

  const recorded = outcomeRow ? consequencesFromDetail(outcomeRow.detail) : null;
  if (outcomeRow && recorded) {
    return {
      source: "outcome-record",
      consequences: recorded,
      lines,
      approvals: granted,
      outcomeAuditEventId: outcomeRow.id,
    };
  }

  /*
   * An older record. Every approval the engine granted names the tool it
   * authorised, and the tool call that used it names the outcome: executed,
   * blocked with the gate's reason, or failed. An approval with no tool call
   * behind it authorised nothing that ran, which is stated as such.
   */
  const derived: RecordedConsequence[] = granted.map((approval, index) => {
    const call = db()
      .select({
        outcome: toolCalls.outcome,
        blockedReason: toolCalls.blockedReason,
        resultSummary: toolCalls.resultSummary,
      })
      .from(toolCalls)
      .where(and(eq(toolCalls.runId, runId), eq(toolCalls.approvalId, approval.id)))
      .orderBy(desc(toolCalls.requestedAt))
      .get();
    const executed = call?.outcome === "executed";
    const raw = executed ? null : (call?.blockedReason ?? call?.resultSummary ?? null);
    // A gate refusal is stored as "<denial code>: <reason>". The code is kept apart from the words.
    const coded = raw ? /^([a-z]+(?:-[a-z]+)*): ([\s\S]*)$/.exec(raw) : null;
    const code = coded?.[1] ?? null;
    const reason = coded?.[2] ?? raw;
    return {
      index,
      kind: null,
      targetId: null,
      toolName: approval.toolName,
      approvalId: approval.id,
      fingerprint: approval.payloadFingerprint,
      outcome: !call ? "not-attempted" : executed ? "executed" : call.outcome === "failed" ? "failed" : "blocked",
      reason,
      code,
      receiptLineIds: lines.filter((line) => line.approvalId === approval.id).map((line) => line.id),
    };
  });

  return {
    source: derived.length > 0 ? "derived" : "none",
    consequences: derived,
    lines,
    approvals: granted,
    outcomeAuditEventId: null,
  };
}

/* ==========================================================================
   The object a decision is about
   ========================================================================== */

/**
 * The current recorded position of the decision's subject.
 *
 * Raw values from the register that holds the object, so the workspace can
 * say what the record says now, before the decision changes it. A kind this
 * function does not know returns the identifier only, and the workspace says
 * the position is not shown rather than inventing one.
 */
export interface DecisionSubjectRecord {
  kind: string;
  id: string;
  label: string;
  labelDe: string;
  /** Named fields of the current position, for example `effectiveness: partially-effective`. */
  position: Record<string, string>;
}

export function getDecisionSubject(
  kind: string | null,
  id: string | null,
  runId = DEFAULT_RUN_ID,
): DecisionSubjectRecord | null {
  if (!kind || !id) return null;

  switch (kind) {
    case "control": {
      const row = db().select().from(controls).where(and(eq(controls.runId, runId), eq(controls.id, id))).get();
      if (!row) return null;
      return {
        kind,
        id,
        label: `${row.reference} ${row.title}`,
        labelDe: `${row.reference} ${row.titleDe || row.title}`,
        position: { effectiveness: row.currentEffectiveness, firstLine: row.firstLineEffectiveness },
      };
    }
    case "kri": {
      const row = db().select().from(kris).where(and(eq(kris.runId, runId), eq(kris.id, id))).get();
      if (!row) return null;
      return {
        kind,
        id,
        label: `${row.reference} ${row.name}`,
        labelDe: `${row.reference} ${row.nameDe || row.name}`,
        position: { status: row.currentStatus, value: String(row.currentValue), unit: row.unit },
      };
    }
    case "risk": {
      const row = db().select().from(risks).where(and(eq(risks.runId, runId), eq(risks.id, id))).get();
      if (!row) return null;
      return {
        kind,
        id,
        label: `${row.id} ${row.title}`,
        labelDe: `${row.id} ${row.titleDe || row.title}`,
        position: { appetite: row.appetitePosition },
      };
    }
    case "supplier": {
      const row = db().select().from(suppliers).where(and(eq(suppliers.runId, runId), eq(suppliers.id, id))).get();
      if (!row) return null;
      return {
        kind,
        id,
        label: `${row.id} ${row.name}`,
        labelDe: `${row.id} ${row.name}`,
        position: { criticality: row.criticality, status: row.status },
      };
    }
    case "contract": {
      const row = db().select().from(contracts).where(and(eq(contracts.runId, runId), eq(contracts.id, id))).get();
      if (!row) return null;
      return {
        kind,
        id,
        label: `${row.reference} ${row.title}`,
        labelDe: `${row.reference} ${row.title}`,
        position: { effectiveFrom: row.effectiveFrom },
      };
    }
    case "assessment": {
      const row = db()
        .select()
        .from(assessments)
        .where(and(eq(assessments.runId, runId), eq(assessments.id, id)))
        .get();
      if (!row) return null;
      return {
        kind,
        id,
        label: `${row.reference} ${row.title}`,
        labelDe: `${row.reference} ${row.title}`,
        position: { status: row.status, version: String(row.version), residual: row.residualRisk },
      };
    }
    case "process": {
      const row = db().select().from(processes).where(and(eq(processes.runId, runId), eq(processes.id, id))).get();
      if (!row) return null;
      return { kind, id, label: `${row.code} ${row.name}`, labelDe: `${row.code} ${row.nameDe || row.name}`, position: {} };
    }
    default:
      return { kind, id, label: id, labelDe: id, position: {} };
  }
}
