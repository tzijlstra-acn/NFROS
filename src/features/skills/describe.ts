/**
 * Plain-language readings of a skill spec.
 *
 * The person checks a skill by reading it, so every spec has one sentence
 * per filter, a title and a schedule line in both languages. The words come
 * from the catalog's own labels; nothing here interprets the request.
 */

import type { Language } from "@/i18n/labels";
import { SCENARIO_DATE } from "@/scenario/data/contract";
import { SKILL_CATALOG, skillField, type Bilingual } from "./catalog";
import type { SkillFilter, SkillSchedule, SkillSpec } from "./schema";

function pick(pair: Bilingual, language: Language): string {
  return language === "de" ? pair.de : pair.en;
}

function joinWords(words: string[], language: Language): string {
  if (words.length <= 1) return words.join("");
  const last = words[words.length - 1];
  return `${words.slice(0, -1).join(", ")} ${language === "de" ? "oder" : "or"} ${last}`;
}

/** One filter as a sentence, for example "Criticality is critical or important". */
export function describeFilter(spec: SkillSpec, filter: SkillFilter, language: Language): string {
  const field = skillField(spec.source, filter.field);
  if (!field) return filter.field;
  const label = pick(field.label, language);
  switch (filter.operator) {
    case "is-any-of": {
      const words = filter.values.map((id) => {
        const value = field.values?.find((entry) => entry.id === id);
        return value ? pick(value.label, language).toLowerCase() : id;
      });
      return language === "de" ? `${label} ist ${joinWords(words, language)}` : `${label} is ${joinWords(words, language)}`;
    }
    case "is":
      if (filter.values[0] === "true") return language === "de" ? `${label}: ja` : `${label}: yes`;
      return language === "de" ? `${label}: nein` : `${label}: no`;
    case "contains":
      return language === "de" ? `${label} enthaelt "${filter.values[0] ?? ""}"` : `${label} contains "${filter.values[0] ?? ""}"`;
    case "within-next-days":
      return language === "de" ? `${label} in den naechsten ${filter.days} Tagen` : `${label} within the next ${filter.days} days`;
    case "within-last-days":
      return language === "de" ? `${label} in den letzten ${filter.days} Tagen` : `${label} in the last ${filter.days} days`;
    case "older-than-days":
      return language === "de" ? `${label} aelter als ${filter.days} Tage` : `${label} older than ${filter.days} days`;
    case "overdue":
      return language === "de" ? `${label} ueberfaellig` : `${label} overdue`;
  }
}

export function describeFilters(spec: SkillSpec, language: Language): string[] {
  return spec.filters.map((filter) => describeFilter(spec, filter, language));
}

export function describeSort(spec: SkillSpec, language: Language): string {
  const field = skillField(spec.source, spec.sort.field);
  const label = field ? pick(field.label, language) : spec.sort.field;
  const enumOrder = field?.kind === "enum";
  if (language === "de") {
    return `Sortiert nach ${label}, ${enumOrder ? (spec.sort.direction === "asc" ? "dringlichste zuerst" : "dringlichste zuletzt") : spec.sort.direction === "asc" ? "aufsteigend" : "absteigend"}`;
  }
  return `Sorted by ${label.toLowerCase()}, ${enumOrder ? (spec.sort.direction === "asc" ? "most pressing first" : "most pressing last") : spec.sort.direction === "asc" ? "ascending" : "descending"}`;
}

/**
 * A title for a new skill. The person may change it before saving; it is
 * built from the filters so two different skills do not read the same.
 */
export function proposeSkillTitle(spec: SkillSpec, language: Language): string {
  const source = SKILL_CATALOG[spec.source];
  const enumWords: string[] = [];
  const rest: string[] = [];
  for (const filter of spec.filters) {
    const field = skillField(spec.source, filter.field);
    if (filter.operator === "is-any-of" && field?.values && filter.values.length <= 2) {
      enumWords.push(joinWords(filter.values.map((id) => pick(field.values?.find((entry) => entry.id === id)?.label ?? { en: id, de: id }, language).toLowerCase()), language));
    } else {
      rest.push(describeFilter(spec, filter, language).toLowerCase());
    }
  }
  const noun = pick(source.label, language);
  const head = enumWords.length > 0 ? `${capitalise(enumWords.join(", "))} ${language === "de" ? noun : noun.toLowerCase()}` : noun;
  const title = rest.length > 0 ? `${head}, ${rest.join(", ")}` : head;
  return title.length > 80 ? `${title.slice(0, 77).trimEnd()}...` : title;
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** The next Monday on or after the day after `today`, as YYYY-MM-DD. */
export function nextWeeklyRun(today: string = SCENARIO_DATE): string {
  const date = new Date(`${today}T00:00:00Z`);
  const day = date.getUTCDay();
  const ahead = ((8 - day) % 7) || 7;
  date.setUTCDate(date.getUTCDate() + ahead);
  return date.toISOString().slice(0, 10);
}

export function displayDay(value: string): string {
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}.${month}.${year}`;
}

export function describeSchedule(schedule: SkillSchedule, language: Language, today: string = SCENARIO_DATE): string {
  if (schedule === "manual") return language === "de" ? "Laeuft, wenn Sie ihn starten" : "Runs when you run it";
  const next = displayDay(nextWeeklyRun(today));
  return language === "de" ? `Woechentlich am Montag, naechster Lauf ${next}` : `Weekly on Monday, next run ${next}`;
}
