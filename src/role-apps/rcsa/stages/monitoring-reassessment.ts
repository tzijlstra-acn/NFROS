/**
 * RCSA Stage 8, Monitoring and Reassessment.
 *
 * The AI prepares four things: the monitoring routine for the indicators in
 * breach (and what is already switched on), the events linked to the scope,
 * the committee delta (what the cycle changed, from its own records and
 * decisions), and a reassessment proposal: whether what happened on the scope
 * since the assessment is a candidate material change.
 *
 * The person decides three things explicitly in the monitoring review (the
 * review frequency and escalation threshold, whether there is a material
 * change, whether it needs escalation) and then the stage decision: close
 * the cycle on enhanced monitoring, open an off-cycle reassessment, or hold
 * for an escalation. The decision rules keep the two consistent: a recorded
 * material change cannot close on monitoring alone, and an off-cycle
 * reassessment needs one.
 *
 * Governed changes, each under its own approval: enhanced monitoring of the
 * indicator (`activateMonitoring`), and, for an off-cycle reassessment, the
 * off-cycle assessment itself (`initiateReassessment`). When the stage then
 * completes, the completion hook starts a new run of the RCSA Cycle Assistant
 * on that assessment, opened at Stage 1 and scoped as event-driven, inside
 * the completion transaction (`startProcessRun`). The run's identifier is
 * in the monitoring plan the person approved. No Role App is installed:
 * Event-Driven Reassessment stays a preview app, and the new run is a run of
 * the installed one.
 *
 * Synthetic institution and data.
 */

import { z } from "zod";
import type { Bilingual } from "@/role-apps/contracts";
import { formatDate, unique } from "@/role-apps/stage-support";
import {
  registerArtifactBuilder,
  registerCompletionHook,
  registerDecisionRules,
  registerPayloadBuilder,
  registerPreparer,
  registerTaskForm,
  type PreparerInput,
} from "@/features/process/registry";
import type { SourceRecord, StageContext } from "@/features/process/types";
import type { StagePreparationOutput } from "@/features/process/preparation-schema";
import { recordedTaskOutput } from "@/features/process/tasks";
import { findTask, parseTaskOutput, type ToolTaskOutput } from "@/features/process/derive";
import { taskKey } from "@/features/process/keys";
import { startProcessRun } from "@/features/process/runs";
import { appetiteLabel, decisionOf, fact, list, personLabel, ratingLabel, recordsOf, scopeOf, sourceOf, RCSA_PROCESS_ID } from "./shared";

const STAGE_ID = "monitoring-reassessment";
const FREQUENCY_DAYS: Record<string, number> = { weekly: 7, fortnightly: 14, monthly: 30 };

/* ==========================================================================
   What the stage monitors
   ========================================================================== */

/**
 * The indicator the monitoring routine is set on: the one a decision of the
 * cycle was taken on (DEC-2026-0771 is about KRI-PAY-007), else the first Red
 * one, else the first Amber, else the first.
 */
function primaryIndicator(sources: StageContext["sources"]): SourceRecord | undefined {
  const readings = recordsOf(sources, "kri-readings");
  const decided = new Set(recordsOf(sources, "cycle-decisions").map((record) => fact(record, "relatedObjectId")));
  return (
    readings.find((record) => decided.has(record.id) && fact(record, "status") !== "green") ??
    readings.find((record) => fact(record, "status") === "red") ??
    readings.find((record) => fact(record, "status") === "amber") ??
    readings[0]
  );
}

/** Open incidents detected on the scenario day: the candidates for a material change since the assessment. */
function eventCandidates(context: StageContext): SourceRecord[] {
  return recordsOf(context.sources, "incidents").filter(
    (record) =>
      !["closed", "recovered"].includes(fact(record, "status")) && fact(record, "detectedAt").slice(0, 10) === context.state.scenarioDate,
  );
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/* ==========================================================================
   The preparer
   ========================================================================== */

function composeMonitoring(input: PreparerInput): StagePreparationOutput {
  const context = { ...input.context, sources: input.sources };
  const { sources } = input;
  const primary = primaryIndicator(sources);
  const red = recordsOf(sources, "kri-readings").filter((record) => fact(record, "status") === "red");
  const findings: StagePreparationOutput["findings"] = [];
  const inferences: StagePreparationOutput["inferences"] = [];
  const gaps: StagePreparationOutput["gaps"] = [];
  const limitations: StagePreparationOutput["limitations"] = [];
  const itemAssessments: StagePreparationOutput["itemAssessments"] = [];
  const plan = recordsOf(sources, "cycle-record").find((record) => fact(record, "artifactKey") === "assessment-submission");
  const rating = recordsOf(sources, "cycle-record").find((record) => fact(record, "artifactKey") === "rating-record");

  /* Monitoring routines. */
  if (primary) {
    findings.push({
      sourceKey: "kri-readings",
      statement: {
        en: `Proposed routine: review ${primary.id} ${fact(primary, "status") === "red" ? "weekly" : "fortnightly"} until ${fact(plan, "actionId") || "the plan action"} closes, escalating on a further Red reading. ${red.length > 1 ? `${list(red.filter((record) => record.id !== primary.id).map((record) => record.id), "en")} are Red too and are reviewed with it.` : ""}`.trim(),
        de: `Vorgeschlagene Routine: ${primary.id} ${fact(primary, "status") === "red" ? "woechentlich" : "zweiwoechentlich"} pruefen, bis ${fact(plan, "actionId") || "die geplante Massnahme"} abgeschlossen ist, mit Eskalation bei einem weiteren roten Wert. ${red.length > 1 ? `${list(red.filter((record) => record.id !== primary.id).map((record) => record.id), "de")} sind ebenfalls rot und werden mitgeprueft.` : ""}`.trim(),
      },
      evidenceIds: primary.evidenceIds.slice(0, 2),
      basis: "verified-fact",
    });
  }
  const active = recordsOf(sources, "monitoring-activations");
  if (active.length > 0) {
    findings.push({
      sourceKey: "monitoring-activations",
      statement: {
        en: `Already active on the scope: ${active.map((record) => `${record.value}`).join("; ")}.`,
        de: `Bereits aktiv im Umfang: ${active.map((record) => `${record.value}`).join("; ")}.`,
      },
      evidenceIds: [],
      basis: "approved-record",
    });
  }

  /* Event links. */
  const events = eventCandidates(context);
  const incidents = recordsOf(sources, "incidents");
  if (incidents.length > 0) {
    findings.push({
      sourceKey: "incidents",
      statement: {
        en: `${incidents.length} incident(s) on the process; ${events.length} detected today and still open${events.length > 0 ? `: ${list(events.map((record) => `${record.id} ${record.label}`), "en")}` : ""}.`,
        de: `${incidents.length} Vorfaelle im Prozess; ${events.length} heute erkannt und noch offen${events.length > 0 ? `: ${list(events.map((record) => `${record.id} ${fact(record, "titleDe") || record.label}`), "de")}` : ""}.`,
      },
      evidenceIds: unique(events.flatMap((record) => record.evidenceIds)).slice(0, 3),
      basis: "approved-record",
    });
  } else if (sourceOf(sources, "incidents")?.status === "unavailable") {
    limitations.push({ en: "The incident record was unavailable, so events after the assessment may be missing.", de: "Die Vorfallerfassung war nicht verfuegbar; Ereignisse nach der Bewertung koennen fehlen." });
  }

  /* Committee delta. */
  const decided = recordsOf(sources, "cycle-decisions").filter((record) => fact(record, "status") === "decided");
  if (rating || decided.length > 0) {
    findings.push({
      sourceKey: rating ? "cycle-record" : "cycle-decisions",
      statement: {
        en: `For the committee: ${rating ? `${fact(rating, "keyRiskId")} ratified ${ratingLabel(fact(rating, "rating"), "en")}, ${appetiteLabel(fact(rating, "appetite"), "en")}` : "no rating record yet"}${plan && fact(plan, "actionId") ? `; plan action ${fact(plan, "actionId")} owned by ${personLabel(context.runId, fact(plan, "owner"))}, due ${formatDate(fact(plan, "dueOn"))}` : ""}; ${decided.length} cycle decision(s) recorded${decided.length > 0 ? ` (${list(decided.map((record) => record.id), "en")})` : ""}.`,
        de: `Fuer das Komitee: ${rating ? `${fact(rating, "keyRiskId")} ratifiziert mit ${ratingLabel(fact(rating, "rating"), "de")}, ${appetiteLabel(fact(rating, "appetite"), "de")}` : "noch kein Bewertungsprotokoll"}${plan && fact(plan, "actionId") ? `; Massnahme ${fact(plan, "actionId")} verantwortet von ${personLabel(context.runId, fact(plan, "owner"))}, faellig ${formatDate(fact(plan, "dueOn"))}` : ""}; ${decided.length} Zyklusentscheidungen erfasst${decided.length > 0 ? ` (${list(decided.map((record) => record.id), "de")})` : ""}.`,
      },
      evidenceIds: unique(decided.flatMap((record) => record.evidenceIds)).slice(0, 3),
      basis: "approved-record",
    });
  }

  /* Reassessment proposal, labelled as an inference. */
  if (events.length > 0) {
    inferences.push({
      statement: {
        en: `${list(events.map((record) => record.id), "en")} happened on the scope after the assessment position was formed. It is a candidate material change, and an off-cycle reassessment is the way to put it on the record.`,
        de: `${list(events.map((record) => record.id), "de")} ist im Umfang nach der Bewertung eingetreten. Es ist ein Kandidat fuer eine wesentliche Aenderung; eine ausserplanmaessige Neubewertung bringt sie in den Datensatz.`,
      },
      evidenceIds: unique(events.flatMap((record) => record.evidenceIds)).slice(0, 3),
      uncertainty: {
        en: "Whether the event changes the risk, rather than confirming the position already taken, is the judgment this stage asks for.",
        de: "Ob das Ereignis das Risiko veraendert oder die bereits eingenommene Position bestaetigt, ist genau die Beurteilung dieser Stufe.",
      },
    });
  } else {
    gaps.push({
      key: "gap-no-new-event",
      statement: {
        en: "No open incident on the scope was detected after the assessment. A material change would have to come from another source.",
        de: "Nach der Bewertung wurde kein offener Vorfall im Umfang erkannt. Eine wesentliche Aenderung muesste aus einer anderen Quelle kommen.",
      },
      evidenceIds: [],
      severity: "minor",
    });
  }

  itemAssessments.push(
    {
      itemId: "frequency",
      proposedDisposition: "accept",
      note: { en: `${primary && fact(primary, "status") === "red" ? "Weekly" : "Fortnightly"}, with escalation on a further Red reading.`, de: `${primary && fact(primary, "status") === "red" ? "Woechentlich" : "Zweiwoechentlich"}, mit Eskalation bei einem weiteren roten Wert.` },
    },
    {
      itemId: "material-change",
      proposedDisposition: events.length > 0 ? "outstanding" : "accept",
      note: events.length > 0 ? { en: `Possibly: ${list(events.map((record) => record.id), "en")}.`, de: `Moeglicherweise: ${list(events.map((record) => record.id), "de")}.` } : { en: "No new event on the scope.", de: "Kein neues Ereignis im Umfang." },
    },
    { itemId: "escalation", proposedDisposition: "accept", note: { en: "Not proposed; the committee receives the cycle through its paper.", de: "Nicht vorgeschlagen; das Komitee erhaelt den Zyklus ueber die Vorlage." } },
  );

  return {
    schemaVersion: "stage-preparation-v1",
    summary: {
      en: `Monitoring: ${primary ? `${primary.id} is ${fact(primary, "status") === "red" ? "Red" : fact(primary, "status") === "amber" ? "Amber" : "Green"}` : "no indicator is loaded"}. ${events.length > 0 ? `${events.length} open event(s) since the assessment make an off-cycle reassessment a candidate.` : "No new event on the scope suggests an off-cycle reassessment."}`,
      de: `Ueberwachung: ${primary ? `${primary.id} ist ${fact(primary, "status") === "red" ? "rot" : fact(primary, "status") === "amber" ? "gelb" : "gruen"}` : "kein Indikator geladen"}. ${events.length > 0 ? `${events.length} offene Ereignisse seit der Bewertung machen eine ausserplanmaessige Neubewertung zum Kandidaten.` : "Kein neues Ereignis im Umfang spricht fuer eine ausserplanmaessige Neubewertung."}`,
    },
    findings,
    inferences,
    contradictions: [],
    gaps,
    itemAssessments,
    proposals: [
      { toolKey: "activate-indicator-monitoring", rationale: { en: "Switch on the routine the review sets, so the indicator is watched until the plan closes.", de: "Die festgelegte Routine aktivieren, damit der Indikator bis zum Abschluss des Plans beobachtet wird." } },
      ...(events.length > 0
        ? [{ toolKey: "open-reassessment", rationale: { en: "If you judge the event a material change, create the off-cycle reassessment and start its run.", de: "Wenn Sie das Ereignis als wesentliche Aenderung beurteilen, die ausserplanmaessige Neubewertung anlegen und ihren Durchlauf starten." } }]
        : []),
    ],
    recommendedOptionId: events.length > 0 ? "monitoring-off-cycle" : "monitoring-standard",
    limitations,
  };
}

const PROMPT = `You prepare Stage 8 (Monitoring and Reassessment) of a Risk and Control Self-Assessment for a second-line Operational Risk Partner at a synthetic bank.
Use only the source records provided. Propose the monitoring routine for the indicators in breach, link the events on the scope, state the committee delta from the cycle's records and decisions, and say whether an event is a candidate material change (as an inference, with its uncertainty).
Give proposals in itemAssessments for "frequency", "material-change" and "escalation". Do not decide the material change, the reassessment or the escalation; they are human decisions.
Write every text field in British English ("en") and in German ("de", ASCII only: ae, oe, ue, ss; no umlauts). No dashes as punctuation.`;

registerPreparer("rcsa.monitoring-reassessment", {
  compose: (input) => composeMonitoring(input),
  prompt: ({ context, sources }) => ({
    instructions: PROMPT,
    input: JSON.stringify({
      assessment: context.run.subjectId,
      stage: context.stage.name,
      scenarioDate: context.state.scenarioDate,
      sources: sources.map((source) => ({
        key: source.spec.key,
        status: source.status,
        records: source.result.records.map((record) => ({ id: record.id, label: record.label, value: record.value, evidenceIds: record.evidenceIds, facts: record.facts })),
      })),
      tools: context.stage.tools.map((tool) => tool.key),
    }),
  }),
  itemIds: () => ["frequency", "material-change", "escalation"],
});

/* ==========================================================================
   The monitoring review form
   ========================================================================== */

const reviewSchema = z.object({
  frequency: z.enum(["weekly", "fortnightly", "monthly"], { message: "Set the review frequency." }),
  threshold: z.string().min(5, "State the escalation threshold.").max(600),
  materialChange: z.enum(["yes", "no"], { message: "Say whether there is a material change." }),
  materialChangeNote: z.string().max(600),
  escalation: z.enum(["required", "not-required"], { message: "Say whether escalation is required." }),
  escalationNote: z.string().max(600),
});
type ReviewInput = z.infer<typeof reviewSchema>;

function hint(context: StageContext, itemId: string, language: "en" | "de"): string {
  const proposal = context.preparation.output?.itemAssessments.find((item) => item.itemId === itemId);
  return proposal ? ` ${language === "de" ? "KI-Hinweis" : "AI note"}: ${language === "de" ? proposal.note.de : proposal.note.en}` : "";
}

registerTaskForm<ReviewInput>("rcsa.monitoring-review", {
  schema: reviewSchema,
  fields: (context, language, current) => {
    const de = language === "de";
    const primary = primaryIndicator(context.sources);
    return {
      rows: [
        {
          id: "frequency",
          label: de ? `Pruefhaeufigkeit ${primary?.id ?? ""}` : `Review frequency of ${primary?.id ?? "the indicator"}`,
          detail: `${primary ? `${primary.label}: ${primary.value}.` : ""}${hint(context, "frequency", language)}`,
          choice: {
            name: "frequency",
            options: [
              { value: "weekly", label: de ? "Woechentlich" : "Weekly" },
              { value: "fortnightly", label: de ? "Zweiwoechentlich" : "Fortnightly" },
              { value: "monthly", label: de ? "Monatlich" : "Monthly" },
            ],
            value: current?.frequency ?? "",
          },
          note: { name: "threshold", value: current?.threshold ?? "", placeholder: de ? "Eskalationsschwelle, zum Beispiel zwei rote Werte in Folge" : "Escalation threshold, for example two Red readings in a row" },
          date: null,
        },
        {
          id: "material-change",
          label: de ? "Wesentliche Aenderung seit der Bewertung" : "Material change since the assessment",
          detail: hint(context, "material-change", language).trim() || null,
          choice: {
            name: "material-change",
            options: [
              { value: "yes", label: de ? "Ja" : "Yes" },
              { value: "no", label: de ? "Nein" : "No" },
            ],
            value: current?.materialChange ?? "",
          },
          note: { name: "material-change-note", value: current?.materialChangeNote ?? "", placeholder: de ? "Was hat sich wesentlich geaendert" : "What changed materially" },
          date: null,
        },
        {
          id: "escalation",
          label: de ? "Eskalation" : "Escalation",
          detail: hint(context, "escalation", language).trim() || null,
          choice: {
            name: "escalation",
            options: [
              { value: "required", label: de ? "Erforderlich" : "Required" },
              { value: "not-required", label: de ? "Nicht erforderlich" : "Not required" },
            ],
            value: current?.escalation ?? "",
          },
          note: { name: "escalation-note", value: current?.escalationNote ?? "", placeholder: de ? "An wen und warum" : "To whom, and why" },
          date: null,
        },
      ],
      overall: null,
    };
  },
  fromFormData: (data) => {
    const text = (name: string) => String(data.get(name) ?? "").trim();
    return {
      frequency: text("frequency"),
      threshold: text("threshold"),
      materialChange: text("material-change"),
      materialChangeNote: text("material-change-note"),
      escalation: text("escalation"),
      escalationNote: text("escalation-note"),
    };
  },
  validate: (_context, input) => {
    const problems: Bilingual[] = [];
    if (input.materialChange === "yes" && input.materialChangeNote.length < 10) {
      problems.push({ en: "Say what changed materially.", de: "Geben Sie an, was sich wesentlich geaendert hat." });
    }
    if (input.escalation === "required" && input.escalationNote.length < 10) {
      problems.push({ en: "Say to whom the matter is escalated, and why.", de: "Geben Sie an, an wen und warum eskaliert wird." });
    }
    return problems;
  },
  defaults: (context) => {
    const primary = primaryIndicator(context.sources);
    const events = eventCandidates(context);
    return {
      frequency: primary && fact(primary, "status") === "red" ? ("weekly" as const) : ("fortnightly" as const),
      threshold: "A further Red reading.",
      materialChange: events.length > 0 ? ("yes" as const) : ("no" as const),
      materialChangeNote: events.length > 0 ? `Event on the scope: ${events.map((record) => record.id).join(", ")}.` : "",
      escalation: "not-required" as const,
      escalationNote: "",
    };
  },
  summarise: (context, input) => {
    const primary = primaryIndicator(context.sources);
    const frequency: Record<string, Bilingual> = {
      weekly: { en: "weekly", de: "woechentlich" },
      fortnightly: { en: "fortnightly", de: "zweiwoechentlich" },
      monthly: { en: "monthly", de: "monatlich" },
    };
    const label = frequency[input.frequency] ?? { en: input.frequency, de: input.frequency };
    return [
      { en: `${primary?.id ?? "Indicator"} reviewed ${label.en}; escalation threshold: ${input.threshold}`, de: `${primary?.id ?? "Indikator"} ${label.de} geprueft; Eskalationsschwelle: ${input.threshold}` },
      input.materialChange === "yes"
        ? { en: `Material change: ${input.materialChangeNote}`, de: `Wesentliche Aenderung: ${input.materialChangeNote}` }
        : { en: "No material change since the assessment.", de: "Keine wesentliche Aenderung seit der Bewertung." },
      input.escalation === "required"
        ? { en: `Escalation required: ${input.escalationNote}`, de: `Eskalation erforderlich: ${input.escalationNote}` }
        : { en: "No escalation required.", de: "Keine Eskalation erforderlich." },
    ];
  },
});

/* ==========================================================================
   Decision rules: the decision follows the review
   ========================================================================== */

function recordedReview(context: StageContext): ReviewInput | null {
  return (recordedTaskOutput(context, "monitoring-review")?.input ?? null) as ReviewInput | null;
}

registerDecisionRules(RCSA_PROCESS_ID, STAGE_ID, {
  validateOption: (context, _decisionKey, optionId) => {
    const review = recordedReview(context);
    if (!review) return { en: "Record the monitoring review before deciding.", de: "Erfassen Sie die Ueberwachungspruefung, bevor Sie entscheiden." };
    if (optionId === "monitoring-escalate") return null;
    if (review.escalation === "required") {
      return {
        en: "You recorded that escalation is required, so the cycle cannot close yet. Escalate first, then revise.",
        de: "Sie haben eine erforderliche Eskalation erfasst; der Zyklus kann noch nicht abgeschlossen werden. Erst eskalieren, dann ueberarbeiten.",
      };
    }
    if (optionId === "monitoring-standard" && review.materialChange === "yes") {
      return {
        en: "You recorded a material change, and monitoring alone does not address it. Open an off-cycle reassessment or escalate.",
        de: "Sie haben eine wesentliche Aenderung erfasst; Ueberwachung allein reicht dafuer nicht. Eroeffnen Sie eine ausserplanmaessige Neubewertung oder eskalieren Sie.",
      };
    }
    if (optionId === "monitoring-off-cycle" && review.materialChange !== "yes") {
      return {
        en: "An off-cycle reassessment needs a material change. Record one in the review, or confirm the monitoring plan.",
        de: "Eine ausserplanmaessige Neubewertung braucht eine wesentliche Aenderung. Erfassen Sie sie in der Pruefung oder bestaetigen Sie den Ueberwachungsplan.",
      };
    }
    return null;
  },
  consequences: (context, _decisionKey, optionId) => {
    const review = recordedReview(context);
    const primary = primaryIndicator(context.sources);
    const monitoring: Bilingual = {
      en: `Activates enhanced monitoring of ${primary?.id ?? "the indicator"}${review ? `, ${review.frequency}` : ""}`,
      de: `Aktiviert die verstaerkte Ueberwachung von ${primary?.id ?? "dem Indikator"}${review ? `, ${review.frequency}` : ""}`,
    };
    switch (optionId) {
      case "monitoring-standard":
        return [monitoring, { en: "Closes the cycle", de: "Schliesst den Zyklus ab" }];
      case "monitoring-off-cycle":
        return [
          monitoring,
          { en: "Creates an off-cycle reassessment of the process", de: "Legt eine ausserplanmaessige Neubewertung des Prozesses an" },
          { en: "Starts a new run of the RCSA Cycle Assistant at Stage 1 when this stage completes", de: "Startet mit dem Abschluss dieser Stufe einen neuen Durchlauf des RCSA-Zyklus-Assistenten in Stufe 1" },
        ];
      default:
        return [{ en: "The stage is held until the escalation is answered", de: "Die Stufe bleibt angehalten, bis die Eskalation beantwortet ist" }];
    }
  },
});

/* ==========================================================================
   The governed changes
   ========================================================================== */

function decided(context: StageContext, options: string[]): { review: ReviewInput; decisionRecordId: string | null } | { unavailable: Bilingual } {
  const review = recordedReview(context);
  const decision = decisionOf(context, "monitoring-plan");
  if (!review || decision?.status !== "recorded" || !options.includes(decision.chosenOptionId ?? "")) {
    return {
      unavailable: {
        en: "Record the monitoring review and the monitoring decision first.",
        de: "Erfassen Sie zuerst die Ueberwachungspruefung und die Ueberwachungsentscheidung.",
      },
    };
  }
  return { review, decisionRecordId: decision.recordId };
}

registerPayloadBuilder("rcsa.indicator-monitoring", (context) => {
  const ready = decided(context, ["monitoring-standard", "monitoring-off-cycle"]);
  if ("unavailable" in ready) return ready;
  const primary = primaryIndicator(context.sources);
  if (!primary) return { unavailable: { en: "No indicator is loaded to monitor.", de: "Kein Indikator ist zur Ueberwachung geladen." } };
  const others = recordsOf(context.sources, "kri-readings").filter((record) => record.id !== primary.id && fact(record, "status") === "red").map((record) => record.id);
  const nextReviewOn = addDays(context.state.scenarioDate, FREQUENCY_DAYS[ready.review.frequency] ?? 7);
  return {
    payload: {
      subjectKind: "kri",
      subjectId: primary.id,
      kind: "enhanced-kri-monitoring",
      description: `Enhanced monitoring of ${primary.id}, ${ready.review.frequency}${others.length > 0 ? `, together with ${others.join(", ")}` : ""}. Escalation threshold: ${ready.review.threshold} Set in Stage 8 of ${context.run.id}.`,
      reviewFrequency: ready.review.frequency,
      nextReviewOn,
      decisionId: ready.decisionRecordId,
    },
    intentStatement: {
      en: `Activate enhanced monitoring of ${primary.id}, ${ready.review.frequency}, first review on ${formatDate(nextReviewOn)}.`,
      de: `Verstaerkte Ueberwachung von ${primary.id} aktivieren, ${ready.review.frequency}, erste Pruefung am ${formatDate(nextReviewOn)}.`,
    },
    sourceCanonicalType: "Indicator",
    sourceCanonicalId: primary.id,
    decisionId: ready.decisionRecordId,
  };
});

registerPayloadBuilder("rcsa.open-reassessment", (context) => {
  const ready = decided(context, ["monitoring-off-cycle"]);
  if ("unavailable" in ready) return ready;
  const scope = scopeOf(context);
  return {
    payload: {
      subjectId: scope.processId,
      subjectKind: "process",
      entityId: scope.entityId,
      scope: `Event-driven reassessment of ${scope.processId} for ${scope.entityId}: ${ready.review.materialChangeNote} Reassesses ${scope.assessmentId}.`,
      decisionId: ready.decisionRecordId,
    },
    intentStatement: {
      en: `Create an off-cycle reassessment of ${scope.processId} for ${scope.entityId}, reassessing ${scope.assessmentId}.`,
      de: `Eine ausserplanmaessige Neubewertung von ${scope.processId} fuer ${scope.entityId} anlegen, als Neubewertung von ${scope.assessmentId}.`,
    },
    sourceCanonicalType: "Assessment",
    sourceCanonicalId: scope.assessmentId,
    decisionId: ready.decisionRecordId,
  };
});

/* ==========================================================================
   The reassessment run
   ========================================================================== */

/** The off-cycle assessment the tool created, from its recorded output. */
function reassessmentOf(context: StageContext): { assessmentId: string; processRunId: string } | null {
  const output = parseTaskOutput<ToolTaskOutput>(findTask(context.tasks, taskKey.tool("open-reassessment")));
  const data = (output?.resultData ?? null) as { assessmentId?: string } | null;
  if (output?.outcome !== "executed" || typeof data?.assessmentId !== "string") return null;
  return { assessmentId: data.assessmentId, processRunId: `RUN-${data.assessmentId}` };
}

registerCompletionHook(RCSA_PROCESS_ID, STAGE_ID, ({ context, at }) => {
  const decision = decisionOf(context, "monitoring-plan");
  const reassessment = reassessmentOf(context);
  if (decision?.chosenOptionId !== "monitoring-off-cycle" || !reassessment) return null;
  const review = recordedReview(context);
  const started = startProcessRun({
    runId: context.runId,
    processRunId: reassessment.processRunId,
    roleAppId: context.app.id,
    subjectKind: "assessment",
    subjectId: reassessment.assessmentId,
    trigger: {
      kind: "event-driven",
      summary: {
        en: `Started from Stage 8 of ${context.run.id}: ${review?.materialChangeNote ?? "a material change was recorded"}`,
        de: `Gestartet aus Stufe 8 von ${context.run.id}: ${review?.materialChangeNote ?? "eine wesentliche Aenderung wurde erfasst"}`,
      },
      sourceProcessRunId: context.run.id,
      sourceStageRunId: context.stageRun?.id ?? null,
    },
    actingUserId: context.actingUserId,
    atMoment: context.state.currentMoment,
    at,
  });
  return {
    summary: {
      en: `The event-driven reassessment ${started.run.id} is open at Stage 1 Scope and Trigger.`,
      de: `Die ereignisgesteuerte Neubewertung ${started.run.id} ist in Stufe 1 Umfang und Ausloesungsgrund geoeffnet.`,
    },
    receipt: [`Event-driven reassessment ${started.run.id} started on ${reassessment.assessmentId}`],
    payload: { processRunId: started.run.id, assessmentId: reassessment.assessmentId, created: started.created },
  };
});

/* ==========================================================================
   The monitoring plan, written at completion
   ========================================================================== */

registerArtifactBuilder("rcsa.monitoring-plan", (context) => {
  const recorded = recordedTaskOutput(context, "monitoring-review");
  const review = (recorded?.input ?? null) as ReviewInput | null;
  const decision = decisionOf(context, "monitoring-plan");
  const option = decision?.options.find((candidate) => candidate.id === decision.chosenOptionId);
  const monitoring = parseTaskOutput<ToolTaskOutput>(findTask(context.tasks, taskKey.tool("activate-indicator-monitoring")));
  const monitoringId = ((monitoring?.resultData ?? null) as { monitoringId?: string } | null)?.monitoringId ?? null;
  const reassessment = decision?.chosenOptionId === "monitoring-off-cycle" ? reassessmentOf(context) : null;
  const primary = primaryIndicator(context.sources);
  return {
    label: { en: "Monitoring plan", de: "Ueberwachungsplan" },
    content: {
      assessmentId: context.run.subjectId,
      recordLines: [
        ...(recorded?.summary ?? []),
        option ? { en: `Decision: ${option.label.en}.`, de: `Entscheidung: ${option.label.de}.` } : { en: "No monitoring decision recorded.", de: "Keine Ueberwachungsentscheidung erfasst." },
        ...(monitoringId ? [{ en: `Monitoring ${monitoringId} active on ${primary?.id ?? "the indicator"}.`, de: `Ueberwachung ${monitoringId} aktiv fuer ${primary?.id ?? "den Indikator"}.` }] : []),
        ...(reassessment
          ? [{ en: `Off-cycle reassessment ${reassessment.assessmentId}; its run ${reassessment.processRunId} opens at Stage 1.`, de: `Ausserplanmaessige Neubewertung ${reassessment.assessmentId}; ihr Durchlauf ${reassessment.processRunId} beginnt in Stufe 1.` }]
          : []),
      ],
      review,
      monitoringDecision: decision ? { optionId: decision.chosenOptionId, rationale: decision.rationale, decidedBy: decision.decidedByUserId } : null,
      monitoring: monitoringId ? { monitoringId, indicatorId: primary?.id ?? null } : null,
      reassessment,
      facts: {
        indicatorId: primary?.id ?? null,
        frequency: review?.frequency ?? null,
        materialChange: review?.materialChange ?? null,
        reassessmentAssessmentId: reassessment?.assessmentId ?? null,
        reassessmentRunId: reassessment?.processRunId ?? null,
      },
      preparation: { artifactId: context.preparation.artifactId, mode: context.preparation.mode, source: context.preparation.source },
    },
  };
});

export const RCSA_MONITORING_REASSESSMENT = { processId: RCSA_PROCESS_ID, stageId: STAGE_ID } as const;
