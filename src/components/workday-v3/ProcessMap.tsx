/**
 * ProcessMap -- a horizontal stage stepper for role-app process pages.
 *
 * Server-rendered. Stage selection is via query param "?stage=<id>", not
 * client-side state. Clicking a stage navigates to basePath?stage=<stageId>.
 *
 * Visual rules:
 *   Completed stages: muted text with a checkmark glyph.
 *   Current stage: accent color, stronger weight.
 *   Future stages: muted text, no link affordance.
 *
 * No em dashes. No umlauts. No Tailwind.
 */

import { IconCheck } from "@tabler/icons-react";
import type { RoleProcessStage } from "@/role-apps/contracts";
import type { Language } from "@/i18n/labels";

export interface ProcessMapProps {
  stages: RoleProcessStage[];
  currentStageId: string;
  completedStageIds: string[];
  language: Language;
  basePath: string;
  selectedStageId?: string;
}

export function ProcessMap({
  stages,
  currentStageId,
  completedStageIds,
  language,
  basePath,
  selectedStageId,
}: ProcessMapProps) {
  const completedSet = new Set(completedStageIds);
  const activeId = selectedStageId ?? currentStageId;

  return (
    <nav
      aria-label={language === "de" ? "Prozessschritte" : "Process stages"}
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "var(--wd-1)",
        borderBottom: "1px solid var(--wd-border)",
        paddingBottom: "var(--wd-4)",
        marginBottom: "var(--wd-6)",
      }}
    >
      {stages
        .slice()
        .sort((a, b) => a.sequence - b.sequence)
        .map((stage) => {
          const isCompleted = completedSet.has(stage.id);
          const isCurrent = stage.id === currentStageId;
          const isSelected = stage.id === activeId;
          const isFuture = !isCompleted && !isCurrent;

          const label = language === "de" ? stage.nameDe : stage.name;

          const sharedStyle: React.CSSProperties = {
            display: "flex",
            alignItems: "center",
            gap: "var(--wd-2)",
            padding: "var(--wd-2) var(--wd-3)",
            borderRadius: "var(--wd-radius)",
            fontSize: "var(--wd-text-sm)",
            fontWeight: isCurrent ? "var(--wd-weight-strong)" as unknown as number : undefined,
            textDecoration: "none",
            border: isSelected
              ? "1px solid var(--wd-accent-border)"
              : "1px solid transparent",
            background: isSelected ? "var(--wd-accent-soft)" : "transparent",
            color: isFuture
              ? "var(--wd-text-disabled)"
              : isCurrent
              ? "var(--wd-accent)"
              : "var(--wd-text-muted)",
            transition: "background var(--wd-t-fast)",
            cursor: isFuture ? "default" : "pointer",
          };

          const sequenceBadge = (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 18,
                height: 18,
                borderRadius: "var(--wd-radius-pill)",
                fontSize: "var(--wd-text-xs)",
                fontWeight: "var(--wd-weight-medium)" as unknown as number,
                background: isCompleted
                  ? "var(--wd-success-soft)"
                  : isCurrent
                  ? "var(--wd-accent-soft)"
                  : "var(--wd-surface-hover)",
                color: isCompleted
                  ? "var(--wd-success)"
                  : isCurrent
                  ? "var(--wd-accent)"
                  : "var(--wd-text-disabled)",
                flexShrink: 0,
              }}
            >
              {isCompleted ? (
                <IconCheck size={11} stroke={2.5} aria-hidden="true" />
              ) : (
                stage.sequence
              )}
            </span>
          );

          if (isFuture) {
            return (
              <span key={stage.id} style={sharedStyle} aria-label={label}>
                {sequenceBadge}
                <span>{label}</span>
              </span>
            );
          }

          return (
            <a
              key={stage.id}
              href={`${basePath}${basePath.includes("?") ? "&" : "?"}stage=${stage.id}`}
              style={sharedStyle}
              aria-current={isSelected ? "step" : undefined}
            >
              {sequenceBadge}
              <span>{label}</span>
            </a>
          );
        })}
    </nav>
  );
}
