/**
 * Copy for the Quality section, in English and German (ASCII
 * transliteration). Kept beside the section, as the console shell asks.
 */

import type { AIFeedbackKind } from "@/db/schema/ai-partner";

type Pair = { en: string; de: string };

export const MODE_LABELS: Record<string, Pair> = {
  structural: { en: "Offline: structural envelopes", de: "Offline: strukturelle Testhuellen" },
  grounding: { en: "Safe: reviewed responses", de: "Sicher: gepruefte Antworten" },
  live: { en: "Live", de: "Live" },
  golden: { en: "Golden scenario", de: "Golden-Szenario" },
  release: { en: "Release suite", de: "Release-Suite" },
};

export const FEEDBACK_KIND_LABELS: Record<AIFeedbackKind, Pair> = {
  useful: { en: "Useful", de: "Hilfreich" },
  "not-useful": { en: "Not useful", de: "Nicht hilfreich" },
  "wrong-source": { en: "Wrong source", de: "Falsche Quelle" },
  "wrong-interpretation": { en: "Wrong interpretation", de: "Falsche Auslegung" },
  "missing-context": { en: "Missing context", de: "Fehlender Kontext" },
  "too-verbose": { en: "Too verbose", de: "Zu ausfuehrlich" },
};

export const QUALITY_COPY = {
  title: { en: "Quality", de: "Qualitaet" },
  lede: {
    en: "The AI configuration in force for each role and task, any candidate, what their evaluations measured, and what people did with the AI's suggestions. A configuration cannot be released while a mandatory evaluation fails.",
    de: "Die geltende KI-Konfiguration je Rolle und Aufgabe, jeder Kandidat, was ihre Evaluationen gemessen haben und was Menschen mit den Vorschlaegen der KI gemacht haben. Eine Konfiguration kann nicht freigegeben werden, solange eine Pflichtevaluation fehlschlaegt.",
  },
  unavailable: {
    en: "The evaluation records could not be read, so nothing is shown. Run npm run db:migrate and npm run demo:reset.",
    de: "Die Evaluationsdatensaetze konnten nicht gelesen werden, daher wird nichts gezeigt. Fuehren Sie npm run db:migrate und npm run demo:reset aus.",
  },
  noModel: {
    en: "The console never calls a model. Offline grades a synthetic envelope built from each case, which proves the graders and cases agree. Safe grades what the product itself answers without a model: the authority gate's decision or a reviewed answer. Cases no reviewed answer covers are recorded as not run.",
    de: "Die Konsole ruft nie ein Modell auf. Offline bewertet eine synthetische Testhuelle je Fall und belegt, dass Bewerter und Faelle zusammenpassen. Sicher bewertet, was das Produkt selbst ohne Modell antwortet: die Entscheidung der Berechtigungspruefung oder eine gepruefte Antwort. Faelle ohne gepruefte Antwort werden als nicht ausgefuehrt erfasst.",
  },
  noInForce: { en: "No released configuration exists for this role and task.", de: "Fuer diese Rolle und Aufgabe gibt es keine freigegebene Konfiguration." },
  noCandidate: { en: "No candidate configuration is open for this role and task.", de: "Fuer diese Rolle und Aufgabe ist keine Kandidatenkonfiguration offen." },
  candidate: { en: "Candidate", de: "Kandidat" },
  inForce: { en: "In force", de: "Geltend" },
  identity: { en: "Prompt, model profile, schema, suite", de: "Prompt, Modellprofil, Schema, Suite" },
  identityNote: {
    en: "The values an evaluation run records. A run of other values is not evidence for this configuration.",
    de: "Die Werte, die ein Evaluationslauf erfasst. Ein Lauf mit anderen Werten ist kein Nachweis fuer diese Konfiguration.",
  },
  basis: { en: "Release basis", de: "Grundlage der Freigabe" },
  basisRegistry: { en: "Released in the code registry.", de: "Im Code-Verzeichnis freigegeben." },
  basisApproved: { en: "Approved in the console by {by} on {at}.", de: "In der Konsole genehmigt von {by} am {at}." },
  basisCandidate: { en: "A candidate in the code registry. Not released.", de: "Ein Kandidat im Code-Verzeichnis. Nicht freigegeben." },
  lastRejected: { en: "Rejected by {by} on {at}.", de: "Abgelehnt von {by} am {at}." },
  lastApproved: { en: "Approved by {by} on {at} and later rolled back.", de: "Genehmigt von {by} am {at} und spaeter zurueckgesetzt." },
  runtimeNote: {
    en: "A release decision is recorded here. The workday's process definitions still name their configuration in code; reading the configuration in force at run time is outstanding.",
    de: "Eine Freigabeentscheidung wird hier erfasst. Die Prozessdefinitionen des Arbeitstags nennen ihre Konfiguration weiterhin im Code; das Lesen der geltenden Konfiguration zur Laufzeit steht noch aus.",
  },
  gate: { en: "Release gate", de: "Freigabepruefung" },
  blocked: { en: "Release blocked", de: "Freigabe gesperrt" },
  gatePassed: { en: "Release gate passed", de: "Freigabepruefung bestanden" },
  notEvaluated: { en: "Not evaluated yet. Run an evaluation to record one.", de: "Noch nicht evaluiert. Fuehren Sie eine Evaluation aus, um eine zu erfassen." },
  runEvaluation: { en: "Run evaluation", de: "Evaluation ausfuehren" },
  mode: { en: "Mode", de: "Modus" },
  approve: { en: "Approve candidate", de: "Kandidat freigeben" },
  reject: { en: "Reject candidate", de: "Kandidat ablehnen" },
  rejectReason: { en: "Reason for rejecting", de: "Begruendung der Ablehnung" },
  rollBack: { en: "Roll back", de: "Zuruecksetzen" },
  latestRun: { en: "Latest run", de: "Letzter Lauf" },
  exportEvidence: { en: "Export evidence", de: "Nachweise exportieren" },
  coverage: { en: "Evaluation coverage", de: "Abdeckung der Evaluation" },
  coverageValue: { en: "{graded} of {total} cases graded, {notRun} not run", de: "{graded} von {total} Faellen bewertet, {notRun} nicht ausgefuehrt" },
  mandatoryValue: { en: "Mandatory cases: {total}, {failed} failed, {notRun} not run", de: "Pflichtfaelle: {total}, {failed} fehlgeschlagen, {notRun} nicht ausgefuehrt" },
  grounding: { en: "Grounding failures", de: "Fehler bei der Fundierung" },
  citations: { en: "Citation failures", de: "Fehler bei Zitaten" },
  requiredSources: { en: "Required-source failures", de: "Fehler bei Pflichtquellen" },
  authority: { en: "Authority refusals", de: "Verweigerungen der Berechtigungspruefung" },
  authorityValue: {
    en: "{refused} output(s) refused by the authority gate; {failures} authority failure(s) in {graded} graded case(s)",
    de: "{refused} Ausgabe(n) von der Berechtigungspruefung verweigert; {failures} Berechtigungsfehler in {graded} bewerteten Faellen",
  },
  german: { en: "German-language results", de: "Ergebnisse auf Deutsch" },
  germanValue: { en: "{cases} German case(s): {graded} graded, {failed} failed", de: "{cases} deutsche Faelle: {graded} bewertet, {failed} fehlgeschlagen" },
  languageGrader: { en: "Language grading", de: "Sprachbewertung" },
  latency: { en: "Latency", de: "Latenz" },
  cost: { en: "Cost", de: "Kosten" },
  notMeasuredNoModel: {
    en: "Not measured in safe mode: no model was called in this run.",
    de: "Im sicheren Modus nicht gemessen: In diesem Lauf wurde kein Modell aufgerufen.",
  },
  notMeasuredMode: { en: "Not measured in this mode", de: "In diesem Modus nicht gemessen" },
  failedOfGraded: { en: "{failed} of {graded} graded case(s) failed", de: "{failed} von {graded} bewerteten Faellen fehlgeschlagen" },
  recentRuns: { en: "Evaluation runs", de: "Evaluationslaeufe" },
  noRuns: { en: "No evaluation run is recorded", de: "Kein Evaluationslauf erfasst" },
  noRunsDetail: {
    en: "Run an evaluation above. Each run records every case with its grader results.",
    de: "Fuehren Sie oben eine Evaluation aus. Jeder Lauf erfasst jeden Fall mit seinen Bewertungen.",
  },
  runTally: { en: "{passed} passed, {failed} failed, {notRun} not run, {mandatory} mandatory failed", de: "{passed} bestanden, {failed} fehlgeschlagen, {notRun} nicht ausgefuehrt, {mandatory} Pflichtfaelle fehlgeschlagen" },
  decisions: { en: "Release decisions", de: "Freigabeentscheidungen" },
  approved: { en: "Approved", de: "Genehmigt" },
  rejected: { en: "Rejected", de: "Abgelehnt" },
  rolledBack: { en: "Rolled back", de: "Zurueckgesetzt" },
  people: { en: "User rejection, modification and feedback", de: "Ablehnung, Aenderung und Rueckmeldungen der Nutzer" },
  peopleNote: {
    en: "Aggregates for each role from the suggestion lifecycle and the structured AI feedback. No person is named or ranked.",
    de: "Aggregate je Rolle aus dem Lebenszyklus der Vorschlaege und den strukturierten KI-Rueckmeldungen. Keine Person wird genannt oder bewertet.",
  },
  suggestionsAndFeedback: { en: "Suggestions and feedback", de: "Vorschlaege und Rueckmeldungen" },
  userRejection: { en: "User rejection", de: "Ablehnung durch Nutzer" },
  userModification: { en: "User modification", de: "Aenderung durch Nutzer" },
  ofDecided: { en: "{count} of {decided} decided suggestion(s)", de: "{count} von {decided} entschiedenen Vorschlaegen" },
  notMeasuredDecided: {
    en: "Not measured: no suggestion has been accepted, modified or rejected yet.",
    de: "Nicht gemessen: Noch kein Vorschlag wurde angenommen, geaendert oder abgelehnt.",
  },
  userFeedback: { en: "User feedback", de: "Rueckmeldungen der Nutzer" },
  noFeedback: { en: "Empty: no AI feedback is recorded for this role.", de: "Leer: Fuer diese Rolle ist keine KI-Rueckmeldung erfasst." },
  feedbackInboxNote: {
    en: "Feedback is triaged in the feedback inbox.",
    de: "Rueckmeldungen werden im Eingang fuer Rueckmeldungen gesichtet.",
  },
  openInbox: { en: "Open the feedback inbox", de: "Eingang fuer Rueckmeldungen oeffnen" },
  /* ---- run page ---- */
  runTitle: { en: "Evaluation run", de: "Evaluationslauf" },
  backToQuality: { en: "Back to Quality", de: "Zurueck zu Qualitaet" },
  noSuchRun: { en: "There is no evaluation run with this identifier.", de: "Es gibt keinen Evaluationslauf mit dieser Kennung." },
  cases: { en: "Cases", de: "Faelle" },
  inspect: { en: "Inspect", de: "Pruefen" },
  input: { en: "Input", de: "Eingabe" },
  expected: { en: "Expected", de: "Erwartet" },
  actual: { en: "Actual output", de: "Tatsaechliche Ausgabe" },
  graders: { en: "Grader results", de: "Ergebnisse der Bewerter" },
  compare: { en: "Compare output", de: "Ausgaben vergleichen" },
  compareNote: {
    en: "The same case in the latest run of the same mode for every other configuration of this role and task.",
    de: "Derselbe Fall im letzten Lauf desselben Modus fuer jede andere Konfiguration dieser Rolle und Aufgabe.",
  },
  compareNone: {
    en: "No other configuration of this role and task has a run of this mode to compare with.",
    de: "Keine andere Konfiguration dieser Rolle und Aufgabe hat einen Lauf dieses Modus zum Vergleich.",
  },
  sameOutput: {
    en: "Identical output. Without a model call both configurations answer from the same reviewed responses; a difference of prompt or model profile shows only in a live run.",
    de: "Identische Ausgabe. Ohne Modellaufruf antworten beide Konfigurationen aus denselben geprueften Antworten; ein Unterschied in Prompt oder Modellprofil zeigt sich nur in einem Live-Lauf.",
  },
  differentOutput: { en: "The outputs differ.", de: "Die Ausgaben unterscheiden sich." },
  noOutput: { en: "No output: the case was not run.", de: "Keine Ausgabe: Der Fall wurde nicht ausgefuehrt." },
  outputSource: { en: "Output source", de: "Herkunft der Ausgabe" },
  caseFileNote: {
    en: "Input and expectations are read from the case file in evals/cases as it is now.",
    de: "Eingabe und Erwartungen stammen aus der Falldatei in evals/cases in ihrem jetzigen Stand.",
  },
  caseMissing: { en: "The case is no longer in the case files.", de: "Der Fall ist nicht mehr in den Falldateien." },
  notPermittedInspect: {
    en: "Choose a product-owner persona to inspect cases.",
    de: "Waehlen Sie eine Product-Owner-Persona, um Faelle zu pruefen.",
  },
  mandatory: { en: "Mandatory", de: "Pflicht" },
  expParts: { en: "Parts: {must}; never: {never}", de: "Teile: {must}; nie: {never}" },
  expSources: { en: "Required sources: {sources}", de: "Pflichtquellen: {sources}" },
  expCitations: { en: "Minimum sources cited: {count}", de: "Mindestanzahl zitierter Quellen: {count}" },
  expRefused: { en: "Must be refused: {action}", de: "Muss verweigert werden: {action}" },
  expLanguage: { en: "Language: {language}; terms: {terms}", de: "Sprache: {language}; Begriffe: {terms}" },
  expJurisdiction: {
    en: "DORA applies to: {dora}; not to: {notDora}; FINMA: {finma}",
    de: "DORA gilt fuer: {dora}; nicht fuer: {notDora}; FINMA: {finma}",
  },
  none: { en: "none", de: "keine" },
  regulatory: {
    en: "Illustrative regulatory context, not legal advice. The jurisdiction grader keeps DORA and the EBA guidelines to the EU entities in Germany and Austria, and FINMA to the Swiss entity.",
    de: "Illustrativer regulatorischer Kontext, keine Rechtsberatung. Der Jurisdiktionsbewerter ordnet DORA und die EBA-Leitlinien den EU-Einheiten in Deutschland und Oesterreich zu und die FINMA der Schweizer Einheit.",
  },
} as const;

export const OUTPUT_SOURCE_LABELS: Record<string, Pair> = {
  "structural-envelope": { en: "Synthetic structural envelope", de: "Synthetische strukturelle Testhuelle" },
  "authority-gate": { en: "Authority gate decision", de: "Entscheidung der Berechtigungspruefung" },
  "reviewed-answer": { en: "Reviewed safe-mode answer", de: "Gepruefte Antwort im sicheren Modus" },
};

export const CASE_STATUS_LABELS: Record<string, Pair & { tone: "success" | "danger" | "neutral" }> = {
  passed: { en: "Passed", de: "Bestanden", tone: "success" },
  failed: { en: "Failed", de: "Fehlgeschlagen", tone: "danger" },
  "not-run": { en: "Not run", de: "Nicht ausgefuehrt", tone: "neutral" },
};
