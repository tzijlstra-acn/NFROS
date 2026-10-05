export interface ServiceComponent {
  name: string;
  type: "one-time" | "recurring" | "per-delivery";
  description: string;
  includes: string[];
}

export const SERVICE_COMPONENTS: ServiceComponent[] = [
  {
    name: "Design and Mobilisation",
    type: "one-time",
    description:
      "Structured engagement to configure the platform, onboard the pilot cohort, and integrate with existing client systems.",
    includes: [
      "Current-state process workshops and role mapping",
      "Platform environment setup in client infrastructure",
      "Role configuration: portfolio scoping, user setup, access control",
      "Data model alignment with client risk taxonomy",
      "Integration scoping and demonstration connector configuration",
      "Pilot cohort training and onboarding programme",
      "Change management plan and communication materials",
    ],
  },
  {
    name: "Platform",
    type: "recurring",
    description:
      "Ongoing managed platform providing the infrastructure, AI model access, security, and operations that all role apps run on.",
    includes: [
      "Application hosting and infrastructure management",
      "AI model access and usage governance",
      "Security patching and dependency maintenance",
      "Backup, recovery, and business continuity operations",
      "Health monitoring and incident response",
      "Platform version upgrades and migration management",
    ],
  },
  {
    name: "Function Packs",
    type: "recurring",
    description:
      "Modular capability packs that enable a risk function within the platform. Each pack includes the role operating system and baseline configuration for that function.",
    includes: [
      "Operational Risk Pack: OR Partner OS, work hub, base configuration",
      "TPRM Pack: TPRM Manager OS, work hub, base configuration",
      "Control Assurance Pack (planned): role shell and workflow foundation",
      "Function pack updates and new role additions",
    ],
  },
  {
    name: "Role Apps",
    type: "per-delivery",
    description:
      "Process-specific workflow modules delivered as discrete build engagements. Each role app is designed, built, validated, and released into the running platform.",
    includes: [
      "Process design workshop and workflow specification",
      "Six-stage workflow build and AI prompt engineering",
      "Evidence schema and audit trail configuration",
      "User acceptance testing with pilot cohort",
      "Release documentation and handover",
      "Post-release evaluation and iteration (first 30 days)",
    ],
  },
  {
    name: "Managed Operations",
    type: "recurring",
    description:
      "Ongoing operational service covering monitoring, model performance, new app releases, and user support across all deployed role apps.",
    includes: [
      "24x5 platform monitoring and alerting",
      "Monthly model performance review and prompt refinement",
      "New role app releases: delivery, testing, and release into production",
      "User adoption coaching and onboarding for new cohort members",
      "Quarterly service review with client sponsor",
      "Regulatory and product update briefings",
    ],
  },
];

export interface CommercialPackaging {
  subscriptionMetric: string;
  recurringComponents: string[];
  oneTimeComponents: string[];
  pricingNote: string;
}

export const COMMERCIAL_PACKAGING: CommercialPackaging = {
  subscriptionMetric: "Active role seats (number of professionals actively using NFR OS per month)",
  recurringComponents: [
    "Platform subscription: per month, regardless of seat count",
    "Function pack licence: per function enabled, per month",
    "Managed operations: per month, scales with number of active apps",
    "Subscription seats: per active user per month above base threshold",
  ],
  oneTimeComponents: [
    "Design and mobilisation engagement: scoped per client",
    "Role App build: per app, scoped at design stage",
    "Integration connector development: per connector, varies by system",
    "Cohort training and onboarding: included in mobilisation or per expansion",
  ],
  pricingNote:
    "Specific pricing is subject to commercial negotiation. The model above represents the structure, not quoted rates. Pilot commercial terms are typically simplified: a fixed mobilisation fee plus a platform subscription for the pilot duration.",
};

export interface RolloutStep {
  step: number;
  name: string;
  duration: string;
  activities: string[];
  outputs: string[];
  successCriteria: string[];
}

export const ROLLOUT_STEPS: RolloutStep[] = [
  {
    step: 1,
    name: "Pilot",
    duration: "10 weeks",
    activities: [
      "Platform deployment in client environment (weeks 0-1)",
      "User onboarding and training for cohort (week 1)",
      "Active RCSA cycle using OR Partner OS and RCSA Cycle Assistant (weeks 2-8)",
      "Weekly check-in with cohort and sponsor",
      "Outcome data collection throughout",
      "Pilot outcome report preparation (weeks 9-10)",
    ],
    outputs: [
      "Verified cycle time comparison (baseline vs pilot)",
      "Evidence completeness audit",
      "User adoption and AI utilisation metrics",
      "Audit trail quality assessment",
      "Cohort feedback and qualitative findings",
      "Pilot outcome report with expansion recommendation",
    ],
    successCriteria: [
      "At least one complete RCSA cycle delivered through NFR OS",
      "80%+ weekly active user rate in cohort",
      "Measurable improvement in at least two of five pilot metrics",
      "Sponsor confidence to proceed to step 2",
    ],
  },
  {
    step: 2,
    name: "Prove",
    duration: "12-16 weeks",
    activities: [
      "Pilot outcome review and expansion scoping session",
      "One additional role app selected and built (typically TPRM Onboarding or Event-Driven Reassessment)",
      "Expanded cohort onboarding (add 3-5 more users)",
      "Second function pack enabled if TPRM is selected",
      "Outcome measurement continues with expanded scope",
      "Commercial model agreed for programme phase",
    ],
    outputs: [
      "Second role app in production",
      "Expanded cohort active and adopted",
      "Cross-role usage patterns and insights",
      "Confirmed commercial structure for programme",
      "Programme scope and timeline agreed",
    ],
    successCriteria: [
      "Second role app successfully deployed and used",
      "Expanded cohort adoption meets pilot benchmarks",
      "Client sponsor commits to programme investment",
    ],
  },
  {
    step: 3,
    name: "Scale",
    duration: "Ongoing (quarterly increments)",
    activities: [
      "Full function pack enabled (OR and TPRM, then Control Assurance)",
      "Role app catalogue expanded per agreed roadmap",
      "Managed operations fully active",
      "Quarterly service reviews and roadmap updates",
      "New role onboarding as scope expands",
      "AI evaluation and model performance reviews on cadence",
    ],
    outputs: [
      "Full OR and TPRM function packs in production",
      "Four or more role apps running concurrently",
      "Managed operations delivering continuous improvement",
      "Client-specific role app roadmap agreed for next 12 months",
      "NFR OS as the default operating environment for enrolled risk functions",
    ],
    successCriteria: [
      "All enrolled risk professionals using NFR OS as primary work interface",
      "New role apps delivered on quarterly cadence",
      "Client satisfaction score above agreed threshold",
      "Measurable risk work quality improvement sustained across functions",
    ],
  },
];

export interface CoreQuestion {
  id: string;
  question: string;
  answer: string;
  audience: "executive" | "technical" | "risk-professional" | "any";
}

export const CORE_QUESTIONS: CoreQuestion[] = [
  {
    id: "q-01",
    question: "Is this replacing our GRC system?",
    answer:
      "No. NFR OS sits above existing GRC systems as an orchestration layer. It connects to what you already have and organises the work for the professional; it does not replace the data store or the system of record. In the pilot phase, it may run alongside existing systems without any integration required.",
    audience: "executive",
  },
  {
    id: "q-02",
    question: "What does the AI actually do?",
    answer:
      "The AI aggregates data from multiple sources, drafts narrative outputs for professional review, flags anomalies and rating changes, and links evidence to the relevant workflow stage. It does not make risk decisions; every rating, approval, and escalation remains with the professional. The AI does the groundwork; the professional does the judgment.",
    audience: "risk-professional",
  },
  {
    id: "q-03",
    question: "Where does our data go?",
    answer:
      "For the pilot, data stays in a client-controlled deployment. NFR OS is deployed in the client's infrastructure or a dedicated tenant, not a shared multi-client environment. AI model calls use the Anthropic API; data sent to the model is governed by the Anthropic API terms and can be configured to exclude personally identifiable information.",
    audience: "technical",
  },
  {
    id: "q-04",
    question: "How long before we see value?",
    answer:
      "The pilot is designed to produce measurable outcomes by week ten: at least one complete RCSA cycle with verified cycle time and evidence quality data. Most pilot cohort members report reduced coordination overhead within the first two weeks of active use. The outcome report at week ten provides the evidence base for the expansion decision.",
    audience: "executive",
  },
  {
    id: "q-05",
    question: "Can it connect to our internal systems?",
    answer:
      "Integration is possible but requires custom connector development. Live connections to core banking, GRC platforms, or data warehouses are not pre-built; they are scoped and built per client as part of the mobilisation engagement. The pilot typically uses demonstration connectors with anonymised or synthetic data to avoid integration dependency on the critical path.",
    audience: "technical",
  },
  {
    id: "q-06",
    question: "What happens if the AI makes an error?",
    answer:
      "The professional reviews all AI-generated content before it progresses in the workflow. A draft risk narrative cannot be submitted to committee without an authorised professional approving it. The system is designed so that AI errors are caught at the review stage, not discovered after the fact. The evaluation harness monitors output quality on an ongoing basis.",
    audience: "risk-professional",
  },
  {
    id: "q-07",
    question: "Does this meet our regulatory requirements?",
    answer:
      "NFR OS is designed to support the documentation, evidence, and audit trail expectations common across major NFR regulatory frameworks in the UK, EU, and DACH. We do not claim regulatory compliance; that determination requires your legal and compliance teams to review the specific requirements against the platform design. Illustrative regulatory context, not legal advice.",
    audience: "executive",
  },
  {
    id: "q-08",
    question: "How many people need to be involved in the pilot?",
    answer:
      "The pilot cohort is deliberately small: three to five OR professionals in one business unit. A pilot sponsor at director or CRO level is required for decision-making. An IT liaison is needed for deployment support. A second-line observer from risk oversight or audit is strongly recommended. Total client involvement is typically six to ten people for the ten-week pilot.",
    audience: "any",
  },
  {
    id: "q-09",
    question: "What is the commitment after the pilot?",
    answer:
      "The pilot ends with a decision point, not an automatic commitment to scale. The outcome report at week ten gives the client the evidence to decide: expand the scope, adjust the approach, or stop. There is no lock-in after the pilot. If the client decides to proceed to programme, the commercial structure is agreed at that point based on the expanded scope.",
    audience: "executive",
  },
];
