/**
 * AIResponseDisplay -- server component for validated AI response envelopes.
 *
 * Renders an AssistantResponseEnvelope as typed, labelled parts. The
 * discriminated union is the contract: each part type has a distinct visual
 * treatment so a user can see at a glance what is verified evidence, what is
 * an inference, and what is a recommendation based on incomplete sources.
 *
 * An inference part carries a mandatory label that says it is not an approved
 * record. That label is not optional and not a prop: removing it would break
 * the authority contract.
 *
 * No em dashes. No dark theme. var(--wd-*) tokens. Server component.
 */

import type {
  AssistantResponseEnvelope,
  AssistantResponsePart,
  AnswerPart,
  FactPart,
  InferencePart,
  UncertaintyPart,
  RecommendationPart,
  BlockedActionPart,
  EvidencePart,
} from "@/ai/contracts";

/* ==========================================================================
   Individual part renderers
   ========================================================================== */

function AnswerDisplay({ part }: { part: AnswerPart }) {
  return (
    <p
      style={{
        margin: 0,
        fontSize: "var(--wd-text-sm, 0.875rem)",
        color: "var(--wd-text, #f7f7fa)",
        lineHeight: 1.6,
      }}
    >
      {part.text}
    </p>
  );
}

function FactDisplay({ part }: { part: FactPart }) {
  return (
    <div
      style={{
        padding: "var(--wd-3, 12px) var(--wd-4, 16px)",
        borderLeft: "2px solid var(--wd-success, #58c994)",
        background: "var(--wd-success-soft, rgba(88,201,148,0.08))",
        borderRadius: "0 4px 4px 0",
      }}
    >
      <span
        style={{
          display: "block",
          fontSize: "var(--wd-text-xs, 0.75rem)",
          fontWeight: 600,
          color: "var(--wd-success, #58c994)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "var(--wd-2, 8px)",
        }}
      >
        Verified fact
      </span>
      <p
        style={{
          margin: 0,
          fontSize: "var(--wd-text-sm, 0.875rem)",
          color: "var(--wd-text, #f7f7fa)",
          lineHeight: 1.5,
        }}
      >
        {part.claim}
      </p>
      {part.sourceIds.length > 0 ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--wd-2, 8px)",
            marginTop: "var(--wd-2, 8px)",
          }}
        >
          {part.sourceIds.map((id) => (
            <span
              key={id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "2px var(--wd-2, 8px)",
                borderRadius: 4,
                background: "var(--wd-surface-subtle, rgba(255,255,255,0.06))",
                border: "1px solid var(--wd-border, rgba(255,255,255,0.12))",
                fontSize: "var(--wd-text-xs, 0.75rem)",
                fontFamily: "var(--wd-font-mono, monospace)",
                color: "var(--wd-text-muted, #8d94a5)",
              }}
            >
              {id}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function InferenceDisplay({ part }: { part: InferencePart }) {
  return (
    <div
      style={{
        padding: "var(--wd-3, 12px) var(--wd-4, 16px)",
        borderLeft: "2px solid var(--wd-accent, #b44cff)",
        background: "var(--wd-accent-soft, rgba(180,76,255,0.08))",
        borderRadius: "0 4px 4px 0",
      }}
    >
      <span
        style={{
          display: "block",
          fontSize: "var(--wd-text-xs, 0.75rem)",
          fontStyle: "italic",
          color: "var(--wd-text-muted, #8d94a5)",
          marginBottom: "var(--wd-2, 8px)",
        }}
      >
        {part.label}
      </span>
      <p
        style={{
          margin: 0,
          fontSize: "var(--wd-text-sm, 0.875rem)",
          color: "var(--wd-text, #f7f7fa)",
          lineHeight: 1.5,
        }}
      >
        {part.claim}
      </p>
      {part.uncertainty ? (
        <p
          style={{
            margin: "var(--wd-2, 8px) 0 0 0",
            fontSize: "var(--wd-text-xs, 0.75rem)",
            color: "var(--wd-text-muted, #8d94a5)",
            fontStyle: "italic",
          }}
        >
          {part.uncertainty}
        </p>
      ) : null}
    </div>
  );
}

function UncertaintyDisplay({ part }: { part: UncertaintyPart }) {
  if (!part.requiredForCompletion) return null;
  return (
    <div
      role="alert"
      style={{
        padding: "var(--wd-3, 12px) var(--wd-4, 16px)",
        borderLeft: "2px solid var(--wd-warning, #f3b34c)",
        background: "var(--wd-warning-soft, rgba(243,179,76,0.08))",
        borderRadius: "0 4px 4px 0",
      }}
    >
      <span
        style={{
          display: "block",
          fontSize: "var(--wd-text-xs, 0.75rem)",
          fontWeight: 600,
          color: "var(--wd-warning, #f3b34c)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "var(--wd-2, 8px)",
        }}
      >
        Information gap (required)
      </span>
      <p
        style={{
          margin: 0,
          fontSize: "var(--wd-text-sm, 0.875rem)",
          color: "var(--wd-text, #f7f7fa)",
          lineHeight: 1.5,
        }}
      >
        {part.description}
      </p>
    </div>
  );
}

function RecommendationDisplay({ part }: { part: RecommendationPart }) {
  return (
    <div
      style={{
        padding: "var(--wd-3, 12px) var(--wd-4, 16px)",
        border: "1px solid var(--wd-border, rgba(255,255,255,0.12))",
        borderRadius: 6,
        background: "var(--wd-surface-subtle, rgba(255,255,255,0.04))",
      }}
    >
      <span
        style={{
          display: "block",
          fontSize: "var(--wd-text-xs, 0.75rem)",
          fontWeight: 600,
          color: "var(--wd-text-muted, #8d94a5)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "var(--wd-2, 8px)",
        }}
      >
        Recommendation
      </span>
      <p
        style={{
          margin: 0,
          fontSize: "var(--wd-text-sm, 0.875rem)",
          color: "var(--wd-text, #f7f7fa)",
          lineHeight: 1.5,
        }}
      >
        {part.text}
      </p>
      {part.isLimited && part.limitations ? (
        <p
          style={{
            margin: "var(--wd-2, 8px) 0 0 0",
            fontSize: "var(--wd-text-xs, 0.75rem)",
            color: "var(--wd-warning, #f3b34c)",
            fontStyle: "italic",
          }}
        >
          Suggestion limited: required source unavailable. {part.limitations}
        </p>
      ) : null}
    </div>
  );
}

function EvidenceDisplay({ part }: { part: EvidencePart }) {
  return (
    <div
      style={{
        padding: "var(--wd-3, 12px) var(--wd-4, 16px)",
        border: "1px solid var(--wd-border, rgba(255,255,255,0.12))",
        borderRadius: 6,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--wd-2, 8px)",
          marginBottom: "var(--wd-2, 8px)",
        }}
      >
        <span
          style={{
            fontSize: "var(--wd-text-xs, 0.75rem)",
            fontFamily: "var(--wd-font-mono, monospace)",
            color: "var(--wd-text-muted, #8d94a5)",
          }}
        >
          {part.evidenceId}
        </span>
        <span
          style={{
            fontSize: "var(--wd-text-xs, 0.75rem)",
            color: "var(--wd-text-muted, #8d94a5)",
          }}
        >
          {part.freshness}
        </span>
      </div>
      <p
        style={{
          margin: 0,
          fontSize: "var(--wd-text-sm, 0.875rem)",
          color: "var(--wd-text, #f7f7fa)",
          lineHeight: 1.5,
          fontStyle: "italic",
        }}
      >
        {part.excerpt}
      </p>
    </div>
  );
}

function BlockedActionDisplay({ part }: { part: BlockedActionPart }) {
  return (
    <div
      role="alert"
      style={{
        padding: "var(--wd-3, 12px) var(--wd-4, 16px)",
        borderLeft: "2px solid var(--wd-risk, #e2707a)",
        background: "var(--wd-risk-soft, rgba(226,112,122,0.08))",
        borderRadius: "0 4px 4px 0",
      }}
    >
      <span
        style={{
          display: "block",
          fontSize: "var(--wd-text-xs, 0.75rem)",
          fontWeight: 600,
          color: "var(--wd-risk, #e2707a)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "var(--wd-2, 8px)",
        }}
      >
        Action blocked
      </span>
      <p
        style={{
          margin: 0,
          fontSize: "var(--wd-text-sm, 0.875rem)",
          color: "var(--wd-text, #f7f7fa)",
          lineHeight: 1.5,
        }}
      >
        {part.reason}
      </p>
      <p
        style={{
          margin: "var(--wd-2, 8px) 0 0 0",
          fontSize: "var(--wd-text-xs, 0.75rem)",
          color: "var(--wd-text-muted, #8d94a5)",
        }}
      >
        Prohibited by: {part.prohibitedBy}
      </p>
    </div>
  );
}

/* ==========================================================================
   Part dispatcher
   ========================================================================== */

function PartDisplay({ part }: { part: AssistantResponsePart }) {
  switch (part.type) {
    case "answer":
      return <AnswerDisplay part={part} />;
    case "fact":
      return <FactDisplay part={part} />;
    case "inference":
      return <InferenceDisplay part={part} />;
    case "uncertainty":
      return <UncertaintyDisplay part={part} />;
    case "evidence":
      return <EvidenceDisplay part={part} />;
    case "recommendation":
      return <RecommendationDisplay part={part} />;
    case "blocked-action":
      return <BlockedActionDisplay part={part} />;
    default:
      // proposed-action, approval-request, execution-receipt, follow-up
      // rendered as plain text in this version; interactive variants come later
      return null;
  }
}

/* ==========================================================================
   Source completeness footer
   ========================================================================== */

function SourceStatusFooter({ envelope }: { envelope: AssistantResponseEnvelope }) {
  const unavailable = envelope.requiredSourceStatus.filter(
    (s) => s.status === "unavailable"
  );

  if (!envelope.isLimited && unavailable.length === 0) return null;

  return (
    <div
      style={{
        marginTop: "var(--wd-4, 16px)",
        padding: "var(--wd-3, 12px) var(--wd-4, 16px)",
        borderRadius: 6,
        border: "1px solid var(--wd-warning-border, rgba(243,179,76,0.3))",
        background: "var(--wd-warning-soft, rgba(243,179,76,0.06))",
      }}
    >
      <span
        style={{
          display: "block",
          fontSize: "var(--wd-text-xs, 0.75rem)",
          fontWeight: 600,
          color: "var(--wd-warning, #f3b34c)",
          marginBottom: "var(--wd-2, 8px)",
        }}
      >
        Evidence incomplete
      </span>
      <ul
        style={{
          margin: 0,
          padding: "0 0 0 var(--wd-4, 16px)",
          fontSize: "var(--wd-text-xs, 0.75rem)",
          color: "var(--wd-text-muted, #8d94a5)",
          lineHeight: 1.6,
        }}
      >
        {unavailable.map((s) => (
          <li key={s.sourceId ?? s.sourceKind}>
            {s.sourceKind}
            {s.sourceId ? ` (${s.sourceId})` : ""}: unavailable
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ==========================================================================
   Main component
   ========================================================================== */

export interface AIResponseDisplayProps {
  envelope: AssistantResponseEnvelope;
}

/**
 * Render a validated AssistantResponseEnvelope as typed, labelled parts.
 *
 * The caller is responsible for validating the envelope with validateEnvelope
 * before passing it here. This component trusts the input.
 */
export function AIResponseDisplay({ envelope }: AIResponseDisplayProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--wd-4, 16px)",
      }}
    >
      {envelope.parts.map((part, index) => (
        <PartDisplay key={`${part.type}-${index}`} part={part} />
      ))}
      <SourceStatusFooter envelope={envelope} />
    </div>
  );
}
