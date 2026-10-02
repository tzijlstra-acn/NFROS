/**
 * Conflict policy.
 *
 * Two systems disagree about the same object more often than any integration
 * design document admits. The GRC platform says a control is effective, the
 * process intelligence platform shows a manual touch rate that cannot be
 * reconciled with that rating, and the document repository holds a test report
 * dated after both. Something has to decide, and the decision has to be
 * declared per mapping rather than improvised per record.
 *
 * Four policies, and the important one is `escalate-to-human`. A product that
 * silently reconciles a disagreement between two systems of record has
 * destroyed the only signal that the disagreement exists. So escalation does
 * not mean "fail": it means accept the incoming value, mark the external
 * reference conflicted, and let the source row under the work object show that
 * two systems do not agree.
 */

import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { sourceMappings, type ConflictPolicy } from "@/db/schema/integration";

export type { ConflictPolicy };

export const CONFLICT_POLICY_LABELS: Record<ConflictPolicy, { en: string; de: string }> = {
  "source-of-record-wins": {
    en: "The system of record wins",
    de: "Das fuehrende System gewinnt",
  },
  "most-recent-wins": { en: "The most recent change wins", de: "Die neueste Aenderung gewinnt" },
  "escalate-to-human": { en: "Escalate to a person", de: "An eine Person eskalieren" },
  "never-overwrite": { en: "Never overwrite", de: "Niemals ueberschreiben" },
};

export const CONFLICT_POLICY_DESCRIPTIONS: Record<ConflictPolicy, string> = {
  "source-of-record-wins":
    "The designated system of record for this object type wins. Another source may add fields but not change one the system of record owns.",
  "most-recent-wins":
    "The record with the later source timestamp wins. Used only where both sources are genuinely equivalent, because a clock difference between two systems becomes a data difference.",
  "escalate-to-human":
    "The incoming value is stored and the reference is marked conflicted. The work object shows that two systems disagree and a person resolves it.",
  "never-overwrite":
    "The first value recorded stands. A later, different value is kept as a conflict note and never replaces the projection.",
};

/**
 * The declared policy for one mapping.
 *
 * Falls back to `escalate-to-human` when no mapping row exists. That default
 * is deliberately the cautious one: an unmapped external type arriving at the
 * runtime is already a sign that something is configured wrongly, and quietly
 * overwriting a projection on the strength of it would be the worst available
 * response.
 */
export function selectConflictPolicy(params: {
  connectorInstanceId: string;
  externalType: string;
}): ConflictPolicy {
  const row = getDb()
    .select()
    .from(sourceMappings)
    .where(
      and(
        eq(sourceMappings.connectorInstanceId, params.connectorInstanceId),
        eq(sourceMappings.externalType, params.externalType),
      ),
    )
    .get();
  return row?.conflictPolicy ?? "escalate-to-human";
}

export interface ConflictInput {
  policy: ConflictPolicy;
  /** The connector the incoming record came from. */
  incomingConnectorInstanceId: string;
  incomingSourceUpdatedAt: string | null;
  incomingVersion: string | null;
  /** The projection already recorded, or null when this is the first read. */
  existing:
    | {
        connectorInstanceId: string;
        sourceUpdatedAt: string | null;
        externalVersion: string | null;
      }
    | null;
  /** The instance designated as the system of record for this object type. */
  systemOfRecordInstanceId: string | null;
}

export interface ConflictResolution {
  /** Whether the incoming value becomes the projection. */
  apply: boolean;
  /** Whether the reference is flagged so the interface shows a disagreement. */
  conflicted: boolean;
  /** One sentence for `external_references.conflict_note`. Shown to the user. */
  note: string;
  /** The policy that produced this outcome, for the mappings screen. */
  policy: ConflictPolicy;
}

/**
 * Applies a policy to one incoming record.
 *
 * Pure, so the mappings screen can show what a policy would do without
 * touching the database, and so the unit test does not need one.
 *
 * Note that a record from the same connector is never a conflict. Re-reading
 * an object from its own source is an update, and treating it as a
 * disagreement would mark every object conflicted after the second sync,
 * which is how a conflict indicator stops meaning anything.
 */
export function resolveConflict(input: ConflictInput): ConflictResolution {
  const { policy, existing } = input;

  if (!existing) {
    return { apply: true, conflicted: false, note: "", policy };
  }

  if (existing.connectorInstanceId === input.incomingConnectorInstanceId) {
    return { apply: true, conflicted: false, note: "", policy };
  }

  switch (policy) {
    case "source-of-record-wins": {
      const incomingIsRecord =
        input.systemOfRecordInstanceId === input.incomingConnectorInstanceId;
      if (incomingIsRecord) {
        return {
          apply: true,
          conflicted: false,
          note: "",
          policy,
        };
      }
      return {
        apply: false,
        conflicted: true,
        note: `A second source offered a different value. The designated system of record is ${input.systemOfRecordInstanceId ?? "not configured"}, so the projection was not changed.`,
        policy,
      };
    }

    case "most-recent-wins": {
      const incoming = input.incomingSourceUpdatedAt ?? "";
      const current = existing.sourceUpdatedAt ?? "";
      /*
       * A missing timestamp on either side loses. An absent source timestamp
       * is not "now": a connector that cannot report when the source changed
       * must not be able to win a recency contest by omission.
       */
      if (incoming === "" || current === "") {
        return {
          apply: false,
          conflicted: true,
          note: "Two sources disagree and at least one did not report when it last changed, so recency could not decide.",
          policy,
        };
      }
      if (incoming > current) {
        return { apply: true, conflicted: false, note: "", policy };
      }
      return {
        apply: false,
        conflicted: false,
        note: "",
        policy,
      };
    }

    case "escalate-to-human":
      return {
        apply: true,
        conflicted: true,
        note: "Two sources disagree about this object. The newer value is shown and the disagreement is flagged for a person to resolve.",
        policy,
      };

    case "never-overwrite":
      return {
        apply: false,
        conflicted: true,
        note: "A second source offered a different value. The policy for this mapping is never to overwrite, so the recorded value stands.",
        policy,
      };
  }
}

/** Every mapping for the mappings screen, grouped by connector instance. */
export function listSourceMappings(): Array<typeof sourceMappings.$inferSelect> {
  return getDb().select().from(sourceMappings).all();
}
