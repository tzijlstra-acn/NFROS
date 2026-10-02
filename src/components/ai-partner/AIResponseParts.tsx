"use client";

/**
 * Typed response parts.
 *
 * An answer from the partner is a list of parts with a discriminator, not a
 * blob of prose, and this component is where that distinction becomes
 * visible. Rendering all eleven kinds as paragraphs would undo the whole
 * authority model: a proposed action and an executed change would read
 * identically, and the user would have no way to tell what the product did
 * from what it is suggesting.
 *
 * The other thing kept visible here is the boundary with the systems outside
 * this product. Rather than printing tool logs, each part can carry a phase:
 * read from source, prepared locally, waiting for approval, queued for
 * external execution, executed externally, failed externally. That is the
 * compact form of the same honesty the execution receipt enforces in detail.
 *
 * Nothing in this component executes anything. Approve is a callback the
 * caller wires to the decision surface, because material execution routes
 * through approval and never through a chat answer.
 */

import { IconArrowUpRight, IconCheck, IconMessage2 } from "@tabler/icons-react";
import type { AuthorityClass } from "@/db/schema/decisions";
import type { Language } from "@/i18n/labels";
import { pick, type ExecutionReceiptLineView } from "@/workday/contracts";
import { AuthorityChip, Chip, Data } from "@/components/workday-v2/primitives";
import { AIExecutionReceipt } from "./AIExecutionReceipt";
import {
  AI_CONNECTION_PHASE_LABELS,
  AI_PART_LABELS,
  connectionPhaseFromPart,
  isAIPartKind,
  partnerLabel,
  type AIPartKind,
} from "./labels";

export interface AIResponsePartView {
  kind: AIPartKind;
  text: string;
  refs?: string[];
  meta?: Record<string, unknown>;
}

/**
 * Narrows an unvalidated part from the chat route.
 *
 * The route is owned by another agent and may gain kinds before this renderer
 * does. An unknown kind is dropped rather than rendered as unlabelled prose,
 * which is the one outcome this component exists to prevent.
 */
export function toResponsePart(value: unknown): AIResponsePartView | null {
  if (typeof value !== "object" || value === null) return null;
  const row = value as Record<string, unknown>;
  if (!isAIPartKind(row["kind"])) return null;
  const text = typeof row["text"] === "string" ? row["text"] : "";
  const refs = Array.isArray(row["refs"])
    ? row["refs"].filter((ref): ref is string => typeof ref === "string")
    : undefined;
  const meta =
    typeof row["meta"] === "object" && row["meta"] !== null
      ? (row["meta"] as Record<string, unknown>)
      : undefined;
  return { kind: row["kind"], text, ...(refs ? { refs } : {}), ...(meta ? { meta } : {}) };
}

/*
 * Duplicated rather than imported from the schema on purpose.
 *
 * `@/db/schema/decisions` pulls the drizzle table builders with it, and this
 * is a client component. A type only import is erased at compile time; a
 * value import would put the ORM in the browser bundle.
 */
const AUTHORITY_VALUES: AuthorityClass[] = [
  "READ",
  "DRAFT",
  "PROPOSE",
  "APPROVAL_REQUIRED",
  "POLICY_BOUND_AUTONOMOUS",
  "PROHIBITED",
];

function authorityFromMeta(meta: Record<string, unknown> | undefined): AuthorityClass | null {
  const value = meta?.["authorityClass"];
  return typeof value === "string" && (AUTHORITY_VALUES as string[]).includes(value)
    ? (value as AuthorityClass)
    : null;
}

const RECEIPT_STATUSES = [
  "acknowledged",
  "partial",
  "queued",
  "failed",
  "dead-letter",
  "local",
] as const;

/**
 * Builds a receipt line from a loosely typed payload.
 *
 * Every field is defaulted. A partial payload from the route must render as a
 * line with missing detail, never as the string "undefined" beside a claim
 * that something was written to a regulated system.
 */
function normaliseReceiptLine(value: unknown, index: number): ExecutionReceiptLineView | null {
  if (typeof value !== "object" || value === null) return null;
  const row = value as Record<string, unknown>;
  const status = row["status"];
  if (typeof status !== "string" || !(RECEIPT_STATUSES as readonly string[]).includes(status)) {
    return null;
  }
  const text = (key: string): string | null =>
    typeof row[key] === "string" ? (row[key] as string) : null;

  return {
    id: text("id") ?? `line-${index}`,
    statement: text("statement") ?? "",
    targetSystem: text("targetSystem"),
    externalType: text("externalType"),
    externalId: text("externalId"),
    externalUrl: text("externalUrl"),
    status: status as ExecutionReceiptLineView["status"],
    statusDetail: text("statusDetail") ?? "",
    retryState: text("retryState") ?? "",
    attempts: typeof row["attempts"] === "number" ? row["attempts"] : 0,
    completedAt: text("completedAt"),
    auditEventId: text("auditEventId"),
    sequence: typeof row["sequence"] === "number" ? row["sequence"] : index,
  };
}

function receiptLinesFromMeta(
  meta: Record<string, unknown> | undefined,
): ExecutionReceiptLineView[] {
  const raw = meta?.["lines"];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((value, index) => normaliseReceiptLine(value, index))
    .filter((line): line is ExecutionReceiptLineView => line !== null);
}

/*
 * Kinds whose phase is always shown.
 *
 * For these the phase is the point: it is the difference between a change
 * that is queued and one an external system has acknowledged. For an answer
 * or a recommendation the label already says the content was prepared here,
 * so the chip is shown only when the server states a phase explicitly.
 */
const ALWAYS_SHOW_PHASE: AIPartKind[] = [
  "proposed-action",
  "approval-request",
  "execution-receipt",
  "blocked",
  "source-status",
];

export interface AIResponsePartsProps {
  parts: AIResponsePartView[];
  language: Language;
  /** Opens a cited record in place, so the user never leaves the workday. */
  onOpenEvidence?: (evidenceId: string) => void;
  /** Routes an approval request to the decision surface. Nothing executes here. */
  onApprove?: (input: { decisionId: string | null; text: string }) => void;
  /** Puts a follow up question into the composer rather than sending it. */
  onAskFollowUp?: (question: string) => void;
  onOpenAudit?: (auditEventId: string) => void;
  /** Receipt lines for a receipt part that arrived without them in `meta`. */
  receiptLines?: ExecutionReceiptLineView[];
}

export function AIResponseParts({
  parts,
  language,
  onOpenEvidence,
  onApprove,
  onAskFollowUp,
  onOpenAudit,
  receiptLines = [],
}: AIResponsePartsProps) {
  if (parts.length === 0) return null;

  return (
    <>
      {parts.map((part, index) => {
        const phase = connectionPhaseFromPart(part);
        const showPhase =
          phase !== null &&
          (ALWAYS_SHOW_PHASE.includes(part.kind) || part.meta?.["phase"] !== undefined);
        const authority = authorityFromMeta(part.meta);
        const decisionId =
          typeof part.meta?.["decisionId"] === "string" ? (part.meta["decisionId"] as string) : null;

        const lines =
          part.kind === "execution-receipt"
            ? (() => {
                const fromMeta = receiptLinesFromMeta(part.meta);
                return fromMeta.length > 0 ? fromMeta : receiptLines;
              })()
            : [];

        return (
          <div className="app-part" data-kind={part.kind} key={`${part.kind}-${index}`}>
            <span className="app-part-label app-row-wrap" style={{ gap: "var(--app-2)" }}>
              <span>{pick(AI_PART_LABELS[part.kind], language)}</span>
              {showPhase && phase ? (
                <Chip tone={AI_CONNECTION_PHASE_LABELS[phase].tone}>
                  {pick(AI_CONNECTION_PHASE_LABELS[phase], language)}
                </Chip>
              ) : null}
              {authority ? <AuthorityChip authorityClass={authority} language={language} /> : null}
            </span>

            {part.text ? <span>{part.text}</span> : null}

            {/* A receipt is rendered as a receipt, line by line, not as prose. */}
            {part.kind === "execution-receipt" && lines.length > 0 ? (
              <AIExecutionReceipt
                lines={lines}
                language={language}
                variant="plain"
                {...(onOpenAudit ? { onOpenAudit } : {})}
              />
            ) : null}

            {/* Cited records. Opened in place when the caller supports it. */}
            {part.refs && part.refs.length > 0 ? (
              <span className="app-row-wrap" style={{ gap: "var(--app-1)" }}>
                {part.refs.map((ref) =>
                  onOpenEvidence ? (
                    <button
                      key={ref}
                      type="button"
                      className="app-prompt-chip"
                      onClick={() => onOpenEvidence(ref)}
                    >
                      <Data>{ref}</Data>
                      <IconArrowUpRight size={11} stroke={2} aria-hidden="true" />
                    </button>
                  ) : (
                    <Data key={ref}>{ref}</Data>
                  ),
                )}
              </span>
            ) : null}

            {part.kind === "approval-request" && onApprove ? (
              <span className="app-stack-1">
                <span className="app-row">
                  <button
                    type="button"
                    className="app-btn app-btn-primary app-btn-sm"
                    onClick={() => onApprove({ decisionId, text: part.text })}
                  >
                    <IconCheck size={13} stroke={2.2} aria-hidden="true" />
                    {partnerLabel("actionApprove", language)}
                  </button>
                </span>
                <span className="app-meta">{partnerLabel("approvalRoutingNote", language)}</span>
              </span>
            ) : null}

            {part.kind === "follow-up" && onAskFollowUp && part.text ? (
              <span className="app-row">
                <button
                  type="button"
                  className="app-prompt-chip"
                  onClick={() => onAskFollowUp(part.text)}
                >
                  <IconMessage2 size={11} stroke={2} aria-hidden="true" />
                  {partnerLabel("chatSend", language)}
                </button>
              </span>
            ) : null}
          </div>
        );
      })}
    </>
  );
}
