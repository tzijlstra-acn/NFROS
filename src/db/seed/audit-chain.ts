/**
 * Audit hash chain seed.
 *
 * Creates chain records for the five pre-existing audit events so the chain
 * has content to verify immediately after a fresh seed or reset. The records
 * are seeded in chronological order (the same order the scenario day presents
 * them), so sequence 1 corresponds to the earliest audit event.
 *
 * The chain scope is the default "org-arcadia-demo". If AUDIT_CHAIN_SCOPE is
 * set, the chain is written under that scope instead.
 *
 * Call seedAuditChain after the scenario transaction commits and after audit
 * events are present in the database.
 */

import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { DEFAULT_RUN_ID } from "@/db/schema/core";
import { auditChainRecords } from "@/db/schema/audit-chain";
import { appendChainRecord, CHAIN_SCOPE } from "@/audit/chain";

/** Removes all chain records for the given run before reseeding. */
function clearChain(runId: string): void {
  getDb().delete(auditChainRecords).where(eq(auditChainRecords.runId, runId)).run();
}

/** The five pre-existing audit events, in chronological order. */
const SEED_EVENTS = [
  {
    auditEventId: "AUE-2024-0001",
    eventKind: "approveSupplierRelease",
    actorKind: "system",
    actorId: null,
    at: "2024-11-11T18:40:00.000Z",
  },
  {
    auditEventId: "AUE-2025-0002",
    eventKind: "publishControlDescription",
    actorKind: "human",
    actorId: "P-008",
    at: "2025-01-14T09:15:00.000Z",
  },
  {
    auditEventId: "AUE-2025-0003",
    eventKind: "executeContractAppendix",
    actorKind: "human",
    actorId: "P-016",
    at: "2025-02-14T16:05:00.000Z",
  },
  {
    auditEventId: "AUE-2025-0004",
    eventKind: "issueAuditReport",
    actorKind: "human",
    actorId: "P-017",
    at: "2025-11-28T11:20:00.000Z",
  },
  {
    auditEventId: "AUE-2025-0005",
    eventKind: "createAction",
    actorKind: "human",
    actorId: "P-017",
    at: "2025-11-28T11:35:00.000Z",
  },
] as const;

export interface AuditChainSeedSummary {
  chainScope: string;
  recordsWritten: number;
}

/**
 * Seeds the audit hash chain for the given run.
 * Clears existing chain records for the run before writing new ones.
 */
export function seedAuditChain(runId: string = DEFAULT_RUN_ID): AuditChainSeedSummary {
  clearChain(runId);

  for (const event of SEED_EVENTS) {
    appendChainRecord({ ...event, runId });
  }

  return {
    chainScope: CHAIN_SCOPE,
    recordsWritten: SEED_EVENTS.length,
  };
}
