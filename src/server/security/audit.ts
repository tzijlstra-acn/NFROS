/**
 * The Audit Service.
 *
 * Append only. Nothing in this application updates or deletes an audit event,
 * and `modifyAuditTrail` is a registered PROHIBITED tool so the refusal is
 * explicit and testable rather than merely absent.
 *
 * Every mutation writes exactly one audit event, and blocked attempts are
 * recorded too. A gate that silently refuses teaches an auditor nothing; the
 * record of the refusal is itself evidence that the control works.
 */

import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { auditEvents } from "@/db/schema/core";
import type { RoleId } from "@/db/schema/core";
import type { AuthorityClass } from "@/db/schema/decisions";
import { createLogger } from "@/server/logging/redact";

const log = createLogger("audit");

let sequence = 0;

/** Monotonic identifier, stable within a process and readable in the interface. */
function nextAuditId(): string {
  sequence += 1;
  return `AUD-${Date.now().toString(36)}-${sequence.toString().padStart(4, "0")}`;
}

export type AuditCategory =
  | "decision"
  | "mutation"
  | "approval"
  | "blocked"
  | "tool-call"
  | "system";

export interface AuditInput {
  runId: string;
  atMoment: string;
  category: AuditCategory;
  action: string;
  objectKind: string;
  objectId: string;
  summary: string;
  actorUserId?: string | null;
  /** "human", "manager-agent", "specialist-agent" or "system". */
  actorKind: string;
  roleId?: RoleId | null;
  entityId?: string | null;
  authorityClass?: AuthorityClass | null;
  decisionId?: string | null;
  approvalId?: string | null;
  blocked?: boolean;
  blockedReason?: string | null;
  reversible?: boolean;
  detail?: Record<string, unknown>;
}

/**
 * Records one audit event and returns its identifier.
 *
 * `detail` is stored as written by the caller. Callers must not place secret
 * material there; the redacting logger covers the log line, but the database
 * column is the caller's responsibility, so tool wrappers pass summaries only.
 */
export function recordAuditEvent(input: AuditInput): string {
  const id = nextAuditId();
  const now = new Date().toISOString();

  getDb()
    .insert(auditEvents)
    .values({
      id,
      runId: input.runId,
      atMoment: input.atMoment,
      recordedAt: now,
      category: input.category,
      action: input.action,
      objectKind: input.objectKind,
      objectId: input.objectId,
      actorUserId: input.actorUserId ?? null,
      actorKind: input.actorKind,
      roleId: input.roleId ?? null,
      entityId: input.entityId ?? null,
      summary: input.summary,
      authorityClass: input.authorityClass ?? null,
      decisionId: input.decisionId ?? null,
      approvalId: input.approvalId ?? null,
      blocked: input.blocked ?? false,
      blockedReason: input.blockedReason ?? null,
      reversible: input.reversible ?? false,
      detail: input.detail ?? null,
      preExisting: false,
    })
    .run();

  log.info("Audit event recorded.", {
    id,
    category: input.category,
    action: input.action,
    objectId: input.objectId,
    blocked: input.blocked ?? false,
  });

  return id;
}

/** Records a refused action. Called by the tool runtime on every denial. */
export function recordBlockedAttempt(params: {
  runId: string;
  atMoment: string;
  toolName: string;
  reason: string;
  code: string;
  roleId: RoleId;
  actorUserId?: string | null;
  actorKind: string;
  authorityClass?: AuthorityClass | null;
  objectKind?: string;
  objectId?: string;
  decisionId?: string | null;
}): string {
  return recordAuditEvent({
    runId: params.runId,
    atMoment: params.atMoment,
    category: "blocked",
    action: params.toolName,
    objectKind: params.objectKind ?? "tool",
    objectId: params.objectId ?? params.toolName,
    summary: `Action refused by the authority gate: ${params.reason}`,
    actorUserId: params.actorUserId ?? null,
    actorKind: params.actorKind,
    roleId: params.roleId,
    authorityClass: params.authorityClass ?? null,
    decisionId: params.decisionId ?? null,
    blocked: true,
    blockedReason: `${params.code}: ${params.reason}`,
    reversible: true,
    detail: { denialCode: params.code },
  });
}

/** Audit events for one object, newest first. */
export function getAuditTrailForObject(
  runId: string,
  objectKind: string,
  objectId: string,
): Array<typeof auditEvents.$inferSelect> {
  return getDb()
    .select()
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.runId, runId),
        eq(auditEvents.objectKind, objectKind),
        eq(auditEvents.objectId, objectId),
      ),
    )
    .orderBy(desc(auditEvents.recordedAt))
    .all();
}

/** The full audit trail for a run, newest first. */
export function getAuditTrail(
  runId: string,
  limit = 200,
): Array<typeof auditEvents.$inferSelect> {
  return getDb()
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.runId, runId))
    .orderBy(desc(auditEvents.recordedAt))
    .limit(limit)
    .all();
}

/** Completeness summary for the trust page. */
export function getAuditCompleteness(runId: string): {
  total: number;
  mutations: number;
  blocked: number;
  approvals: number;
  decisions: number;
  sessionEvents: number;
  preExisting: number;
} {
  const rows = getDb().select().from(auditEvents).where(eq(auditEvents.runId, runId)).all();
  return {
    total: rows.length,
    mutations: rows.filter((r) => r.category === "mutation").length,
    blocked: rows.filter((r) => r.blocked).length,
    approvals: rows.filter((r) => r.category === "approval").length,
    decisions: rows.filter((r) => r.category === "decision").length,
    sessionEvents: rows.filter((r) => !r.preExisting).length,
    preExisting: rows.filter((r) => r.preExisting).length,
  };
}
