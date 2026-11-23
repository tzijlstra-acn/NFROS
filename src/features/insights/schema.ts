/**
 * The insight response: the one shape an analysis is built, stored, shown
 * and acted on in.
 *
 * An analysis answers in this order, and the canvas renders it in the same
 * order: a conclusion in one sentence, up to five key numbers, one primary
 * visual (two supporting ones at most, behind a disclosure), the findings
 * with the evidence each rests on, the recommended next step with the
 * governed action it would take, and follow-up questions.
 *
 * Visuals are data, never code. The engine chooses a type from a fixed list
 * and supplies the rows; the renderer owns every pixel. Each type has its own
 * data shape here, so a malformed payload is refused before it is drawn and
 * the renderer can trust what it receives. A response that does not pass
 * this schema is not shown as a visual answer; the canvas falls back to the
 * conclusion and the evidence (docs/NFR_WORKSPACE_V3_PLAN.md, D6).
 */

import { z } from "zod";

/* ==========================================================================
   Shared pieces
   ========================================================================== */

export const TONES = ["good", "neutral", "watch", "warning", "critical", "accent"] as const;
export type Tone = (typeof TONES)[number];
const tone = z.enum(TONES);

const id = z.string().min(1).max(120);
const label = z.string().min(1).max(240);
const text = z.string().max(1200);
const href = z.string().startsWith("/").max(400).optional();

export const metricSchema = z.object({
  id,
  label,
  value: z.union([z.number(), z.string().max(60)]),
  unit: z.string().max(40).optional(),
  /** A signed change against the comparison period, in the metric's unit. */
  delta: z.number().optional(),
  deltaLabel: z.string().max(80).optional(),
  status: tone.default("neutral"),
});
export type InsightMetric = z.infer<typeof metricSchema>;

/* ==========================================================================
   Visualisations, one data shape per type
   ========================================================================== */

const base = {
  id,
  /** A conclusion, not a label: "Novalink's risk score doubled since April". */
  title: label,
  subtitle: z.string().max(240).optional(),
  /** One sentence the "Explain this chart" control shows. */
  explanation: z.string().max(600).optional(),
};

const barDatum = z.object({
  id,
  label,
  value: z.number(),
  /** A second figure shown after the bar, such as the absolute level. */
  note: z.string().max(80).optional(),
  tone: tone.default("neutral"),
  href,
});

export const barSchema = z.object({
  ...base,
  type: z.literal("bar"),
  unit: z.string().max(40),
  data: z.array(barDatum).min(1).max(40),
  /** A reference line, such as the deterioration threshold. */
  reference: z.object({ value: z.number(), label: z.string().max(80) }).optional(),
});

export const stackedBarSchema = z.object({
  ...base,
  type: z.literal("stacked-bar"),
  unit: z.string().max(40),
  series: z.array(z.object({ id, label, tone })).min(1).max(6),
  data: z
    .array(z.object({ id, label, values: z.record(z.string(), z.number()), href }))
    .min(1)
    .max(40),
});

export const lineSchema = z.object({
  ...base,
  type: z.enum(["line", "area"]),
  unit: z.string().max(40),
  /** The x axis periods, in order: "2025-10", "2026-Q1". */
  periods: z.array(z.string().max(20)).min(2).max(60),
  series: z
    .array(
      z.object({
        id,
        label,
        tone,
        emphasis: z.boolean().default(false),
        values: z.array(z.number().nullable()),
      }),
    )
    .min(1)
    .max(8),
  thresholds: z.array(z.object({ value: z.number(), label: z.string().max(80), tone })).max(3).default([]),
  /** Domain floor, so a percentage chart need not start at zero. */
  yMin: z.number().optional(),
  yMax: z.number().optional(),
});

export const heatmapSchema = z.object({
  ...base,
  type: z.literal("heatmap"),
  columns: z.array(z.string().max(40)).min(1).max(16),
  rows: z.array(z.object({ id, label, sublabel: z.string().max(120).optional(), href })).min(1).max(40),
  /** One cell per row and column; `text` is what the cell says, `tone` its state. */
  cells: z.array(z.object({ row: id, column: z.string().max(40), tone, text: z.string().max(24) })),
  legend: z.array(z.object({ tone, label: z.string().max(60) })).min(1).max(6),
});

export const treemapSchema = z.object({
  ...base,
  type: z.literal("treemap"),
  unit: z.string().max(40),
  groups: z
    .array(
      z.object({
        id,
        label,
        tone,
        children: z.array(z.object({ id, label, value: z.number().positive(), tone, href })).min(1).max(30),
      }),
    )
    .min(1)
    .max(12),
});

export const networkSchema = z.object({
  ...base,
  type: z.literal("network"),
  /** Three layers, left to right: providers, third parties, services. */
  layers: z.array(z.object({ id, label })).length(3),
  nodes: z.array(z.object({ id, label, layer: id, tone, note: z.string().max(80).optional(), href })).min(2).max(60),
  links: z.array(z.object({ source: id, target: id, tone, dashed: z.boolean().default(false) })).min(1).max(120),
});

export const timelineSchema = z.object({
  ...base,
  type: z.literal("timeline"),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** The scenario day, drawn as "today". */
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lanes: z.array(z.object({ id, label })).min(1).max(6),
  events: z
    .array(z.object({ id, lane: id, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), label, tone, href }))
    .min(1)
    .max(60),
});

export const bulletSchema = z.object({
  ...base,
  type: z.literal("bullet"),
  unit: z.string().max(40),
  data: z
    .array(
      z.object({
        id,
        label,
        sublabel: z.string().max(120).optional(),
        target: z.number(),
        actual: z.number(),
        targetLabel: z.string().max(40),
        tone,
        href,
      }),
    )
    .min(1)
    .max(30),
});

export const waterfallSchema = z.object({
  ...base,
  type: z.literal("waterfall"),
  unit: z.string().max(40),
  steps: z
    .array(z.object({ id, label, value: z.number(), kind: z.enum(["start", "delta", "end"]), tone }))
    .min(3)
    .max(12),
});

export const tableSchema = z.object({
  ...base,
  type: z.literal("table"),
  columns: z
    .array(z.object({ id, label: z.string().max(60), align: z.enum(["start", "end"]).default("start") }))
    .min(1)
    .max(8),
  rows: z
    .array(
      z.object({
        id,
        cells: z.record(z.string(), z.union([z.string().max(240), z.number(), z.null()])),
        tone: tone.default("neutral"),
        href,
      }),
    )
    .max(80),
});

export const visualisationSchema = z.discriminatedUnion("type", [
  barSchema,
  stackedBarSchema,
  lineSchema,
  heatmapSchema,
  treemapSchema,
  networkSchema,
  timelineSchema,
  bulletSchema,
  waterfallSchema,
  tableSchema,
]);
export type InsightVisualisation = z.infer<typeof visualisationSchema>;
export type VisualisationType = InsightVisualisation["type"];

/** Every type the renderer draws. A response naming any other is refused by the schema. */
export const VISUALISATION_TYPES: readonly VisualisationType[] = [
  "bar", "stacked-bar", "line", "area", "heatmap", "treemap", "network", "timeline", "bullet", "waterfall", "table",
];

/* ==========================================================================
   Findings, evidence, recommendations, governed actions
   ========================================================================== */

export const findingSchema = z.object({
  id,
  severity: z.enum(["info", "watch", "warning", "critical"]),
  title: label,
  detail: text,
  evidenceIds: z.array(id).max(20),
  href,
});
export type InsightFinding = z.infer<typeof findingSchema>;

export const evidenceSchema = z.object({
  id,
  /** "Third-party register", "Incident record", "Evidence document", ... */
  sourceType: z.string().max(80),
  sourceName: label,
  recordId: z.string().max(120),
  field: z.string().max(80).optional(),
  observedAt: z.string().max(40),
  freshness: z.enum(["current", "aging", "stale"]),
  excerpt: z.string().max(400).optional(),
  href,
});
export type InsightEvidence = z.infer<typeof evidenceSchema>;

export const ACTION_TYPES = ["create-action", "request-evidence", "create-issue", "create-monitor", "update-control-rating"] as const;
export type InsightActionType = (typeof ACTION_TYPES)[number];

export const proposedActionSchema = z.object({
  id,
  actionType: z.enum(ACTION_TYPES),
  /** The registered tool the action runs through. */
  toolName: z.string().max(80),
  /** The tool payload, exactly as the approval will bind it. */
  payload: z.record(z.string(), z.unknown()),
  target: z.object({ entityType: z.string().max(40), entityId: id, label, systemLabel: z.string().max(80) }),
  /** What the person reviews: one line per field, before and after. */
  changes: z.array(z.object({ field: z.string().max(60), before: z.string().max(240).nullable(), after: z.string().max(400) })).min(1).max(10),
  rationale: text,
  evidenceIds: z.array(id).max(20),
});
export type ProposedInsightAction = z.infer<typeof proposedActionSchema>;

export const recommendationSchema = z.object({
  id,
  title: label,
  rationale: text,
  urgency: z.enum(["now", "this-week", "this-month", "monitor"]),
  proposedAction: proposedActionSchema.optional(),
  /** Where the person acts when the action is a decision rather than a write. */
  href,
});
export type InsightRecommendation = z.infer<typeof recommendationSchema>;

/* ==========================================================================
   The response
   ========================================================================== */

export const insightResponseSchema = z.object({
  /** Schema version. Bump on a breaking change; stored runs keep theirs. */
  version: z.literal(1),
  intentId: z.string().max(60),
  question: z.string().min(1).max(600),
  title: label,
  conclusion: z.string().min(1).max(400),
  language: z.enum(["en", "de"]),
  roleId: z.string().max(40),
  /** The scenario moment the records were read at: "06.10.2026, 07:45". */
  dataAsOf: z.string().max(40),
  scope: z.string().max(240),
  plan: z.object({
    using: z.array(z.string().max(80)).min(1).max(10),
    timeWindow: z.string().max(80),
    groupedBy: z.string().max(80),
    output: z.string().max(120),
  }),
  confidence: z.object({ level: z.enum(["high", "medium", "low"]), explanation: z.string().max(300) }),
  metrics: z.array(metricSchema).max(5),
  visualisations: z.array(visualisationSchema).min(1).max(3),
  findings: z.array(findingSchema).max(8),
  evidence: z.array(evidenceSchema).max(40),
  recommendations: z.array(recommendationSchema).max(4),
  followUps: z.array(z.object({ label: z.string().max(120), question: z.string().max(300) })).max(4),
});
export type InsightResponse = z.infer<typeof insightResponseSchema>;
/** The shape a builder writes, before defaults are applied by parsing. */
export type InsightResponseInput = z.input<typeof insightResponseSchema>;

export type InsightValidation =
  | { ok: true; response: InsightResponse }
  | { ok: false; issues: string[] };

/** Validates an insight response. Never throws. */
export function validateInsight(value: unknown): InsightValidation {
  const parsed = insightResponseSchema.safeParse(value);
  if (parsed.success) return { ok: true, response: parsed.data };
  return {
    ok: false,
    issues: parsed.error.issues.slice(0, 12).map((issue) => `${issue.path.join(".") || "response"}: ${issue.message}`),
  };
}
