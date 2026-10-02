export interface CoreSlide {
  id: string;
  section: string;
  title: string;
  subtitle?: string;
  bodyCopy?: string;
  bullets?: string[];
  emphasis?: string[];
  layout:
    | "hero"
    | "split"
    | "three-layer"
    | "two-column"
    | "flow"
    | "list"
    | "next-step"
    | "outcome-grid"
    | "service-stack"
    | "process-rows"
    | "rollout-steps";
  speakerNotes: string;
  presentingTimeSeconds: number;
  footer?: string;
  callouts?: string[];
  agendaSection?: string;
}

export const CORE_SLIDES: CoreSlide[] = [
  {
    id: "slide-01",
    section: "Imagine",
    title: "NFR work built around people",
    subtitle: "What if the system came to you?",
    bodyCopy:
      "Risk professionals spend too much time finding work, not doing it. NFR OS changes that -- delivering the right work to the right role at the right moment.",
    emphasis: [
      "Work finds you",
      "Judgment stays with you",
      "Progress is visible",
    ],
    layout: "hero",
    footer: "NFR Operating System",
    speakerNotes:
      "Open by asking the audience to imagine a morning where they don't open five systems to find out what needs their attention. Instead, a single workspace greets them with the cases, reviews, and decisions that actually require their judgment today. That is the ambition behind NFR OS -- not a new compliance tool, but an operating layer that organises non-financial risk work around the role rather than around the database. The three lines on screen -- work finds you, judgment stays with you, progress is visible -- are the design principles we hold ourselves to. Everything I'll show today either demonstrates or directly supports one of those three promises. This slide sets the emotional register: we are solving a professional frustration that every risk practitioner in this room knows personally. Keep it brief; the product will do the talking.",
    presentingTimeSeconds: 45,
  },
  {
    id: "slide-02",
    section: "Agenda",
    title: "Five things we will cover",
    bullets: [
      "The problem -- fragmented NFR work",
      "The product -- an OS for risk roles",
      "The daily experience -- work that finds you",
      "The service -- how we deliver and scale",
      "The next step -- a narrow pilot proposal",
    ],
    layout: "list",
    speakerNotes:
      "Walk through the five agenda items at a steady pace. Signal that this is a focused session -- roughly fifty minutes of content, then open discussion. Let them know that detailed appendix material is available for any topic they want to go deeper on, and that we will not try to cover everything today. The agenda is deliberately front-loaded with context before we get to the product, because the product only makes sense once we have agreed on the problem it solves. Confirm whether the audience has seen an earlier version of this deck; if so, acknowledge what has changed since that conversation.",
    presentingTimeSeconds: 30,
  },
  {
    id: "slide-03",
    section: "Problem",
    title: "NFR work starts fragmented",
    subtitle: "Three systems, no single source of truth",
    bodyCopy:
      "Risk teams switch between case management, spreadsheets, and document stores to complete one review cycle. Context is lost at every handoff. Senior time goes to coordination, not judgment.",
    bullets: [
      "Average 4-6 systems touched per cycle",
      "Manual status chasing consumes senior hours",
      "Evidence scattered across email and SharePoint",
      "No unified view of role workload",
    ],
    layout: "split",
    agendaSection: "Problem",
    speakerNotes:
      "Set up the problem space clearly before showing any product. Risk professionals in OR, TPRM, and control assurance functions face the same structural issue: the work exists across multiple systems that were never designed to talk to each other. An Operational Risk Partner may need to open a GRC tool, pull a spreadsheet for committee prep, chase evidence over email, and then manually update a status tracker -- all for a single RCSA cycle. The cost is not just time. When senior professionals spend their day on coordination tasks, the quality of risk judgment suffers. This slide quantifies the pain in terms the audience can verify against their own experience. Pause after the four bullets and ask whether this matches what they see in their own teams.",
    presentingTimeSeconds: 90,
    callouts: [
      "Coordination cost is a risk quality problem",
    ],
  },
  {
    id: "slide-04",
    section: "Product",
    title: "An operating system for NFR work",
    subtitle: "Three layers working together",
    bodyCopy:
      "NFR OS is a platform layer that sits above existing systems. It organises work by role, routes tasks through structured workflows, and surfaces AI assistance at the moment of need -- without replacing the professional.",
    emphasis: [
      "Role layer -- who you are shapes what you see",
      "Workflow layer -- structured process, not ad hoc tasks",
      "AI layer -- assistance where judgment is ready for it",
    ],
    layout: "three-layer",
    agendaSection: "Product",
    speakerNotes:
      "Introduce the three-layer architecture in plain terms. The role layer means the system knows who you are -- not just your login, but your function, your portfolio, your active cycles. The workflow layer means that work follows a defined structure: each stage has inputs, outputs, and a clear handoff point. The AI layer sits inside the workflow -- it does not drive; it assists. It drafts, it summarises, it flags anomalies -- but every substantive decision remains with the professional. Emphasise that NFR OS is not a replacement for existing GRC tooling in the short term; it is an orchestration layer above it. The integration story matters here: we connect to what the client already has, we do not ask them to rip and replace. This positions the product as low-disruption and high-value from day one.",
    presentingTimeSeconds: 90,
    callouts: [
      "Orchestration above existing systems",
    ],
  },
  {
    id: "slide-05",
    section: "Daily",
    title: "The day begins with what needs you",
    subtitle: "Role-aware work hub on first login",
    bodyCopy:
      "On login, the work hub presents active cycles, pending decisions, and flagged items relevant to this role today. No searching, no status chasing. The professional opens a case and the context is already there.",
    bullets: [
      "Active cycles with stage and owner",
      "Items awaiting your decision",
      "AI-drafted outputs ready to review",
      "Escalations and overdue flags surfaced",
    ],
    layout: "split",
    agendaSection: "Product",
    speakerNotes:
      "Walk through what a typical morning looks like for an Operational Risk Partner using NFR OS. They open a single URL. The work hub shows them their portfolio in one view -- which RCSA cycles are active, which are waiting on them, which have AI-drafted content ready for review. They do not need to check a spreadsheet, open the GRC tool, and then cross-reference an email chain. The system has done that aggregation for them. Click into one cycle and the context follows: previous assessments, relevant risk data, the draft output from the AI assistant, and a clear next action. This is the daily experience we are building toward. Note that the screenshot referenced here is illustrative of the current product state -- the components shown are implemented and running locally. Judgment stays with the professional; the hub reduces the administrative overhead that surrounds it.",
    presentingTimeSeconds: 100,
    callouts: [
      "Reference product screenshot: Work Hub view",
    ],
  },
  {
    id: "slide-06",
    section: "Roles",
    title: "Built around the role",
    subtitle: "Two launch roles, designed from the job",
    bodyCopy:
      "NFR OS launches with two role operating systems: the Operational Risk Partner OS and the TPRM Manager OS. Each delivers a workspace, workflows, and AI tools calibrated to that role's actual daily work -- not a generic risk module adapted to the job title.",
    bullets: [
      "OR Partner: RCSA cycles, committee prep, event review",
      "TPRM Manager: onboarding, periodic review, exit management",
      "Each role has its own dashboard, queue, and AI toolset",
      "Role apps extend the OS as scope grows",
    ],
    layout: "two-column",
    agendaSection: "Roles",
    speakerNotes:
      "Explain the role-first design philosophy. Most risk platforms are built around a data model -- risks, controls, events -- and the user adapts. NFR OS inverts this: the starting point is the role and what that person actually does in a working week. The OR Partner OS is calibrated to the rhythm of an RCSA cycle, a risk committee calendar, and an event review queue. The TPRM Manager OS is calibrated to a third-party lifecycle -- onboarding, periodic assessment, continuous monitoring, exit. The two columns on screen show those distinct workspaces side by side. This is important because it justifies the architecture: we are not building one tool for all risk people; we are building role-specific operating environments that share a common platform. Judgment and professional skill remain central -- the OS structures the context in which that judgment is applied. Acknowledge that additional roles are on the roadmap and that the platform is designed to add roles incrementally.",
    presentingTimeSeconds: 90,
  },
  {
    id: "slide-07",
    section: "RoleApps",
    title: "End-to-end work becomes a Role App",
    subtitle: "RCSA and TPRM as six-stage structured workflows",
    bodyCopy:
      "Each major process is packaged as a Role App -- a six-stage workflow with defined inputs, AI assistance at each stage, and evidence captured throughout. The professional moves through stages; the system captures the record.",
    bullets: [
      "RCSA: Scope, Assess, Draft, Review, Challenge, Submit",
      "TPRM: Screen, Onboard, Assess, Monitor, Escalate, Exit",
      "AI drafts at each stage; professional decides",
      "Evidence linked to each stage output automatically",
    ],
    layout: "process-rows",
    agendaSection: "RoleApps",
    speakerNotes:
      "Walk through both process rows on screen. The RCSA Cycle Assistant takes a risk professional through six stages from scoping the cycle to submitting the output to committee. At every stage, AI assistance is available: it can pull in prior assessment data, draft a risk narrative, flag where the proposed rating differs from the previous cycle, or prepare a committee summary. But the professional reviews and approves at each stage -- the system does not move to the next stage without a human decision. The TPRM process works the same way: six stages from initial screening through to exit management. At each stage, the Role App knows what data is needed, what analysis is relevant, and what the output should look like. The important message is that these are not just checklists. They are structured workflows where the AI does the groundwork and the professional applies judgment. This combination is what makes NFR OS faster and better quality, not just faster.",
    presentingTimeSeconds: 110,
  },
  {
    id: "slide-08",
    section: "HumanAI",
    title: "AI operates work; humans own judgment",
    subtitle: "Clear division between automation and decision",
    bodyCopy:
      "AI handles data aggregation, draft generation, anomaly flagging, and evidence linking. The professional handles risk assessment, challenge, approval, and escalation. This boundary is explicit in the workflow design.",
    emphasis: [
      "AI: aggregate, draft, flag, link",
      "Human: assess, challenge, approve, escalate",
    ],
    layout: "two-column",
    agendaSection: "HumanAI",
    speakerNotes:
      "This slide addresses the question that every risk audience will have: where does the AI stop and the professional start? Be direct. The AI does the work that is deterministic or that benefits from scale and speed: pulling together data from multiple sources, generating a first draft of a risk narrative, flagging where a control rating has shifted, linking evidence documents to the relevant stage output. The professional does the work that requires judgment: deciding whether a risk rating is right given context the AI cannot see, challenging an assessment, signing off on an output, deciding whether to escalate. This division is not an aspiration -- it is built into the workflow architecture. The system cannot submit an RCSA to committee; only an authorised professional can do that. We are not building autonomous risk management. We are building a capable assistant that makes the professional's judgment faster to apply and better supported with data. Emphasise this clearly; it is the trust-building message that unlocks willingness to adopt.",
    presentingTimeSeconds: 90,
  },
  {
    id: "slide-09",
    section: "Improvement",
    title: "Better prepared risk work",
    subtitle: "Four outcomes from structured AI-assisted workflows",
    bodyCopy:
      "Structured workflows with AI assistance produce measurable improvements across four dimensions of risk work quality.",
    bullets: [
      "Faster cycle completion -- less coordination overhead",
      "Better evidence capture -- structured at source",
      "More consistent outputs -- AI-enforced templates",
      "Clearer audit trail -- every decision timestamped",
    ],
    layout: "outcome-grid",
    agendaSection: "Improvement",
    speakerNotes:
      "Move from product features to outcomes. Risk leaders care about four things: speed, quality, consistency, and audit readiness. NFR OS addresses all four. Cycle times fall because the professional spends less time on coordination and more time on assessment. Evidence quality improves because the workflow captures it at source rather than asking people to reconstruct it afterward. Output consistency improves because AI drafts to a defined template and the professional reviews rather than writing from scratch each time. Audit readiness improves because every decision, every draft reviewed, every approval is timestamped and linked to the relevant workflow stage. These are not projections -- they are the logical outcomes of moving from ad hoc to structured workflows. Where we have early data from internal use, reference it; otherwise frame these as design-level outcomes that the pilot is intended to verify. Illustrative regulatory context, not legal advice: structured evidence capture and audit trails support regulatory expectations across major NFR frameworks.",
    presentingTimeSeconds: 90,
  },
  {
    id: "slide-10",
    section: "Control",
    title: "Control is built into the workflow",
    subtitle: "Evidence flows from work to audit record",
    bodyCopy:
      "Every workflow stage produces a structured output linked to evidence. The audit trail is a by-product of doing the work, not a separate documentation task. Review, approval, and escalation are checkpoints, not exceptions.",
    bullets: [
      "Evidence captured at each stage output",
      "Review and approval as workflow steps",
      "Escalation triggers built into thresholds",
      "Full history available without reconstruction",
    ],
    layout: "flow",
    agendaSection: "Control",
    speakerNotes:
      "Address the control and governance dimension explicitly. Risk professionals and their second-line colleagues need to know that NFR OS does not create a control gap -- it closes one. The current fragmented model means that evidence is spread across email, SharePoint, and GRC systems, and reconstructing an audit record means chasing multiple people for documents after the fact. In NFR OS, evidence is captured at the point of work. When a professional completes a workflow stage, they attach or confirm the relevant evidence and the system timestamps that linkage. When an approver signs off, that approval is recorded against the specific output. When a threshold is breached and an escalation is triggered, the system logs it. The audit record is a natural output of the workflow, not an additional reporting burden. This is the control message: structured workflows are inherently better controlled than ad hoc processes. Illustrative regulatory context, not legal advice: this design approach is consistent with expectations under major operational risk and third-party risk frameworks.",
    presentingTimeSeconds: 100,
  },
  {
    id: "slide-11",
    section: "Service",
    title: "A service that grows by Role App",
    subtitle: "Four tiers from design to managed operations",
    bodyCopy:
      "NFR OS is delivered as a managed service with four layers: platform, function packs, role apps, and managed operations. New role apps extend the scope without disrupting what is already running. The service model is designed to grow with the client's appetite for AI-assisted risk work.",
    bullets: [
      "Platform: infrastructure, identity, AI model access",
      "Function packs: OR, TPRM, Control Assurance",
      "Role Apps: process-specific workflow modules",
      "Managed Ops: monitoring, updates, new app delivery",
    ],
    layout: "service-stack",
    agendaSection: "Service",
    speakerNotes:
      "Introduce the service model before talking about rollout. NFR OS is not a software license -- it is a managed service that includes the platform, the configuration work, and ongoing operations. The four-tier structure matters because it explains how the commercial model scales. The platform tier is fixed: identity, infrastructure, AI model access, security. The function packs are modular: OR, TPRM, and Control Assurance can be enabled independently. The role apps are the growth engine: each new role app adds a process-specific capability without replacing anything already running. Managed operations means the client does not carry the burden of keeping the platform current -- we handle updates, model upgrades, and new app releases as part of the service. This is an important distinction from a traditional software implementation: the client buys a service level, not a point-in-time delivery. Acknowledge that the service model is designed to start narrow and expand -- the next slide covers that rollout logic.",
    presentingTimeSeconds: 100,
  },
  {
    id: "slide-12",
    section: "Rollout",
    title: "Start narrow. Prove it. Scale.",
    subtitle: "Three-step rollout from pilot to programme",
    bodyCopy:
      "The rollout follows a build-measure-learn pattern. Step one is a narrow pilot on one role and one process. Step two validates outcomes and expands the role app catalogue. Step three scales to programme with additional functions and managed ops.",
    bullets: [
      "Step 1: Pilot -- one role, one process, 8-12 weeks",
      "Step 2: Prove -- measure outcomes, add one role app",
      "Step 3: Scale -- full function pack, managed service",
    ],
    layout: "rollout-steps",
    agendaSection: "Rollout",
    speakerNotes:
      "Present the rollout logic as a deliberate risk management choice, not just a commercial convenience. Starting narrow means the client takes a small, defined bet: one role, one process, eight to twelve weeks. They get to see the product working in their environment with their data before committing to broader rollout. If the pilot demonstrates the outcomes we expect -- faster cycle times, better evidence capture, cleaner audit trail -- the case for expansion is based on their own evidence, not our projections. Step two adds one additional role app based on what the pilot revealed: where the pain is greatest, where the process is most mature, where the user adoption is strongest. By step three, the client is running NFR OS as a programme with multiple role apps in production and managed operations covering ongoing delivery. This sequencing reduces client risk, allows us to learn and improve the product, and creates a natural expansion path. Be clear about what each step costs and what it delivers -- do not leave the commercial structure vague at this stage.",
    presentingTimeSeconds: 120,
  },
  {
    id: "slide-13",
    section: "NextStep",
    title: "Proposed next step",
    subtitle: "A narrow pilot to prove the case",
    bodyCopy:
      "We are proposing a defined pilot: OR Partner OS with the RCSA Cycle Assistant, running for ten weeks with a small cohort of risk professionals. The pilot produces a verified outcome report that informs the decision to scale.",
    bullets: [
      "Scope: OR Partner OS, RCSA Cycle Assistant only",
      "Cohort: 3-5 OR professionals, one business unit",
      "Duration: 10 weeks with weekly check-ins",
      "Output: cycle time, evidence quality, user adoption metrics",
      "Decision point: expand, adjust, or stop after pilot",
    ],
    emphasis: [
      "A decision, not a commitment to scale",
    ],
    layout: "next-step",
    agendaSection: "NextStep",
    speakerNotes:
      "Close with a clear and bounded ask. We are not asking for a programme commitment today. We are asking whether the audience is willing to run a ten-week pilot on a narrow and defined scope. The RCSA Cycle Assistant on the OR Partner OS is the right starting point: it is the most complete role app, it runs against a process every client has, and it produces measurable outputs that make the outcome report credible. The cohort of three to five professionals in one business unit is small enough to manage the change impact and large enough to generate meaningful data. At week ten, the client has a verified outcome report and a clear decision to make: expand the scope, adjust the approach, or stop. That decision point is the key message. We are offering a low-risk way to find out whether NFR OS delivers value in their environment. The emphasis line on screen -- a decision, not a commitment to scale -- is the framing we want them to leave with. End by asking who in the room should be involved in scoping the pilot.",
    presentingTimeSeconds: 90,
  },
];
