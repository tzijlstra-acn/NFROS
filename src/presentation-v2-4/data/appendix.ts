/**
 * V2.4 appendix slide data.
 *
 * Every slide has an action title and an evidence subtitle.
 * No double-hyphen (`--`) or em dash in any string value.
 * No invented benchmarks, client savings, or compliance claims.
 */

import type { AppendixSlide24 } from "./types";

export const APPENDIX_SLIDES_V24: AppendixSlide24[] = [
  {
    id: "app-01",
    section: "Scope",
    title: "The current release proves two complete Role Operating Systems",
    subtitle: "Operational Risk and TPRM are available; other roles remain Demo or Planned",
    visual: {
      type: "status-table",
      columns: ["Component", "Status", "Note"],
      rows: [
        { Component: "Operational Risk Partner OS", Status: "Implemented", Note: "Role dashboard, work hub and queue running locally" },
        { Component: "TPRM Manager OS", Status: "Implemented", Note: "Role dashboard, work hub and queue running locally" },
        { Component: "RCSA Cycle Assistant (Role App)", Status: "Implemented", Note: "Eight-stage workflow with AI drafting at each stage" },
        { Component: "Third-Party Onboarding (Role App)", Status: "Implemented", Note: "Eight-stage onboarding workflow installed and tested" },
        { Component: "Control Assurance OS", Status: "Demo only", Note: "Role shell exists; workflow apps not yet built" },
        { Component: "Incident and Resilience OS", Status: "Demo only", Note: "Role shell exists; workflow apps not yet built" },
        { Component: "Regulatory Change OS", Status: "Planned", Note: "Design agreed; build not started" },
      ],
    },
    evidenceBasis: [
      { type: "repository", label: "Role App catalogue, current release state" },
      { type: "product", label: "NFR OS product state, synthetic data" },
    ],
    speakerNotes:
      "Walk through each component status honestly. Implemented means running locally with synthetic data and tested end to end. Demo only means the shell exists but process apps have not been built. Planned means design is agreed but build has not started. Do not overstate what is available. The two implemented role operating systems are the foundation for the design-partner engagement.",
  },

  {
    id: "app-02",
    section: "Scope",
    title: "Role Apps define the expansion path from platform to practice",
    subtitle: "Installed apps run today; Demo and Planned apps mark the roadmap",
    visual: {
      type: "capability-map",
      groups: [
        {
          name: "Installed",
          items: [
            { label: "RCSA Cycle Assistant", status: "Installed" },
            { label: "Third-Party Onboarding", status: "Installed" },
          ],
        },
        {
          name: "Demo",
          items: [
            { label: "Control Assurance Review", status: "Demo" },
            { label: "Event and Incident Manager", status: "Demo" },
            { label: "Committee Preparation", status: "Demo" },
            { label: "Regulatory Horizon Monitor", status: "Demo" },
          ],
        },
        {
          name: "Planned",
          items: [
            { label: "Periodic Third-Party Review", status: "Planned" },
            { label: "Risk and Control Self-Assessment (standalone)", status: "Planned" },
          ],
        },
      ],
    },
    evidenceBasis: [
      { type: "repository", label: "Role App catalogue, current release state" },
    ],
    speakerNotes:
      "The catalogue shows what is running, what is demonstrated, and what is on the roadmap. Do not describe a Demo app as available for production use. The App Factory track on slide 12 shows how new apps move from Discover through Release into Installed state.",
  },

  {
    id: "app-03",
    section: "Process",
    title: "RCSA remains connected from scope to monitored outcome",
    subtitle: "Eight stages link evidence, challenge, decisions, actions and reassessment",
    visual: {
      type: "process-matrix",
      stages: ["Scope", "Evidence", "Change", "Input", "Challenge", "Rating", "Actions", "Monitor"],
      tracks: ["AI prepares", "Human decides", "System executes"],
      cells: {
        "Scope_AI prepares": "Trigger criteria, portfolio extraction",
        "Scope_Human decides": "Scope confirmation",
        "Scope_System executes": "Cycle opens, notifications sent",
        "Evidence_AI prepares": "Prior assessment, data pull, gap flags",
        "Evidence_Human decides": "Evidence adequacy review",
        "Evidence_System executes": "Evidence drawer updated",
        "Change_AI prepares": "Change delta analysis",
        "Change_Human decides": "Change significance assessment",
        "Change_System executes": "Change log updated",
        "Input_AI prepares": "First-line input request",
        "Input_Human decides": "First-line submission",
        "Input_System executes": "Input captured and linked",
        "Challenge_AI prepares": "Challenge agenda, question pack",
        "Challenge_Human decides": "Challenge workshop decision",
        "Challenge_System executes": "Challenge record archived",
        "Rating_AI prepares": "Rating comparison, appetite flag",
        "Rating_Human decides": "Risk rating and appetite sign-off",
        "Rating_System executes": "Rating recorded in GRC",
        "Actions_AI prepares": "Action owner suggestions",
        "Actions_Human decides": "Action approval",
        "Actions_System executes": "Actions created in action tracker",
        "Monitor_AI prepares": "Monitoring schedule, trigger flags",
        "Monitor_Human decides": "Reassessment trigger review",
        "Monitor_System executes": "Monitoring active, next cycle queued",
      },
    },
    evidenceBasis: [
      { type: "product", label: "RCSA Cycle Assistant, synthetic data" },
      { type: "repository", label: "Role App process specification" },
    ],
    speakerNotes:
      "Walk through the RCSA process stage by stage. At each stage, show what the AI prepares, what the professional decides, and what the system executes after approval. The three-track structure makes the authority boundary explicit at every step. No stage advances without a human decision on the middle track.",
  },

  {
    id: "app-04",
    section: "Process",
    title: "Third-party onboarding becomes a persistent governed lifecycle",
    subtitle: "Classification, due diligence, specialist review, conditions and monitoring remain connected",
    visual: {
      type: "process-matrix",
      stages: ["Request", "Classify", "Due diligence", "Evidence", "Specialists", "Conditions", "Decision", "Monitor"],
      tracks: ["AI prepares", "Human decides", "System executes"],
      cells: {
        "Request_AI prepares": "Intake form, duplicate check",
        "Request_Human decides": "Request acceptance",
        "Request_System executes": "Third party created, case opened",
        "Classify_AI prepares": "Criticality scoring, tier suggestion",
        "Classify_Human decides": "Criticality and tier classification",
        "Classify_System executes": "Tier recorded, due diligence scope set",
        "Due diligence_AI prepares": "Due diligence questionnaire",
        "Due diligence_Human decides": "Due diligence scope approval",
        "Due diligence_System executes": "Questionnaire sent to third party",
        "Evidence_AI prepares": "Response review, gap analysis",
        "Evidence_Human decides": "Evidence adequacy decision",
        "Evidence_System executes": "Evidence locked to case",
        "Specialists_AI prepares": "Specialist routing, context pack",
        "Specialists_Human decides": "Specialist sign-off per discipline",
        "Specialists_System executes": "Specialist outputs archived",
        "Conditions_AI prepares": "Contract condition suggestions",
        "Conditions_Human decides": "Condition approval",
        "Conditions_System executes": "Conditions recorded in contract system",
        "Decision_AI prepares": "Approval summary",
        "Decision_Human decides": "Onboarding decision",
        "Decision_System executes": "Third party activated, receipt generated",
        "Monitor_AI prepares": "Monitoring schedule, event triggers",
        "Monitor_Human decides": "Reassessment trigger review",
        "Monitor_System executes": "Monitoring active, periodic review queued",
      },
    },
    evidenceBasis: [
      { type: "product", label: "Third-Party Onboarding, synthetic data" },
      { type: "repository", label: "Role App process specification" },
    ],
    speakerNotes:
      "The TPRM process follows the same three-track structure as RCSA. The eight stages take a third party from initial request through to active monitoring. At each stage the AI prepares, the professional decides, and the system executes after approval. The lifecycle does not end at onboarding; monitoring and periodic review are part of the Role App.",
  },

  {
    id: "app-05",
    section: "Scope",
    title: "Demo Role Apps show the expansion model without production commitment",
    subtitle: "Four demo apps illustrate how additional processes attach to the shared core",
    visual: {
      type: "status-table",
      columns: ["Role App", "Role OS", "Status", "Capability"],
      rows: [
        { "Role App": "Control Assurance Review", "Role OS": "Control Assurance OS", Status: "Demo", Capability: "End-to-end control testing and evidence" },
        { "Role App": "Event and Incident Manager", "Role OS": "Incident and Resilience OS", Status: "Demo", Capability: "Event capture, impact assessment, escalation" },
        { "Role App": "Committee Preparation", "Role OS": "OR Partner OS", Status: "Demo", Capability: "Agenda, packs, minutes, and action tracking" },
        { "Role App": "Regulatory Horizon Monitor", "Role OS": "Regulatory Change OS", Status: "Demo", Capability: "Change identification, impact assessment, tracking" },
      ],
    },
    evidenceBasis: [
      { type: "repository", label: "Role App catalogue, current release state" },
    ],
    speakerNotes:
      "Demo apps exist as demonstration capability only. They are not available for production use. Their purpose is to show how the App Factory track can extend the platform. Do not describe a demo app as ready for deployment.",
  },

  {
    id: "app-06",
    section: "Platform",
    title: "The AI layer runs four capability groups within defined boundaries",
    subtitle: "Aggregation, drafting, flagging and linking operate inside the professional's workflow",
    visual: {
      type: "text-columns",
      columns: [
        {
          heading: "Aggregate",
          items: [
            "Pull inputs from connected sources",
            "Reconcile across GRC and document systems",
            "Surface relevant prior assessments",
            "Compile evidence into a single view",
          ],
        },
        {
          heading: "Draft",
          items: [
            "Generate first-draft risk narratives",
            "Produce challenge question packs",
            "Summarise third-party due diligence",
            "Prepare committee-ready summaries",
          ],
        },
        {
          heading: "Flag",
          items: [
            "Identify rating changes from prior cycle",
            "Surface evidence gaps before submission",
            "Flag threshold breaches",
            "Alert on overdue actions and reviews",
          ],
        },
        {
          heading: "Link",
          items: [
            "Associate evidence to workflow stage",
            "Connect actions to decisions",
            "Link approvals to execution receipts",
            "Maintain audit chain across the lifecycle",
          ],
        },
      ],
    },
    evidenceBasis: [
      { type: "product", label: "AI capability layer, NFR OS platform design" },
      { type: "repository", label: "AI capability specification" },
    ],
    speakerNotes:
      "The four capability groups define what the AI does in concrete terms. Aggregate, draft, flag, and link. The AI does not decide, submit, approve, or escalate. Those actions remain with the professional in every workflow. Each group maps to a set of implemented features in the current product state.",
  },

  {
    id: "app-07",
    section: "Platform",
    title: "The AI infrastructure is designed for regulated financial services",
    subtitle: "Model access, data residency, audit, and evaluation are part of the platform design",
    visual: {
      type: "text-columns",
      columns: [
        {
          heading: "Model access",
          items: [
            "Large language model via enterprise API",
            "No model training on client data",
            "Prompt engineering constrained to approved templates",
            "Output reviewed before display to professional",
          ],
        },
        {
          heading: "Data handling",
          items: [
            "Synthetic data in demonstration environment",
            "Client data processed in agreed residency boundary",
            "No persistent storage of LLM inputs or outputs",
            "Input and output logging for audit where required",
          ],
        },
        {
          heading: "Evaluation",
          items: [
            "AI output quality assessed at each stage",
            "Human review rates tracked per workflow",
            "Drift detection for repeatable outputs",
            "Quarterly model review built into managed service",
          ],
        },
      ],
    },
    evidenceBasis: [
      { type: "product", label: "AI infrastructure specification, NFR OS platform design" },
      { type: "proposal", label: "Accenture managed service model for AI" },
    ],
    speakerNotes:
      "Address the model governance question directly. The AI does not train on client data. Outputs are reviewed before being shown to the professional. Data residency follows the agreed boundary for the engagement. The evaluation track inside managed operations monitors AI quality over time and flags drift. This is part of the recurring service, not a one-time setup.",
  },

  {
    id: "app-08",
    section: "Platform",
    title: "The platform architecture connects four layers into one governed path",
    subtitle: "Role, process, control and integration layers operate together without replacing systems of record",
    visual: {
      type: "architecture-layers",
      layers: [
        {
          name: "Role Operating System layer",
          items: ["OR Partner OS", "TPRM Manager OS", "Control Assurance OS (Demo)", "Incident and Resilience OS (Demo)"],
        },
        {
          name: "Process and workflow layer",
          items: ["Role Apps", "Stage definitions", "AI assistance at each stage", "Human gate enforcement"],
        },
        {
          name: "Control and identity fabric",
          items: ["Identity and access", "Authority model", "Approval routing", "Audit event log", "Evaluation pipeline"],
        },
        {
          name: "Integration and systems of record",
          items: ["GRC connector", "Collaboration connector", "Document store connector", "Data platform connector", "Execution receipt and external acknowledgement"],
        },
      ],
    },
    evidenceBasis: [
      { type: "repository", label: "Platform architecture documentation" },
      { type: "product", label: "NFR OS platform, synthetic data" },
    ],
    speakerNotes:
      "The four-layer model explains how NFROS sits above existing systems without replacing them. The integration layer connects to what the bank already has. The control fabric makes every step governed. The process layer structures the work. The role layer personalises the experience. Walk through each layer in order from bottom to top.",
  },

  {
    id: "app-09",
    section: "Platform",
    title: "One authority model governs every Role App",
    subtitle: "Role, materiality and approval tier determine which actions may execute automatically",
    visual: {
      type: "authority-matrix",
      columns: ["Action type", "Executed by", "Approval required", "Audit logged"],
      rows: [
        { "Action type": "Routine notification", "Executed by": "AI within policy", "Approval required": "No", "Audit logged": "Yes" },
        { "Action type": "Evidence association", "Executed by": "AI with human review", "Approval required": "Professional confirmation", "Audit logged": "Yes" },
        { "Action type": "Draft output", "Executed by": "AI, reviewed by professional", "Approval required": "Professional sign-off", "Audit logged": "Yes" },
        { "Action type": "Risk rating", "Executed by": "Human", "Approval required": "Role authority required", "Audit logged": "Yes" },
        { "Action type": "Approval decision", "Executed by": "Human", "Approval required": "Named approver", "Audit logged": "Yes" },
        { "Action type": "External execution", "Executed by": "System post-approval", "Approval required": "Approval recorded first", "Audit logged": "Yes, with receipt" },
        { "Action type": "Escalation", "Executed by": "Human", "Approval required": "Escalation authority", "Audit logged": "Yes" },
      ],
    },
    evidenceBasis: [
      { type: "repository", label: "Identity and access model specification" },
      { type: "product", label: "Authority model, NFR OS platform design" },
    ],
    speakerNotes:
      "The authority table shows the full range of action types and who or what executes them. Every action is audit logged. External execution only happens after a named approval is recorded. This table can be adapted to show the client's own authority framework once the design-partner baseline is established.",
  },

  {
    id: "app-10",
    section: "Platform",
    title: "AI routines run on a defined schedule across active cycles",
    subtitle: "Eight routine types are implemented; four are in demonstration state",
    visual: {
      type: "status-table",
      columns: ["Routine", "Trigger", "Output", "Status"],
      rows: [
        { Routine: "Evidence freshness check", Trigger: "Daily on active cycles", Output: "Freshness flag in evidence drawer", Status: "Implemented" },
        { Routine: "Action overdue alert", Trigger: "Daily, configured threshold", Output: "Alert to action owner", Status: "Implemented" },
        { Routine: "Rating drift flag", Trigger: "At evidence stage", Output: "Delta from prior rating", Status: "Implemented" },
        { Routine: "Challenge question pack", Trigger: "At challenge stage", Output: "Question pack in work hub", Status: "Implemented" },
        { Routine: "Risk narrative draft", Trigger: "At rating stage", Output: "Draft narrative for review", Status: "Implemented" },
        { Routine: "Committee summary", Trigger: "At approval stage", Output: "Committee-ready summary", Status: "Demo" },
        { Routine: "Third-party periodic reminder", Trigger: "Configured review date", Output: "Review task to TPRM Manager", Status: "Demo" },
        { Routine: "Regulatory horizon briefing", Trigger: "Weekly", Output: "Briefing in work hub", Status: "Demo" },
      ],
    },
    evidenceBasis: [
      { type: "product", label: "AI routine registry, current implementation state" },
    ],
    speakerNotes:
      "Walk through each routine and its current status. Implemented routines are running in the demonstration environment with synthetic data. Demo routines exist in the registry but are not yet active. The routine schedule is configurable by engagement.",
  },

  {
    id: "app-11",
    section: "Platform",
    title: "Evaluation and quality assurance are part of the managed service",
    subtitle: "AI output quality, professional review rates and process compliance are tracked continuously",
    visual: {
      type: "text-columns",
      columns: [
        {
          heading: "AI output quality",
          items: [
            "Review rate per output type",
            "Edit rate per draft type",
            "Flagged output rate",
            "Output acceptance trend over time",
          ],
        },
        {
          heading: "Process compliance",
          items: [
            "Stage completion rate",
            "Human gate completion rate",
            "Escalation trigger rate",
            "Action completion rate",
          ],
        },
        {
          heading: "Service quality",
          items: [
            "Mean time to AI output",
            "System availability",
            "Connector sync latency",
            "Incident and resolution log",
          ],
        },
      ],
    },
    evidenceBasis: [
      { type: "product", label: "Evaluation pipeline, NFR OS platform design" },
      { type: "proposal", label: "Managed service quality framework" },
    ],
    speakerNotes:
      "Evaluation is not a post-engagement review. It is a continuous part of the managed service. The three quality dimensions are monitored from day one of the pilot. The data from the pilot feeds the scale decision at the end of step two. No claim is made about what those measures will show; that depends on the bank's own baseline and working patterns.",
  },

  {
    id: "app-13",
    section: "Service",
    title: "The service model has four tiers from platform to managed operations",
    subtitle: "Platform and function packs are recurring; Role Apps are per-app; managed operations spans all",
    visual: {
      type: "service-stack",
      tiers: [
        {
          name: "Managed operations",
          detail: "Monitoring, model review, new Role App releases, user support",
          cadence: "Recurring monthly",
          semanticType: "managed-service",
        },
        {
          name: "Role Apps",
          detail: "RCSA Cycle Assistant, Third-Party Onboarding, additional per roadmap",
          cadence: "Per app delivered",
          semanticType: "role-app",
        },
        {
          name: "Function packs",
          detail: "OR, TPRM, Control Assurance: role OS and base configuration",
          cadence: "Recurring per function",
          semanticType: "function",
        },
        {
          name: "Platform",
          detail: "Infrastructure, identity, AI model access, connectors, security operations",
          cadence: "Recurring monthly",
          semanticType: "platform",
        },
      ],
    },
    evidenceBasis: [
      { type: "proposal", label: "NFR OS service model documentation" },
    ],
    speakerNotes:
      "Walk through each tier from bottom to top. The platform is the foundation: it does not change as more apps are added. Function packs enable each risk discipline independently. Role Apps are the growth mechanism: each new app adds a governed process. Managed operations covers everything needed to keep the service current and performing. The commercial structure follows from this model.",
  },

  {
    id: "app-14",
    section: "Service",
    title: "Commercial packaging separates one-time setup from recurring service",
    subtitle: "Design-partner engagement establishes the baseline before the programme is scoped",
    visual: {
      type: "text-columns",
      columns: [
        {
          heading: "Design-partner engagement",
          items: [
            "Fixed scope, time-boxed",
            "Baseline assessment",
            "Two role operating systems proved",
            "Outcome report and scale recommendation",
            "One-time fee",
          ],
        },
        {
          heading: "Programme (post-pilot)",
          items: [
            "Platform recurring fee",
            "Function packs per discipline",
            "Role Apps per process delivered",
            "Managed operations recurring fee",
            "Scoped after pilot outcome report",
          ],
        },
      ],
    },
    evidenceBasis: [
      { type: "proposal", label: "Accenture NFR OS commercial structure" },
    ],
    speakerNotes:
      "Do not discuss programme pricing before the design-partner engagement is agreed. The commercial structure presented here is indicative only. The programme scope, and therefore the commercial structure, is agreed after the pilot outcome report is reviewed.",
  },

  {
    id: "app-15",
    section: "Rollout",
    title: "The design-partner engagement has a defined scope, timeline and exit criterion",
    subtitle: "Three steps and three gates turn a bounded commitment into an evidence-based scale decision",
    visual: {
      type: "text-columns",
      columns: [
        {
          heading: "Step 1: Connect and baseline",
          items: [
            "One business area, one team",
            "Current work map and source map",
            "Authority model validated",
            "Baseline measures agreed",
            "Gate: data and process ready",
          ],
        },
        {
          heading: "Step 2: Prove two role operating systems",
          items: [
            "OR Partner OS and TPRM Manager OS",
            "Read-only first, then approval-gated execution",
            "Full RCSA cycle and one TPRM onboarding",
            "Outcome report produced",
            "Gate: does the product improve work and retain control",
          ],
        },
        {
          heading: "Step 3: Scale by Role App",
          items: [
            "Add processes, functions and connectors",
            "Increase autonomy only where proved",
            "Move to managed operation",
            "Gate: does each wave meet value and control thresholds",
          ],
        },
      ],
    },
    evidenceBasis: [
      { type: "proposal", label: "Accenture design-partner engagement structure" },
    ],
    speakerNotes:
      "Walk through each step and its gate question. The gate questions are not rhetorical. They define the decision point at the end of each step. If step two does not pass its gate, the engagement stops and the outcome report explains why. This protects the client and keeps the scope honest.",
  },

  {
    id: "app-16",
    section: "Rollout",
    title: "Five metrics verify the pilot outcome across capacity, quality, control and continuity",
    subtitle: "Each metric has a baseline, a pilot measure, and a scale threshold",
    visual: {
      type: "measurement-framework",
      dimensions: [
        {
          name: "Capacity",
          metric: "Meeting preparation time per RCSA cycle",
          baseline: "Established in step 1 work map",
        },
        {
          name: "Quality",
          metric: "Evidence completeness rate at submission",
          baseline: "Established in step 1 baseline assessment",
        },
        {
          name: "Control",
          metric: "Blocked-action rate: actions without a linked decision",
          baseline: "Established in step 1 action audit",
        },
        {
          name: "Continuity",
          metric: "Process waiting time: stages open without active owner",
          baseline: "Established in step 1 process mapping",
        },
        {
          name: "Adoption",
          metric: "Percentage of enrolled professionals using the work hub daily",
          baseline: "Zero at pilot start; target agreed before pilot",
        },
      ],
    },
    evidenceBasis: [
      { type: "proposal", label: "Pilot success metric framework" },
    ],
    speakerNotes:
      "Each metric requires the bank to establish its own baseline in step one. No claim is made about what the pilot will show. The five metrics are the scorecard agreed before the pilot starts. The outcome report compares pilot results to the baseline and makes a recommendation on the scale decision.",
  },

  {
    id: "app-17",
    section: "Rollout",
    title: "The pilot involves stakeholders across risk, technology and the business",
    subtitle: "Roles are confirmed in step one; the sponsor owns the gate decisions",
    visual: {
      type: "text-columns",
      columns: [
        {
          heading: "Risk function",
          items: [
            "Chief Risk Officer or delegate (sponsor)",
            "Operational Risk lead",
            "TPRM lead",
            "3 to 5 OR professionals (cohort)",
            "3 to 5 TPRM professionals (cohort)",
          ],
        },
        {
          heading: "Technology",
          items: [
            "CTO or CIO delegate",
            "Data and integration lead",
            "Identity and access lead",
            "Security review representative",
          ],
        },
        {
          heading: "Accenture",
          items: [
            "Engagement lead",
            "Product lead",
            "Data and integration specialist",
            "AI and evaluation specialist",
            "Change and adoption specialist",
          ],
        },
      ],
    },
    evidenceBasis: [
      { type: "proposal", label: "Pilot stakeholder structure" },
    ],
    speakerNotes:
      "The stakeholder map is a starting point. The specific roles on the bank side are confirmed in step one. The sponsor must have authority to approve each gate decision. The cohort is confirmed before step two begins. The Accenture team scales with the engagement scope.",
  },

  {
    id: "app-20",
    section: "Platform",
    title: "Deployment profiles match the bank's data and security requirements",
    subtitle: "Three profiles cover cloud-hosted, hybrid, and on-premise deployment with the same product",
    visual: {
      type: "text-columns",
      columns: [
        {
          heading: "Cloud-hosted",
          items: [
            "Full product hosted in Accenture cloud environment",
            "Synthetic data used in demonstration mode",
            "Client data requires agreed residency boundary",
            "Fastest time to value for design-partner engagement",
          ],
        },
        {
          heading: "Hybrid",
          items: [
            "Core platform hosted; connectors run in bank environment",
            "Data stays inside bank boundary",
            "Requires connector deployment and network configuration",
            "Preferred for production engagement",
          ],
        },
        {
          heading: "On-premise",
          items: [
            "Full product deployed in bank environment",
            "Maximum data sovereignty",
            "Longer deployment timeline",
            "Requires bank infrastructure provisioning",
          ],
        },
      ],
    },
    evidenceBasis: [
      { type: "proposal", label: "Deployment profile documentation" },
    ],
    speakerNotes:
      "The design-partner engagement typically uses the cloud-hosted profile with synthetic data. The production profile is agreed based on the bank's data and security requirements. Do not commit to a deployment profile without confirming the bank's constraints in step one.",
  },

  {
    id: "app-22",
    section: "Scope",
    title: "The current limitations define the design-partner boundary",
    subtitle: "Identity, live connectors and production controls require bank-specific validation",
    visual: {
      type: "limitations-landscape",
      areas: [
        {
          label: "Identity integration",
          detail: "The current build uses a demonstration identity provider. Bank identity integration requires configuration and security review.",
          category: "current",
        },
        {
          label: "Live GRC connectors",
          detail: "Connectors to live GRC systems are not deployed in the demonstration environment. Integration is designed and tested with synthetic data.",
          category: "current",
        },
        {
          label: "Production approval controls",
          detail: "Full production approval routing requires the bank's identity and authority model to be integrated and validated.",
          category: "current",
        },
        {
          label: "Multi-language support",
          detail: "The current product is English-language only. Localisation is on the roadmap.",
          category: "roadmap",
        },
        {
          label: "Mobile-native experience",
          detail: "The product is designed for desktop use. A mobile-optimised interface is planned.",
          category: "roadmap",
        },
        {
          label: "Custom role OS",
          detail: "Additional role operating systems beyond OR and TPRM require the App Factory design process.",
          category: "roadmap",
        },
      ],
    },
    evidenceBasis: [
      { type: "product", label: "NFR OS product state, current release" },
      { type: "proposal", label: "Design-partner scope and constraints" },
    ],
    speakerNotes:
      "Be explicit about limitations. Every current limitation has a path to resolution, but that path requires the design-partner engagement to establish the bank-specific configuration. Limitations marked as roadmap are not committed delivery; they are planned. Do not describe a limitation as resolved unless it has been addressed in the current product state.",
  },
];
