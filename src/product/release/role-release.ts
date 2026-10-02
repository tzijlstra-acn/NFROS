/**
 * Release status model for the six WorkOS roles.
 *
 * This module owns the single source of truth for which roles are released,
 * which are in preview, and what copy each entry shows in the role selector.
 * Nothing is derived from the database; the selector renders from this data
 * alone so it works before and after the scenario is seeded.
 *
 * V3.3 release: two available roles (rcsa, tprm), two demo roles, two planned roles.
 */

export type RoleReleaseStatus = "available" | "demo" | "planned" | "hidden";

export type RoleReleaseDefinition = {
  roleId: string;
  status: RoleReleaseStatus;
  releaseLabel: string;
  summary: string;
  summaryDe: string;
  primaryProcesses: string[];
  defaultRoute: string | null;
};

export const ROLE_RELEASE_DEFINITIONS: RoleReleaseDefinition[] = [
  {
    roleId: "rcsa",
    status: "available",
    releaseLabel: "Operational Risk Partner",
    summary:
      "Challenge risk and control assessments, record second-line positions, and trigger reassessment when evidence changes.",
    summaryDe:
      "Risiko- und Kontrollbewertungen hinterfragen, Second-Line-Positionen erfassen und Neubewertungen ausloesen, wenn sich Nachweise aendern.",
    primaryProcesses: ["RCSA lifecycle", "Event-driven reassessment"],
    defaultRoute: "/workday/rcsa",
  },
  {
    roleId: "tprm",
    status: "available",
    releaseLabel: "Third-Party Risk Manager",
    summary: "Assess, onboard, and monitor third-party arrangements end to end.",
    summaryDe:
      "Drittanbieter-Vereinbarungen von Anfang bis Ende bewerten, aufnehmen und ueberwachen.",
    primaryProcesses: ["Third-party onboarding", "Periodic reassessment"],
    defaultRoute: "/workday/tprm",
  },
  {
    roleId: "control-assurance",
    status: "demo",
    releaseLabel: "Control Assurance Specialist",
    summary: "Test and certify controls across the operational risk framework.",
    summaryDe:
      "Kontrollen im Rahmen des operationellen Risikos testen und zertifizieren.",
    primaryProcesses: [],
    defaultRoute: "/workday/control-assurance",
  },
  {
    roleId: "incident-resilience",
    status: "demo",
    releaseLabel: "Incident and Resilience Lead",
    summary:
      "Manage operational incidents and track recovery against resilience targets.",
    summaryDe:
      "Betriebliche Vorfaelle verwalten und die Erholung gegenueber Resilienzzielen verfolgen.",
    primaryProcesses: [],
    defaultRoute: "/workday/incident-resilience",
  },
  {
    roleId: "regulatory-change",
    status: "planned",
    releaseLabel: "Regulatory Change Manager",
    summary:
      "Track regulatory publications, assess impact, and drive implementation across teams.",
    summaryDe:
      "Regulatorische Veroeffentlichungen verfolgen, Auswirkungen bewerten und die Umsetzung in Teams vorantreiben.",
    primaryProcesses: [],
    defaultRoute: "/workday/regulatory-change",
  },
  {
    roleId: "nfr-governance",
    status: "planned",
    releaseLabel: "NFR Portfolio Lead",
    summary:
      "Oversee the non-financial risk portfolio and coordinate across risk domains.",
    summaryDe:
      "Das nicht-finanzielle Risikoportfolio ueberwachen und die Koordination zwischen Risikobereichen sicherstellen.",
    primaryProcesses: [],
    defaultRoute: "/workday/nfr-governance",
  },
];

export function getRoleRelease(roleId: string): RoleReleaseDefinition | undefined {
  return ROLE_RELEASE_DEFINITIONS.find((r) => r.roleId === roleId);
}
