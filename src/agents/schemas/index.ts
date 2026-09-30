/**
 * Structured output schemas.
 *
 * The central rule, enforced by the type system rather than by a prompt
 * instruction: verified fact, approved record, stakeholder statement and model
 * inference never share a field. Every agent output that reaches the interface
 * carries a `grounding` block whose sections are separate arrays, so the
 * interface can render them with different styling and a reader can always see
 * which category a sentence belongs to.
 *
 * A model that wants to assert something it cannot cite has exactly one place
 * to put it: `grounding.modelInference`, which the interface labels as such.
 */

import { z } from "zod";

/* ==========================================================================
   Primitives
   ========================================================================== */

export const provenanceKindSchema = z.enum([
  "verified-fact",
  "approved-record",
  "stakeholder-statement",
  "model-inference",
  "conflicting-evidence",
  "telemetry",
]);

/** A citation. Every grounded statement carries at least one. */
export const sourceReferenceSchema = z.object({
  evidenceId: z.string().describe("Identifier of the evidence document, for example EVD-014."),
  sourceType: z.string().describe("The kind of source, for example control-test-report."),
  locator: z.string().describe("Section, paragraph or page within the document."),
  timestamp: z.string().describe("Date or time of the source, as recorded."),
  entityId: z.string().describe("Legal entity the source relates to."),
  excerpt: z.string().max(600).describe("Short quoted excerpt. Never paraphrased here."),
  status: z.string().describe("Document status, for example current, superseded or requested."),
});

export type SourceReference = z.infer<typeof sourceReferenceSchema>;

/** One assertion, with its category and its sources. */
export const groundedStatementSchema = z.object({
  statement: z.string().describe("One sentence. Do not merge categories."),
  provenance: provenanceKindSchema,
  sourceIds: z.array(z.string()).describe("Evidence identifiers supporting this statement."),
  /** Only meaningful for inference and telemetry. */
  confidence: z.number().min(0).max(1).nullable(),
});

export type GroundedStatement = z.infer<typeof groundedStatementSchema>;

/**
 * The mandatory grounding block.
 *
 * Note that these are separate arrays rather than one list with a tag field.
 * That is deliberate: a single tagged list invites a model to produce a
 * plausible looking entry with the wrong tag, and invites an interface to
 * render them uniformly. Separate arrays make the distinction structural.
 */
export const groundingSchema = z.object({
  verifiedFacts: z.array(groundedStatementSchema).describe("Facts confirmed against a system of record."),
  approvedRecords: z.array(groundedStatementSchema).describe("What the approved records currently state."),
  stakeholderStatements: z.array(groundedStatementSchema).describe("What people asserted. Not yet verified."),
  modelInference: z.array(groundedStatementSchema).describe("The model's own reasoning. Clearly separated."),
  conflictingEvidence: z.array(groundedStatementSchema).describe("Evidence that points the other way."),
});

export type Grounding = z.infer<typeof groundingSchema>;

export const uncertaintyItemSchema = z.object({
  topic: z.string(),
  description: z.string().describe("What is not known, stated plainly."),
  /** "missing-evidence", "conflicting-evidence", "stale-evidence", "judgment-required", "out-of-scope". */
  kind: z.enum([
    "missing-evidence",
    "conflicting-evidence",
    "stale-evidence",
    "judgment-required",
    "out-of-scope",
  ]),
  /** What would resolve it. */
  resolutionPath: z.string(),
  materialToDecision: z.boolean(),
  sourceIds: z.array(z.string()),
});

export type UncertaintyItem = z.infer<typeof uncertaintyItemSchema>;

export const contradictionSchema = z.object({
  id: z.string(),
  summary: z.string().describe("What conflicts with what, in one sentence."),
  firstClaim: groundedStatementSchema,
  secondClaim: groundedStatementSchema,
  /** Why this matters for the decision at hand. */
  significance: z.string(),
  /** "unresolved", "resolved-in-favour-of-first", "resolved-in-favour-of-second", "both-partly-correct". */
  resolutionState: z.enum([
    "unresolved",
    "resolved-in-favour-of-first",
    "resolved-in-favour-of-second",
    "both-partly-correct",
  ]),
  resolutionNote: z.string(),
  detectedAtMoment: z.string(),
});

export type Contradiction = z.infer<typeof contradictionSchema>;

/** An action the agent proposes. It is a proposal, never an execution. */
export const proposedActionSchema = z.object({
  toolName: z.string().describe("A tool that exists in the authority registry."),
  description: z.string(),
  rationale: z.string(),
  /** Arguments the tool would receive. Validated by the tool's own schema. */
  payloadSummary: z.string(),
  /** "READ", "DRAFT", "PROPOSE", "APPROVAL_REQUIRED" or "POLICY_BOUND_AUTONOMOUS". */
  authorityClass: z.string(),
  requiresHumanApproval: z.boolean(),
  requiredAuthority: z.string().describe("The authority a person needs to approve this."),
  reversible: z.boolean(),
  /** What would change if this executed. */
  expectedConsequences: z.array(z.string()),
});

export type ProposedAction = z.infer<typeof proposedActionSchema>;

/** Every recommendation carries alternatives. A single option is not advice. */
export const recommendationCoreSchema = z.object({
  recommendedAction: proposedActionSchema,
  alternativeActions: z.array(proposedActionSchema).describe("Genuine alternatives, not strawmen."),
  /** The human authority required to decide. Stated on every recommendation. */
  requiredHumanAuthority: z.string(),
  /** Why the professional, not the system, must decide this. */
  whyHumanDecides: z.string(),
});

/* ==========================================================================
   Outputs
   ========================================================================== */

export const decisionBriefItemSchema = z.object({
  decisionId: z.string(),
  title: z.string(),
  question: z.string().describe("The professional question, as a practitioner would ask it."),
  judgmentKind: z.string(),
  priorityRank: z.number().int(),
  whyThisMatters: z.string(),
  preparedPosition: z.string(),
  grounding: groundingSchema,
  uncertainty: z.array(uncertaintyItemSchema),
  confidence: z.number().min(0).max(1),
  requiredAuthority: z.string(),
  /** Deadline or driver, for example a committee date. */
  timeDriver: z.string(),
});

export const decisionBriefSchema = z.object({
  schemaName: z.literal("DecisionBrief"),
  roleId: z.string(),
  roleTitle: z.string(),
  entityId: z.string(),
  atMoment: z.string(),
  /** One or two sentences. The first thing the professional reads. */
  headline: z.string(),
  /** Ranked decisions. The brief opens with judgment, not notifications. */
  decisions: z.array(decisionBriefItemSchema),
  /** What the agents completed overnight, counted from seeded actions. */
  backgroundWorkSummary: z.array(z.string()),
  /** Items explicitly not escalated, and why. Absence of noise is a claim too. */
  handledWithoutYou: z.array(z.string()),
  grounding: groundingSchema,
  uncertainty: z.array(uncertaintyItemSchema),
});

export type DecisionBrief = z.infer<typeof decisionBriefSchema>;

export const evidenceSummarySchema = z.object({
  schemaName: z.literal("EvidenceSummary"),
  query: z.string(),
  atMoment: z.string(),
  /** The answer, explicitly grounded. */
  answer: z.string(),
  grounding: groundingSchema,
  sources: z.array(sourceReferenceSchema),
  uncertainty: z.array(uncertaintyItemSchema),
  contradictions: z.array(contradictionSchema),
  /** Proportion of the answer that rests on cited sources. */
  sourceCoverage: z.number().min(0).max(1),
  /** True when the corpus does not contain enough to answer. */
  insufficientEvidence: z.boolean(),
});

export type EvidenceSummary = z.infer<typeof evidenceSummarySchema>;

export const challengeQuestionSchema = z.object({
  id: z.string(),
  question: z.string().describe("A question a senior practitioner would actually ask."),
  /** What the question is testing. */
  intent: z.string(),
  /** The evidence that makes the question fair. */
  sourceIds: z.array(z.string()),
  /** What a satisfactory answer would contain. */
  satisfactoryAnswerCriteria: z.string(),
  /** What an evasive answer would look like. */
  evasionSignals: z.array(z.string()),
  addressedTo: z.string().describe("Who should answer, by role."),
  priority: z.enum(["must-ask", "should-ask", "if-time-permits"]),
});

export const challengeQuestionSetSchema = z.object({
  schemaName: z.literal("ChallengeQuestionSet"),
  meetingId: z.string(),
  objective: z.string(),
  questions: z.array(challengeQuestionSchema),
  grounding: groundingSchema,
  uncertainty: z.array(uncertaintyItemSchema),
});

export const riskRecommendationSchema = z.object({
  schemaName: z.literal("RiskRecommendation"),
  subjectKind: z.string(),
  subjectId: z.string(),
  /** The proposed residual position, computed by the calculator not the model. */
  proposedResidualLikelihood: z.number().int().min(1).max(5),
  proposedResidualImpact: z.number().int().min(1).max(5),
  proposedResidualRating: z.string(),
  appetitePosition: z.enum(["within", "at-limit", "outside"]),
  /** The methodology statement the calculator produced. */
  methodologyNote: z.string(),
  grounding: groundingSchema,
  uncertainty: z.array(uncertaintyItemSchema),
  contradictions: z.array(contradictionSchema),
  confidence: z.number().min(0).max(1),
}).merge(recommendationCoreSchema);

export const controlAssessmentSchema = z.object({
  schemaName: z.literal("ControlAssessment"),
  controlId: z.string(),
  controlReference: z.string(),
  /** The second line proposed effectiveness. */
  proposedEffectiveness: z.enum([
    "not-effective",
    "partially-effective",
    "largely-effective",
    "fully-effective",
    "not-assessed",
  ]),
  /** What first line currently asserts, kept separate. */
  firstLineAssertedEffectiveness: z.string(),
  /** Why the two differ, when they do. */
  divergenceExplanation: z.string(),
  /** What would have to be true for the first line position to hold. */
  whatMustBeTrueForCurrentRating: z.array(z.string()),
  designConclusion: z.string(),
  operatingConclusion: z.string(),
  grounding: groundingSchema,
  uncertainty: z.array(uncertaintyItemSchema),
  contradictions: z.array(contradictionSchema),
  confidence: z.number().min(0).max(1),
}).merge(recommendationCoreSchema);

export const supplierAssessmentSchema = z.object({
  schemaName: z.literal("SupplierAssessment"),
  supplierId: z.string(),
  supplierName: z.string(),
  proposedCriticality: z.enum(["critical", "important", "standard"]),
  /** Gaps, each one tied to a contractual or policy requirement. */
  gaps: z.array(
    z.object({
      id: z.string(),
      description: z.string(),
      obligationReference: z.string().describe("The clause or policy section the gap sits against."),
      /** Why this gap matters, in risk terms rather than compliance terms. */
      whyItMatters: z.string(),
      severity: z.enum(["low", "medium", "high"]),
      evidenceStatus: z.enum(["met", "partially-met", "not-evidenced", "breached"]),
      sourceIds: z.array(z.string()),
      remediationCredibility: z.string().describe("Assessment of the supplier's proposed fix."),
    }),
  ),
  /** Fourth party exposure, including any appendix and submission mismatch. */
  fourthPartyConcerns: z.array(z.string()),
  /** Conditions that would make an approval defensible. */
  proposedConditions: z.array(
    z.object({
      condition: z.string(),
      dueBy: z.string(),
      consequenceIfMissed: z.string(),
    }),
  ),
  grounding: groundingSchema,
  uncertainty: z.array(uncertaintyItemSchema),
  contradictions: z.array(contradictionSchema),
  confidence: z.number().min(0).max(1),
}).merge(recommendationCoreSchema);

export const findingProposalSchema = z.object({
  schemaName: z.literal("FindingProposal"),
  controlTestId: z.string(),
  controlId: z.string(),
  title: z.string(),
  condition: z.string().describe("What was observed."),
  criteria: z.string().describe("What should have happened, and per which requirement."),
  cause: z.string().describe("Why it happened, clearly marked as analysis."),
  effect: z.string().describe("What the consequence is."),
  proposedSeverity: z.enum(["low", "medium", "high", "critical"]),
  /** Isolated or systemic is a human decision; this is the proposal. */
  proposedScope: z.enum(["isolated", "systemic", "indeterminate"]),
  scopeReasoning: z.string(),
  populationSize: z.number().int(),
  exceptionsIdentified: z.number().int(),
  /** Response to the disputed management response, when one exists. */
  managementResponseAssessment: z.string(),
  grounding: groundingSchema,
  uncertainty: z.array(uncertaintyItemSchema),
  contradictions: z.array(contradictionSchema),
  confidence: z.number().min(0).max(1),
}).merge(recommendationCoreSchema);

export const incidentRecommendationSchema = z.object({
  schemaName: z.literal("IncidentRecommendation"),
  incidentId: z.string(),
  proposedSeverity: z.enum(["low", "medium", "high", "critical"]),
  proposedClassification: z.string(),
  /** The chronology as currently established, with provenance per entry. */
  chronology: z.array(
    z.object({
      atMoment: z.string(),
      statement: z.string(),
      provenance: provenanceKindSchema,
      sourceLabel: z.string(),
      sourceIds: z.array(z.string()),
      confidence: z.number().min(0).max(1).nullable(),
    }),
  ),
  affectedServiceIds: z.array(z.string()),
  /** Tolerance status per service, computed by the calculator. */
  toleranceStatus: z.array(
    z.object({
      serviceId: z.string(),
      metric: z.string(),
      remainingMinutes: z.number(),
      state: z.string(),
    }),
  ),
  /** Whether a supervisory notification should be recommended, and why. */
  notificationConsideration: z.string(),
  notificationJurisdictionNote: z.string().describe("Keeps EU and Swiss contexts distinct."),
  grounding: groundingSchema,
  uncertainty: z.array(uncertaintyItemSchema),
  contradictions: z.array(contradictionSchema),
  confidence: z.number().min(0).max(1),
}).merge(recommendationCoreSchema);

export const meetingObservationSchema = z.object({
  schemaName: z.literal("MeetingObservation"),
  meetingId: z.string(),
  atMoment: z.string(),
  /** What a participant said, quoted, never paraphrased into a fact. */
  observedStatement: z.string(),
  speakerLabel: z.string(),
  /** The observation the assistant makes about it. */
  observation: z.string(),
  /** "contradiction", "unsupported-claim", "scope-gap", "agreement", "commitment". */
  observationKind: z.enum([
    "contradiction",
    "unsupported-claim",
    "scope-gap",
    "agreement",
    "commitment",
  ]),
  contradiction: contradictionSchema.nullable(),
  suggestedFollowUp: z.string(),
  grounding: groundingSchema,
  confidence: z.number().min(0).max(1),
});

export const executionReceiptSchema = z.object({
  schemaName: z.literal("ExecutionReceipt"),
  decisionId: z.string(),
  approvalId: z.string(),
  approvedBy: z.string(),
  executedAtMoment: z.string(),
  /** Each line corresponds to a real database mutation that succeeded. */
  lines: z.array(
    z.object({
      statement: z.string(),
      objectKind: z.string(),
      objectId: z.string(),
      changeKind: z.string(),
      auditEventId: z.string(),
      reversible: z.boolean(),
    }),
  ),
  /** Actions that were proposed but not executed, and why. */
  notExecuted: z.array(z.object({ statement: z.string(), reason: z.string() })),
});

export type ExecutionReceipt = z.infer<typeof executionReceiptSchema>;

export const endOfDaySummarySchema = z.object({
  schemaName: z.literal("EndOfDaySummary"),
  roleId: z.string(),
  atMoment: z.string(),
  headline: z.string(),
  /** Decisions the human took today, with their recorded rationale. */
  decisionsTaken: z.array(
    z.object({
      decisionId: z.string(),
      title: z.string(),
      chosen: z.string(),
      rationale: z.string(),
      atMoment: z.string(),
    }),
  ),
  /** What changed in the systems of record as a result. */
  stateChanges: z.array(z.string()),
  /** What remains open, and what is blocking it. */
  openItems: z.array(z.object({ item: z.string(), blockedBy: z.string(), dueOn: z.string() })),
  /** What the agents will do overnight, within policy. */
  overnightWork: z.array(z.string()),
  /** Uncertainties carried into tomorrow. */
  uncertainty: z.array(uncertaintyItemSchema),
  grounding: groundingSchema,
});

export const portfolioThreadSchema = z.object({
  schemaName: z.literal("PortfolioThread"),
  themeId: z.string(),
  title: z.string(),
  /** The same matter as each function sees it. */
  lenses: z.array(
    z.object({
      roleId: z.string(),
      roleTitle: z.string(),
      /** The different professional question this function asks. */
      professionalQuestion: z.string(),
      position: z.string(),
      decisionIds: z.array(z.string()),
      confidence: z.number().min(0).max(1),
      sourceIds: z.array(z.string()),
    }),
  ),
  /** Where the same fact would be reported more than once today. */
  duplicateReporting: z.array(z.string()),
  /** The consolidated narrative, for human approval before it is used. */
  consolidatedNarrative: z.string(),
  proposedMateriality: z.enum(["low", "medium", "high", "critical"]),
  grounding: groundingSchema,
  uncertainty: z.array(uncertaintyItemSchema),
  contradictions: z.array(contradictionSchema),
}).merge(recommendationCoreSchema);

/* ==========================================================================
   Registry
   ========================================================================== */

export const SCHEMA_REGISTRY = {
  DecisionBrief: decisionBriefSchema,
  EvidenceSummary: evidenceSummarySchema,
  ChallengeQuestionSet: challengeQuestionSetSchema,
  RiskRecommendation: riskRecommendationSchema,
  ControlAssessment: controlAssessmentSchema,
  SupplierAssessment: supplierAssessmentSchema,
  FindingProposal: findingProposalSchema,
  IncidentRecommendation: incidentRecommendationSchema,
  MeetingObservation: meetingObservationSchema,
  ExecutionReceipt: executionReceiptSchema,
  EndOfDaySummary: endOfDaySummarySchema,
  PortfolioThread: portfolioThreadSchema,
} as const;

export type SchemaName = keyof typeof SCHEMA_REGISTRY;

/** An empty grounding block, for seeded content that fills sections directly. */
export function emptyGrounding(): Grounding {
  return {
    verifiedFacts: [],
    approvedRecords: [],
    stakeholderStatements: [],
    modelInference: [],
    conflictingEvidence: [],
  };
}

/**
 * Validates a payload against a named schema.
 *
 * Used on every model output before it reaches the interface, and on every
 * cached output at seed time so a malformed cached beat fails the seed rather
 * than the demonstration.
 */
export function validateAgainstSchema(
  schemaName: SchemaName,
  payload: unknown,
): { ok: true; data: unknown } | { ok: false; errors: string[] } {
  const schema = SCHEMA_REGISTRY[schemaName];
  const result = schema.safeParse(payload);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    errors: result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
  };
}
