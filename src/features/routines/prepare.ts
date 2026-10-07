/**
 * What each routine prepares for the person, from what its governed step read.
 *
 * Pure. Each function takes the data the routine's tool returned and composes
 * the suggestion the person sees, in their language, and the run summary for
 * Home and the dock, in both. Every sentence is counted or quoted from the
 * records the step read; nothing is written about work that did not happen.
 * The candidate then goes through `validateRoutineOutput` like any other AI
 * output, so this composer is held to the same rules a model would be.
 *
 * A routine's suggestion never reports a change as done (`actionsCompleted`
 * stays empty) and never asks for a decision of its own: the most it does is
 * name the decision already waiting on Decisions.
 */

import { displayDate } from "@/features/work/model";
import type { MaterialChangeData, MeetingPreparationData, TriageProposalData } from "./tools";
import { ROUTINE_OUTPUT_SCHEMA_VERSION, type RoutineOutput } from "./schema";
import { clockOf } from "./windows";

type Language = "en" | "de";
type Pair = { en: string; de: string };

export interface PreparedRoutineWork {
  /** One suggestion per thing prepared. */
  /**
   * `outputObjectId` is the thing prepared; `coveredIds`, when set, every
   * object the one suggestion covers (a triage proposal names each message),
   * so later windows leave all of them out.
   */
  outputs: Array<{ candidate: RoutineOutput; outputObjectId: string; coveredIds?: string[] }>;
  summary: Pair;
  /** The work object the run is about, for Home and Updates. Null when it prepared nothing. */
  subject: { kind: string; id: string } | null;
}

const say = (pair: Pair, language: Language) => (language === "de" ? pair.de : pair.en);

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

function both(template: Pair, values: Record<string, string | number>): Pair {
  return { en: fill(template.en, values), de: fill(template.de, values) };
}

function firstClause(text: string, limit = 160): string {
  const clause = text.split(/(?<=[.;])\s/)[0] ?? text;
  return clause.length > limit ? `${clause.slice(0, limit - 3).trimEnd()}...` : clause;
}

/* ==========================================================================
   Meeting preparation
   ========================================================================== */

export function prepareMeetingBrief(data: MeetingPreparationData, language: Language): PreparedRoutineWork {
  const output = data.preparation.output;
  const title = language === "de" && data.meeting.titleDe.length > 0 ? data.meeting.titleDe : data.meeting.title;
  const at = clockOf(data.meeting.scheduledFor);
  if (!output) {
    return {
      outputs: [],
      subject: null,
      summary: both(
        { en: "The brief for {title} at {at} could not be prepared: no preparation passed the checks.", de: "Die Vorbereitung fuer {title} um {at} war nicht moeglich: keine Fassung hat die Pruefungen bestanden." },
        { title: data.meeting.title, at },
      ),
    };
  }
  const evidenceIds = [...new Set([...output.questions.flatMap((q) => q.evidenceIds), ...output.contradictions.flatMap((c) => c.evidenceIds)])].slice(0, 24);
  const counts = { questions: output.questions.length, contradictions: output.contradictions.length, decisions: data.openDecisionIds.length };
  const candidate: RoutineOutput = {
    schemaVersion: ROUTINE_OUTPUT_SCHEMA_VERSION,
    objectType: "meeting",
    objectId: data.meeting.id,
    priority: counts.decisions > 0 || counts.contradictions > 0 ? "high" : "medium",
    headline: fill(say({ en: "Brief prepared for {title} at {at}", de: "Vorbereitung fuer {title} um {at} erstellt" }, language), { title, at }),
    changeSummary: say(output.summary, language),
    whyItMatters:
      output.watch[0] !== undefined
        ? say(output.watch[0], language)
        : fill(
            say(
              { en: "The meeting starts at {at}. Nothing in its pack needs attention before then.", de: "Die Besprechung beginnt um {at}. Im Paket ist vorher nichts zu beachten." },
              language,
            ),
            { at },
          ),
    checksCompleted: [
      fill(say({ en: "Prepared {questions} question(s) from the meeting record", de: "{questions} Frage(n) aus dem Besprechungsdatensatz vorbereitet" }, language), counts),
      fill(say({ en: "Checked {decisions} open decision(s) on the subject", de: "{decisions} offene Entscheidung(en) zum Gegenstand geprueft" }, language), counts),
      fill(say({ en: "Checked {contradictions} contradiction(s) on record", de: "{contradictions} erfasste(n) Widerspruch/Widersprueche geprueft" }, language), counts),
    ],
    actionsCompleted: [],
    recommendedAction: fill(
      say(
        { en: "Open the meeting and read the prepared questions before {at}. Use, change or drop any of them.", de: "Oeffnen Sie die Besprechung und lesen Sie die vorbereiteten Fragen vor {at}. Verwenden, aendern oder verwerfen Sie sie." },
        language,
      ),
      { at },
    ),
    alternatives: [],
    evidenceIds,
    uncertainty: [
      ...output.limitations.map((limitation) => say(limitation, language)),
      ...(data.preparation.note ? [say(data.preparation.note, language)] : []),
    ].slice(0, 6),
    confidence: data.preparation.mode === "safe" ? 75 : 60,
    decisionId: data.openDecisionIds[0] ?? null,
    decisionRequired: false,
  };
  return {
    outputs: [{ candidate, outputObjectId: data.meeting.id }],
    subject: { kind: "meeting", id: data.meeting.id },
    summary: {
      en: fill("Prepared the brief for {title} at {at}: {questions} question(s), {decisions} open decision(s), {contradictions} contradiction(s).", {
        title: data.meeting.title,
        at,
        ...counts,
      }),
      de: fill("Vorbereitung fuer {title} um {at} erstellt: {questions} Frage(n), {decisions} offene Entscheidung(en), {contradictions} Widerspruch/Widersprueche.", {
        title: data.meeting.titleDe.length > 0 ? data.meeting.titleDe : data.meeting.title,
        at,
        ...counts,
      }),
    },
  };
}

/* ==========================================================================
   Action follow-up
   ========================================================================== */

export interface ReminderData {
  action: { id: string; reference: string; title: string; titleDe: string; dueOn: string | null; ownerName: string };
  overdue: boolean;
  draft: { subject: string; body: string };
}

export function prepareReminders(drafts: readonly ReminderData[], language: Language): PreparedRoutineWork {
  const outputs = drafts.map(({ action, overdue, draft }) => {
    const title = language === "de" && action.titleDe.length > 0 ? action.titleDe : action.title;
    const due = action.dueOn ? displayDate(action.dueOn) : say({ en: "no date", de: "ohne Datum" }, language);
    const candidate: RoutineOutput = {
      schemaVersion: ROUTINE_OUTPUT_SCHEMA_VERSION,
      objectType: "action",
      objectId: action.id,
      priority: overdue ? "high" : "medium",
      headline: fill(say({ en: "Reminder drafted for {owner}: {title}", de: "Erinnerung an {owner} entworfen: {title}" }, language), { owner: action.ownerName, title }),
      changeSummary: fill(
        say(
          overdue
            ? { en: "{id} was due on {due} and is overdue. {owner} is accountable for it.", de: "{id} war am {due} faellig und ist ueberfaellig. {owner} ist dafuer verantwortlich." }
            : { en: "{id} is due on {due}. {owner} is accountable for it.", de: "{id} ist am {due} faellig. {owner} ist dafuer verantwortlich." },
          language,
        ),
        { id: action.reference, due, owner: action.ownerName },
      ),
      whyItMatters: say(
        overdue
          ? { en: "An overdue action keeps its risk open until the owner closes it against its completion condition.", de: "Eine ueberfaellige Massnahme laesst ihr Risiko offen, bis die verantwortliche Person sie gegen ihre Abschlussbedingung schliesst." }
          : { en: "A short reminder now is cheaper than chasing an overdue action next week.", de: "Eine kurze Erinnerung jetzt ist einfacher als eine ueberfaellige Massnahme naechste Woche nachzuverfolgen." },
        language,
      ),
      checksCompleted: [
        fill(say({ en: "Read {id}: owner, due date and completion condition", de: "{id} gelesen: verantwortliche Person, Faelligkeit und Abschlussbedingung" }, language), { id: action.reference }),
      ],
      actionsCompleted: [],
      recommendedAction: fill(
        say({ en: "Send this reminder from the action, or change it first: \"{subject}. {body}\"", de: "Senden Sie diese Erinnerung aus der Massnahme heraus oder aendern Sie sie zuerst: \"{subject}. {body}\"" }, language),
        { subject: draft.subject, body: draft.body },
      ),
      alternatives: [],
      evidenceIds: [],
      uncertainty: [say({ en: "Nothing has been sent. Sending is a separate step you take from the action.", de: "Es wurde nichts gesendet. Das Senden ist ein eigener Schritt, den Sie in der Massnahme ausfuehren." }, language)],
      confidence: 70,
      decisionId: null,
      decisionRequired: false,
    };
    return { candidate, outputObjectId: action.id };
  });
  const first = drafts[0];
  return {
    outputs,
    subject: first ? { kind: "action", id: first.action.id } : null,
    summary:
      drafts.length === 0
        ? { en: "No action needed a reminder.", de: "Keine Massnahme brauchte eine Erinnerung." }
        : both(
            { en: "Drafted {n} reminder(s) for actions owned by others: {ids}. Nothing was sent.", de: "{n} Erinnerung(en) fuer Massnahmen anderer entworfen: {ids}. Es wurde nichts gesendet." },
            { n: drafts.length, ids: drafts.map((entry) => entry.action.reference).join(", ") },
          ),
  };
}

/* ==========================================================================
   Inbox triage
   ========================================================================== */

const CLASSIFICATION: Record<string, Pair> = {
  decision: { en: "decision", de: "Entscheidung" },
  action: { en: "action", de: "Massnahme" },
  evidence: { en: "evidence", de: "Nachweis" },
  information: { en: "information", de: "Information" },
  delegate: { en: "delegate", de: "Delegation" },
  noise: { en: "noise", de: "ohne Belang" },
};

export function prepareTriage(
  proposals: readonly TriageProposalData[],
  context: { language: Language; now: string; live: boolean },
): PreparedRoutineWork {
  const { language } = context;
  const classified = proposals.filter((proposal) => proposal.classification !== null);
  const first = proposals[0];
  if (!first) {
    return { outputs: [], subject: null, summary: { en: "No message needed triage.", de: "Keine Nachricht brauchte eine Einordnung." } };
  }
  const tally = new Map<string, number>();
  for (const proposal of classified) tally.set(proposal.classification as string, (tally.get(proposal.classification as string) ?? 0) + 1);
  const breakdown = [...tally.entries()].map(([kind, n]) => `${n} ${say(CLASSIFICATION[kind] ?? { en: kind, de: kind }, language)}`).join(", ");
  const anyOffline = classified.some((proposal) => proposal.mode === "offline");

  const candidate: RoutineOutput = {
    schemaVersion: ROUTINE_OUTPUT_SCHEMA_VERSION,
    objectType: "inbox-message",
    objectId: first.messageId,
    priority: tally.has("decision") || tally.has("action") ? "medium" : "low",
    headline: fill(say({ en: "{n} message(s) proposed for triage", de: "{n} Nachricht(en) zur Einordnung vorgeschlagen" }, language), { n: proposals.length }),
    changeSummary: fill(
      say({ en: "{n} message(s) arrived by {now} that you have not classified yet.", de: "{n} Nachricht(en) sind bis {now} eingegangen, die Sie noch nicht eingeordnet haben." }, language),
      { n: proposals.length, now: context.now },
    ),
    whyItMatters:
      classified.length > 0
        ? fill(say({ en: "Proposed: {breakdown}. Each proposal carries its reason.", de: "Vorgeschlagen: {breakdown}. Jeder Vorschlag nennt seinen Grund." }, language), { breakdown })
        : say({ en: "No proposal passed the checks, so none is offered. Classify the messages yourself.", de: "Kein Vorschlag hat die Pruefungen bestanden, daher wird keiner angeboten. Ordnen Sie die Nachrichten selbst ein." }, language),
    checksCompleted: proposals.slice(0, 8).map((proposal) => {
      const label = proposal.classification ? say(CLASSIFICATION[proposal.classification] ?? { en: proposal.classification, de: proposal.classification }, language) : say({ en: "not classified", de: "nicht eingeordnet" }, language);
      const reason = proposal.rationale ? firstClause(language === "de" && proposal.rationale.de ? proposal.rationale.de : proposal.rationale.en, 140) : "";
      return reason.length > 0 ? `${proposal.messageId}: ${label}. ${reason}` : `${proposal.messageId}: ${label}`;
    }),
    actionsCompleted: [],
    recommendedAction: say(
      { en: "Confirm or change each classification in the inbox. Nothing is filed, converted or dismissed until you do.", de: "Bestaetigen oder aendern Sie jede Einordnung im Posteingang. Nichts wird abgelegt, umgewandelt oder verworfen, bevor Sie das tun." },
      language,
    ),
    alternatives: [],
    evidenceIds: [],
    uncertainty: [
      anyOffline
        ? say({ en: "Some proposals were composed from the messages' own facts. Confidence is not estimated for those.", de: "Einige Vorschlaege wurden aus den Angaben der Nachrichten zusammengestellt. Fuer diese wird keine Sicherheit geschaetzt." }, language)
        : say({ en: "The proposals were prepared before the day and checked against each message.", de: "Die Vorschlaege wurden vor dem Tag vorbereitet und gegen jede Nachricht geprueft." }, language),
      ...(context.live
        ? [say({ en: "Live classification is not connected for the inbox, so the prepared proposals are shown.", de: "Eine Live-Einordnung ist fuer den Posteingang nicht angebunden, daher werden die vorbereiteten Vorschlaege gezeigt." }, language)]
        : []),
    ],
    confidence: anyOffline ? 55 : 70,
    decisionId: null,
    decisionRequired: false,
  };
  return {
    outputs: [{ candidate, outputObjectId: first.messageId, coveredIds: proposals.map((proposal) => proposal.messageId) }],
    subject: { kind: "message", id: first.messageId },
    summary: {
      en: fill("Proposed a classification for {n} new message(s): {ids}{more}.", {
        n: proposals.length,
        ids: proposals.slice(0, 3).map((proposal) => proposal.messageId).join(", "),
        more: proposals.length > 3 ? ` and ${proposals.length - 3} more` : "",
      }),
      de: fill("Einordnung fuer {n} neue Nachricht(en) vorgeschlagen: {ids}{more}.", {
        n: proposals.length,
        ids: proposals.slice(0, 3).map((proposal) => proposal.messageId).join(", "),
        more: proposals.length > 3 ? ` und ${proposals.length - 3} weitere` : "",
      }),
    },
  };
}

/* ==========================================================================
   Event monitoring
   ========================================================================== */

export function prepareMaterialChanges(changes: readonly MaterialChangeData[], language: Language): PreparedRoutineWork {
  const outputs = changes.map((change) => {
    const title = language === "de" ? change.titleDe : change.title;
    const decisionList = change.openDecisions.map((decision) => decision.id).join(", ");
    const meeting = change.laterMeetings[0];
    const bearsOn: string[] = [];
    if (change.openDecisions.length > 0) bearsOn.push(fill(say({ en: "{n} open decision(s) ({ids})", de: "{n} offene Entscheidung(en) ({ids})" }, language), { n: change.openDecisions.length, ids: decisionList }));
    if (meeting) bearsOn.push(fill(say({ en: "the meeting at {at}", de: "die Besprechung um {at}" }, language), { at: meeting.at }));
    if (change.stage) bearsOn.push(say(change.stage.name, language));

    const candidate: RoutineOutput = {
      schemaVersion: ROUTINE_OUTPUT_SCHEMA_VERSION,
      objectType: change.roleView?.workObjectKind ?? (change.objectKind || "event"),
      objectId: change.roleView?.workObjectId ?? (change.objectId || change.eventId),
      priority: "high",
      headline: fill(say({ en: "Material change at {at}: {title}", de: "Wesentliche Aenderung um {at}: {title}" }, language), { at: change.atMoment, title }),
      changeSummary: change.roleView?.headline ?? title,
      whyItMatters:
        bearsOn.length > 0
          ? fill(say({ en: "It bears on {list}.", de: "Sie betrifft {list}." }, language), { list: bearsOn.join(language === "de" ? ", " : ", ") })
          : say({ en: "No open decision or later meeting today names the affected work.", de: "Keine offene Entscheidung und keine spaetere Besprechung heute nennt die betroffene Arbeit." }, language),
      checksCompleted: [
        fill(say({ en: "Checked {n} open decision(s) for the affected work", de: "{n} offene Entscheidung(en) auf die betroffene Arbeit geprueft" }, language), { n: change.openDecisions.length }),
        fill(say({ en: "Checked today's later meetings: {n}", de: "Spaetere Besprechungen heute geprueft: {n}" }, language), { n: change.laterMeetings.length }),
        ...(change.stage ? [fill(say({ en: "Checked the running process: {stage}", de: "Laufenden Prozess geprueft: {stage}" }, language), { stage: say(change.stage.name, language) })] : []),
      ],
      actionsCompleted: [],
      recommendedAction: change.openDecisions[0]
        ? fill(say({ en: "Review {id} with this change in view before you decide it.", de: "Pruefen Sie {id} mit Blick auf diese Aenderung, bevor Sie entscheiden." }, language), { id: change.openDecisions[0].id })
        : say({ en: "Review the affected work with this change in view.", de: "Pruefen Sie die betroffene Arbeit mit Blick auf diese Aenderung." }, language),
      alternatives: [],
      evidenceIds: (change.roleView?.evidenceIds ?? []).slice(0, 12),
      uncertainty: change.roleView?.uncertainty ? [firstClause(change.roleView.uncertainty, 600)] : [],
      confidence: change.roleView ? 70 : 50,
      decisionId: change.openDecisions[0]?.id ?? null,
      decisionRequired: false,
    };
    return { candidate, outputObjectId: change.eventId };
  });
  const first = changes[0];
  const firstOutput = outputs[0]?.candidate;
  return {
    outputs,
    subject: first && firstOutput ? (firstOutput.decisionId ? { kind: "decision", id: firstOutput.decisionId } : { kind: firstOutput.objectType, id: firstOutput.objectId }) : null,
    summary:
      changes.length === 0
        ? { en: "Checked the day's arrivals and source changes: no material change.", de: "Eingaenge und Quellenaenderungen des Tages geprueft: keine wesentliche Aenderung." }
        : {
            en: fill("Raised {n} material change(s) and the open work each bears on: {titles}.", {
              n: changes.length,
              titles: changes.map((change) => change.title).join("; "),
            }),
            de: fill("{n} wesentliche Aenderung(en) und die betroffene offene Arbeit gemeldet: {titles}.", {
              n: changes.length,
              titles: changes.map((change) => change.titleDe).join("; "),
            }),
          },
  };
}
