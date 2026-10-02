"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import type { SwimlaneData } from "@/presentation-v2-4/data/types";
import {
  IconSearch,
  IconChartBar,
  IconClipboardList,
  IconUserCheck,
  IconTool,
  IconCircleCheck,
  IconBell,
  IconShieldCheck,
  IconPackage,
  IconActivity,
} from "@tabler/icons-react";

export interface RoleAppSwimlaneExhibitProps {
  data: SwimlaneData;
  exportMode?: boolean;
}

// Drawn on the 1920 x 780 exhibit stage
const CANVAS_W = 1920;
const CANVAS_H = 780;
const STAGE_CX: readonly number[] = [150, 420, 690, 960, 1230, 1500, 1770];
const HEADER_TOP = 88;
const HEADER_H = 84;
const HEADER_W = 214;
const ARROW_Y = HEADER_TOP + HEADER_H / 2;
const CARD_TOP = HEADER_TOP + HEADER_H + 14;
const CARD_W = 252;
const CARD_H = 330;
const CHIP_SECTION_TOP = 572;
const STAGE_GAP = 0.4;

const AI_COLOR = "var(--pv24-accent)";
const HUMAN_COLOR = "var(--pv24-brand-purple-dark)";

function AiBadge() {
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.08em",
        color: "var(--pv24-accent-dark)",
        background: "var(--pv24-accent-lightest)",
        padding: "3px 10px",
        marginBottom: 10,
      }}
    >
      AI PREPARED
    </span>
  );
}

function HumanBadge() {
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.08em",
        color: "#FFFFFF",
        background: HUMAN_COLOR,
        padding: "3px 10px",
        marginBottom: 10,
      }}
    >
      HUMAN GATE
    </span>
  );
}

const titleStyle: React.CSSProperties = {
  fontSize: 17,
  color: "var(--pv24-text)",
  fontWeight: 700,
  lineHeight: 1.25,
  margin: "0 0 12px",
};

const bodyStyle: React.CSSProperties = {
  fontSize: 15,
  color: "var(--pv24-text-secondary)",
  margin: 0,
  lineHeight: 1.4,
};

function BulletRow({ text, color }: { text: string; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 7 }}>
      <div style={{ width: 7, height: 7, background: color, flexShrink: 0, marginTop: 7 }} />
      <span style={bodyStyle}>{text}</span>
    </div>
  );
}

function CheckRow({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 7 }}>
      <IconCircleCheck size={18} color={AI_COLOR} style={{ flexShrink: 0, marginTop: 1 }} />
      <span style={bodyStyle}>{text}</span>
    </div>
  );
}

function FormFieldRow({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div style={{ marginBottom: 9 }}>
      <div
        style={{
          fontSize: 12,
          color: "var(--pv24-text-secondary)",
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          background: "var(--pv24-surface)",
          border: "1px solid var(--pv24-border-strong)",
          padding: "6px 10px",
          fontSize: 16,
          fontWeight: 700,
          color: highlight ?? "var(--pv24-text)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <IconCircleCheck size={16} color={AI_COLOR} style={{ flexShrink: 0 }} />
        {value}
      </div>
    </div>
  );
}

function RiskBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = Math.round((count / total) * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <div
        style={{
          width: 70,
          fontSize: 12,
          fontWeight: 700,
          color,
          border: `1.5px solid ${color}`,
          padding: "3px 0",
          textAlign: "center",
          flexShrink: 0,
        }}
      >
        {label}
      </div>
      <div style={{ flex: 1, height: 10, background: "var(--pv24-muted-bg)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color }} />
      </div>
      <span style={{ fontSize: 18, fontWeight: 700, color: "var(--pv24-text)", width: 26, textAlign: "right", flexShrink: 0 }}>
        {count}
      </span>
    </div>
  );
}

type StageKind = "ai" | "human-gate";

interface StageInfo {
  id: string;
  label: string;
  kind: StageKind;
}

const STAGE_INFO: StageInfo[] = [
  { id: "scope", label: "Scope", kind: "ai" },
  { id: "assess", label: "Assess risk", kind: "ai" },
  { id: "evidence", label: "Evidence", kind: "ai" },
  { id: "gate1", label: "Gate 1: Review", kind: "human-gate" },
  { id: "remediation", label: "Remediation", kind: "ai" },
  { id: "gate2", label: "Gate 2: Approve", kind: "human-gate" },
  { id: "monitor", label: "Monitor", kind: "ai" },
];

function StageIcon({ id, size, color }: { id: string; size: number; color: string }) {
  switch (id) {
    case "scope":
      return <IconSearch size={size} color={color} stroke={1.7} />;
    case "assess":
      return <IconChartBar size={size} color={color} stroke={1.7} />;
    case "evidence":
      return <IconClipboardList size={size} color={color} stroke={1.7} />;
    case "gate1":
      return <IconUserCheck size={size} color={color} stroke={1.7} />;
    case "remediation":
      return <IconTool size={size} color={color} stroke={1.7} />;
    case "gate2":
      return <IconCircleCheck size={size} color={color} stroke={1.7} />;
    case "monitor":
      return <IconBell size={size} color={color} stroke={1.7} />;
    default:
      return <IconShieldCheck size={size} color={color} stroke={1.7} />;
  }
}

function StageCardContent({ id }: { id: string }) {
  switch (id) {
    case "scope":
      return (
        <div>
          <AiBadge />
          <p style={titleStyle}>23 active third-party contracts pulled</p>
          <BulletRow text="Vendor registry: 18 live contracts" color={AI_COLOR} />
          <BulletRow text="In-flight onboardings: 5 suppliers" color={AI_COLOR} />
          <BulletRow text="3 expiring SLAs flagged" color="#E8A317" />
        </div>
      );
    case "assess":
      return (
        <div>
          <AiBadge />
          <p style={titleStyle}>Findings auto-categorised</p>
          <RiskBar label="HIGH" count={4} total={23} color="#D93F3F" />
          <RiskBar label="MEDIUM" count={12} total={23} color="#E8A317" />
          <RiskBar label="LOW" count={7} total={23} color="#2E9E5B" />
        </div>
      );
    case "evidence":
      return (
        <div>
          <AiBadge />
          <p style={{ ...titleStyle, marginBottom: 10 }}>Assessment form pre-filled</p>
          <FormFieldRow label="Risk tier" value="HIGH" highlight="#D93F3F" />
          <FormFieldRow label="Assessment date" value="15 Oct 2025" />
          <FormFieldRow label="Last review outcome" value="Pass" />
        </div>
      );
    case "gate1":
      return (
        <div>
          <HumanBadge />
          <p style={titleStyle}>Risk manager reviews 4 HIGH findings</p>
          <p style={bodyStyle}>AI summary and evidence shown per finding. The manager confirms, escalates or sends back.</p>
        </div>
      );
    case "remediation":
      return (
        <div>
          <AiBadge />
          <p style={titleStyle}>3 remediation plans drafted</p>
          <CheckRow text="Owner proposed from org chart" />
          <CheckRow text="Deadline set per policy SLA" />
          <CheckRow text="Evidence checklist generated" />
        </div>
      );
    case "gate2":
      return (
        <div>
          <HumanBadge />
          <p style={titleStyle}>Head of TPRM approves the plan</p>
          <p style={bodyStyle}>Approval logged with timestamp and approver identity. Vendor notified only after approval.</p>
        </div>
      );
    case "monitor":
      return (
        <div>
          <AiBadge />
          <p style={titleStyle}>Ongoing monitoring configured</p>
          <BulletRow text="Next review scheduled in 90 days" color={AI_COLOR} />
          <BulletRow text="Alert rules active for 4 vendors" color={AI_COLOR} />
          <BulletRow text="Escalation path recorded" color={AI_COLOR} />
        </div>
      );
    default:
      return null;
  }
}

function ArrowLayer({ skip }: { skip: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width={CANVAS_W}
      height={CANVAS_H}
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
    >
      {STAGE_INFO.slice(0, -1).map((_, i) => {
        const x1 = (STAGE_CX[i] ?? 0) + HEADER_W / 2 + 4;
        const x2 = (STAGE_CX[i + 1] ?? 0) - HEADER_W / 2 - 4;
        const delay = (i + 1) * STAGE_GAP - 0.15;
        return (
          <g key={i}>
            <motion.line
              x1={x1}
              y1={ARROW_Y}
              x2={x2 - 10}
              y2={ARROW_Y}
              stroke="var(--pv24-accent)"
              strokeWidth={3}
              initial={skip ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={skip ? undefined : { duration: 0.2, delay, ease: "easeOut" }}
            />
            <motion.polygon
              points={`${x2},${ARROW_Y} ${x2 - 11},${ARROW_Y - 7} ${x2 - 11},${ARROW_Y + 7}`}
              fill="var(--pv24-accent)"
              initial={skip ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={skip ? undefined : { duration: 0.1, delay: delay + 0.18 }}
            />
          </g>
        );
      })}
    </svg>
  );
}

function StageColumn({ info, index, cx, skip }: { info: StageInfo; index: number; cx: number; skip: boolean }) {
  const isGate = info.kind === "human-gate";
  const delay = index * STAGE_GAP;

  return (
    <motion.div
      style={{ position: "absolute", left: cx - CARD_W / 2, top: HEADER_TOP, width: CARD_W }}
      initial={skip ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={skip ? undefined : { duration: 0.35, ease: "easeOut", delay }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: (CARD_W - HEADER_W) / 2,
          width: HEADER_W,
          height: HEADER_H,
          background: isGate ? HUMAN_COLOR : "var(--pv24-surface)",
          border: `2px solid ${isGate ? HUMAN_COLOR : AI_COLOR}`,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        <StageIcon id={info.id} size={28} color={isGate ? "#FFFFFF" : AI_COLOR} />
        <span style={{ fontSize: 17, fontWeight: 700, color: isGate ? "#FFFFFF" : "var(--pv24-text)", textAlign: "center", lineHeight: 1.2 }}>
          {info.label}
        </span>
        {isGate && !skip && (
          <motion.div
            aria-hidden="true"
            style={{ position: "absolute", inset: -7, border: `2px solid ${HUMAN_COLOR}`, pointerEvents: "none" }}
            animate={{ opacity: [0.15, 0.8, 0.15] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: delay + 0.5 }}
          />
        )}
      </div>

      <div
        style={{
          position: "absolute",
          top: HEADER_H + 14,
          left: 0,
          width: CARD_W,
          height: CARD_H,
          background: "var(--pv24-surface)",
          borderTop: `4px solid ${isGate ? HUMAN_COLOR : AI_COLOR}`,
          boxShadow: "0 6px 20px rgba(17, 18, 20, 0.08)",
          padding: "16px 18px",
          boxSizing: "border-box",
        }}
      >
        <StageCardContent id={info.id} />
      </div>
    </motion.div>
  );
}

function AlsoAvailableChip({ icon, label, delay, skip }: { icon: React.ReactNode; label: string; delay: number; skip: boolean }) {
  return (
    <motion.div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        background: "var(--pv24-surface)",
        border: "1px solid var(--pv24-border-strong)",
        padding: "10px 18px 10px 12px",
      }}
      initial={skip ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={skip ? undefined : { duration: 0.35, ease: "easeOut", delay }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          background: "var(--pv24-accent-lightest)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <span style={{ fontSize: 17, fontWeight: 600, color: "var(--pv24-text)" }}>{label}</span>
    </motion.div>
  );
}

export function RoleAppSwimlaneExhibit({ data, exportMode = false }: RoleAppSwimlaneExhibitProps) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode || !!prefersReduced;

  const rcsaTitle = data.lanes[0]?.title ?? "RCSA Cycle Assistant";
  const tprmTitle = data.lanes[1]?.title ?? "Third-Party Onboarding";
  const libraryDelay = STAGE_INFO.length * STAGE_GAP + 0.2;

  return (
    <div
      aria-label="TPRM Role App process walkthrough"
      style={{
        position: "absolute",
        inset: 0,
        background: "var(--pv24-canvas)",
        fontFamily: "var(--pv24-font-family)",
        overflow: "hidden",
      }}
    >
      <motion.div
        style={{ position: "absolute", top: 4, left: 36, display: "flex", alignItems: "center", gap: 14 }}
        initial={skip ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={skip ? undefined : { duration: 0.4 }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            background: "var(--pv24-accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <IconShieldCheck size={28} color="#FFFFFF" />
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--pv24-text)", lineHeight: 1.2 }}>
            Role App: {tprmTitle}
          </div>
          <div style={{ fontSize: 15, color: "var(--pv24-text-secondary)" }}>
            One complete TPRM process, from scoping to monitoring
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginLeft: 40 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, color: "var(--pv24-text)" }}>
            <span style={{ width: 14, height: 14, border: `2px solid ${AI_COLOR}`, background: "var(--pv24-surface)" }} />
            AI prepares
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, color: "var(--pv24-text)" }}>
            <span style={{ width: 14, height: 14, background: HUMAN_COLOR }} />
            Human decides
          </span>
        </div>
      </motion.div>

      <ArrowLayer skip={skip} />

      {STAGE_INFO.map((info, i) => (
        <StageColumn key={info.id} info={info} index={i} cx={STAGE_CX[i] ?? 0} skip={skip} />
      ))}

      <motion.div
        style={{
          position: "absolute",
          top: CHIP_SECTION_TOP + 66,
          left: 36,
          right: 36,
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
        initial={skip ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={skip ? undefined : { duration: 0.3, delay: libraryDelay }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "var(--pv24-text-secondary)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginRight: 8,
          }}
        >
          Same pattern, other Role Apps
        </span>
        <AlsoAvailableChip icon={<IconActivity size={20} color={AI_COLOR} />} label={rcsaTitle} delay={libraryDelay + 0.1} skip={skip} />
        <AlsoAvailableChip icon={<IconPackage size={20} color={AI_COLOR} />} label="OpRisk Monitor" delay={libraryDelay + 0.2} skip={skip} />
        <AlsoAvailableChip icon={<IconBell size={20} color={AI_COLOR} />} label="Incident Tracker" delay={libraryDelay + 0.3} skip={skip} />
        <AlsoAvailableChip icon={<IconShieldCheck size={20} color={AI_COLOR} />} label="Control Assurance App" delay={libraryDelay + 0.4} skip={skip} />
      </motion.div>

      <div
        style={{
          position: "absolute",
          top: 738,
          right: 36,
          fontSize: 13,
          fontStyle: "italic",
          color: "var(--pv24-text-secondary)",
        }}
      >
        Illustrative process walkthrough. Synthetic institution and data.
      </div>
    </div>
  );
}
