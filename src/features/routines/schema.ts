/**
 * The structured output every routine produces, and its validator.
 *
 * Built the way the process engine builds a stage preparation
 * (`src/features/process/preparation-schema.ts`): one Zod schema every mode
 * produces, then a content validator every mode passes through. A routine's
 * output is a prepared suggestion for the person, so the schema is the
 * suggestion's shape with three rules no routine may break:
 *
 *   `actionsCompleted` is empty. A routine reads, drafts and proposes; it
 *   never changes a record, so it has nothing to report as done.
 *   `decisionRequired` is false. A routine does not put a decision in front
 *   of the person; the decision, when there is one, is on Decisions already.
 *   Every cited evidence identifier is one the corpus holds, and a decision it
 *   names is one the role can see.
 *
 * And the product's copy rules, over every string: no em or en dash, no
 * double hyphen as punctuation, ASCII German, no internal technology terms.
 *
 * Pure. Client safe.
 */

import { z } from "zod";
import { copyFailures } from "@/features/work/modules/inbox/triage-schema";

export const ROUTINE_OUTPUT_SCHEMA_VERSION = "routine-suggestion-v1" as const;

const text = (max: number) => z.string().trim().min(1).max(max);

export const routineOutputSchema = z.object({
  schemaVersion: z.literal(ROUTINE_OUTPUT_SCHEMA_VERSION),
  objectType: text(60),
  objectId: text(120),
  priority: z.enum(["critical", "high", "medium", "low"]),
  headline: text(240),
  changeSummary: text(1400),
  whyItMatters: text(1400),
  checksCompleted: z.array(text(500)).max(12),
  actionsCompleted: z.array(z.string()).max(0),
  recommendedAction: text(2400),
  alternatives: z.array(text(600)).max(4),
  evidenceIds: z.array(text(80)).max(24),
  uncertainty: z.array(text(700)).max(6),
  confidence: z.number().int().min(0).max(100),
  decisionId: z.string().min(1).max(80).nullable(),
  decisionRequired: z.literal(false),
});

export type RoutineOutput = z.infer<typeof routineOutputSchema>;

export interface RoutineValidationContext {
  knownEvidenceIds: ReadonlySet<string>;
  knownDecisionIds: ReadonlySet<string>;
  language: "en" | "de";
}

export type RoutineValidation =
  | { ok: true; output: RoutineOutput }
  | { ok: false; failures: Array<{ path: string; message: string }> };

export function validateRoutineOutput(candidate: unknown, context: RoutineValidationContext): RoutineValidation {
  const parsed = routineOutputSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      failures: parsed.error.issues.slice(0, 8).map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    };
  }
  const output = parsed.data;
  const failures: Array<{ path: string; message: string }> = [];
  output.evidenceIds.forEach((id, index) => {
    if (!context.knownEvidenceIds.has(id)) failures.push({ path: `evidenceIds[${index}]`, message: `The evidence ${id} is not in the corpus.` });
  });
  if (output.decisionId !== null && !context.knownDecisionIds.has(output.decisionId)) {
    failures.push({ path: "decisionId", message: `${output.decisionId} is not a decision this role can see.` });
  }
  const strings: Array<[string, string]> = [
    ["headline", output.headline],
    ["changeSummary", output.changeSummary],
    ["whyItMatters", output.whyItMatters],
    ["recommendedAction", output.recommendedAction],
    ...output.checksCompleted.map((value, index): [string, string] => [`checksCompleted[${index}]`, value]),
    ...output.alternatives.map((value, index): [string, string] => [`alternatives[${index}]`, value]),
    ...output.uncertainty.map((value, index): [string, string] => [`uncertainty[${index}]`, value]),
  ];
  for (const [path, value] of strings) {
    for (const failure of copyFailures(value, path, context.language === "de")) {
      failures.push({ path: failure.path, message: failure.message.en });
    }
  }
  return failures.length === 0 ? { ok: true, output } : { ok: false, failures };
}
