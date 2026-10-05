/**
 * V2.4 appendix slide data.
 *
 * Twenty-two reference slides in five index groups: Product, Processes,
 * Controls, Technology, and Service and rollout. Every slide has an action
 * title, an evidence subtitle, an index group, an implementation status, one
 * primary visual, at least one evidence basis and short speaker notes.
 *
 * Status levels:
 *   implemented  runs locally on synthetic data
 *   partial      some of the slide runs today, the rest is labelled
 *   demo         shown in the product as a shell or seeded illustration
 *   planned      design or proposal only
 *   reference    context material, for example the jurisdiction model
 *
 * Every fact is grounded in this repository: role-app registry and
 * definitions, identity, security, audit, integration and product docs, and
 * the evaluation report. The handoff in docs/handoffs/presentation-v2-4-appendix.md
 * lists the source for each slide and the claims removed from earlier drafts.
 *
 * Synthetic institution and data. No client outcome, saving, benchmark,
 * certification, production readiness or compliance claim is made.
 * DORA and EBA references apply to the German and Austrian entities only; the
 * Swiss entity is FINMA supervised. Illustrative regulatory context, not legal advice.
 *
 * Copy rules: no em dash, no en dash, no double hyphen as punctuation.
 */

import type { AppendixSlide24 } from "./types";

const REGULATORY_LABEL = "Illustrative regulatory context, not legal advice";

export const APPENDIX_SLIDES_V24: AppendixSlide24[] = [
  // ===========================================================================
  // Product
  // ===========================================================================
  {
    id: "app-01",
    section: "Product",
    group: "Product",
    status: {
      level: "partial",
      note: "Two roles and two Role Apps run locally on synthetic data; four roles show a demo or planned page only",
    },
    title: "Two role operating systems run today, while four roles remain demo or planned",
    subtitle: "Role release data marks two roles available, two demo and two planned; two of seven Role Apps are installed",
    visual: {
      type: "status-table",
      columns: ["Component", "Status", "What runs today"],
      rows: [
        { Component: "Operational Risk Partner OS", Status: "Available", "What runs today": "Home, Work Hub, Processes, Decisions, AI Partner and the RCSA app" },
        { Component: "Third-Party Risk Manager OS", Status: "Available", "What runs today": "The same shared core with the Third-Party Onboarding app" },
        { Component: "Control Assurance Specialist", Status: "Demo", "What runs today": "Explanatory demo page in the current interface; no Role App" },
        { Component: "Incident and Resilience Lead", Status: "Demo", "What runs today": "Explanatory demo page in the current interface; no Role App" },
        { Component: "Regulatory Change, NFR Portfolio Lead", Status: "Planned", "What runs today": "Listed in the role selector without a link" },
        { Component: "Role Apps", Status: "2 installed, 5 preview", "What runs today": "Preview apps are registry entries with no route" },
        { Component: "Platform services", Status: "Partial", "What runs today": "Gate, audit and evaluations run; identity and connectors are local only" },
      ],
    },
    evidenceBasis: [
      { type: "repository", label: "Role release definitions, src/product/release/role-release.ts" },
      { type: "repository", label: "Role App registry, src/role-apps/registry.ts" },
      { type: "product", label: "Workday role selector, synthetic data" },
    ],
    speakerNotes:
      "Use this table to separate what runs from what is only shown. Available means the role runs locally on synthetic data with its shared core and one installed Role App. Demo roles open an explanatory page in the current interface, and planned roles appear in the selector without a link. Start any design-partner conversation from the two available roles only.",
  },

  {
    id: "app-23",
    section: "Product",
    group: "Product",
    status: {
      level: "partial",
      note: "Daily work and decisions run for two roles; meeting minutes, inbox conversion and scheduled routines are not built",
    },
    title: "The shared Role OS core already handles daily work and decisions, with gaps labelled",
    subtitle: "Capability status for the Operational Risk and Third-Party Risk workspaces in the current interface, on synthetic data",
    visual: {
      type: "capability-map",
      groups: [
        {
          name: "Daily work",
          items: [
            { label: "Home with Now, Next and Done", status: "Implemented" },
            { label: "Agenda and meeting lists", status: "Implemented" },
            { label: "Actions with ownership filters", status: "Implemented" },
            { label: "Inbox with AI triage proposal", status: "Implemented" },
            { label: "Meeting preparation status", status: "Partial" },
            { label: "Minutes editing and inbox conversion", status: "Not built" },
          ],
        },
        {
          name: "Judgment and evidence",
          items: [
            { label: "Decision queue with confirmed rationale", status: "Implemented" },
            { label: "Approval and execution receipt", status: "Implemented" },
            { label: "Evidence drawer with provenance", status: "Partial" },
            { label: "Process stages through Role Apps", status: "Partial" },
          ],
        },
        {
          name: "AI Partner",
          items: [
            { label: "Suggestions with citations", status: "Implemented" },
            { label: "Activity log of AI work", status: "Implemented" },
            { label: "Chat in safe and offline modes", status: "Implemented" },
            { label: "Live model mode", status: "Partial" },
            { label: "Scheduled routines", status: "Demo" },
          ],
        },
        {
          name: "Administration",
          items: [
            { label: "Role App registry view", status: "Implemented" },
            { label: "Entitlements, branding and terminology", status: "Implemented" },
            { label: "Integration centre", status: "Simulated" },
            { label: "Operations console", status: "Implemented" },
            { label: "Sign-in and access guards", status: "Partial" },
          ],
        },
      ],
    },
    evidenceBasis: [
      { type: "product", label: "Workday Home, Work Hub, Processes and Decisions, synthetic data" },
      { type: "repository", label: "Work Hub handoff, docs/handoffs/workday-v3-3-role-os.md" },
      { type: "repository", label: "Settings and operations routes, app/settings and app/ops" },
    ],
    speakerNotes:
      "This is the shared core that both available roles use. Implemented means it runs locally against the seeded database. Meeting preparation shows a status rather than a full preparation pack, and minutes editing and inbox conversion are not built, so do not demonstrate them as working. The demo and planned roles do not have this core in the current interface.",
  },

  {
    id: "app-02",
    section: "Product",
    group: "Product",
    status: {
      level: "partial",
      note: "Two apps are installed with process pages; five preview apps exist only as registry entries and cannot be started",
    },
    title: "The Role App library holds seven apps, and two of them can be started today",
    subtitle: "The code registry lists two installed apps with eight-stage processes and five preview apps with no entry route",
    visual: {
      type: "status-table",
      columns: ["Role App", "Role", "Status", "Build state"],
      rows: [
        { "Role App": "RCSA Cycle Assistant", Role: "Operational Risk Partner", Status: "Installed", "Build state": "Routed process, 8 stages, version 1.0.0" },
        { "Role App": "Third-Party Onboarding", Role: "Third-Party Risk Manager", Status: "Installed", "Build state": "Routed process, 8 stages, version 1.0.0" },
        { "Role App": "Event-Driven Reassessment", Role: "Operational Risk Partner", Status: "Preview", "Build state": "Prototype definition, 3 stages, no route" },
        { "Role App": "Rapid Assessment", Role: "Operational Risk Partner", Status: "Preview", "Build state": "Concept definition, 4 stages, no route" },
        { "Role App": "Periodic Reassessment", Role: "Third-Party Risk Manager", Status: "Preview", "Build state": "Prototype definition, 4 stages, no route" },
        { "Role App": "Exit Planning", Role: "Third-Party Risk Manager", Status: "Preview", "Build state": "Concept definition, 4 stages, no route" },
        { "Role App": "Fourth-Party Deep Dive", Role: "Third-Party Risk Manager", Status: "Preview", "Build state": "Concept definition, 4 stages, no route" },
      ],
    },
    evidenceBasis: [
      { type: "repository", label: "Role App registry, src/role-apps/registry.ts" },
      { type: "product", label: "Administrator Role App view, /settings/role-apps" },
    ],
    speakerNotes:
      "This is the complete catalogue in code; there is no longer list behind it. The two installed apps have process pages a professional can open. The five preview apps are definitions only: the administrator screen shows them as demo or concept apps, and none can be started. Any further app would come through the App Factory as new build.",
  },

  {
    id: "app-06",
    section: "Product",
    group: "Product",
    status: {
      level: "partial",
      note: "Suggestions, activity and chat run in safe and offline modes; live mode needs an operator key and does not enforce structured output",
    },
    title: "The AI Partner prepares and proposes, while every action it requests passes the gate",
    subtitle: "Product capture of the AI Partner dock; safe mode is the default and offline mode makes no model call",
    visual: {
      type: "product-proof",
      assetId: "ai-partner",
      caption: "AI Partner in the Operational Risk Partner workday, synthetic data",
      points: [
        "Three tabs: suggestions, activity and chat",
        "Suggestions pass 13 validation rules before display",
        "Tool calls pass the authority gate and write an audit record",
        "Prohibited tools, such as external email, are refused and logged",
        "Live mode calls an OpenAI model when an operator supplies a key",
        "Safe mode replays cached outputs; offline mode uses seeded answers",
      ],
    },
    evidenceBasis: [
      { type: "product", label: "AI Partner dock, synthetic data" },
      { type: "repository", label: "Agent runtime and validation, src/agents" },
      { type: "repository", label: "Demo modes, src/server/config/demo-mode.ts" },
    ],
    speakerNotes:
      "The AI Partner is where the professional sees what was prepared, what the AI did and where it is uncertain. It can read, cite, draft and propose, but anything that changes a record is held for a person. Refusals are written to the audit log, so the boundary can be shown from data rather than asserted. For a live demonstration we use safe mode, because the story must not depend on a model call.",
  },

  {
    id: "app-10",
    section: "Product",
    group: "Product",
    status: {
      level: "demo",
      note: "Nine routine definitions and their seeded outputs are visible in the product; no scheduler runs them yet",
    },
    title: "AI routines are defined to read and draft for each role, but nothing schedules them yet",
    subtitle: "Nine routines are seeded with a trigger, an authority class and an output; the worker's routine handler is a stub",
    visual: {
      type: "text-columns",
      columns: [
        {
          heading: "Operational Risk Partner",
          items: [
            "Morning Brief: daily 07:00, read",
            "Calendar Scan: daily 07:00, read",
            "Pre-Meeting Preparation: 30 minutes before, draft",
            "KRI and Control Watch: hourly, read",
            "Evidence Freshness Check: weekly, read",
          ],
        },
        {
          heading: "Third-Party Risk Manager",
          items: [
            "Morning Brief: daily 07:00, read",
            "Pre-Meeting Preparation: before meetings, draft",
            "Supplier Monitoring Watch: daily 08:00, read",
            "Evidence-Request Follow-up: daily 09:00, draft",
          ],
        },
        {
          heading: "Boundaries by design",
          items: [
            "Routines may only read or draft",
            "A drafted message waits in the inbox for review",
            "No routine advances a stage or writes a record",
            "The act class is reserved and unused",
          ],
        },
        {
          heading: "Status today",
          items: [
            "Definitions and outputs are seeded rows",
            "Last-run times are seeded, not measured",
            "Worker handlers complete without real work",
            "Shown under Processes, AI Routines",
          ],
        },
      ],
    },
    evidenceBasis: [
      { type: "repository", label: "AI routines, docs/AI_ROUTINES.md" },
      { type: "repository", label: "Routine seed, src/db/seed/role-app-runtime.ts" },
      { type: "repository", label: "Job worker, scripts/worker.ts" },
    ],
    speakerNotes:
      "Routines are the background layer meant to prepare the day before the professional arrives. Each one is bounded to reading or drafting, so a routine never commits anything without the role holder. Today the nine routines and their outputs are seeded for the demonstration, and the job worker that would run them only marks jobs complete. Present them as designed behaviour, not as a running scheduler.",
  },

  // ===========================================================================
  // Processes
  // ===========================================================================
  {
    id: "app-03",
    section: "Processes",
    group: "Processes",
    status: {
      level: "partial",
      note: "All eight stages advance locally on synthetic data; AI text is seeded for stages 1 and 2; stage completion is logged but not gated",
    },
    title: "RCSA runs as eight stages, each closed by a recorded human decision",
    subtitle: "The seeded assessment waits at stage 2, Evidence Refresh, shown here as captured from the RCSA Cycle Assistant",
    visual: {
      type: "product-proof",
      assetId: "rcsa-process-stage",
      caption: "RCSA Cycle Assistant, stage 2 of 8, Evidence Refresh, synthetic data",
      points: [
        "Eight stages: Scope and Trigger, Evidence Refresh, Risk and Control Change, First-line Input, Challenge Workshop, Rating and Appetite, Actions and Approval, Monitoring and Reassessment",
        "AI prepared: four of six required sources retrieved, the two gaps named",
        "Your task: waive the missing items or escalate before stage 3",
        "The decision is recorded with its note, then the run moves on",
      ],
    },
    evidenceBasis: [
      { type: "repository", label: "RCSA Cycle Assistant definition, src/role-apps/rcsa/definition.ts" },
      { type: "repository", label: "RCSA process documentation, docs/RCSA_PROCESS_APP.md" },
      { type: "product", label: "RCSA process stage 2, product capture, synthetic data" },
    ],
    speakerNotes:
      "The screen is the RCSA Cycle Assistant at stage 2 of 8, Evidence Refresh, where the seeded assessment waits. The AI has retrieved four of the six required sources and names the two gaps; the professional decides whether to waive them or escalate, and that decision is recorded before stage 3. Each of the eight stages ends the same way, with a judgment that stays with the professional. In the current build only stages 1 and 2 show prepared content and later stages show placeholders. Completing a stage moves the run forward and writes a process event; material consequences, such as a residual rating change, go through the separate decision flow and the authority gate.",
  },

  {
    id: "app-04",
    section: "Processes",
    group: "Processes",
    status: {
      level: "partial",
      note: "Stages 1 to 4 show seeded AI preparation; only stage 4 has a decision form, and stages 5 to 8 are locked in the demo case",
    },
    title: "Third-party onboarding defines eight gated stages, with the demo case at evidence review",
    subtitle: "Stage ids come from the onboarding definition; the seeded supplier file for ARC-DE and ARC-AT waits at stage 4",
    visual: {
      type: "process-matrix",
      stages: ["Request", "Classify", "Due diligence", "Evidence", "Specialists", "Conditions", "Decision", "Monitor"],
      tracks: ["AI prepares", "Human decides", "Recorded outcome"],
      cells: {
        "Request_AI prepares": "Procurement request retrieved; duplicate check",
        "Request_Human decides": "Confirms intake and procurement reference",
        "Request_Recorded outcome": "Candidate registered with owner and reference",
        "Classify_AI prepares": "Proposed classification and criticality",
        "Classify_Human decides": "Outsourcing or ICT service, and criticality",
        "Classify_Recorded outcome": "Classification and entities with rationale",
        "Due diligence_AI prepares": "Questionnaire tailored to class and criticality",
        "Due diligence_Human decides": "Approves the questionnaire before dispatch",
        "Due diligence_Recorded outcome": "Requests sent; responses checked for completeness",
        "Evidence_AI prepares": "Document summaries, gaps and drafted chase messages",
        "Evidence_Human decides": "Pass conditionally, hold or escalate",
        "Evidence_Recorded outcome": "Each item accepted, rejected or chased",
        "Specialists_AI prepares": "Specialist review requests drafted",
        "Specialists_Human decides": "Agrees or challenges each condition",
        "Specialists_Recorded outcome": "IT Security, Privacy and Legal opinions recorded",
        "Conditions_AI prepares": "Surfaces open conditions that need a position",
        "Conditions_Human decides": "Each condition in the contract or waived",
        "Conditions_Recorded outcome": "Contract approved by owner and procurement",
        "Decision_AI prepares": "Governance paper for the approval body",
        "Decision_Human decides": "Records the approval decision with rationale",
        "Decision_Recorded outcome": "Supplier set to active in the register",
        "Monitor_AI prepares": "Supplier monitoring routine defined, not running",
        "Monitor_Human decides": "Sets frequency and next assessment date",
        "Monitor_Recorded outcome": "Monitoring plan created; case closed",
      },
    },
    evidenceBasis: [
      { type: "repository", label: "Third-Party Onboarding definition, src/role-apps/tprm/definition.ts" },
      { type: "repository", label: "Onboarding documentation, docs/TPRM_ONBOARDING_APP.md" },
      { type: "illustrative", label: REGULATORY_LABEL },
    ],
    speakerNotes:
      "The onboarding app follows the same pattern as RCSA: the AI prepares, the professional decides, and each stage leaves a record. The seeded case is a new supplier for the German and Austrian entities, at evidence review with two items outstanding. In the current build that stage has the decision form and the later stages are locked, so present stages 5 to 8 as the defined design. Monitoring after onboarding is defined but not yet running.",
  },

  // ===========================================================================
  // Controls
  // ===========================================================================
  {
    id: "app-24",
    section: "Controls",
    group: "Controls",
    status: {
      level: "partial",
      note: "Provenance, freshness and required-source checks run on synthetic data; evidence documents carry no content hash",
    },
    title: "Provenance and freshness labels keep fact, approved record and model inference apart",
    subtitle: "Six provenance kinds, four freshness states and a required-source check; 424 citations resolve to 179 documents",
    visual: {
      type: "text-columns",
      columns: [
        {
          heading: "Provenance kinds",
          items: [
            "Verified fact",
            "Approved record",
            "Stakeholder statement",
            "Model inference",
            "Conflicting evidence",
            "Telemetry",
          ],
        },
        {
          heading: "Source freshness",
          items: [
            "Live: inside threshold, pushed source",
            "Fresh: inside threshold, polled source",
            "Stale: shown as last known",
            "Unknown: never read, kept separate",
          ],
        },
        {
          heading: "Before a recommendation",
          items: [
            "Required sources are checked first",
            "A missing required source blocks it",
            "A stale source is named as a limit",
            "All 38 seeded decisions carry opposing evidence",
          ],
        },
        {
          heading: "Known gaps",
          items: [
            "No content hash on evidence documents",
            "Citation checks on live output are advisory",
            "The current evidence drawer shows an empty state",
            "Evidence bodies are English only",
          ],
        },
      ],
    },
    evidenceBasis: [
      { type: "repository", label: "Provenance kinds, src/db/schema/core.ts" },
      { type: "repository", label: "Freshness and required sources, docs/INTEGRATION_FABRIC.md" },
      { type: "simulation", label: "Structural evaluation run, docs/EVALUATION_REPORT.md" },
    ],
    speakerNotes:
      "Evidence items, chronology entries and meeting statements each carry a provenance kind, so a model inference is labelled as such and cannot pass as a verified fact. Freshness is set per source and object type, and a source that was never read is not shown as stale or current. Before a recommendation is published the required sources are checked, and a missing one stops it. The structural check found every one of 424 citations resolving to a real document in the synthetic corpus.",
  },

  {
    id: "app-09",
    section: "Controls",
    group: "Controls",
    status: {
      level: "implemented",
      note: "Gate, tool registry and approval checks run locally with unit and integration tests; Role App stage completion is not yet gated",
    },
    title: "Six authority classes and three independent checks decide what may execute",
    subtitle: "73 registered tools; autonomy level, role scope and a payload-bound approval are each checked before a change",
    visual: {
      type: "authority-matrix",
      columns: ["Class", "Tools", "Writes a record", "Approval"],
      rows: [
        { Class: "Read", Tools: "25", "Writes a record": "No", Approval: "Not needed" },
        { Class: "Draft", Tools: "6", "Writes a record": "No; text for a person to edit", Approval: "Not needed" },
        { Class: "Propose", Tools: "7", "Writes a record": "No; options with stated uncertainty", Approval: "Not needed" },
        { Class: "Policy bound", Tools: "5", "Writes a record": "Yes; low risk and reversible", Approval: "Without approval only at act within policy" },
        { Class: "Approval required", Tools: "24", "Writes a record": "Yes; material change", Approval: "Always: a person, single use, bound to the payload" },
        { Class: "Prohibited", Tools: "6", "Writes a record": "Never", Approval: "Refused at every level and logged" },
      ],
    },
    evidenceBasis: [
      { type: "repository", label: "Authority gate and tool registry, src/server/security/authority.ts" },
      { type: "repository", label: "Authority tests, tests/unit/authority.test.ts" },
      { type: "repository", label: "Decision engine tests, tests/integration/decisions.test.ts" },
    ],
    speakerNotes:
      "This is the enforcement behind the authority line on the core slide. Each tool has exactly one class, and the gate checks three things independently: the autonomy level can reach the class, the role holds every required scope, and a material change has an unused approval bound to that exact payload with the rationale confirmed. Raising the autonomy level never removes the approval on a material change, and that is tested. Two gaps to state openly: preparer and approver are not yet separated beyond refusing agent approvers, and Role App stage completion does not yet pass through the gate.",
  },

  {
    id: "app-25",
    section: "Controls",
    group: "Controls",
    status: {
      level: "partial",
      note: "Role scopes and entitlement profiles work today; signed sessions exist but are not wired to routes, and there is no bank identity provider",
    },
    title: "Role scopes are enforced today, while bank identity and segregation of duties are not",
    subtitle: "Signed sessions and access guards exist in code with 26 unit tests, but no route calls them yet",
    visual: {
      type: "status-table",
      columns: ["Element", "Status", "Today"],
      rows: [
        { Element: "Role authority scopes", Status: "Implemented", Today: "18 scopes; a tool runs only if the role holds them all" },
        { Element: "Acting role", Status: "Implemented", Today: "Scenario state read server side, never from the model" },
        { Element: "Entitlement profiles", Status: "Implemented", Today: "Group-wide profile and a two-function pilot profile" },
        { Element: "Signed sessions and modes", Status: "Built, not wired", Today: "Demonstration, design-partner and offline evaluation modes" },
        { Element: "Route and administrator guards", Status: "Built, not wired", Today: "Settings and /ops are open in demonstration mode" },
        { Element: "Segregation of duties", Status: "Not enforced", Today: "Only agent and blank approvers are refused" },
        { Element: "Bank identity federation", Status: "Planned", Today: "OIDC is defined for the dedicated profile only" },
      ],
    },
    evidenceBasis: [
      { type: "repository", label: "Identity module, src/identity" },
      { type: "repository", label: "Identity handoff, docs/handoffs/v4-identity-access.md" },
      { type: "repository", label: "Entitlements, src/product/entitlements/entitlements.ts" },
    ],
    speakerNotes:
      "Authorisation today is the role scope model inside the authority gate, which applies to every governed tool call. Sign-in is a persona choice in demonstration mode and a static account list in design-partner mode, and those sessions are not yet checked on routes. Segregation of duties needs the bank's directory and approver rules, which is design-partner work. Say this before anyone asks.",
  },

  {
    id: "app-26",
    section: "Controls",
    group: "Controls",
    status: {
      level: "partial",
      note: "Audit log, health probes and file backup run locally; the hash chain covers seeded events only and job handlers are stubs",
    },
    title: "The audit trail is append only and backups verify locally, but operations remain partial",
    subtitle: "Six audit categories, a SHA-256 chain over seeded events, health probes, a leased job queue and file backups",
    visual: {
      type: "status-table",
      columns: ["Capability", "Status", "Detail"],
      rows: [
        { Capability: "Append-only audit events", Status: "Implemented", Detail: "Six categories; no update or delete path in the app" },
        { Capability: "Refused actions on record", Status: "Implemented", Detail: "Blocked attempts logged with a denial code" },
        { Capability: "Audit hash chain", Status: "Partial", Detail: "SHA-256 chain verifies; covers seeded events only" },
        { Capability: "Health probes and console", Status: "Implemented", Detail: "Live, ready and detail probes; /ops open in demo mode" },
        { Capability: "Background job queue", Status: "Partial", Detail: "Leases, retries and idempotency; handlers are stubs" },
        { Capability: "Backup and restore", Status: "Implemented", Detail: "Database file copy with a SHA-256 manifest check" },
        { Capability: "Audit export and telemetry", Status: "Planned", Detail: "Export route and external metrics are design only" },
      ],
    },
    evidenceBasis: [
      { type: "repository", label: "Audit service, src/server/security/audit.ts" },
      { type: "repository", label: "Audit chain, src/audit and docs/handoffs/v4-audit-integrity.md" },
      { type: "repository", label: "Reliability and observability, docs/handoffs/v4-reliability.md and v4-observability.md" },
    ],
    speakerNotes:
      "Every governed mutation writes one audit event and every refused action is recorded, so an auditor can see what was asked and declined. The hash chain is tamper evident within the application boundary, and today it covers the seeded history rather than new events. Backups copy the local database file and verify it by hash before a restore. An audit export route, external monitoring and a real job runner are still to be built.",
  },

  {
    id: "app-29",
    section: "Controls",
    group: "Controls",
    status: {
      level: "reference",
      note: "Entity model and jurisdiction checks run in code on a synthetic institution; every scenario instrument is invented",
    },
    title: "The product keeps the EU and Swiss regulatory lanes apart by design",
    subtitle: "DE and AT entities sit in the EU lane; the CH entity is FINMA supervised. Illustrative regulatory context, not legal advice",
    visual: {
      type: "text-columns",
      columns: [
        {
          heading: "EU lane: ARC-DE and ARC-AT",
          items: [
            "EU credit institutions under national supervision",
            "DORA, Regulation (EU) 2022/2554",
            "EBA/GL/2019/02, outsourcing arrangements",
            "EBA/GL/2019/04, ICT and security risk",
            "Applicability decided per entity by a person",
          ],
        },
        {
          heading: "Swiss lane: ARC-CH",
          items: [
            "Swiss bank under FINMA supervision",
            "FINMA Circular 2023/1, operational risks",
            "FINMA Circular 2018/3, outsourcing",
            "DORA does not apply to this entity",
            "Own impact tolerance; reports in CHF",
          ],
        },
        {
          heading: "How the code holds the line",
          items: [
            "Regulatory bloc is a typed column per entity",
            "Swiss regulator context derived from the bloc",
            "Structural check: no EU term on Swiss content",
            "Separate publications and obligations per lane",
            "No statement asserts compliance",
          ],
        },
        {
          heading: "Language",
          items: [
            "English interface with partial German labels",
            "About 90 German strings, written with ae, oe, ue",
            "Evidence, prompts and guardrails in English",
            "DD.MM.YYYY dates; EUR and CHF amounts",
          ],
        },
      ],
    },
    evidenceBasis: [
      { type: "repository", label: "Jurisdiction model, docs/DACH_CONTEXT.md" },
      { type: "repository", label: "Regulator context map, src/product/organisation/profile.ts" },
      { type: "illustrative", label: REGULATORY_LABEL },
    ],
    speakerNotes:
      "Arcadia is a synthetic group with German, Austrian and Swiss banks, and the product treats them as two regulatory lanes. DORA and EBA references apply to the German and Austrian entities only; the Swiss entity is addressed through FINMA context, and DORA does not apply to it. That separation is a typed field and a structural evaluation, not an editorial convention. All instruments in the scenario are invented, and this is illustrative regulatory context, not legal advice.",
  },

  // ===========================================================================
  // Technology
  // ===========================================================================
  {
    id: "app-08",
    section: "Technology",
    group: "Technology",
    status: {
      level: "implemented",
      note: "Runs locally as one Node process on synthetic data; no deployment to a cloud or client environment has been run",
    },
    title: "The platform stacks five layers so the model never touches the database directly",
    subtitle: "Next.js and TypeScript over SQLite with Drizzle; live, safe and offline AI modes; one local process",
    visual: {
      type: "architecture-layers",
      layers: [
        {
          name: "Role workspaces",
          items: [
            "Two available roles; demo and planned roles marked",
            "Home, Work, Processes and Decisions",
            "Administrator settings and operations console",
            "English interface with partial German labels",
          ],
        },
        {
          name: "Process and decision runtime",
          items: [
            "Role App definitions with persisted runs",
            "Scenario state: clock, role and autonomy level",
            "Decision engine: rationale, approval, receipt",
            "Calculators: risk matrix and impact tolerance",
          ],
        },
        {
          name: "Control kernel",
          items: [
            "Authority gate over 73 registered tools",
            "Append-only audit service",
            "Guardrails and suggestion validation",
            "Structural evaluation suite",
          ],
        },
        {
          name: "AI runtime",
          items: [
            "Manager agent with eight specialist prompts",
            "Live mode: OpenAI model, operator key",
            "Safe mode, the default: cached outputs",
            "Offline mode: seeded answers, no calls",
            "The model requests tools; it never writes data",
          ],
        },
        {
          name: "Data and integration",
          items: [
            "SQLite with Drizzle ORM, one local file",
            "Full-text retrieval with SQLite FTS5",
            "Connector runtime with outbox and receipts",
            "Simulated GRC, Microsoft 365 and document sources",
          ],
        },
      ],
    },
    evidenceBasis: [
      { type: "repository", label: "Architecture, README.md and docs/AI_ARCHITECTURE.md" },
      { type: "repository", label: "Packaging model, docs/PRODUCT_ARCHITECTURE.md" },
    ],
    speakerNotes:
      "Read the stack from the bottom up. The data layer is one local SQLite file, and the connectors read the same seeded institution rather than a second dataset. The model can only ask the tool runtime to do something; the authority gate decides and the audit service records it. Safe mode is the default for presentations, and the whole story also works offline with no model.",
  },

  {
    id: "app-27",
    section: "Technology",
    group: "Technology",
    status: {
      level: "partial",
      note: "Pipelines, outbox, retries and receipts are implemented and proved against simulated connectors; no live connector exists",
    },
    title: "The integration contract is built and proved, but every connector is still simulated",
    subtitle: "A headless script proves 29 inbound, outbound and failure steps; no code in the build makes an outbound network call",
    visual: {
      type: "integration-flow",
      inbound: [
        "Identify the connector and validate the source",
        "Deduplicate on the sender's event key",
        "Map to a canonical object; report unmapped fields",
        "Keep the external reference and source time",
        "Raise a live workday event and load evidence",
        "Start AI preparation only when policy allows",
      ],
      outbound: [
        "Reserve the command on an idempotency key",
        "Pass the authority gate and a bound approval",
        "Queue in the outbox, then bounded retries",
        "Wait for the target's acknowledgement",
        "Write the receipt citing the audit event",
        "On failure, dead-letter; the decision stands",
      ],
      controlPoints: [
        "Five simulated connectors and no live one",
        "Graph adapter sandbox-ready; client not built",
        "Ten named adapters planned; all calls refused",
        "Four conflict policies declared per mapping",
        "Webhook signature checks not yet built",
      ],
    },
    evidenceBasis: [
      { type: "repository", label: "Integration fabric, docs/INTEGRATION_FABRIC.md" },
      { type: "repository", label: "Connector contract, docs/CONNECTOR_CONTRACT.md" },
      { type: "repository", label: "Productization gaps, docs/PRODUCTIZATION_GAPS.md" },
    ],
    speakerNotes:
      "The bank's GRC, document and collaboration systems stay the systems of record; this layer writes back only what a person approved. A change is never reported as done until the target acknowledges it, and a failed delivery never rolls back the human decision. The contract is real and tested, but there is no real integration yet, and workday decisions still write to the local database. The first live connector is a material piece of work and belongs in the design-partner plan.",
  },

  {
    id: "app-20",
    section: "Technology",
    group: "Technology",
    status: {
      level: "partial",
      note: "The restricted local prototype is implemented; three profiles are defined with outstanding work and none of them is built",
    },
    title: "One of four deployment profiles runs today; three are defined with open work",
    subtitle: "The implemented flag is held in the database and checked by a unit test; AI data handling is local today",
    visual: {
      type: "status-table",
      columns: ["Profile", "Status", "Identity and data", "Still to build"],
      rows: [
        { Profile: "Restricted local prototype", Status: "Implemented", "Identity and data": "Local SQLite file; role chosen in the scenario", "Still to build": "Not suitable for real institution records" },
        { Profile: "Dedicated managed", Status: "Defined only", "Identity and data": "OIDC federation; one named EU or Swiss region", "Still to build": "Tenant lifecycle, key management, verified deletion" },
        { Profile: "Customer-managed private", Status: "Defined only", "Identity and data": "Bank identity; data stays in the bank's estate", "Still to build": "Hardened image, runbooks, replace SQLite" },
        { Profile: "Bank private cloud", Status: "Defined only", "Identity and data": "Internal SSO; no public inference egress", "Still to build": "Platform conformance, internal model endpoint" },
        { Profile: "AI data handling today", Status: "Current", "Identity and data": "Turns stored in local SQLite; secrets redacted", "Still to build": "Residency model, retention, PII scrubbing" },
      ],
    },
    evidenceBasis: [
      { type: "repository", label: "Deployment profiles, docs/DEPLOYMENT_PROFILES.md" },
      { type: "repository", label: "Profile seed and test, src/product/seed.ts and tests/unit/product.test.ts" },
      { type: "repository", label: "Data residency gaps, docs/PRODUCTIZATION_GAPS.md" },
    ],
    speakerNotes:
      "Only the restricted local prototype exists, and it is for demonstration and design review, not for real records. The three other profiles are written down with what each would still need, and the settings screen reads the same flags. Prompts and chat turns are stored in the local database today, secrets are redacted from logs, and there is no residency model beyond the machine. A container build file is in the repository, but no cloud deployment has been run.",
  },

  {
    id: "app-11",
    section: "Technology",
    group: "Technology",
    status: {
      level: "partial",
      note: "Structural evaluations run without a model and pass; live grading, runtime quality metrics and prompt regression tests are not built",
    },
    title: "Structural evaluations pass, while live AI quality is not yet measured",
    subtitle: "14 of 14 structural checks pass without a model; 2 of 4 grounded probes passed in live mode and are advisory",
    visual: {
      type: "status-table",
      columns: ["Check", "Result", "What it covers"],
      rows: [
        { Check: "Structural evaluations", Result: "14 of 14 pass", "What it covers": "Citations, authority, jurisdiction and seeded state; no model call" },
        { Check: "Grounded probes", Result: "2 of 4 pass", "What it covers": "Live mode only; two missed an expected citation" },
        { Check: "Evaluation corpus", Result: "60 cases", "What it covers": "Seven graders; grading of live output is not wired yet" },
        { Check: "Suggestion validation", Result: "13 rule codes", "What it covers": "Citations, claims, provider names, Swiss and DORA mixing" },
        { Check: "Guardrails", Result: "Hygiene layer", "What it covers": "Five English input patterns; not the security boundary" },
        { Check: "Runtime quality metrics", Result: "Not built", "What it covers": "Review, edit and acceptance rates are not tracked" },
        { Check: "Prompt regression tests", Result: "Not built", "What it covers": "Prompt templates live in code without regression tests" },
      ],
    },
    evidenceBasis: [
      { type: "simulation", label: "Evaluation report, docs/EVALUATION_REPORT.md" },
      { type: "repository", label: "Evaluation suite, src/agents/evaluations and evals/" },
      { type: "illustrative", label: REGULATORY_LABEL },
    ],
    speakerNotes:
      "The structural suite checks the seeded data and the controls without calling a model, and all fourteen checks pass. The grounded probes need live mode; two of four passed and the result is advisory. The sixty-case corpus exists, but its graders are not yet run against real model output, so it is not a quality result. Measuring review, edit and acceptance rates is pilot work, not something the product reports today.",
  },

  // ===========================================================================
  // Service and rollout
  // ===========================================================================
  {
    id: "app-13",
    section: "Service and rollout",
    group: "Service and rollout",
    status: {
      level: "planned",
      note: "Proposal. Function packs and entitlement profiles exist as product configuration; no managed service is operating",
    },
    title: "Each service tier carries a defined scope and cadence, from platform to managed operations",
    subtitle: "Proposal from the service model: platform and packs recur, Role Apps are delivered per app, operations spans all",
    visual: {
      type: "service-stack",
      tiers: [
        {
          name: "Managed operations",
          detail: "Monitoring, model and prompt review, app releases, user support",
          cadence: "Recurring monthly",
          semanticType: "managed-service",
        },
        {
          name: "Role Apps",
          detail: "Process design, build, evaluation, validation and release per app",
          cadence: "Per app delivered",
          semanticType: "role-app",
        },
        {
          name: "Function packs",
          detail: "Objects, roles, governed tools, screens and evaluation cases",
          cadence: "Recurring per function enabled",
          semanticType: "function",
        },
        {
          name: "Platform",
          detail: "Core controls, hosting, AI model access, security and backup",
          cadence: "Recurring monthly",
          semanticType: "platform",
        },
      ],
    },
    evidenceBasis: [
      { type: "proposal", label: "Service model, src/presentation-v2-2/data/service-model.ts" },
      { type: "repository", label: "Packaging model, docs/PRODUCT_ARCHITECTURE.md" },
    ],
    speakerNotes:
      "This is the operating and commercial shape we propose, not a running service. Function packs are already a configuration unit in the product, with six defined and a two-function pilot profile seeded. The platform tier carries the controls every deployment needs, which is why authority, audit and evaluations are never sold as an add-on. Managed operations is how monitoring, model review and new app releases continue after the pilot.",
  },

  {
    id: "app-28",
    section: "Service and rollout",
    group: "Service and rollout",
    status: {
      level: "planned",
      note: "The factory stages are a delivery proposal; the Role App definition contract exists in code and no app has gone through the factory",
    },
    title: "The App Factory is a proposed delivery path built on a definition that already exists",
    subtitle: "Stages and gates are a proposal; today a new Role App is a code change to the registry and its routes",
    visual: {
      type: "text-columns",
      columns: [
        {
          heading: "Factory stages, proposed",
          items: [
            "Discover: process, sources and pain points",
            "Design: stages, decisions and evidence",
            "Build: definition, routes, AI preparation",
            "Validate: one full cycle with the role",
            "Release, then operate and improve",
          ],
        },
        {
          heading: "Definition in code today",
          items: [
            "Role, function pack and version",
            "Ordered stages with outcome and human task",
            "Decision kinds reserved for a person",
            "Required connector packs",
            "Status: installed or preview",
          ],
        },
        {
          heading: "Release gates, proposed",
          items: [
            "Every stage names a human responsibility",
            "Evaluation cases pass for the app",
            "A full cycle run by the target role",
            "No critical defects open",
          ],
        },
        {
          heading: "Not built yet",
          items: [
            "Install flow; adding an app needs code",
            "Automated checks on app definitions",
            "Per-app evaluation suites",
            "Routes for the five preview apps",
          ],
        },
      ],
    },
    evidenceBasis: [
      { type: "repository", label: "Role App contract, src/role-apps/contracts.ts" },
      { type: "proposal", label: "App Factory lifecycle, src/presentation-v2-2/data/role-app-library.ts" },
      { type: "repository", label: "Role App architecture, docs/ROLE_APP_ARCHITECTURE.md" },
    ],
    speakerNotes:
      "The factory is how we propose to add processes once the first two apps are proved. What exists today is the definition every app declares: its stages, the decisions reserved for a person and the sources it needs. There is no install flow yet, so each preview app would still need routes and build. Present the factory as our delivery method, not as a product feature.",
  },

  {
    id: "app-14",
    section: "Service and rollout",
    group: "Service and rollout",
    status: {
      level: "planned",
      note: "Proposal only; no prices are set, and the product screens contain no pricing or upsell",
    },
    title: "Commercial packaging separates one-time setup from recurring service",
    subtitle: "Proposal: mobilisation and builds are one-time; platform, packs and operations recur; no rates are quoted",
    visual: {
      type: "text-columns",
      columns: [
        {
          heading: "One-time",
          items: [
            "Design and mobilisation, scoped per client",
            "Role App build, scoped at design",
            "Connector build, per source system",
            "Cohort training and onboarding",
          ],
        },
        {
          heading: "Recurring",
          items: [
            "Platform subscription, monthly",
            "Function pack licence per function enabled",
            "Managed operations, monthly",
            "Seat metric: active role seats per month",
          ],
        },
        {
          heading: "Guardrails",
          items: [
            "No prices in this deck; rates are negotiated",
            "Pilot: fixed mobilisation fee plus platform",
            "Programme terms agreed after the step 2 gate",
            "New institutions by configuration, not forks",
          ],
        },
      ],
    },
    evidenceBasis: [
      { type: "proposal", label: "Commercial structure, src/presentation-v2-2/data/service-model.ts" },
      { type: "repository", label: "No upsell in product screens, docs/WHITE_LABEL_AND_PACKAGING.md" },
    ],
    speakerNotes:
      "Keep this at the level of structure. The client pays once to mobilise and to build each app or connector, and pays recurring fees for the platform, the packs in use and managed operations. We do not quote rates in this deck. The product itself carries no pricing or upsell, which is a deliberate design choice.",
  },

  {
    id: "app-15",
    section: "Service and rollout",
    group: "Service and rollout",
    status: {
      level: "planned",
      note: "Proposal. Pilot accounts, six readiness checks and the two-function entitlement profile exist in code; no pilot has run",
    },
    title: "The design-partner scope starts with two roles and keeps autonomous execution off",
    subtitle: "Proposal aligned to the seeded two-function pilot profile, which grants Operational Risk and Third-Party Risk only",
    visual: {
      type: "text-columns",
      columns: [
        {
          heading: "In scope",
          items: [
            "Operational Risk Partner and Third-Party Risk Manager",
            "RCSA Cycle Assistant and Third-Party Onboarding",
            "Read-only first, then approval-gated execution",
            "Two-function profile, no autonomous execution",
            "Readiness checks and evidence pack before start",
          ],
        },
        {
          heading: "Bank provides",
          items: [
            "A sponsor who owns each gate decision",
            "One business area and its cycles",
            "Authority model and approver roles",
            "Identity, security and data reviewers",
            "Baseline measures for the pilot metrics",
          ],
        },
        {
          heading: "Accenture provides",
          items: [
            "Product configuration and pilot set-up",
            "Connector build for agreed sources",
            "Evaluation runs and quality reporting",
            "Change and adoption support",
          ],
        },
        {
          heading: "Out of scope at start",
          items: [
            "Preview apps and demo or planned roles",
            "Autonomous execution of any kind",
            "Live write-back before identity and connectors",
            "Any compliance determination",
          ],
        },
      ],
    },
    evidenceBasis: [
      { type: "proposal", label: "Accenture design-partner engagement structure" },
      { type: "repository", label: "Pilot readiness, docs/handoffs/v4-pilot-readiness.md" },
      { type: "repository", label: "Entitlement profiles, docs/WHITE_LABEL_AND_PACKAGING.md" },
      { type: "illustrative", label: REGULATORY_LABEL },
    ],
    speakerNotes:
      "This sets the edges of the first engagement, which the core slide turns into three steps. The scope matches what runs today: two roles, two apps and no autonomous execution. The bank brings the sponsor, the authority model and the reviewers who decide when anything moves from read-only to approval-gated execution. Everything outside the two roles stays out until the step 2 gate.",
  },

  {
    id: "app-16",
    section: "Service and rollout",
    group: "Service and rollout",
    status: {
      level: "planned",
      note: "Proposal. The audit log can already count refused actions; no pilot has run and no result is claimed",
    },
    title: "Five pilot metrics are measured against the bank's own baseline, not benchmarks",
    subtitle: "Each metric is defined before the pilot and baselined in step 1; no outcome or saving is claimed",
    visual: {
      type: "measurement-framework",
      dimensions: [
        {
          name: "Capacity",
          metric: "Meeting preparation time per RCSA cycle",
          baseline: "Step 1 work map of the current cycle",
        },
        {
          name: "Quality",
          metric: "Evidence complete and current at each stage gate",
          baseline: "Step 1 sample of recent files",
        },
        {
          name: "Control",
          metric: "Blocked-action rate: attempts refused by the gate",
          baseline: "Read from the audit log; no pre-pilot equivalent",
        },
        {
          name: "Continuity",
          metric: "Process waiting time: days a stage waits for an owner",
          baseline: "Step 1 process map of open cycles",
        },
        {
          name: "Adoption",
          metric: "Share of enrolled professionals active each week",
          baseline: "Zero at start; target agreed before step 2",
        },
      ],
    },
    evidenceBasis: [
      { type: "proposal", label: "Pilot metric framework" },
      { type: "repository", label: "Audit completeness counts, src/server/security/audit.ts" },
    ],
    speakerNotes:
      "These are the measures we would agree before the pilot starts, and each one needs the bank's own baseline. The control metric comes straight from the audit log, because refused actions are recorded with their reason. We make no claim about what the pilot will show. The outcome report compares the pilot to the baseline and supports the scale decision.",
  },

  {
    id: "app-22",
    section: "Service and rollout",
    group: "Service and rollout",
    status: {
      level: "reference",
      note: "Compiled from repository documentation and code review of the current build",
    },
    title: "Known limitations set the boundary for any design-partner engagement",
    subtitle: "Identity, connectors, AI quality and scale need work before real data. Illustrative regulatory context, not legal advice",
    visual: {
      type: "limitations-landscape",
      areas: [
        {
          label: "Identity",
          detail: "Sessions are not wired to routes; no bank identity provider; the role is scenario state",
          category: "current",
        },
        {
          label: "Connectors",
          detail: "All connectors are simulated; no code makes an outbound network call",
          category: "current",
        },
        {
          label: "Segregation of duties",
          detail: "Agents cannot approve, but preparer and approver are not yet separated",
          category: "current",
        },
        {
          label: "Role App depth",
          detail: "AI preparation is seeded for early stages; onboarding cannot yet run past stage 5",
          category: "current",
        },
        {
          label: "Live AI quality",
          detail: "Structured output is not enforced on live turns; 2 of 4 grounded probes pass",
          category: "current",
        },
        {
          label: "Scale and tenancy",
          detail: "Single tenant SQLite in one process; a server database and workers are needed",
          category: "roadmap",
        },
        {
          label: "German coverage",
          detail: "About 90 interface strings; evidence, prompts and guardrails are English",
          category: "roadmap",
        },
        {
          label: "Compliance and notification",
          detail: "No compliance claims; the product never contacts a supervisor",
          category: "out-of-scope",
        },
      ],
    },
    evidenceBasis: [
      { type: "repository", label: "Productization gaps, docs/PRODUCTIZATION_GAPS.md" },
      { type: "repository", label: "README limitations and V4 handoffs, docs/handoffs" },
      { type: "illustrative", label: REGULATORY_LABEL },
    ],
    speakerNotes:
      "Share this slide before the client finds these points themselves. The current items are the work a design partner would do with us: identity, a first live connector, separation of duties and deeper Role App stages. The roadmap items need a server database and wider language coverage before scale. Regulatory determinations stay with the bank in every case.",
  },
];
