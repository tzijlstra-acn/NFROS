/**
 * Interface copy for the six role workspaces.
 *
 * Every string a user can see has an English and a German form. German is
 * written in ASCII transliteration, "ae", "oe", "ue" and "ss", for the same
 * reason the rest of the codebase is: seeded content, exports and this
 * interface all pass through tooling where a mis-set encoding turns an umlaut
 * into mojibake silently, and a demonstration that renders "Pruefung" is
 * better than one that renders a replacement character.
 *
 * No model name, no provider name and no vendor branding appears anywhere in
 * this file, and none may be added. The product refers to what it does, so the
 * labels say "prepared", "checked" and "suggested" rather than naming anything
 * that produced the suggestion.
 *
 * No regulatory framework is named here either. Framework labels are
 * jurisdiction bound, the jurisdictions in this scenario are not the same, and
 * a shared label file is exactly the wrong place to put a string that is only
 * true for some entities. Where a workspace shows a regulatory reference it
 * takes the wording from the record and attaches the `RegulatoryNote`
 * primitive.
 */

import type { RoleId } from "@/db/schema/core";
import type { Language } from "@/i18n/labels";
import type { RoleWorkspaceView } from "@/db/repositories/workspace";

export interface LabelPair {
  en: string;
  de: string;
}

/** Picks a side of a pair. Mirrors `pick` in the contracts module. */
export function ws(pair: LabelPair, language: Language): string {
  return language === "de" ? pair.de : pair.en;
}

/* ==========================================================================
   Shared across every workspace
   ========================================================================== */

export const WS_SHARED = {
  unavailable: {
    en: "This work object is not available in this run",
    de: "Dieses Arbeitsobjekt ist in diesem Lauf nicht verfuegbar",
  },
  unavailableDetail: {
    en: "The view model was not supplied to this workspace, or the scenario holds no subject for this role.",
    de: "Das Ansichtsmodell wurde nicht uebergeben, oder das Szenario enthaelt kein Subjekt fuer diese Rolle.",
  },
  changedRecently: { en: "Changed recently", de: "Kuerzlich geaendert" },
  whatChanged: { en: "What changed", de: "Was sich geaendert hat" },
  nothingChanged: {
    en: "Nothing has changed in the last two hours",
    de: "In den letzten zwei Stunden hat sich nichts geaendert",
  },
  selection: { en: "Selected", de: "Ausgewaehlt" },
  nothingSelected: {
    en: "Select an object to see what it affects",
    de: "Waehlen Sie ein Objekt, um dessen Auswirkungen zu sehen",
  },
  askAboutThis: { en: "Ask about this", de: "Dazu nachfragen" },
  clearSelection: { en: "Clear selection", de: "Auswahl aufheben" },
  context: { en: "Context", de: "Kontext" },
  upstream: { en: "Upstream", de: "Vorgelagert" },
  downstream: { en: "Downstream", de: "Nachgelagert" },
  noConsequences: {
    en: "Nothing recorded on either side of this object",
    de: "Auf keiner Seite dieses Objekts ist etwas erfasst",
  },
  suggestion: { en: "Prepared suggestion", de: "Vorbereiteter Vorschlag" },
  openSuggestion: { en: "Open the suggestion", de: "Vorschlag oeffnen" },
  recommended: { en: "Recommended", de: "Empfohlen" },
  uncertainty: { en: "Stated uncertainty", de: "Angegebene Unsicherheit" },
  loading: { en: "Loading the work object", de: "Arbeitsobjekt wird geladen" },
  events: { en: "Arrived for this object", de: "Fuer dieses Objekt eingetroffen" },
} satisfies Record<string, LabelPair>;

/* ==========================================================================
   Per role
   ========================================================================== */

export const WS_RCSA = {
  graph: { en: "Process, risk and control", de: "Prozess, Risiko und Kontrolle" },
  affected: { en: "Affected by a new signal", de: "Von einem neuen Signal betroffen" },
  effectiveness: { en: "Control effectiveness", de: "Kontrollwirksamkeit" },
  recorded: { en: "Recorded", de: "Erfasst" },
  firstLine: { en: "First line", de: "Erste Linie" },
  bandsApart: { en: "bands apart", de: "Stufen auseinander" },
  keyControl: { en: "Key control", de: "Schluesselkontrolle" },
  assessmentChanges: {
    en: "Changed since the previous version",
    de: "Seit der Vorversion geaendert",
  },
  noAssessmentChange: {
    en: "No line differs from the previous version",
    de: "Keine Zeile weicht von der Vorversion ab",
  },
  consequences: {
    en: "What this object affects",
    de: "Was dieses Objekt beeinflusst",
  },
  askPrompt: {
    en: "What changed about this object today, and what does it affect?",
    de: "Was hat sich heute an diesem Objekt geaendert und was beeinflusst es?",
  },
} satisfies Record<string, LabelPair>;

export const WS_TPRM = {
  constellation: {
    en: "Supplier and fourth party exposure",
    de: "Exponierung gegenueber Lieferanten und Viertparteien",
  },
  monitoringChanges: { en: "Monitoring changes", de: "Aenderungen der Ueberwachung" },
  noMonitoring: {
    en: "No monitoring has been switched on for this arrangement",
    de: "Fuer diese Vereinbarung wurde keine Ueberwachung aktiviert",
  },
  affectedNodes: {
    en: "Reached by the event",
    de: "Vom Ereignis erreicht",
  },
  evidenceChecked: { en: "What was checked", de: "Was geprueft wurde" },
  allEvidenced: {
    en: "Every contractual obligation in scope is evidenced",
    de: "Jede vertragliche Pflicht im Umfang ist nachgewiesen",
  },
  approvalConditions: { en: "Approval conditions", de: "Genehmigungsbedingungen" },
  noConditions: {
    en: "No open condition is attached to this arrangement",
    de: "Dieser Vereinbarung ist keine offene Bedingung angehaengt",
  },
  unowned: { en: "no owner recorded", de: "kein Eigentuemer erfasst" },
  due: { en: "due", de: "faellig" },
  reviewEvery: { en: "reviewed", de: "Pruefung" },
  activatedThisSession: {
    en: "switched on in this session",
    de: "in dieser Sitzung aktiviert",
  },
  askPrompt: {
    en: "What has changed about this supplier chain, and what is not evidenced?",
    de: "Was hat sich an dieser Lieferkette geaendert und was ist nicht nachgewiesen?",
  },
} satisfies Record<string, LabelPair>;

export const WS_ASSURANCE = {
  population: { en: "Full population", de: "Gesamtpopulation" },
  newCases: { en: "New in the population", de: "Neu in der Population" },
  noNewCases: {
    en: "No case has entered the population since the test began",
    de: "Seit Beginn der Pruefung ist kein Fall in die Population gekommen",
  },
  whySelected: { en: "Why this case was selected", de: "Warum dieser Fall ausgewaehlt wurde" },
  classification: { en: "Classification progress", de: "Fortschritt der Klassifizierung" },
  classified: { en: "classified", de: "klassifiziert" },
  unclassified: { en: "still unclassified", de: "noch nicht klassifiziert" },
  inSample: { en: "in the sample", de: "in der Stichprobe" },
  notInSample: { en: "not drawn", de: "nicht gezogen" },
  fallbackRoute: { en: "from the fallback route", de: "aus der Ausweichroute" },
  noReviewEvidence: {
    en: "no secondary review evidenced",
    de: "keine Zweitpruefung nachgewiesen",
  },
  relatedControl: { en: "The control under test", de: "Die gepruefte Kontrolle" },
  openInRcsa: {
    en: "Open this control in the risk and control view",
    de: "Diese Kontrolle in der Risiko- und Kontrollansicht oeffnen",
  },
  compare: { en: "Compare", de: "Vergleichen" },
  askPrompt: {
    en: "Why was this case selected, and how does it compare with the rest of the population?",
    de: "Warum wurde dieser Fall ausgewaehlt und wie verhaelt er sich zur uebrigen Population?",
  },
} satisfies Record<string, LabelPair>;

export const WS_INCIDENT = {
  map: { en: "Service dependency", de: "Dienstabhaengigkeit" },
  pulse: { en: "The event path", de: "Der Ereignispfad" },
  noPulse: {
    en: "No edge in scope carries the event",
    de: "Keine Kante im Umfang traegt das Ereignis",
  },
  chronology: { en: "Chronology", de: "Chronologie" },
  conflicts: { en: "conflicting account", de: "widerspruechliche Aussage" },
  tolerance: { en: "Remaining tolerance", de: "Verbleibende Toleranz" },
  noTolerance: {
    en: "No approved tolerance covers the services in scope",
    de: "Keine genehmigte Toleranz deckt die Dienste im Umfang ab",
  },
  options: { en: "Prepared options", de: "Vorbereitete Optionen" },
  noOptions: {
    en: "No recovery option is recorded for this event",
    de: "Fuer dieses Ereignis ist keine Wiederherstellungsoption erfasst",
  },
  tradeOff: { en: "Trade off", de: "Abwaegung" },
  minutes: { en: "minutes to restore", de: "Minuten bis zur Wiederherstellung" },
  decision: { en: "The material decision", de: "Die wesentliche Entscheidung" },
  openDecision: { en: "Open the decision", de: "Entscheidung oeffnen" },
  askPrompt: {
    en: "What does the event reach, and how much tolerance is left?",
    de: "Was erreicht das Ereignis und wie viel Toleranz bleibt?",
  },
} satisfies Record<string, LabelPair>;

export const WS_REGULATORY = {
  lineage: { en: "Source to obligation to control", de: "Von der Quelle zur Pflicht zur Kontrolle" },
  euLane: { en: "European Union lane", de: "Spur Europaeische Union" },
  chLane: { en: "Swiss lane", de: "Spur Schweiz" },
  newlyExtracted: { en: "Newly extracted", de: "Neu extrahiert" },
  noneNew: {
    en: "Every extracted obligation has been interpreted",
    de: "Jede extrahierte Pflicht wurde ausgelegt",
  },
  missingOwners: { en: "No owner named", de: "Kein Eigentuemer benannt" },
  allOwned: {
    en: "Every obligation in scope has a named owner",
    de: "Jede Pflicht im Umfang hat einen benannten Eigentuemer",
  },
  /*
   * The central distinction of this role. Extraction is machine reading;
   * interpretation is a named person deciding what the text means for a named
   * entity. The two labels are deliberately in the passive and the active
   * voice respectively, because the difference between them is who is
   * accountable.
   */
  extraction: { en: "Extracted from the text", de: "Aus dem Text extrahiert" },
  extractionNote: {
    en: "Machine reading of the paragraph. Not a position.",
    de: "Maschinelle Lesung des Absatzes. Keine Position.",
  },
  interpretation: { en: "Interpreted by a person", de: "Von einer Person ausgelegt" },
  interpretationNote: {
    en: "The institution's position. Only a named person can set it.",
    de: "Die Position des Instituts. Nur eine benannte Person kann sie festlegen.",
  },
  notInterpreted: { en: "Not yet interpreted", de: "Noch nicht ausgelegt" },
  confidence: { en: "extraction confidence", de: "Extraktionskonfidenz" },
  candidateScope: { en: "Proposed scope", de: "Vorgeschlagener Umfang" },
  decidedBy: { en: "decided by", de: "entschieden von" },
  askPrompt: {
    en: "What does this paragraph require, and which entity would it apply to?",
    de: "Was fordert dieser Absatz und fuer welche Einheit wuerde er gelten?",
  },
} satisfies Record<string, LabelPair>;

export const WS_GOVERNANCE = {
  thread: { en: "One matter, one thread", de: "Eine Sache, ein Strang" },
  crossFunction: { en: "Changes across the functions", de: "Aenderungen ueber die Funktionen" },
  noCrossFunction: {
    en: "No function has recorded a change in the last two hours",
    de: "Keine Funktion hat in den letzten zwei Stunden eine Aenderung erfasst",
  },
  owners: { en: "Decisions and owners", de: "Entscheidungen und Eigentuemer" },
  noOwners: {
    en: "No decision on this thread is visible at this moment",
    de: "Zu diesem Zeitpunkt ist keine Entscheidung dieses Strangs sichtbar",
  },
  duplicateReports: { en: "separate reports today", de: "separate Berichte heute" },
  oneThread: { en: "one decision thread", de: "ein Entscheidungsstrang" },
  lens: { en: "Open the lens", de: "Sichtweise oeffnen" },
  askPrompt: {
    en: "Which functions have moved on this matter, and who owns the open decisions?",
    de: "Welche Funktionen haben sich bei dieser Sache bewegt und wer verantwortet die offenen Entscheidungen?",
  },
} satisfies Record<string, LabelPair>;

/* ==========================================================================
   View narrowing
   ========================================================================== */

/**
 * Narrows the workspace view to the kind a component can render.
 *
 * The shell passes one uniform prop bag so the lookup table stays a plain
 * record, which means every component receives the union and has to narrow it.
 * Returning null rather than throwing is deliberate: a role whose subject the
 * seed does not contain should render an empty state, not take the page down.
 */
export function narrowView<K extends RoleWorkspaceView["kind"]>(
  view: RoleWorkspaceView | undefined,
  kind: K,
): Extract<RoleWorkspaceView, { kind: K }> | null {
  if (!view || view.kind !== kind) return null;
  return view as Extract<RoleWorkspaceView, { kind: K }>;
}

/** The route a role's own objects live on, for a cross role link. */
export function roleHref(roleId: RoleId, objectType: string, objectId: string): string {
  return `/workday/${roleId}?select=${objectType}:${objectId}`;
}
