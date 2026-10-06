/**
 * The rules of pilot management. Pure.
 *
 * Everything that decides whether a pilot change may be recorded is a
 * function here, with no database and no React, because these are the rules
 * a reviewer will want to read and a test will want to pin. The repository
 * (`src/db/repositories/pilot.ts`) keeps only the record's own guarantees; the
 * governed actions (`actions.ts`) call these before they write anything.
 *
 * Five rules carry the plan's claims, so they are worth stating:
 *
 *   A pilot covers Available roles and installed Role Apps only. A Demo or
 *   Planned role, or a preview app, is refused with the reason, because the
 *   release states are the product's promise about what can be piloted.
 *
 *   A pilot never runs autonomously. The highest autonomy it can allow is
 *   "act with approval"; every material change needs a named person.
 *
 *   A baseline is the design partner's figure, entered or imported by a
 *   person. A measured baseline carries its value and its period; a baseline
 *   that cannot be taken is recorded as unavailable with the reason. Nothing
 *   here computes one.
 *
 *   A pilot starts only with an agreed window, a cohort and a recorded
 *   baseline for every measure, so the weekly view always has something to
 *   compare with.
 *
 *   The commercial implication of an exit decision is stated in words. A
 *   figure would need a measured baseline and a measured result; the pilot
 *   records neither as money (plan section 12).
 */

import { AUTONOMY_LEVELS, type AutonomyLevel } from "@/db/schema/core";
import {
  PILOT_EXIT_OUTCOMES,
  PILOT_ISSUE_KINDS,
  SEVERITIES,
  type MeasureUnit,
  type MeasurementStatus,
  type PilotExitOutcome,
  type PilotIssueKind,
  type PilotStatus,
  type PilotSupportContact,
  type Severity,
} from "@/db/schema/product-console";
import { containsCredentialShape } from "./readiness-rules";

export type Bilingual = { en: string; de: string };

export type RuleResult<T> = { ok: true; value: T } | { ok: false; problems: Bilingual[] };

function problem(en: string, de: string): Bilingual {
  return { en, de };
}

function result<T>(problems: Bilingual[], value: T): RuleResult<T> {
  return problems.length === 0 ? { ok: true, value } : { ok: false, problems };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** The Monday a week starts on, as an ISO date. */
export function weekStartOf(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  const day = date.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function isMonday(isoDate: string): boolean {
  return isIsoDate(isoDate) && weekStartOf(isoDate) === isoDate;
}

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/* ==========================================================================
   Setup
   ========================================================================== */

/** The autonomy levels a pilot may allow: never "act within policy". */
export const PILOT_AUTONOMY_LEVELS: readonly AutonomyLevel[] = AUTONOMY_LEVELS.filter(
  (level) => level !== "act-within-policy",
);

export const MAX_SUPPORT_CONTACTS = 8;

export interface SetupDraft {
  businessArea: string;
  businessAreaDe: string;
  legalEntityIds: readonly string[];
  roleIds: readonly string[];
  roleAppIds: readonly string[];
  sourceSystemIds: readonly string[];
  entitlementProfileId: string | null;
  maxAutonomyLevel: string;
  supportContacts: readonly PilotSupportContact[];
  plannedStartOn: string | null;
  plannedEndOn: string | null;
}

/** What setup may choose from, read from the configuration and the release registry. */
export interface SetupOptions {
  legalEntityIds: readonly string[];
  /** Every role, with its release state. */
  roles: ReadonlyArray<{ roleId: string; status: "available" | "demo" | "planned" | "hidden"; label: string }>;
  /** Every Role App, with its status and the role it serves. */
  roleApps: ReadonlyArray<{ id: string; roleId: string; status: string; name: string }>;
  connectorIds: readonly string[];
  entitlementProfileIds: readonly string[];
}

export interface ValidSetup {
  businessArea: string;
  businessAreaDe: string;
  legalEntityIds: string[];
  roleIds: string[];
  roleAppIds: string[];
  sourceSystemIds: string[];
  entitlementProfileId: string | null;
  maxAutonomyLevel: AutonomyLevel;
  supportContacts: PilotSupportContact[];
  plannedStartOn: string | null;
  plannedEndOn: string | null;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
}

export function validateSetup(draft: SetupDraft, options: SetupOptions): RuleResult<ValidSetup> {
  const problems: Bilingual[] = [];

  const businessArea = clean(draft.businessArea);
  const businessAreaDe = clean(draft.businessAreaDe);
  if (businessArea.length === 0 || businessAreaDe.length === 0) {
    problems.push(problem("Describe the business area in English and German.", "Beschreiben Sie den Geschaeftsbereich auf Englisch und Deutsch."));
  }
  if (businessArea.length > 300 || businessAreaDe.length > 300) {
    problems.push(problem("Keep the business area to 300 characters.", "Halten Sie den Geschaeftsbereich bei hoechstens 300 Zeichen."));
  }

  const legalEntityIds = unique(draft.legalEntityIds);
  if (legalEntityIds.length === 0) {
    problems.push(problem("Choose at least one legal entity.", "Waehlen Sie mindestens eine Rechtseinheit."));
  }
  for (const id of legalEntityIds) {
    if (!options.legalEntityIds.includes(id)) {
      problems.push(problem(`${id} is not a configured legal entity.`, `${id} ist keine konfigurierte Rechtseinheit.`));
    }
  }

  const roleIds = unique(draft.roleIds);
  if (roleIds.length === 0) {
    problems.push(problem("Choose at least one role.", "Waehlen Sie mindestens eine Rolle."));
  }
  for (const id of roleIds) {
    const role = options.roles.find((entry) => entry.roleId === id);
    if (!role) {
      problems.push(problem(`${id} is not a role of this product.`, `${id} ist keine Rolle dieses Produkts.`));
    } else if (role.status !== "available") {
      problems.push(
        problem(
          `${role.label} is ${role.status === "demo" ? "a Demo" : "a Planned"} role in this release and cannot be piloted.`,
          `${role.label} ist in diesem Release eine ${role.status === "demo" ? "Demo" : "geplante"} Rolle und kann nicht pilotiert werden.`,
        ),
      );
    }
  }

  const roleAppIds = unique(draft.roleAppIds);
  for (const id of roleAppIds) {
    const app = options.roleApps.find((entry) => entry.id === id);
    if (!app) {
      problems.push(problem(`${id} is not a Role App of this product.`, `${id} ist keine Rollen-App dieses Produkts.`));
    } else if (app.status !== "installed") {
      problems.push(
        problem(
          `${app.name} is not installed in this release and cannot be piloted.`,
          `${app.name} ist in diesem Release nicht installiert und kann nicht pilotiert werden.`,
        ),
      );
    } else if (!roleIds.includes(app.roleId)) {
      problems.push(
        problem(
          `${app.name} serves a role that is not in the pilot. Add the role or remove the app.`,
          `${app.name} dient einer Rolle, die nicht im Piloten ist. Nehmen Sie die Rolle auf oder entfernen Sie die App.`,
        ),
      );
    }
  }

  const sourceSystemIds = unique(draft.sourceSystemIds);
  for (const id of sourceSystemIds) {
    if (!options.connectorIds.includes(id)) {
      problems.push(problem(`${id} is not a configured connector.`, `${id} ist kein konfigurierter Konnektor.`));
    }
  }

  const entitlementProfileId = draft.entitlementProfileId && draft.entitlementProfileId.trim().length > 0 ? draft.entitlementProfileId.trim() : null;
  if (entitlementProfileId !== null && !options.entitlementProfileIds.includes(entitlementProfileId)) {
    problems.push(problem(`${entitlementProfileId} is not an entitlement profile.`, `${entitlementProfileId} ist kein Berechtigungsprofil.`));
  }

  const level = draft.maxAutonomyLevel as AutonomyLevel;
  if (!PILOT_AUTONOMY_LEVELS.includes(level)) {
    problems.push(
      problem(
        "A pilot allows at most Act with approval. Nothing executes within policy without a person.",
        "Ein Pilot erlaubt hoechstens Handeln nach Genehmigung. Nichts wird ohne eine Person im Rahmen der Richtlinie ausgefuehrt.",
      ),
    );
  }

  const supportContacts = draft.supportContacts
    .map((contact) => ({ label: clean(contact.label), role: clean(contact.role), channel: clean(contact.channel) }))
    .filter((contact) => contact.label.length > 0 || contact.role.length > 0 || contact.channel.length > 0);
  if (supportContacts.length > MAX_SUPPORT_CONTACTS) {
    problems.push(problem(`Name at most ${MAX_SUPPORT_CONTACTS} support contacts.`, `Nennen Sie hoechstens ${MAX_SUPPORT_CONTACTS} Supportkontakte.`));
  }
  for (const contact of supportContacts) {
    if (contact.label.length === 0 || contact.role.length === 0) {
      problems.push(problem("Each support contact needs a name and a role.", "Jeder Supportkontakt braucht einen Namen und eine Rolle."));
      break;
    }
  }
  if (supportContacts.some((contact) => containsCredentialShape(`${contact.label} ${contact.role} ${contact.channel}`))) {
    problems.push(problem("A support contact must not contain a credential.", "Ein Supportkontakt darf keine Zugangsdaten enthalten."));
  }

  const plannedStartOn = draft.plannedStartOn && draft.plannedStartOn.trim() ? draft.plannedStartOn.trim() : null;
  const plannedEndOn = draft.plannedEndOn && draft.plannedEndOn.trim() ? draft.plannedEndOn.trim() : null;
  if ((plannedStartOn === null) !== (plannedEndOn === null)) {
    problems.push(problem("Give both the planned start and the planned end, or neither.", "Nennen Sie geplanten Beginn und geplantes Ende, oder keines von beiden."));
  }
  if (plannedStartOn !== null && !isIsoDate(plannedStartOn)) {
    problems.push(problem("The planned start is not a date.", "Der geplante Beginn ist kein Datum."));
  }
  if (plannedEndOn !== null && !isIsoDate(plannedEndOn)) {
    problems.push(problem("The planned end is not a date.", "Das geplante Ende ist kein Datum."));
  }
  if (plannedStartOn && plannedEndOn && isIsoDate(plannedStartOn) && isIsoDate(plannedEndOn) && plannedEndOn < plannedStartOn) {
    problems.push(problem("The planned end is before the planned start.", "Das geplante Ende liegt vor dem geplanten Beginn."));
  }

  return result(problems, {
    businessArea,
    businessAreaDe,
    legalEntityIds,
    roleIds,
    roleAppIds,
    sourceSystemIds,
    entitlementProfileId,
    maxAutonomyLevel: level,
    supportContacts: [...supportContacts],
    plannedStartOn,
    plannedEndOn,
  });
}

/* ==========================================================================
   Cohort
   ========================================================================== */

export interface CohortCandidate {
  userId: string;
  roleIds: readonly string[];
  isAdministrator: boolean;
}

/**
 * The cohort's users: identity accounts only, never an administrator, and
 * each working in a role the pilot covers. Membership is an entitlement; it
 * is never used as a measure.
 */
export function validateCohort(
  userIds: readonly string[],
  candidates: readonly CohortCandidate[],
  pilotRoleIds: readonly string[],
): RuleResult<string[]> {
  const problems: Bilingual[] = [];
  const chosen = unique(userIds);
  for (const id of chosen) {
    const account = candidates.find((candidate) => candidate.userId === id);
    if (!account) {
      problems.push(problem(`${id} is not an identity account.`, `${id} ist kein Identitaetskonto.`));
    } else if (account.isAdministrator) {
      problems.push(problem(`${id} is an administrator account and cannot be in a pilot cohort.`, `${id} ist ein Administrationskonto und kann nicht in einer Pilotkohorte sein.`));
    } else if (!account.roleIds.some((roleId) => pilotRoleIds.includes(roleId))) {
      problems.push(problem(`${id} works in no role the pilot covers.`, `${id} arbeitet in keiner Rolle des Piloten.`));
    }
  }
  return result(problems, chosen);
}

/* ==========================================================================
   Baseline and success criteria
   ========================================================================== */

export interface BaselineDraft {
  status: string;
  value: string;
  period: string;
  /** Why a baseline is unavailable, or where an imported figure came from. */
  note: string;
}

export type ValidBaseline =
  | { status: "measured"; value: number; period: string; note: string }
  | { status: "unavailable"; period: string | null; note: string }
  | { status: "not-measured"; period: null; note: string };

function parseNumber(raw: string): number | null {
  const normalised = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (normalised.length === 0 || !/^-?\d+(\.\d+)?$/.test(normalised)) return null;
  const value = Number(normalised);
  return Number.isFinite(value) ? value : null;
}

function checkValueForUnit(value: number, unit: MeasureUnit): Bilingual | null {
  if (value < 0) return problem("A value cannot be negative.", "Ein Wert kann nicht negativ sein.");
  if (unit === "percent" && value > 100) return problem("A percentage is at most 100.", "Ein Prozentwert ist hoechstens 100.");
  if (unit === "count" && !Number.isInteger(value)) return problem("A count is a whole number.", "Eine Anzahl ist eine ganze Zahl.");
  return null;
}

export function validateBaseline(draft: BaselineDraft, unit: MeasureUnit): RuleResult<ValidBaseline> {
  const status = draft.status as MeasurementStatus;
  const note = clean(draft.note);
  const period = clean(draft.period);
  if (status === "measured") {
    const value = parseNumber(draft.value);
    const problems: Bilingual[] = [];
    if (value === null) problems.push(problem("Enter the design partner's figure as a number.", "Geben Sie den Wert des Designpartners als Zahl ein."));
    else {
      const unitProblem = checkValueForUnit(value, unit);
      if (unitProblem) problems.push(unitProblem);
    }
    if (period.length === 0) {
      problems.push(problem("Name the period the figure covers, for example Q3 2026.", "Nennen Sie den Zeitraum des Werts, zum Beispiel Q3 2026."));
    }
    return result(problems, { status: "measured", value: value ?? 0, period, note });
  }
  if (status === "unavailable") {
    return note.length === 0
      ? { ok: false, problems: [problem("Say why the baseline cannot be taken.", "Sagen Sie, warum die Ausgangslage nicht erhoben werden kann.")] }
      : { ok: true, value: { status: "unavailable", period: period.length > 0 ? period : null, note } };
  }
  if (status === "not-measured") {
    return { ok: true, value: { status: "not-measured", period: null, note } };
  }
  return { ok: false, problems: [problem("Choose measured, unavailable or not measured.", "Waehlen Sie gemessen, nicht verfuegbar oder nicht gemessen.")] };
}

/** One line of an imported baseline: `measure-key, value, period`. */
export interface ImportedBaselineLine {
  key: string;
  value: number;
  period: string;
}

/**
 * Parses a pasted baseline import.
 *
 * One measure per line, `measure-key, value, period`, with a header line
 * allowed. Every line must name a known measure, carry a number valid for
 * that measure's unit and a period; one bad line refuses the whole import, so
 * a partial import cannot pass for a complete one.
 */
export function parseBaselineImport(
  text: string,
  measures: ReadonlyArray<{ key: string; unit: MeasureUnit }>,
): RuleResult<ImportedBaselineLine[]> {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
  const problems: Bilingual[] = [];
  const parsed: ImportedBaselineLine[] = [];
  const seen = new Set<string>();

  lines.forEach((line, index) => {
    const cells = line.split(/[;,\t]/).map((cell) => cell.trim());
    const [key = "", rawValue = "", ...rest] = cells;
    if (index === 0 && key.toLowerCase() === "measure") return;
    const measure = measures.find((entry) => entry.key === key);
    const lineNo = index + 1;
    if (!measure) {
      problems.push(problem(`Line ${lineNo}: ${key || "(empty)"} is not a measure of this pilot.`, `Zeile ${lineNo}: ${key || "(leer)"} ist keine Kennzahl dieses Piloten.`));
      return;
    }
    if (seen.has(key)) {
      problems.push(problem(`Line ${lineNo}: ${key} appears twice.`, `Zeile ${lineNo}: ${key} kommt doppelt vor.`));
      return;
    }
    seen.add(key);
    const value = parseNumber(rawValue);
    if (value === null) {
      problems.push(problem(`Line ${lineNo}: the value for ${key} is not a number.`, `Zeile ${lineNo}: der Wert fuer ${key} ist keine Zahl.`));
      return;
    }
    const unitProblem = checkValueForUnit(value, measure.unit);
    if (unitProblem) {
      problems.push(problem(`Line ${lineNo}: ${unitProblem.en}`, `Zeile ${lineNo}: ${unitProblem.de}`));
      return;
    }
    const period = clean(rest.join(" "));
    if (period.length === 0) {
      problems.push(problem(`Line ${lineNo}: name the period for ${key}.`, `Zeile ${lineNo}: nennen Sie den Zeitraum fuer ${key}.`));
      return;
    }
    parsed.push({ key, value, period });
  });

  if (lines.length === 0 || (parsed.length === 0 && problems.length === 0)) {
    problems.push(problem("The import holds no measure lines.", "Der Import enthaelt keine Kennzahlzeilen."));
  }
  return result(problems, parsed);
}

export function validateTarget(raw: string, unit: MeasureUnit): RuleResult<number | null> {
  if (raw.trim().length === 0) return { ok: true, value: null };
  const value = parseNumber(raw);
  if (value === null) return { ok: false, problems: [problem("Enter the success criterion as a number.", "Geben Sie das Erfolgskriterium als Zahl ein.")] };
  const unitProblem = checkValueForUnit(value, unit);
  return unitProblem ? { ok: false, problems: [unitProblem] } : { ok: true, value };
}

/* ==========================================================================
   Weekly readings
   ========================================================================== */

export interface ReadingDraft {
  weekStarting: string;
  status: string;
  value: string;
  source: string;
  note: string;
}

export interface ValidReading {
  weekStarting: string;
  status: MeasurementStatus;
  value: number | null;
  source: string;
  note: string;
}

export function validateReading(draft: ReadingDraft, unit: MeasureUnit): RuleResult<ValidReading> {
  const problems: Bilingual[] = [];
  const weekStarting = draft.weekStarting.trim();
  if (!isMonday(weekStarting)) {
    problems.push(problem("A reading belongs to a week; give the Monday it starts on.", "Ein Wert gehoert zu einer Woche; nennen Sie den Montag, an dem sie beginnt."));
  }
  const source = clean(draft.source);
  if (source.length === 0) problems.push(problem("Name where the reading comes from.", "Nennen Sie, woher der Wert stammt."));
  const note = clean(draft.note);
  const status = draft.status as MeasurementStatus;
  let value: number | null = null;
  if (status === "measured") {
    value = parseNumber(draft.value);
    if (value === null) problems.push(problem("Enter the reading as a number.", "Geben Sie den Wert als Zahl ein."));
    else {
      const unitProblem = checkValueForUnit(value, unit);
      if (unitProblem) problems.push(unitProblem);
    }
  } else if (status === "unavailable") {
    if (note.length === 0) problems.push(problem("Say why the reading could not be taken.", "Sagen Sie, warum der Wert nicht erhoben werden konnte."));
  } else {
    problems.push(problem("A reading is measured or unavailable.", "Ein Wert ist gemessen oder nicht verfuegbar."));
  }
  return result(problems, { weekStarting, status, value, source, note });
}

/* ==========================================================================
   Issues, risks and decisions required
   ========================================================================== */

export interface IssueDraft {
  kind: string;
  title: string;
  detail: string;
  severity: string;
  ownerLabel: string;
}

export interface ValidIssue {
  kind: PilotIssueKind;
  title: string;
  detail: string;
  severity: Severity;
  ownerLabel: string | null;
}

export function validateIssue(draft: IssueDraft): RuleResult<ValidIssue> {
  const problems: Bilingual[] = [];
  const kind = draft.kind as PilotIssueKind;
  if (!PILOT_ISSUE_KINDS.includes(kind)) problems.push(problem("Choose issue, risk or decision required.", "Waehlen Sie Thema, Risiko oder erforderliche Entscheidung."));
  const title = clean(draft.title);
  if (title.length === 0) problems.push(problem("Give the issue a title.", "Geben Sie dem Thema einen Titel."));
  if (title.length > 160) problems.push(problem("Keep the title to 160 characters.", "Halten Sie den Titel bei hoechstens 160 Zeichen."));
  const severity = draft.severity as Severity;
  if (!SEVERITIES.includes(severity)) problems.push(problem("Choose a severity.", "Waehlen Sie einen Schweregrad."));
  const ownerLabel = clean(draft.ownerLabel);
  return result(problems, { kind, title, detail: draft.detail.trim(), severity, ownerLabel: ownerLabel.length > 0 ? ownerLabel : null });
}

export const ISSUE_CLOSING_STATUSES = ["resolved", "accepted", "closed"] as const;
export type IssueClosingStatus = (typeof ISSUE_CLOSING_STATUSES)[number];

export function validateIssueUpdate(
  current: "open" | "resolved" | "accepted" | "closed",
  to: string,
  resolution: string,
): RuleResult<{ status: "open" | IssueClosingStatus; resolution: string }> {
  const text = resolution.trim();
  if (to === "open") {
    return current === "open"
      ? { ok: false, problems: [problem("The issue is already open.", "Das Thema ist bereits offen.")] }
      : { ok: true, value: { status: "open", resolution: text } };
  }
  if (!(ISSUE_CLOSING_STATUSES as readonly string[]).includes(to)) {
    return { ok: false, problems: [problem("Choose resolved, accepted or closed.", "Waehlen Sie geloest, akzeptiert oder geschlossen.")] };
  }
  if (text.length === 0) {
    return { ok: false, problems: [problem("Record how it was resolved or why it is accepted.", "Halten Sie fest, wie es geloest wurde oder warum es akzeptiert wird.")] };
  }
  return { ok: true, value: { status: to as IssueClosingStatus, resolution: text } };
}

/* ==========================================================================
   Starting the pilot
   ========================================================================== */

export interface StartFacts {
  status: PilotStatus;
  plannedStartOn: string | null;
  plannedEndOn: string | null;
  cohortSize: number;
  baselines: ReadonlyArray<{ label: Bilingual; status: MeasurementStatus }>;
}

/** What still stands between a pilot in setup and its start, in words. */
export function startConditions(facts: StartFacts): Bilingual[] {
  const conditions: Bilingual[] = [];
  if (facts.status !== "setup") {
    conditions.push(problem("Only a pilot in setup can be started.", "Nur ein Pilot in Einrichtung kann gestartet werden."));
  }
  if (facts.plannedStartOn === null || facts.plannedEndOn === null) {
    conditions.push(problem("Agree the pilot window with the design partner.", "Vereinbaren Sie den Pilotzeitraum mit dem Designpartner."));
  }
  if (facts.cohortSize === 0) {
    conditions.push(problem("Add at least one user to the cohort.", "Nehmen Sie mindestens eine Person in die Kohorte auf."));
  }
  const missing = facts.baselines.filter((entry) => entry.status === "not-measured");
  if (missing.length > 0) {
    conditions.push(
      problem(
        `Record the baseline for ${missing.map((entry) => entry.label.en).join(", ")}, or mark it unavailable with the reason.`,
        `Erfassen Sie die Ausgangslage fuer ${missing.map((entry) => entry.label.de).join(", ")} oder kennzeichnen Sie sie mit Begruendung als nicht verfuegbar.`,
      ),
    );
  }
  return conditions;
}

/* ==========================================================================
   The exit decision
   ========================================================================== */

/** What each outcome does to the pilot. */
export const EXIT_OUTCOME_EFFECT: Record<PilotExitOutcome, PilotStatus> = {
  scale: "closed",
  extend: "running",
  pause: "paused",
  stop: "closed",
};

/**
 * A figure in what must be words: money, a percentage or an amount with a
 * multiplier. Matched case insensitively, in English and German.
 */
const FIGURE_PATTERN =
  /(\d[\d.,' ]*\s*(%|percent|prozent|eur\b|euro|chf|usd|gbp|\$|€|£|k\b|m\b|mn\b|mio\b|million|millionen|bn\b|billion|milliarden|tsd\b))|((\$|€|£|\beur\b|\bchf\b|\busd\b)\s*\d)/i;

export function statesAFigure(text: string): boolean {
  return FIGURE_PATTERN.test(text);
}

export interface ExitEvidenceRef {
  kind: string;
  ref: string;
  label: string;
}

export interface ExitDecisionDraft {
  outcome: string;
  rationale: string;
  commercialImplication: string;
  nextWaveRecommendation: string;
  unresolvedConditions: readonly string[];
  controlFindings: readonly string[];
  evidence: readonly ExitEvidenceRef[];
  /** For Extend pilot: the new planned end. */
  extendedEndOn: string | null;
}

/**
 * The payload the approval is bound to. Every field the decision records,
 * in a fixed shape, so the fingerprint of what the person reviewed and of
 * what is written are computed from the same object.
 */
export interface ExitDecisionPayload {
  pilotId: string;
  outcome: PilotExitOutcome;
  rationale: string;
  commercialImplication: string;
  nextWaveRecommendation: string;
  unresolvedConditions: string[];
  controlFindings: string[];
  evidence: ExitEvidenceRef[];
  extendedEndOn: string | null;
}

export function validateExitDecision(
  pilot: { id: string; status: PilotStatus; plannedEndOn: string | null },
  draft: ExitDecisionDraft,
): RuleResult<ExitDecisionPayload> {
  const problems: Bilingual[] = [];
  if (pilot.status !== "running" && pilot.status !== "paused") {
    problems.push(
      problem(
        "An exit decision is taken on a pilot that has started. Start the pilot first.",
        "Eine Abschlussentscheidung betrifft einen gestarteten Piloten. Starten Sie den Piloten zuerst.",
      ),
    );
  }
  const outcome = draft.outcome as PilotExitOutcome;
  if (!PILOT_EXIT_OUTCOMES.includes(outcome)) {
    problems.push(problem("Choose Scale, Extend pilot, Pause or Stop.", "Waehlen Sie Skalieren, Pilot verlaengern, Pausieren oder Beenden."));
  }
  const rationale = draft.rationale.trim();
  if (rationale.length < 20) {
    problems.push(problem("Give the reason for the decision in a sentence or more.", "Begruenden Sie die Entscheidung in mindestens einem Satz."));
  }
  const commercialImplication = draft.commercialImplication.trim();
  if (commercialImplication.length === 0) {
    problems.push(problem("State the commercial implication in words.", "Beschreiben Sie die kommerzielle Auswirkung in Worten."));
  } else if (statesAFigure(commercialImplication)) {
    problems.push(
      problem(
        "State the commercial implication in words, without amounts or percentages. A figure needs a measured baseline and a measured result, and is not recorded here.",
        "Beschreiben Sie die kommerzielle Auswirkung in Worten, ohne Betraege oder Prozentwerte. Eine Zahl braucht eine gemessene Ausgangslage und ein gemessenes Ergebnis und wird hier nicht erfasst.",
      ),
    );
  }
  const nextWaveRecommendation = draft.nextWaveRecommendation.trim();
  if (nextWaveRecommendation.length === 0) {
    problems.push(problem("Recommend what the next wave should do.", "Empfehlen Sie, was die naechste Welle tun soll."));
  }
  const extendedEndOn = draft.extendedEndOn && draft.extendedEndOn.trim().length > 0 ? draft.extendedEndOn.trim() : null;
  if (outcome === "extend") {
    if (extendedEndOn === null || !isIsoDate(extendedEndOn)) {
      problems.push(problem("Extending the pilot needs the new planned end date.", "Eine Verlaengerung braucht das neue geplante Enddatum."));
    } else if (pilot.plannedEndOn !== null && extendedEndOn <= pilot.plannedEndOn) {
      problems.push(problem("The new end must be after the current planned end.", "Das neue Ende muss nach dem bisherigen geplanten Ende liegen."));
    }
  }
  const lines = (values: readonly string[]) => unique(values.map(clean));
  const evidence = draft.evidence.filter((entry) => entry.kind.trim().length > 0 && entry.ref.trim().length > 0);
  if (evidence.length === 0) {
    problems.push(problem("An exit decision rests on evidence. Attach at least one item.", "Eine Abschlussentscheidung beruht auf Nachweisen. Fuegen Sie mindestens einen hinzu."));
  }
  return result(problems, {
    pilotId: pilot.id,
    outcome,
    rationale,
    commercialImplication,
    nextWaveRecommendation,
    unresolvedConditions: lines(draft.unresolvedConditions),
    controlFindings: lines(draft.controlFindings),
    evidence: evidence.map((entry) => ({ kind: entry.kind.trim(), ref: entry.ref.trim(), label: clean(entry.label) })),
    extendedEndOn: outcome === "extend" ? extendedEndOn : null,
  });
}
