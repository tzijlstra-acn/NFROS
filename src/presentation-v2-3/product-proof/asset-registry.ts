// Single source of truth for all presentation asset IDs, capture targets, and filenames.
// This file drives: capture script, verify script, renderers, export checks.
// Never define asset filenames anywhere else.

export type PresentationAssetId =
  | "rcsa-home"
  | "tprm-home"
  | "ai-partner"
  | "rcsa-process-stage"
  | "tprm-process-stage"
  | "decision-approval"
  | "execution-receipt"
  | "evidence-drawer"
  | "role-app-catalogue"
  | "operations-health";

export type PresentationAssetDefinition = {
  id: PresentationAssetId;
  route: string; // product route to navigate to
  region: string; // data-presentation-region value to screenshot
  file: string; // filename in public/presentation-assets/v2.3/ -- CANONICAL NAME
  width: number;
  height: number;
  expectedText: string[]; // strings that must appear on the captured page
  forbiddenText: string[]; // strings that must NOT appear (login indicators)
  requiredForCore: boolean;
  requiredForAppendix: boolean;
  altText: string; // accessible alt text for the image
  description: string;
};

export const ASSET_REGISTRY: PresentationAssetDefinition[] = [
  {
    id: "rcsa-home",
    route: "/workday/rcsa",
    region: "role-home",
    file: "rcsa-home.png",
    width: 1920,
    height: 1080,
    expectedText: ["Now", "Next"],
    forbiddenText: ["Sign in", "Login", "Error", "Loading"],
    requiredForCore: true,
    requiredForAppendix: true,
    altText: "Operational Risk Partner home showing current work, next tasks, and completed items",
    description: "RCSA Role Home (Now/Next/Done view)",
  },
  {
    id: "tprm-home",
    route: "/workday/tprm",
    region: "role-home",
    file: "tprm-home.png",
    width: 1920,
    height: 1080,
    expectedText: ["Now", "Next"],
    forbiddenText: ["Sign in", "Login", "Error", "Loading"],
    requiredForCore: true,
    requiredForAppendix: true,
    altText: "Third-Party Risk Manager home showing supplier onboarding tasks and due items",
    description: "TPRM Role Home (Now/Next/Done view)",
  },
  {
    id: "ai-partner",
    route: "/workday/rcsa/work",
    region: "rcsa-work-hub",
    file: "ai-partner.png",
    width: 1920,
    height: 1080,
    expectedText: ["AI Partner"],
    forbiddenText: ["Sign in", "Login", "Error"],
    requiredForCore: false,
    requiredForAppendix: true,
    altText: "RCSA work hub showing AI Partner panel with prepared evidence and recommendations",
    description: "Work Hub with AI Partner visible",
  },
  {
    id: "rcsa-process-stage",
    route: "/workday/rcsa/processes/rcsa-cycle?stage=evidence-refresh",
    region: "rcsa-stage-workspace",
    file: "rcsa-process-stage.png",
    width: 1920,
    height: 1080,
    expectedText: [],
    forbiddenText: ["Sign in", "Login", "Error"],
    requiredForCore: true,
    requiredForAppendix: true,
    altText: "RCSA Cycle Assistant process workspace showing the evidence-refresh stage with AI-prepared materials",
    description: "RCSA process stage workspace",
  },
  {
    id: "tprm-process-stage",
    route: "/workday/tprm/work",
    region: "tprm-work-hub",
    file: "tprm-process-stage.png",
    width: 1920,
    height: 1080,
    expectedText: [],
    forbiddenText: ["Sign in", "Login", "Error"],
    requiredForCore: true,
    requiredForAppendix: true,
    altText: "Third-Party Onboarding process workspace showing due diligence stage with supplier documents",
    description: "TPRM process stage workspace",
  },
  {
    id: "decision-approval",
    route: "/workday/rcsa/work",
    region: "rcsa-work-hub",
    file: "decision-approval.png",
    width: 1920,
    height: 1080,
    expectedText: [],
    forbiddenText: ["Sign in", "Login", "Error"],
    requiredForCore: false,
    requiredForAppendix: true,
    altText: "Decision and approval workflow showing a risk rating awaiting human review",
    description: "Decision and approval state",
  },
  {
    id: "execution-receipt",
    route: "/workday/rcsa/work",
    region: "rcsa-work-hub",
    file: "execution-receipt.png",
    width: 1920,
    height: 1080,
    expectedText: [],
    forbiddenText: ["Sign in", "Login", "Error"],
    requiredForCore: false,
    requiredForAppendix: true,
    altText: "Execution receipt showing completed approval with audit trail and provenance",
    description: "Execution receipt with audit chain",
  },
  {
    id: "evidence-drawer",
    route: "/workday/rcsa/work",
    region: "rcsa-work-hub",
    file: "evidence-drawer.png",
    width: 1920,
    height: 1080,
    expectedText: [],
    forbiddenText: ["Sign in", "Login", "Error"],
    requiredForCore: false,
    requiredForAppendix: true,
    altText: "Evidence and provenance panel showing source documents, citations, and audit chain",
    description: "Evidence panel and provenance",
  },
  {
    id: "role-app-catalogue",
    route: "/workday/rcsa",
    region: "role-home",
    file: "role-app-catalogue.png",
    width: 1920,
    height: 1080,
    expectedText: [],
    forbiddenText: ["Sign in", "Login", "Error"],
    requiredForCore: false,
    requiredForAppendix: true,
    altText: "Role App library showing installed RCSA Cycle Assistant, available apps, and planned additions",
    description: "Role App catalogue view",
  },
  {
    id: "operations-health",
    route: "/ops",
    region: "ops-dashboard",
    file: "operations-health.png",
    width: 1920,
    height: 1080,
    expectedText: [],
    forbiddenText: ["Sign in", "Login", "Error"],
    requiredForCore: false,
    requiredForAppendix: true,
    altText: "Operations dashboard showing system health, background jobs, and audit chain status",
    description: "Operations and health dashboard",
  },
];

export const ASSET_VERSION = "v2.3";
export const ASSET_DIR = `public/presentation-assets/${ASSET_VERSION}`;

export function getAsset(id: PresentationAssetId): PresentationAssetDefinition {
  const asset = ASSET_REGISTRY.find((a) => a.id === id);
  if (!asset) throw new Error(`Unknown presentation asset ID: ${id}`);
  return asset;
}

export function getAssetPath(id: PresentationAssetId): string {
  return `/presentation-assets/${ASSET_VERSION}/${getAsset(id).file}`;
}

export const CORE_REQUIRED_ASSETS = ASSET_REGISTRY.filter((a) => a.requiredForCore);
export const APPENDIX_REQUIRED_ASSETS = ASSET_REGISTRY.filter((a) => a.requiredForAppendix);
