export type PresentationAssetIdV24 =
  | "or-home"
  | "tprm-home"
  | "rcsa-process-stage"
  | "tprm-onboarding-stage"
  | "evidence-review"
  | "decision-approval"
  | "execution-receipt"
  | "meeting-preparation"
  | "meeting-minutes"
  | "actions"
  | "inbox-conversion"
  | "ai-partner"
  | "role-app-library"
  | "operations-status";

export type CaptureScopeV24 = "page" | "region";

export type CaptureStepV24 =
  | {
      action: "click";
      role: "button" | "tab" | "radio" | "link";
      name: string;
      match: "exact" | "prefix";
      within: CaptureScopeV24;
      /** Selector that must become visible after the click (proves hydration). */
      expect?: string;
      describe: string;
    }
  | {
      action: "fill";
      selector: string;
      value: string;
      within: CaptureScopeV24;
      describe: string;
    }
  | {
      action: "scroll";
      selector: string;
      to: "top" | "bottom";
      within: CaptureScopeV24;
      describe: string;
    };

/** Locates a sub-region inside the captured region. */
export type SubRegionLocatorV24 = {
  selector: string;
  hasText?: string;
  describe: string;
};

export type PresentationAssetDefinition = {
  id: PresentationAssetIdV24;
  /** Product route, including `ui=v3.3` for workday routes. */
  route: string;
  /** A `data-presentation-region` name, or a CSS selector. */
  region: string;
  /** File name inside `public/presentation-assets/v2.4-final/`. */
  file: string;
  /** Route-like label for the product frame title bar. */
  frameLabel: string;
  expectedText: string[];
  forbiddenText: string[];
  requiredForCore: boolean;
  requiredForAppendix: boolean;
  altText: string;
  /** True when the route must render inside the V3.3 workday shell. */
  requiresWorkdayShell: boolean;
  setup?: CaptureStepV24[];
  subRegions?: Record<string, SubRegionLocatorV24>;
  /** CSS px of canvas-coloured space ProductCapture adds around a region that has no padding of its own. */
  framePadding?: number;
  /** Set when the approved seeded day cannot show this screen truthfully. */
  blockedReason?: string;
};

export type SubRegionBoxV24 = { x: number; y: number; width: number; height: number };

export type CapturedAssetV24 = {
  file: string;
  width: number;
  height: number;
  deviceScaleFactor: number;
  sha256: string;
  route: string;
  region: string;
  bytes: number;
  viewport: { width: number; height: number };
  /** Product canvas colour sampled from the image border, as #rrggbb. */
  background: string;
  subRegions: Record<string, SubRegionBoxV24>;
};

export type PresentationManifestV24 = {
  version: string;
  capturedAt: string;
  commit: string;
  worktreeDirty: boolean;
  baseUrl: string;
  assets: Partial<Record<PresentationAssetIdV24, CapturedAssetV24>>;
  notCaptured: Partial<Record<PresentationAssetIdV24, string>>;
};
