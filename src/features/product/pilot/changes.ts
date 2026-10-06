/**
 * The changes the pilot's material actions approve, built the same way at
 * review and at submission.
 *
 * Server only. A material console action is approved against a fingerprint of
 * the change (`governConsoleAction`). The page computes that fingerprint when
 * it renders the approval, and the server action computes it again from the
 * state as it is when the form arrives. Both call the functions here, so a
 * change that moved in between (somebody else edited the cohort, the pilot's
 * status changed) produces a different fingerprint and is refused rather than
 * executed under an approval given for something else.
 */

import { fingerprintConsoleChange } from "@/features/product/governance";
import { EXIT_OUTCOME_EFFECT, type Bilingual, type ExitDecisionPayload } from "./rules";
import type { PilotWorkspace } from "./workspace";

export interface CohortChange {
  pilotId: string;
  cohortId: string;
  operation: "add" | "remove";
  userId: string;
  from: string[];
  to: string[];
}

/** The cohort as it would be after adding or removing one account. */
export function cohortChange(workspace: PilotWorkspace, userId: string, operation: "add" | "remove"): CohortChange | null {
  if (!workspace.cohort) return null;
  const from = [...workspace.cohort.userIds].sort();
  const to = operation === "add" ? [...new Set([...from, userId])].sort() : from.filter((id) => id !== userId);
  return { pilotId: workspace.pilot.id, cohortId: workspace.cohort.id, operation, userId, from, to };
}

export function cohortFingerprint(change: CohortChange): string {
  return fingerprintConsoleChange("pilot.manage-cohort", change);
}

export function cohortChangeLines(change: CohortChange, displayName: string, language: "en" | "de"): string[] {
  const list = (ids: readonly string[]) => (ids.length > 0 ? ids.join(", ") : language === "de" ? "niemand" : "nobody");
  return language === "de"
    ? [
        change.operation === "add" ? `${displayName} (${change.userId}) in die Pilotkohorte aufnehmen.` : `${displayName} (${change.userId}) aus der Pilotkohorte entfernen.`,
        `Kohorte vorher: ${list(change.from)}.`,
        `Kohorte nachher: ${list(change.to)}.`,
        "Die Mitgliedschaft ist eine Berechtigung, nie eine Kennzahl.",
      ]
    : [
        change.operation === "add" ? `Add ${displayName} (${change.userId}) to the pilot cohort.` : `Remove ${displayName} (${change.userId}) from the pilot cohort.`,
        `Cohort before: ${list(change.from)}.`,
        `Cohort after: ${list(change.to)}.`,
        "Membership is an entitlement, never a measure.",
      ];
}

/**
 * The exit decision change: what the person decided, and the pilot state it
 * was decided against. The state is part of the fingerprint, so a decision
 * reviewed against a running pilot cannot be recorded against a closed one.
 */
export interface ExitDecisionChange {
  decision: ExitDecisionPayload;
  against: { status: string; plannedEndOn: string | null; decisionsBefore: number };
}

export function exitDecisionChange(workspace: PilotWorkspace, decision: ExitDecisionPayload): ExitDecisionChange {
  return {
    decision,
    against: {
      status: workspace.pilot.status,
      plannedEndOn: workspace.pilot.plannedEndOn,
      decisionsBefore: workspace.exitDecisions.length,
    },
  };
}

export function exitDecisionFingerprint(change: ExitDecisionChange): string {
  return fingerprintConsoleChange("pilot.record-exit-decision", change);
}

export const EXIT_OUTCOME_LABELS: Record<ExitDecisionPayload["outcome"], Bilingual> = {
  scale: { en: "Scale", de: "Skalieren" },
  extend: { en: "Extend pilot", de: "Pilot verlaengern" },
  pause: { en: "Pause", de: "Pausieren" },
  stop: { en: "Stop", de: "Beenden" },
};

export const PILOT_STATUS_LABELS: Record<string, Bilingual> = {
  setup: { en: "In setup", de: "In Einrichtung" },
  running: { en: "Running", de: "Laufend" },
  paused: { en: "Paused", de: "Pausiert" },
  closed: { en: "Closed", de: "Abgeschlossen" },
};

export function exitDecisionLines(change: ExitDecisionChange, language: "en" | "de"): string[] {
  const d = change.decision;
  const say = (pair: Bilingual) => (language === "de" ? pair.de : pair.en);
  const to = EXIT_OUTCOME_EFFECT[d.outcome];
  const lines =
    language === "de"
      ? [
          `Abschlussentscheidung erfassen: ${say(EXIT_OUTCOME_LABELS[d.outcome])}.`,
          `Pilotstatus von ${say(PILOT_STATUS_LABELS[change.against.status] ?? { en: change.against.status, de: change.against.status })} auf ${say(PILOT_STATUS_LABELS[to] ?? { en: to, de: to })}.`,
          ...(d.extendedEndOn ? [`Neues geplantes Ende: ${d.extendedEndOn}.`] : []),
          `Nachweise: ${d.evidence.length}; offene Bedingungen: ${d.unresolvedConditions.length}; Kontrollbefunde: ${d.controlFindings.length}.`,
          `Kommerzielle Auswirkung, in Worten: ${d.commercialImplication}`,
          `Empfehlung fuer die naechste Welle: ${d.nextWaveRecommendation}`,
        ]
      : [
          `Record the exit decision: ${say(EXIT_OUTCOME_LABELS[d.outcome])}.`,
          `Pilot status from ${say(PILOT_STATUS_LABELS[change.against.status] ?? { en: change.against.status, de: change.against.status })} to ${say(PILOT_STATUS_LABELS[to] ?? { en: to, de: to })}.`,
          ...(d.extendedEndOn ? [`New planned end: ${d.extendedEndOn}.`] : []),
          `Evidence: ${d.evidence.length}; unresolved conditions: ${d.unresolvedConditions.length}; control findings: ${d.controlFindings.length}.`,
          `Commercial implication, in words: ${d.commercialImplication}`,
          `Next-wave recommendation: ${d.nextWaveRecommendation}`,
        ];
  return lines;
}
