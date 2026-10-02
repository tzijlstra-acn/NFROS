/**
 * Role App library data for NFROS Presentation V2.2.
 *
 * Copied from V2.1 with all `--` punctuation removed from string values.
 * Stage count updated from six to eight where referenced.
 */

export const ROLE_APP_STATUSES = [
  "Installed",
  "Available",
  "Demo",
  "Planned",
  "Disabled",
] as const;

export type RoleAppStatus = (typeof ROLE_APP_STATUSES)[number];

export interface StandardContractComponent {
  id: string;
  name: string;
  description: string;
  required: boolean;
}

export const ROLE_APP_STANDARD_CONTRACT: StandardContractComponent[] = [
  {
    id: "contract-01",
    name: "Workflow definition",
    description:
      "Named stages with defined inputs, outputs, and transition conditions. Minimum two stages; maximum ten.",
    required: true,
  },
  {
    id: "contract-02",
    name: "Role binding",
    description:
      "Explicit declaration of which role or roles can access and operate this app. Apps are role-specific, not role-agnostic.",
    required: true,
  },
  {
    id: "contract-03",
    name: "Stage output schema",
    description:
      "Structured schema for every stage output. AI-generated outputs conform to the schema; human approvals confirm or modify the draft.",
    required: true,
  },
  {
    id: "contract-04",
    name: "Evidence specification",
    description:
      "Declaration of what evidence is required at each stage, how it is captured, and how it is linked to the stage output record.",
    required: true,
  },
  {
    id: "contract-05",
    name: "AI assistance manifest",
    description:
      "Explicit declaration of where AI assistance is available within the workflow, what the AI does at each point, and what the human review step is.",
    required: true,
  },
  {
    id: "contract-06",
    name: "Approval and gating rules",
    description:
      "Definition of who can approve each stage transition and under what conditions the workflow can progress. No stage can be bypassed.",
    required: true,
  },
  {
    id: "contract-07",
    name: "Escalation configuration",
    description:
      "Threshold-based escalation rules: what triggers an escalation, who receives it, and what the response workflow is.",
    required: true,
  },
  {
    id: "contract-08",
    name: "Audit trail specification",
    description:
      "Every decision, approval, AI output reviewed, and evidence linkage is timestamped and attributed to a named user. The audit log is immutable.",
    required: true,
  },
  {
    id: "contract-09",
    name: "Prompt templates",
    description:
      "One or more prompt templates per AI-assisted stage, with version control. Templates are tested against the evaluation harness before release.",
    required: true,
  },
  {
    id: "contract-10",
    name: "Evaluation suite",
    description:
      "A set of evaluation cases covering the main AI-assisted stages. Must pass before the app is released or updated.",
    required: true,
  },
  {
    id: "contract-11",
    name: "Work hub integration",
    description:
      "The app registers active cycles, pending items, and flagged exceptions with the role work hub so they appear on the professional's daily view.",
    required: true,
  },
  {
    id: "contract-12",
    name: "Release metadata",
    description:
      "Version number, release date, author, changelog, and compatibility declaration against the platform version.",
    required: true,
  },
  {
    id: "contract-13",
    name: "User documentation",
    description:
      "In-app guidance for each stage and a short reference document covering the workflow, AI assistance, and approval steps.",
    required: true,
  },
  {
    id: "contract-14",
    name: "Disablement procedure",
    description:
      "A defined procedure for disabling or retiring the app without data loss or audit trail gaps. Active cycles must be migrated or closed before disablement.",
    required: true,
  },
];

export interface AppFactoryPhase {
  phase: number;
  name: string;
  description: string;
  keyActivities: string[];
  gateCriteria: string[];
  typicalDuration: string;
}

export const APP_FACTORY_LIFECYCLE: AppFactoryPhase[] = [
  {
    phase: 1,
    name: "Discover",
    description:
      "Understand the process, the role, and the pain points that the role app will address. Define the scope and confirm the standard contract components are achievable.",
    keyActivities: [
      "Process walk-through with role professionals",
      "Pain point mapping and prioritisation",
      "AI opportunity identification by stage",
      "Evidence and data source audit",
      "Standard contract feasibility check",
    ],
    gateCriteria: [
      "Process scope agreed and bounded",
      "AI assistance points identified and validated with role professionals",
      "Data and evidence sources confirmed as accessible",
      "Sponsor sign-off on discovery output",
    ],
    typicalDuration: "1 to 2 weeks",
  },
  {
    phase: 2,
    name: "Design",
    description:
      "Specify the workflow in detail: stages, outputs, AI manifest, evidence schema, and approval rules. Produce the role app design document.",
    keyActivities: [
      "Stage-by-stage workflow specification",
      "Output schema design for each stage",
      "AI manifest drafting: what AI does and where",
      "Evidence specification per stage",
      "Approval and escalation rule definition",
      "Work hub integration design",
    ],
    gateCriteria: [
      "Role app design document complete and reviewed",
      "All 14 standard contract components specified",
      "Design reviewed by role professional and approved by sponsor",
      "Platform architect sign-off on integration design",
    ],
    typicalDuration: "1 to 2 weeks",
  },
  {
    phase: 3,
    name: "Configure",
    description:
      "Set up the platform configuration for the role app: workflow engine, evidence schema, approval rules, and work hub registration.",
    keyActivities: [
      "Workflow engine configuration in platform",
      "Database schema updates for new stage outputs",
      "Evidence schema and file handling configuration",
      "Approval and gating rule implementation",
      "Work hub registration and queue configuration",
      "Escalation threshold configuration",
    ],
    gateCriteria: [
      "Workflow navigable end-to-end in development environment",
      "Evidence capture and linkage working",
      "Approval gates enforced correctly",
      "Work hub showing active cycles from this app",
    ],
    typicalDuration: "2 to 3 weeks",
  },
  {
    phase: 4,
    name: "Build",
    description:
      "Develop AI assistance capabilities: prompt templates, output parsing, anomaly flagging, and evaluation suite.",
    keyActivities: [
      "Prompt template development per AI-assisted stage",
      "Structured output schema enforcement",
      "Anomaly flagging logic implementation",
      "Evidence linking automation",
      "Evaluation suite development: test cases and expected outputs",
      "Audit trail event logging for AI interactions",
    ],
    gateCriteria: [
      "All AI-assisted stages returning structured outputs",
      "Evaluation suite passing at agreed quality threshold",
      "Audit trail capturing all AI interactions with attribution",
      "Human review step enforced before AI output is accepted",
    ],
    typicalDuration: "2 to 4 weeks",
  },
  {
    phase: 5,
    name: "Validate",
    description:
      "Test the role app with a small group of professionals from the target role. Identify gaps, adjust configuration and prompts, and confirm readiness for release.",
    keyActivities: [
      "User acceptance testing with 2 to 3 role professionals",
      "Full cycle run-through from stage 1 to final output",
      "Evidence quality spot-check by second-line observer",
      "AI output quality review against evaluation suite",
      "Bug fixing and configuration adjustments",
      "Release documentation completion",
    ],
    gateCriteria: [
      "At least one complete cycle run-through by target role professional",
      "No critical or high severity defects open",
      "Evaluation suite passing at release threshold",
      "User acceptance confirmed by at least two role professionals",
      "Release metadata and documentation complete",
    ],
    typicalDuration: "1 to 2 weeks",
  },
  {
    phase: 6,
    name: "Release",
    description:
      "Deploy the role app to the production platform, onboard the initial user cohort, and confirm successful operation.",
    keyActivities: [
      "Production deployment and smoke testing",
      "Cohort onboarding and training session",
      "Work hub confirmation for all cohort members",
      "First live cycle initiated in production",
      "Monitoring alerts configured for this app",
      "Release announcement to sponsor and cohort",
    ],
    gateCriteria: [
      "Production deployment successful",
      "All cohort members can access the app and navigate the workflow",
      "First cycle initiated and progressing",
      "Monitoring and alerting active",
      "Sponsor notified of successful release",
    ],
    typicalDuration: "1 week",
  },
  {
    phase: 7,
    name: "Operate",
    description:
      "Run the role app in production as part of the managed operations service. Monitor performance, support users, and manage the AI model on an ongoing basis.",
    keyActivities: [
      "Daily operational monitoring and alerting",
      "User support and onboarding for new cohort members",
      "Monthly AI output quality review",
      "Prompt refinement based on production data",
      "Quarterly service review with client sponsor",
      "Incident management and root cause analysis",
    ],
    gateCriteria: [
      "Ongoing: no single gate; continuous quality assurance",
    ],
    typicalDuration: "Ongoing",
  },
  {
    phase: 8,
    name: "Improve",
    description:
      "Continuously improve the role app based on usage data, user feedback, model performance trends, and regulatory or process changes.",
    keyActivities: [
      "Usage data analysis and pattern identification",
      "User feedback collection and prioritisation",
      "Prompt and evaluation improvements based on production evidence",
      "Workflow adjustments for process changes",
      "New AI capability introduction (new model versions, new tools)",
      "App version release with changelog",
    ],
    gateCriteria: [
      "Improvement releases follow the same validate and release gates as initial build",
      "Evaluation suite updated to cover new capabilities",
      "Sponsor notified of material changes before deployment",
    ],
    typicalDuration: "Continuous; quarterly improvement release cadence",
  },
];

export interface RoleAppCatalogueEntry {
  function: string;
  apps: {
    name: string;
    status: RoleAppStatus;
    description?: string;
  }[];
}

export const ROLE_APP_CATALOGUE: RoleAppCatalogueEntry[] = [
  {
    function: "Operational Risk",
    apps: [
      {
        name: "RCSA Cycle Assistant",
        status: "Installed",
        description:
          "Eight-stage RCSA workflow from scope definition through monitoring reassessment. AI drafts risk narratives and flags rating changes.",
      },
      {
        name: "Event-Driven Reassessment",
        status: "Demo",
        description:
          "Triggers a targeted reassessment from a loss event or near-miss. Pulls event data into a compressed RCSA scope.",
      },
      {
        name: "Rapid Assessment",
        status: "Demo",
        description:
          "Two-stage compressed cycle for emerging or time-sensitive risks. Produces a lightweight but auditable assessment output.",
      },
      {
        name: "Challenge Workshop Assistant",
        status: "Planned",
        description:
          "Prepares challenge materials and records outcomes for second-line challenge sessions. Generates a challenge log with agreed responses.",
      },
      {
        name: "Committee Delta Builder",
        status: "Planned",
        description:
          "Generates a delta pack for risk committees showing what has changed since the last submission. AI identifies material movements.",
      },
      {
        name: "Scenario Library Builder",
        status: "Planned",
        description:
          "Builds and maintains a structured scenario library aligned to the risk taxonomy. AI generates draft scenarios for professional review.",
      },
      {
        name: "Risk Appetite Monitor",
        status: "Planned",
        description:
          "Monitors risk indicators against appetite thresholds and surfaces breaches for OR Partner review and escalation.",
      },
    ],
  },
  {
    function: "Third-Party Risk Management",
    apps: [
      {
        name: "Third-Party Onboarding",
        status: "Installed",
        description:
          "Eight-stage onboarding workflow from initial request through handover to monitoring. AI assists at the classification and evidence review stages.",
      },
      {
        name: "Periodic Reassessment",
        status: "Demo",
        description:
          "Annual or trigger-based full reassessment of an existing supplier. Pulls prior assessment data for comparison.",
      },
      {
        name: "Continuous Monitoring",
        status: "Planned",
        description:
          "Daily monitoring of third-party signals from external data feeds and internal indicators. Flags exceptions for TPRM Manager review.",
      },
      {
        name: "Fourth-Party Deep Dive",
        status: "Demo",
        description:
          "Extended due diligence on critical sub-processors. Maps fourth-party exposure and produces a structured risk report.",
      },
      {
        name: "Exit Planning",
        status: "Demo",
        description:
          "Structured exit workflow with data offboarding checklist, contract closure steps, and exit risk assessment.",
      },
      {
        name: "Portfolio Heat Map",
        status: "Planned",
        description:
          "Aggregated view of third-party portfolio risk by inherent risk rating, assessment recency, and monitoring flag count.",
      },
      {
        name: "Inherent Risk Screener",
        status: "Planned",
        description:
          "Rapid inherent risk classification for new supplier requests. AI scores against the risk taxonomy and recommends due diligence tier.",
      },
    ],
  },
  {
    function: "Control Assurance",
    apps: [
      {
        name: "Control Testing Planner",
        status: "Planned",
        description:
          "Plans the control testing cycle, assigns testers, and tracks progress. AI recommends sample sizes based on control criticality.",
      },
      {
        name: "Sample Design Assistant",
        status: "Planned",
        description:
          "Supports statistically sound sample selection for control testing. Documents methodology for audit review.",
      },
      {
        name: "Deficiency Tracker",
        status: "Planned",
        description:
          "Tracks control deficiencies from identification through remediation. Links to root cause analysis and management actions.",
      },
    ],
  },
  {
    function: "Incident and Resilience",
    apps: [
      {
        name: "Incident Capture Assistant",
        status: "Planned",
        description:
          "Structured incident capture from initial notification through investigation close. AI drafts the incident narrative.",
      },
      {
        name: "Root Cause Analyser",
        status: "Planned",
        description:
          "Guides the professional through a structured root cause analysis and documents findings against the risk taxonomy.",
      },
      {
        name: "Lessons Learned Packager",
        status: "Planned",
        description:
          "Packages lessons learned outputs for distribution to relevant risk functions and feeds back into the RCSA risk assessment.",
      },
    ],
  },
  {
    function: "Regulatory Change",
    apps: [
      {
        name: "Regulatory Change Tracker",
        status: "Planned",
        description:
          "Tracks regulatory publications and updates, assesses impact against the risk and control framework, and assigns action owners.",
      },
      {
        name: "Impact Assessment Assistant",
        status: "Planned",
        description:
          "AI-assisted impact assessment of regulatory changes on existing policies, controls, and risk assessments.",
      },
    ],
  },
  {
    function: "NFR Governance",
    apps: [
      {
        name: "NFR Committee Pack Builder",
        status: "Planned",
        description:
          "Aggregates outputs from all active role apps into a committee pack. AI generates the executive summary and flags material items.",
      },
      {
        name: "Risk Framework Manager",
        status: "Planned",
        description:
          "Manages the risk taxonomy, control library, and appetite statements. Changes are versioned and linked to affected role apps.",
      },
    ],
  },
];
