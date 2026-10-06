/**
 * The AI layer of inbox triage: which path proposed a classification, and
 * whether it may be shown.
 *
 * Pure: the mode is passed in by the loader, which reads it from the runtime
 * configuration. The branch is the one the process engine runs for a stage
 * preparation and the meeting lifecycle runs for minutes, narrowed to one
 * message:
 *
 *   safe     serves the proposal captured with the message before the day
 *            (`proposed_triage`, `triage_rationale`, `triage_confidence`),
 *            once it passes the validator; otherwise it composes, and says
 *            why.
 *   offline  composes from the message's own facts (`composeTriage`): its
 *            source, its linked object, its response deadline, the earlier
 *            message it duplicates, the decision it names. Composition does
 *            not estimate a confidence, and says so.
 *   live     is not connected for the inbox. No model is called from here; a
 *            live configuration is served as safe, and the note says so.
 *
 * Every candidate, whichever path produced it, passes
 * `validateTriageProposal`. One that does not is never shown, and a message
 * with no valid proposal says that no classification is proposed, rather
 * than showing a classification without its reason.
 */

import type { Pair } from "../../copy";
import { displayDate, dateOf, timeOf } from "../../model";
import type { InboxRow } from "../../shared";
import type { MessageSource } from "./sources";
import {
  INBOX_TRIAGE_SCHEMA_VERSION,
  isInboxClassification,
  validateTriageProposal,
  type InboxClassification,
  type TriageProposal,
} from "./triage-schema";

export type TriageMode = "safe" | "offline";

export interface TriageModeSetting {
  mode: TriageMode;
  /** True when the runtime asked for live mode, which the inbox serves as safe. */
  live: boolean;
}

export interface TriageContext {
  /** Every identifier the message context holds, for the citation check. */
  knownIds: ReadonlySet<string>;
  source: MessageSource;
  /** The earlier message this one duplicates, when the role can see it. */
  original: Pick<InboxRow, "id" | "proposedTriage" | "confirmedTriage"> | null;
  /** The status of a decision the message names, when the role can see it. */
  decisionStatus: string | null;
}

export interface TriageResult {
  proposal: TriageProposal | null;
  mode: TriageMode | "unavailable";
  note: Pair;
}

export const TRIAGE_NOTES = {
  safe: {
    en: "Prepared before the day and checked against the message.",
    de: "Vor dem Tag vorbereitet und gegen die Nachricht geprueft.",
  },
  live: {
    en: "Live classification is not connected for the inbox, so the proposal prepared before the day is shown.",
    de: "Eine Live-Einordnung ist fuer den Posteingang nicht angebunden, daher wird der vor dem Tag vorbereitete Vorschlag gezeigt.",
  },
  offline: {
    en: "Composed offline from the message's own facts. Confidence is not estimated offline.",
    de: "Offline aus den Angaben der Nachricht zusammengestellt. Eine Sicherheit wird offline nicht geschaetzt.",
  },
  fellBack: {
    en: "The proposal stored with the message did not pass the checks, so this one was composed offline from the message.",
    de: "Der mit der Nachricht gespeicherte Vorschlag hat die Pruefungen nicht bestanden, daher wurde dieser offline aus der Nachricht zusammengestellt.",
  },
  unavailable: {
    en: "No classification passed the checks, so none is proposed. Classify the message yourself.",
    de: "Keine Einordnung hat die Pruefungen bestanden, daher wird keine vorgeschlagen. Ordnen Sie die Nachricht selbst ein.",
  },
} as const satisfies Record<string, Pair>;

/** The identifiers the proposal is attached to: the message, its object, the message it repeats. */
function attachedIds(row: Pick<InboxRow, "id" | "relatedObjectId" | "isDuplicateOf">): string[] {
  return [row.id, row.relatedObjectId, row.isDuplicateOf].filter((id): id is string => typeof id === "string" && id.length > 0);
}

/** The candidate captured with the message before the day, in the proposal shape. */
export function capturedCandidate(
  row: Pick<InboxRow, "id" | "proposedTriage" | "triageRationale" | "triageConfidence" | "relatedObjectId" | "isDuplicateOf">,
): unknown {
  return {
    schemaVersion: INBOX_TRIAGE_SCHEMA_VERSION,
    messageId: row.id,
    classification: row.proposedTriage,
    rationale: { en: row.triageRationale, de: null },
    confidence: row.triageConfidence,
    citedIds: attachedIds(row),
  };
}

function when(iso: string): string {
  return `${displayDate(dateOf(iso))} ${timeOf(iso)}`;
}

function proposal(
  row: Pick<InboxRow, "id" | "relatedObjectId" | "isDuplicateOf">,
  classification: InboxClassification,
  rationale: Pair,
): TriageProposal {
  return {
    schemaVersion: INBOX_TRIAGE_SCHEMA_VERSION,
    messageId: row.id,
    classification,
    rationale: { en: rationale.en, de: rationale.de },
    confidence: null,
    citedIds: attachedIds(row),
  };
}

/**
 * The offline classification, from the message's own facts.
 *
 * Deterministic and deliberately conservative: each rule names the fact it
 * rests on, so the rationale is a reason a reader can check against the
 * message, not a verdict. The rules run in order and the first that applies
 * decides.
 */
export function composeTriage(
  row: Pick<
    InboxRow,
    "id" | "fromUserId" | "relatedObjectKind" | "relatedObjectId" | "linkedDecisionId" | "isDuplicateOf" | "requiresResponseBy"
  >,
  context: Pick<TriageContext, "source" | "original" | "decisionStatus">,
): TriageProposal {
  const object = row.relatedObjectId;

  /* 1. A decision it names. A recorded one leaves nothing to decide. */
  const decisionId = row.linkedDecisionId ?? (row.relatedObjectKind === "decision" ? object : null);
  if (decisionId) {
    if (context.decisionStatus !== null && context.decisionStatus !== "open") {
      return proposal(row, "information", {
        en: `It reports on decision ${decisionId}, which is already recorded. Nothing remains to decide from the inbox.`,
        de: `Sie berichtet ueber die Entscheidung ${decisionId}, die bereits erfasst ist. Im Posteingang bleibt nichts zu entscheiden.`,
      });
    }
    return proposal(row, "decision", {
      en: `It concerns decision ${decisionId}. The judgment is taken on Decisions, with its evidence, not in the inbox.`,
      de: `Sie betrifft die Entscheidung ${decisionId}. Die Beurteilung erfolgt unter Entscheidungen mit ihren Nachweisen, nicht im Posteingang.`,
    });
  }

  /* 2. A repeat of an earlier request follows the earlier message. */
  if (row.isDuplicateOf) {
    const earlier = context.original ? (context.original.confirmedTriage ?? context.original.proposedTriage) : null;
    const follows = isInboxClassification(earlier) && earlier !== "noise" ? earlier : "information";
    return proposal(row, follows, {
      en: `It asks for the same thing as ${row.isDuplicateOf}. One answer serves both, so it follows the earlier message.`,
      de: `Sie fragt dasselbe an wie ${row.isDuplicateOf}. Eine Antwort genuegt fuer beide, daher folgt sie der frueheren Nachricht.`,
    });
  }

  /* 3. A service notice about nothing the role works on. */
  if (context.source.kind === "service-management" && !object) {
    return proposal(row, "noise", {
      en: "A service-management notice that names no object the role works on and asks for nothing.",
      de: "Eine Service-Management-Meldung, die kein Objekt der Rolle nennt und nichts anfragt.",
    });
  }

  /* 4. A document it carries or names. */
  if (row.relatedObjectKind === "evidence-document" && object) {
    return proposal(row, "evidence", {
      en: `It carries or names the document ${object}. File it with what it supports, so the evidence trail is complete.`,
      de: `Sie enthaelt oder nennt das Dokument ${object}. Legen Sie es bei dem ab, was es belegt, damit der Nachweisweg vollstaendig ist.`,
    });
  }

  /* 5. A supplier's own submission. */
  if (context.source.kind === "supplier-submission") {
    return proposal(row, "evidence", {
      en: `A submission from the supplier's own contact${object ? ` about ${object}` : ""}. Keep it as evidence of what was provided.`,
      de: `Eine Einreichung des Lieferantenkontakts${object ? ` zu ${object}` : ""}. Bewahren Sie sie als Nachweis des Gelieferten auf.`,
    });
  }

  /* 6. A response deadline. */
  if (row.requiresResponseBy) {
    return proposal(row, "action", {
      en: `It asks for a response by ${when(row.requiresResponseBy)}. A deadline on the role's desk needs an owned action.`,
      de: `Sie erwartet eine Antwort bis ${when(row.requiresResponseBy)}. Eine Frist der Rolle braucht eine verantwortete Massnahme.`,
    });
  }

  /* 7. An open action it concerns. */
  if (row.relatedObjectKind === "action" && object) {
    return proposal(row, "action", {
      en: `It concerns the action ${object}. Record it on that action rather than leaving it in the inbox.`,
      de: `Sie betrifft die Massnahme ${object}. Erfassen Sie sie dort, statt sie im Posteingang zu belassen.`,
    });
  }

  /* 8. Machine output about an object the role works on. */
  if ((context.source.kind === "monitoring-event" || context.source.kind === "grc-queue") && object) {
    const monitoring = context.source.kind === "monitoring-event";
    return proposal(row, "action", {
      en: `${monitoring ? "A monitoring event" : "A GRC queue item"} on ${object}. System output reporting an open item or a breach needs an owned response.`,
      de: `${monitoring ? "Ein Ueberwachungsereignis" : "Ein Eintrag der GRC-Warteschlange"} zu ${object}. Systemmeldungen zu einem offenen Punkt oder einer Ueberschreitung brauchen eine verantwortete Reaktion.`,
    });
  }

  /* 9. Nothing linked. An automated notice is noise; a person's note is information. */
  if (!object) {
    return row.fromUserId === null
      ? proposal(row, "noise", {
          en: "An automated notice that names no object the role works on and asks for nothing.",
          de: "Eine automatische Mitteilung, die kein Objekt der Rolle nennt und nichts anfragt.",
        })
      : proposal(row, "information", {
          en: "It names no object the role works on and asks for nothing by a date. Note it and file it.",
          de: "Sie nennt kein Objekt der Rolle und erwartet nichts bis zu einem Datum. Zur Kenntnis nehmen und ablegen.",
        });
  }

  /* 10. Everything else reports without asking. */
  return proposal(row, "information", {
    en: `It reports on ${object} without asking for anything by a date. Note it and file it.`,
    de: `Sie berichtet zu ${object}, ohne etwas bis zu einem Datum zu erwarten. Zur Kenntnis nehmen und ablegen.`,
  });
}

/** The proposal for one message in the given mode. Every path is validated. */
export function proposeTriage(
  row: Pick<
    InboxRow,
    | "id"
    | "fromUserId"
    | "proposedTriage"
    | "triageRationale"
    | "triageConfidence"
    | "relatedObjectKind"
    | "relatedObjectId"
    | "linkedDecisionId"
    | "isDuplicateOf"
    | "requiresResponseBy"
  >,
  context: TriageContext,
  setting: TriageModeSetting,
): TriageResult {
  const check = { messageId: row.id, knownIds: context.knownIds };
  let fellBack = false;

  if (setting.mode === "safe") {
    const captured = validateTriageProposal(capturedCandidate(row), check);
    if (captured.ok) return { proposal: captured.output, mode: "safe", note: setting.live ? TRIAGE_NOTES.live : TRIAGE_NOTES.safe };
    fellBack = true;
  }

  const composed = validateTriageProposal(composeTriage(row, context), check);
  if (composed.ok) return { proposal: composed.output, mode: "offline", note: fellBack ? TRIAGE_NOTES.fellBack : TRIAGE_NOTES.offline };
  return { proposal: null, mode: "unavailable", note: TRIAGE_NOTES.unavailable };
}
