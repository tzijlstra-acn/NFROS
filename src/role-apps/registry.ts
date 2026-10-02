/**
 * Role-app registry.
 *
 * The single aggregation point for all role-app definitions. Import from here
 * wherever a surface needs the full catalogue or a lookup by id or role.
 *
 * Two apps are installed and production-shaped (RCSA Cycle Assistant and
 * Third-Party Onboarding). The remaining apps are demo or concept status
 * and are defined here so the administrator settings screen can show the
 * roadmap without separate maintenance.
 *
 * Do not import demo app definitions from outside this module. The
 * installed apps expose their own definition files for use in the process
 * page, the seed and the run factory. Demo apps exist only in this
 * catalogue.
 */

import { RCSA_CYCLE_ASSISTANT } from "./rcsa/definition";
import { THIRD_PARTY_ONBOARDING_APP } from "./tprm/definition";
import type { RoleAppDefinition } from "./contracts";

/* ---------------------------------------------------------------------------
   Demo apps: RCSA
   --------------------------------------------------------------------------- */

const RCSA_EVENT_DRIVEN_REASSESSMENT: RoleAppDefinition = {
  id: "rcsa-event-driven-reassessment",
  roleId: "rcsa",
  functionPackId: "nfr-operational-risk",
  name: "Event-Driven Reassessment",
  nameDe: "Ereignisgesteuertes Neubewertung",
  summary:
    "Detects and evaluates material changes that may require an off-cycle RCSA, including incident outcomes, control failures and KRI threshold breaches.",
  summaryDe:
    "Erkennt wesentliche Aenderungen, die eine ausserplanmaessige RCSA erfordern, einschliesslich Vorfallsergebnissen, Kontrollversagen und KRI-Schwellenwertbruechen.",
  status: "preview",
  maturity: "prototype",
  version: "0.1.0",
  entryRoute: null,
  processId: "rcsa-event-driven",
  coveredStageIds: ["trigger-assessment", "scope-confirmation", "monitoring-reassessment"],
  requiredConnectorPackIds: [],
  humanDecisionKinds: ["reassessment-trigger", "scope-confirmation"],
};

const RCSA_RAPID_ASSESSMENT: RoleAppDefinition = {
  id: "rcsa-rapid-assessment",
  roleId: "rcsa",
  functionPackId: "nfr-operational-risk",
  name: "Rapid Assessment",
  nameDe: "Schnellbewertung",
  summary:
    "A compressed four-stage cycle for low-complexity process scopes where evidence is already current and no first-line input is outstanding.",
  summaryDe:
    "Ein komprimierter vierstufiger Zyklus fuer risikoarme Prozessbereiche, bei denen Nachweise aktuell sind und keine Erstlinien-Eingaben ausstehen.",
  status: "preview",
  maturity: "concept",
  version: "0.1.0",
  entryRoute: null,
  processId: "rcsa-rapid",
  coveredStageIds: ["scope-trigger", "evidence-refresh", "rating-appetite", "actions-approval"],
  requiredConnectorPackIds: [],
  humanDecisionKinds: ["residual-risk", "risk-acceptance"],
};

/* ---------------------------------------------------------------------------
   Demo apps: TPRM
   --------------------------------------------------------------------------- */

const TPRM_PERIODIC_REASSESSMENT: RoleAppDefinition = {
  id: "tprm-periodic-reassessment",
  roleId: "tprm",
  functionPackId: "nfr-third-party-risk",
  name: "Periodic Reassessment",
  nameDe: "Periodische Neubewertung",
  summary:
    "Guides the Third-Party Risk Manager through the annual or biennial reassessment cycle for an existing supplier, from evidence refresh to updated monitoring plan.",
  summaryDe:
    "Begleitet den Third-Party Risk Manager durch den jaehrlichen oder zweijaehrlichen Neubewertungszyklus fuer einen bestehenden Lieferanten, von der Nachweisauffrischung bis zum aktualisierten Ueberwachungsplan.",
  status: "preview",
  maturity: "prototype",
  version: "0.1.0",
  entryRoute: null,
  processId: "tprm-periodic-reassessment",
  coveredStageIds: [
    "evidence-refresh",
    "specialist-reviews",
    "reassessment-conclusion",
    "monitoring-update",
  ],
  requiredConnectorPackIds: ["third-party-register", "evidence-vault"],
  humanDecisionKinds: ["evidence-adequacy", "specialist-opinion", "monitoring-plan"],
};

const TPRM_EXIT_PLANNING: RoleAppDefinition = {
  id: "tprm-exit-planning",
  roleId: "tprm",
  functionPackId: "nfr-third-party-risk",
  name: "Exit Planning",
  nameDe: "Ausstiegsplanung",
  summary:
    "Structures the exit or substitution plan for a supplier that has been marked for exit, covering notice obligations, transition risks and service continuity.",
  summaryDe:
    "Strukturiert den Austritts- oder Substitutionsplan fuer einen zur Abloesung vorgesehenen Lieferanten, einschliesslich Kuendigungspflichten, Transitionsrisiken und Dienstleistungskontinuitaet.",
  status: "preview",
  maturity: "concept",
  version: "0.1.0",
  entryRoute: null,
  processId: "tprm-exit-planning",
  coveredStageIds: [
    "exit-trigger",
    "notice-and-transition",
    "continuity-assurance",
    "exit-confirmation",
  ],
  requiredConnectorPackIds: ["third-party-register", "procurement-portal"],
  humanDecisionKinds: ["exit-approval", "continuity-adequacy"],
};

const TPRM_FOURTH_PARTY_REVIEW: RoleAppDefinition = {
  id: "tprm-fourth-party-review",
  roleId: "tprm",
  functionPackId: "nfr-third-party-risk",
  name: "Fourth-Party Deep Dive",
  nameDe: "Vierte-Partei-Tiefenpruefung",
  summary:
    "Maps and assesses the subprocessor and fourth-party chain for a critical supplier, surfacing concentration risk and undisclosed dependencies.",
  summaryDe:
    "Kartiert und bewertet die Subprozessor- und Vierte-Partei-Kette eines kritischen Lieferanten und deckt Konzentrationsrisiken und nicht gemeldete Abhaengigkeiten auf.",
  status: "preview",
  maturity: "concept",
  version: "0.1.0",
  entryRoute: null,
  processId: "tprm-fourth-party-review",
  coveredStageIds: [
    "chain-mapping",
    "concentration-assessment",
    "disclosure-review",
    "remediation-request",
  ],
  requiredConnectorPackIds: ["third-party-register"],
  humanDecisionKinds: ["materiality", "classification"],
};

/* ---------------------------------------------------------------------------
   Registry
   --------------------------------------------------------------------------- */

export const ROLE_APP_REGISTRY: readonly RoleAppDefinition[] = [
  RCSA_CYCLE_ASSISTANT,
  RCSA_EVENT_DRIVEN_REASSESSMENT,
  RCSA_RAPID_ASSESSMENT,
  THIRD_PARTY_ONBOARDING_APP,
  TPRM_PERIODIC_REASSESSMENT,
  TPRM_EXIT_PLANNING,
  TPRM_FOURTH_PARTY_REVIEW,
];

export function getRoleApps(roleId: string): RoleAppDefinition[] {
  return ROLE_APP_REGISTRY.filter((app) => app.roleId === roleId);
}

export function getRoleApp(id: string): RoleAppDefinition | undefined {
  return ROLE_APP_REGISTRY.find((app) => app.id === id);
}
