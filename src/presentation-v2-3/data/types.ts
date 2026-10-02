/**
 * Typed data structures for NFROS Presentation V2.3.
 *
 * Extends V2.2 types. No string parsing. Every structured concept is a typed
 * field. Do not use `--` (double hyphen) or em dash in any string value.
 */

import type { PresentationAssetId } from "../product-proof/asset-registry";

// Re-export V2.2 supporting types unchanged.
export type { AppendixReference, AgendaItem, RoleColumn, ProcessRow, Outcome, ServiceLayer, RolloutStep } from "../../presentation-v2-2/data/types";
export type { CoreSlide22 } from "../../presentation-v2-2/data/types";

// ---------------------------------------------------------------------------
// V2.3-specific extensions
// ---------------------------------------------------------------------------

export type FocusRegionDef = {
  step: number;         // 1-based, matches 1/2/3 keyboard shortcuts
  label: string;        // short label shown near focus region
  assetId: PresentationAssetId;
  region: { x: number; y: number; w: number; h: number };
};

export type MotionStep = {
  step: number;
  elements: string[];   // CSS selectors or element IDs to reveal
  delay: number;        // ms from slide enter
};

export type CoreSlide23 = {
  id: string;
  section: string;
  title: string;
  subtitle?: string;

  // V2.3 visual primitive type (replaces V2.2 layout field for new renderers)
  visualType:
    | "hero-signal"
    | "agenda-map"
    | "fragmentation-flow"
    | "operating-system-spine"
    | "role-os-focus"
    | "role-mirror"
    | "process-rail"
    | "authority-boundary"
    | "outcome-shift"
    | "evidence-thread"
    | "service-shelf"
    | "rollout-path"
    | "design-partner-canvas";

  speakerNotes: string;
  presentingTimeSeconds: number;
  footer?: string;
  appendixRefs: import("../../presentation-v2-2/data/types").AppendixReference[];

  // V2.3 real product asset IDs (replaces screenshotAsset string in V2.2)
  productAssets?: PresentationAssetId[];

  // Focus lens regions for product proof slides
  focusRegions?: FocusRegionDef[];

  // Motion sequence for this slide (defined per visual type)
  motionSequence?: MotionStep[];

  // Typed content fields (same as V2.2, forwarded for renderers)
  heroLines?: string[];
  agendaItems?: import("../../presentation-v2-2/data/types").AgendaItem[];
  emphasis?: string[];
  roleColumns?: import("../../presentation-v2-2/data/types").RoleColumn[];
  processRows?: import("../../presentation-v2-2/data/types").ProcessRow[];
  outcomes?: import("../../presentation-v2-2/data/types").Outcome[];
  serviceLayers?: import("../../presentation-v2-2/data/types").ServiceLayer[];
  rolloutSteps?: import("../../presentation-v2-2/data/types").RolloutStep[];
  nextStepBullets?: string[];
  nextStepOutcome?: string;
  bullets?: string[];
};
