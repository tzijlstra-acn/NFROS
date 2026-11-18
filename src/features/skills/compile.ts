/**
 * From a sentence to a checked skill draft.
 *
 * In live mode the model drafts the spec in strict structured output, from a
 * description of the catalog and nothing else: it never sees a record, a
 * database or a tool. Its draft is checked against the catalog like any other
 * (`checkSkillSpec`); a draft that fails, or a call that fails, falls back to
 * the rule-based drafter and says so. In safe and offline mode the model is
 * never called and the rules draft the skill.
 *
 * Either way the person reads the draft before anything is saved, and a draft
 * is only ever a read-only query.
 */

import type { DemoMode } from "@/server/config/demo-mode";
import { getOpenAIClient, probeModelAvailability } from "@/server/openai/client";
import { getResolvedModels } from "@/server/config/models";
import { redactString } from "@/server/logging/redact";
import { copyFailures } from "@/features/work/modules/inbox/triage-schema";
import { SCENARIO_DATE } from "@/scenario/data/contract";
import { OPERATORS_BY_KIND, SKILL_CATALOG, SKILL_SOURCES, type Bilingual } from "./catalog";
import { draftSkillByRules } from "./rules";
import { SKILL_SPEC_JSON_SCHEMA, checkSkillSpec, type SkillSpec } from "./schema";

export type SkillDraftedVia = "model" | "rules";

export interface SkillDraft {
  ok: boolean;
  request: string;
  spec: SkillSpec | null;
  via: SkillDraftedVia;
  mode: DemoMode;
  /** Assumptions and what could not be mapped. Shown as uncertainty. */
  notes: Bilingual[];
  /** Why there is no draft, when `ok` is false. */
  problems: Bilingual[];
}

export interface SkillModelRequest {
  instructions: string;
  input: string;
  schema: Record<string, unknown>;
  schemaName: string;
}

export type SkillModel = (request: SkillModelRequest) => Promise<{ output: unknown; model: string } | { error: string }>;

/** The live call, reached only in live mode through the one client factory. */
export const liveSkillModel: SkillModel = async (request) => {
  const client = getOpenAIClient();
  if (client === null) return { error: "Live calls are not permitted in the current mode." };
  try {
    await probeModelAvailability();
    const models = getResolvedModels();
    const response = await client.responses.create({
      model: models.fast,
      instructions: request.instructions,
      input: request.input,
      text: { format: { type: "json_schema", name: request.schemaName, strict: true, schema: request.schema } },
      max_output_tokens: 1_500,
    });
    const text = response.output_text;
    if (typeof text !== "string" || text.trim().length === 0) return { error: "The model returned no content." };
    try {
      return { output: JSON.parse(text) as unknown, model: models.fast };
    } catch {
      return { error: "The model returned content that is not a single JSON object." };
    }
  } catch (error) {
    return { error: redactString(error instanceof Error ? error.message : "Unknown error") };
  }
};

/** The catalog, described for the model. Fields, kinds, values and operators only. */
export function skillInstructions(): string {
  const lines: string[] = [
    "You turn a risk professional's request into a read-only query spec over a fixed catalog.",
    "Use only the sources, fields, operators and values listed. Never invent a field or a value.",
    `Today is ${SCENARIO_DATE}. Windows count in days from today; convert weeks to 7 days and months to 30 days.`,
    "Operators: is-any-of (enum, values are value ids), is (boolean, values is [\"true\"] or [\"false\"]), contains (text, one value),",
    "within-next-days and within-last-days and older-than-days (date, set days), overdue (date, before today, days null).",
    "Set days to null unless the operator needs it. Use at most 6 filters and 1 to 6 columns. limit is 1 to 50, default 25.",
    "schedule is weekly only when the request asks for a recurring weekly run, otherwise manual.",
    "In note, say briefly in plain English what in the request you could not express with the catalog, or leave it empty.",
    "Catalog:",
  ];
  for (const source of SKILL_SOURCES) {
    const definition = SKILL_CATALOG[source];
    lines.push(`- source ${source}: ${definition.scope.en}`);
    for (const field of definition.fields) {
      const operators = OPERATORS_BY_KIND[field.kind];
      const values = field.values ? ` values ${field.values.map((value) => value.id).join("|")}` : "";
      lines.push(`  - field ${field.id} (${field.kind}${operators.length > 0 ? `, ${operators.join("|")}` : ", display only"}${field.sortable ? ", sortable" : ""})${values}`);
    }
    lines.push(`  default columns ${definition.defaultColumns.join(", ")}; default sort ${definition.defaultSort.field} ${definition.defaultSort.direction}`);
  }
  return lines.join("\n");
}

export interface DraftSkillOptions {
  mode: DemoMode;
  knownNames?: readonly string[];
  model?: SkillModel;
}

const FALLBACK_NOTE: Bilingual = {
  en: "The model's draft could not be used, so the rule-based builder drafted this skill. Check the filters before you save it.",
  de: "Der Entwurf des Modells war nicht verwendbar, daher hat der regelbasierte Builder diesen Skill entworfen. Pruefen Sie die Filter vor dem Speichern.",
};

/** Drafts a skill from a request. Never throws; a failure is a draft with problems. */
export async function draftSkill(request: string, options: DraftSkillOptions): Promise<SkillDraft> {
  const text = request.trim().slice(0, 400);
  const rulesOptions = options.knownNames ? { knownNames: options.knownNames } : {};

  if (text.length < 3) {
    return {
      ok: false,
      request: text,
      spec: null,
      via: "rules",
      mode: options.mode,
      notes: [],
      problems: [{ en: "Describe the skill in a sentence first.", de: "Beschreiben Sie den Skill zuerst in einem Satz." }],
    };
  }

  const notes: Bilingual[] = [];
  if (options.mode === "live") {
    const model = options.model ?? liveSkillModel;
    const answer = await model({
      instructions: skillInstructions(),
      input: text,
      schema: SKILL_SPEC_JSON_SCHEMA,
      schemaName: "skill_spec",
    });
    if ("output" in answer && typeof answer.output === "object" && answer.output !== null) {
      const { note, ...candidate } = answer.output as Record<string, unknown>;
      const checked = checkSkillSpec(candidate);
      if (checked.ok) {
        const modelNote = typeof note === "string" ? note.trim().slice(0, 240) : "";
        if (modelNote.length > 0 && copyFailures(modelNote, "note", false).length === 0) {
          notes.push({ en: modelNote, de: modelNote });
        }
        return { ok: true, request: text, spec: checked.spec, via: "model", mode: options.mode, notes, problems: [] };
      }
    }
    notes.push(FALLBACK_NOTE);
  }

  const drafted = draftSkillByRules(text, rulesOptions);
  if (!drafted.spec) {
    return { ok: false, request: text, spec: null, via: "rules", mode: options.mode, notes: [...notes, ...drafted.notes], problems: drafted.problems };
  }
  const checked = checkSkillSpec(drafted.spec);
  if (!checked.ok) {
    return { ok: false, request: text, spec: null, via: "rules", mode: options.mode, notes, problems: checked.problems };
  }
  return { ok: true, request: text, spec: checked.spec, via: "rules", mode: options.mode, notes: [...notes, ...drafted.notes], problems: [] };
}
