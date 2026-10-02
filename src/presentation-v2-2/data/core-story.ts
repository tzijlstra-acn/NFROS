/**
 * Core slide data for NFROS Presentation V2.2.
 *
 * 13 slides. No double-hyphen (`--`) or em dash in any string value.
 * Processes corrected to reflect the actual eight-stage definitions in
 * src/role-apps/rcsa/definition.ts and src/role-apps/tprm/definition.ts.
 * Rollout steps do not hard-code a duration in weeks.
 */

import type {
  CoreSlide22,
  AppendixReference,
  AgendaItem,
  RoleColumn,
  ProcessRow,
  Outcome,
  ServiceLayer,
  RolloutStep,
} from "./types";

export const CORE_SLIDES_V22: CoreSlide22[] = [
  // ---------------------------------------------------------------------------
  // Slide 1: Cover
  // ---------------------------------------------------------------------------
  {
    id: "slide-01",
    section: "Imagine",
    title: "NFR work built around you",
    layout: "hero",
    footer: "NFR Operating System",
    heroLines: [
      "The right work finds you.",
      "Evidence is already prepared.",
      "Every material decision remains yours.",
    ],
    speakerNotes:
      "Open by asking the audience to imagine a morning where they do not open five systems to find out what needs their attention. A single workspace greets them with the cases, reviews, and decisions that actually require their judgment today. That is the ambition behind NFR OS: not a new compliance tool, but an operating layer that organises non-financial risk work around the role rather than around the database. The three lines on screen are the design principles we hold ourselves to. Everything shown today either demonstrates or directly supports one of those three promises. This slide sets the emotional register: we are solving a professional frustration that every risk practitioner in this room knows personally. Keep it brief; the product will do the talking.",
    presentingTimeSeconds: 45,
    appendixRefs: [],
  },

  // ---------------------------------------------------------------------------
  // Slide 2: Agenda
  // ---------------------------------------------------------------------------
  {
    id: "slide-02",
    section: "Agenda",
    title: "Five things we will cover",
    layout: "list",
    agendaItems: [
      { text: "The problem: fragmented NFR work", section: "Problem" },
      { text: "The product: an OS for risk roles", section: "Product" },
      { text: "The daily experience: work that finds you", section: "Daily" },
      { text: "The service: how we deliver and scale", section: "Service" },
      { text: "The next step: a narrow pilot proposal", section: "NextStep" },
    ],
    speakerNotes:
      "Walk through the five agenda items at a steady pace. Signal that this is a focused session: roughly thirty minutes of content, then open discussion. Let them know that detailed appendix material is available for any topic they want to go deeper on, and that we will not try to cover everything today. The agenda is deliberately front-loaded with context before we get to the product, because the product only makes sense once we have agreed on the problem it solves. Confirm whether the audience has seen an earlier version of this deck; if so, acknowledge what has changed since that conversation.",
    presentingTimeSeconds: 30,
    appendixRefs: [],
  },

  // ---------------------------------------------------------------------------
  // Slide 3: Problem
  // ---------------------------------------------------------------------------
  {
    id: "slide-03",
    section: "Problem",
    title: "NFR work starts fragmented",
    subtitle: "Three systems, no single source of truth",
    layout: "split",
    bullets: ["Mail", "Meetings", "Documents", "GRC", "Data", "Actions"],
    emphasis: [
      "The first task is often assembly.",
      "Not risk judgment.",
    ],
    speakerNotes:
      "Set up the problem space clearly before showing any product. Risk professionals in OR, TPRM, and control assurance functions face the same structural issue: the work exists across multiple systems that were never designed to talk to each other. An Operational Risk Partner may need to open a GRC tool, pull a spreadsheet for committee prep, chase evidence over email, and then manually update a status tracker: all for a single RCSA cycle. The cost is not just time. When senior professionals spend their day on coordination tasks, the quality of risk judgment suffers. The six nodes on screen represent where the work actually lives: mail, meetings, documents, GRC, data platforms, and action trackers. Before any judgment can begin, someone must assemble this. Pause after the emphasis lines and ask whether this matches what they see in their own teams.",
    presentingTimeSeconds: 90,
    appendixRefs: [
      {
        appendixId: "app-01",
        label: "Product scope and release status",
        reason: "Grounds the problem in what the product actually addresses today",
      },
      {
        appendixId: "app-22",
        label: "Current limitations",
        reason: "Sets honest boundaries on what the product covers in its current state",
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Slide 4: Product
  // ---------------------------------------------------------------------------
  {
    id: "slide-04",
    section: "Product",
    title: "An operating system for NFR work",
    subtitle: "Three layers working together",
    layout: "three-layer",
    emphasis: [
      "Role layer: who you are shapes what you see",
      "Workflow layer: structured process, not ad hoc tasks",
      "AI layer: assistance where judgment is ready for it",
    ],
    speakerNotes:
      "Introduce the three-layer architecture in plain terms. The role layer means the system knows who you are: not just your login, but your function, your portfolio, your active cycles. The workflow layer means that work follows a defined structure: each stage has inputs, outputs, and a clear handoff point. The AI layer sits inside the workflow. It does not drive; it assists. It drafts, it summarises, it flags anomalies, but every substantive decision remains with the professional. Emphasise that NFR OS is not a replacement for existing GRC tooling in the short term; it is an orchestration layer above it. The integration story matters here: we connect to what the client already has, we do not ask them to rip and replace. This positions the product as low-disruption and high-value from day one.",
    presentingTimeSeconds: 90,
    appendixRefs: [
      {
        appendixId: "app-08",
        label: "Platform architecture overview",
        reason: "Supports the three-layer description with technical detail",
      },
      {
        appendixId: "app-07",
        label: "AI layer: model and infrastructure",
        reason: "Grounds the AI layer description in the actual model and setup",
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Slide 5: Daily experience
  // ---------------------------------------------------------------------------
  {
    id: "slide-05",
    section: "Daily",
    title: "The day begins with what needs you",
    subtitle: "Role-aware work hub on first login",
    layout: "split",
    bullets: [
      "Active cycles with stage and owner",
      "Items awaiting your decision",
      "AI-drafted outputs ready to review",
      "Escalations and overdue flags surfaced",
    ],
    speakerNotes:
      "Walk through what a typical morning looks like for an Operational Risk Partner using NFR OS. They open a single URL. The work hub shows them their portfolio in one view: which RCSA cycles are active, which are waiting on them, which have AI-drafted content ready for review. They do not need to check a spreadsheet, open the GRC tool, and then cross-reference an email chain. The system has done that aggregation for them. Click into one cycle and the context follows: previous assessments, relevant risk data, the draft output from the AI assistant, and a clear next action. This is the daily experience we are building toward. Note that the screenshot referenced here is illustrative of the current product state. Judgment stays with the professional; the hub reduces the administrative overhead that surrounds it.",
    presentingTimeSeconds: 100,
    appendixRefs: [
      {
        appendixId: "app-10",
        label: "AI routines: implementation status",
        reason: "Shows what the work hub features actually do and their current status",
      },
      {
        appendixId: "app-20",
        label: "Deployment profiles",
        reason: "Explains which deployment mode supports the demonstrated experience",
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Slide 6: Roles
  // ---------------------------------------------------------------------------
  {
    id: "slide-06",
    section: "Roles",
    title: "Built around the role",
    subtitle: "Two launch roles, designed from the job",
    layout: "two-column",
    roleColumns: [
      {
        role: "Operational Risk Partner",
        dailyFocus: "RCSA cycles, committee prep, event review",
        installedApp: "RCSA Cycle Assistant",
        humanJudgment: "Risk ratings, challenge decisions, committee submissions",
        screenshotAsset: "or-partner-workhub.png",
      },
      {
        role: "TPRM Manager",
        dailyFocus: "Supplier onboarding, periodic review, exit management",
        installedApp: "Third-Party Onboarding",
        humanJudgment: "Classification, evidence adequacy, approval decisions",
        screenshotAsset: "tprm-manager-workhub.png",
      },
    ],
    speakerNotes:
      "Explain the role-first design philosophy. Most risk platforms are built around a data model: risks, controls, events. The user adapts. NFR OS inverts this: the starting point is the role and what that person actually does in a working week. The OR Partner OS is calibrated to the rhythm of an RCSA cycle, a risk committee calendar, and an event review queue. The TPRM Manager OS is calibrated to a third-party lifecycle: onboarding, periodic assessment, continuous monitoring, exit. The two columns on screen show those distinct workspaces side by side. This justifies the architecture: we are not building one tool for all risk people; we are building role-specific operating environments that share a common platform. Judgment and professional skill remain central. Acknowledge that additional roles are on the roadmap and that the platform is designed to add roles incrementally.",
    presentingTimeSeconds: 90,
    appendixRefs: [
      {
        appendixId: "app-01",
        label: "Product scope and release status",
        reason: "Confirms which role operating systems are implemented versus planned",
      },
      {
        appendixId: "app-02",
        label: "Role App catalogue",
        reason: "Shows the full set of role apps available or planned for each role",
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Slide 7: Role Apps
  // ---------------------------------------------------------------------------
  {
    id: "slide-07",
    section: "RoleApps",
    title: "End-to-end work becomes a Role App",
    subtitle: "RCSA and TPRM as eight-stage structured workflows",
    layout: "process-rows",
    processRows: [
      {
        label: "RCSA Cycle Assistant",
        stages: [
          "Scope and Trigger",
          "Evidence Refresh",
          "Risk and Control Change",
          "First-line Input",
          "Challenge Workshop",
          "Rating and Appetite",
          "Actions and Approval",
          "Monitoring and Reassessment",
        ],
        currentStageIndex: 1,
        screenshotAsset: "rcsa-cycle-stage-2.png",
      },
      {
        label: "Third-Party Onboarding",
        stages: [
          "Request and Intake",
          "Classification and Criticality",
          "Tailored Due Diligence",
          "Evidence Review",
          "Specialist Reviews",
          "Contract and Conditions",
          "Decision and Onboarding",
          "Handover to Monitoring",
        ],
        currentStageIndex: 3,
        screenshotAsset: "tprm-onboarding-stage-4.png",
      },
    ],
    speakerNotes:
      "Walk through both process rows on screen. The RCSA Cycle Assistant takes a risk professional through eight stages from scoping the cycle to closing with a monitoring plan. At every stage, AI assistance is available: it can pull in prior assessment data, draft a risk narrative, flag where the proposed rating differs from the previous cycle, or prepare a challenge workshop agenda. But the professional reviews and approves at each stage. The system does not move to the next stage without a human decision. The TPRM process works the same way: eight stages from initial request through to handover to monitoring. At each stage, the Role App knows what data is needed, what analysis is relevant, and what the output should look like. These are not checklists. They are structured workflows where the AI does the groundwork and the professional applies judgment. This combination makes NFR OS faster and better quality, not just faster. Note: V2.1 materials incorrectly described both processes as six-stage. Both are eight-stage as defined in the product.",
    presentingTimeSeconds: 110,
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
  },

  // ---------------------------------------------------------------------------
  // Slide 8: Human-AI division
  // ---------------------------------------------------------------------------
  {
    id: "slide-08",
    section: "HumanAI",
    title: "AI operates work; humans own judgment",
    subtitle: "Clear division between automation and decision",
    layout: "two-column",
    emphasis: [
      "AI: aggregate, draft, flag, link",
      "Human: assess, challenge, approve, escalate",
    ],
    speakerNotes:
      "This slide addresses the question that every risk audience will have: where does the AI stop and the professional start? Be direct. The AI does the work that is deterministic or that benefits from scale and speed: pulling together data from multiple sources, generating a first draft of a risk narrative, flagging where a control rating has shifted, linking evidence documents to the relevant stage output. The professional does the work that requires judgment: deciding whether a risk rating is right given context the AI cannot see, challenging an assessment, signing off on an output, deciding whether to escalate. This division is not an aspiration. It is built into the workflow architecture. The system cannot submit an RCSA to committee; only an authorised professional can do that. We are not building autonomous risk management. We are building a capable assistant that makes the professional's judgment faster to apply and better supported with data. Emphasise this clearly; it is the trust-building message that unlocks willingness to adopt.",
    presentingTimeSeconds: 90,
    appendixRefs: [
      {
        appendixId: "app-06",
        label: "AI capability layer: what the AI does",
        reason: "Detailed breakdown of the four AI capability groups",
      },
      {
        appendixId: "app-07",
        label: "AI layer: model and infrastructure",
        reason: "Technical grounding for the AI capability claims",
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Slide 9: Outcomes
  // ---------------------------------------------------------------------------
  {
    id: "slide-09",
    section: "Improvement",
    title: "Better prepared risk work",
    subtitle: "Four outcomes from structured AI-assisted workflows",
    layout: "outcome-grid",
    outcomes: [
      {
        title: "Faster cycle completion",
        support: "Less coordination overhead",
        semanticType: "capacity",
      },
      {
        title: "Better evidence capture",
        support: "Structured at source, not reconstructed afterward",
        semanticType: "quality",
      },
      {
        title: "More consistent outputs",
        support: "AI-assisted templates reviewed by the professional",
        semanticType: "quality",
      },
      {
        title: "Clearer audit trail",
        support: "Every decision timestamped and attributed",
        semanticType: "control",
      },
    ],
    speakerNotes:
      "Move from product features to outcomes. Risk leaders care about four things: speed, quality, consistency, and audit readiness. NFR OS addresses all four. Cycle times fall because the professional spends less time on coordination and more time on assessment. Evidence quality improves because the workflow captures it at source rather than asking people to reconstruct it afterward. Output consistency improves because AI drafts to a defined template and the professional reviews rather than writing from scratch each time. Audit readiness improves because every decision, every draft reviewed, and every approval is timestamped and linked to the relevant workflow stage. These are not projections. They are the logical outcomes of moving from ad hoc to structured workflows. Where we have early data from internal use, reference it; otherwise frame these as design-level outcomes that the pilot is intended to verify. Illustrative regulatory context, not legal advice: structured evidence capture and audit trails support regulatory expectations across major NFR frameworks.",
    presentingTimeSeconds: 90,
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
  },

  // ---------------------------------------------------------------------------
  // Slide 10: Control
  // ---------------------------------------------------------------------------
  {
    id: "slide-10",
    section: "Control",
    title: "Control is built into the workflow",
    subtitle: "Evidence flows from work to audit record",
    layout: "flow",
    bullets: [
      "Evidence captured at each stage output",
      "Review and approval as workflow steps",
      "Escalation triggers built into thresholds",
      "Full history available without reconstruction",
    ],
    speakerNotes:
      "Address the control and governance dimension explicitly. Risk professionals and their second-line colleagues need to know that NFR OS does not create a control gap: it closes one. The current fragmented model means that evidence is spread across email, SharePoint, and GRC systems, and reconstructing an audit record means chasing multiple people for documents after the fact. In NFR OS, evidence is captured at the point of work. When a professional completes a workflow stage, they attach or confirm the relevant evidence and the system timestamps that linkage. When an approver signs off, that approval is recorded against the specific output. When a threshold is breached and an escalation is triggered, the system logs it. The audit record is a natural output of the workflow, not an additional reporting burden. This is the control message: structured workflows are inherently better controlled than ad hoc processes. Illustrative regulatory context, not legal advice: this design approach is consistent with expectations under major operational risk and third-party risk frameworks.",
    presentingTimeSeconds: 100,
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
      {
        appendixId: "app-11",
        label: "Evaluation and quality assurance",
        reason: "QA approach that supports the control quality claims",
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Slide 11: Service
  // ---------------------------------------------------------------------------
  {
    id: "slide-11",
    section: "Service",
    title: "A service that grows by Role App",
    subtitle: "Four tiers from design to managed operations",
    layout: "service-stack",
    serviceLayers: [
      {
        name: "Platform",
        detail: "Infrastructure, identity, AI model access, security operations",
        cadence: "Recurring monthly",
        semanticType: "platform",
      },
      {
        name: "Function packs",
        detail: "OR, TPRM, Control Assurance: role OS and base configuration",
        cadence: "Recurring per function enabled",
        semanticType: "function",
      },
      {
        name: "Role Apps",
        detail: "Process-specific workflow modules, built and released per app",
        cadence: "Per app delivered",
        semanticType: "role-app",
      },
      {
        name: "Managed Operations",
        detail: "Monitoring, model performance review, new app releases, user support",
        cadence: "Recurring monthly",
        semanticType: "managed-service",
      },
    ],
    speakerNotes:
      "Introduce the service model before talking about rollout. NFR OS is not a software licence. It is a managed service that includes the platform, the configuration work, and ongoing operations. The four-tier structure matters because it explains how the commercial model scales. The platform tier is fixed: identity, infrastructure, AI model access, security. The function packs are modular: OR, TPRM, and Control Assurance can be enabled independently. The role apps are the growth engine: each new role app adds a process-specific capability without replacing anything already running. Managed operations means the client does not carry the burden of keeping the platform current. We handle updates, model upgrades, and new app releases as part of the service. This is an important distinction from a traditional software implementation: the client buys a service level, not a point-in-time delivery. Acknowledge that the service model is designed to start narrow and expand; the next slide covers that rollout logic.",
    presentingTimeSeconds: 100,
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
  },

  // ---------------------------------------------------------------------------
  // Slide 12: Rollout
  // ---------------------------------------------------------------------------
  {
    id: "slide-12",
    section: "Rollout",
    title: "Start narrow. Prove it. Scale.",
    subtitle: "Three-step rollout from pilot to programme",
    layout: "rollout-steps",
    rolloutSteps: [
      {
        number: 1,
        title: "Pilot",
        actions: [
          "Deploy platform to client environment and verify end to end",
          "Onboard a small cohort of OR professionals",
          "Run one full RCSA cycle using the RCSA Cycle Assistant",
          "Collect outcome data throughout and prepare the outcome report",
        ],
        exitProof: "One complete RCSA cycle with verified cycle time and evidence quality data",
      },
      {
        number: 2,
        title: "Prove",
        actions: [
          "Review pilot outcome report with sponsor",
          "Scope and build one additional role app based on pilot findings",
          "Expand cohort and enable the second function pack if TPRM is selected",
          "Agree commercial structure for the programme phase",
        ],
        exitProof: "Second role app in production with cohort adoption meeting pilot benchmarks",
      },
      {
        number: 3,
        title: "Scale",
        actions: [
          "Enable full OR and TPRM function packs",
          "Expand role app catalogue per the agreed roadmap",
          "Activate managed operations for continuous delivery",
          "Run quarterly service reviews with client sponsor",
        ],
        exitProof: "NFR OS is the default working environment for all enrolled risk functions",
      },
    ],
    speakerNotes:
      "Present the rollout logic as a deliberate risk management choice, not just a commercial convenience. Starting narrow means the client takes a small, defined bet: one role, one process, a bounded time window. They get to see the product working in their environment with their data before committing to broader rollout. If the pilot demonstrates the outcomes we expect, the case for expansion is based on their own evidence, not our projections. Step two adds one additional role app based on what the pilot revealed: where the pain is greatest, where the process is most mature, where the user adoption is strongest. By step three, the client is running NFR OS as a programme with multiple role apps in production and managed operations covering ongoing delivery. This sequencing reduces client risk, allows us to learn and improve the product, and creates a natural expansion path. Be clear about what each step costs and what it delivers. Do not leave the commercial structure vague at this stage.",
    presentingTimeSeconds: 120,
    appendixRefs: [
      {
        appendixId: "app-13",
        label: "Service model: component detail",
        reason: "Shows the service layer that underpins each rollout step",
      },
      {
        appendixId: "app-15",
        label: "Pilot design: detailed specification",
        reason: "Full specification of the pilot scope, timeline, and activities",
      },
      {
        appendixId: "app-16",
        label: "Pilot success metrics",
        reason: "The five metrics used to verify outcomes at each step",
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Slide 13: Next step
  // ---------------------------------------------------------------------------
  {
    id: "slide-13",
    section: "NextStep",
    title: "Proposed next step",
    subtitle: "A narrow pilot to prove the case",
    layout: "next-step",
    nextStepBullets: [
      "Scope: OR Partner OS with RCSA Cycle Assistant only",
      "Cohort: 3 to 5 OR professionals in one business unit",
      "Output: cycle time, evidence quality, and user adoption metrics",
      "Decision: expand, adjust, or stop at the end of the pilot",
    ],
    nextStepOutcome: "A decision, not a commitment to scale",
    emphasis: ["A decision, not a commitment to scale"],
    speakerNotes:
      "Close with a clear and bounded ask. We are not asking for a programme commitment today. We are asking whether the audience is willing to run a pilot on a narrow and defined scope. The RCSA Cycle Assistant on the OR Partner OS is the right starting point: it is the most complete role app, it runs against a process every client has, and it produces measurable outputs that make the outcome report credible. The cohort of three to five professionals in one business unit is small enough to manage the change impact and large enough to generate meaningful data. At the end of the pilot, the client has a verified outcome report and a clear decision to make: expand the scope, adjust the approach, or stop. That decision point is the key message. We are offering a low-risk way to find out whether NFR OS delivers value in their environment. The emphasis line on screen, a decision, not a commitment to scale, is the framing we want them to leave with. End by asking who in the room should be involved in scoping the pilot.",
    presentingTimeSeconds: 90,
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
  },
];
