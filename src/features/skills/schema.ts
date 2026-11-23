/**
 * The skill spec: the one shape a skill is stored, previewed and run in.
 *
 * A sentence becomes a spec (`compile.ts`), a spec is checked here against
 * the catalog, and only a checked spec is executed (`execute.ts`). The check
 * runs on every path: the model's draft, the rule-based draft, a spec posted
 * by a form and a spec read back from the database. A spec that names a field,
 * an operator or a value the catalog does not list is refused, not repaired,
 * so a skill can only ever read what the catalog allows.
 */

import { z } from "zod";
import {
  OPERATORS_BY_KIND,
  SKILL_CATALOG,
  SKILL_OPERATORS,
  SKILL_SOURCES,
  skillField,
  type Bilingual,
  type SkillSource,
} from "./catalog";

export const SKILL_SCHEDULES = ["manual", "weekly"] as const;
export type SkillSchedule = (typeof SKILL_SCHEDULES)[number];

export const MAX_SKILL_ROWS = 50;
export const DEFAULT_SKILL_ROWS = 25;

const fieldId = z.string().regex(/^[a-zA-Z]{1,40}$/);

export const skillFilterSchema = z.object({
  field: fieldId,
  operator: z.enum(SKILL_OPERATORS),
  values: z.array(z.string().trim().min(1).max(60)).max(12),
  days: z.number().int().min(1).max(730).nullable(),
});
export type SkillFilter = z.infer<typeof skillFilterSchema>;

export const skillSpecSchema = z.object({
  source: z.enum(SKILL_SOURCES),
  filters: z.array(skillFilterSchema).max(6),
  sort: z.object({ field: fieldId, direction: z.enum(["asc", "desc"]) }),
  columns: z.array(fieldId).min(1).max(6),
  limit: z.number().int().min(1).max(MAX_SKILL_ROWS),
  schedule: z.enum(SKILL_SCHEDULES),
});
export type SkillSpec = z.infer<typeof skillSpecSchema>;

export type SpecCheck = { ok: true; spec: SkillSpec } | { ok: false; problems: Bilingual[] };

function problem(en: string, de: string): Bilingual {
  return { en, de };
}

/**
 * Checks a value against the schema and the catalog.
 *
 * Returns the spec with its columns de-duplicated and its filters in the
 * order given. Everything else is a refusal with the reason in both languages.
 */
export function checkSkillSpec(value: unknown): SpecCheck {
  const parsed = skillSpecSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, problems: [problem("The skill is not in a shape the product can run.", "Der Skill hat keine Form, die das Produkt ausfuehren kann.")] };
  }
  const spec = parsed.data;
  const source = SKILL_CATALOG[spec.source];
  const problems: Bilingual[] = [];

  for (const filter of spec.filters) {
    const field = skillField(spec.source, filter.field);
    if (!field) {
      problems.push(problem(`${source.label.en} have no field "${filter.field}".`, `${source.label.de} haben kein Feld "${filter.field}".`));
      continue;
    }
    if (!OPERATORS_BY_KIND[field.kind].includes(filter.operator)) {
      problems.push(problem(`"${field.label.en}" cannot be filtered that way.`, `"${field.label.de}" kann so nicht gefiltert werden.`));
      continue;
    }
    if (filter.operator === "is-any-of") {
      const allowed = new Set((field.values ?? []).map((entry) => entry.id));
      if (filter.values.length === 0 || filter.values.some((entry) => !allowed.has(entry))) {
        problems.push(problem(`"${field.label.en}" was given a value it does not have.`, `"${field.label.de}" hat einen Wert erhalten, den es nicht gibt.`));
      }
    }
    if (filter.operator === "is" && !(filter.values.length === 1 && (filter.values[0] === "true" || filter.values[0] === "false"))) {
      problems.push(problem(`"${field.label.en}" takes yes or no.`, `"${field.label.de}" nimmt ja oder nein.`));
    }
    if (filter.operator === "contains" && filter.values.length !== 1) {
      problems.push(problem(`"${field.label.en}" takes one search word.`, `"${field.label.de}" nimmt ein Suchwort.`));
    }
    const needsDays = filter.operator === "within-next-days" || filter.operator === "within-last-days" || filter.operator === "older-than-days";
    if (needsDays && filter.days === null) {
      problems.push(problem(`"${field.label.en}" needs a number of days.`, `"${field.label.de}" braucht eine Anzahl Tage.`));
    }
  }

  const sortField = skillField(spec.source, spec.sort.field);
  if (!sortField || !sortField.sortable) {
    problems.push(problem(`${source.label.en} cannot be sorted by "${spec.sort.field}".`, `${source.label.de} koennen nicht nach "${spec.sort.field}" sortiert werden.`));
  }
  for (const column of spec.columns) {
    if (!skillField(spec.source, column)) {
      problems.push(problem(`${source.label.en} have no column "${column}".`, `${source.label.de} haben keine Spalte "${column}".`));
    }
  }

  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, spec: { ...spec, columns: [...new Set(spec.columns)] } };
}

/** The default spec for a source: no filters, the source's own columns and order. */
export function defaultSpec(source: SkillSource): SkillSpec {
  const definition = SKILL_CATALOG[source];
  return {
    source,
    filters: [],
    sort: { ...definition.defaultSort },
    columns: [...definition.defaultColumns],
    limit: DEFAULT_SKILL_ROWS,
    schedule: "manual",
  };
}

/**
 * The JSON schema the model answers in (strict structured output).
 *
 * Strict mode needs every property required and no extra properties, which
 * is why `days` is nullable rather than optional. `note` is where the model
 * says what in the request it could not map; it is shown to the person as an
 * uncertainty, never acted on.
 */
export const SKILL_SPEC_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["source", "filters", "sort", "columns", "limit", "schedule", "note"],
  properties: {
    source: { type: "string", enum: [...SKILL_SOURCES] },
    filters: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["field", "operator", "values", "days"],
        properties: {
          field: { type: "string" },
          operator: { type: "string", enum: [...SKILL_OPERATORS] },
          values: { type: "array", items: { type: "string" } },
          days: { type: ["integer", "null"] },
        },
      },
    },
    sort: {
      type: "object",
      additionalProperties: false,
      required: ["field", "direction"],
      properties: {
        field: { type: "string" },
        direction: { type: "string", enum: ["asc", "desc"] },
      },
    },
    columns: { type: "array", items: { type: "string" } },
    limit: { type: "integer" },
    schedule: { type: "string", enum: [...SKILL_SCHEDULES] },
    note: { type: "string" },
  },
};

/** Encodes a spec for a URL, so a draft can be handed from the chat to the builder. */
export function encodeSpec(spec: SkillSpec): string {
  return Buffer.from(JSON.stringify(spec), "utf8").toString("base64url");
}

/** Decodes a spec from a URL and checks it. A spec that does not decode is null. */
export function decodeSpec(value: string | undefined | null): SkillSpec | null {
  if (!value || value.length > 4000) return null;
  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown;
    const checked = checkSkillSpec(decoded);
    return checked.ok ? checked.spec : null;
  } catch {
    return null;
  }
}
