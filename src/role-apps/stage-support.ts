/**
 * Read helpers shared by the stage implementations.
 *
 * Small and deliberately boring: the evidence a stage may cite is the evidence
 * revealed by the current scenario moment, dates are shown the way the
 * scenario writes them, and lists are de-duplicated in a stable order. Every
 * stage implementation uses these so two stages cannot disagree about which
 * documents are visible at 07:45.
 */

import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { evidenceDocuments } from "@/db/schema/work";
import { momentToMinutes } from "@/domain/nfr/calculators";
import type { ScenarioState } from "@/scenario/engine/state";

export type EvidenceRow = typeof evidenceDocuments.$inferSelect;

/** Every evidence document revealed at or before the current scenario moment. */
export function revealedEvidence(runId: string, state: ScenarioState): EvidenceRow[] {
  const now = momentToMinutes(state.currentMoment);
  return getDb()
    .select()
    .from(evidenceDocuments)
    .where(eq(evidenceDocuments.runId, runId))
    .all()
    .filter((doc) => momentToMinutes(doc.revealedAtMoment) <= now)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Documents that evidence any of the given object identifiers. */
export function relatedTo(docs: readonly EvidenceRow[], ids: readonly string[], sourceTypes?: readonly string[]): EvidenceRow[] {
  const wanted = new Set(ids);
  return docs.filter(
    (doc) =>
      (sourceTypes === undefined || sourceTypes.includes(doc.sourceType)) &&
      doc.relatedObjectIds.some((id) => wanted.has(id)),
  );
}

/** "2026-09-28" or an ISO timestamp to "28.09.2026". */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : value;
}

export function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

/** A number with thousands separators, English or German. */
export function formatNumber(value: number, language: "en" | "de"): string {
  return value.toLocaleString(language === "de" ? "de-DE" : "en-GB");
}
