/**
 * Appendix slide data for NFROS Presentation V2.2.
 *
 * Copied from V2.1 with the following corrections:
 * - All `--` punctuation removed from string values
 * - app-03 (RCSA) and app-04 (TPRM) updated to eight-stage process definitions
 *   matching src/role-apps/rcsa/definition.ts and src/role-apps/tprm/definition.ts
 */

export type AppendixContent =
  | { kind: "status-table"; rows: { label: string; status: string; note?: string }[] }
  | { kind: "capability-map"; groups: { name: string; items: string[] }[] }
  | {
      kind: "service-stack";
      tiers: { name: string; cadence: string; includes: string[] }[];
    }
  | { kind: "text-columns"; columns: { heading: string; items: string[] }[] }
  | { kind: "process-flow"; steps: { name: string; output: string }[] }
  | { kind: "matrix"; rows: { label: string; cols: string[] }[] }
  | {
      kind: "three-column";
      columns: [
        { heading: string; items: string[] },
        { heading: string; items: string[] },
        { heading: string; items: string[] },
      ];
    }
  | {
      kind: "simple-list";
      groups: { heading: string; items: { text: string; status?: string }[] }[];
    };

export interface AppendixSlide {
  id: string;
  title: string;
  content: AppendixContent;
  speakerNotes?: string;
}

export const APPENDIX_SLIDES: AppendixSlide[] = [
  {
    id: "app-01",
    title: "Product scope and release status",
    content: {
      kind: "status-table",
      rows: [
        {
          label: "Operational Risk Partner OS",
          status: "Implemented",
          note: "Role dashboard, work hub, and queue running locally",
        },
        {
          label: "TPRM Manager OS",
          status: "Implemented",
          note: "Role dashboard, work hub, and queue running locally",
        },
        {
          label: "RCSA Cycle Assistant (Role App)",
          status: "Implemented",
          note: "Eight-stage workflow with AI drafting at each stage",
        },
        {
          label: "Third-Party Onboarding (Role App)",
          status: "Implemented",
          note: "Eight-stage onboarding workflow installed and tested",
        },
        {
          label: "Control Assurance OS",
          status: "Demonstration only",
          note: "Role shell exists; workflow apps not yet built",
        },
        {
          label: "Incident and Resilience OS",
          status: "Demonstration only",
          note: "Role shell exists; workflow apps not yet built",
        },
        {
          label: "Regulatory Change OS",
          status: "Planned",
          note: "Design agreed; build not started",
        },
        {
          label: "NFR Governance OS",
          status: "Planned",
          note: "Design agreed; build not started",
        },
      ],
    },
    speakerNotes:
      "Use this table to anchor conversations about what is real and what is roadmap. Implemented means code exists, runs locally, and has been verified in end-to-end testing. Demonstration only means the role shell exists and can be shown but the underlying workflow apps are not built. Planned means design is agreed and build is sequenced. Do not overstate status: the pilot should begin with Implemented scope only.",
  },
  {
    id: "app-02",
    title: "Role App catalogue",
    content: {
      kind: "simple-list",
      groups: [
        {
          heading: "Operational Risk",
          items: [
            { text: "RCSA Cycle Assistant", status: "Implemented" },
            { text: "Event-Driven Reassessment", status: "Demo" },
            { text: "Rapid Assessment", status: "Demo" },
            { text: "Challenge Workshop Assistant", status: "Planned" },
            { text: "Committee Delta Builder", status: "Planned" },
            { text: "Scenario Library Builder", status: "Planned" },
            { text: "Risk Appetite Monitor", status: "Planned" },
          ],
        },
        {
          heading: "Third-Party Risk Management",
          items: [
            { text: "Third-Party Onboarding", status: "Implemented" },
            { text: "Periodic Reassessment", status: "Demo" },
            { text: "Continuous Monitoring", status: "Planned" },
            { text: "Fourth-Party Deep Dive", status: "Demo" },
            { text: "Exit Planning", status: "Demo" },
            { text: "Portfolio Heat Map", status: "Planned" },
            { text: "Inherent Risk Screener", status: "Planned" },
          ],
        },
        {
          heading: "Control Assurance",
          items: [
            { text: "Control Testing Planner", status: "Planned" },
            { text: "Sample Design Assistant", status: "Planned" },
            { text: "Deficiency Tracker", status: "Planned" },
          ],
        },
        {
          heading: "Incident and Resilience",
          items: [
            { text: "Incident Capture Assistant", status: "Planned" },
            { text: "Root Cause Analyser", status: "Planned" },
            { text: "Lessons Learned Packager", status: "Planned" },
          ],
        },
      ],
    },
    speakerNotes:
      "The catalogue shows the full ambition alongside honest current status. Implemented apps are in scope for the pilot. Demo apps are executable demonstration shells: they can be shown but have no entryRoute and are not ready for pilot deployment. Planned apps give clients a sense of the expansion roadmap. Use this to manage expectations and to identify which planned apps are highest priority for a given client.",
  },
  {
    id: "app-03",
    title: "RCSA Cycle Assistant: eight-stage detail",
    content: {
      kind: "process-flow",
      steps: [
        {
          name: "1. Scope and Trigger",
          output:
            "The assessment scope is confirmed: processes, legal entities, cycle quarter, and trigger reason recorded and visible to all participants.",
        },
        {
          name: "2. Evidence Refresh",
          output:
            "All KRI readings, control test results, incident records and audit findings retrieved, classified, and loaded into the assessment evidence corpus. Gaps formally requested.",
        },
        {
          name: "3. Risk and Control Change",
          output:
            "Every risk and control in scope compared against the prior assessment version. Changes to inherent position, control effectiveness, and appetite position recorded with source references.",
        },
        {
          name: "4. First-line Input",
          output:
            "First-line control owners have submitted their effectiveness positions. Gaps between first-line and second-line positions are surfaced. The challenge workshop agenda is set.",
        },
        {
          name: "5. Challenge Workshop",
          output:
            "Every risk and control rating discussed. Agreed positions recorded. Disputed positions carry a recorded second-line dissent with rationale and evidence cited.",
        },
        {
          name: "6. Rating and Appetite",
          output:
            "Every residual position computed from agreed control effectiveness. Each risk classified as within appetite, at limit, or outside appetite. Risks outside appetite have an active remediation plan or documented acceptance.",
        },
        {
          name: "7. Actions and Approval",
          output:
            "All remediation actions recorded with owner, due date, and success criterion. Assessment versioned and submitted for sign-off. Committee paper drafted.",
        },
        {
          name: "8. Monitoring and Reassessment",
          output:
            "KRI alert thresholds confirmed for the post-cycle monitoring period. Next cycle trigger date set. Assessment closed and process returns to continuous monitoring.",
        },
      ],
    },
    speakerNotes:
      "Each stage is a discrete workflow step with a defined output. AI assistance is available at stages 2, 3, and 7: drafting risk narratives, flagging rating changes, and preparing committee summaries. Stages 4, 5, and 6 are human-driven challenge and approval steps. The professional cannot skip a stage; the system enforces sequencing. This structure produces a complete, auditable RCSA record as a natural output of the workflow.",
  },
  {
    id: "app-04",
    title: "Third-Party Onboarding: eight-stage detail",
    content: {
      kind: "process-flow",
      steps: [
        {
          name: "1. Request and Intake",
          output:
            "The supplier candidate is registered in the third-party register with a procurement reference, a relationship owner, and a validated intake form.",
        },
        {
          name: "2. Classification and Criticality",
          output:
            "The regulatory classification (outsourcing or ICT service), the proposed criticality rating, and the contracting entities are recorded with rationale.",
        },
        {
          name: "3. Tailored Due Diligence",
          output:
            "A due diligence questionnaire and evidence request list tailored to the classification and criticality dispatched. Supplier responses received and completeness assessed.",
        },
        {
          name: "4. Evidence Review",
          output:
            "Every requested evidence item is either accepted, rejected with a documented reason, or recorded as outstanding with a chase date. No unreviewed item remains.",
        },
        {
          name: "5. Specialist Reviews",
          output:
            "IT Security, Privacy, and Legal have each returned a signed opinion or a formally recorded set of conditions. No review is in an unknown state.",
        },
        {
          name: "6. Contract and Conditions",
          output:
            "A final contract draft reviewed by Group Legal, with all specialist conditions reflected as obligations or formally waived, approved by the business owner and procurement.",
        },
        {
          name: "7. Decision and Onboarding",
          output:
            "Governance approval recorded. Contract signed. Supplier status changed to active in the register.",
        },
        {
          name: "8. Handover to Monitoring",
          output:
            "Monitoring plan created with the correct frequency for the supplier criticality. Next assessment date set. Onboarding case closed.",
        },
      ],
    },
    speakerNotes:
      "The TPRM onboarding workflow mirrors the OR structure: eight stages, AI assistance at the classification and evidence review stages, human decision at each gate. The TPRM Manager sees their full third-party portfolio in the work hub and drills into individual suppliers by stage. Evidence (questionnaire responses, risk ratings, escalation approvals) is captured at source rather than reconstructed post-hoc.",
  },
  {
    id: "app-05",
    title: "Demo Role Apps: capability detail",
    content: {
      kind: "text-columns",
      columns: [
        {
          heading: "OR Demo Apps (no entryRoute)",
          items: [
            "Event-Driven Reassessment: triggers a mini-RCSA from a loss event or near-miss",
            "Rapid Assessment: compressed four-stage cycle for emerging risks",
          ],
        },
        {
          heading: "TPRM Demo Apps (no entryRoute)",
          items: [
            "Periodic Reassessment: annual or trigger-based full reassessment of an existing supplier",
            "Fourth-Party Deep Dive: extended due diligence on critical sub-processors",
            "Exit Planning: structured exit with data offboarding checklist and contract closure",
          ],
        },
      ],
    },
    speakerNotes:
      "These five apps are demonstration shells: they can be shown in a walkthrough but have no entryRoute and cannot be started by a user in the normal product flow. They illustrate the role app pattern and help clients identify which processes they want to prioritise for build. Apps not on this list and not yet Implemented are Planned; they have not been built in any form. Use the demo session to validate appetite before committing the apps to the build roadmap.",
  },
  {
    id: "app-06",
    title: "AI capability layer: what the AI does",
    content: {
      kind: "capability-map",
      groups: [
        {
          name: "Data aggregation",
          items: [
            "Pull prior RCSA data into current cycle context",
            "Surface relevant control test results",
            "Aggregate third-party portfolio signals",
          ],
        },
        {
          name: "Draft generation",
          items: [
            "Risk narrative drafting from structured inputs",
            "Committee summary generation from cycle outputs",
            "Due diligence questionnaire pre-population",
          ],
        },
        {
          name: "Anomaly flagging",
          items: [
            "Flag rating changes from prior cycle",
            "Highlight missing or stale evidence",
            "Surface threshold breaches for escalation",
          ],
        },
        {
          name: "Evidence linking",
          items: [
            "Link uploaded documents to workflow stage",
            "Tag evidence by risk or control reference",
            "Generate evidence index for audit pack",
          ],
        },
      ],
    },
    speakerNotes:
      "This map defines the AI boundary precisely. All four capability groups are support functions: they reduce administrative burden and improve information quality for the professional. None of these capabilities replaces a risk decision. The model assists; the professional decides. Keep this framing consistent across all client conversations.",
  },
  {
    id: "app-07",
    title: "AI layer: model and infrastructure",
    content: {
      kind: "text-columns",
      columns: [
        {
          heading: "Model configuration",
          items: [
            "Claude claude-sonnet-4-6 as primary reasoning model",
            "Prompt templates per workflow stage and role",
            "Structured output schemas for all AI-generated content",
            "Evaluation harness in place: not independently verified in production",
          ],
        },
        {
          heading: "Infrastructure",
          items: [
            "Next.js application layer with API routes",
            "PostgreSQL database via Drizzle ORM",
            "Docker container deployment configured",
            "Secrets management via environment variables",
          ],
        },
      ],
    },
    speakerNotes:
      "Keep model and infrastructure detail for technical audiences. The evaluation harness is configured and runs locally; it has not been independently verified in a production environment. Configured, not independently verified is the accurate label for evaluation grounding. Do not claim production readiness for the AI evaluation layer.",
  },
  {
    id: "app-08",
    title: "Platform architecture overview",
    content: {
      kind: "three-column",
      columns: [
        {
          heading: "Application layer",
          items: [
            "Next.js 14 with App Router",
            "TypeScript throughout",
            "Tailwind CSS for UI",
            "React Server Components",
          ],
        },
        {
          heading: "Data layer",
          items: [
            "PostgreSQL (primary store)",
            "Drizzle ORM with migrations",
            "Evidence file storage",
            "Audit log tables",
          ],
        },
        {
          heading: "Integration layer",
          items: [
            "AI model API (Anthropic)",
            "Demonstration connectors only",
            "Live bank connectors: not supported",
            "OIDC identity: designed, not implemented",
          ],
        },
      ],
    },
    speakerNotes:
      "The platform is built on modern, maintainable open-source foundations. The integration layer is the area where client-specific work is required: connecting to existing GRC systems, identity providers, and data sources. Live bank system connectors do not exist. Only demonstration connectors. OIDC identity is designed but not yet implemented. Both items are on the near-term roadmap.",
  },
  {
    id: "app-09",
    title: "Identity and access model",
    content: {
      kind: "text-columns",
      columns: [
        {
          heading: "Current state",
          items: [
            "Session-based authentication implemented",
            "Role-based access control implemented",
            "User-to-role assignment via admin panel",
            "Portfolio scoping by role implemented",
          ],
        },
        {
          heading: "Planned",
          items: [
            "OIDC / SSO integration: designed, not implemented",
            "Client identity provider federation",
            "MFA enforcement at platform level",
            "Attribute-based access for data sensitivity",
          ],
        },
      ],
    },
    speakerNotes:
      "Identity is a gating question for any enterprise deployment. Current state is session-based auth with role-based access control: sufficient for a pilot with a small cohort and managed user setup. OIDC integration is on the near-term roadmap and is the right answer for enterprise rollout. Be upfront that SSO federation is not yet implemented; this is a known gap and a prioritised build item.",
  },
  {
    id: "app-10",
    title: "AI routines: implementation status",
    content: {
      kind: "status-table",
      rows: [
        {
          label: "Morning brief",
          status: "Implemented",
          note: "Seeded content renders in the work hub on login",
        },
        {
          label: "Calendar scan",
          status: "Demonstration only",
          note: "Shown in demo; not connected to a live calendar source",
        },
        {
          label: "Meeting preparation",
          status: "Implemented",
          note: "Meeting minutes entity exists in the database; preparation routine runs",
        },
        {
          label: "Minutes drafting",
          status: "Configured, not independently verified",
          note: "AI minutes drafting configured; end-to-end verification not complete",
        },
        {
          label: "Action follow-up",
          status: "Demonstration only",
          note: "Shown in demo; action tracking not connected to live workflow data",
        },
        {
          label: "Inbox triage",
          status: "Implemented",
          note: "Inbox tab exists and renders; triage routine active",
        },
        {
          label: "Evidence freshness",
          status: "Designed",
          note: "Design agreed; build not started",
        },
        {
          label: "Event monitoring",
          status: "Designed",
          note: "Design agreed; build not started",
        },
        {
          label: "End-of-day summary",
          status: "Designed",
          note: "Design agreed; build not started",
        },
      ],
    },
    speakerNotes:
      "AI routines are ambient intelligence features that run on a schedule or trigger: distinct from the on-demand AI assistance inside role app workflows. Use honest status labels for every routine. Implemented means the routine runs and produces output. Demonstration only means it can be shown but is not connected to live data. Designed means the specification exists but no build has started. Do not conflate routines with role app AI assistance; they are separate capability layers.",
  },
  {
    id: "app-11",
    title: "Evaluation and quality assurance",
    content: {
      kind: "status-table",
      rows: [
        {
          label: "Evaluation harness",
          status: "Configured, not independently verified",
          note: "Eval suite exists; has not run against live model calls in production",
        },
        {
          label: "Unit tests",
          status: "Verified locally",
          note: "Vitest suite passing locally",
        },
        {
          label: "End-to-end tests",
          status: "Verified locally",
          note: "Playwright suite covering main user journeys",
        },
        {
          label: "Load testing",
          status: "Planned",
          note: "Not yet executed; required before multi-user pilot",
        },
        {
          label: "Security review",
          status: "Planned",
          note: "Penetration test required before production deployment",
        },
      ],
    },
    speakerNotes:
      "Be honest about testing status. Unit and end-to-end tests run locally and pass. The evaluation harness for AI output quality is configured but has not been run against live model calls in a production environment. Load testing and security review are required before a multi-user pilot: both are planned and should be scheduled as part of pilot preparation. Do not claim the platform has passed a security review; it has not.",
  },
  {
    id: "app-12",
    title: "Deployment model",
    content: {
      kind: "text-columns",
      columns: [
        {
          heading: "Container deployment",
          items: [
            "Docker and docker-compose configured",
            "Environment variables for secrets",
            "Database migration scripts in place",
            "Health check endpoints implemented",
          ],
        },
        {
          heading: "Cloud deployment",
          items: [
            "Cloud deployment: configured, not independently verified",
            "No client-specific cloud environment tested",
            "Deployment pipeline: not yet automated",
            "Rollback procedure: manual at this stage",
          ],
        },
      ],
    },
    speakerNotes:
      "Deployment is configured but has not been independently verified in a client cloud environment. The Docker configuration is the correct foundation for a managed deployment. Before the pilot goes live, we need to run the deployment in the client's target environment and verify that all components come up correctly. This is a pre-pilot activity that should be scoped into the mobilisation phase.",
  },
  {
    id: "app-13",
    title: "Service model: component detail",
    content: {
      kind: "service-stack",
      tiers: [
        {
          name: "Design and Mobilisation",
          cadence: "One-time",
          includes: [
            "Current-state process workshops",
            "Role configuration and data model setup",
            "Pilot cohort onboarding and training",
            "Integration scoping and connector build",
          ],
        },
        {
          name: "Platform",
          cadence: "Recurring (monthly)",
          includes: [
            "Infrastructure and hosting",
            "AI model access and usage management",
            "Security patching and dependency updates",
            "Backup and recovery operations",
          ],
        },
        {
          name: "Function Packs",
          cadence: "Recurring (per function enabled)",
          includes: [
            "Operational Risk Pack",
            "TPRM Pack",
            "Control Assurance Pack (planned)",
          ],
        },
        {
          name: "Role Apps",
          cadence: "Per app delivered",
          includes: [
            "App design and configuration",
            "Workflow build and testing",
            "AI prompt engineering and evaluation",
            "Release and handover",
          ],
        },
        {
          name: "Managed Operations",
          cadence: "Recurring (monthly)",
          includes: [
            "Operational monitoring and alerting",
            "Model performance review",
            "New role app releases",
            "User support and adoption coaching",
          ],
        },
      ],
    },
    speakerNotes:
      "The service stack separates one-time mobilisation costs from recurring platform and operations costs. This makes the commercial structure transparent: the client pays once to design and mobilise, then pays a recurring fee for platform, function packs, and managed operations. New role apps are delivered as one-time builds that slot into the running platform without disrupting existing apps.",
  },
  {
    id: "app-14",
    title: "Commercial packaging",
    content: {
      kind: "text-columns",
      columns: [
        {
          heading: "One-time items",
          items: [
            "Design and mobilisation engagement",
            "Role App build (per app)",
            "Integration connector development",
            "Pilot cohort training and onboarding",
          ],
        },
        {
          heading: "Recurring items",
          items: [
            "Platform subscription (per month)",
            "Function pack licence (per function, per month)",
            "Managed operations (per month)",
            "Subscription metric: active role seats",
          ],
        },
      ],
    },
    speakerNotes:
      "Keep the commercial structure simple at this stage. The subscription metric is active role seats: the number of professionals using NFR OS in a given month. This aligns the commercial model with adoption: the client pays more as they use more, and we are incentivised to drive adoption. One-time items are scoped and priced per engagement. Do not quote specific numbers in the main deck; leave pricing for a separate commercial conversation.",
  },
  {
    id: "app-15",
    title: "Pilot design: detailed specification",
    content: {
      kind: "text-columns",
      columns: [
        {
          heading: "Scope",
          items: [
            "OR Partner OS only",
            "RCSA Cycle Assistant only",
            "One business unit or risk domain",
            "3 to 5 OR professionals in cohort",
          ],
        },
        {
          heading: "Timeline",
          items: [
            "Week 0 to 1: Environment setup and user onboarding",
            "Week 2 to 8: Active RCSA cycle using NFR OS",
            "Week 9 to 10: Outcome measurement and report",
            "Week 10: Decision point: expand, adjust, or stop",
          ],
        },
      ],
    },
    speakerNotes:
      "The pilot design is narrow by intent. One role, one role app, one business unit. This limits the change management burden and keeps the outcome measurement clean. The ten-week window is long enough to complete at least one RCSA cycle: the natural unit of value measurement for this role app. The decision point at week ten is explicit: the client has data and makes an informed choice about expansion.",
  },
  {
    id: "app-16",
    title: "Pilot success metrics",
    content: {
      kind: "matrix",
      rows: [
        {
          label: "Cycle time",
          cols: ["Days from scope to submission", "Baseline vs pilot cohort", "Target: 20% reduction"],
        },
        {
          label: "Evidence completeness",
          cols: ["% of stages with full evidence", "Auditor spot-check", "Target: 95%+ completeness"],
        },
        {
          label: "User adoption",
          cols: ["Active users / enrolled users", "Weekly login rate", "Target: 80%+ weekly active"],
        },
        {
          label: "AI utilisation",
          cols: ["% of AI drafts reviewed and used", "Edits made before approval", "Target: 60%+ utilisation"],
        },
        {
          label: "Audit trail quality",
          cols: ["% of decisions with complete record", "Second-line spot-check", "Target: 100% complete"],
        },
      ],
    },
    speakerNotes:
      "These five metrics form the pilot scorecard. Agree the baseline measurement approach with the client before the pilot starts: without a baseline, the improvement claim is not credible. Cycle time is the headline metric because it is the most visible and easiest to verify. Evidence completeness and audit trail quality are the risk quality metrics. User adoption and AI utilisation tell us whether the product is being used as designed.",
  },
  {
    id: "app-17",
    title: "Stakeholder map for pilot",
    content: {
      kind: "text-columns",
      columns: [
        {
          heading: "Client stakeholders",
          items: [
            "Pilot sponsor: Chief Risk Officer or OR Director",
            "Day-to-day owner: Head of OR or TPRM",
            "Pilot cohort: 3 to 5 OR Partners",
            "Second-line observer: Risk Oversight or Audit",
            "IT liaison: for deployment and data access",
          ],
        },
        {
          heading: "Accenture team",
          items: [
            "Engagement lead: senior delivery accountability",
            "Solution architect: platform and integration",
            "OR specialist: process and workflow configuration",
            "AI engineer: prompt and evaluation support",
            "Change manager: adoption and training",
          ],
        },
      ],
    },
    speakerNotes:
      "The stakeholder map is a starting point for the pilot mobilisation conversation. The key client relationship is between the pilot sponsor and the engagement lead: they set the ambition and resolve blockers. The cohort of OR professionals is the user group whose experience determines adoption. The second-line observer role is important: having risk oversight or audit engaged in the pilot from the start builds confidence in the outputs.",
  },
  {
    id: "app-18",
    title: "Change management approach",
    content: {
      kind: "process-flow",
      steps: [
        {
          name: "Awareness",
          output: "Cohort understands why the pilot exists and what will change",
        },
        {
          name: "Readiness",
          output: "Training completed; users can navigate the work hub and role apps",
        },
        {
          name: "Adoption",
          output: "Users completing workflow stages; AI assistance being used",
        },
        {
          name: "Embedding",
          output: "NFR OS is the default way to run an RCSA cycle",
        },
      ],
    },
    speakerNotes:
      "Change management for a small pilot cohort is lightweight but essential. The four stages mirror standard adoption curves. The key risk is that professionals revert to familiar tools (spreadsheets, email) when the new system adds friction. The change management approach focuses on reducing that friction in the first two weeks and demonstrating value through the AI drafting capability by week three at the latest.",
  },
  {
    id: "app-19",
    title: "Integration options and constraints",
    content: {
      kind: "status-table",
      rows: [
        {
          label: "Demonstration connectors",
          status: "Implemented",
          note: "Synthetic data connectors for demo and pilot",
        },
        {
          label: "GRC system connector (generic)",
          status: "Planned",
          note: "API-based; requires client GRC system API access",
        },
        {
          label: "SharePoint document retrieval",
          status: "Planned",
          note: "Graph API integration; requires client tenant permissions",
        },
        {
          label: "Identity provider (OIDC)",
          status: "Designed, not implemented",
          note: "Required for SSO; build scheduled",
        },
        {
          label: "Live bank system connectors",
          status: "Not supported",
          note: "Only demonstration connectors exist; live connectors require custom build",
        },
        {
          label: "Regulatory reporting APIs",
          status: "Planned",
          note: "Roadmap item; not in pilot scope",
        },
      ],
    },
    speakerNotes:
      "Integration is the area of highest client-specific variation. Be clear about what exists and what requires custom build. Live bank system connectors are not supported: this is a material limitation for clients who need NFR OS to pull data directly from core banking or risk systems. For the pilot, demonstration connectors are sufficient. The integration build is part of the mobilisation scope for full deployment.",
  },
  {
    id: "app-20",
    title: "Deployment profiles",
    content: {
      kind: "status-table",
      rows: [
        {
          label: "Restricted local demonstration",
          status: "Implemented",
          note: "Current running mode (identity layer: \"demonstration\"). Single user, synthetic data, no external integrations. Used for all current demos.",
        },
        {
          label: "Design-partner dedicated deployment",
          status: "Configured, not independently verified",
          note: "Identity layer mode: \"design-partner\". Dedicated tenant; supports client data and integration-ready configuration. Deployment not yet run in a client environment.",
        },
        {
          label: "Customer-managed private deployment",
          status: "Designed",
          note: "Client runs the platform in their own infrastructure. Architecture designed; build and deployment testing not started.",
        },
        {
          label: "Bank private-cloud deployment",
          status: "Designed",
          note: "Highly restricted deployment for financial institutions requiring air-gapped or private-cloud hosting. Design agreed; not built.",
        },
      ],
    },
    speakerNotes:
      "The four deployment profiles correspond to increasing levels of client control and data sensitivity. The restricted local demonstration profile is what runs today: it uses the \"demonstration\" identity mode and is the basis for all current product walkthroughs. The design-partner profile (\"design-partner\" mode) is the right profile for a paid pilot; it is configured but has not been verified in a client environment. Customer-managed and bank private-cloud profiles are designed for clients with strict data residency or infrastructure requirements: neither is built yet. Always name the mode by its display name (demonstration, design-partner) not by internal code identifiers.",
  },
  {
    id: "app-21",
    title: "NFR OS: product roadmap overview",
    content: {
      kind: "matrix",
      rows: [
        {
          label: "Near term (0 to 6 months)",
          cols: ["OIDC / SSO integration", "Load testing and security review", "GRC system connector (first client)", "Control Assurance Role App build"],
        },
        {
          label: "Medium term (6 to 12 months)",
          cols: ["Incident and Resilience Role Apps", "Regulatory Change OS", "Multi-client deployment", "AI evaluation in production"],
        },
        {
          label: "Longer term (12+ months)",
          cols: ["NFR Governance OS", "Cross-role analytics layer", "Regulatory reporting integration", "AI agent capabilities"],
        },
      ],
    },
    speakerNotes:
      "The roadmap is a directional signal, not a contractual commitment. Near-term items are what we need to complete before or shortly after the first client pilot. Medium-term items assume a successful pilot and expansion decision. Longer-term items are dependent on market feedback and commercial traction. Review the roadmap with clients as part of the expansion conversation, not as a sales tool before the pilot.",
  },
  {
    id: "app-22",
    title: "Current limitations: material and honest",
    content: {
      kind: "status-table",
      rows: [
        {
          label: "Live bank system connectors",
          status: "Not supported",
          note: "Only demonstration connectors exist; live connectors require custom build per client",
        },
        {
          label: "OIDC / SSO identity federation",
          status: "Designed, not implemented",
          note: "Session-based auth only; SSO required for enterprise rollout",
        },
        {
          label: "Evaluation grounding (live model calls)",
          status: "Configured, not independently verified",
          note: "Eval harness runs locally; not verified against production model calls",
        },
        {
          label: "Production deployment",
          status: "Configured, not independently verified",
          note: "Docker deployment configured; not run in a client cloud environment",
        },
        {
          label: "Multi-tenant isolation",
          status: "Architecture supports it; not tested",
          note: "Single-tenant deployment recommended for pilot",
        },
        {
          label: "Security / penetration test",
          status: "Planned",
          note: "Required before production deployment; not yet executed",
        },
        {
          label: "Load and performance testing",
          status: "Planned",
          note: "Required before multi-user pilot; not yet executed",
        },
        {
          label: "Regulatory compliance certification",
          status: "Not claimed",
          note: "Illustrative regulatory context, not legal advice; no certification obtained",
        },
      ],
    },
    speakerNotes:
      "This slide is included because honest limitation disclosure builds more trust than discovering gaps mid-pilot. Share it proactively with clients who are seriously evaluating a pilot. The limitations are real, known, and sequenced for resolution. None of them is a blocker for a managed pilot with a small cohort on synthetic or anonymised data. They become blockers only if the client tries to move directly to production without the planned remediation steps.",
  },
  {
    id: "app-23",
    title: "DACH regulatory context",
    content: {
      kind: "text-columns",
      columns: [
        {
          heading: "Germany and Austria (DE / AT)",
          items: [
            "MaRisk: minimum requirements for risk management. Structured evidence and documentation obligations align with NFR OS workflow design.",
            "BAIT / VAIT: IT supervision requirements. Access control, audit logging, and change management are addressed in platform design.",
            "EBA Guidelines on ICT and security risk: control documentation requirements are consistent with structured workflow outputs.",
            "BaFin oversight: supervisory expectation for explainable AI-assisted processes. Human-in-the-loop design is relevant.",
            "Illustrative regulatory context, not legal advice.",
          ],
        },
        {
          heading: "Switzerland (CH)",
          items: [
            "FINMA Circular 2023/1 on operational risk: documentation and evidence requirements are addressed in workflow design.",
            "FINMA Circular 2008/21 on operational risks (banks): risk assessment documentation obligations align with RCSA workflow outputs.",
            "nFINIG / FinSA: new financial services framework. Conduct and documentation requirements are consistent with audit trail design.",
            "Swiss Data Act: data localisation considerations for AI model calls. Client-specific configuration required.",
            "Illustrative regulatory context, not legal advice.",
          ],
        },
      ],
    },
    speakerNotes:
      "DACH regulatory context is included for conversations with German, Austrian, and Swiss clients. Keep DE/AT and CH in separate lanes: the regulatory regimes are distinct. The consistent message is that NFR OS workflow design is aligned with the documentation, evidence, and audit trail expectations common across these frameworks. We are not claiming regulatory compliance. These are illustrative points of alignment. Clients should validate specific compliance requirements with their legal and compliance functions. Illustrative regulatory context, not legal advice.",
  },
];
