/**
 * The structured output of a stage preparation, and its validator.
 *
 * Every mode produces this shape: the live model is constrained to it by a
 * strict JSON schema derived from the Zod schema below, the safe mode cache is
 * stored in it, and the offline composer builds it. All three then pass through
 * `validatePreparation`, which checks the schema and then the content. The
 * content checks are the ones that matter: a cited evidence identifier must be
 * one the loaded sources actually returned, a source or tool key must exist in
 * the stage contract, and the copy must obey the product's copy rules. A
 * validator that only ran on one path would be a validator nobody tested.
 *
 * Text is bilingual in the output itself, so a language switch does not need
 * a second preparation and the German copy is validated like the English.
 */

import { z } from "zod";
import type { RoleProcessStage } from "@/role-apps/contracts";

export const STAGE_PREPARATION_SCHEMA_VERSION = "stage-preparation-v1" as const;

const text = z.string().min(1).max(1400);
const bilingual = z.object({ en: text, de: text });
const ids = z.array(z.string().min(1).max(80)).max(16);

export const stagePreparationSchema = z.object({
  schemaVersion: z.literal(STAGE_PREPARATION_SCHEMA_VERSION),
  /** Two or three sentences: what the AI found, in the professional's terms. */
  summary: bilingual,
  /** Facts read from the sources. Each cites its evidence. */
  findings: z
    .array(
      z.object({
        sourceKey: z.string().min(1).max(60),
        statement: bilingual,
        evidenceIds: ids,
        basis: z.enum(["verified-fact", "approved-record", "stakeholder-statement", "telemetry"]),
      }),
    )
    .max(24),
  /** Interpretations. Always labelled as AI inference, never as a record. */
  inferences: z
    .array(z.object({ statement: bilingual, evidenceIds: ids, uncertainty: bilingual }))
    .max(6),
  /** Where the evidence contradicts itself. Needs at least two sources to be a contradiction. */
  contradictions: z
    .array(z.object({ statement: bilingual, evidenceIds: z.array(z.string().min(1).max(80)).min(2).max(8) }))
    .max(6),
  /** What is missing or stale, and how much it matters. */
  gaps: z
    .array(
      z.object({
        key: z.string().min(1).max(60),
        statement: bilingual,
        evidenceIds: ids,
        severity: z.enum(["blocking", "material", "minor"]),
      }),
    )
    .max(12),
  /** Proposed dispositions for items the human must review. Never applied automatically. */
  itemAssessments: z
    .array(
      z.object({
        itemId: z.string().min(1).max(80),
        proposedDisposition: z.enum(["accept", "accept-with-condition", "outstanding", "reject"]),
        note: bilingual,
      }),
    )
    .max(20),
  /** Governed tools the AI proposes, by contract key. A proposal executes nothing. */
  proposals: z.array(z.object({ toolKey: z.string().min(1).max(60), rationale: bilingual })).max(6),
  /** The option the AI would recommend for the stage decision. Never preselected. */
  recommendedOptionId: z.string().min(1).max(80).nullable(),
  /** What this preparation cannot say, and why. */
  limitations: z.array(bilingual).max(6),
});

export type StagePreparationOutput = z.infer<typeof stagePreparationSchema>;

/** One validation failure, phrased for the job record rather than the user. */
export interface PreparationValidationFailure {
  path: string;
  message: string;
}

export type PreparationValidation =
  | { ok: true; output: StagePreparationOutput }
  | { ok: false; failures: PreparationValidationFailure[] };

/*
 * The characters are built from their code points so this file itself stays
 * ASCII, which is what the repository copy check requires of every source.
 */
const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);
const UMLAUTS = [0xe4, 0xf6, 0xfc, 0xc4, 0xd6, 0xdc, 0xdf].map((code) => String.fromCharCode(code)).join("");

const FORBIDDEN_CHARACTERS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: new RegExp(EM_DASH), name: "an em dash" },
  { pattern: new RegExp(EN_DASH), name: "an en dash" },
  { pattern: /\s--\s/, name: "a double hyphen used as punctuation" },
];

const GERMAN_UMLAUTS = new RegExp(`[${UMLAUTS}]`);

/** Internal technology terms that must not reach analyst-facing copy. */
const FORBIDDEN_TERMS = [/\bLLM\b/i, /\bstub\b/i, /\bOpenAI\b/i, /\bGPT\b/i, /\broutine handler\b/i];

function walkStrings(value: unknown, path: string, visit: (text: string, path: string) => void): void {
  if (typeof value === "string") {
    visit(value, path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((child, index) => walkStrings(child, `${path}[${index}]`, visit));
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      walkStrings(child, path.length > 0 ? `${path}.${key}` : key, visit);
    }
  }
}

/**
 * Validates a candidate preparation against the schema and the stage.
 *
 * `knownEvidenceIds` is the set the loaded sources returned. An identifier
 * outside it is rejected rather than dropped: a citation that resolves to
 * nothing is the specific failure that makes an AI preparation untrustworthy,
 * and silently removing it would hide that the model produced it.
 */
export function validatePreparation(
  candidate: unknown,
  context: {
    stage: RoleProcessStage;
    knownEvidenceIds: ReadonlySet<string>;
    knownItemIds: ReadonlySet<string>;
  },
): PreparationValidation {
  const parsed = stagePreparationSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      failures: parsed.error.issues.slice(0, 12).map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    };
  }

  const output = parsed.data;
  const failures: PreparationValidationFailure[] = [];

  const sourceKeys = new Set([
    ...context.stage.requiredSources.map((source) => source.key),
    ...context.stage.helpfulSources.map((source) => source.key),
  ]);
  const toolKeys = new Set(context.stage.tools.map((tool) => tool.key));
  const optionIds = new Set(
    context.stage.decisions.flatMap((decision) =>
      decision.binding.kind === "stage-decision"
        ? decision.binding.options.map((option) => option.id)
        : [],
    ),
  );

  const checkIds = (list: readonly string[], path: string): void => {
    for (const id of list) {
      if (!context.knownEvidenceIds.has(id)) {
        failures.push({ path, message: `The evidence identifier ${id} was not returned by any loaded source.` });
      }
    }
  };

  output.findings.forEach((finding, index) => {
    if (!sourceKeys.has(finding.sourceKey)) {
      failures.push({ path: `findings[${index}].sourceKey`, message: `${finding.sourceKey} is not a source of this stage.` });
    }
    checkIds(finding.evidenceIds, `findings[${index}].evidenceIds`);
  });
  output.inferences.forEach((inference, index) => checkIds(inference.evidenceIds, `inferences[${index}].evidenceIds`));
  output.contradictions.forEach((item, index) => checkIds(item.evidenceIds, `contradictions[${index}].evidenceIds`));
  output.gaps.forEach((gap, index) => checkIds(gap.evidenceIds, `gaps[${index}].evidenceIds`));

  output.itemAssessments.forEach((item, index) => {
    if (!context.knownItemIds.has(item.itemId)) {
      failures.push({ path: `itemAssessments[${index}].itemId`, message: `${item.itemId} is not an item in scope for this stage.` });
    }
  });

  output.proposals.forEach((proposal, index) => {
    if (!toolKeys.has(proposal.toolKey)) {
      failures.push({ path: `proposals[${index}].toolKey`, message: `${proposal.toolKey} is not a tool of this stage.` });
    }
  });

  if (output.recommendedOptionId !== null && !optionIds.has(output.recommendedOptionId)) {
    failures.push({
      path: "recommendedOptionId",
      message: `${output.recommendedOptionId} is not an option of a stage decision.`,
    });
  }

  walkStrings(output, "", (value, path) => {
    for (const forbidden of FORBIDDEN_CHARACTERS) {
      if (forbidden.pattern.test(value)) failures.push({ path, message: `The text contains ${forbidden.name}.` });
    }
    if (path.endsWith(".de") && GERMAN_UMLAUTS.test(value)) {
      failures.push({ path, message: "German text must use ASCII transliteration, not umlauts." });
    }
    for (const term of FORBIDDEN_TERMS) {
      if (term.test(value)) failures.push({ path, message: "The text names internal technology." });
    }
  });

  return failures.length === 0 ? { ok: true, output } : { ok: false, failures };
}

let cachedJsonSchema: Record<string, unknown> | null = null;

/**
 * The strict JSON schema sent to the model in live mode.
 *
 * Same hardening as the suggestion schema: every object closed and every
 * property required, because the provider's strict mode demands it, and the
 * nullable fields above are what keep "required" honest.
 */
export function stagePreparationJsonSchema(): Record<string, unknown> {
  if (cachedJsonSchema !== null) return cachedJsonSchema;
  const schema = z.toJSONSchema(stagePreparationSchema, { io: "input" }) as Record<string, unknown>;
  const harden = (node: unknown): void => {
    if (node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const child of node) harden(child);
      return;
    }
    const record = node as Record<string, unknown>;
    if (record["type"] === "object") {
      record["additionalProperties"] = false;
      const properties = record["properties"];
      if (properties !== null && typeof properties === "object") {
        record["required"] = Object.keys(properties as Record<string, unknown>);
      }
    }
    for (const value of Object.values(record)) harden(value);
  };
  harden(schema);
  cachedJsonSchema = schema;
  return schema;
}
