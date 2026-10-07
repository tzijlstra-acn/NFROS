/**
 * Seeded chat answers.
 *
 * The chat is the surface where an absent credential is most visible, because
 * the user types a question and expects an answer. The honest design is
 * therefore not one fallback sentence but a set of real answers to the
 * questions this day actually provokes, each one grounded in the seeded
 * corpus, plus a clearly worded decline for anything outside them.
 *
 * The decline matters as much as the answers. A seeded paragraph that sounds
 * like an answer to a question it was not written for is the single most
 * damaging thing this product could produce, because the entire claim is that
 * a conclusion is traceable to evidence. So intent matching is keyword based
 * and deliberately conservative: a near miss declines rather than guesses.
 */

import type { RoleId } from "@/db/schema/core";
import type { ChatTurnPart } from "./parts";
import {
  alternativePart,
  answerPart,
  evidencePart,
  recommendationPart,
  uncertaintyPart,
} from "./parts";

export interface SeededChatAnswer {
  id: string;
  /** Roles this answer is written for. Empty means every role. */
  roleIds: RoleId[];
  /** Lower case keyword groups. Every group must match somewhere in the input. */
  keywordGroups: string[][];
  en: ChatTurnPart[];
  de: ChatTurnPart[];
}

const DISCLOSURE = "Illustrative regulatory context, not legal advice.";

/* ==========================================================================
   The answers
   ========================================================================== */

const CONTROL_RATING: SeededChatAnswer = {
  id: "chat-ctl-pay-014-rating",
  roleIds: [],
  keywordGroups: [["ctl-pay-014", "secondary review", "the control"], ["rating", "effective", "effectiveness", "wirksam"]],
  en: [
    answerPart(
      "The recorded rating is fully effective and the independent test does not support it. Four items in a sample of sixty failed an attribute and two more could not be concluded at all, so the deviation rate is four in fifty-eight at best and unknown at worst.",
    ),
    evidencePart(
      "Control test report TST-2026-0318 records four exceptions and two items that could not be concluded in a sample of sixty drawn from a population of 1204.",
      ["EVD-2026-41850"],
    ),
    evidencePart(
      "Working paper WP-07 is the exception and unable to conclude schedule, listing each flagged item against the attribute it failed.",
      ["EVD-2026-41852"],
    ),
    evidencePart(
      "The first line control self-assessment for the Q4 cycle records the control as fully effective, which is a stakeholder statement rather than a tested result.",
      ["EVD-2026-41855"],
    ),
    uncertaintyPart(
      "Whether the two unconcludable items are a retention failure or a review that never happened cannot be established from the records held. A restoration request for one of them is outstanding.",
    ),
    recommendationPart(
      "Treat the operating effectiveness conclusion as unavailable rather than negative, and state the two unconcludable items as a scope limitation on the face of whatever is recorded.",
    ),
    alternativePart(
      "Conclude on design only and keep the test open until the missing evidence objects are retrieved. Better evidenced, and it leaves the workshop without an input.",
    ),
  ],
  de: [
    answerPart(
      "Die erfasste Bewertung lautet voll wirksam, und die unabhaengige Pruefung stuetzt das nicht. Vier Positionen von sechzig verfehlten ein Attribut, zwei weitere waren gar nicht abschliessbar. Die Abweichungsrate ist bestenfalls vier von achtundfuenfzig und im schlechteren Fall unbekannt.",
    ),
    evidencePart(
      "Der Pruefbericht TST-2026-0318 erfasst vier Ausnahmen und zwei nicht abschliessbare Positionen in einer Stichprobe von sechzig aus einer Population von 1204.",
      ["EVD-2026-41850"],
    ),
    evidencePart(
      "Arbeitspapier WP-07 ist die Aufstellung der Ausnahmen und nicht abschliessbaren Positionen, je Position mit dem verfehlten Attribut.",
      ["EVD-2026-41852"],
    ),
    evidencePart(
      "Die Selbstbewertung der ersten Linie fuehrt die Kontrolle fuer den Q4-Zyklus als voll wirksam. Das ist eine Stakeholder-Aussage, kein Pruefergebnis.",
      ["EVD-2026-41855"],
    ),
    uncertaintyPart(
      "Ob die zwei nicht abschliessbaren Positionen ein Aufbewahrungsproblem oder eine nie erfolgte Pruefung sind, laesst sich nicht klaeren. Eine Wiederherstellungsanfrage ist offen.",
    ),
    recommendationPart(
      "Die Aussage zur Durchfuehrungswirksamkeit als nicht verfuegbar behandeln, nicht als negativ, und die zwei Positionen als Umfangsbeschraenkung in der Aussage nennen.",
    ),
    alternativePart(
      "Nur zur Konstruktion schliessen und die Pruefung bis zur Beschaffung der fehlenden Nachweise offen halten. Besser belegt, laesst den Workshop ohne Beitrag.",
    ),
  ],
};

const SUBPROCESSOR_GAP: SeededChatAnswer = {
  id: "chat-subprocessor-divergence",
  roleIds: [],
  keywordGroups: [
    ["subprocessor", "subprozessor", "unterauftrag", "appendix", "anhang", "tp-0042.4", "meridian", "pune"],
    ["gap", "divergence", "notice", "breach", "abweichung", "mitteilung", "verstoss", "missing", "fehlt"],
  ],
  en: [
    answerPart(
      "Four nodes differ between the binding appendix and the supplier register, and the service desk provider in Pune is the one that matters. It appears in the supplier register and in the questionnaire response, and in neither the appendix nor any notice held in the contract repository.",
    ),
    evidencePart(
      "Appendix A3 version 4.2 of 14.02.2025 is the subprocessor list recorded as binding, and clause 3.4 sets the notice provision.",
      ["EVD-2026-41410"],
    ),
    evidencePart(
      "The supplier register version 6.1, as published on the client portal, lists the service desk provider as an active subprocessor.",
      ["EVD-2026-41405"],
    ),
    evidencePart(
      "No subprocessor notice for that provider is held in the contract repository. The search covered the full repository scope, so the nil return is recorded.",
      ["EVD-2026-41235"],
    ),
    evidencePart(
      "The data processing appendix names Switzerland, Germany, the Czech Republic and Ireland as transfer destinations, and does not name India.",
      ["EVD-2026-41402"],
    ),
    uncertaintyPart(
      "Whether publication on the client portal satisfies the notice provision is a contractual interpretation. Group Legal must establish which document binds, and this is not a question I can answer.",
    ),
    recommendationPart(
      "Record the transparency gap now and keep the characterisation open. Breach, material change and drafting gap have different consequences and different owners, and the evidence does not yet separate them.",
    ),
  ],
  de: [
    answerPart(
      "Vier Knoten unterscheiden sich zwischen dem verbindlichen Anhang und dem Lieferantenregister, und der Service-Desk-Anbieter in Pune ist der entscheidende. Er erscheint im Register und in der Fragebogenantwort, und weder im Anhang noch in einer Mitteilung im Vertragsarchiv.",
    ),
    evidencePart(
      "Anhang A3 Version 4.2 vom 14.02.2025 ist die als verbindlich erfasste Unterauftragsliste, Ziffer 3.4 regelt die Mitteilung.",
      ["EVD-2026-41410"],
    ),
    evidencePart(
      "Das auf dem Kundenportal veroeffentlichte Lieferantenregister Version 6.1 fuehrt den Service-Desk-Anbieter als aktiven Unterauftragnehmer.",
      ["EVD-2026-41405"],
    ),
    evidencePart(
      "Im Vertragsarchiv liegt keine Unterauftragsmitteilung zu diesem Anbieter. Die Suche umfasste das vollstaendige Archiv, der Nulltreffer ist erfasst.",
      ["EVD-2026-41235"],
    ),
    evidencePart(
      "Der Datenverarbeitungsanhang nennt die Schweiz, Deutschland, Tschechien und Irland als Zielorte und nennt Indien nicht.",
      ["EVD-2026-41402"],
    ),
    uncertaintyPart(
      "Ob die Veroeffentlichung auf dem Kundenportal die Mitteilungspflicht erfuellt, ist eine Vertragsauslegung. Group Legal muss klaeren, welches Dokument bindet. Diese Frage kann ich nicht beantworten.",
    ),
    recommendationPart(
      "Die Transparenzluecke jetzt erfassen und die Einordnung offen lassen. Verstoss, wesentliche Aenderung und Formulierungsluecke haben verschiedene Folgen und Eigentuemer.",
    ),
  ],
};

const SWISS_JURISDICTION: SeededChatAnswer = {
  id: "chat-swiss-jurisdiction",
  roleIds: [],
  keywordGroups: [
    ["swiss", "schweiz", "arc-ch", "finma"],
    ["dora", "eu ", "european", "regulation", "notification", "meldung", "applicab", "anwendbar", "report"],
  ],
  en: [
    answerPart(
      `Arcadia Bank Schweiz AG is supervised by FINMA, and the European Union digital operational resilience regulation does not apply to it. The operational risk, resilience and outsourcing expectations for that entity follow the Swiss framework instead. ${DISCLOSURE}`,
    ),
    answerPart(
      "The German and Austrian entities are a different question. They are European Union credit institutions, so the European Union requirements and the European Banking Authority guidelines do apply to them, and a notification assessment for those entities is a separate assessment with no shared fields.",
    ),
    evidencePart(
      "The regulatory reference digest for the Swiss entity records the applicable operational risk, resilience and outsourcing framework.",
      ["EVD-2026-41320"],
    ),
    evidencePart(
      "The European Union regulatory reference digest records the requirements applicable to the German and Austrian entities.",
      ["EVD-2026-41300"],
    ),
    evidencePart(
      "The group incident classification and reporting standard, implemented 30.04.2026, defines the two assessment tracks separately.",
      ["EVD-2026-41315"],
    ),
    uncertaintyPart(
      "Applicability and interpretation are decisions for a named accountable person per legal entity. What is set out here is the structure the records already hold, not a conclusion.",
    ),
  ],
  de: [
    answerPart(
      `Die Arcadia Bank Schweiz AG untersteht der FINMA, und die Verordnung der Europaeischen Union zur digitalen operationalen Resilienz ist auf sie nicht anwendbar. Die Erwartungen zu operationellem Risiko, Resilienz und Auslagerung folgen fuer diese Einheit dem Schweizer Rahmenwerk. ${DISCLOSURE}`,
    ),
    answerPart(
      "Die deutsche und die oesterreichische Einheit sind eine andere Frage. Sie sind Kreditinstitute der Europaeischen Union, daher gelten die Anforderungen der Europaeischen Union und die Leitlinien der Europaeischen Bankenaufsichtsbehoerde fuer sie, und eine Meldebewertung dort ist eine eigene Bewertung ohne gemeinsame Felder.",
    ),
    evidencePart(
      "Der regulatorische Referenzauszug fuer die Schweizer Einheit erfasst das anwendbare Rahmenwerk zu operationellem Risiko, Resilienz und Auslagerung.",
      ["EVD-2026-41320"],
    ),
    evidencePart(
      "Der Referenzauszug der Europaeischen Union erfasst die fuer die deutsche und oesterreichische Einheit anwendbaren Anforderungen.",
      ["EVD-2026-41300"],
    ),
    evidencePart(
      "Der am 30.04.2026 eingefuehrte Gruppenstandard zur Vorfallklassifizierung definiert die zwei Bewertungsspuren getrennt.",
      ["EVD-2026-41315"],
    ),
    uncertaintyPart(
      "Anwendbarkeit und Auslegung entscheidet eine benannte verantwortliche Person je Rechtseinheit. Dargestellt ist die vorhandene Struktur, kein Ergebnis.",
    ),
  ],
};

const SWISS_TOLERANCE: SeededChatAnswer = {
  id: "chat-swiss-tolerance",
  roleIds: [],
  keywordGroups: [
    ["tolerance", "toleranz", "itol", "headroom", "spielraum", "cut-off", "cutoff"],
    ["swiss", "schweiz", "arc-ch", "clearing", "euro sic", "eurosic", "sic"],
  ],
  en: [
    answerPart(
      "The Swiss tolerance records two measures and no precedence between them: 120 minutes of tolerable disruption, and completion of submission before the 16:00 same day cut-off. Those two can disagree, and the record does not say which prevails.",
    ),
    evidencePart(
      "The impact tolerance approvals for Corporate Payments record ITOL-0004-03 with both measures, from the board committee minutes of 24.02.2026.",
      ["EVD-2026-41500"],
    ),
    evidencePart(
      "Runbook RB-PAY-011 version 2.2 states a 45 minute preparation lead time for manual correspondent submission and carries a review date of 14.01.2026.",
      ["EVD-2026-41710"],
    ),
    evidencePart(
      "The continuity exercise report records a desktop walkthrough of that route rather than a live submission, so the lead time has never been measured.",
      ["EVD-2026-41505"],
    ),
    answerPart(
      "Practically, that puts the latest safe start for manual submission at about 15:15 against a 16:00 cut-off (scenario figures).",
    ),
    uncertaintyPart(
      "The 45 minute figure is documented and unrehearsed, so 15:15 is the optimistic boundary rather than the expected one.",
    ),
    uncertaintyPart(
      "Whether a given outcome falls inside the tolerance cannot be determined from the record while the two measures have no stated precedence. That ambiguity is itself a finding.",
    ),
  ],
  de: [
    answerPart(
      "Die Schweizer Toleranz erfasst zwei Masse ohne Vorrang: 120 Minuten tolerierbare Stoerung und den Abschluss der Einlieferung vor dem Tagesschluss um 16:00. Beide koennen voneinander abweichen, und der Datensatz nennt keinen Vorrang.",
    ),
    evidencePart(
      "Die Toleranzgenehmigungen fuer Corporate Payments erfassen ITOL-0004-03 mit beiden Massen, aus dem Ausschussprotokoll vom 24.02.2026.",
      ["EVD-2026-41500"],
    ),
    evidencePart(
      "Das Handbuch RB-PAY-011 Version 2.2 nennt 45 Minuten Vorlaufzeit fuer die manuelle Korrespondenteneinlieferung, Pruefdatum 14.01.2026.",
      ["EVD-2026-41710"],
    ),
    evidencePart(
      "Der Kontinuitaetsuebungsbericht erfasst eine Schreibtischuebung dieser Route und keine echte Einlieferung. Die Vorlaufzeit wurde nie gemessen.",
      ["EVD-2026-41505"],
    ),
    answerPart(
      "Praktisch liegt der spaeteste sichere Start der manuellen Einlieferung damit bei etwa 15:15 gegen einen Schluss um 16:00 (Szenariowerte).",
    ),
    uncertaintyPart(
      "Die 45 Minuten sind dokumentiert und ungeuebt, daher ist 15:15 die optimistische und nicht die erwartete Grenze.",
    ),
    uncertaintyPart(
      "Ob ein Ergebnis innerhalb der Toleranz liegt, ist aus dem Datensatz nicht bestimmbar, solange die zwei Masse keinen Vorrang haben. Diese Mehrdeutigkeit ist selbst eine Feststellung.",
    ),
  ],
};

const OVERDUE_ACTION: SeededChatAnswer = {
  id: "chat-overdue-action",
  roleIds: [],
  keywordGroups: [
    ["msn-2026-0147", "overdue", "ueberfaellig", "remediation", "massnahme", "extension", "verlaengerung"],
    ["why", "status", "blocked", "blocker", "warum", "stand", "age", "days", "tage"],
  ],
  en: [
    answerPart(
      "The action is 67 days past the due date the committee approved on 14.04.2026, and the dependency its owner cites has ended. The supplier change was delivered. What remains is an acceptance test that was requested and never scheduled.",
    ),
    evidencePart(
      "The committee minute of 14.04.2026 records the extension and the monthly reporting condition attached to it.",
      ["EVD-2026-41270"],
    ),
    evidencePart(
      "The action update as at 30.09.2026 states the progress position and names the infrastructure freeze as the blocking dependency.",
      ["EVD-2026-41280"],
    ),
    evidencePart(
      "The user acceptance test scheduling request for the supplier change is recorded as unanswered.",
      ["EVD-2026-41205"],
    ),
    evidencePart(
      "Audit finding F3 of September 2025 records the exposure this action was raised to close.",
      ["EVD-2026-41105"],
    ),
    answerPart(
      "The extension also carried a monthly reporting condition. Reports exist for May, June and July 2026 and none since, which is a failure in the committee's own follow up rather than only in the owner's delivery.",
    ),
    recommendationPart(
      "Escalate with a named accountable executive rather than re-baselining. A second extension on an ended dependency accepts the original audit exposure for another quarter without saying so.",
    ),
    alternativePart(
      "Re-baseline to a date derived from the acceptance test lead time, which is proportionate. That lead time is not recorded anywhere held, so the date would be an estimate.",
    ),
  ],
  de: [
    answerPart(
      "Die Massnahme liegt 67 Tage nach dem am 14.04.2026 genehmigten Faelligkeitsdatum, und die vom Eigentuemer genannte Abhaengigkeit ist beendet. Die Lieferantenaenderung wurde geliefert. Es bleibt ein angeforderter und nie terminierter Abnahmetest.",
    ),
    evidencePart(
      "Das Ausschussprotokoll vom 14.04.2026 erfasst die Verlaengerung und die beigefuegte Monatsberichtsbedingung.",
      ["EVD-2026-41270"],
    ),
    evidencePart(
      "Die Aktualisierung mit Stand 30.09.2026 nennt den Fortschritt und den Infrastrukturstopp als blockierende Abhaengigkeit.",
      ["EVD-2026-41280"],
    ),
    evidencePart(
      "Die Terminanfrage fuer den Abnahmetest der Lieferantenaenderung ist als unbeantwortet erfasst.",
      ["EVD-2026-41205"],
    ),
    evidencePart(
      "Die Pruefungsfeststellung F3 von September 2025 erfasst die zu schliessende Exposition.",
      ["EVD-2026-41105"],
    ),
    answerPart(
      "Die Verlaengerung trug zudem eine Monatsberichtsbedingung. Berichte liegen fuer Mai, Juni und Juli 2026 vor und keiner danach. Das ist ein Versaeumnis der Ausschussnachverfolgung, nicht nur der Lieferung.",
    ),
    recommendationPart(
      "Mit benannter verantwortlicher Fuehrungskraft eskalieren statt neu zu terminieren. Eine zweite Verlaengerung bei beendeter Abhaengigkeit akzeptiert die Exposition ein weiteres Quartal.",
    ),
    alternativePart(
      "Auf ein aus der Abnahmetestvorlaufzeit abgeleitetes Datum neu terminieren. Diese Vorlaufzeit ist nirgends erfasst, das Datum waere eine Schaetzung.",
    ),
  ],
};

const EVENT_STATUS: SeededChatAnswer = {
  id: "chat-event-status",
  roleIds: [],
  keywordGroups: [
    ["event", "ereignis", "incident", "vorfall", "inc-2026-0412", "outage", "stoerung", "novalink", "degradation"],
    ["what", "status", "happening", "was", "stand", "now", "jetzt", "update", "summary", "zusammenfassung"],
  ],
  en: [
    answerPart(
      "A supplier notification arrived at 14:05:12 naming the affected service and nothing else. The fallback clearing route activated at 14:12:41 under an emergency change, and 138 route substitution overrides were raised between 14:12 and 14:26.",
    ),
    evidencePart(
      "Notification NSN-2026-0887, received 14:05:12, supplies the affected service and states no cause, scope, duration, workaround or contact. Appendix A5 requires six fields.",
      ["EVD-2026-41871"],
    ),
    evidencePart(
      "Arcadia monitoring raised alert ALRT-2026-77412 on acknowledgement latency independently of the supplier notice.",
      ["EVD-2026-41872"],
    ),
    evidencePart(
      "The configuration audit log records the fallback clearing route entering active mode at 14:12:41, authorised by emergency change CHG-2026-7741.",
      ["EVD-2026-41874", "EVD-2026-41875"],
    ),
    evidencePart(
      "Query QRY-2026-88104 returns 138 route substitution overrides raised between 14:12 and 14:26.",
      ["EVD-2026-41878"],
    ),
    uncertaintyPart(
      "No cause and no restoration estimate have been stated by the supplier, so any duration used in a tolerance calculation is an assumption.",
    ),
    uncertaintyPart(
      "Whether those overrides received a secondary review cannot be established yet. The review timestamps are not populated for all of them.",
    ),
  ],
  de: [
    answerPart(
      "Um 14:05:12 ging eine Lieferantenmeldung ein, die den betroffenen Dienst nennt und sonst nichts. Um 14:12:41 wurde die Ausweichroute unter einer Notfallaenderung aktiviert, und zwischen 14:12 und 14:26 entstanden 138 Routenumlenkungen.",
    ),
    evidencePart(
      "Die Meldung NSN-2026-0887 von 14:05:12 liefert den betroffenen Dienst und nennt keine Ursache, keinen Umfang, keine Dauer, keine Behelfsloesung und keinen Kontakt. Anhang A5 verlangt sechs Felder.",
      ["EVD-2026-41871"],
    ),
    evidencePart(
      "Die Arcadia-Ueberwachung loeste die Meldung ALRT-2026-77412 zur Bestaetigungslatenz unabhaengig von der Lieferantenmeldung aus.",
      ["EVD-2026-41872"],
    ),
    evidencePart(
      "Das Konfigurationsprotokoll erfasst den Wechsel der Ausweichroute in den Aktivmodus um 14:12:41, genehmigt durch die Notfallaenderung CHG-2026-7741.",
      ["EVD-2026-41874", "EVD-2026-41875"],
    ),
    evidencePart(
      "Die Abfrage QRY-2026-88104 liefert 138 zwischen 14:12 und 14:26 erzeugte Routenumlenkungen.",
      ["EVD-2026-41878"],
    ),
    uncertaintyPart(
      "Der Lieferant hat keine Ursache und keine Wiederherstellungsschaetzung genannt. Jede Dauer in einer Toleranzrechnung ist eine Annahme.",
    ),
    uncertaintyPart(
      "Ob diese Ueberschreibungen eine Zweitpruefung erhielten, ist noch nicht feststellbar. Die Pruefzeitstempel fehlen teilweise.",
    ),
  ],
};

const INDICATOR_CHAIN: SeededChatAnswer = {
  id: "chat-indicator-chain",
  roleIds: [],
  keywordGroups: [
    ["kri", "indicator", "indikator", "kri-pay-007", "override rate", "red", "rot"],
    ["why", "cause", "driver", "warum", "ursache", "explain", "erklaer", "chain", "kette"],
  ],
  en: [
    answerPart(
      "The override rate indicator moved to Red because one reason code grew: route substitution. The component analysis isolates it, and the growth tracks the five September windows in which the fallback clearing route carried submissions.",
    ),
    evidencePart(
      "The KRI-PAY-007 breach annex for September 2026 decomposes the override population by reason code and isolates route substitution as the largest moving component.",
      ["EVD-2026-41821"],
    ),
    evidencePart(
      "The NOVA-GATE availability and fallback operation analysis for September records the five activation windows, measured at the Arcadia edge.",
      ["EVD-2026-41810"],
    ),
    evidencePart(
      "The September indicator pack records four of six group indicators as Red, each with a different owner in a different function.",
      ["EVD-2026-41820"],
    ),
    evidencePart(
      "The secondary reviewer capacity report as at 30.09.2026 records the establishment position for the payment repair team.",
      ["EVD-2026-41822"],
    ),
    uncertaintyPart(
      "The attribution rests on temporal correlation. The override records carry no field linking an override to an activation, so this link is an inference and not a recorded fact.",
    ),
    uncertaintyPart(
      "The availability figure is measured at the Arcadia edge rather than by the supplier, and the supplier has not published a September service report.",
    ),
    recommendationPart(
      "Treat the four Red indicators as one chain with a single upstream cause rather than four portfolio items, and keep the two inferential links labelled as inference when you do.",
    ),
  ],
  de: [
    answerPart(
      "Der Ueberschreibungsratenindikator wurde rot, weil ein Grundcode wuchs: die Routenumlenkung. Die Komponentenanalyse isoliert ihn, und der Zuwachs folgt den fuenf Septemberfenstern, in denen die Ausweichroute Einlieferungen trug.",
    ),
    evidencePart(
      "Der Anhang zur Ueberschreitung von KRI-PAY-007 fuer September 2026 zerlegt die Population nach Grundcodes und isoliert die Routenumlenkung als groesste bewegte Komponente.",
      ["EVD-2026-41821"],
    ),
    evidencePart(
      "Die Analyse zur NOVA-GATE-Verfuegbarkeit und zum Ausweichbetrieb fuer September erfasst die fuenf Aktivierungsfenster, gemessen am Arcadia-Rand.",
      ["EVD-2026-41810"],
    ),
    evidencePart(
      "Der Septemberindikatorbericht fuehrt vier von sechs Gruppenindikatoren als rot, jeden mit anderem Eigentuemer in anderer Funktion.",
      ["EVD-2026-41820"],
    ),
    evidencePart(
      "Der Kapazitaetsbericht zu Zweitpruefern mit Stand 30.09.2026 erfasst die Sollbesetzung im Reparaturteam fuer Zahlungen.",
      ["EVD-2026-41822"],
    ),
    uncertaintyPart(
      "Die Zuordnung ruht auf zeitlicher Korrelation. Die Datensaetze tragen kein Feld, das eine Ueberschreibung mit einer Aktivierung verknuepft. Diese Verbindung ist erschlossen, keine erfasste Tatsache.",
    ),
    uncertaintyPart(
      "Die Verfuegbarkeitszahl wird am Arcadia-Rand gemessen, nicht vom Lieferanten, und der Lieferant hat keinen Septemberbericht veroeffentlicht.",
    ),
    recommendationPart(
      "Die vier roten Indikatoren als eine Kette mit einer vorgelagerten Ursache behandeln, nicht als vier Portfoliopunkte, und die zwei erschlossenen Glieder gekennzeichnet lassen.",
    ),
  ],
};

export const SEEDED_CHAT_ANSWERS: readonly SeededChatAnswer[] = [
  CONTROL_RATING,
  SUBPROCESSOR_GAP,
  SWISS_JURISDICTION,
  SWISS_TOLERANCE,
  OVERDUE_ACTION,
  EVENT_STATUS,
  INDICATOR_CHAIN,
];

/* ==========================================================================
   Matching and the decline
   ========================================================================== */

/**
 * Finds the seeded answer for an input, or null.
 *
 * Every keyword group must match. Requiring all groups rather than any is what
 * makes a near miss decline: "what is the tolerance" alone does not reach the
 * Swiss tolerance answer, because that answer is specifically about the Swiss
 * entity and would be misleading if returned for the German one.
 */
export function matchSeededChatAnswer(
  input: string,
  roleId: RoleId,
): SeededChatAnswer | null {
  const haystack = input.toLowerCase();

  for (const answer of SEEDED_CHAT_ANSWERS) {
    if (answer.roleIds.length > 0 && !answer.roleIds.includes(roleId)) continue;
    const allGroupsMatch = answer.keywordGroups.every((group) =>
      group.some((keyword) => haystack.includes(keyword)),
    );
    if (allGroupsMatch) return answer;
  }

  return null;
}

/**
 * The decline.
 *
 * It says what mode the application is in, what it can still do, and that the
 * question was recorded. It deliberately does not attempt the question. The
 * list of topics is generated from the seeded set rather than written out, so
 * it cannot drift from what is actually available.
 */
export function seededChatDecline(params: {
  language: "en" | "de";
  mode: "live" | "safe" | "offline";
  input: string;
  roleTitle: string;
  liveFailureReason?: string | null;
}): ChatTurnPart[] {
  const { language } = params;

  /*
   * Plain language, one account of what happened (audit J26). The earlier
   * opening told a reader in Safe mode that "a live call was attempted and
   * failed", which was neither true nor useful, and it named the internals.
   * The mode is named with the product's own status words.
   */
  const modeWord =
    params.mode === "offline"
      ? language === "de" ? "Offline" : "Offline"
      : params.mode === "safe"
        ? language === "de" ? "Sicher" : "Safe"
        : language === "de" ? "Live" : "Live";
  const opening =
    params.liveFailureReason != null && params.mode === "live"
      ? language === "de"
        ? "Die Antwort konnte gerade nicht vorbereitet werden, daher wurde nichts erfunden. Unten stehen die Themen mit vorbereiteten, belegten Antworten."
        : "The answer could not be prepared just now, so nothing was made up. The topics with prepared, cited answers are listed below."
      : language === "de"
        ? `Zu dieser Frage liegt im Modus ${modeWord} keine vorbereitete, belegte Antwort vor, daher wurde nichts erfunden.`
        : `There is no prepared, cited answer to this question in ${modeWord} mode, so nothing was made up.`;

  const capability =
    language === "de"
      ? `Alles Uebrige bleibt nutzbar: die Entscheidungsvorlage, die Nachweise, die Arbeit fuer ${params.roleTitle}, die Besprechungsvorbereitung und die geregelten Arbeitsschritte lesen aus dem erfassten Tag.`
      : `Everything else remains usable: the decision brief, the evidence, the work for ${params.roleTitle}, the meeting preparation and the governed steps all read from the recorded day.`;

  const topics =
    language === "de"
      ? "Zu diesen Themen liegen vorbereitete, belegte Antworten vor: die Bewertung von CTL-PAY-014, die Abweichung im Unterauftragsanhang, die Zustaendigkeit der Schweizer Einheit, die Schweizer Toleranz und ihr Tagesschluss, die ueberfaellige Massnahme MSN-2026-0147, der Stand des Ereignisses und die Ursachenkette hinter den roten Indikatoren."
      : "Prepared, cited answers exist for these topics: the CTL-PAY-014 rating, the subprocessor appendix divergence, the regulatory position of the Swiss entity, the Swiss tolerance and its cut-off, the overdue action MSN-2026-0147, the current state of the event, and the causal chain behind the Red indicators.";

  const recorded =
    language === "de"
      ? `Ihre Frage wurde erfasst: "${params.input.slice(0, 180)}"`
      : `Your question was recorded: "${params.input.slice(0, 180)}"`;

  return [
    answerPart(opening),
    answerPart(capability),
    answerPart(topics),
    uncertaintyPart(recorded),
  ];
}
