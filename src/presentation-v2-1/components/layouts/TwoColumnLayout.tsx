"use client";

/**
 * TwoColumnLayout
 *
 * Two equal col-cards side by side.
 *
 * slide-06 (Roles): left = OR Partner OS, right = TPRM Manager OS,
 * each with heading, colored accent, and bullet list.
 *
 * slide-08 (HumanAI): left = "AI Partner" (accent), right = "Risk professional"
 * (human amber). Between them: "Material action requires human authority."
 */

import React from "react";
import { type CoreSlide } from "@/presentation-v2-1/data/core-story";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TwoColumnLayoutProps {
  slide: CoreSlide;
}

// ---------------------------------------------------------------------------
// HumanAI variant (slide-08)
// ---------------------------------------------------------------------------

function HumanAIColumns({ slide }: { slide: CoreSlide }) {
  const aiLine = slide.emphasis?.[0] ?? "AI: aggregate, draft, flag, link";
  const humanLine = slide.emphasis?.[1] ?? "Human: assess, challenge, approve, escalate";

  // Parse "Label: item1, item2, ..." into label + items array.
  function parseLine(line: string): { label: string; items: string[] } {
    const colonIdx = line.indexOf(": ");
    if (colonIdx < 0) return { label: line, items: [] };
    const label = line.slice(0, colonIdx);
    const items = line
      .slice(colonIdx + 2)
      .split(", ")
      .map((s) => s.trim());
    return { label, items };
  }

  const ai = parseLine(aiLine);
  const human = parseLine(humanLine);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: "var(--pv21-space-10) var(--pv21-space-16)",
        gap: "var(--pv21-space-8)",
        justifyContent: "center",
      }}
    >
      {/* Header */}
      <div>
        <p
          style={{
            fontFamily: "var(--pv21-font-mono)",
            fontSize: "var(--pv21-text-xs)",
            color: "var(--pv21-color-accent)",
            textTransform: "uppercase",
            letterSpacing: "0.10em",
            margin: 0,
            marginBottom: "var(--pv21-space-3)",
          }}
        >
          {slide.section}
        </p>
        <h1 className="pv21-title">{slide.title}</h1>
        {slide.subtitle != null && (
          <p className="pv21-subtitle" style={{ marginTop: "var(--pv21-space-3)" }}>
            {slide.subtitle}
          </p>
        )}
        {slide.bodyCopy != null && (
          <p className="pv21-body" style={{ marginTop: "var(--pv21-space-4)" }}>
            {slide.bodyCopy}
          </p>
        )}
      </div>

      {/* Two columns */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)",
          gap: "var(--pv21-space-6)",
          alignItems: "start",
        }}
      >
        {/* AI column */}
        <div
          className="pv21-col-card"
          style={{
            borderTop: "3px solid var(--pv21-color-accent)",
          }}
        >
          <p
            style={{
              fontFamily: "var(--pv21-font-mono)",
              fontSize: "var(--pv21-text-xs)",
              color: "var(--pv21-color-accent)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              margin: 0,
            }}
          >
            AI Partner
          </p>
          <p
            style={{
              fontSize: "var(--pv21-text-lg)",
              fontWeight: 600,
              color: "var(--pv21-color-text)",
              margin: 0,
            }}
          >
            {ai.label}
          </p>
          {ai.items.length > 0 && (
            <ul className="pv21-bullets">
              {ai.items.map((item, i) => (
                <li key={i} className="pv21-bullet">
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Divider */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "var(--pv21-space-3)",
            paddingTop: "var(--pv21-space-6)",
            alignSelf: "stretch",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: "1px",
              flex: 1,
              background: "var(--pv21-color-border)",
              maxHeight: 120,
            }}
          />
          <p
            style={{
              fontFamily: "var(--pv21-font-sans)",
              fontSize: "var(--pv21-text-xs)",
              color: "var(--pv21-color-secondary)",
              textAlign: "center",
              maxWidth: 80,
              lineHeight: 1.3,
              margin: 0,
            }}
          >
            Material action requires human authority.
          </p>
          <div
            style={{
              width: "1px",
              flex: 1,
              background: "var(--pv21-color-border)",
              maxHeight: 120,
            }}
          />
        </div>

        {/* Human column */}
        <div
          className="pv21-col-card"
          style={{
            borderTop: "3px solid var(--pv21-color-human)",
          }}
        >
          <p
            style={{
              fontFamily: "var(--pv21-font-mono)",
              fontSize: "var(--pv21-text-xs)",
              color: "var(--pv21-color-human)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              margin: 0,
            }}
          >
            Risk professional
          </p>
          <p
            style={{
              fontSize: "var(--pv21-text-lg)",
              fontWeight: 600,
              color: "var(--pv21-color-text)",
              margin: 0,
            }}
          >
            {human.label}
          </p>
          {human.items.length > 0 && (
            <ul className="pv21-bullets">
              {human.items.map((item, i) => (
                <li key={i} className="pv21-bullet">
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Roles variant (slide-06) and generic
// ---------------------------------------------------------------------------

function RolesColumns({ slide }: { slide: CoreSlide }) {
  // Bullets: first two are role-specific (OR Partner, TPRM Manager),
  // remaining two are shared platform bullets.
  const bullets = slide.bullets ?? [];
  const [roleBulletA, roleBulletB, ...shared] = bullets;

  function parseRole(line: string | undefined): { label: string; detail: string } {
    if (line == null) return { label: "", detail: "" };
    const colonIdx = line.indexOf(": ");
    if (colonIdx < 0) return { label: line, detail: "" };
    return { label: line.slice(0, colonIdx), detail: line.slice(colonIdx + 2) };
  }

  const roleA = parseRole(roleBulletA);
  const roleB = parseRole(roleBulletB);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: "var(--pv21-space-10) var(--pv21-space-16)",
        gap: "var(--pv21-space-8)",
        justifyContent: "center",
      }}
    >
      {/* Header */}
      <div>
        <p
          style={{
            fontFamily: "var(--pv21-font-mono)",
            fontSize: "var(--pv21-text-xs)",
            color: "var(--pv21-color-accent)",
            textTransform: "uppercase",
            letterSpacing: "0.10em",
            margin: 0,
            marginBottom: "var(--pv21-space-3)",
          }}
        >
          {slide.section}
        </p>
        <h1 className="pv21-title">{slide.title}</h1>
        {slide.subtitle != null && (
          <p className="pv21-subtitle" style={{ marginTop: "var(--pv21-space-3)" }}>
            {slide.subtitle}
          </p>
        )}
        {slide.bodyCopy != null && (
          <p className="pv21-body" style={{ marginTop: "var(--pv21-space-4)" }}>
            {slide.bodyCopy}
          </p>
        )}
      </div>

      {/* Two role cards */}
      <div className="pv21-layout-two-col" style={{ padding: 0, height: "auto" }}>
        <div className="pv21-col-card" style={{ borderTop: "3px solid var(--pv21-color-accent)" }}>
          <p
            style={{
              fontFamily: "var(--pv21-font-mono)",
              fontSize: "var(--pv21-text-xs)",
              color: "var(--pv21-color-accent)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              margin: 0,
            }}
          >
            {roleA.label}
          </p>
          <p
            style={{
              fontSize: "var(--pv21-text-base)",
              color: "var(--pv21-color-secondary)",
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            {roleA.detail}
          </p>
        </div>

        <div className="pv21-col-card" style={{ borderTop: "3px solid var(--pv21-color-info)" }}>
          <p
            style={{
              fontFamily: "var(--pv21-font-mono)",
              fontSize: "var(--pv21-text-xs)",
              color: "var(--pv21-color-info)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              margin: 0,
            }}
          >
            {roleB.label}
          </p>
          <p
            style={{
              fontSize: "var(--pv21-text-base)",
              color: "var(--pv21-color-secondary)",
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            {roleB.detail}
          </p>
        </div>
      </div>

      {/* Shared bullets */}
      {shared.length > 0 && (
        <ul className="pv21-bullets">
          {shared.map((b, i) => (
            <li key={i} className="pv21-bullet">
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TwoColumnLayout({ slide }: TwoColumnLayoutProps) {
  if (slide.section === "HumanAI") {
    return <HumanAIColumns slide={slide} />;
  }
  return <RolesColumns slide={slide} />;
}
