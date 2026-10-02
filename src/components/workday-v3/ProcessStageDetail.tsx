/**
 * ProcessStageDetail -- shows the detail of one process stage.
 *
 * Server-rendered. Compact: up to three sections (stage info, outcome,
 * human responsibility). No generate button, no fake delay.
 *
 * The "Synthetic institution and data" disclosure is NOT rendered here --
 * it belongs at the foot of the page, not inside a repeated component.
 *
 * No em dashes. No umlauts. No Tailwind.
 */

import type { RoleProcessStage, RoleAppRun } from "@/role-apps/contracts";
import type { Language } from "@/i18n/labels";

export interface ProcessStageDetailProps {
  stage: RoleProcessStage;
  run: RoleAppRun;
  language: Language;
  isCurrentStage: boolean;
}

const COPY = {
  outcome: { en: "Outcome", de: "Ergebnis" },
  responsibility: { en: "Your responsibility", de: "Ihre Verantwortung" },
  now: { en: "Now", de: "Jetzt" },
  inProgress: {
    en: "This stage is active. The AI has prepared the evidence and your decision is the next step.",
    de: "Dieser Schritt ist aktiv. Die KI hat die Nachweise vorbereitet und Ihre Entscheidung ist der naechste Schritt.",
  },
  relatedObjects: { en: "Related objects", de: "Verwandte Objekte" },
} as const;

function pick(pair: { en: string; de: string }, language: Language): string {
  return language === "de" ? pair.de : pair.en;
}

function labelStyle(): React.CSSProperties {
  return {
    display: "block",
    fontSize: "var(--wd-text-xs)",
    fontWeight: "var(--wd-weight-medium)" as unknown as number,
    color: "var(--wd-text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: "var(--wd-1)",
  };
}

export function ProcessStageDetail({
  stage,
  language,
  isCurrentStage,
}: ProcessStageDetailProps) {
  const stageName = language === "de" ? stage.nameDe : stage.name;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--wd-5)",
      }}
    >
      {/* Stage heading */}
      <div>
        <h2
          style={{
            fontSize: "var(--wd-text-xl)",
            fontWeight: "var(--wd-weight-strong)" as unknown as number,
            color: "var(--wd-text)",
            lineHeight: "var(--wd-leading-tight)",
          }}
        >
          {stageName}
        </h2>
      </div>

      {/* Now box -- only for the current stage */}
      {isCurrentStage ? (
        <div
          style={{
            padding: "var(--wd-3) var(--wd-4)",
            background: "var(--wd-accent-soft)",
            border: "1px solid var(--wd-accent-border)",
            borderRadius: "var(--wd-radius)",
          }}
        >
          <span
            style={{
              display: "block",
              fontSize: "var(--wd-text-xs)",
              fontWeight: "var(--wd-weight-strong)" as unknown as number,
              color: "var(--wd-accent)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: "var(--wd-1)",
            }}
          >
            {pick(COPY.now, language)}
          </span>
          <p
            style={{
              fontSize: "var(--wd-text-sm)",
              color: "var(--wd-text-secondary)",
              lineHeight: "var(--wd-leading-normal)",
              margin: 0,
            }}
          >
            {pick(COPY.inProgress, language)}
          </p>
        </div>
      ) : null}

      {/* Outcome */}
      <div>
        <span style={labelStyle()}>{pick(COPY.outcome, language)}</span>
        <p
          style={{
            fontSize: "var(--wd-text-base)",
            color: "var(--wd-text-secondary)",
            lineHeight: "var(--wd-leading-normal)",
            margin: 0,
          }}
        >
          {stage.outcome}
        </p>
      </div>

      {/* Human responsibility */}
      <div>
        <span style={labelStyle()}>{pick(COPY.responsibility, language)}</span>
        <p
          style={{
            fontSize: "var(--wd-text-md)",
            fontWeight: "var(--wd-weight-medium)" as unknown as number,
            color: "var(--wd-text)",
            lineHeight: "var(--wd-leading-snug)",
            margin: 0,
          }}
        >
          {stage.humanResponsibility}
        </p>
      </div>

      {/* Related object kind chips */}
      {stage.relatedObjectKinds.length > 0 ? (
        <div>
          <span style={labelStyle()}>{pick(COPY.relatedObjects, language)}</span>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--wd-2)",
              marginTop: "var(--wd-1)",
            }}
          >
            {stage.relatedObjectKinds.map((kind) => (
              <span
                key={kind}
                style={{
                  display: "inline-block",
                  padding: "2px var(--wd-2)",
                  background: "var(--wd-surface-subtle)",
                  border: "1px solid var(--wd-border)",
                  borderRadius: "var(--wd-radius-pill)",
                  fontSize: "var(--wd-text-xs)",
                  color: "var(--wd-text-secondary)",
                }}
              >
                {kind}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
