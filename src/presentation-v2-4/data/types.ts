/**
 * Typed data structures for NFROS Presentation V2.4.
 *
 * Breaking changes from V2.3:
 *   - `subtitle` is mandatory on every core and appendix slide (not optional).
 *   - Each slide carries a typed `exhibit` field (discriminated union).
 *   - Each slide declares `evidenceBasis[]` for every exhibit.
 *   - `CoreSlide24` has no backward compatibility with V2.2 layout field.
 *
 * No double-hyphen (`--`) or em dash in any string value.
 * Every title and subtitle must be present; the TypeScript compiler enforces this.
 */

// ---------------------------------------------------------------------------
// Shared supporting types
// ---------------------------------------------------------------------------

export type AppendixReference = {
  appendixId: string;
  label: string;
  reason: string;
};

export type EvidenceBasis = {
  type:
    | "product"        // captured from live or synth-data product state
    | "simulation"     // derived from simulation run (must cite metric definition)
    | "repository"     // derived from codebase or data store directly
    | "external-source" // cited external publication or standard
    | "illustrative"   // qualitative/directional, not measured
    | "proposal";      // Accenture service proposal content
  label: string;
  sourceId?: string;   // internal reference to evidence registry
};

// ---------------------------------------------------------------------------
// Exhibit data types (one per slide visual type)
// ---------------------------------------------------------------------------

export type CapacityConvergenceData = {
  sources: string[];           // 6 signal labels
  bottleneckLabel: string;     // e.g. "Work queue"
  osStageName: string;         // e.g. "NFR Operating System"
  decisionLabel: string;       // e.g. "One prepared decision"
  judgmentLabel: string;       // e.g. "Human judgment"
};

export type StoryPathChapter = {
  number: number;
  audienceQuestion: string;
  sectionLabel: string;
};

export type StoryPathData = {
  chapters: StoryPathChapter[];
  activeChapterNumber: number;
};

export type FragmentationSankeyData = {
  sources: string[];
  activities: string[];
  outcomeLabel: string;
  evidenceNote: string;        // e.g. "Illustrative workflow"
};

export type FrictionCausalChainData = {
  chainNodes: string[];        // left-to-right causal nodes
  frictionBands: string[];     // four friction labels below the chain
  implications: string[];      // right-side implication labels
  feedbackLabel: string;       // label on the feedback loop arc
};

export type EngagementLayerData = {
  topLayer: string;
  workItems: string[];
  controlItems: string[];
  systemsOfRecord: string[];
  activeItemPath: string[];    // one item's journey through the layers
};

export type WorkdayFocusAnnotation = {
  label: string;
  meaning: string;
};

export type WorkdayDaylineEvent = {
  time: string;
  label: string;
};

export type WorkdayProductData = {
  assetId: string;
  focusAnnotations: WorkdayFocusAnnotation[];
  daylineEvents: WorkdayDaylineEvent[];
};

export type RoleArchNode = {
  label: string;
};

export type RoleArchData = {
  sharedCore: string[];
  leftRole: { title: string; subtitle: string; judgments: string[]; assetId: string };
  rightRole: { title: string; subtitle: string; judgments: string[]; assetId: string };
};

export type SwimlaneStage = {
  label: string;
  isCurrentStage?: boolean;
  isHumanGate?: boolean;
};

export type SwimlaneData = {
  lanes: Array<{
    title: string;
    stages: SwimlaneStage[];
    assetId?: string;
  }>;
};

export type AuthorityZone = {
  label: string;
  examples: string[];
  xRange: [number, number];  // 0-1 repeatability axis
  yRange: [number, number];  // 0-1 judgment axis
};

export type AuthorityMatrixData = {
  xLabel: string;
  yLabel: string;
  zones: AuthorityZone[];
  matrixNote: string;         // e.g. "Authority model"
};

export type ValueBranch = {
  label: string;
  items: string[];
  metricExample: string;
};

export type ValueTreeData = {
  centreLabel: string;
  branches: ValueBranch[];
  measurementRail: string[];  // e.g. ["Baseline", "Pilot", "Scale decision"]
  chartNote?: string;         // shown when chart is omitted
};

export type EvidenceThreadStep = {
  label: string;
  hasProductProof?: boolean;
  assetId?: string;
};

export type EvidenceThreadData = {
  steps: EvidenceThreadStep[];
  proofAnnotations: Array<{ stepIndex: number; label: string }>;
};

export type ServiceArchLayer = {
  label: string;
  sublabel?: string;
  level: "platform" | "functions" | "apps" | "managed";
};

export type AppFactoryStage = {
  label: string;
  isActive?: boolean;
};

export type ServiceFactoryData = {
  architectureLayers: ServiceArchLayer[];
  appFactoryStages: AppFactoryStage[];
  newAppLabel: string;        // the app in flight through the factory
};

export type DesignPartnerStep = {
  number: number;
  title: string;
  inputs: string[];
  gateQuestion: string;
};

export type DesignPartnerPathData = {
  steps: DesignPartnerStep[];
  callToAction: string;
};

// ---------------------------------------------------------------------------
// CoreExhibit discriminated union
// ---------------------------------------------------------------------------

export type CoreExhibit =
  | { type: "capacity-convergence"; data: CapacityConvergenceData }
  | { type: "story-path"; data: StoryPathData }
  | { type: "fragmentation-sankey"; data: FragmentationSankeyData }
  | { type: "friction-causal-chain"; data: FrictionCausalChainData }
  | { type: "engagement-layer"; data: EngagementLayerData }
  | { type: "workday-product"; data: WorkdayProductData }
  | { type: "role-architecture"; data: RoleArchData }
  | { type: "role-app-swimlane"; data: SwimlaneData }
  | { type: "authority-matrix"; data: AuthorityMatrixData }
  | { type: "value-tree"; data: ValueTreeData }
  | { type: "evidence-thread"; data: EvidenceThreadData }
  | { type: "service-factory"; data: ServiceFactoryData }
  | { type: "design-partner-path"; data: DesignPartnerPathData };

// ---------------------------------------------------------------------------
// Core slide contract — subtitle is mandatory
// ---------------------------------------------------------------------------

export type CoreSlide24 = {
  id: string;
  section: string;
  title: string;
  subtitle: string;            // mandatory; TypeScript error when missing
  exhibit: CoreExhibit;
  evidenceBasis: EvidenceBasis[];
  appendixRefs: AppendixReference[];
  speakerNotes: string;
  presentingTimeSeconds?: number;
  footer?: string;
};

// ---------------------------------------------------------------------------
// Appendix visual types
// ---------------------------------------------------------------------------

export type AppendixTableRow = Record<string, string>;

export type AppendixVisual =
  | { type: "architecture-layers"; layers: Array<{ name: string; items: string[] }> }
  | { type: "process-matrix"; stages: string[]; tracks: string[]; cells: Record<string, string> }
  | { type: "authority-matrix"; rows: AppendixTableRow[]; columns: string[] }
  | { type: "capability-map"; groups: Array<{ name: string; items: Array<{ label: string; status: string }> }> }
  | { type: "integration-flow"; inbound: string[]; outbound: string[]; controlPoints: string[] }
  | { type: "service-stack"; tiers: Array<{ name: string; detail: string; cadence: string; semanticType: string }> }
  | { type: "status-table"; columns: string[]; rows: AppendixTableRow[] }
  | { type: "limitations-landscape"; areas: Array<{ label: string; detail: string; category: "current" | "roadmap" | "out-of-scope" }> }
  | { type: "measurement-framework"; dimensions: Array<{ name: string; metric: string; baseline: string }> }
  | { type: "text-columns"; columns: Array<{ heading: string; items: string[] }> };

// ---------------------------------------------------------------------------
// Appendix slide contract — subtitle is mandatory
// ---------------------------------------------------------------------------

export type AppendixSlide24 = {
  id: string;
  section: string;
  title: string;
  subtitle: string;            // mandatory
  visual: AppendixVisual;
  evidenceBasis: EvidenceBasis[];
  speakerNotes: string;
};
