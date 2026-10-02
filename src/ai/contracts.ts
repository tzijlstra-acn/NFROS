/**
 * AI quality contract: typed response envelope.
 *
 * Every AI response in NFR WorkOS V4 travels as an AssistantResponseEnvelope.
 * The discriminated union of AssistantResponsePart types makes the rendering
 * contract explicit: an inference part cannot be rendered as a verified fact,
 * and a proposed action cannot be rendered as an executed change.
 *
 * The validator is intentionally manual rather than Zod-schema-driven.
 * Zod is available in this repo (v4.6.5) and would be appropriate for a
 * DB-backed registry. For an in-code envelope contract the manual validator
 * keeps the dependency surface small and the error messages readable.
 */

/* ==========================================================================
   Response part types
   ========================================================================== */

export type AnswerPart = {
  type: "answer";
  text: string;
  lang: "en" | "de";
};

export type FactPart = {
  type: "fact";
  claim: string;
  sourceIds: string[];
  confidence: "verified" | "stakeholder-statement" | "ai-inference";
};

export type InferencePart = {
  type: "inference";
  claim: string;
  supportingSourceIds: string[];
  uncertainty: string;
  label: string; // "AI inference -- not an approved record"
};

export type UncertaintyPart = {
  type: "uncertainty";
  description: string;
  requiredForCompletion: boolean;
};

export type EvidencePart = {
  type: "evidence";
  evidenceId: string;
  excerpt: string;
  freshness: "current" | "stale" | "missing" | "requested";
};

export type RecommendationPart = {
  type: "recommendation";
  text: string;
  basis: string[];
  limitations?: string;
  isLimited: boolean; // true when required sources were missing
};

export type ProposedActionPart = {
  type: "proposed-action";
  actionKind: string;
  description: string;
  authorityClass: string;
  requiresApproval: boolean;
};

export type ApprovalRequestPart = {
  type: "approval-request";
  approvalId: string;
  payloadHash: string;
  description: string;
  authorityClass: string;
};

export type ExecutionReceiptPart = {
  type: "execution-receipt";
  receiptId: string;
  toolId: string;
  outcome: "success" | "failed" | "partial";
  timestamp: string;
};

export type BlockedActionPart = {
  type: "blocked-action";
  reason: string;
  prohibitedBy: "authority-gate" | "required-source" | "mode-restriction";
};

export type FollowUpPart = {
  type: "follow-up";
  question: string;
  context: string;
};

export type AssistantResponsePart =
  | AnswerPart
  | FactPart
  | InferencePart
  | UncertaintyPart
  | EvidencePart
  | RecommendationPart
  | ProposedActionPart
  | ApprovalRequestPart
  | ExecutionReceiptPart
  | BlockedActionPart
  | FollowUpPart;

/* ==========================================================================
   Envelope support types
   ========================================================================== */

export type RequiredSourceStatus = {
  sourceKind: string;
  sourceId: string | null;
  status: "loaded" | "unavailable" | "stale" | "waived";
  waivedBy?: string;
};

export type AssistantResponseContext = {
  roleId: string;
  subjectKind: string | null;
  subjectId: string | null;
  processRunId: string | null;
  stageRunId: string | null;
};

/* ==========================================================================
   Envelope
   ========================================================================== */

export type AssistantResponseEnvelope = {
  responseId: string;
  mode: "live" | "safe" | "offline";
  context: AssistantResponseContext;
  parts: AssistantResponsePart[];
  sourceIds: string[];
  requiredSourceStatus: RequiredSourceStatus[];
  isLimited: boolean; // true when required sources missing
  generatedAt: string;
};

/* ==========================================================================
   Validator
   ========================================================================== */

/**
 * Validate an envelope. Returns an array of error strings; empty means valid.
 *
 * Intentionally does not use Zod so the validator is safe to import in any
 * module without pulling the schema builder into contexts where it does not
 * belong. Zod is reserved for user-facing form schemas in this build.
 */
export function validateEnvelope(envelope: unknown): string[] {
  const errors: string[] = [];

  if (!envelope || typeof envelope !== "object") {
    errors.push("Envelope must be an object");
    return errors;
  }

  const e = envelope as Record<string, unknown>;

  if (typeof e["responseId"] !== "string") {
    errors.push("responseId must be string");
  }
  if (!["live", "safe", "offline"].includes(e["mode"] as string)) {
    errors.push("mode must be live|safe|offline");
  }
  if (!Array.isArray(e["parts"])) {
    errors.push("parts must be array");
  }
  if (typeof e["generatedAt"] !== "string") {
    errors.push("generatedAt must be string");
  }

  return errors;
}
