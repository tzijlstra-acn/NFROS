/**
 * SourceFreshness: one quiet line saying where an item's data came from.
 *
 * Derived from the evidence the item actually cites, never asserted. The
 * source systems in this product are the synthetic institution's simulated
 * systems, so the label is `Simulated` in the product's status vocabulary,
 * and a stale document is counted by name rather than averaged away. An item
 * with no source document says so instead of claiming a freshness it does not
 * have.
 */

import type { Language } from "@/i18n/labels";
import { COPY, fill, say } from "./copy";
import type { EvidenceRef, SourceFreshnessView } from "./model";

export function sourceFreshness(evidence: readonly EvidenceRef[], language: Language): SourceFreshnessView {
  if (evidence.length === 0) {
    return {
      label: say(COPY.freshnessNone, language),
      tone: "neutral",
      detail: say(COPY.freshnessNoneDetail, language),
    };
  }

  const systems = [...new Set(evidence.map((entry) => entry.sourceSystem).filter((s) => s.length > 0))];
  const stale = evidence.filter((entry) => entry.stale).length;
  const systemsText = systems.length > 0 ? systems.slice(0, 3).join(", ") : "-";

  return {
    label: say(COPY.freshnessSimulated, language),
    tone: stale > 0 ? "warning" : "neutral",
    detail:
      stale > 0
        ? fill(say(COPY.freshnessStale, language), { count: evidence.length, systems: systemsText, stale })
        : fill(say(COPY.freshnessDetail, language), { count: evidence.length, systems: systemsText }),
  };
}

/** The tone for an evidence document's status. */
export function evidenceTone(status: string, stale: boolean): EvidenceRef["statusTone"] {
  if (status === "missing" || status === "requested") return "warning";
  if (stale || status === "superseded" || status === "draft") return "warning";
  if (status === "current") return "success";
  return "neutral";
}

export const EVIDENCE_STATUS_LABELS: Record<string, { en: string; de: string }> = {
  current: { en: "Current", de: "Aktuell" },
  superseded: { en: "Superseded", de: "Ersetzt" },
  draft: { en: "Draft", de: "Entwurf" },
  requested: { en: "Requested", de: "Angefordert" },
  missing: { en: "Missing", de: "Fehlt" },
};

/** Says where a document filed from an inbox message came from, wherever it is listed. */
const FILED_FROM_MESSAGE = { en: "filed from message {id}", de: "aus Nachricht {id} abgelegt" };

/** Builds an evidence reference from a document row. Kept here so every module labels alike. */
export function evidenceRef(
  doc: {
    id: string;
    title: string;
    titleDe: string;
    status: string;
    isStale: boolean;
    sourceSystem: string;
    /** Lineage (migration 0005): the inbox message the document was filed from. */
    sourceMessageId?: string | null;
  },
  relation: string,
  language: Language,
): EvidenceRef {
  const statusLabel = EVIDENCE_STATUS_LABELS[doc.status];
  const fromMessage = doc.sourceMessageId ? fill(say(FILED_FROM_MESSAGE, language), { id: doc.sourceMessageId }) : null;
  return {
    id: doc.id,
    title: language === "de" && doc.titleDe.length > 0 ? doc.titleDe : doc.title,
    status: statusLabel ? say(statusLabel, language) : doc.status,
    statusTone: evidenceTone(doc.status, doc.isStale),
    stale: doc.isStale,
    sourceSystem: doc.sourceSystem,
    relation: fromMessage ? `${relation}, ${fromMessage}` : relation,
  };
}
