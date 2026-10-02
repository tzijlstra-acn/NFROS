"use client";

import type { CoreSlide23 } from "../../data/types";
import { ProductProofFrame } from "../../product-proof/ProductProofFrame";
import {
  PresentationTitle,
  PresentationSubtitle,
  PresentationMeta,
  PresentationLabel,
} from "../../typography";
import "./slides-8-13.css";

// ---------------------------------------------------------------------------
// Thread node definitions
// ---------------------------------------------------------------------------

type NodeRole = "source" | "ai" | "gate" | "approval" | "receipt" | "audit";

type ThreadNode = {
  id: string;
  role: NodeRole;
  label: string;
  sublabel?: string;
};

const THREAD_NODES: ThreadNode[] = [
  { id: "n1", role: "source", label: "Source evidence" },
  { id: "n2", role: "ai", label: "AI preparation", sublabel: "Prepared" },
  { id: "n3", role: "gate", label: "Human decision", sublabel: "Authority gate" },
  { id: "n4", role: "approval", label: "Approval" },
  { id: "n5", role: "receipt", label: "Execution receipt" },
  { id: "n6", role: "audit", label: "Audit" },
];

// ---------------------------------------------------------------------------
// Node styling by role
// ---------------------------------------------------------------------------

function nodeClassName(role: NodeRole): string {
  switch (role) {
    case "ai":      return "ec-node ec-node--ai";
    case "gate":    return "ec-node ec-node--gate";
    case "receipt": return "ec-node ec-node--receipt";
    case "audit":   return "ec-node ec-node--audit";
    default:        return "ec-node";
  }
}

function nodeGlyph(role: NodeRole): string {
  switch (role) {
    case "ai":      return "A";
    case "gate":    return "!";
    case "approval": return "+";
    case "receipt": return "R";
    case "audit":   return "D";
    default:        return "S";
  }
}

function nodeColor(role: NodeRole): string {
  switch (role) {
    case "ai":
    case "receipt": return "#FFFFFF";
    case "audit":   return "#FFFFFF";
    case "gate":    return "var(--pv23-gate)";
    default:        return "var(--pv23-brand-purple)";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Props = {
  slide: CoreSlide23;
  exportMode?: boolean;
};

export function EvidenceControlSlide({ slide, exportMode }: Props) {
  return (
    <div className="ec-slide">
      {/* Header */}
      <div className="ec-header">
        <PresentationTitle as="h2">{slide.title}</PresentationTitle>
        {slide.subtitle != null && (
          <PresentationSubtitle
            as="p"
            color="var(--pv23-text-secondary)"
            style={{ marginTop: "var(--pv23-3)" }}
          >
            {slide.subtitle}
          </PresentationSubtitle>
        )}
      </div>

      {/* Thread area */}
      <div className="ec-thread-area">
        <div className="ec-thread-track">
          {/* Thread line */}
          <div className="ec-thread-line" aria-hidden="true" />

          {/* Nodes */}
          <div className="ec-nodes">
            {THREAD_NODES.map((node) => {
              const showProof =
                node.role === "gate" ||
                node.role === "receipt" ||
                node.role === "audit";

              return (
                <div key={node.id} className="ec-node-col">
                  {/* Node circle */}
                  <div
                    className={nodeClassName(node.role)}
                    aria-label={node.label}
                  >
                    <span
                      style={{
                        color: nodeColor(node.role),
                        fontFamily: "var(--pv23-font-mono)",
                        fontSize: "var(--pv23-t-footnote)",
                        lineHeight: "var(--pv23-t-footnote-lh)",
                        fontWeight: "var(--pv23-fw-bold)",
                      }}
                    >
                      {nodeGlyph(node.role)}
                    </span>
                  </div>

                  {/* Label */}
                  <div className="ec-node-label">
                    <PresentationMeta
                      as="span"
                      color="var(--pv23-text)"
                      style={{ display: "block", textAlign: "center" }}
                    >
                      {node.label}
                    </PresentationMeta>
                    {node.sublabel != null && (
                      <PresentationMeta
                        as="span"
                        color={
                          node.role === "gate"
                            ? "var(--pv23-gate)"
                            : "var(--pv23-text-secondary)"
                        }
                        style={{ display: "block", textAlign: "center" }}
                      >
                        {node.sublabel}
                      </PresentationMeta>
                    )}
                  </div>

                  {/* Product proof frame for gate, receipt, audit */}
                  {showProof && (
                    <div className="ec-proof-frame">
                      {node.role === "gate" && (
                        <ProductProofFrame
                          id="decision-approval"
                          exportMode={exportMode}
                          style={{ width: 120, height: 80, borderRadius: 0 }}
                        />
                      )}
                      {node.role === "receipt" && (
                        <ProductProofFrame
                          id="execution-receipt"
                          exportMode={exportMode}
                          style={{ width: 120, height: 80, borderRadius: 0 }}
                        />
                      )}
                      {node.role === "audit" && (
                        <ProductProofFrame
                          id="evidence-drawer"
                          exportMode={exportMode}
                          style={{ width: 120, height: 80, borderRadius: 0 }}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bullets */}
      {slide.bullets != null && slide.bullets.length > 0 && (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: "var(--pv23-3)",
            flexShrink: 0,
          }}
        >
          {slide.bullets.map((bullet, i) => (
            <li key={i} style={{ display: "flex", gap: "var(--pv23-3)", alignItems: "baseline" }}>
              <span
                aria-hidden="true"
                style={{
                  width: 6,
                  height: 6,
                  background: "var(--pv23-brand-purple)",
                  display: "inline-block",
                  flexShrink: 0,
                  marginTop: "0.5em",
                }}
              />
              <PresentationLabel as="span" color="var(--pv23-text)">
                {bullet}
              </PresentationLabel>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
