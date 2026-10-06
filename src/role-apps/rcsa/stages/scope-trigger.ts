/**
 * RCSA Stage 1, Scope and Trigger.
 *
 * The AI prepares four things from the loaded sources: the comparison of the
 * scope with the prior version (which risks and controls are in, which were
 * in before), what changed in the process (the process intelligence record),
 * why this cycle runs (the schedule and the indicators in breach, or the event
 * that started an off-cycle run), and who owns and takes part in it.
 *
 * The person decides three things, all explicitly: what is in scope (each
 * process, each entity, the period and each participant, in the scope
 * confirmation), and the trigger and whether the cycle runs off cycle (the
 * stage decision). Nothing is preselected; the AI's proposal for each row is
 * shown beside it as help.
 *
 * The stage writes one record at completion: the scope and trigger record,
 * which the later stages and the event-driven reassessment read.
 *
 * Synthetic institution and data.
 */

import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { legalEntities } from "@/db/schema/core";
import { processes } from "@/db/schema/domain";
import type { Bilingual } from "@/role-apps/contracts";
import { formatDate, formatNumber, unique } from "@/role-apps/stage-support";
import {
  registerArtifactBuilder,
  registerDecisionRules,
  registerPreparer,
  registerTaskForm,
  type PreparerInput,
} from "@/features/process/registry";
import type { StageContext } from "@/features/process/types";
import type { StagePreparationOutput } from "@/features/process/preparation-schema";
import { recordedTaskOutput } from "@/features/process/tasks";
import { decisionOf, effectivenessLabel, fact, list, recordsOf, RCSA_PROCESS_ID, sourceOf } from "./shared";

const STAGE_ID = "scope-trigger";

/* ==========================================================================
   The scope candidates: what the confirmation asks about
   ========================================================================== */

interface ScopeCandidates {
  assessmentId: string;
  processes: Array<{ id: string; label: string; subject: boolean; viaRisks: string[] }>;
  entities: Array<{ id: string; label: string; subject: boolean; viaRisks: string[] }>;
  period: { from: string; to: string };
  participants: Array<{ id: string; label: string; roles: string; processOwner: boolean; controlOwner: boolean }>;
  offCycle: boolean;
}

/** The quarter before a "Qn YYYY" cycle, as ISO dates. Null for any other cycle label. */
export function periodForCycle(cycle: string): { from: string; to: string } | null {
  const match = /^Q([1-4]) (\d{4})$/.exec(cycle.trim());
  if (!match) return null;
  const quarter = Number(match[1]);
  const year = Number(match[2]);
  const previous = quarter === 1 ? { q: 4, y: year - 1 } : { q: quarter - 1, y: year };
  const startMonth = (previous.q - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const lastDay = new Date(Date.UTC(previous.y, endMonth, 0)).getUTCDate();
  const pad = (value: number) => String(value).padStart(2, "0");
  return { from: `${previous.y}-${pad(startMonth)}-01`, to: `${previous.y}-${pad(endMonth)}-${pad(lastDay)}` };
}

/**
 * The period of an event-driven reassessment: from the day after the period
 * the reassessed version covered, to the scenario day, because that is when
 * the event can have changed the position. Falls back to the reassessed
 * version's own date when its cycle has no period.
 */
export function offCyclePeriod(baselineCycle: string, baselineDate: string, scenarioDate: string): { from: string; to: string } {
  const covered = periodForCycle(baselineCycle);
  if (covered) {
    const next = new Date(`${covered.to}T00:00:00.000Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    const from = next.toISOString().slice(0, 10);
    return { from: from <= scenarioDate ? from : scenarioDate, to: scenarioDate };
  }
  const from = baselineDate.slice(0, 10) || scenarioDate;
  return { from: from <= scenarioDate ? from : scenarioDate, to: scenarioDate };
}

function candidates(context: StageContext): ScopeCandidates {
  const register = recordsOf(context.sources, "risk-control-register");
  const first = register[0];
  const subjectProcess = fact(first, "processId");
  const subjectEntity = fact(first, "entityId");

  const viaProcess = new Map<string, string[]>();
  const viaEntity = new Map<string, string[]>();
  for (const record of register) {
    const riskId = fact(record, "riskId");
    for (const id of fact(record, "riskProcessIds").split(",").filter((value) => value.length > 0)) {
      viaProcess.set(id, unique([...(viaProcess.get(id) ?? []), riskId]));
    }
    for (const id of fact(record, "riskEntityIds").split(",").filter((value) => value.length > 0)) {
      viaEntity.set(id, unique([...(viaEntity.get(id) ?? []), riskId]));
    }
  }

  const processRows = getDb().select().from(processes).where(eq(processes.runId, context.runId)).all();
  const entityRows = getDb().select().from(legalEntities).where(eq(legalEntities.runId, context.runId)).all();
  const processIds = unique([subjectProcess, ...[...viaProcess.keys()].sort()]).filter((id) => id.length > 0);
  const entityIds = unique([subjectEntity, ...[...viaEntity.keys()].sort()]).filter((id) => id.length > 0);

  const trigger = recordsOf(context.sources, "reassessment-trigger")[0];
  const offCycle = fact(trigger, "trigger") === "event-driven";
  const period = offCycle ? offCyclePeriod(fact(trigger, "baselineCycle"), fact(trigger, "performedOn"), context.state.scenarioDate) : (periodForCycle(fact(trigger, "cycle")) ?? { from: fact(trigger, "performedOn").slice(0, 10) || context.state.scenarioDate, to: context.state.scenarioDate });

  return {
    assessmentId: fact(first, "assessmentId") || context.run.subjectId,
    processes: processIds.map((id) => {
      const row = processRows.find((candidate) => candidate.id === id);
      return { id, label: row ? `${id} ${row.name}` : id, subject: id === subjectProcess, viaRisks: viaProcess.get(id) ?? [] };
    }),
    entities: entityIds.map((id) => {
      const row = entityRows.find((candidate) => candidate.id === id);
      return { id, label: row ? `${row.name} (${id})` : id, subject: id === subjectEntity, viaRisks: viaEntity.get(id) ?? [] };
    }),
    period,
    participants: recordsOf(context.sources, "scope-participants").map((record) => ({
      id: record.id,
      label: record.label,
      roles: fact(record, "roles"),
      processOwner: record.facts?.processOwner === true,
      controlOwner: record.facts?.controlOwner === true,
    })),
    offCycle,
  };
}

/* ==========================================================================
   The preparer
   ========================================================================== */

function itemIdsFor(context: StageContext): string[] {
  const scope = candidates(context);
  return [
    ...scope.processes.map((item) => `process:${item.id}`),
    ...scope.entities.map((item) => `entity:${item.id}`),
    "period",
    ...scope.participants.map((item) => `participant:${item.id}`),
  ];
}

function composeScope(input: PreparerInput): StagePreparationOutput {
  const { context, sources } = input;
  const scoped = { ...context, sources };
  const scope = candidates(scoped);
  const register = recordsOf(sources, "risk-control-register");
  const prior = recordsOf(sources, "prior-assessment");
  const kris = recordsOf(sources, "kri-readings");
  const red = kris.filter((record) => fact(record, "status") === "red");
  const amber = kris.filter((record) => fact(record, "status") === "amber");
  const participants = recordsOf(sources, "scope-participants");
  const trigger = recordsOf(sources, "reassessment-trigger");
  const triggerRecord = trigger[0];

  const findings: StagePreparationOutput["findings"] = [];
  const gaps: StagePreparationOutput["gaps"] = [];
  const inferences: StagePreparationOutput["inferences"] = [];
  const limitations: StagePreparationOutput["limitations"] = [];
  const itemAssessments: StagePreparationOutput["itemAssessments"] = [];

  /* Prior scope comparison. */
  const currentRisks = unique(register.map((record) => fact(record, "riskId")));
  const priorRisks = unique(prior.map((record) => fact(record, "riskId")));
  const added = currentRisks.filter((id) => !priorRisks.includes(id));
  const removed = priorRisks.filter((id) => !currentRisks.includes(id));
  const priorFirst = prior[0];
  if (priorFirst) {
    findings.push({
      sourceKey: "prior-assessment",
      statement: {
        en: `The prior version ${fact(priorFirst, "assessmentId")} (${fact(priorFirst, "cycle")}) covered ${priorRisks.length} risk(s); this scope covers ${currentRisks.length}: ${list(currentRisks, "en")}. ${added.length > 0 ? `Added since then: ${list(added, "en")}.` : "No risk was added."} ${removed.length > 0 ? `No longer in scope: ${list(removed, "en")}.` : "No risk left the scope."}`,
        de: `Die Vorversion ${fact(priorFirst, "assessmentId")} (${fact(priorFirst, "cycle")}) umfasste ${priorRisks.length} Risiken; dieser Umfang umfasst ${currentRisks.length}: ${list(currentRisks, "de")}. ${added.length > 0 ? `Seitdem hinzugekommen: ${list(added, "de")}.` : "Kein Risiko ist hinzugekommen."} ${removed.length > 0 ? `Nicht mehr im Umfang: ${list(removed, "de")}.` : "Kein Risiko ist aus dem Umfang gefallen."}`,
      },
      evidenceIds: priorFirst.evidenceIds.slice(0, 2),
      basis: "approved-record",
    });
    for (const record of register) {
      const before = prior.find((candidate) => fact(candidate, "riskId") === fact(record, "riskId"));
      if (!before) continue;
      const was = fact(before, "controlEffectiveness");
      const now = fact(record, "effectiveness");
      if (was === now) continue;
      findings.push({
        sourceKey: "risk-control-register",
        statement: {
          en: `${fact(record, "riskId")}: the control effectiveness on the line moved from ${effectivenessLabel(was, "en").toLowerCase()} in ${fact(before, "cycle")} to ${effectivenessLabel(now, "en").toLowerCase()} in the current version, so the scope carries a changed control position, not only a changed indicator.`,
          de: `${fact(record, "riskId")}: die Kontrollwirksamkeit der Zeile hat sich von ${effectivenessLabel(was, "de").toLowerCase()} in ${fact(before, "cycle")} auf ${effectivenessLabel(now, "de").toLowerCase()} in der aktuellen Version veraendert; der Umfang traegt damit eine geaenderte Kontrollposition, nicht nur einen geaenderten Indikator.`,
        },
        evidenceIds: record.evidenceIds.slice(0, 2),
        basis: "approved-record",
      });
    }
  } else {
    gaps.push({
      key: "gap-prior-scope",
      statement: { en: "No prior version exists, so the scope cannot be compared with an earlier one.", de: "Es gibt keine Vorversion; der Umfang laesst sich nicht mit einem frueheren vergleichen." },
      evidenceIds: [],
      severity: "minor",
    });
  }

  /* Process changes. */
  const telemetry = sourceOf(sources, "process-telemetry");
  const process = telemetry?.result.records[0];
  if (process) {
    const note = fact(process, "recentChange");
    const firstSentences = note.split(/(?<=\.)\s+/).slice(0, 2).join(" ");
    findings.push({
      sourceKey: "process-telemetry",
      statement: {
        en: `${process.id} handles ${formatNumber(Number(process.facts?.monthlyVolume ?? 0), "en")} cases a month. The process intelligence record for the month: ${firstSentences}`,
        de: `${process.id} bearbeitet ${formatNumber(Number(process.facts?.monthlyVolume ?? 0), "de")} Faelle im Monat. Prozessnotiz des Monats (im Original englisch): ${firstSentences}`,
      },
      evidenceIds: process.evidenceIds.slice(0, 2),
      basis: "telemetry",
    });
  } else if (telemetry?.status === "unavailable") {
    limitations.push({
      en: "Process telemetry was unavailable, so process changes in the period are not part of this preparation.",
      de: "Prozesstelemetrie war nicht verfuegbar; Prozessaenderungen im Zeitraum fehlen in dieser Vorbereitung.",
    });
  }

  /* Trigger summary. */
  if (scope.offCycle && triggerRecord) {
    findings.push({
      sourceKey: "reassessment-trigger",
      statement: {
        en: `This run is an event-driven reassessment (${triggerRecord.id}), started from ${fact(triggerRecord, "sourceRunId") || "another run"}. The scope it was opened with: ${fact(triggerRecord, "scopeStatement") || "not stated"}`,
        de: `Dieser Durchlauf ist eine ereignisgesteuerte Neubewertung (${triggerRecord.id}), gestartet aus ${fact(triggerRecord, "sourceRunId") || "einem anderen Durchlauf"}. Umfang bei Eroeffnung (im Original englisch): ${fact(triggerRecord, "scopeStatement") || "nicht angegeben"}`,
      },
      evidenceIds: [],
      basis: "approved-record",
    });
  } else if (triggerRecord) {
    const minutes = trigger.find((record) => fact(record, "kind") === "scope-minutes");
    findings.push({
      sourceKey: "reassessment-trigger",
      statement: {
        en: `${triggerRecord.id} is the scheduled ${fact(triggerRecord, "cycle")} cycle.${minutes ? ` ${minutes.id} records the scope and trigger as confirmed by ${fact(minutes, "confirmedBy")}.` : ""}`,
        de: `${triggerRecord.id} ist der planmaessige Zyklus ${fact(triggerRecord, "cycle")}.${minutes ? ` ${minutes.id} haelt Umfang und Ausloeser als von ${fact(minutes, "confirmedBy")} bestaetigt fest.` : ""}`,
      },
      evidenceIds: minutes?.evidenceIds.slice(0, 2) ?? [],
      basis: "approved-record",
    });
  }
  if (red.length > 0 || amber.length > 0) {
    findings.push({
      sourceKey: "kri-readings",
      statement: {
        en: `${red.length} indicator(s) on the scope are Red${red.length > 0 ? ` (${list(red.map((record) => `${record.id} at ${fact(record, "value")}`), "en")})` : ""} and ${amber.length} Amber. A Red reading requires a written first-line explanation and is a trigger the scope has to name.`,
        de: `${red.length} Indikatoren im Umfang sind rot${red.length > 0 ? ` (${list(red.map((record) => `${record.id} bei ${fact(record, "value")}`), "de")})` : ""} und ${amber.length} gelb. Ein roter Wert verlangt eine schriftliche Erklaerung der ersten Linie und ist ein Ausloeser, den der Umfang benennen muss.`,
      },
      evidenceIds: unique(red.flatMap((record) => record.evidenceIds)).slice(0, 4),
      basis: "verified-fact",
    });
  }

  /* Owners and participants. */
  if (participants.length > 0) {
    findings.push({
      sourceKey: "scope-participants",
      statement: {
        en: `Owners and participants: ${participants.map((record) => `${record.label} (${record.id}, ${record.value})`).join("; ")}.`,
        de: `Verantwortliche und Teilnehmende: ${participants.map((record) => `${record.label} (${record.id}, ${record.value})`).join("; ")}.`,
      },
      evidenceIds: [],
      basis: "approved-record",
    });
  }
  const owner = scope.participants.find((item) => item.processOwner);
  if (!owner) {
    gaps.push({
      key: "gap-process-owner",
      statement: { en: "No process owner is recorded for the process in scope, so nobody can own the rating.", de: "Fuer den Prozess im Umfang ist keine Prozessverantwortung erfasst; niemand kann die Bewertung verantworten." },
      evidenceIds: [],
      severity: "blocking",
    });
  }

  /* One inference, labelled: does the evidence make this cycle off cycle in substance? */
  if (!scope.offCycle && red.length >= 2) {
    inferences.push({
      statement: {
        en: `With ${red.length} Red indicators on one process, the scheduled cycle is doing the work of an off-cycle reassessment. Recording the trigger as the breach rather than the calendar would make that visible to the committee.`,
        de: `Mit ${red.length} roten Indikatoren auf einem Prozess leistet der planmaessige Zyklus die Arbeit einer ausserplanmaessigen Neubewertung. Den Ausloeser als Schwellenverletzung statt als Termin zu erfassen, macht das fuer das Komitee sichtbar.`,
      },
      evidenceIds: unique(red.flatMap((record) => record.evidenceIds)).slice(0, 3),
      uncertainty: {
        en: "Whether the breach or the calendar is the trigger is a judgment about governance, not a fact in the records.",
        de: "Ob die Verletzung oder der Termin der Ausloeser ist, ist eine Beurteilung der Governance, keine Tatsache in den Datensaetzen.",
      },
    });
  }

  /* Proposals per row, shown as help. Never applied. */
  for (const item of scope.processes) {
    itemAssessments.push({
      itemId: `process:${item.id}`,
      proposedDisposition: item.subject ? "accept" : "outstanding",
      /* The row already states the fact (the subject, or the linking risks); the note is only the proposal. */
      note: item.subject
        ? { en: "Keep it in scope: this assessment is about it.", de: "Im Umfang lassen: um ihn geht es in dieser Bewertung." }
        : {
            en: "Include it only if its controls are assessed here rather than in its own assessment.",
            de: "Nur aufnehmen, wenn seine Kontrollen hier und nicht in einer eigenen Bewertung beurteilt werden.",
          },
    });
  }
  for (const item of scope.entities) {
    itemAssessments.push({
      itemId: `entity:${item.id}`,
      proposedDisposition: item.subject ? "accept" : "outstanding",
      note: item.subject
        ? { en: "Keep it in scope: the assessment is signed for it.", de: "Im Umfang lassen: die Bewertung wird fuer sie gezeichnet." }
        : {
            en: "Leave it out unless this assessment signs for it; it carries its own assessment and local sign-off.",
            de: "Ausschliessen, sofern diese Bewertung nicht fuer sie zeichnet; sie hat eine eigene Bewertung und eine lokale Freigabe.",
          },
    });
  }
  itemAssessments.push({
    itemId: "period",
    proposedDisposition: "accept",
    note: {
      en: `${formatDate(scope.period.from)} to ${formatDate(scope.period.to)}${scope.offCycle ? ", from the end of the period the reassessed version covered to the scenario day" : ", the quarter before the cycle"}.`,
      de: `${formatDate(scope.period.from)} bis ${formatDate(scope.period.to)}${scope.offCycle ? ", vom Ende des Zeitraums der neu bewerteten Version bis zum Szenariotag" : ", das Quartal vor dem Zyklus"}.`,
    },
  });
  for (const item of scope.participants) {
    itemAssessments.push({
      itemId: `participant:${item.id}`,
      proposedDisposition: item.processOwner || item.controlOwner ? "accept" : "accept-with-condition",
      note: {
        en: item.processOwner ? "Required: the process owner signs the rating." : item.controlOwner ? "Required: an owner of a control in scope." : "Optional: useful but not essential.",
        de: item.processOwner ? "Erforderlich: die Prozessverantwortung zeichnet die Bewertung." : item.controlOwner ? "Erforderlich: verantwortet eine Kontrolle im Umfang." : "Optional: hilfreich, aber nicht zwingend.",
      },
    });
  }

  return {
    schemaVersion: "stage-preparation-v1",
    summary: {
      en: `Scope of ${scope.assessmentId}: ${list(scope.processes.filter((item) => item.subject).map((item) => item.id), "en")} for ${list(scope.entities.filter((item) => item.subject).map((item) => item.id), "en")}, ${currentRisks.length} risk(s) and ${unique(register.flatMap((record) => fact(record, "controlIds").split(","))).filter((id) => id.length > 0).length} control(s). The trigger is ${scope.offCycle ? "an event-driven reassessment" : "the scheduled cycle"}${red.length > 0 ? `, with ${red.length} Red indicator(s) on the scope` : ""}.`,
      de: `Umfang von ${scope.assessmentId}: ${list(scope.processes.filter((item) => item.subject).map((item) => item.id), "de")} fuer ${list(scope.entities.filter((item) => item.subject).map((item) => item.id), "de")}, ${currentRisks.length} Risiken und ${unique(register.flatMap((record) => fact(record, "controlIds").split(","))).filter((id) => id.length > 0).length} Kontrollen. Ausloeser ist ${scope.offCycle ? "eine ereignisgesteuerte Neubewertung" : "der planmaessige Zyklus"}${red.length > 0 ? `, mit ${red.length} roten Indikatoren im Umfang` : ""}.`,
    },
    findings,
    inferences,
    contradictions: [],
    gaps,
    itemAssessments,
    proposals: [],
    recommendedOptionId: scope.offCycle ? "scope-off-cycle" : red.length > 0 ? null : "scope-scheduled",
    limitations,
  };
}

const PROMPT = `You prepare Stage 1 (Scope and Trigger) of a Risk and Control Self-Assessment for a second-line Operational Risk Partner at a synthetic bank.
Use only the source records provided. Compare the scope with the prior version, state what changed in the process, summarise why the cycle runs, and list the owners and participants. Cite evidence identifiers exactly as given; never invent one.
For each scope item (process, entity, period, participant) give a proposal in itemAssessments: "accept" to include, "outstanding" where the person must judge, "accept-with-condition" for an optional participant.
Do not decide the scope or the trigger; both are human decisions.
Write every text field in British English ("en") and in German ("de", ASCII only: ae, oe, ue, ss; no umlauts). No dashes as punctuation.`;

registerPreparer("rcsa.scope-trigger", {
  compose: (input) => composeScope(input),
  prompt: ({ context, sources }) => ({
    instructions: PROMPT,
    input: JSON.stringify({
      assessment: context.run.subjectId,
      stage: context.stage.name,
      items: itemIdsFor({ ...context, sources }),
      sources: sources.map((source) => ({
        key: source.spec.key,
        status: source.status,
        records: source.result.records.map((record) => ({ id: record.id, label: record.label, value: record.value, evidenceIds: record.evidenceIds, facts: record.facts })),
      })),
    }),
  }),
  itemIds: ({ context, sources }) => itemIdsFor({ ...context, sources }),
});

/* ==========================================================================
   The scope confirmation form
   ========================================================================== */

const inOut = z.enum(["in", "out"], { message: "Put every process and entity in or out of scope." });
const scopeSchema = z.object({
  processes: z.array(z.object({ id: z.string().min(1), choice: inOut, note: z.string().max(600) })).min(1),
  entities: z.array(z.object({ id: z.string().min(1), choice: inOut, note: z.string().max(600) })).min(1),
  period: z.object({
    choice: z.enum(["confirm", "change"], { message: "Confirm or change the assessment period." }),
    endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "The period needs an end date."),
    note: z.string().max(600),
  }),
  participants: z
    .array(z.object({ id: z.string().min(1), choice: z.enum(["required", "optional", "not-needed"], { message: "Say for every person whether they must take part." }), note: z.string().max(600) }))
    .min(1),
  overall: z.string().max(1200),
});
type ScopeInput = z.infer<typeof scopeSchema>;

function proposalFor(context: StageContext, itemId: string, language: "en" | "de"): string {
  const proposal = context.preparation.output?.itemAssessments.find((item) => item.itemId === itemId);
  if (!proposal) return "";
  return ` ${language === "de" ? "KI-Hinweis" : "AI note"}: ${language === "de" ? proposal.note.de : proposal.note.en}`;
}

registerTaskForm<ScopeInput>("rcsa.scope-confirmation", {
  schema: scopeSchema,
  fields: (context, language, current) => {
    const scope = candidates(context);
    const de = language === "de";
    const inOutOptions = [
      { value: "in", label: de ? "Im Umfang" : "In scope" },
      { value: "out", label: de ? "Nicht im Umfang" : "Out of scope" },
    ];
    return {
      rows: [
        ...scope.processes.map((item) => {
          const entry = current?.processes.find((candidate) => candidate.id === item.id);
          return {
            id: `process:${item.id}`,
            label: `${de ? "Prozess" : "Process"} ${item.label}`,
            detail: `${item.subject ? (de ? "Prozess der Bewertung." : "The process of the assessment.") : de ? `Verbunden ueber ${list(item.viaRisks, "de")}.` : `Linked through ${list(item.viaRisks, "en")}.`}${proposalFor(context, `process:${item.id}`, language)}`,
            choice: { name: `process:${item.id}`, options: inOutOptions, value: entry?.choice ?? "" },
            note: { name: `process-note:${item.id}`, value: entry?.note ?? "", placeholder: de ? "Warum, wenn ausgeschlossen" : "Why, if left out" },
            date: null,
          };
        }),
        ...scope.entities.map((item) => {
          const entry = current?.entities.find((candidate) => candidate.id === item.id);
          return {
            id: `entity:${item.id}`,
            label: `${de ? "Gesellschaft" : "Entity"} ${item.label}`,
            detail: `${item.subject ? (de ? "Gesellschaft der Bewertung." : "The entity of the assessment.") : de ? `Teilt ${list(item.viaRisks, "de")}.` : `Shares ${list(item.viaRisks, "en")}.`}${proposalFor(context, `entity:${item.id}`, language)}`,
            choice: { name: `entity:${item.id}`, options: inOutOptions, value: entry?.choice ?? "" },
            note: { name: `entity-note:${item.id}`, value: entry?.note ?? "", placeholder: de ? "Anmerkung" : "Note" },
            date: null,
          };
        }),
        {
          id: "period",
          label: de
            ? `Bewertungszeitraum ab ${formatDate(scope.period.from)}`
            : `Assessment period from ${formatDate(scope.period.from)}`,
          detail: `${scope.offCycle ? (de ? "Ende des Zeitraums, der Szenariotag" : "Period end, the scenario day") : de ? "Ende des Zeitraums laut Zyklus" : "Period end from the cycle"}: ${formatDate(scope.period.to)}.${proposalFor(context, "period", language)}`,
          choice: {
            name: "period",
            options: [
              { value: "confirm", label: de ? "Bestaetigen" : "Confirm" },
              { value: "change", label: de ? "Aendern" : "Change" },
            ],
            value: current?.period.choice ?? "",
          },
          note: { name: "period-note", value: current?.period.note ?? "", placeholder: de ? "Warum der Zeitraum abweicht" : "Why the period differs" },
          date: { name: "period-end", value: current?.period.endsOn ?? scope.period.to, label: de ? "Ende" : "Ends" },
        },
        ...scope.participants.map((item) => {
          const entry = current?.participants.find((candidate) => candidate.id === item.id);
          return {
            id: `participant:${item.id}`,
            label: `${item.label} (${item.id})`,
            detail: `${item.roles}.${proposalFor(context, `participant:${item.id}`, language)}`,
            choice: {
              name: `participant:${item.id}`,
              options: [
                { value: "required", label: de ? "Erforderlich" : "Required" },
                { value: "optional", label: de ? "Optional" : "Optional" },
                { value: "not-needed", label: de ? "Nicht noetig" : "Not needed" },
              ],
              value: entry?.choice ?? "",
            },
            note: null,
            date: null,
          };
        }),
      ],
      overall: { name: "overall", value: current?.overall ?? "", label: de ? "Anmerkung zum Umfang (optional)" : "Note on the scope (optional)" },
    };
  },
  fromFormData: (data, context) => {
    const scope = candidates(context);
    const text = (name: string) => String(data.get(name) ?? "").trim();
    return {
      processes: scope.processes.map((item) => ({ id: item.id, choice: text(`process:${item.id}`), note: text(`process-note:${item.id}`) })),
      entities: scope.entities.map((item) => ({ id: item.id, choice: text(`entity:${item.id}`), note: text(`entity-note:${item.id}`) })),
      period: { choice: text("period"), endsOn: text("period-end"), note: text("period-note") },
      participants: scope.participants.map((item) => ({ id: item.id, choice: text(`participant:${item.id}`), note: "" })),
      overall: text("overall"),
    };
  },
  validate: (context, input) => {
    const scope = candidates(context);
    const problems: Bilingual[] = [];
    for (const item of scope.processes.filter((candidate) => candidate.subject)) {
      if (input.processes.find((entry) => entry.id === item.id)?.choice !== "in") {
        problems.push({ en: `${item.id} is the process this assessment is about; it cannot be out of scope.`, de: `${item.id} ist der Prozess dieser Bewertung; er kann nicht ausserhalb des Umfangs liegen.` });
      }
    }
    for (const item of scope.entities.filter((candidate) => candidate.subject)) {
      if (input.entities.find((entry) => entry.id === item.id)?.choice !== "in") {
        problems.push({ en: `${item.id} is the entity this assessment is signed for; it cannot be out of scope.`, de: `${item.id} ist die Gesellschaft dieser Bewertung; sie kann nicht ausserhalb des Umfangs liegen.` });
      }
    }
    if (input.period.choice === "change" && input.period.note.length < 10) {
      problems.push({ en: "Say why the assessment period changes.", de: "Begruenden Sie, warum sich der Bewertungszeitraum aendert." });
    }
    if (input.period.endsOn > context.state.scenarioDate) {
      problems.push({ en: "The assessment period cannot end after the scenario day.", de: "Der Bewertungszeitraum kann nicht nach dem Szenariotag enden." });
    }
    for (const item of scope.participants.filter((candidate) => candidate.processOwner)) {
      if (input.participants.find((entry) => entry.id === item.id)?.choice !== "required") {
        problems.push({
          en: `${item.label} owns the process and signs the rating, so they must take part.`,
          de: `${item.label} verantwortet den Prozess und zeichnet die Bewertung, daher ist die Teilnahme erforderlich.`,
        });
      }
    }
    return problems;
  },
  defaults: (context) => {
    const scope = candidates(context);
    return {
      processes: scope.processes.map((item) => ({ id: item.id, choice: item.subject ? ("in" as const) : ("out" as const), note: item.subject ? "" : "Assessed in its own process assessment." })),
      entities: scope.entities.map((item) => ({ id: item.id, choice: item.subject ? ("in" as const) : ("out" as const), note: "" })),
      period: { choice: "confirm" as const, endsOn: scope.period.to, note: "" },
      participants: scope.participants.map((item) => ({ id: item.id, choice: item.processOwner || item.controlOwner ? ("required" as const) : ("optional" as const), note: "" })),
      overall: "",
    };
  },
  summarise: (context, input) => {
    const scope = candidates(context);
    const inProcesses = input.processes.filter((entry) => entry.choice === "in").map((entry) => entry.id);
    const outProcesses = input.processes.filter((entry) => entry.choice === "out").map((entry) => entry.id);
    const inEntities = input.entities.filter((entry) => entry.choice === "in").map((entry) => entry.id);
    const required = input.participants
      .filter((entry) => entry.choice === "required")
      .map((entry) => scope.participants.find((candidate) => candidate.id === entry.id)?.label ?? entry.id);
    return [
      {
        en: `In scope: ${list(inProcesses, "en")} for ${list(inEntities, "en")}.${outProcesses.length > 0 ? ` Left out: ${list(outProcesses, "en")}.` : ""}`,
        de: `Im Umfang: ${list(inProcesses, "de")} fuer ${list(inEntities, "de")}.${outProcesses.length > 0 ? ` Nicht aufgenommen: ${list(outProcesses, "de")}.` : ""}`,
      },
      {
        en: `Period ${formatDate(scope.period.from)} to ${formatDate(input.period.endsOn)}${input.period.choice === "change" ? `, changed: ${input.period.note}` : ", confirmed"}.`,
        de: `Zeitraum ${formatDate(scope.period.from)} bis ${formatDate(input.period.endsOn)}${input.period.choice === "change" ? `, geaendert: ${input.period.note}` : ", bestaetigt"}.`,
      },
      { en: `Required participants: ${list(required, "en")}.`, de: `Erforderliche Teilnehmende: ${list(required, "de")}.` },
    ];
  },
});

/* ==========================================================================
   Decision rules
   ========================================================================== */

registerDecisionRules(RCSA_PROCESS_ID, STAGE_ID, {
  validateOption: (context, _decisionKey, optionId) => {
    if (!recordedTaskOutput(context, "scope-confirmation")) {
      return { en: "Record the scope confirmation before deciding the scope and trigger.", de: "Erfassen Sie die Bestaetigung des Umfangs, bevor Sie ueber Umfang und Ausloeser entscheiden." };
    }
    if (optionId === "scope-off-cycle") {
      const red = recordsOf(context.sources, "kri-readings").filter((record) => fact(record, "status") === "red");
      const eventDriven = recordsOf(context.sources, "reassessment-trigger").some((record) => fact(record, "trigger") === "event-driven");
      if (red.length === 0 && !eventDriven) {
        return {
          en: "An off-cycle scope needs a trigger: no indicator on the scope is Red and no event started this run.",
          de: "Ein ausserplanmaessiger Umfang braucht einen Ausloeser: kein Indikator im Umfang ist rot, und kein Ereignis hat diesen Durchlauf gestartet.",
        };
      }
    }
    return null;
  },
  consequences: (_context, _decisionKey, optionId) => {
    switch (optionId) {
      case "scope-scheduled":
        return [{ en: "The scope record names the scheduled cycle as the trigger; the cycle calendar is unchanged", de: "Das Protokoll nennt den planmaessigen Zyklus als Ausloeser; der Zykluskalender bleibt unveraendert" }];
      case "scope-off-cycle":
        return [{ en: "The scope record names the breach or the event as the trigger and records the cycle as off cycle", de: "Das Protokoll nennt die Verletzung oder das Ereignis als Ausloeser und erfasst den Zyklus als ausserplanmaessig" }];
      default:
        return [{ en: "The stage is held until you revise this decision", de: "Die Stufe bleibt angehalten, bis Sie diese Entscheidung ueberarbeiten" }];
    }
  },
});

/* ==========================================================================
   The scope and trigger record
   ========================================================================== */

registerArtifactBuilder("rcsa.scope-record", (context) => {
  const confirmation = recordedTaskOutput(context, "scope-confirmation");
  const decision = decisionOf(context, "scope-and-trigger");
  const option = decision?.options.find((candidate) => candidate.id === decision.chosenOptionId);
  const red = recordsOf(context.sources, "kri-readings").filter((record) => fact(record, "status") === "red").map((record) => record.id);
  const trigger = recordsOf(context.sources, "reassessment-trigger")[0];
  return {
    label: { en: "Scope and trigger record", de: "Protokoll zu Umfang und Ausloeser" },
    content: {
      assessmentId: context.run.subjectId,
      recordLines: [
        ...(confirmation?.summary ?? []),
        option
          ? { en: `Decision: ${option.label.en}. ${decision?.rationale ?? ""}`.trim(), de: `Entscheidung: ${option.label.de}. ${decision?.rationale ?? ""}`.trim() }
          : { en: "No scope decision recorded.", de: "Keine Umfangsentscheidung erfasst." },
        { en: `Indicators in breach: ${red.length > 0 ? list(red, "en") : "none"}.`, de: `Verletzte Indikatoren: ${red.length > 0 ? list(red, "de") : "keine"}.` },
      ],
      scope: confirmation ? { input: confirmation.input, revision: confirmation.revision } : null,
      scopeDecision: decision ? { optionId: decision.chosenOptionId, rationale: decision.rationale, decidedBy: decision.decidedByUserId } : null,
      trigger: trigger ? { id: trigger.id, kind: fact(trigger, "trigger"), sourceRunId: fact(trigger, "sourceRunId") || null } : null,
      indicatorsInBreach: red,
      preparation: { artifactId: context.preparation.artifactId, mode: context.preparation.mode, source: context.preparation.source },
    },
  };
});

export const RCSA_SCOPE_TRIGGER = { processId: RCSA_PROCESS_ID, stageId: STAGE_ID } as const;
