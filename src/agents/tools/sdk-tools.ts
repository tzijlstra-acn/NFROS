/**
 * Agents SDK tool definitions.
 *
 * Each SDK tool is a thin shell whose `execute` routes into `executeTool`.
 * That is the whole point of the indirection: the model's view of a tool and
 * the governed path are the same code, so a tool cannot be reachable from the
 * model without passing the authority gate first.
 *
 * Note that no tool here writes to the database directly, and no tool receives
 * a database handle. The widest capability any of them has is to ask the
 * runtime to attempt something.
 */

import { tool } from "@openai/agents";
import { z } from "zod";
import { TOOL_REGISTRY } from "@/server/security/authority";
import { executeTool, hasToolHandler, type ToolContext } from "./runtime";
import "./reads";
import "./mutations";

/**
 * Argument schemas per tool. Only tools with a schema are offered to a model.
 *
 * The value type uses a loose object shape deliberately. Indexing a map by a
 * concrete Zod shape erases the per-entry type at the point of iteration, and
 * the SDK's tool helper then rejects the widened type. Since every entry here
 * is a plain object schema and the runtime behaviour is identical, a loose
 * shape is the honest way to express that rather than casting at each call.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
const TOOL_SCHEMAS: Record<string, z.ZodObject<any>> = {
  /* Reads */
  getDailyBrief: z.object({}),
  getRoleContext: z.object({}),
  readInbox: z.object({
    channel: z
      .enum(["mail", "collaboration", "grc-queue", "service-management", "alert"])
      .nullable()
      .describe("Restrict to one channel, or null for all channels."),
  }),
  getCalendar: z.object({}),
  getUpcomingMeetings: z.object({}),
  getOpenDecisions: z.object({}),
  getBackgroundWork: z.object({}),
  searchEvidence: z.object({
    query: z.string().describe("A natural language question about the evidence corpus."),
    limit: z.number().int().min(1).max(20).describe("Maximum number of chunks to return."),
  }),
  getEvidenceItem: z.object({
    evidenceId: z.string().describe("An evidence document identifier, for example EVD-2026-41905."),
  }),
  getApplicablePolicy: z.object({}),
  getAssessmentHistory: z.object({
    subjectId: z.string().describe("A process identifier or a supplier identifier."),
  }),
  compareAssessments: z.object({
    subjectId: z.string().describe("A process identifier or a supplier identifier."),
  }),
  getRiskControlGraph: z.object({
    processId: z.string().nullable().describe("Scope to one process, or null."),
    riskId: z.string().nullable().describe("Scope to one risk, or null."),
  }),
  getKriHistory: z.object({
    kriId: z.string().nullable().describe("One indicator identifier, or null for all."),
  }),
  getControlTestResults: z.object({
    controlTestId: z
      .string()
      .nullable()
      .describe("A control test identifier, or null to list every test."),
  }),
  getSupplierExposure: z.object({
    supplierId: z.string().describe("A supplier identifier, for example TP-0042."),
  }),
  getSupplierAssessment: z.object({ supplierId: z.string() }),
  compareSupplierSubmissions: z.object({ supplierId: z.string() }),
  getContractObligations: z.object({ supplierId: z.string() }),
  getIncidentTimeline: z.object({
    incidentId: z.string().describe("An incident identifier, for example INC-2026-0412."),
  }),
  getServiceDependencies: z.object({}),
  getPortfolioThread: z.object({
    sharedThreadId: z.string().nullable().describe("A thread identifier, or null for all themes."),
  }),
  getAuditTrail: z.object({
    objectKind: z.string().nullable(),
    objectId: z.string().nullable(),
  }),
  calculateRiskMatrixPosition: z.object({
    inherentLikelihood: z.number().int().min(1).max(5),
    inherentImpact: z.number().int().min(1).max(5),
    controlEffectiveness: z.enum([
      "not-effective",
      "partially-effective",
      "largely-effective",
      "fully-effective",
      "not-assessed",
    ]),
  }),
  calculateToleranceRemaining: z.object({
    serviceId: z.string(),
    consumedMinutes: z.number().nullable().describe("Override the recorded consumption, or null."),
  }),

  /* Policy bound autonomous */
  requestFactualValidation: z.object({
    question: z.string().describe("The factual question, phrased for the first line."),
    topic: z.string(),
    toUserIds: z.array(z.string()).describe("Recipient user identifiers, for example P-007."),
    relatedObjectKind: z.string().nullable(),
    relatedObjectId: z.string().nullable(),
  }),
  requestEvidenceDocument: z.object({
    documentDescription: z.string(),
    ownerLabel: z.string(),
    relatedObjectKind: z.string().nullable(),
    relatedObjectId: z.string().nullable(),
    dueOn: z.string().nullable(),
  }),
  sendSimulatedCollaborationMessage: z.object({
    subject: z.string(),
    body: z.string(),
    toUserIds: z.array(z.string()),
    relatedObjectKind: z.string().nullable(),
    relatedObjectId: z.string().nullable(),
  }),

  /* Approval required. The model may propose these; it cannot execute them. */
  updateControlRating: z.object({
    controlId: z.string(),
    effectiveness: z.enum([
      "not-effective",
      "partially-effective",
      "largely-effective",
      "fully-effective",
      "not-assessed",
    ]),
  }),
  createAction: z.object({
    title: z.string(),
    description: z.string(),
    kind: z.string(),
    ownerUserId: z.string().nullable(),
    dueOn: z.string().nullable(),
    relatedObjectKind: z.string().nullable(),
    relatedObjectId: z.string().nullable(),
  }),
  createIssue: z.object({
    title: z.string(),
    description: z.string(),
    kind: z.string(),
    severity: z.enum(["low", "medium", "high", "critical"]),
    relatedObjectId: z.string().nullable(),
  }),
  activateMonitoring: z.object({
    subjectKind: z.string(),
    subjectId: z.string(),
    description: z.string(),
    reviewFrequency: z.string(),
  }),
  addCommitteeAgendaItem: z.object({
    title: z.string(),
    summary: z.string(),
    itemType: z.enum(["decision", "escalation", "information", "noting"]),
    relatedObjectId: z.string().nullable(),
  }),
  classifyIncident: z.object({
    incidentId: z.string(),
    severity: z.enum(["low", "medium", "high", "critical"]),
    regulatoryClassification: z.string().nullable(),
  }),
  recordNotificationRecommendation: z.object({
    incidentId: z.string(),
    recommended: z.boolean(),
    rationale: z.string(),
  }),
  setSupplierCriticality: z.object({
    supplierId: z.string(),
    criticality: z.enum(["critical", "important", "standard"]),
  }),
  recordTestConclusion: z.object({
    controlTestId: z.string(),
    conclusion: z.string(),
  }),
  classifyTestException: z.object({
    testCaseId: z.string(),
    classification: z.string(),
    scope: z.enum(["isolated", "systemic", "indeterminate"]),
    rootCause: z.string().nullable(),
  }),
  recordObligationInterpretation: z.object({
    obligationId: z.string(),
    applicabilityDecision: z.enum(["applicable", "not-applicable", "partially-applicable"]),
    rationale: z.string(),
  }),

  /* Prohibited. Offered deliberately, so refusal is observable and testable. */
  sendExternalEmail: z.object({ to: z.string(), subject: z.string(), body: z.string() }),
  notifySupervisor: z.object({ authority: z.string(), incidentId: z.string() }),
};

/**
 * Builds the SDK tool set for a context.
 *
 * The prohibited tools are included on purpose. Hiding them would mean the
 * only evidence that they are refused is our own assertion; offering them and
 * having the gate refuse produces an audit record that proves it.
 */
export function buildSdkTools(context: ToolContext) {
  const tools = [];

  for (const [name, schema] of Object.entries(TOOL_SCHEMAS)) {
    const definition = TOOL_REGISTRY[name];
    if (!definition) continue;

    // A permitted tool with no handler would fail at call time; skip it rather
    // than offering the model something that cannot work. Prohibited tools
    // have no handler by design and are still offered.
    if (definition.authorityClass !== "PROHIBITED" && !hasToolHandler(name)) continue;

    tools.push(
      tool({
        name,
        description: `${definition.description} Authority class: ${definition.authorityClass}.${
          definition.material ? " This is a material change and requires a human approval." : ""
        }`,
        /*
         * Strict mode is required for a Zod schema: the SDK documents that a
         * Zod parameter set is not supported without it. Strict mode in turn
         * requires every field to be present, which is why every optional
         * argument above is declared `.nullable()` rather than `.optional()`,
         * and why `execute` strips nulls before passing the payload on.
         */
        parameters: schema,
        strict: true,
        execute: async (args: unknown) => {
          const payload = (args ?? {}) as Record<string, unknown>;
          // Strip nulls so optional arguments behave as absent rather than as
          // an explicit null the handlers would have to special case.
          const cleaned: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(payload)) {
            if (value !== null) cleaned[key] = value;
          }

          const result = await executeTool(name, cleaned, context, null);

          return JSON.stringify({
            outcome: result.outcome,
            summary: result.summary,
            evidenceIds: result.evidenceIds,
            data: result.outcome === "executed" ? result.data : undefined,
            proposedAction: result.proposedAction
              ? {
                  toolName: result.proposedAction.toolName,
                  description: result.proposedAction.description,
                  requiresHumanApproval: true,
                  material: result.proposedAction.material,
                  reversible: result.proposedAction.reversible,
                  note: "This action was prepared and is held for a human approval. Report it to the professional as a proposal; do not claim it was done.",
                }
              : undefined,
            denialCode: result.denialCode,
          });
        },
      }),
    );
  }

  return tools;
}

/** Tool names offered to a model, for the control room and the tests. */
export function offeredToolNames(): string[] {
  return Object.keys(TOOL_SCHEMAS).sort();
}
