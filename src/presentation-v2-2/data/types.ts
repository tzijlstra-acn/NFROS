/**
 * Typed data structures for NFROS Presentation V2.2.
 *
 * No string parsing. Every structured concept is a typed field.
 * Do not use `--` (double hyphen) or em dash in any string value.
 */

export type AppendixReference = {
  appendixId: string;
  label: string;
  reason: string;
};

export type AgendaItem = {
  text: string;
  section: string;
};

export type RoleColumn = {
  role: string;
  dailyFocus: string;
  installedApp: string;
  humanJudgment: string;
  screenshotAsset: string;
};

export type ProcessRow = {
  label: string;
  stages: string[]; // NOT a bullet string to be parsed
  currentStageIndex: number;
  screenshotAsset: string;
};

export type Outcome = {
  title: string;
  support: string;
  semanticType: "capacity" | "quality" | "continuity" | "control";
};

export type ServiceLayer = {
  name: string;
  detail: string;
  cadence: string;
  semanticType: "platform" | "function" | "role-app" | "managed-service";
};

export type RolloutStep = {
  number: number;
  title: string;
  actions: string[];
  exitProof: string;
};

export type CoreSlide22 = {
  id: string;
  section: string;
  title: string;
  subtitle?: string;
  layout:
    | "hero"
    | "list"
    | "split"
    | "three-layer"
    | "two-column"
    | "flow"
    | "outcome-grid"
    | "service-stack"
    | "process-rows"
    | "rollout-steps"
    | "next-step";
  speakerNotes: string;
  presentingTimeSeconds: number;
  footer?: string;
  appendixRefs: AppendixReference[]; // every slide except cover and agenda has refs
  // Typed content (replaces generic bullets/emphasis arrays where structured):
  heroLines?: string[]; // slide 1
  agendaItems?: AgendaItem[]; // slide 2
  emphasis?: string[]; // slides 3, 8, 13, etc.
  roleColumns?: RoleColumn[]; // slide 6
  processRows?: ProcessRow[]; // slide 7
  outcomes?: Outcome[]; // slide 9
  serviceLayers?: ServiceLayer[]; // slide 11
  rolloutSteps?: RolloutStep[]; // slide 12
  nextStepBullets?: string[]; // slide 13
  nextStepOutcome?: string; // slide 13
  // Fallback for slides that do not need structured content:
  bullets?: string[];
};
