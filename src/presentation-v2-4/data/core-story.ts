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
    kind: "cover",
    section: "Opening",
    title: "AI can return NFR capacity to judgment",
    subtitle: "A role-based operating system connects daily work, complete processes and governed execution",
    insight: "The objective is not more AI activity. It is more professional capacity applied to material risk.",
    exhibit: {
      type: "cover",
      data: {
        kicker: "NFR Operating System",
        preparedBy: "Thomas Zijlstra",
        dateLabel: "September 2026",
      },
    },
    evidenceBasis: [
      { type: "proposal", label: "Accenture NFR OS engagement scope" },
    ],
    appendixRefs: [],
    speakerNotes:
      "Open with the thesis, not with a product demo. Risk professionals spend a material portion of their week on coordination work: finding evidence, chasing status, reconciling inputs across systems. The operating system exists to redirect that effort back to the judgment the role was hired to make. The visual shows many fragmented signals converging into one operating layer, and one prepared decision handed to a person. This is the design principle the whole deck proves. Keep the cover brief and move to the agenda. Before we look at the product, here is how the discussion will run.",
    presentingTimeSeconds: 30,
    footer: "Illustrative regulatory context, not legal advice",
  },

  // ---------------------------------------------------------------------------
  // Slide 2:Situation: agenda
  // ---------------------------------------------------------------------------
  {
    id: "slide-02",
    kind: "agenda",
    section: "Opening",
    title: "Agenda",
    subtitle: "Five questions take us from the case for change to the path to scale",
    exhibit: {
      type: "story-path",
      data: {
        chapters: [
          { number: 1, audienceQuestion: "Why does this matter?", sectionLabel: "Why change", topics: ["Fragmented work", "The burden between systems"] },
          { number: 2, audienceQuestion: "What is the proposition?", sectionLabel: "What NFROS is", topics: ["One operating layer", "The prepared workday"] },
          { number: 3, audienceQuestion: "What changes for the professional?", sectionLabel: "How work changes", topics: ["A shared core per role", "Role Apps"] },
          { number: 4, audienceQuestion: "Why can the bank trust it?", sectionLabel: "How it is controlled", topics: ["The authority line", "The evidence thread", "The value case"] },
          { number: 5, audienceQuestion: "What should we do next?", sectionLabel: "How to start", topics: ["The service model", "A two-role start"] },
        ],
        activeChapterNumber: 1,
      },
    },
    evidenceBasis: [
      { type: "proposal", label: "Accenture NFR OS engagement scope" },
    ],
    appendixRefs: [],
    speakerNotes:
      "Walk the audience through the five chapters before entering them. Signal this is a focused session: thirty to forty minutes of content, then open discussion. Appendix material is available for any topic the audience wants to go deeper on. The story is front-loaded: we establish the problem before introducing the product, because the product only lands once the problem is agreed. Confirm whether they have seen an earlier version of this material and acknowledge what has changed. So let us start where the problem starts: where capacity is lost today.",
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
    insight: "Each system may be fit for purpose. The manual burden sits between them.",
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
        appendixId: "app-27",
        label: "Integration architecture",
        reason: "How the existing systems of record connect without replacement",
      },
    ],
    speakerNotes:
      "Establish the problem before any product. Risk professionals in OR, TPRM, and control assurance face the same structural constraint: the work exists across systems that were never designed to connect. An Operational Risk Partner may open a GRC tool, pull a spreadsheet for committee prep, chase evidence by email, and update a status tracker manually for a single RCSA cycle. The animation shows work arriving from six systems, looping through finding, reconciling, coordinating and re-entering, with only a trickle reaching the decision; the bar underneath shows where the team's capacity goes. Each system may be correct in isolation; the friction lives between them. Pause after the visual and ask whether this reflects what they see in their own teams. The next question is why this fragmentation matters beyond lost time.",
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
        appendixId: "app-23",
        label: "Shared core capability map",
        reason: "Which shared capabilities remove each point of friction",
      },
      {
        appendixId: "app-10",
        label: "AI routines and their status",
        reason: "What the routines are defined to do and what is not yet scheduled",
      },
    ],
    speakerNotes:
      "The cost of fragmentation appears between systems, not inside any one of them. Each system in the bank may be fit for purpose. The problem is the connection work the professional carries between them. The four friction bands: search, reconcile, coordinate, and document, are the recurring activities that consume professional capacity before judgment begins. The causal chain shows how those activities create downstream consequences: delayed decisions, inconsistent outputs, and a process that resets from scratch each cycle. Highlight the feedback loop: stale actions return to fragmented inputs. The cycle repeats. NFROS breaks that loop by replacing the connection work with structured workflow. If the problem sits between systems, the answer has to be a layer that works across them.",
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
        label: "Platform architecture",
        reason: "Technical grounding for the engagement layer",
      },
      {
        appendixId: "app-27",
        label: "Integration architecture",
        reason: "Connector patterns for the systems of record",
      },
      {
        appendixId: "app-20",
        label: "Deployment profiles",
        reason: "Where the layer runs and how AI data is handled",
      },
    ],
    speakerNotes:
      "NFROS is the engagement and execution layer around the platforms the bank already trusts. The systems of record stay. The operating system adds a structured layer on top: role-aware daily work, governed process execution through Role Apps, and a control fabric that links identity, authority, approval, audit, and evaluation into every step. The slide shows it as an operating system: it boots by connecting to the existing platforms, starting the control kernel and opening the role workspaces. Operational Risk and TPRM run today; Control Assurance is shown as a demo role on the same core. Then one work item travels from source signal through prepared work, a human decision and approved execution to an external receipt, without the professional reconnecting manually to another system. Reinforce the non-replacement message: this is an engagement layer, not a replacement for GRC tooling. An architecture only matters if it changes the working day, so let us look at the day itself.",
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
        assetId: "or-home",
        focusAnnotations: [
          { label: "Now", meaning: "Your decision, ready to record" },
          { label: "AI Partner", meaning: "Pack and breach annex already read" },
          { label: "Next", meaning: "Queued for later, out of the way" },
          { label: "Your day", meaning: "Meeting brief and actions in one place" },
          { label: "Done", meaning: "Routine work handled automatically" },
        ],
        daylineEvents: [],
      },
    },
    evidenceBasis: [
      { type: "product", label: "Operational Risk Partner Home, synthetic data" },
    ],
    appendixRefs: [
      {
        appendixId: "app-23",
        label: "Shared core capability map",
        reason: "What the Role Home and work hub do today, with gaps labelled",
      },
      {
        appendixId: "app-06",
        label: "AI Partner",
        reason: "What the AI Partner prepares and how its requests pass the gate",
      },
      {
        appendixId: "app-10",
        label: "AI routines and their status",
        reason: "Which routine coordination is defined and which is not yet scheduled",
      },
    ],
    speakerNotes:
      "Show the product. This is the Operational Risk Partner home, captured from the product with a synthetic institution and data. The day opens with one line: 3 need your judgment. Needs you now holds the decision that is ready: three indicator explanations or one causal investigation for indicator KRI-PAY-007, with the evidence one click away and Record the decision as the action. Directly below, the AI Partner shows what it prepared: it has already read the September indicator pack and the breach annex. Next lines up the following questions, out of the way until this decision is made. Your day keeps the next meeting, the open actions and the inbox in one strip, so the morning decision brief and the follow-up actions sit beside the decision rather than in another tool. At the bottom, Watching and Handled automatically stay collapsed: routine work that is already handled, one click away when the professional wants to check it. Every judgment remains with the professional; the home removes the coordination around it. A fair question follows: can the same environment serve professions that think differently?",
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
    insight: "Reuse lowers the platform cost. Role-specific design protects the professional method.",
    exhibit: {
      type: "role-architecture",
      data: {
        sharedCore: ["Decisions", "Evidence", "Meetings", "Actions", "Inbox", "AI Partner", "Audit"],
        leftRole: {
          title: "Operational Risk Partner",
          subtitle: "RCSA and changing risk",
          judgments: ["Challenge workshop", "Residual rating", "Risk appetite"],
          assetId: "or-home",
        },
        rightRole: {
          title: "Third-Party Risk Manager",
          subtitle: "Supplier lifecycle and exposure",
          judgments: ["Criticality", "Evidence sufficiency", "Contract conditions"],
          assetId: "tprm-home",
        },
      },
    },
    evidenceBasis: [
      { type: "product", label: "Operational Risk Partner and Third-Party Risk Manager homes, synthetic data" },
      { type: "repository", label: "Role App catalogue, current release state" },
    ],
    appendixRefs: [
      {
        appendixId: "app-01",
        label: "Product scope and release status",
        reason: "Which role operating systems run today and which are demo or planned",
      },
      {
        appendixId: "app-23",
        label: "Shared core capability map",
        reason: "The common services every role reuses",
      },
    ],
    speakerNotes:
      "The platform is reused; the professional method remains role-specific. Both screens are real captures of the two role homes, running locally on synthetic data. At the top, the Operational Risk Partner sees the one item that needs a judgment now: three indicator explanations or one causal investigation for indicator KRI-PAY-007. At the bottom, the Third-Party Risk Manager sees the RepairDesk recovery time gap for supplier TP-0042. The screen is the same; the work is not. Between them sits the shared core both roles use today: decisions, evidence, meetings, actions, inbox, the AI Partner and the audit trail. Evidence and meetings are only partly built, as the capability map in the appendix shows. The method stays with each role: the Operational Risk Partner runs the challenge workshop, sets the residual rating and tests it against risk appetite in the RCSA cycle; the Third-Party Risk Manager sets criticality, judges evidence sufficiency and sets contract conditions during onboarding. Four further roles, Control Assurance, Incident and Resilience, Regulatory Change and NFR Portfolio Lead, exist only as a demo or planned page. They do not run today. The shared core is designed so that each new role reuses these services rather than rebuilding them. A shared core is only useful if it can run complete processes, which is what Role Apps do.",
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
    insight: "The process remembers where work stopped and resumes with the same evidence, decisions, and authority.",
    exhibit: {
      type: "role-app-swimlane",
      data: {
        lanes: [
          {
            title: "RCSA Cycle Assistant",
            stages: [
              { label: "Scope and Trigger" },
              { label: "Evidence Refresh", isCurrentStage: true },
              { label: "Risk and Control Change" },
              { label: "First-line Input" },
              { label: "Challenge Workshop" },
              { label: "Rating and Appetite" },
              { label: "Actions and Approval" },
              { label: "Monitoring and Reassessment" },
            ],
            assetId: "rcsa-process-stage",
          },
          {
            title: "Third-Party Onboarding",
            stages: [
              { label: "Request and Intake" },
              { label: "Classification and Criticality" },
              { label: "Tailored Due Diligence" },
              { label: "Evidence Review", isCurrentStage: true },
              { label: "Specialist Reviews" },
              { label: "Contract and Conditions" },
              { label: "Decision and Onboarding" },
              { label: "Handover to Monitoring" },
            ],
            assetId: "tprm-onboarding-stage",
          },
        ],
      },
    },
    evidenceBasis: [
      { type: "product", label: "Third-Party Onboarding stage 4 page, synthetic data" },
      { type: "repository", label: "Role App registry and stage definitions, src/role-apps" },
    ],
    appendixRefs: [
      {
        appendixId: "app-03",
        label: "RCSA Cycle Assistant stages",
        reason: "The eight RCSA stages and the decision that closes each",
      },
      {
        appendixId: "app-04",
        label: "Third-Party Onboarding stages",
        reason: "The eight onboarding stages and where the demo case sits",
      },
      {
        appendixId: "app-02",
        label: "Role App library",
        reason: "The seven apps in the library and which can be started today",
      },
    ],
    speakerNotes:
      "A Role App is a persistent process, not a prompt or an isolated task. The rail shows the eight stages of Third-Party Onboarding as the product defines them, and the three lanes show what the AI prepares, what the professional decides and what is recorded at each stage. The capture is the real stage page for stage 4, Evidence Review, in the synthetic Veridian Document Systems onboarding. Read it in the order of the numbered lanes. First, AI prepared: four of seven evidence items received and assessed, two outstanding, and a recommendation. Second, your responsibility: pass the stage gate with outstanding items or hold the file. Third, further down the same page after the evidence status list, the decision form, where the professional records the evidence sufficiency decision with a note. Stages 1 to 3 are completed in the demo run and stages 5 to 8 stay locked until stage 4 is complete, so the process picks up exactly where work stopped. The RCSA Cycle Assistant runs the same stage page pattern; its demo run waits at stage 2, Evidence Refresh. Be precise about control: completing a stage is a decision a person records; it does not pass through the authority gate, which applies to actions the AI requests. The library holds seven apps. Two are installed and can be started today, RCSA Cycle Assistant and Third-Party Onboarding; the five preview apps are registry definitions that cannot be started yet. Once AI runs parts of a process, the natural question is where automation stops.",
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
    insight: "A stronger model does not receive broader authority unless the bank explicitly changes the policy.",
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
        appendixId: "app-09",
        label: "Authority classes and approval checks",
        reason: "The six authority classes and the checks behind each approval",
      },
      {
        appendixId: "app-25",
        label: "Identity and entitlements",
        reason: "How a named person is tied to each decision, with current gaps",
      },
    ],
    speakerNotes:
      "Greater model capability does not automatically expand decision authority. The matrix shows where the boundary sits. Routine, repeatable work with low judgment and materiality can be executed by the AI within policy. Work that requires professional interpretation stops for review: the AI prepares, the professional decides. Material decisions and professional judgments never cross the boundary automatically. This is not an aspiration. Every governed action the AI requests passes an authority gate that checks its class, the role's scope and, for material changes, a single-use approval bound to that exact change. The AI cannot submit an RCSA to committee; only a named person can. Be open about what is not yet enforced, such as segregation of duties and bank sign-in: the appendix lists both. A boundary is only credible if the bank can prove it is enforced, and that is the next slide.",
    presentingTimeSeconds: 90,
  },

  // ---------------------------------------------------------------------------
  // Slide 10: Control: trust by design
  // ---------------------------------------------------------------------------
  {
    id: "slide-10",
    section: "Control",
    title: "Trust is engineered into every material step",
    subtitle: "Evidence, permissions, approvals, execution receipts and audit remain linked by design",
    insight: "The audit trail is created by the workflow, not reconstructed after the event.",
    exhibit: {
      type: "evidence-thread",
      data: {
        steps: [
          { label: "Source evidence", hasProductProof: true, assetId: "evidence-review" },
          { label: "AI preparation", hasProductProof: true, assetId: "evidence-review" },
          { label: "Human decision", hasProductProof: true, assetId: "decision-approval" },
          { label: "Approval", hasProductProof: true, assetId: "decision-approval" },
          { label: "Execution", hasProductProof: false },
          { label: "Receipt", hasProductProof: false },
          { label: "Audit", hasProductProof: false },
        ],
        // One factual line per step, shown under the step name
        proofAnnotations: [
          { stepIndex: 0, label: "Each evidence item has an ID and a recorded status" },
          { stepIndex: 1, label: "Condition and missing items flagged before the decision" },
          { stepIndex: 2, label: "The user chooses and owns the rationale" },
          { stepIndex: 3, label: "Approval required, by a named approver" },
          { stepIndex: 4, label: "Each change passes the authority gate with its own single-use approval" },
          { stepIndex: 5, label: "Receipt lines state what changed, linked to the decision and approval" },
          { stepIndex: 6, label: "The decision and each change are written as append-only audit events" },
        ],
      },
    },
    evidenceBasis: [
      { type: "product", label: "Product screens: evidence status and decision confirm step; synthetic data" },
      { type: "repository", label: "Decision execution, receipt lines and audit events, src/scenario/engine/decide.ts" },
    ],
    appendixRefs: [
      {
        appendixId: "app-24",
        label: "Evidence and provenance",
        reason: "How evidence is linked to its source and to the decision",
      },
      {
        appendixId: "app-26",
        label: "Audit, operations and recovery",
        reason: "The audit trail, its current coverage and recovery",
      },
      {
        appendixId: "app-29",
        label: "EU and Swiss jurisdiction lanes",
        reason: "Illustrative DACH regulatory context, not legal advice",
      },
    ],
    speakerNotes:
      "Trust is part of the workflow, not an explanation added after the fact. The thread follows governed work from source evidence to audit, and the two screens are real product captures from the synthetic demo day. On the left is the evidence status for a new supplier in third-party onboarding: every item carries an ID and a status, the AI assessment flags the one item accepted with a condition, and the missing penetration test and continuity plan stay in view instead of dropping out of the file. On the right is an operational risk decision at its final step, Confirm: approval is required, the approver is named, the autonomy level is shown, and Confirm and execute stays unavailable until the user confirms the rationale is their own. Confirming records one approval per change, and each change then passes the authority gate. A receipt line states what changed and links to the decision and the approval, and every governed action writes an append-only audit event naming the acting user and role. Refused actions are recorded too, with a denial code. The seeded day has no executed decision, so there is no receipt to capture; I show the receipt live in the demo after an approved execution. The approver is named, but preparer and approver are not yet separated; the appendix says so. The audit record is built during the work, so nobody has to reconstruct it. With control established, we can ask what the controlled product should actually improve.",
    presentingTimeSeconds: 100,
    footer: "Illustrative regulatory context, not legal advice",
  },

  // ---------------------------------------------------------------------------
  // Slide 11: Value: value logic
  // ---------------------------------------------------------------------------
  {
    id: "slide-11",
    section: "Value",
    title: "The value case spans capacity, quality, control and continuity",
    subtitle: "Benefits should be measured against the bank's own baseline, not generic benchmarks",
    insight: "The pilot succeeds only if the working process improves and the control environment remains intact.",
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
        label: "Pilot metrics and baselines",
        reason: "How each outcome is measured against the bank's own baseline",
      },
      {
        appendixId: "app-11",
        label: "AI quality and evaluations",
        reason: "How AI output quality is evaluated before and during the pilot",
      },
    ],
    speakerNotes:
      "The pilot must prove better work, not simply more AI activity. The value tree shows the four dimensions where the operating system is expected to create value, but each dimension requires the bank to establish its own baseline before any outcome can be verified. Capacity: less time on search, coordination, and re-entry. Quality: more complete evidence, more consistent outputs. Control: visible approval chains, traceable execution, complete audit records. Continuity: processes that persist between cycles, actions that stay owned, reassessment triggered by events rather than by calendar. The measurement rail at the bottom shows the three points where value is assessed. No claim is made about client savings; those emerge from the baseline comparison. If the value case holds, the next question is how the model scales economically.",
    presentingTimeSeconds: 90,
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
        label: "Service tiers and cadence",
        reason: "What the managed service runs, monitors and improves",
      },
      {
        appendixId: "app-28",
        label: "App Factory",
        reason: "How new Role Apps are assembled from existing stages",
      },
      {
        appendixId: "app-14",
        label: "Commercial packaging",
        reason: "How the platform, packs and apps are packaged",
      },
    ],
    speakerNotes:
      "Reusable platform controls create the economics; Role Apps create the expansion path. The platform layer is fixed and shared: identity, infrastructure, AI model access, security. Function Packs enable each risk discipline: OR, TPRM, and Control Assurance. Role Apps are the growth mechanism: each new app adds a governed process without changing the platform or any previously deployed app. The blocks show the economics with the real catalogue: a Function Pack is one risk discipline, and its Role Apps are assembled from its stages. The RCSA Cycle Assistant, which is installed, built eight stages. Event-Driven Reassessment, in preview, adds two new stages and reuses one. Rapid Assessment, in preview, reuses four existing stages and needs none new. Only the RCSA Cycle Assistant and Third-Party Onboarding are installed today; describe the others as preview. That leaves the practical question of how the bank should start.",
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
    insight: "The first commitment is a bounded design-partner case, not a full platform rollout.",
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
        label: "Design-partner scope",
        reason: "Scope, roles and timeline for the first engagement",
      },
      {
        appendixId: "app-16",
        label: "Pilot metrics and baselines",
        reason: "The measures behind each gate",
      },
      {
        appendixId: "app-22",
        label: "Current limitations",
        reason: "What the product does not yet do, stated plainly",
      },
    ],
    speakerNotes:
      "The next decision is which two working journeys the bank should prove first. We are not asking for a programme commitment today. We are asking whether the audience is willing to run a gated design-partner engagement on a defined scope. Step one establishes the baseline: one business area, current work map, authority model, and the measures we will use to verify outcomes. The gate question is straightforward: is the process and data ready? Step two proves the two role operating systems: OR and TPRM, read-only first, then approval-gated execution, with measured outcomes throughout. Step three scales by Role App: add processes and functions based on what the pilot verified, increase autonomy only where proven. Each gate is a decision point, not an automatic progression. End by asking who in the room should be involved in scoping step one. Then open the floor and agree the first step together.",
    presentingTimeSeconds: 90,
  },
];

// ---------------------------------------------------------------------------
// Closing slide: plays after the thirteen-slide core and is not counted in it
// ---------------------------------------------------------------------------
export const CLOSING_SLIDE_V24: CoreSlide24 = {
    id: "closing",
    kind: "closing",
    section: "Close",
    title: "Questions and discussion",
    subtitle: "Three questions to shape the next step together",
    exhibit: {
      type: "closing",
      data: {
        prompts: [
          "Which two roles should we start with?",
          "What evidence would your risk committee need to see?",
          "Where must a named person always stay in the loop?",
        ],
        decision: "Choose the first RCSA and TPRM journeys",
        presenter: "Thomas Zijlstra",
      },
    },
    evidenceBasis: [
      { type: "proposal", label: "Accenture design-partner engagement structure" },
    ],
    appendixRefs: [],
    speakerNotes:
      "Open the floor. Use the three prompts if the room is quiet: they lead straight to the decision on the previous slide. Capture who should be involved in scoping the first two journeys and agree the follow-up date before closing.",
    presentingTimeSeconds: 300,
};

// The order the deck plays in: the thirteen core slides, then the closing slide
export const PRESENTATION_SLIDES_V24: CoreSlide24[] = [...CORE_SLIDES_V24, CLOSING_SLIDE_V24];
