/**
 * Matching and grouping, pure.
 *
 * The palette filters a prepared list rather than querying, so typing is
 * instant and nothing about the database reaches the browser. This module is
 * that filter, kept free of React and of the database so the palette, the
 * tests and any later server-side search apply exactly one rule.
 *
 * The rule:
 *
 *   Every word of the query has to appear somewhere in the entry: its label,
 *   its reference, its identifier, its detail line or its keywords. Words, not
 *   a subsequence of letters. The V2 palette matched subsequences, and its own
 *   comments record what that cost: a destructive row came back for almost
 *   any query. A professional search for "CTL-PAY" should return controls,
 *   not every row containing a C, a T and an L in that order.
 *
 *   Within a group, an exact reference beats a reference prefix, which beats a
 *   label that starts with the query, which beats a word in the label, which
 *   beats a match anywhere else. Ties keep the read model's order.
 *
 *   Groups follow the role's kind order, with one exception: a group holding
 *   an exact reference match leads. Typing "CTL-PAY-014" means the control,
 *   not the meeting about it, even though meetings come first in the order.
 *   Each group shows at most `perGroup` hits and states how many more
 *   matched, so a broad query cannot bury the other types under one long list.
 */

import type { SearchEntry, SearchGroup, SearchKind } from "./types";
import { KIND_LABELS, say } from "./copy";
import type { Language } from "@/i18n/labels";

/** Hits shown per group when the whole scope is searched. */
export const HITS_PER_GROUP = 5;

/** Hits shown when the search is narrowed to one type. */
export const HITS_PER_KIND = 25;

/*
 * German letters the interface never prints but a reader may type. Written as
 * escapes so this file itself carries no umlaut, and mapped to the ASCII
 * transliteration every German string in the product already uses.
 */
const TRANSLITERATION: ReadonlyArray<[string, string]> = [
  ["\u00e4", "ae"],
  ["\u00f6", "oe"],
  ["\u00fc", "ue"],
  ["\u00df", "ss"],
];

/** Lower case, transliterated, accents removed, whitespace collapsed. */
export function normaliseForSearch(text: string): string {
  let value = text.toLowerCase();
  for (const [from, to] of TRANSLITERATION) value = value.split(from).join(to);
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The words of a query. Empty when the query is blank. */
export function queryTerms(query: string): string[] {
  const normalised = normaliseForSearch(query);
  return normalised.length === 0 ? [] : normalised.split(" ");
}

/**
 * How well one entry matches, lower is better, or null for no match.
 *
 * Exported for the tests, which pin the ordering rule above.
 */
export function scoreEntry(entry: SearchEntry, terms: readonly string[]): number | null {
  if (terms.length === 0) return 0;

  const label = normaliseForSearch(entry.label);
  const reference = normaliseForSearch(entry.reference);
  const id = normaliseForSearch(entry.id);
  const haystack = [label, reference, id, normaliseForSearch(entry.detail ?? ""), normaliseForSearch(entry.keywords)].join(
    " ",
  );

  for (const term of terms) {
    if (!haystack.includes(term)) return null;
  }

  const phrase = terms.join(" ");
  if (reference === phrase || id === phrase) return 0;
  if (reference.startsWith(phrase) || id.startsWith(phrase)) return 1;
  if (label.startsWith(phrase)) return 2;
  if (label.split(" ").some((word) => word.startsWith(terms[0] ?? ""))) return 3;
  return 4;
}

/**
 * Matches the entries and groups them by object type.
 *
 * With `kind` set, only that type is searched and up to `HITS_PER_KIND` are
 * shown; a blank query then lists the type, which is what "Find supplier"
 * opens on. Without it, a blank query returns no groups: the palette shows its
 * commands, recent and pinned items instead of every object in scope.
 */
export function searchEntries(
  entries: readonly SearchEntry[],
  query: string,
  options: { kindOrder: readonly SearchKind[]; language: Language; kind?: SearchKind | null },
): SearchGroup[] {
  const terms = queryTerms(query);
  const kind = options.kind ?? null;
  if (terms.length === 0 && kind === null) return [];

  const limit = kind === null ? HITS_PER_GROUP : HITS_PER_KIND;
  const scored = new Map<SearchKind, Array<{ entry: SearchEntry; score: number; order: number }>>();

  entries.forEach((entry, order) => {
    if (kind !== null && entry.kind !== kind) return;
    const score = scoreEntry(entry, terms);
    if (score === null) return;
    const list = scored.get(entry.kind) ?? [];
    list.push({ entry, score, order });
    scored.set(entry.kind, list);
  });

  const groups: Array<SearchGroup & { exact: boolean }> = [];
  for (const groupKind of options.kindOrder) {
    const list = scored.get(groupKind);
    if (!list || list.length === 0) continue;
    list.sort((a, b) => a.score - b.score || a.order - b.order);
    groups.push({
      kind: groupKind,
      label: say(KIND_LABELS[groupKind], options.language),
      hits: list.slice(0, limit).map((row) => row.entry),
      total: list.length,
      exact: terms.length > 0 && list[0]?.score === 0,
    });
  }
  /* A stable sort, so the kind order holds within the exact and the other groups. */
  return groups
    .map((group, index) => ({ group, index }))
    .sort((a, b) => Number(b.group.exact) - Number(a.group.exact) || a.index - b.index)
    .map(({ group: { exact: _exact, ...group } }) => group);
}

/** The hits of every group in display order, which is the keyboard order. */
export function flattenGroups(groups: readonly SearchGroup[]): SearchEntry[] {
  return groups.flatMap((group) => group.hits);
}
