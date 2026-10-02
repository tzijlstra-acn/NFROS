"use client";

import type { CoreSlide23 } from "../../data/types";
import {
  PresentationTitle,
  PresentationSubtitle,
  PresentationLabel,
  PresentationMeta,
  PresentationStatement,
} from "../../typography";
import "./slides-8-13.css";

// ---------------------------------------------------------------------------
// Static work item definitions
// ---------------------------------------------------------------------------

type WorkItemStatus = "auto" | "stop";

type WorkItem = {
  label: string;
  status: WorkItemStatus;
};

const AI_ITEMS: WorkItem[] = [
  { label: "Evidence retrieval", status: "auto" },
  { label: "Draft preparation", status: "auto" },
  { label: "Routine reminder", status: "auto" },
  { label: "Residual risk decision", status: "stop" },
  { label: "Supplier approval", status: "stop" },
];

const HUMAN_ITEMS: WorkItem[] = [
  { label: "Assess residual risk", status: "auto" },
  { label: "Approve supplier", status: "auto" },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusIcon({ status }: { status: WorkItemStatus }) {
  if (status === "auto") {
    return (
      <span className="ab-status-icon ab-status-icon--auto" aria-label="Auto">
        +
      </span>
    );
  }
  return (
    <span className="ab-status-icon ab-status-icon--stop" aria-label="Awaiting review">
      !
    </span>
  );
}

function WorkItemRow({ item }: { item: WorkItem }) {
  return (
    <div className="ab-work-item">
      {item.status === "stop" && (
        <div className="ab-gate-line" aria-hidden="true" />
      )}
      <div
        className={[
          "ab-item-card",
          item.status === "auto" ? "ab-item-card--auto" : "ab-item-card--stop",
        ].join(" ")}
        aria-hidden="true"
      >
        <StatusIcon status={item.status} />
      </div>
      <div className="ab-item-label">
        <PresentationMeta
          color={
            item.status === "stop"
              ? "var(--pv23-gate)"
              : "var(--pv23-text-secondary)"
          }
        >
          {item.label}
        </PresentationMeta>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Props = {
  slide: CoreSlide23;
  exportMode?: boolean;
};

export function AuthorityBoundarySlide({ slide, exportMode: _exportMode }: Props) {
  return (
    <div className="ab-slide">
      {/* Header */}
      <div style={{ textAlign: "center", width: "100%" }}>
        <PresentationTitle as="h2">{slide.title}</PresentationTitle>
        {slide.subtitle != null && (
          <PresentationSubtitle
            as="p"
            style={{ marginTop: "var(--pv23-3)" }}
            color="var(--pv23-text-secondary)"
          >
            {slide.subtitle}
          </PresentationSubtitle>
        )}
      </div>

      {/* Tracks */}
      <div className="ab-tracks">
        {/* Left: AI Partner track */}
        <div className="ab-track ab-track--left">
          <div className="ab-track-label">
            <PresentationLabel color="var(--pv23-brand-purple)">
              AI Partner
            </PresentationLabel>
          </div>
          <div className="ab-rail-items">
            {AI_ITEMS.map((item, i) => (
              <WorkItemRow key={i} item={item} />
            ))}
          </div>
        </div>

        {/* Right: Risk professional track */}
        <div className="ab-track">
          <div className="ab-track-label">
            <PresentationLabel color="var(--pv23-text)">
              Risk professional
            </PresentationLabel>
          </div>
          <div className="ab-rail-items">
            {HUMAN_ITEMS.map((item, i) => (
              <WorkItemRow key={i} item={item} />
            ))}
            <div className="ab-work-item">
              <div
                style={{
                  width: 40,
                  height: 28,
                  border: "2px solid var(--pv23-evidence)",
                  background: "var(--pv23-surface)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  borderRadius: 0,
                }}
                aria-hidden="true"
              >
                <span
                  style={{
                    color: "var(--pv23-evidence)",
                    fontFamily: "var(--pv23-font-mono)",
                    fontSize: "var(--pv23-t-footnote)",
                    lineHeight: "var(--pv23-t-footnote-lh)",
                  }}
                >
                  OK
                </span>
              </div>
              <div className="ab-item-label">
                <PresentationMeta color="var(--pv23-evidence)">
                  Approved
                </PresentationMeta>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom statement */}
      <div className="ab-statement">
        <PresentationStatement color="var(--pv23-text)">
          Material decisions stay with you.
        </PresentationStatement>
      </div>
    </div>
  );
}
