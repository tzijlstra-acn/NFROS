/**
 * V2.4 core slide data.
 *
 * Consulting storyline: Situation, Complication, Answer, Proof, Value, Control, Scale, Action.
 * Every slide has an action title and an evidence subtitle.
 * No double-hyphen (`--`) or em dash in any string value.
 * No invented benchmarks, client savings, or compliance claims.
 */

import type { CoreSlide24 } from "./types";

export const CORE_SLIDES_V24: CoreSlide24[] = [
  // ---------------------------------------------------------------------------
  // Slide 1:Situation: executive thesis
  // ---------------------------------------------------------------------------
  {
    id: "slide-01",
    section: "Situation",
    title: "AI can return NFR capacity to judgment",
    subtitle: "A role-based operating system connects daily work, complete processes and governed execution",
    exhibit: {
      type: "capacity-convergence",
      data: {
        sources: ["Mail", "Meeting", "Evidence", "GRC task", "Risk signal", "Action"],
        bottleneckLabel: "Work queue",
        osStageName: "NFR Operating System",
        decisionLabel: "One prepared decision",
        judgmentLabel: "Human judgment",
      },
    },
    evidenceBasis: [
      { type: "product", label: "NFR OS product state, synthetic data" },
      { type: "illustrative", label: "Capacity model, illustrative target state" },
    ],
    appendixRefs: [],
    speakerNotes:
      "Open with the thesis, not with a product demo. Risk professionals spend a material portion of their week on coordination work: finding evidence, chasing status, reconciling inputs across systems. The operating system exists to redirect that effort back to the judgment the role was hired to make. The exhibit on screen shows how six categories of incoming work pass through the operating system layer and resolve into one prepared decision, with the professional's judgment as the final and most visible step. This is the design principle the whole deck proves. Keep this slide brief and use the visual to anchor the conversation. The product will make the claim concrete.",
    presentingTimeSeconds: 45,
    footer: "Illustrative regulatory context, not legal advice",
  },

  // ---------------------------------------------------------------------------
  // Slide 2:Situation: agenda
  // ---------------------------------------------------------------------------
  {
    id: "slide-02",
    section: "Situation",
    title: "The discussion moves from case for change to path to scale",
    subtitle: "We will cover the problem, the product, the proof, the controls and the decision required",
    exhibit: {
      type: "story-path",
      data: {
        chapters: [
          { number: 1, audienceQuestion: "Why does this matter?", sectionLabel: "Why change" },
          { number: 2, audienceQuestion: "What is the proposition?", sectionLabel: "What NFROS is" },
          { number: 3, audienceQuestion: "What changes for the professional?", sectionLabel: "How work changes" },
          { number: 4, audienceQuestion: "Why can the bank trust it?", sectionLabel: "How it is controlled" },
          { number: 5, audienceQuestion: "What should we do next?", sectionLabel: "How to start" },
        ],
        activeChapterNumber: 1,
      },
    },
    evidenceBasis: [
      { type: "proposal", label: "Accenture NFR OS engagement scope" },
    ],
    appendixRefs: [],
    speakerNotes:
      "Walk the audience through the five chapters before entering them. Signal this is a focused session: thirty to forty minutes of content, then open discussion. Appendix material is available for any topic the audience wants to go deeper on. The story is front-loaded: we establish the problem before introducing the product, because the product only lands once the problem is agreed. Confirm whether they have seen an earlier version of this material and acknowledge what has changed.",
    presentingTimeSeconds: 30,
  },

  // ---------------------------------------------------------------------------
  // Slide 3:Complication: fragmentation
  // ---------------------------------------------------------------------------
  {
    id: "slide-03",
    section: "Complication",
    title: "Fragmented work consumes capacity before judgment begins",
    subtitle: "Signals, evidence, meetings and actions sit across disconnected systems",
    exhibit: {
      type: "fragmentation-sankey",
      data: {
        sources: ["Mail", "Meetings", "Documents", "GRC", "Data", "Actions"],
        activities: ["Find", "Reconcile", "Coordinate", "Re-enter"],
        outcomeLabel: "Decision",
        evidenceNote: "Illustrative workflow",
      },
    },
    evidenceBasis: [
      { type: "illustrative", label: "Illustrative workflow, qualitative bands" },
    ],
    appendixRefs: [
      {
        appendixId: "app-01",
        label: "Product scope and release status",
        reason: "Grounds the problem in what the product addresses today",
      },
      {
        appendixId: "app-22",
        label: "Current limitations",
        reason: "Sets honest boundaries on what the product covers today",
      },
    ],
    speakerNotes:
      "Establish the problem before any product. Risk professionals in OR, TPRM, and control assurance face the same structural constraint: the work exists across systems that were never designed to connect. An Operational Risk Partner may open a GRC tool, pull a spreadsheet for committee prep, chase evidence by email, and update a status tracker manually for a single RCSA cycle. The exhibit shows how most flow passes through manual assembly before reaching the decision. Each system may be correct in isolation; the friction lives between them. Pause after the visual and ask whether this reflects what they see in their own teams.",
    presentingTimeSeconds: 90,
    footer: "Illustrative workflow",
  },

  // ---------------------------------------------------------------------------
  // Slide 4:Complication: consequence
  // ---------------------------------------------------------------------------
  {
    id: "slide-04",
    section: "Complication",
    title: "The burden between systems slows decisions and weakens continuity",
    subtitle: "Search, reconciliation, coordination and rework create four recurring points of friction",
    exhibit: {
      type: "friction-causal-chain",
      data: {
        chainNodes: [
          "Fragmented inputs",
          "Manual assembly",
          "Delayed or inconsistent decisions",
          "Stale actions and weak continuity",
        ],
        frictionBands: ["Search", "Reconcile", "Coordinate", "Document"],
        implications: [
          "More waiting",
          "More variation",
          "More handoffs",
          "More reconstruction",
        ],
        feedbackLabel: "Cycle repeats",
      },
    },
    evidenceBasis: [
      { type: "illustrative", label: "Causal model, illustrative" },
    ],
    appendixRefs: [
      {
        appendixId: "app-06",
        label: "AI capability layer",
        reason: "Detail on what AI addresses in the friction chain",
      },
      {
        appendixId: "app-11",
        label: "Evaluation and quality assurance",
        reason: "Measurement approach for the described friction",
      },
    ],
    speakerNotes:
      "The cost of fragmentation appears between systems, not inside any one of them. Each system in the bank may be fit for purpose. The problem is the connection work the professional carries between them. The four friction bands: search, reconcile, coordinate, and document, are the recurring activities that consume professional capacity before judgment begins. The causal chain shows how those activities create downstream consequences: delayed decisions, inconsistent outputs, and a process that resets from scratch each cycle. Highlight the feedback loop: stale actions return to fragmented inputs. The cycle repeats. NFROS breaks that loop by replacing the connection work with structured workflow.",
    presentingTimeSeconds: 90,
  },

  // ---------------------------------------------------------------------------
  // Slide 5:Answer: the engagement layer
  // ---------------------------------------------------------------------------
  {
    id: "slide-05",
    section: "Answer",
    title: "NFROS creates one engagement layer across existing risk platforms",
    subtitle: "The operating system coordinates daily work, process execution and control without replacing systems of record",
    exhibit: {
      type: "engagement-layer",
      data: {
        topLayer: "Role Operating Systems",
        workItems: ["Daily work", "Role Apps", "Decisions"],
        controlItems: ["Identity", "Authority", "Approval", "Audit", "Evaluation"],
        systemsOfRecord: ["GRC", "Collaboration", "Documents", "Process intelligence", "Data"],
        activeItemPath: ["Source signal", "Prepared work", "Human decision", "Approved execution", "External receipt"],
      },
    },
    evidenceBasis: [
      { type: "product", label: "NFR OS architecture, synthetic data" },
      { type: "repository", label: "Platform architecture documentation" },
    ],
    appendixRefs: [
      {
        appendixId: "app-08",
        label: "Platform architecture overview",
        reason: "Technical grounding for the engagement layer description",
      },
      {
        appendixId: "app-07",
        label: "AI layer: model and infrastructure",
        reason: "Grounds the AI capability in the actual model and setup",
      },
    ],
    speakerNotes:
      "NFROS is the engagement and execution layer around the platforms the bank already trusts. The systems of record stay. The operating system adds a structured layer on top: role-aware daily work, governed process execution through Role Apps, and a control fabric that links identity, authority, approval, audit, and evaluation into every step. The animated item traveling through the path shows how a single work item moves from source signal to external receipt without the professional leaving the environment or reconnecting manually to another system. Reinforce the non-replacement message: this is an engagement layer, not a replacement for GRC tooling.",
    presentingTimeSeconds: 90,
  },

  // ---------------------------------------------------------------------------
  // Slide 6:Proof: daily experience
  // ---------------------------------------------------------------------------
  {
    id: "slide-06",
    section: "Proof",
    title: "The workday starts with the next decision, already prepared",
    subtitle: "Now, Next and Done focus attention while the AI Partner handles routine coordination",
    exhibit: {
      type: "workday-product",
      data: {
        assetId: "rcsa-home",
        focusAnnotations: [
          { label: "Now", meaning: "Needs judgment" },
          { label: "Next meeting and open actions", meaning: "Prepared in advance" },
          { label: "Done today", meaning: "Already handled" },
        ],
        daylineEvents: [
          { time: "07:45", label: "Brief" },
          { time: "10:30", label: "Challenge workshop" },
          { time: "16:30", label: "Completed follow-up" },
        ],
      },
    },
    evidenceBasis: [
      { type: "product", label: "Operational Risk Partner Home, synthetic data" },
    ],
    appendixRefs: [
      {
        appendixId: "app-10",
        label: "AI routines: implementation status",
        reason: "Shows what the work hub features do and their current status",
      },
      {
        appendixId: "app-20",
        label: "Deployment profiles",
        reason: "Explains which deployment mode supports the demonstrated experience",
      },
    ],
    speakerNotes:
      "Show the product. The professional opens a single URL. The work hub shows their portfolio in one view: which cycles are active, which are waiting for them, which have AI-prepared content ready for review. The system tells them where judgment is needed and keeps routine work out of the way. The day line below the product image shows three touchpoints across a working day. Each is short. The preparation happened before the professional arrived. Note that this image shows the current product state with synthetic data. Every judgment remains with the professional. The hub reduces the administrative overhead that surrounds it.",
    presentingTimeSeconds: 100,
  },

  // ---------------------------------------------------------------------------
  // Slide 7:Proof: role architecture
  // ---------------------------------------------------------------------------
  {
    id: "slide-07",
    section: "Proof",
    title: "A shared core adapts to each risk role",
    subtitle: "Operational Risk and TPRM use common services while retaining distinct methods and judgments",
    exhibit: {
      type: "role-architecture",
      data: {
        sharedCore: ["Agenda", "Meetings", "Actions", "Inbox", "Evidence", "Decisions", "AI Partner"],
        leftRole: {
          title: "Operational Risk Partner",
          subtitle: "RCSA and changing risk",
          judgments: ["Challenge", "Rating", "Risk appetite", "Escalation"],
          assetId: "rcsa-home",
        },
        rightRole: {
          title: "Third-Party Risk Manager",
          subtitle: "Supplier lifecycle and exposure",
          judgments: ["Criticality", "Evidence sufficiency", "Conditions", "Approval"],
          assetId: "tprm-home",
        },
      },
    },
    evidenceBasis: [
      { type: "product", label: "OR Partner OS and TPRM Manager OS, synthetic data" },
      { type: "repository", label: "Role App catalogue, current release state" },
    ],
    appendixRefs: [
      {
        appendixId: "app-01",
        label: "Product scope and release status",
        reason: "Confirms which role operating systems are implemented versus planned",
      },
      {
        appendixId: "app-02",
        label: "Role App catalogue",
        reason: "Full set of role apps available or planned for each role",
      },
    ],
    speakerNotes:
      "The platform is reused; the professional method remains role-specific. The shared core handles the services every risk role needs: agenda, meetings, actions, inbox, evidence, decisions, AI Partner. On top of that shared core, each role gets a distinct operating environment calibrated to their rhythm and judgment. The OR Partner OS is built around the RCSA cycle calendar and committee workflow. The TPRM Manager OS is built around the third-party lifecycle from onboarding through monitoring and exit. The role-specific judgments shown at the outer edges are the moments the platform deliberately stops and routes to the professional. Additional roles are on the roadmap; the shared core is the mechanism that makes each new role incrementally cheaper to deliver.",
    presentingTimeSeconds: 90,
  },

  // ---------------------------------------------------------------------------
  // Slide 8:Proof: Role Apps
  // ---------------------------------------------------------------------------
  {
    id: "slide-08",
    section: "Proof",
    title: "Role Apps turn complete risk processes into reusable products",
    subtitle: "Each app links required sources, AI preparation, human gates, execution and monitoring",
    exhibit: {
      type: "role-app-swimlane",
      data: {
        lanes: [
          {
            title: "RCSA Cycle Assistant",
            stages: [
              { label: "Scope" },
              { label: "Evidence" },
              { label: "Change", isCurrentStage: true },
              { label: "Input" },
              { label: "Challenge", isHumanGate: true },
              { label: "Rating", isHumanGate: true },
              { label: "Actions" },
              { label: "Monitor" },
            ],
            assetId: "rcsa-process-stage",
          },
          {
            title: "Third-Party Onboarding",
            stages: [
              { label: "Request" },
              { label: "Classify" },
              { label: "Due diligence" },
              { label: "Evidence", isCurrentStage: true },
              { label: "Specialists" },
              { label: "Conditions", isHumanGate: true },
              { label: "Decision", isHumanGate: true },
              { label: "Monitor" },
            ],
            assetId: "tprm-process-stage",
          },
        ],
      },
    },
    evidenceBasis: [
      { type: "product", label: "RCSA Cycle Assistant and Third-Party Onboarding, synthetic data" },
      { type: "repository", label: "Role App process specification" },
    ],
    appendixRefs: [
      {
        appendixId: "app-03",
        label: "RCSA Cycle Assistant: eight-stage detail",
        reason: "Full stage-by-stage breakdown of the RCSA process",
      },
      {
        appendixId: "app-04",
        label: "Third-Party Onboarding: eight-stage detail",
        reason: "Full stage-by-stage breakdown of the TPRM onboarding process",
      },
      {
        appendixId: "app-05",
        label: "Demo Role Apps: capability detail",
        reason: "Clarifies which additional apps are demo versus implemented",
      },
    ],
    speakerNotes:
      "A Role App is a persistent governed process, not a prompt or isolated task. Each of the eight stages has defined inputs, AI preparation, a human gate where required, and a clear output. The professional does not move the process forward manually; the system advances on human approval. The human gate stages are shown with a distinct marker: those are the moments the product stops and waits for the professional. The current-stage indicator shows where each process sits today in the synthetic demonstration environment. A Role App can be paused, resumed, escalated, or handed off. It is a product with a lifecycle, not an event.",
    presentingTimeSeconds: 110,
  },

  // ---------------------------------------------------------------------------
  // Slide 9:Proof: authority boundary
  // ---------------------------------------------------------------------------
  {
    id: "slide-09",
    section: "Proof",
    title: "Automation expands capacity without shifting accountability",
    subtitle: "AI runs repeatable work; professionals retain interpretation, challenge and approval",
    exhibit: {
      type: "authority-matrix",
      data: {
        xLabel: "Repeatability",
        yLabel: "Judgment and materiality",
        zones: [
          {
            label: "AI executes within policy",
            examples: ["Routine reminder", "Evidence freshness check", "Status update"],
            xRange: [0.5, 1.0],
            yRange: [0.0, 0.4],
          },
          {
            label: "AI prepares, human reviews",
            examples: ["Assessment draft", "Challenge questions", "Contract condition draft"],
            xRange: [0.3, 0.8],
            yRange: [0.3, 0.7],
          },
          {
            label: "Human decides",
            examples: ["Residual risk", "Supplier approval", "Risk acceptance", "Material escalation"],
            xRange: [0.0, 0.5],
            yRange: [0.6, 1.0],
          },
        ],
        matrixNote: "Authority model",
      },
    },
    evidenceBasis: [
      { type: "product", label: "Authority model, NFR OS platform design" },
      { type: "repository", label: "Identity and access model specification" },
    ],
    appendixRefs: [
      {
        appendixId: "app-06",
        label: "AI capability layer: what the AI does",
        reason: "Detailed breakdown of the four AI capability groups",
      },
      {
        appendixId: "app-09",
        label: "Identity and access model",
        reason: "Technical grounding for authority and approval attribution",
      },
    ],
    speakerNotes:
      "Greater model capability does not automatically expand decision authority. The matrix shows where the boundary sits. Routine, repeatable work with low judgment and materiality can be executed by the AI within policy. Work that requires professional interpretation stops for review: the AI prepares, the professional decides. Material decisions and professional judgments never cross the boundary automatically. This is not an aspiration. It is built into the workflow architecture. The system cannot submit an RCSA to committee. Only an authorised professional can do that. The boundary is enforced by design, not by convention.",
    presentingTimeSeconds: 90,
  },

  // ---------------------------------------------------------------------------
  // Slide 10:Value: value logic
  // ---------------------------------------------------------------------------
  {
    id: "slide-10",
    section: "Value",
    title: "The value case spans capacity, quality, control and continuity",
    subtitle: "Benefits should be measured against the bank's own baseline, not generic benchmarks",
    exhibit: {
      type: "value-tree",
      data: {
        centreLabel: "Better risk decisions",
        branches: [
          {
            label: "Capacity",
            items: ["Less search", "Less coordination", "Less re-entry"],
            metricExample: "Meeting preparation time",
          },
          {
            label: "Quality",
            items: ["More complete evidence", "More consistent preparation", "Clearer challenge"],
            metricExample: "Evidence completeness",
          },
          {
            label: "Control",
            items: ["Visible approval", "Traceable execution", "Complete audit"],
            metricExample: "Blocked-action rate",
          },
          {
            label: "Continuity",
            items: ["Persistent process", "Owned actions", "Event-driven reassessment"],
            metricExample: "Process waiting time",
          },
        ],
        measurementRail: ["Baseline", "Pilot", "Scale decision"],
        chartNote: "Measured in simulation; client baseline required to verify",
      },
    },
    evidenceBasis: [
      { type: "illustrative", label: "Value tree, directional, not measured" },
      { type: "simulation", label: "Metric examples from product simulation, not client data" },
    ],
    appendixRefs: [
      {
        appendixId: "app-16",
        label: "Pilot success metrics",
        reason: "The five metrics used to verify these outcomes during the pilot",
      },
      {
        appendixId: "app-11",
        label: "Evaluation and quality assurance",
        reason: "Grounds the quality outcome in the evaluation approach",
      },
    ],
    speakerNotes:
      "The pilot must prove better work, not simply more AI activity. The value tree shows the four dimensions where the operating system is expected to create value, but each dimension requires the bank to establish its own baseline before any outcome can be verified. Capacity: less time on search, coordination, and re-entry. Quality: more complete evidence, more consistent outputs. Control: visible approval chains, traceable execution, complete audit records. Continuity: processes that persist between cycles, actions that stay owned, reassessment triggered by events rather than by calendar. The measurement rail at the bottom shows the three points where value is assessed. No claim is made about client savings; those emerge from the baseline comparison.",
    presentingTimeSeconds: 90,
  },

  // ---------------------------------------------------------------------------
  // Slide 11:Control: trust by design
  // ---------------------------------------------------------------------------
  {
    id: "slide-11",
    section: "Control",
    title: "Trust is engineered into every material step",
    subtitle: "Evidence, permissions, approvals, execution receipts and audit remain linked by design",
    exhibit: {
      type: "evidence-thread",
      data: {
        steps: [
          { label: "Source evidence", hasProductProof: false },
          { label: "AI preparation", hasProductProof: false },
          { label: "Human decision", hasProductProof: true, assetId: "decision-approval" },
          { label: "Approval", hasProductProof: true, assetId: "decision-approval" },
          { label: "Execution", hasProductProof: false },
          { label: "Receipt", hasProductProof: true, assetId: "execution-receipt" },
          { label: "Audit", hasProductProof: false },
        ],
        proofAnnotations: [
          { stepIndex: 0, label: "Source freshness" },
          { stepIndex: 2, label: "Acting user and role" },
          { stepIndex: 4, label: "Target system and action" },
          { stepIndex: 5, label: "External acknowledgement" },
          { stepIndex: 6, label: "Audit reference" },
        ],
      },
    },
    evidenceBasis: [
      { type: "product", label: "Evidence drawer, decision and approval, execution receipt; synthetic data" },
    ],
    appendixRefs: [
      {
        appendixId: "app-08",
        label: "Platform architecture overview",
        reason: "Technical basis for the audit trail and evidence linking claims",
      },
      {
        appendixId: "app-09",
        label: "Identity and access model",
        reason: "Shows how approval attribution is enforced in the platform",
      },
    ],
    speakerNotes:
      "Trust is part of the workflow, not an explanation added after the fact. The thread on screen shows how one work item moves from source evidence through to audit record. The product stops at human decision. After approval, execution continues and generates a receipt. That receipt links back to the source evidence, the acting user and role, the decision, and the external acknowledgement. The audit record is the natural output of the workflow. The risk professional does not need to reconstruct it, because it was built during the work. Three real product images anchor the key steps: the evidence drawer, the decision and approval screen, and the execution receipt. These are not wireframes; they are the current product state.",
    presentingTimeSeconds: 100,
    footer: "Illustrative regulatory context, not legal advice",
  },

  // ---------------------------------------------------------------------------
  // Slide 12:Scale: service and factory
  // ---------------------------------------------------------------------------
  {
    id: "slide-12",
    section: "Scale",
    title: "A modular service model scales through Function Packs and Role Apps",
    subtitle: "The core platform is reused while the App Factory adds and improves complete processes",
    exhibit: {
      type: "service-factory",
      data: {
        architectureLayers: [
          { label: "Managed service", level: "managed" },
          { label: "Role Apps", sublabel: "Installed, Demo and Planned", level: "apps" },
          { label: "Function Packs", sublabel: "OR, TPRM, Control Assurance", level: "functions" },
          { label: "NFR Operating System", sublabel: "Platform, identity, AI, connectors", level: "platform" },
        ],
        appFactoryStages: [
          { label: "Discover" },
          { label: "Design" },
          { label: "Build", isActive: true },
          { label: "Validate" },
          { label: "Release" },
          { label: "Operate" },
          { label: "Improve" },
        ],
        newAppLabel: "New Role App in progress",
      },
    },
    evidenceBasis: [
      { type: "repository", label: "Role App catalogue, live release state" },
      { type: "product", label: "NFR OS service model documentation" },
    ],
    appendixRefs: [
      {
        appendixId: "app-13",
        label: "Service model: component detail",
        reason: "Full breakdown of each tier and what it includes",
      },
      {
        appendixId: "app-14",
        label: "Commercial packaging",
        reason: "Shows how the tiers translate into one-time and recurring costs",
      },
    ],
    speakerNotes:
      "Reusable platform controls create the economics; Role Apps create the expansion path. The platform layer is fixed and shared: identity, infrastructure, AI model access, security. Function Packs enable each risk discipline: OR, TPRM, and Control Assurance. Role Apps are the growth mechanism: each new app adds a governed process without changing the platform or any previously deployed app. The App Factory shows how new apps are designed, built, validated, released, and improved in a continuous cycle. Show that the Role App catalogue reflects the actual current state: installed, Demo, and Planned are read from the product registry. Do not describe a fictional installed app.",
    presentingTimeSeconds: 100,
  },

  // ---------------------------------------------------------------------------
  // Slide 13:Action: design-partner path and ask
  // ---------------------------------------------------------------------------
  {
    id: "slide-13",
    section: "Action",
    title: "Start with two roles, prove the outcomes, then scale",
    subtitle: "A three-step design-partner journey creates an evidence-based decision to proceed",
    exhibit: {
      type: "design-partner-path",
      data: {
        steps: [
          {
            number: 1,
            title: "Connect and baseline",
            inputs: [
              "One business area",
              "Current work map",
              "Source and system map",
              "Authority model",
              "Baseline measures",
            ],
            gateQuestion: "Is the process and data ready?",
          },
          {
            number: 2,
            title: "Prove two Role Operating Systems",
            inputs: [
              "Operational Risk",
              "Third-Party Risk",
              "Read-only first",
              "Approval-gated execution",
              "Measured outcomes",
            ],
            gateQuestion: "Does the product improve work and retain control?",
          },
          {
            number: 3,
            title: "Scale by Role App",
            inputs: [
              "Add processes",
              "Add functions",
              "Add connectors",
              "Increase autonomy only where proven",
              "Move to managed operation",
            ],
            gateQuestion: "Does each wave meet value and control thresholds?",
          },
        ],
        callToAction: "Choose the first RCSA and TPRM journeys",
      },
    },
    evidenceBasis: [
      { type: "proposal", label: "Accenture design-partner engagement structure" },
    ],
    appendixRefs: [
      {
        appendixId: "app-15",
        label: "Pilot design: detailed specification",
        reason: "Full scope, timeline, and cohort specification for the pilot",
      },
      {
        appendixId: "app-16",
        label: "Pilot success metrics",
        reason: "The scorecard used to verify the pilot outcome",
      },
      {
        appendixId: "app-17",
        label: "Stakeholder map for pilot",
        reason: "Shows who needs to be involved on the client and Accenture side",
      },
    ],
    speakerNotes:
      "The next decision is which two working journeys the bank should prove first. We are not asking for a programme commitment today. We are asking whether the audience is willing to run a gated design-partner engagement on a defined scope. Step one establishes the baseline: one business area, current work map, authority model, and the measures we will use to verify outcomes. The gate question is straightforward: is the process and data ready? Step two proves the two role operating systems: OR and TPRM, read-only first, then approval-gated execution, with measured outcomes throughout. Step three scales by Role App: add processes and functions based on what the pilot verified, increase autonomy only where proven. Each gate is a decision point, not an automatic progression. End by asking who in the room should be involved in scoping step one.",
    presentingTimeSeconds: 90,
  },
];
