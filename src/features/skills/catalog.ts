/**
 * The skills catalog: what a skill may read.
 *
 * A skill is a person's own reusable query over the records their role
 * already works with, built by describing it in a sentence. The catalog is
 * the whitelist that sentence is compiled onto: five sources, each with the
 * fields a skill may filter, sort or show, and the operators each field kind
 * accepts. Nothing outside this file can be named in a skill, so a skill can
 * never reach a table, a column or a role the catalog does not list.
 *
 * Every source is read through the workday repositories and narrowed to the
 * role's legal entity and the current scenario moment (`execute.ts`), the
 * same scope Search applies. A skill reads; it never changes a record.
 *
 * Synthetic institution and data. No umlauts, no em dashes.
 */

export interface Bilingual {
  en: string;
  de: string;
}

export const SKILL_SOURCES = ["suppliers", "evidence", "obligations", "incidents", "kris"] as const;
export type SkillSource = (typeof SKILL_SOURCES)[number];

export type SkillFieldKind = "text" | "enum" | "date" | "boolean" | "number";

export const SKILL_OPERATORS = [
  "is-any-of",
  "is",
  "contains",
  "within-next-days",
  "within-last-days",
  "older-than-days",
  "overdue",
] as const;
export type SkillOperator = (typeof SKILL_OPERATORS)[number];

/** The operators each field kind accepts. A number is shown, never filtered. */
export const OPERATORS_BY_KIND: Record<SkillFieldKind, readonly SkillOperator[]> = {
  text: ["contains"],
  enum: ["is-any-of"],
  date: ["within-next-days", "within-last-days", "older-than-days", "overdue"],
  boolean: ["is"],
  number: [],
};

export interface SkillFieldValue {
  id: string;
  label: Bilingual;
  /** Lower case words in a request that name this value, English and German. */
  synonyms: readonly string[];
}

export interface SkillField {
  id: string;
  label: Bilingual;
  kind: SkillFieldKind;
  /** Enum values, in the order a sort over this field uses. */
  values?: readonly SkillFieldValue[];
  sortable: boolean;
  /** Lower case words that mark this field in a request, for booleans. */
  synonyms?: readonly string[];
}

export interface SkillSourceDefinition {
  id: SkillSource;
  label: Bilingual;
  /** Lower case words in a request that name this source. */
  synonyms: readonly string[];
  /** What the source holds and how it is scoped, in one line. */
  scope: Bilingual;
  fields: readonly SkillField[];
  /** The text field a quoted name narrows. */
  nameField: string;
  /** The date field a time window in the request applies to. */
  primaryDate: string;
  defaultColumns: readonly string[];
  defaultSort: { field: string; direction: "asc" | "desc" };
}

const v = (id: string, en: string, de: string, synonyms: readonly string[]): SkillFieldValue => ({
  id,
  label: { en, de },
  synonyms,
});

export const SKILL_CATALOG: Readonly<Record<SkillSource, SkillSourceDefinition>> = Object.freeze({
  suppliers: {
    id: "suppliers",
    label: { en: "Suppliers", de: "Lieferanten" },
    synonyms: ["supplier", "suppliers", "vendor", "vendors", "third party", "third parties", "third-party", "provider", "providers", "lieferant", "lieferanten", "dienstleister", "drittpartei", "drittparteien"],
    scope: {
      en: "Suppliers contracted by your entity.",
      de: "Lieferanten, die Ihre Gesellschaft beauftragt hat.",
    },
    fields: [
      { id: "name", label: { en: "Supplier", de: "Lieferant" }, kind: "text", sortable: true },
      {
        id: "criticality",
        label: { en: "Criticality", de: "Kritikalitaet" },
        kind: "enum",
        sortable: true,
        values: [
          v("critical", "Critical", "Kritisch", ["critical", "kritisch", "kritische", "kritischen"]),
          v("important", "Important", "Wichtig", ["important", "wichtig", "wichtige", "wichtigen"]),
          v("standard", "Standard", "Standard", ["standard"]),
        ],
      },
      {
        id: "status",
        label: { en: "Relationship status", de: "Beziehungsstatus" },
        kind: "enum",
        sortable: true,
        values: [
          v("under-reassessment", "Under reassessment", "In Neubewertung", ["under reassessment", "reassessment", "being reassessed", "neubewertung"]),
          v("exit-planned", "Exit planned", "Ausstieg geplant", ["exit planned", "exit", "ausstieg"]),
          v("active", "Active", "Aktiv", ["active", "aktiv", "aktive"]),
        ],
      },
      { id: "nextAssessmentDue", label: { en: "Next assessment due", de: "Naechste Bewertung faellig" }, kind: "date", sortable: true },
      { id: "lastAssessmentDate", label: { en: "Last assessment", de: "Letzte Bewertung" }, kind: "date", sortable: true },
      { id: "isOutsourcing", label: { en: "Regulated outsourcing", de: "Regulierte Auslagerung" }, kind: "boolean", sortable: false, synonyms: ["outsourcing", "outsourced", "auslagerung", "auslagerungen"] },
    ],
    nameField: "name",
    primaryDate: "nextAssessmentDue",
    defaultColumns: ["name", "criticality", "status", "nextAssessmentDue"],
    defaultSort: { field: "nextAssessmentDue", direction: "asc" },
  },

  evidence: {
    id: "evidence",
    label: { en: "Evidence", de: "Nachweise" },
    synonyms: ["evidence", "document", "documents", "report", "reports", "certificate", "certificates", "soc 2", "soc2", "nachweis", "nachweise", "dokument", "dokumente", "bericht", "berichte", "zertifikat"],
    scope: {
      en: "Evidence documents for your entity that have arrived by the current moment.",
      de: "Nachweisdokumente Ihrer Gesellschaft, die bis zum aktuellen Zeitpunkt eingegangen sind.",
    },
    fields: [
      { id: "title", label: { en: "Document", de: "Dokument" }, kind: "text", sortable: true },
      {
        id: "sourceType",
        label: { en: "Type", de: "Art" },
        kind: "enum",
        sortable: true,
        values: [
          v("supplier-due-diligence", "Supplier due diligence", "Lieferanten-Due-Diligence", ["supplier due diligence", "vendor due diligence", "due diligence", "due-diligence", "soc 2", "soc2", "questionnaire", "fragebogen", "pen test", "penetration test"]),
          v("bcm-test", "Continuity test", "Kontinuitaetstest", ["continuity test", "bcm", "disaster recovery", "dr test", "recovery test", "notfalltest"]),
          v("subprocessor-list", "Subprocessor list", "Unterauftragnehmerliste", ["subprocessor", "subprocessors", "sub-processor", "unterauftragnehmer"]),
          v("contract-clause", "Contract clause", "Vertragsklausel", ["contract clause", "vertragsklausel"]),
          v("control-test-report", "Control test report", "Kontrolltestbericht", ["control test", "kontrolltest"]),
          v("control-description", "Control description", "Kontrollbeschreibung", ["control description", "kontrollbeschreibung"]),
          v("policy", "Policy", "Richtlinie", ["policy", "policies", "richtlinie"]),
          v("incident-notification", "Incident notification", "Vorfallmeldung", ["incident notification", "vorfallmeldung"]),
          v("kri-report", "Indicator report", "Indikatorbericht", ["kri report", "indicator report"]),
          v("remediation-update", "Remediation update", "Massnahmenstand", ["remediation update", "remediation"]),
        ],
      },
      {
        id: "status",
        label: { en: "Status", de: "Status" },
        kind: "enum",
        sortable: true,
        values: [
          v("missing", "Missing", "Fehlend", ["missing", "fehlend", "fehlende", "fehlt"]),
          v("requested", "Requested", "Angefordert", ["requested", "outstanding", "chased", "angefordert", "ausstehend"]),
          v("draft", "Draft", "Entwurf", ["draft", "drafts", "entwurf"]),
          v("current", "Current", "Aktuell", ["current", "aktuell", "aktuelle"]),
          v("superseded", "Superseded", "Ersetzt", ["superseded", "ersetzt"]),
        ],
      },
      { id: "isStale", label: { en: "Stale", de: "Veraltet" }, kind: "boolean", sortable: false, synonyms: ["stale", "outdated", "out of date", "expired", "veraltet", "veraltete", "abgelaufen"] },
      { id: "documentDate", label: { en: "Document date", de: "Dokumentdatum" }, kind: "date", sortable: true },
    ],
    nameField: "title",
    primaryDate: "documentDate",
    defaultColumns: ["title", "sourceType", "status", "documentDate"],
    defaultSort: { field: "documentDate", direction: "desc" },
  },

  obligations: {
    id: "obligations",
    label: { en: "Contract obligations", de: "Vertragspflichten" },
    synonyms: ["obligation", "obligations", "clause", "clauses", "contractual", "verpflichtung", "verpflichtungen", "vertragspflicht", "vertragspflichten", "klausel", "klauseln"],
    scope: {
      en: "Obligations in contracts your entity signed.",
      de: "Pflichten aus Vertraegen, die Ihre Gesellschaft unterzeichnet hat.",
    },
    fields: [
      { id: "supplierName", label: { en: "Supplier", de: "Lieferant" }, kind: "text", sortable: true },
      { id: "clauseReference", label: { en: "Clause", de: "Klausel" }, kind: "text", sortable: true },
      {
        id: "category",
        label: { en: "Category", de: "Kategorie" },
        kind: "enum",
        sortable: true,
        values: [
          v("resilience", "Resilience", "Resilienz", ["resilience", "resilienz"]),
          v("subprocessor", "Subprocessor", "Unterauftragnehmer", ["subprocessor", "sub-processor", "unterauftragnehmer"]),
          v("audit", "Audit rights", "Pruefrechte", ["audit rights", "audit", "pruefrecht", "pruefrechte"]),
          v("reporting", "Reporting", "Berichterstattung", ["reporting", "berichterstattung"]),
          v("exit", "Exit", "Ausstieg", ["exit", "ausstieg"]),
          v("security", "Security", "Sicherheit", ["security", "sicherheit"]),
        ],
      },
      {
        id: "evidenceStatus",
        label: { en: "Evidence status", de: "Nachweisstatus" },
        kind: "enum",
        sortable: true,
        values: [
          v("breached", "Breached", "Verletzt", ["breached", "breach", "verletzt", "verletzte"]),
          v("not-evidenced", "Not evidenced", "Nicht nachgewiesen", ["not evidenced", "unevidenced", "without evidence", "no evidence", "nicht nachgewiesen", "nicht nachgewiesene", "nicht nachgewiesenen", "ohne nachweis"]),
          v("partially-met", "Partially met", "Teilweise erfuellt", ["partially met", "partially", "partial", "teilweise"]),
          v("met", "Met", "Erfuellt", ["fully met", "erfuellt"]),
        ],
      },
      { id: "obligationText", label: { en: "Obligation", de: "Pflicht" }, kind: "text", sortable: false },
    ],
    nameField: "supplierName",
    primaryDate: "",
    defaultColumns: ["supplierName", "clauseReference", "category", "evidenceStatus"],
    defaultSort: { field: "evidenceStatus", direction: "asc" },
  },

  incidents: {
    id: "incidents",
    label: { en: "Incidents", de: "Vorfaelle" },
    synonyms: ["incident", "incidents", "near miss", "near misses", "near-miss", "outage", "outages", "vorfall", "vorfaelle", "stoerung", "stoerungen"],
    scope: {
      en: "Incidents affecting your entity, as detected by the current moment.",
      de: "Vorfaelle, die Ihre Gesellschaft betreffen, wie bis zum aktuellen Zeitpunkt erkannt.",
    },
    fields: [
      { id: "title", label: { en: "Incident", de: "Vorfall" }, kind: "text", sortable: true },
      { id: "supplierName", label: { en: "Supplier", de: "Lieferant" }, kind: "text", sortable: true },
      {
        id: "kind",
        label: { en: "Kind", de: "Art" },
        kind: "enum",
        sortable: true,
        values: [
          v("major-incident", "Major incident", "Schwerer Vorfall", ["major incident", "major", "schwer", "schwerer"]),
          v("incident", "Incident", "Vorfall", []),
          v("near-miss", "Near miss", "Beinahe-Vorfall", ["near miss", "near misses", "near-miss", "beinahe"]),
        ],
      },
      {
        id: "status",
        label: { en: "Status", de: "Status" },
        kind: "enum",
        sortable: true,
        values: [
          v("open", "Open", "Offen", []),
          v("under-assessment", "Under assessment", "In Bewertung", ["under assessment", "being assessed", "in bewertung"]),
          v("contained", "Contained", "Eingedaemmt", ["contained", "eingedaemmt"]),
          v("recovered", "Recovered", "Wiederhergestellt", ["recovered", "wiederhergestellt"]),
          v("closed", "Closed", "Geschlossen", ["closed", "geschlossen", "geschlossene"]),
        ],
      },
      {
        id: "severity",
        label: { en: "Severity", de: "Schweregrad" },
        kind: "enum",
        sortable: true,
        values: [
          v("S1", "S1", "S1", ["s1", "sev1", "severity 1"]),
          v("S2", "S2", "S2", ["s2", "sev2", "severity 2"]),
          v("S3", "S3", "S3", ["s3", "sev3", "severity 3"]),
          v("S4", "S4", "S4", ["s4", "sev4", "severity 4"]),
          v("unclassified", "Not yet classified", "Noch nicht eingestuft", ["unclassified", "not classified", "not yet classified", "without severity", "nicht eingestuft"]),
        ],
      },
      { id: "detectedAt", label: { en: "Detected", de: "Erkannt" }, kind: "date", sortable: true },
    ],
    nameField: "title",
    primaryDate: "detectedAt",
    defaultColumns: ["title", "kind", "status", "severity", "detectedAt"],
    defaultSort: { field: "detectedAt", direction: "desc" },
  },

  kris: {
    id: "kris",
    label: { en: "Key risk indicators", de: "Risikoindikatoren" },
    synonyms: ["kri", "kris", "key risk indicator", "key risk indicators", "indicator", "indicators", "risikoindikator", "risikoindikatoren", "indikator", "indikatoren", "kennzahl", "kennzahlen"],
    scope: {
      en: "Indicators for your entity and group-wide indicators.",
      de: "Indikatoren Ihrer Gesellschaft und gruppenweite Indikatoren.",
    },
    fields: [
      { id: "name", label: { en: "Indicator", de: "Indikator" }, kind: "text", sortable: true },
      {
        id: "currentStatus",
        label: { en: "Status", de: "Status" },
        kind: "enum",
        sortable: true,
        values: [
          v("red", "Red", "Rot", ["red", "rot", "rote"]),
          v("amber", "Amber", "Gelb", ["amber", "gelb", "gelbe"]),
          v("green", "Green", "Gruen", ["green", "gruen", "gruene"]),
        ],
      },
      { id: "currentValue", label: { en: "Current value", de: "Aktueller Wert" }, kind: "number", sortable: true },
    ],
    nameField: "name",
    primaryDate: "",
    defaultColumns: ["name", "currentStatus", "currentValue"],
    defaultSort: { field: "currentStatus", direction: "asc" },
  },
});

/**
 * Phrases that name several values of one field at once. "Open" incidents are
 * the ones not yet closed or recovered; a KRI "in breach" is red or amber, as
 * `getBreachedKris` reads it. The chip says which values were chosen.
 */
export const VALUE_GROUPS: Readonly<Record<SkillSource, ReadonlyArray<{ field: string; synonyms: readonly string[]; values: readonly string[] }>>> = {
  suppliers: [],
  evidence: [
    { field: "status", synonyms: ["gap", "gaps", "not received", "nicht eingegangen", "luecke", "luecken"], values: ["missing", "requested"] },
  ],
  obligations: [
    { field: "evidenceStatus", synonyms: ["not met", "unmet", "open obligation", "open obligations", "nicht erfuellt", "offene"], values: ["breached", "not-evidenced", "partially-met"] },
  ],
  incidents: [
    { field: "status", synonyms: ["open", "unresolved", "not closed", "ongoing", "offen", "offene", "offenen", "laufende"], values: ["open", "under-assessment", "contained"] },
  ],
  kris: [
    { field: "currentStatus", synonyms: ["breach", "breached", "in breach", "above threshold", "over threshold", "outside appetite", "ueberschritten", "ueberschrittene", "ueberschrittenen", "ueberschreitung", "verletzt"], values: ["red", "amber"] },
  ],
};

export function skillSource(source: SkillSource): SkillSourceDefinition {
  return SKILL_CATALOG[source];
}

export function skillField(source: SkillSource, fieldId: string): SkillField | undefined {
  return SKILL_CATALOG[source].fields.find((field) => field.id === fieldId);
}

export function isSkillSource(value: unknown): value is SkillSource {
  return typeof value === "string" && (SKILL_SOURCES as readonly string[]).includes(value);
}
