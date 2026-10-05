// Single source of truth for V2.4 product-proof captures. It drives the capture
// script, file names, the ProductCapture renderer, the verify script and docs.

import type {
  PresentationAssetDefinition,
  PresentationAssetIdV24,
  SubRegionLocatorV24,
} from "./types";

export type {
  CaptureStepV24,
  CapturedAssetV24,
  PresentationAssetDefinition,
  PresentationAssetIdV24,
  PresentationManifestV24,
  SubRegionBoxV24,
  SubRegionLocatorV24,
} from "./types";

export const ASSET_VERSION_V24 = "v2.4-final";
export const ASSET_DIR_V24 = `public/presentation-assets/${ASSET_VERSION_V24}`;
export const ASSET_PUBLIC_BASE_V24 = `/presentation-assets/${ASSET_VERSION_V24}`;
export const CAPTURE_VIEWPORT_V24 = { width: 1920, height: 1080 } as const;
export const CAPTURE_DEVICE_SCALE_FACTOR_V24 = 2;
export const CAPTURE_THEME_V24 = "light";
export const CAPTURE_UI_VERSION_V24 = "v3.3";

/** Text that must never appear inside a captured region. */
export const COMMON_FORBIDDEN_TEXT_V24: readonly string[] = [
  "Play the day",
  "Day controls",
  "Display and demo",
  "Reset the day",
  "Developer tools",
  "Build Error",
  "Runtime Error",
  "This workspace could not load",
  "The scenario has not been seeded",
  "Sign in",
  "Log in",
  "Zijlstra",
  "accenture.com",
  "undefined",
  "[object Object]",
  "NaN",
  "Lorem ipsum", // copy-check-ignore: listed so a capture containing it fails
  " -- ", // copy-check-ignore: listed so a capture containing it fails
  "now ago",
];

/** Text that must never appear anywhere on a captured page. */
export const PAGE_FORBIDDEN_TEXT_V24: readonly string[] = [
  "Play the day",
  "This workspace could not load",
  "The scenario has not been seeded",
  "Unhandled Runtime Error",
];

/** Click targets the capture refuses, because they write to the database. */
export const WRITE_ACTION_NAMES_V24: readonly RegExp[] = [
  /confirm and execute/i,
  /^submit/i,
  /^approve/i,
  /^send$/i,
  /record the decision/i,
  /dismiss/i,
  /snooze/i,
];

const forbid = (...extra: string[]): string[] => [...COMMON_FORBIDDEN_TEXT_V24, ...extra];

const ROLE_HOME_SUBREGIONS: Record<string, SubRegionLocatorV24> = {
  now: { selector: 'section[aria-label="Needs you now"]', describe: "Needs you now card" },
  "ai-partner": {
    selector: 'section[aria-label="AI prepared"]',
    describe: "AI prepared line from the AI Partner",
  },
  next: { selector: 'section[aria-label="Next"]', describe: "Next queue, up to three rows" },
  "meetings-actions": {
    selector: "section.wd-section",
    hasText: "Your day",
    describe: "Your day strip: next meeting, open actions, inbox",
  },
  watching: {
    selector: "button.wd-disclosure",
    hasText: "Watching",
    describe: "Watching disclosure, collapsed",
  },
  done: {
    selector: "button.wd-disclosure",
    hasText: "Handled automatically",
    describe: "Done area: Handled automatically disclosure, collapsed",
  },
};

const WORK_HUB_COMMON: Record<string, SubRegionLocatorV24> = {
  tabs: { selector: 'nav[aria-label="Work views"]', describe: "Work Hub view tabs" },
  "synthetic-label": {
    selector: ":scope > span",
    hasText: "Synthetic institution and data",
    describe: "Synthetic data label",
  },
};

const OPEN_DOCK_STEP = {
  action: "click",
  role: "button",
  name: "AI Partner, ",
  match: "prefix",
  within: "page",
  expect: '[data-presentation-region="ai-partner-dock"]',
  describe: "Open the AI Partner dock from the header button whose name starts with AI Partner",
} as const;

export const ASSET_REGISTRY_V24: readonly PresentationAssetDefinition[] = [
  {
    id: "or-home",
    route: "/workday/rcsa?ui=v3.3",
    region: "role-home",
    file: "or-home.png",
    frameLabel: "workday / rcsa / home",
    expectedText: [
      "Today",
      "Needs you now",
      "Three indicator explanations or one causal investigation",
      "Record the decision",
      "AI prepared",
      "Next",
      "Your day",
      "Next meeting",
      "Open actions",
      "Handled automatically",
    ],
    forbiddenText: forbid(),
    requiredForCore: true,
    requiredForAppendix: true,
    altText:
      "Operational Risk Partner home: the one item that needs a judgment now, an AI prepared line, the next three items, the day strip with meeting, actions and inbox, and collapsed Watching and Handled automatically lists",
    requiresWorkdayShell: true,
    subRegions: ROLE_HOME_SUBREGIONS,
  },
  {
    id: "tprm-home",
    route: "/workday/tprm?ui=v3.3",
    region: "role-home",
    file: "tprm-home.png",
    frameLabel: "workday / tprm / home",
    expectedText: [
      "Today",
      "Needs you now",
      "RepairDesk recovery time gap",
      "AI prepared",
      "Next",
      "Your day",
      "Handled automatically",
    ],
    forbiddenText: forbid(),
    requiredForCore: true,
    requiredForAppendix: true,
    altText:
      "Third-Party Risk Manager home: the supplier recovery time gap that needs a judgment now, an AI prepared line, the next items, the day strip and collapsed Watching and Handled automatically lists",
    requiresWorkdayShell: true,
    subRegions: ROLE_HOME_SUBREGIONS,
  },
  {
    id: "rcsa-process-stage",
    route: "/workday/rcsa/processes/rcsa-cycle?stage=evidence-refresh&ui=v3.3",
    region: "rcsa-stage-workspace",
    file: "rcsa-process-stage.png",
    frameLabel: "workday / rcsa / processes / rcsa-cycle / evidence-refresh",
    expectedText: [
      "Evidence Refresh",
      "Waiting for input",
      "AI prepared",
      "Retrieved 4 of 6 required evidence sources",
      "Your task",
      "Artifacts",
      "Evidence pack",
      "Submit evidence decision",
    ],
    forbiddenText: forbid(),
    requiredForCore: true,
    requiredForAppendix: true,
    altText:
      "RCSA Cycle Assistant, stage 2 Evidence Refresh: the AI prepared evidence summary with two gaps, the human task to decide evidence sufficiency, the evidence pack artifact and the decision note form",
    requiresWorkdayShell: true,
    framePadding: 24,
    subRegions: {
      heading: { selector: ":scope > div:first-child", describe: "Stage name and status" },
      "ai-prepared": {
        selector: ":scope > div",
        hasText: "AI prepared",
        describe: "AI prepared evidence summary",
      },
      "your-task": { selector: ":scope > div", hasText: "Your task", describe: "Human task" },
      artifacts: { selector: ":scope > div", hasText: "Artifacts", describe: "Stage artifacts" },
      "action-form": { selector: "form", describe: "Decision note and submit form" },
      "recent-events": { selector: ":scope > details", describe: "Recent events, collapsed" },
    },
  },
  {
    id: "tprm-onboarding-stage",
    route: "/workday/tprm/processes/third-party-onboarding?stage=evidence-review&ui=v3.3",
    region: "tprm-stage-workspace",
    file: "tprm-onboarding-stage.png",
    frameLabel: "workday / tprm / processes / third-party-onboarding / evidence-review",
    expectedText: [
      "Evidence Review",
      "In Progress",
      "AI prepared",
      "4 of 7 evidence items received and assessed",
      "Your responsibility",
      "Evidence status",
      "Submit evidence sufficiency decision",
    ],
    forbiddenText: forbid(),
    requiredForCore: true,
    requiredForAppendix: true,
    altText:
      "Third-Party Onboarding, stage 4 Evidence Review for Veridian Document Systems: AI prepared assessment, the stage gate responsibility, the evidence status list and the evidence sufficiency decision form",
    requiresWorkdayShell: true,
    framePadding: 24,
    subRegions: {
      heading: { selector: ":scope > div:first-child", describe: "Stage name and status" },
      "ai-prepared": {
        selector: ":scope > div",
        hasText: "AI prepared",
        describe: "AI prepared evidence assessment",
      },
      responsibility: {
        selector: ":scope > div",
        hasText: "Your responsibility",
        describe: "Human responsibility at the stage gate",
      },
      "evidence-status": {
        selector: '[data-presentation-region="tprm-evidence-status"]',
        describe: "Evidence status list",
      },
      "decision-form": {
        selector: 'section[aria-label="Submit evidence sufficiency decision"]',
        describe: "Evidence sufficiency decision form",
      },
    },
  },
  {
    id: "evidence-review",
    route: "/workday/tprm/processes/third-party-onboarding?stage=evidence-review&ui=v3.3",
    region: "tprm-evidence-status",
    file: "evidence-review.png",
    frameLabel: "workday / tprm / processes / third-party-onboarding / evidence status",
    expectedText: [
      "Evidence status",
      "4 accepted, 2 missing",
      "Accepted with condition",
      "Missing",
      "Pending (draft)",
      "EVD-OB-0099-05",
    ],
    forbiddenText: forbid(),
    requiredForCore: true,
    requiredForAppendix: true,
    altText:
      "Evidence status for the Veridian onboarding: eight evidence items with Accepted, Accepted with condition, Missing and Pending statuses",
    requiresWorkdayShell: true,
    framePadding: 24,
    subRegions: {
      summary: { selector: ":scope > p", describe: "Accepted and missing counts" },
      list: { selector: "ul", describe: "Evidence item list" },
      "condition-item": {
        selector: "li",
        hasText: "Accepted with condition",
        describe: "Item accepted with a condition",
      },
      "missing-penetration-test": {
        selector: "li",
        hasText: "Penetration Test Report",
        describe: "Missing penetration test report",
      },
      "missing-bcm-plan": {
        selector: "li",
        hasText: "Business Continuity Plan",
        describe: "Missing business continuity plan",
      },
    },
  },
  {
    id: "decision-approval",
    route: "/workday/rcsa/decisions?ui=v3.3",
    region: "decision-queue",
    file: "decision-approval.png",
    frameLabel: "workday / rcsa / decisions",
    expectedText: [
      "Decisions",
      "Understand",
      "Compare",
      "Explain",
      "Confirm",
      "Approval required",
      "Approved by",
      "Marlene Aigner",
      "Autonomy level",
      "Your choice",
      "One causal investigation covering all three indicators",
      "I confirm this rationale is mine",
      "Confirm and execute",
    ],
    forbiddenText: forbid(),
    requiredForCore: true,
    requiredForAppendix: true,
    altText:
      "Decision queue with the active decision at the Confirm step: approval required, the named approver, the autonomy level, the chosen option, the rationale confirmation and the Confirm and execute action, not yet clicked",
    requiresWorkdayShell: true,
    setup: [
      {
        action: "click",
        role: "button",
        name: "Next",
        match: "exact",
        within: "region",
        expect: '[role="radiogroup"]',
        describe: "Click Next to move from Understand to Compare",
      },
      {
        action: "click",
        role: "radio",
        name: "One causal investigation covering all three indicators",
        match: "prefix",
        within: "region",
        expect: '.wd-dq-option[aria-checked="true"]',
        describe: "Select the recommended option, One causal investigation covering all three indicators",
      },
      {
        action: "click",
        role: "button",
        name: "Next",
        match: "exact",
        within: "region",
        expect: ".wd-dq-textarea",
        describe: "Click Next to move to Explain",
      },
      {
        action: "fill",
        selector: ".wd-dq-textarea",
        value:
          "One causal investigation, because the three Red indicators share one upstream cause in payment operations.",
        within: "region",
        describe: "Type a rationale in the reasoning field (client state only)",
      },
      {
        action: "click",
        role: "button",
        name: "Next",
        match: "exact",
        within: "region",
        expect: ".wd-dq-authority",
        describe: "Click Next to reach Confirm; Confirm and execute is never clicked",
      },
    ],
    subRegions: {
      queue: { selector: ".wd-queue", describe: "Open decisions queue" },
      "active-decision": { selector: ".wd-dq-active", describe: "Expanded active decision" },
      steps: { selector: ".wd-dq-steps", describe: "Understand, Compare, Explain, Confirm steps" },
      authority: { selector: ".wd-dq-authority", describe: "Authority, approver and autonomy" },
      approver: {
        selector: ".wd-dq-authority > div",
        hasText: "Approved by",
        describe: "Named approver",
      },
      choice: {
        selector: ".wd-dq-stage .wd-stack-1",
        hasText: "Your choice",
        describe: "Chosen option and what would change",
      },
      confirm: { selector: ".wd-dq-confirm", describe: "Rationale confirmation checkbox" },
      "confirm-action": {
        selector: ".wd-dq-stage button.wd-btn-primary",
        describe: "Confirm and execute button, disabled until confirmed",
      },
    },
  },
  {
    id: "execution-receipt",
    route: "/workday/rcsa?ui=v3.3",
    region: "ai-partner-dock",
    file: "execution-receipt.png",
    frameLabel: "workday / rcsa / AI Partner / activity",
    expectedText: ["Activity"],
    forbiddenText: forbid(),
    requiredForCore: false,
    requiredForAppendix: false,
    altText: "AI Partner Activity tab with the execution receipt",
    requiresWorkdayShell: true,
    blockedReason:
      "The approved seeded day has no executed decisions: execution_receipt_lines is empty and the AI Partner Activity tab renders no AIExecutionReceipt for rcsa or tprm. A receipt only exists after Confirm and execute, which writes to the database and is outside a read-only capture.",
  },
  {
    id: "meeting-preparation",
    route: "/workday/rcsa/work?view=meetings&ui=v3.3",
    region: "rcsa-work-hub",
    file: "meeting-preparation.png",
    frameLabel: "workday / rcsa / work / meetings",
    expectedText: ["Work", "Meetings", "Upcoming", "RCSA challenge workshop", "Ready", "Minutes archive"],
    forbiddenText: forbid(),
    requiredForCore: false,
    requiredForAppendix: true,
    altText:
      "Work Hub Meetings view: three upcoming meetings, each with preparation status Ready, and the minutes archive",
    requiresWorkdayShell: true,
    subRegions: {
      ...WORK_HUB_COMMON,
      upcoming: { selector: 'section[aria-label="Upcoming"]', describe: "Upcoming meetings" },
      workshop: {
        selector: 'section[aria-label="Upcoming"] > div > div',
        hasText: "RCSA challenge workshop",
        describe: "RCSA challenge workshop row",
      },
      "minutes-archive": {
        selector: 'section[aria-label="Minutes archive"]',
        describe: "Minutes archive, empty in the seeded day",
      },
    },
  },
  {
    id: "meeting-minutes",
    route: "/workday/rcsa/work?view=meetings&ui=v3.3",
    region: "rcsa-work-hub",
    file: "meeting-minutes.png",
    frameLabel: "workday / rcsa / work / meetings / minutes",
    expectedText: ["Minutes archive"],
    forbiddenText: forbid(),
    requiredForCore: false,
    requiredForAppendix: false,
    altText: "Minutes archive",
    requiresWorkdayShell: true,
    blockedReason:
      "The Minutes archive is empty in the approved seeded day (it reads No minutes in the archive), so there are no minutes to show. The meetings view itself is captured as meeting-preparation.",
  },
  {
    id: "actions",
    route: "/workday/rcsa/work?view=actions&filter=needs-me&ui=v3.3",
    region: "rcsa-work-hub",
    file: "actions.png",
    frameLabel: "workday / rcsa / work / actions / needs me",
    expectedText: ["Actions", "Needs me", "Waiting on others", "Overdue", "Completed", "Due", "In progress"],
    forbiddenText: forbid(),
    requiredForCore: false,
    requiredForAppendix: true,
    altText:
      "Work Hub Actions view filtered to Needs me: five open actions with type, due date and status",
    requiresWorkdayShell: true,
    subRegions: {
      ...WORK_HUB_COMMON,
      filters: { selector: 'section[aria-label="Actions"] > div:first-child', describe: "Action filters" },
      list: { selector: 'section[aria-label="Actions"] > div:nth-child(2)', describe: "Action list" },
      "first-action": {
        selector: 'section[aria-label="Actions"] > div:nth-child(2) > div:first-child',
        describe: "First action row",
      },
    },
  },
  {
    id: "inbox-conversion",
    route: "/workday/rcsa/work?view=inbox&ui=v3.3",
    region: "rcsa-work-hub",
    file: "inbox-conversion.png",
    frameLabel: "workday / rcsa / work / inbox",
    expectedText: ["Inbox", "AI: Decision", "AI: Information", "Review", "KRI-PAY-007"],
    forbiddenText: forbid(),
    requiredForCore: false,
    requiredForAppendix: true,
    altText:
      "Work Hub Inbox: alerts and mail with an AI triage proposal on each item, Decision or Information, and a Review link",
    requiresWorkdayShell: true,
    subRegions: {
      ...WORK_HUB_COMMON,
      list: { selector: 'section[aria-label="Inbox"] > div', describe: "Inbox list" },
      "first-item": {
        selector: 'section[aria-label="Inbox"] > div > div:first-child',
        describe: "First inbox item with AI triage",
      },
    },
  },
  {
    id: "ai-partner",
    route: "/workday/rcsa?ui=v3.3",
    region: "ai-partner-dock",
    file: "ai-partner.png",
    frameLabel: "workday / rcsa / AI Partner",
    expectedText: [
      "AI Partner",
      "Monitoring",
      "Suggestions",
      "Activity",
      "Chat",
      "Needs you",
      "What changed",
      "Why it matters",
    ],
    forbiddenText: forbid("Opening the partner", "The partner is not available"),
    requiredForCore: false,
    requiredForAppendix: true,
    altText:
      "AI Partner dock on the Operational Risk Partner home, Suggestions tab: a prepared answer that needs the user, with what changed and why it matters",
    requiresWorkdayShell: true,
    setup: [
      OPEN_DOCK_STEP,
      {
        action: "click",
        role: "tab",
        name: "Suggestions",
        match: "prefix",
        within: "region",
        expect: "article.app-suggestion",
        describe: "Select the Suggestions tab",
      },
      {
        action: "scroll",
        selector: ".app-partner-body",
        to: "top",
        within: "region",
        describe: "Scroll the dock body to the top",
      },
    ],
    subRegions: {
      header: { selector: ".wd-panel-head", describe: "Dock title" },
      status: { selector: ".app-partner-head", describe: "Partner state, Monitoring" },
      tabs: { selector: '[role="tablist"]', describe: "Suggestions, Activity, Chat tabs" },
      suggestion: { selector: "article.app-suggestion", describe: "Prepared suggestion card" },
    },
  },
  {
    id: "role-app-library",
    route: "/workday/rcsa/processes?ui=v3.3",
    region: "role-app-library",
    file: "role-app-library.png",
    frameLabel: "workday / rcsa / processes",
    expectedText: ["Processes", "Active processes", "AI Routines", "RCSA Cycle Assistant", "Evidence Refresh"],
    forbiddenText: forbid(),
    requiredForCore: false,
    requiredForAppendix: true,
    altText:
      "Processes for the Operational Risk Partner: the RCSA Cycle Assistant role app in progress at stage 2, Evidence Refresh, waiting for input",
    requiresWorkdayShell: true,
    subRegions: {
      tabs: { selector: ":scope > div:first-of-type", describe: "Active processes and AI Routines tabs" },
      processes: { selector: "section.wd-section", describe: "Active role app processes" },
      "synthetic-label": {
        selector: ":scope > span",
        hasText: "Synthetic institution and data",
        describe: "Synthetic data label",
      },
    },
  },
  {
    id: "operations-status",
    route: "/ops",
    region: "ops-dashboard",
    file: "operations-status.png",
    frameLabel: "ops",
    expectedText: ["Operations Console"],
    forbiddenText: forbid(),
    requiredForCore: false,
    requiredForAppendix: false,
    altText: "Operations console",
    requiresWorkdayShell: false,
    blockedReason:
      "The /ops console renders outside the V3.3 shell in dark V2 styling, and at 1920x1080 its System health, Job queue and Failed jobs sections draw over each other, so it is not a truthful current light UI screen.",
  },
];

export function getAssetV24(id: PresentationAssetIdV24): PresentationAssetDefinition {
  const asset = ASSET_REGISTRY_V24.find((candidate) => candidate.id === id);
  if (!asset) throw new Error(`Unknown V2.4 presentation asset: ${id}`);
  return asset;
}

export function isAssetIdV24(value: string): value is PresentationAssetIdV24 {
  return ASSET_REGISTRY_V24.some((asset) => asset.id === value);
}

export function assetSrcV24(id: PresentationAssetIdV24): string {
  return `${ASSET_PUBLIC_BASE_V24}/${getAssetV24(id).file}`;
}

/** CSS selector for a registry region: a region name or a raw selector. */
export function regionSelectorV24(region: string): string {
  return /^[a-z0-9-]+$/.test(region) ? `[data-presentation-region="${region}"]` : region;
}

export const CAPTURABLE_ASSETS_V24 = ASSET_REGISTRY_V24.filter((asset) => !asset.blockedReason);
export const BLOCKED_ASSETS_V24 = ASSET_REGISTRY_V24.filter((asset) => Boolean(asset.blockedReason));

export const CORE_ASSET_IDS: readonly PresentationAssetIdV24[] = ASSET_REGISTRY_V24.filter(
  (asset) => asset.requiredForCore,
).map((asset) => asset.id);

export const APPENDIX_ASSET_IDS: readonly PresentationAssetIdV24[] = ASSET_REGISTRY_V24.filter(
  (asset) => asset.requiredForAppendix,
).map((asset) => asset.id);
