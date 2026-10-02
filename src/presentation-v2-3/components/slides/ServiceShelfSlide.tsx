"use client";

import { motion } from "motion/react";
import type { CoreSlide23 } from "../../data/types";
import type { ServiceLayer } from "../../data/types";
import {
  PresentationTitle,
  PresentationSubtitle,
  PresentationLabel,
  PresentationMeta,
  PresentationStatement,
} from "../../typography";
import "./slides-8-13.css";

// ---------------------------------------------------------------------------
// Static Role App slot definitions
// ---------------------------------------------------------------------------

type RoleAppSlot = {
  label: string;
  variant: "filled" | "empty" | "new";
};

const ROLE_APP_SLOTS: RoleAppSlot[] = [
  { label: "RCSA Cycle Assistant", variant: "filled" },
  { label: "Third-Party Onboarding", variant: "filled" },
  { label: "Adverse Media Monitor", variant: "filled" },
  { label: "New Role App", variant: "new" },
  { label: "", variant: "empty" },
];

const CONNECTOR_LABELS = [
  "Identity connector",
  "GRC connector",
  "Data platform connector",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findLayer(
  layers: ServiceLayer[],
  type: ServiceLayer["semanticType"],
): ServiceLayer | undefined {
  return layers.find((l) => l.semanticType === type);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Props = {
  slide: CoreSlide23;
  exportMode?: boolean;
};

export function ServiceShelfSlide({ slide, exportMode }: Props) {
  const layers = slide.serviceLayers ?? [];
  const managedLayer = findLayer(layers, "managed-service");
  const roleAppLayer = findLayer(layers, "role-app");
  const functionLayer = findLayer(layers, "function");
  const platformLayer = findLayer(layers, "platform");

  const newAppVariants = {
    hidden: { y: -40, opacity: 0 },
    visible: { y: 0, opacity: 1 },
  };

  return (
    <div className="ss-slide">
      {/* Header */}
      <div className="ss-header">
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

      {/* Shelf */}
      <div className="ss-shelf">
        {/* 1. Managed service band (top) */}
        <div className="ss-managed-band">
          <PresentationLabel as="span" color="var(--pv23-brand-purple-dark)">
            {managedLayer?.name ?? "Managed Operations"}
          </PresentationLabel>
          <PresentationMeta
            as="span"
            color="var(--pv23-text-secondary)"
            style={{ marginLeft: "var(--pv23-4)" }}
          >
            {managedLayer?.detail ?? "Monitoring, model reviews, new releases, user support"}
          </PresentationMeta>
        </div>

        {/* 2. Role Apps row */}
        <div>
          <PresentationMeta
            as="div"
            color="var(--pv23-text-secondary)"
            style={{ marginBottom: "var(--pv23-2)" }}
          >
            {roleAppLayer?.name ?? "Role Apps"}
          </PresentationMeta>
          <div className="ss-role-apps-row">
            {ROLE_APP_SLOTS.map((slot, i) => {
              if (slot.variant === "new") {
                return (
                  <motion.div
                    key={i}
                    className="ss-role-app-slot ss-role-app-slot--new"
                    variants={newAppVariants}
                    initial={exportMode ? "visible" : "hidden"}
                    animate="visible"
                    transition={{ delay: 0.6, duration: 0.4, ease: [0, 0, 0.2, 1] }}
                  >
                    <PresentationMeta
                      as="span"
                      color="var(--pv23-brand-purple)"
                      style={{ textAlign: "center" }}
                    >
                      {slot.label}
                    </PresentationMeta>
                  </motion.div>
                );
              }
              if (slot.variant === "empty") {
                return (
                  <div key={i} className="ss-role-app-slot ss-role-app-slot--empty">
                    <PresentationMeta as="span" color="var(--pv23-border-strong)">
                      +
                    </PresentationMeta>
                  </div>
                );
              }
              return (
                <div key={i} className="ss-role-app-slot">
                  <PresentationMeta
                    as="span"
                    color="var(--pv23-text)"
                    style={{ textAlign: "center" }}
                  >
                    {slot.label}
                  </PresentationMeta>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Function Packs row */}
        <div>
          <PresentationMeta
            as="div"
            color="var(--pv23-text-secondary)"
            style={{ marginBottom: "var(--pv23-2)" }}
          >
            {functionLayer?.name ?? "Function Packs"}
          </PresentationMeta>
          <div className="ss-function-packs-row">
            {["OR", "TPRM", "Control Assurance"].map((pack, i) => (
              <div key={i} className="ss-function-pack-slot">
                <PresentationLabel as="span" color="var(--pv23-text)">
                  {pack}
                </PresentationLabel>
                <PresentationMeta as="span" color="var(--pv23-text-secondary)">
                  Role OS + base configuration
                </PresentationMeta>
              </div>
            ))}
          </div>
        </div>

        {/* 4. NFR Operating System platform bar */}
        <div className="ss-platform-bar">
          <PresentationLabel as="span" color="#FFFFFF">
            {platformLayer?.name ?? "NFR Operating System"} -- Platform
          </PresentationLabel>
          <PresentationMeta
            as="span"
            color="rgba(255,255,255,0.6)"
            style={{ marginLeft: "var(--pv23-6)" }}
          >
            {platformLayer?.detail ?? "Infrastructure, identity, AI model access, security"}
          </PresentationMeta>
        </div>

        {/* 5. Connectors below platform */}
        <div className="ss-connectors-row">
          {CONNECTOR_LABELS.map((label, i) => (
            <div key={i} className="ss-connector">
              <PresentationMeta as="span" color="var(--pv23-text-secondary)">
                {label}
              </PresentationMeta>
            </div>
          ))}
        </div>
      </div>

      {/* Statement */}
      <div className="ss-statement">
        <PresentationStatement color="var(--pv23-text)">
          Add a process without rebuilding the platform.
        </PresentationStatement>
      </div>
    </div>
  );
}
