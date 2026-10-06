/**
 * RCSA Stage 5, Challenge Workshop.
 *
 * The workshop itself is a meeting, and its minutes belong to the meetings
 * module (`src/features/work/modules/meetings`): it drafts them from the
 * conversation, the person edits and confirms them there, and confirming them
 * creates their actions and files them as evidence. This stage does not
 * duplicate any of that. It reads it, through the read seam the meetings
 * module publishes for exactly this purpose (`src/db/repositories/meetings.ts`,
 * `getConfirmedMinutesForStage`, and the pure lifecycle helpers for the clock
 * and the working draft), in the "workshop record" source loader:
 *
 *   the workshop is the meeting recorded against this run and this stage;
 *   its record is available once the meeting has been held, by the scenario
 *   clock or by being recorded as held, so the AI preparation waits for the
 *   source until then rather than preparing a workshop that has not happened;
 *   the minutes are the meeting's working minutes, and the completion check
 *   `rcsa.workshop-minutes-confirmed` reads whether they are confirmed.
 *
 * The AI prepares five things from the record: the agenda as run, the evidence
 * pack, the contradictions flagged in the conversation, the actions captured
 * and the shape of the minutes. The person decides the challenge conclusion
 * (the seeded decision DEC-2026-0772), confirms the minutes in Meetings, and
 * decides in the workshop outcome what happens to each unresolved issue and
 * whether the actions the minutes raised are enough for the challenge.
 *
 * At completion the stage writes the workshop outcome record, which points at
 * the confirmed minutes by identifier, version and evidence document.
 *
 * Synthetic institution and data.
 */

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { calendarEvents, meetings } from "@/db/schema/work";
import { getConfirmedMinutesForStage, getMeetingTranscript, getMinutesForMeeting } from "@/db/repositories/meetings";
import { draftOfMinutes, heardTurns, isConfirmedMinutes, meetingClock, meetingEnd } from "@/features/work/modules/meetings/lifecycle";
import type { Bilingual } from "@/role-apps/contracts";
import { formatDate, revealedEvidence, unique } from "@/role-apps/stage-support";
import {
  registerArtifactBuilder,
  registerCompletionCheck,
  registerPreparer,
  registerSourceLoader,
  registerTaskForm,
  type PreparerInput,
} from "@/features/process/registry";
import type { SourceRecord, StageContext } from "@/features/process/types";
import type { StagePreparationOutput } from "@/features/process/preparation-schema";
import { recordedTaskOutput } from "@/features/process/tasks";
import { boundDecisionId, clip, decisionOf, fact, list, personLabel, recordsOf, sourceOf, RCSA_PROCESS_ID } from "./shared";

const STAGE_ID = "challenge-workshop";
/** The decision the contract names: the Q4 cycle's. A later run binds its own copy. */
const DECISION_ID = "DEC-2026-0772";

const MINUTES_STATUS: Record<string, Bilingual> = {
  draft: { en: "a draft", de: "Entwurf" },
  "awaiting-confirmation": { en: "awaiting confirmation", de: "wartet auf Bestaetigung" },
  confirmed: { en: "confirmed", de: "bestaetigt" },
  distributed: { en: "distributed", de: "verteilt" },
};

/** A minutes status in words, in both languages. */
function minutesStatus(status: string): Bilingual {
  return MINUTES_STATUS[status] ?? { en: status, de: status };
}

/** The sentences of a turn that request something of someone: the actions the conversation captured. */
export function capturedActions(content: string): string[] {
  return content
    .split(/(?<=\.)\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => /\b(action requested|requested (of|from))\b/i.test(sentence));
}

/* ==========================================================================
   The workshop record
   ========================================================================== */

/**
 * Reads the workshop record of a run: the meeting recorded against the run
 * and this stage, its conversation as far as it has been held, and its
 * working minutes. The meetings module owns all three; this reads them.
 */
registerSourceLoader("rcsa.workshop-record", (context) => {
  const meeting = getDb()
    .select()
    .from(meetings)
    .where(and(eq(meetings.runId, context.runId), eq(meetings.processRunId, context.run.id), eq(meetings.stageId, STAGE_ID)))
    .all()
    .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))[0];
  if (!meeting) {
    return {
      status: "unavailable",
      records: [],
      evidenceIds: [],
      asOf: null,
      note: {
        en: "No challenge workshop is recorded against this run. Schedule it in Meetings to give the stage its record.",
        de: "Fuer diesen Durchlauf ist kein Herausforderungs-Workshop erfasst. Planen Sie ihn in Sitzungen, damit die Stufe ihre Grundlage erhaelt.",
      },
    };
  }

  const turns = getMeetingTranscript(meeting.id, context.runId);
  const endsAt = getDb()
    .select()
    .from(calendarEvents)
    .where(and(eq(calendarEvents.runId, context.runId), eq(calendarEvents.meetingId, meeting.id)))
    .get()?.endsAt ?? null;
  const clock = meetingClock(meeting, context.state.scenarioDate, context.state.currentMoment, meetingEnd(meeting, endsAt, turns));
  if (clock.phase !== "after") {
    return {
      status: "unavailable",
      records: [],
      evidenceIds: [],
      asOf: null,
      note: {
        en: `${meeting.reference} is scheduled for ${formatDate(meeting.scheduledFor)} from ${clock.start} to ${clock.end}. Its record is available once it has been held.`,
        de: `${meeting.reference} ist fuer den ${formatDate(meeting.scheduledFor)} von ${clock.start} bis ${clock.end} angesetzt. Die Aufzeichnung liegt vor, sobald er stattgefunden hat.`,
      },
    };
  }

  const docs = new Map(revealedEvidence(context.runId, context.state).map((doc) => [doc.id, doc]));
  const heard = heardTurns(meeting, turns, context.state.scenarioDate, context.state.currentMoment);
  const records: SourceRecord[] = [
    {
      id: meeting.id,
      label: meeting.title,
      value: `${meeting.reference}, ${formatDate(meeting.scheduledFor)} ${clock.start} to ${clock.end}`,
      evidenceIds: meeting.evidenceDocumentIds.filter((id) => docs.get(id)?.status === "current"),
      facts: { kind: "meeting", reference: meeting.reference, status: meeting.status, heldBy: meeting.heldByUserId, turns: heard.length, subjectId: meeting.subjectId },
    },
  ];

  /* The working minutes, read as the meetings module holds them. */
  const minutes = getMinutesForMeeting(meeting.id, context.runId)[0] ?? null;
  const confirmed = getConfirmedMinutesForStage(context.run.id, STAGE_ID, context.runId).find((entry) => entry.meeting.id === meeting.id)?.minutes ?? null;
  if (minutes) {
    const draft = draftOfMinutes(minutes, context.state.language);
    const evidenceDoc = minutes.evidenceDocumentId && docs.has(minutes.evidenceDocumentId) ? minutes.evidenceDocumentId : null;
    records.push({
      id: minutes.id,
      label: minutes.title,
      value: `${minutes.status}, version ${minutes.version}`,
      evidenceIds: evidenceDoc ? [evidenceDoc] : [],
      facts: {
        kind: "minutes",
        status: minutes.status,
        confirmed: isConfirmedMinutes(minutes) && confirmed !== null,
        version: minutes.version,
        contentDigest: minutes.contentDigest,
        confirmedBy: minutes.confirmedByUserId,
        confirmedAt: minutes.confirmedAt,
        evidenceDocumentId: minutes.evidenceDocumentId,
        actions: draft.actions.length,
        unresolved: draft.unresolved.length,
        summary: clip(draft.summary, 600),
      },
    });
    for (const action of draft.actions) {
      records.push({
        id: `${minutes.id}:${action.key}`,
        label: action.title,
        value: `${action.ownerUserId ?? action.ownerLabel}, ${action.dueOn ? formatDate(action.dueOn) : "no date"}`,
        evidenceIds: action.evidenceIds.filter((id) => docs.has(id)),
        facts: { kind: "minutes-action", minutesId: minutes.id, key: action.key, existingActionId: action.existingActionId, ownerUserId: action.ownerUserId, dueOn: action.dueOn, condition: clip(action.completionCondition, 400) },
      });
    }
    for (const item of draft.unresolved) {
      records.push({
        id: `${minutes.id}:${item.key}`,
        label: clip(item.text, 300),
        value: "unresolved",
        evidenceIds: [],
        facts: { kind: "minutes-unresolved", minutesId: minutes.id, key: item.key },
      });
    }
  }

  /* The conversation, as far as it has been held. Each turn can be cited. */
  for (const turn of heard) {
    const contradicted = turn.contradictsEvidenceId && docs.has(turn.contradictsEvidenceId) ? turn.contradictsEvidenceId : null;
    records.push({
      id: turn.id,
      label: turn.speakerLabel,
      value: turn.atMoment,
      evidenceIds: unique([turn.id, ...(contradicted ? [contradicted] : [])]),
      facts: {
        kind: "turn",
        speakerKind: turn.speakerKind,
        speakerUserId: turn.speakerUserId,
        provenance: turn.provenance,
        contradicts: contradicted,
        contradictionNote: clip(turn.contradictionNote, 500),
        content: clip(turn.content, 700),
      },
    });
  }

  return {
    status: "loaded",
    records,
    evidenceIds: unique(records.flatMap((record) => record.evidenceIds)),
    asOf: meeting.heldAt ?? meeting.concludedAt ?? null,
    note: minutes
      ? null
      : {
          en: "The workshop has been held. Its minutes are drafted and confirmed in Meetings.",
          de: "Der Workshop hat stattgefunden. Das Protokoll wird in Sitzungen entworfen und bestaetigt.",
        },
  };
});

/** The minutes record of the workshop, from the loaded source. */
function minutesRecord(sources: StageContext["sources"]): SourceRecord | undefined {
  return recordsOf(sources, "workshop-record").find((record) => fact(record, "kind") === "minutes");
}

/* ==========================================================================
   The completion check: the minutes are confirmed in Meetings
   ========================================================================== */

/**
 * `rcsa.workshop-minutes-confirmed` reads the confirmation state of the
 * workshop's `meeting_minutes`, which the loader took from the meetings
 * module's `getConfirmedMinutesForStage`. It is not met while the workshop
 * has not been held, while no minutes exist, or while they are a draft.
 */
export function workshopMinutesConfirmation(context: StageContext): { met: boolean; reason: Bilingual | null } {
  const source = sourceOf(context.sources, "workshop-record");
  if (!source || source.status === "unavailable") {
    return {
      met: false,
      reason: source?.result.note ?? { en: "The workshop record is not available yet.", de: "Die Workshop-Aufzeichnung liegt noch nicht vor." },
    };
  }
  const minutes = minutesRecord(context.sources);
  if (!minutes) {
    return { met: false, reason: { en: "No minutes of the workshop exist yet. Draft and confirm them in Meetings.", de: "Es gibt noch kein Protokoll des Workshops. Entwerfen und bestaetigen Sie es in Sitzungen." } };
  }
  if (minutes.facts?.confirmed !== true) {
    return {
      met: false,
      reason: {
        en: `${minutes.id} is ${minutesStatus(fact(minutes, "status")).en}. Confirm the minutes in Meetings.`,
        de: `${minutes.id} ist im Status ${minutesStatus(fact(minutes, "status")).de}. Bestaetigen Sie das Protokoll in Sitzungen.`,
      },
    };
  }
  return { met: true, reason: null };
}

registerCompletionCheck("rcsa.workshop-minutes-confirmed", workshopMinutesConfirmation);

/* ==========================================================================
   The preparer
   ========================================================================== */

function itemIdsFor(sources: StageContext["sources"]): string[] {
  return [
    "actions",
    ...recordsOf(sources, "workshop-record")
      .filter((record) => fact(record, "kind") === "minutes-unresolved")
      .map((record) => record.id),
  ];
}

function composeWorkshop(input: PreparerInput): StagePreparationOutput {
  const { sources } = input;
  const record = recordsOf(sources, "workshop-record");
  const meeting = record.find((item) => fact(item, "kind") === "meeting");
  const turns = record.filter((item) => fact(item, "kind") === "turn");
  const findings: StagePreparationOutput["findings"] = [];
  const contradictions: StagePreparationOutput["contradictions"] = [];
  const gaps: StagePreparationOutput["gaps"] = [];
  const inferences: StagePreparationOutput["inferences"] = [];
  const limitations: StagePreparationOutput["limitations"] = [];
  const itemAssessments: StagePreparationOutput["itemAssessments"] = [];

  /* The agenda as set in Stage 4, against the conversation as held. */
  const agenda = recordsOf(sources, "cycle-record").find((item) => fact(item, "artifactKey") === "workshop-agenda");
  const order = fact(agenda, "order").split(",").filter((id) => id.length > 0);
  findings.push({
    sourceKey: "workshop-record",
    statement: {
      en: `${meeting?.label ?? "The workshop"} (${meeting?.value ?? ""}) was held with ${turns.length} recorded turn(s).${order.length > 0 ? ` The agenda set in Stage 4: ${order.map((id, index) => `${index + 1}. ${id}`).join(", ")}.` : ""}`,
      de: `${meeting?.label ?? "Der Workshop"} (${meeting?.value ?? ""}) fand mit ${turns.length} aufgezeichneten Beitraegen statt.${order.length > 0 ? ` Agenda aus Stufe 4: ${order.map((id, index) => `${index + 1}. ${id}`).join(", ")}.` : ""}`,
    },
    evidenceIds: meeting?.evidenceIds.slice(0, 3) ?? [],
    basis: "approved-record",
  });

  /* The evidence pack. */
  if (meeting && meeting.evidenceIds.length > 0) {
    findings.push({
      sourceKey: "workshop-record",
      statement: {
        en: `The evidence pack holds ${meeting.evidenceIds.length} current document(s): ${list(meeting.evidenceIds, "en")}.`,
        de: `Das Nachweispaket enthaelt ${meeting.evidenceIds.length} aktuelle Dokumente: ${list(meeting.evidenceIds, "de")}.`,
      },
      evidenceIds: meeting.evidenceIds.slice(0, 8),
      basis: "approved-record",
    });
  }

  /* Contradictions flagged in the conversation. */
  for (const turn of turns.filter((item) => fact(item, "contradicts").length > 0 && item.facts?.speakerKind === "participant").slice(0, 6)) {
    contradictions.push({
      statement: {
        en: `${turn.label} at ${turn.value}: the statement conflicts with ${fact(turn, "contradicts")}. ${fact(turn, "contradictionNote")}`,
        de: `${turn.label} um ${turn.value}: die Aussage widerspricht ${fact(turn, "contradicts")}. Begruendung im Original englisch: ${fact(turn, "contradictionNote")}`,
      },
      evidenceIds: turn.evidenceIds.slice(0, 2),
    });
  }

  /*
   * Action capture and the shape of the minutes. Both are read from the
   * conversation, not from the minutes: the minutes are drafted and confirmed
   * in Meetings after this preparation, and their state is shown live by the
   * completion criterion and the task form, so the preparation stays true
   * once they are confirmed.
   */
  const closing = [...turns].reverse().find((item) => item.facts?.speakerKind === "system");
  const captured = closing ? capturedActions(fact(closing, "content")) : [];
  if (closing) {
    findings.push({
      sourceKey: "workshop-record",
      statement: {
        en: `The workshop record closes: ${fact(closing, "content")}`,
        de: `Die Workshop-Aufzeichnung schliesst (im Original englisch): ${fact(closing, "content")}`,
      },
      evidenceIds: closing.evidenceIds.slice(0, 1),
      basis: "approved-record",
    });
  }
  if (closing && captured.length > 0) {
    findings.push({
      sourceKey: "workshop-record",
      statement: {
        en: `Actions captured from the conversation (${captured.length}): ${captured.join(" ")} The minutes should raise each of them with an owner and a date.`,
        de: `Aus dem Gespraech erfasste Massnahmen (${captured.length}, im Original englisch): ${captured.join(" ")} Das Protokoll sollte jede mit Verantwortlichem und Termin fuehren.`,
      },
      evidenceIds: closing.evidenceIds.slice(0, 1),
      basis: "approved-record",
    });
  }
  const conclusionOpen = closing ? /not agreed/i.test(fact(closing, "content")) : false;
  gaps.push({
    key: "gap-minutes-shape",
    statement: conclusionOpen
      ? {
          en: `The minutes should record that the rating was not agreed at the close, the positions of both lines, the contradictions above and the ${captured.length} captured action(s). They are drafted, edited and confirmed in Meetings; confirming them creates their actions there.`,
          de: `Das Protokoll sollte festhalten, dass die Bewertung zum Schluss nicht vereinbart war, die Positionen beider Linien, die Widersprueche oben und die ${captured.length} erfassten Massnahmen. Es wird in Sitzungen entworfen, bearbeitet und bestaetigt; mit der Bestaetigung entstehen dort seine Massnahmen.`,
        }
      : {
          en: `The minutes should record the conclusion reached, the contradictions above and the ${captured.length} captured action(s). They are drafted, edited and confirmed in Meetings; confirming them creates their actions there.`,
          de: `Das Protokoll sollte das erreichte Ergebnis, die Widersprueche oben und die ${captured.length} erfassten Massnahmen festhalten. Es wird in Sitzungen entworfen, bearbeitet und bestaetigt; mit der Bestaetigung entstehen dort seine Massnahmen.`,
        },
    evidenceIds: closing?.evidenceIds.slice(0, 1) ?? [],
    severity: "material",
  });

  /* One inference, labelled: what the conversation settled and what it did not. */
  const dissent = [...turns].reverse().find((item) => item.facts?.speakerKind === "assistant" && fact(item, "content").toLowerCase().includes("not agreed"));
  if (dissent) {
    inferences.push({
      statement: {
        en: "The conversation narrowed the disagreement: the execution items are accepted by the first line, and what remains open is the rating and the classification of the system-waived item. The challenge conclusion should name both.",
        de: "Das Gespraech hat die Meinungsverschiedenheit eingegrenzt: die Ausfuehrungsfaelle erkennt die erste Linie an; offen bleiben die Bewertung und die Einordnung des vom System verzichteten Falls. Das Ergebnis der Herausforderung sollte beides benennen.",
      },
      evidenceIds: dissent.evidenceIds.slice(0, 1),
      uncertainty: {
        en: "This reads the record as written; the confirmed minutes are the account of what was agreed.",
        de: "Das liest die Aufzeichnung so, wie sie geschrieben ist; massgeblich fuer das Vereinbarte ist das bestaetigte Protokoll.",
      },
    });
  }
  if (sourceOf(sources, "first-line-submissions")?.status === "unavailable") {
    limitations.push({ en: "First-line submissions were unavailable, so positions are taken from the conversation only.", de: "Eingaben der ersten Linie waren nicht verfuegbar; Positionen stammen nur aus dem Gespraech." });
  }

  itemAssessments.push({
    itemId: "actions",
    proposedDisposition: captured.length > 0 ? "accept-with-condition" : "accept",
    note:
      captured.length > 0
        ? {
            en: `The conversation captured ${captured.length} action(s); they are enough if the confirmed minutes raise each of them.`,
            de: `Das Gespraech hat ${captured.length} Massnahmen erfasst; sie reichen, wenn das bestaetigte Protokoll jede davon fuehrt.`,
          }
        : { en: "The conversation captured no action; check the confirmed minutes for any.", de: "Das Gespraech hat keine Massnahme erfasst; pruefen Sie das bestaetigte Protokoll." },
  });
  for (const item of record.filter((entry) => fact(entry, "kind") === "minutes-unresolved")) {
    itemAssessments.push({
      itemId: item.id,
      proposedDisposition: "accept-with-condition",
      note: { en: "Carry it into the rating: Stage 6 cannot settle it, but must state it.", de: "In die Bewertung uebernehmen: Stufe 6 kann es nicht klaeren, muss es aber benennen." },
    });
  }

  return {
    schemaVersion: "stage-preparation-v1",
    summary: {
      en: `The challenge workshop is on record with ${turns.length} turn(s), ${contradictions.length} contradiction(s) flagged and ${captured.length} action(s) captured.${conclusionOpen ? " The rating was not agreed at the close." : ""} Its minutes are confirmed in Meetings.`,
      de: `Der Herausforderungs-Workshop ist mit ${turns.length} Beitraegen, ${contradictions.length} markierten Widerspruechen und ${captured.length} erfassten Massnahmen aufgezeichnet.${conclusionOpen ? " Die Bewertung war zum Schluss nicht vereinbart." : ""} Sein Protokoll wird in Sitzungen bestaetigt.`,
    },
    findings,
    inferences,
    contradictions,
    gaps,
    itemAssessments,
    proposals: [],
    recommendedOptionId: null,
    limitations,
  };
}

const PROMPT = `You prepare Stage 5 (Challenge Workshop) of a Risk and Control Self-Assessment for a second-line Operational Risk Partner at a synthetic bank.
Use only the source records provided: the meeting, its recorded conversation and its working minutes. State the agenda as run, the evidence pack, the contradictions flagged in the conversation (cite the turn and the document), the actions captured and the shape of the minutes.
Give proposals in itemAssessments for "actions" and for each unresolved issue of the minutes. Do not decide the challenge conclusion or confirm the minutes; the minutes are confirmed in Meetings by a person, and their state is shown elsewhere, so do not describe it.
Write every text field in British English ("en") and in German ("de", ASCII only: ae, oe, ue, ss; no umlauts). No dashes as punctuation.`;

registerPreparer("rcsa.challenge-workshop", {
  compose: (input) => composeWorkshop(input),
  prompt: ({ context, sources }) => ({
    instructions: PROMPT,
    input: JSON.stringify({
      assessment: context.run.subjectId,
      stage: context.stage.name,
      items: itemIdsFor(sources),
      sources: sources.map((source) => ({
        key: source.spec.key,
        status: source.status,
        records: source.result.records.map((record) => ({ id: record.id, label: record.label, value: record.value, evidenceIds: record.evidenceIds, facts: record.facts })),
      })),
    }),
  }),
  itemIds: ({ sources }) => itemIdsFor(sources),
});

/* ==========================================================================
   The workshop outcome form
   ========================================================================== */

const ISSUE_CHOICES = ["carry", "escalate", "resolved"] as const;
const ISSUE_LABELS: Record<(typeof ISSUE_CHOICES)[number], Bilingual> = {
  carry: { en: "Carry into the rating", de: "In die Bewertung uebernehmen" },
  escalate: { en: "Escalate to the committee", de: "An das Komitee eskalieren" },
  resolved: { en: "Resolved in the workshop", de: "Im Workshop geklaert" },
};

const outcomeSchema = z.object({
  actions: z.enum(["complete", "missing"], { message: "Say whether the actions raised are enough for the challenge." }),
  actionsNote: z.string().max(600),
  issues: z.array(z.object({ issueId: z.string().min(1), choice: z.enum(ISSUE_CHOICES, { message: "Decide every unresolved issue." }), note: z.string().max(600) })),
  overall: z.string().max(1200),
});
type OutcomeInput = z.infer<typeof outcomeSchema>;

function hint(context: StageContext, itemId: string, language: "en" | "de"): string {
  const proposal = context.preparation.output?.itemAssessments.find((item) => item.itemId === itemId);
  return proposal ? ` ${language === "de" ? "KI-Hinweis" : "AI note"}: ${language === "de" ? proposal.note.de : proposal.note.en}` : "";
}

registerTaskForm<OutcomeInput>("rcsa.workshop-outcome", {
  schema: outcomeSchema,
  fields: (context, language, current) => {
    const de = language === "de";
    const record = recordsOf(context.sources, "workshop-record");
    const minuteActions = record.filter((item) => fact(item, "kind") === "minutes-action");
    const issues = record.filter((item) => fact(item, "kind") === "minutes-unresolved");
    return {
      rows: [
        {
          id: "actions",
          label: de ? `Vom Protokoll erzeugte Massnahmen (${minuteActions.length})` : `Actions the minutes raise (${minuteActions.length})`,
          detail: `${minuteActions.length > 0 ? `${minuteActions.map((item) => `${item.label} (${item.value})`).join("; ")}.` : de ? "Noch keine." : "None yet."}${hint(context, "actions", language)}`,
          choice: {
            name: "actions",
            options: [
              { value: "complete", label: de ? "Ausreichend fuer die Herausforderung" : "Enough for the challenge" },
              { value: "missing", label: de ? "Es fehlt eine Massnahme" : "An action is missing" },
            ],
            value: current?.actions ?? "",
          },
          note: { name: "actions-note", value: current?.actionsNote ?? "", placeholder: de ? "Welche Massnahme fehlt; sie wird in Stufe 7 geplant" : "Which action is missing; Stage 7 plans it" },
          date: null,
        },
        ...issues.map((item) => {
          const entry = current?.issues.find((issue) => issue.issueId === item.id);
          return {
            id: item.id,
            label: item.label,
            detail: hint(context, item.id, language).trim() || null,
            choice: {
              name: `issue:${item.id}`,
              options: ISSUE_CHOICES.map((value) => ({ value, label: de ? ISSUE_LABELS[value].de : ISSUE_LABELS[value].en })),
              value: entry?.choice ?? "",
            },
            note: { name: `issue-note:${item.id}`, value: entry?.note ?? "", placeholder: de ? "Wie es geklaert wurde oder warum es eskaliert wird" : "How it was resolved, or why it is escalated" },
            date: null,
          };
        }),
      ],
      overall: { name: "overall", value: current?.overall ?? "", label: de ? "Anmerkung zum Workshop (optional)" : "Note on the workshop (optional)" },
    };
  },
  fromFormData: (data, context) => {
    const text = (name: string) => String(data.get(name) ?? "").trim();
    return {
      actions: text("actions"),
      actionsNote: text("actions-note"),
      issues: recordsOf(context.sources, "workshop-record")
        .filter((item) => fact(item, "kind") === "minutes-unresolved")
        .map((item) => ({ issueId: item.id, choice: text(`issue:${item.id}`), note: text(`issue-note:${item.id}`) })),
      overall: text("overall"),
    };
  },
  validate: (context, input) => {
    const problems: Bilingual[] = [];
    const confirmation = workshopMinutesConfirmation(context);
    if (!confirmation.met) {
      problems.push({
        en: `The outcome is decided on the confirmed minutes. ${confirmation.reason?.en ?? ""}`.trim(),
        de: `Das Ergebnis wird auf Grundlage des bestaetigten Protokolls entschieden. ${confirmation.reason?.de ?? ""}`.trim(),
      });
    }
    if (input.actions === "missing" && input.actionsNote.length < 10) {
      problems.push({ en: "Say which action is missing.", de: "Geben Sie an, welche Massnahme fehlt." });
    }
    for (const issue of input.issues) {
      if ((issue.choice === "resolved" || issue.choice === "escalate") && issue.note.length < 10) {
        problems.push({ en: `Say how ${issue.issueId} was resolved, or why it is escalated.`, de: `Geben Sie an, wie ${issue.issueId} geklaert wurde oder warum eskaliert wird.` });
      }
    }
    return problems;
  },
  defaults: (context) => ({
    actions: "complete" as const,
    actionsNote: "",
    issues: recordsOf(context.sources, "workshop-record")
      .filter((item) => fact(item, "kind") === "minutes-unresolved")
      .map((item) => ({ issueId: item.id, choice: "carry" as const, note: "" })),
    overall: "",
  }),
  summarise: (_context, input) => [
    input.actions === "complete"
      ? { en: "The actions the minutes raise are enough for the challenge.", de: "Die Massnahmen des Protokolls reichen fuer die Herausforderung." }
      : { en: `An action is missing: ${input.actionsNote}`, de: `Eine Massnahme fehlt: ${input.actionsNote}` },
    ...ISSUE_CHOICES.flatMap((value) => {
      const ids = input.issues.filter((issue) => issue.choice === value).map((issue) => issue.issueId);
      return ids.length > 0 ? [{ en: `${ISSUE_LABELS[value].en}: ${list(ids, "en")}`, de: `${ISSUE_LABELS[value].de}: ${list(ids, "de")}` }] : [];
    }),
  ],
});

/* ==========================================================================
   The workshop outcome record, written at completion
   ========================================================================== */

registerArtifactBuilder("rcsa.workshop-minutes", (context) => {
  const recorded = recordedTaskOutput(context, "workshop-outcome");
  const outcome = (recorded?.input ?? null) as OutcomeInput | null;
  const decision = decisionOf(context, "challenge-conclusion");
  const option = decision?.options.find((candidate) => candidate.id === decision.chosenOptionId);
  const meeting = recordsOf(context.sources, "workshop-record").find((item) => fact(item, "kind") === "meeting");
  const minutes = minutesRecord(context.sources);
  const carried = (outcome?.issues ?? []).filter((issue) => issue.choice === "carry").map((issue) => issue.issueId);
  const decisionId = boundDecisionId(context, "challenge-conclusion", DECISION_ID);
  return {
    label: { en: "Workshop outcome record", de: "Ergebnisprotokoll des Workshops" },
    content: {
      assessmentId: context.run.subjectId,
      recordLines: [
        minutes
          ? {
              en: `Minutes ${minutes.id} ${minutesStatus(fact(minutes, "status")).en}, version ${fact(minutes, "version")}, confirmed by ${personLabel(context.runId, fact(minutes, "confirmedBy"))}.`,
              de: `Protokoll ${minutes.id} ${minutesStatus(fact(minutes, "status")).de}, Version ${fact(minutes, "version")}, bestaetigt von ${personLabel(context.runId, fact(minutes, "confirmedBy"))}.`,
            }
          : { en: "No minutes are on record.", de: "Kein Protokoll erfasst." },
        option ? { en: `${decisionId}: ${option.label.en}.`, de: `${decisionId}: ${option.label.de}.` } : { en: `${decisionId} is not recorded.`, de: `${decisionId} ist nicht erfasst.` },
        ...(recorded?.summary ?? []),
      ],
      meeting: meeting ? { meetingId: meeting.id, reference: fact(meeting, "reference") } : null,
      minutes: minutes
        ? {
            minutesId: minutes.id,
            status: fact(minutes, "status"),
            version: fact(minutes, "version"),
            contentDigest: fact(minutes, "contentDigest") || null,
            confirmedBy: fact(minutes, "confirmedBy") || null,
            evidenceDocumentId: fact(minutes, "evidenceDocumentId") || null,
          }
        : null,
      outcome,
      conclusion: decision ? { decisionId, optionId: decision.chosenOptionId, rationale: decision.rationale, decidedBy: decision.decidedByUserId } : null,
      facts: {
        meetingId: meeting?.id ?? null,
        minutesId: minutes?.id ?? null,
        conclusionOption: decision?.chosenOptionId ?? null,
        carriedIssues: carried.join(","),
        missingAction: outcome?.actions === "missing" ? outcome.actionsNote : null,
      },
      preparation: { artifactId: context.preparation.artifactId, mode: context.preparation.mode, source: context.preparation.source },
    },
  };
});

export const RCSA_CHALLENGE_WORKSHOP = { processId: RCSA_PROCESS_ID, stageId: STAGE_ID } as const;
