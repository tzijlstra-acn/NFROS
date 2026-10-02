"use client";

/**
 * AgendaSlide
 *
 * Slide 2 (and the A-key overlay) of the V2.1 deck.
 * Shows five numbered agenda items that match the bullets on core slide 2
 * and highlights the current section via the `activeSection` prop.
 *
 * The `activeSection` value should be the `agendaSection` field of the
 * currently displayed CoreSlide. The five section keys below map directly
 * to the `agendaSection` values on CORE_SLIDES.
 *
 * Agenda item to section key mapping:
 *   1. "The problem -- fragmented NFR work"    -> "Problem"
 *   2. "The product -- an OS for risk roles"   -> "Product"
 *   3. "The daily experience"                  -> "Daily" (+ Roles, RoleApps, HumanAI, Improvement, Control)
 *   4. "The service -- how we deliver"         -> "Service" / "Rollout"
 *   5. "The next step -- a narrow pilot"       -> "NextStep"
 */

import React from "react";

// ---------------------------------------------------------------------------
// Agenda data
// The labels match the bullets on slide 2 exactly.
// The `sections` array lists all agendaSection values that fall under this item.
// ---------------------------------------------------------------------------

interface AgendaItem {
  number: number;
  label: string;
  sections: string[];
}

const AGENDA_ITEMS: AgendaItem[] = [
  {
    number: 1,
    label: "The problem -- fragmented NFR work",
    sections: ["Problem"],
  },
  {
    number: 2,
    label: "The product -- an OS for risk roles",
    sections: ["Product", "Roles", "RoleApps"],
  },
  {
    number: 3,
    label: "The daily experience -- work that finds you",
    sections: ["Daily", "HumanAI", "Improvement", "Control"],
  },
  {
    number: 4,
    label: "The service -- how we deliver and scale",
    sections: ["Service", "Rollout"],
  },
  {
    number: 5,
    label: "The next step -- a narrow pilot proposal",
    sections: ["NextStep"],
  },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AgendaSlideProps {
  /**
   * The agendaSection key of the current slide. The matching agenda item will
   * be highlighted. Pass an empty string when no item should be highlighted
   * (e.g. on slide 1 or slide 2 itself).
   */
  activeSection: string;
  /**
   * Called when the overlay should close. Optional: when used as a full slide
   * rather than an overlay, this is not provided.
   */
  onClose?: () => void;
  /**
   * Called when the presenter clicks "Open appendix". Only used in overlay mode.
   */
  onOpenAppendix?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AgendaSlide({ activeSection, onClose, onOpenAppendix }: AgendaSlideProps) {
  const isOverlay = onClose != null;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        background: "var(--pv21-color-surface)",
        borderRadius: isOverlay ? "var(--pv21-radius-xl)" : 0,
        padding: isOverlay
          ? "var(--pv21-space-12) var(--pv21-space-16)"
          : "var(--pv21-space-10) var(--pv21-space-16)",
        width: isOverlay ? "min(960px, 90vw)" : "100%",
        height: isOverlay ? undefined : "100%",
        display: "flex",
        flexDirection: "column",
        gap: "var(--pv21-space-8)",
        justifyContent: isOverlay ? undefined : "center",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "var(--pv21-space-4)",
        }}
      >
        <div>
          <p
            style={{
              fontFamily: "var(--pv21-font-mono)",
              fontSize: "var(--pv21-text-xs)",
              color: "var(--pv21-color-accent)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              margin: 0,
              marginBottom: "var(--pv21-space-2)",
            }}
          >
            Agenda
          </p>
          <h2
            style={{
              fontSize: isOverlay ? "var(--pv21-text-3xl)" : "var(--pv21-text-4xl)",
              fontWeight: 600,
              color: "var(--pv21-color-text)",
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            Five things we will cover
          </h2>
        </div>

        {isOverlay && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close agenda"
            style={{
              background: "none",
              border: "1px solid var(--pv21-color-border)",
              borderRadius: "var(--pv21-radius-md)",
              padding: "var(--pv21-space-2) var(--pv21-space-4)",
              fontFamily: "var(--pv21-font-mono)",
              fontSize: "var(--pv21-text-xs)",
              color: "var(--pv21-color-secondary)",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            Close (A)
          </button>
        )}
      </div>

      {/* Agenda list */}
      <ol
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: 0,
        }}
      >
        {AGENDA_ITEMS.map((item) => {
          const isActive = item.sections.includes(activeSection);
          return (
            <li
              key={item.number}
              className={
                "pv21-agenda-item" + (isActive ? " pv21-agenda-item--active" : "")
              }
            >
              <span className="pv21-agenda-item__number">
                {String(item.number).padStart(2, "0")}
              </span>
              <span className="pv21-agenda-item__label">{item.label}</span>
            </li>
          );
        })}
      </ol>

      {/* Overlay footer */}
      {isOverlay && (
        <div
          style={{
            display: "flex",
            gap: "var(--pv21-space-3)",
            paddingTop: "var(--pv21-space-4)",
            borderTop: "1px solid var(--pv21-color-border)",
          }}
        >
          {onOpenAppendix != null && (
            <button
              type="button"
              onClick={onOpenAppendix}
              style={{
                background: "var(--pv21-color-muted-bg)",
                border: "1px solid var(--pv21-color-border)",
                borderRadius: "var(--pv21-radius-md)",
                padding: "var(--pv21-space-2) var(--pv21-space-5)",
                fontFamily: "var(--pv21-font-sans)",
                fontSize: "var(--pv21-text-sm)",
                color: "var(--pv21-color-text)",
                cursor: "pointer",
              }}
            >
              Open appendix
            </button>
          )}
        </div>
      )}
    </div>
  );
}
