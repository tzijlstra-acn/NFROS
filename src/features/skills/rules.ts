/**
 * The rule-based skill drafter.
 *
 * Used in safe and offline mode, and in live mode whenever the model's draft
 * cannot be used. It reads a request for the words the catalog lists (a
 * source, enum values, a yes-or-no field, a time window, a schedule, a quoted
 * name) and builds a spec from those words alone. A word it does not know is
 * left out rather than guessed, and every assumption it makes is returned as
 * a note the person reads before saving.
 *
 * Deterministic: the same request always yields the same spec.
 */

import {
  SKILL_CATALOG,
  VALUE_GROUPS,
  type Bilingual,
  type SkillField,
  type SkillSource,
} from "./catalog";
import { DEFAULT_SKILL_ROWS, MAX_SKILL_ROWS, defaultSpec, type SkillFilter, type SkillSpec } from "./schema";

export interface RuleDraft {
  spec: SkillSpec | null;
  notes: Bilingual[];
  problems: Bilingual[];
}

/** Sources in the order a request naming several is read as: the most specific first. */
const SOURCE_PRIORITY: readonly SkillSource[] = ["obligations", "incidents", "kris", "evidence", "suppliers"];

/** Date fields that hold the past: a window on them looks back, not ahead. */
const PAST_DATES = new Set(["documentDate", "detectedAt", "lastAssessmentDate"]);

/** The field an "older than" window reads, per source. */
const OLDER_THAN_FIELD: Partial<Record<SkillSource, string>> = {
  suppliers: "lastAssessmentDate",
  evidence: "documentDate",
  incidents: "detectedAt",
};

const UMLAUT_FOLD: ReadonlyArray<[string, string]> = [
  [String.fromCharCode(0xe4), "ae"],
  [String.fromCharCode(0xf6), "oe"],
  [String.fromCharCode(0xfc), "ue"],
  [String.fromCharCode(0xdf), "ss"],
];

/** Lower case, umlauts folded, typographic quotes made plain, spaces collapsed. */
export function normaliseRequest(input: string): string {
  let text = input.toLowerCase();
  for (const [from, to] of UMLAUT_FOLD) text = text.split(from).join(to);
  const quotes = [0x201c, 0x201d, 0x201e, 0x2018, 0x2019].map((code) => String.fromCharCode(code));
  for (const quote of quotes) text = text.split(quote).join('"');
  return text.replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * A phrase as a whole word. A phrase ending in a letter also matches with a
 * German adjective ending ("angefordert", "angeforderte", "angeforderten").
 */
function phrasePattern(phrase: string): RegExp {
  const ending = /[a-z]$/.test(phrase) ? "(?:e|en|er|es|n)?" : "";
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(phrase)}${ending}(?=$|[^a-z0-9])`);
}

function hasPhrase(text: string, phrase: string): boolean {
  return phrasePattern(phrase).test(text);
}

/** Blanks a matched phrase, so "not evidenced" cannot match "evidenced" again. */
function blank(text: string, phrase: string): string {
  return text.replace(phrasePattern(phrase), (match: string, lead: string) => `${lead}${" ".repeat(match.length - lead.length)}`);
}

function note(en: string, de: string): Bilingual {
  return { en, de };
}

function detectSources(text: string): SkillSource[] {
  return SOURCE_PRIORITY.filter((source) => SKILL_CATALOG[source].synonyms.some((word) => hasPhrase(text, word)));
}

const UNIT_DAYS: ReadonlyArray<{ pattern: RegExp; days: number }> = [
  { pattern: /^(?:day|days|tag|tage|tagen)$/, days: 1 },
  { pattern: /^(?:week|weeks|woche|wochen)$/, days: 7 },
  { pattern: /^(?:month|months|monat|monate|monaten)$/, days: 30 },
  { pattern: /^(?:year|years|jahr|jahre|jahren)$/, days: 365 },
];

const UNIT = "(days?|weeks?|months?|years?|tage?n?|wochen?|monate?n?|jahre?n?)";

function toDays(amount: string, unit: string): number {
  const multiplier = UNIT_DAYS.find((entry) => entry.pattern.test(unit))?.days ?? 1;
  return Math.min(730, Math.max(1, Number.parseInt(amount, 10) * multiplier));
}

interface WindowMatch {
  operator: SkillFilter["operator"];
  days: number | null;
  assumed?: Bilingual;
}

function detectWindow(text: string): WindowMatch | null {
  const older = new RegExp(`(?:older than|more than|aelter als|mehr als)\\s+(\\d{1,3})\\s*${UNIT}`).exec(text);
  if (older?.[1] && older[2]) return { operator: "older-than-days", days: toDays(older[1], older[2]) };
  const last = new RegExp(`(?:last|past|previous|letzten|vergangenen)\\s+(\\d{1,3})\\s*${UNIT}`).exec(text);
  if (last?.[1] && last[2]) return { operator: "within-last-days", days: toDays(last[1], last[2]) };
  const next = new RegExp(`(?:next|within|coming|in|naechsten|innerhalb(?:\\s+(?:von|der))?)\\s+(?:the\\s+)?(?:next\\s+)?(\\d{1,3})\\s*${UNIT}`).exec(text);
  if (next?.[1] && next[2]) return { operator: "within-next-days", days: toDays(next[1], next[2]) };
  if (/(?:^|[^a-z])(?:overdue|past due|ueberfaellig\w*)(?=$|[^a-z])/.test(text)) return { operator: "overdue", days: null };
  if (/(?:next quarter|naechstes quartal|naechsten quartal)/.test(text)) return { operator: "within-next-days", days: 90 };
  if (/(?:^|[^a-z])(?:due soon|soon|coming up|bald|demnaechst)(?=$|[^a-z])/.test(text)) {
    return {
      operator: "within-next-days",
      days: 90,
      assumed: note('"Soon" was read as the next 90 days. Change the number if you meant another window.', '"Bald" wurde als die naechsten 90 Tage gelesen. Aendern Sie die Zahl, wenn Sie einen anderen Zeitraum meinten.'),
    };
  }
  return null;
}

function negated(text: string, phrase: string): boolean {
  return new RegExp(`(?:not|non|nicht|kein|keine)[\\s-]+${escapeRegExp(phrase)}`).test(text);
}

/**
 * Drafts a spec from a request.
 *
 * `knownNames` are the in-scope supplier names, so "for Novalink" narrows by
 * name without the request having to quote it. Only the first word of each
 * name is matched, and only when it is at least four letters long.
 */
export function draftSkillByRules(request: string, options: { knownNames?: readonly string[] } = {}): RuleDraft {
  const original = request.trim().slice(0, 400);
  let text = normaliseRequest(original);
  const notes: Bilingual[] = [];

  const sources = detectSources(text);
  const source = sources[0];
  if (!source) {
    return {
      spec: null,
      notes,
      problems: [
        note(
          "The request does not say which records to read. Name suppliers, evidence, contract obligations, incidents or KRIs.",
          "Die Anfrage nennt nicht, welche Datensaetze gelesen werden sollen. Nennen Sie Lieferanten, Nachweise, Vertragspflichten, Vorfaelle oder Risikoindikatoren.",
        ),
      ],
    };
  }
  const definition = SKILL_CATALOG[source];

  const spec = defaultSpec(source);
  const filters: SkillFilter[] = [];
  const chosen = new Map<string, Set<string>>();

  /* Quoted text narrows the source's name field. */
  const quoted = /"([^"]{2,60})"/.exec(text) ?? /'([^']{2,60})'/.exec(text);
  if (quoted?.[1]) {
    filters.push({ field: definition.nameField, operator: "contains", values: [quoted[1].trim()], days: null });
    text = text.replace(quoted[0], " ");
  } else {
    const nameField = definition.fields.find((field) => field.id === "supplierName") ?? (source === "suppliers" || source === "evidence" ? definition.fields.find((field) => field.id === definition.nameField) : undefined);
    const named = nameField
      ? (options.knownNames ?? [])
          .map((name) => name.split(/\s+/)[0] ?? "")
          .filter((word) => word.length >= 4)
          .find((word) => hasPhrase(text, word.toLowerCase()))
      : undefined;
    if (nameField && named) {
      filters.push({ field: nameField.id, operator: "contains", values: [named], days: null });
      text = blank(text, named.toLowerCase());
    }
  }

  /* Enum values and value groups, the longest phrase first. */
  const phrases: Array<{ phrase: string; field: string; values: readonly string[] }> = [];
  for (const group of VALUE_GROUPS[source]) {
    for (const phrase of group.synonyms) phrases.push({ phrase, field: group.field, values: group.values });
  }
  for (const field of definition.fields) {
    if (field.kind !== "enum") continue;
    for (const value of field.values ?? []) {
      for (const phrase of value.synonyms) phrases.push({ phrase, field: field.id, values: [value.id] });
    }
  }
  phrases.sort((left, right) => right.phrase.length - left.phrase.length);
  for (const entry of phrases) {
    if (!hasPhrase(text, entry.phrase)) continue;
    const set = chosen.get(entry.field) ?? new Set<string>();
    entry.values.forEach((value) => set.add(value));
    chosen.set(entry.field, set);
    text = blank(text, entry.phrase);
  }
  for (const field of definition.fields) {
    const set = chosen.get(field.id);
    if (!set || set.size === 0) continue;
    const ordered = (field.values ?? []).map((value) => value.id).filter((id) => set.has(id));
    filters.push({ field: field.id, operator: "is-any-of", values: ordered, days: null });
  }

  /* Another kind of record still named once the values are read: say which one this skill reads. */
  const others = detectSources(text).filter((entry) => entry !== source).map((entry) => SKILL_CATALOG[entry]);
  if (others.length > 0) {
    notes.push(
      note(
        `A skill reads one kind of record, so this one reads ${definition.label.en.toLowerCase()}. ${others.map((entry) => entry.label.en).join(" and ")} were also mentioned.`,
        `Ein Skill liest eine Art von Datensatz, dieser liest ${definition.label.de}. Ebenfalls genannt: ${others.map((entry) => entry.label.de).join(" und ")}.`,
      ),
    );
  }

  /* Yes-or-no fields. */
  for (const field of definition.fields) {
    if (field.kind !== "boolean") continue;
    const word = (field.synonyms ?? []).find((phrase) => hasPhrase(text, phrase));
    if (!word) continue;
    filters.push({ field: field.id, operator: "is", values: [negated(text, word) ? "false" : "true"], days: null });
  }

  /* A time window, on the source's own date. */
  const window = definition.primaryDate ? detectWindow(text) : null;
  if (window) {
    let field = definition.primaryDate;
    let operator = window.operator;
    if (operator === "older-than-days") field = OLDER_THAN_FIELD[source] ?? field;
    if (operator === "within-next-days" && PAST_DATES.has(field)) operator = "within-last-days";
    if (operator === "overdue" && PAST_DATES.has(field)) {
      notes.push(note(`${definition.label.en} have no due date, so "overdue" was left out.`, `${definition.label.de} haben kein Faelligkeitsdatum, daher wurde "ueberfaellig" weggelassen.`));
    } else {
      filters.push({ field, operator, values: [], days: window.days });
      if (window.assumed) notes.push(window.assumed);
    }
  } else if (!definition.primaryDate && detectWindow(text)) {
    notes.push(note(`${definition.label.en} carry no date a time window could apply to, so it was left out.`, `${definition.label.de} haben kein Datum fuer einen Zeitraum, daher wurde er weggelassen.`));
  }

  spec.filters = filters.slice(0, 6);

  /* Columns: the source's own, plus any filtered field not already shown. */
  const columns = [...spec.columns];
  for (const filter of spec.filters) {
    const field = definition.fields.find((entry: SkillField) => entry.id === filter.field);
    if (field && !columns.includes(field.id) && field.id !== "obligationText") columns.push(field.id);
  }
  spec.columns = columns.slice(0, 6);

  /* Order. */
  const dateField = spec.filters.find((filter) => filter.days !== null || filter.operator === "overdue")?.field ?? definition.primaryDate;
  if (/(?:soonest|earliest|nearest|first due|zuerst faellig|fruehest)/.test(text) && dateField) spec.sort = { field: dateField, direction: "asc" };
  else if (/(?:latest|newest|most recent|neueste|juengste)/.test(text) && dateField) spec.sort = { field: dateField, direction: "desc" };
  else if (/(?:by criticality|nach kritikalitaet)/.test(text) && source === "suppliers") spec.sort = { field: "criticality", direction: "asc" };
  else if (dateField && spec.filters.some((filter) => filter.field === dateField)) {
    spec.sort = { field: dateField, direction: PAST_DATES.has(dateField) ? "desc" : "asc" };
  }

  /* How many, and when. */
  const top = /(?:top|first|erste[n]?)\s+(\d{1,2})(?=$|[^0-9])/.exec(text);
  spec.limit = top?.[1] ? Math.min(MAX_SKILL_ROWS, Math.max(1, Number.parseInt(top[1], 10))) : DEFAULT_SKILL_ROWS;
  if (/(?:^|[^a-z])(?:weekly|every week|each week|every monday|on mondays|mondays|woechentlich|jede woche|jeden montag|montags)(?=$|[^a-z])/.test(text)) {
    spec.schedule = "weekly";
  }

  if (spec.filters.length === 0) {
    notes.push(note(`No filter was recognised, so the skill lists every ${definition.label.en.toLowerCase()} record in scope.`, `Kein Filter wurde erkannt, daher listet der Skill alle ${definition.label.de} im Geltungsbereich.`));
  }

  return { spec, notes, problems: [] };
}
