"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import type { RoleArchData } from "@/presentation-v2-4/data/types";

export interface RoleArchitectureExhibitProps {
  data: RoleArchData;
  exportMode?: boolean;
}

const CANVAS_W = 1920;
const CANVAS_H = 1080;

const SPINE_X = 760;
const SPINE_Y = 200;
const SPINE_W = 400;
const SPINE_H = 680;

const LEFT_X = 80;
const LEFT_Y = 220;
const LEFT_W = 680;
const LEFT_H = 640;

const RIGHT_X = 1160;
const RIGHT_Y = 220;
const RIGHT_W = 680;
const RIGHT_H = 640;

interface BulletItemProps {
  text: string;
  skip: boolean;
  delay: number;
  fromLeft: boolean;
}

function BulletItem({ text, skip, delay, fromLeft }: BulletItemProps) {
  return (
    <motion.div
      initial={skip ? false : { opacity: 0, x: fromLeft ? -12 : 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: "easeOut", delay }}
      style={{ display: "flex", alignItems: "flex-start", gap: 10 }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: 1,
          background: "var(--pv24-accent)",
          flexShrink: 0,
          marginTop: 4,
        }}
      />
      <span
        style={{
          color: "var(--pv24-text)",
          fontSize: "var(--pv24-body-size, 14px)",
          lineHeight: 1.4,
        }}
      >
        {text}
      </span>
    </motion.div>
  );
}

interface RolePanelProps {
  title: string;
  subtitle: string;
  judgments: string[];
  assetId: string;
  left: number;
  top: number;
  width: number;
  height: number;
  originX: "right center" | "left center";
  skip: boolean;
  expandDelay: number;
  itemBaseDelay: number;
  fromLeft: boolean;
}

function RolePanel({
  title,
  subtitle,
  judgments,
  assetId,
  left,
  top,
  width,
  height,
  originX,
  skip,
  expandDelay,
  itemBaseDelay,
  fromLeft,
}: RolePanelProps) {
  return (
    <motion.div
      initial={skip ? false : { scaleX: 0 }}
      animate={{ scaleX: 1 }}
      transition={{ duration: 0.45, ease: "easeOut", delay: expandDelay }}
      style={{
        position: "absolute",
        left,
        top,
        width,
        height,
        background: "var(--pv24-brand-purple-lightest)",
        border: "1px solid var(--pv24-border)",
        borderRadius: 4,
        padding: "28px 28px 20px",
        display: "flex",
        flexDirection: "column",
        transformOrigin: originX,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          fontWeight: 700,
          fontSize: "var(--pv24-heading-size, 20px)",
          color: "var(--pv24-text)",
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: "var(--pv24-body-size, 14px)",
          color: "var(--pv24-text-secondary)",
          marginBottom: 24,
        }}
      >
        {subtitle}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
        {judgments.map((j, i) => (
          <BulletItem
            key={j}
            text={j}
            skip={skip}
            delay={itemBaseDelay + i * 0.1}
            fromLeft={fromLeft}
          />
        ))}
      </div>
      {assetId !== "" && (
        <div
          style={{
            marginTop: "auto",
            paddingTop: 16,
            borderTop: "1px solid var(--pv24-border)",
            fontFamily: "var(--pv24-font-mono)",
            fontSize: "var(--pv24-caption-size, 11px)",
            color: "var(--pv24-text-secondary)",
            background: "var(--pv24-surface)",
            borderRadius: 3,
            padding: "8px 10px",
          }}
        >
          Product capture: {assetId}
        </div>
      )}
    </motion.div>
  );
}

export function RoleArchitectureExhibit({ data, exportMode = false }: RoleArchitectureExhibitProps) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode || !!prefersReduced;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        width: CANVAS_W,
        height: CANVAS_H,
        background: "var(--pv24-canvas)",
        fontFamily: "var(--pv24-font-family)",
        overflow: "hidden",
      }}
      aria-label="Role architecture exhibit"
    >
      {/* Center spine */}
      <motion.div
        initial={skip ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        style={{
          position: "absolute",
          left: SPINE_X,
          top: SPINE_Y,
          width: SPINE_W,
          height: SPINE_H,
          background: "var(--pv24-surface)",
          borderLeft: "2px solid var(--pv24-accent)",
          borderRight: "2px solid var(--pv24-accent)",
          borderTop: "1px solid var(--pv24-border)",
          borderBottom: "1px solid var(--pv24-border)",
          borderRadius: 2,
          padding: "28px 24px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            fontSize: "var(--pv24-label-size, 12px)",
            fontWeight: 700,
            color: "var(--pv24-accent)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 18,
          }}
        >
          Shared Core
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
          {data.sharedCore.map((item) => (
            <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 1,
                  background: "var(--pv24-accent)",
                  flexShrink: 0,
                  marginTop: 4,
                }}
              />
              <span
                style={{
                  color: "var(--pv24-text)",
                  fontSize: "var(--pv24-body-size, 14px)",
                  lineHeight: 1.4,
                }}
              >
                {item}
              </span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Left role panel */}
      <RolePanel
        title={data.leftRole.title}
        subtitle={data.leftRole.subtitle}
        judgments={data.leftRole.judgments}
        assetId={data.leftRole.assetId}
        left={LEFT_X}
        top={LEFT_Y}
        width={LEFT_W}
        height={LEFT_H}
        originX="right center"
        skip={skip}
        expandDelay={skip ? 0 : 0.45}
        itemBaseDelay={skip ? 0 : 0.95}
        fromLeft
      />

      {/* Right role panel */}
      <RolePanel
        title={data.rightRole.title}
        subtitle={data.rightRole.subtitle}
        judgments={data.rightRole.judgments}
        assetId={data.rightRole.assetId}
        left={RIGHT_X}
        top={RIGHT_Y}
        width={RIGHT_W}
        height={RIGHT_H}
        originX="left center"
        skip={skip}
        expandDelay={skip ? 0 : 0.45}
        itemBaseDelay={skip ? 0 : 0.95}
        fromLeft={false}
      />
    </div>
  );
}
