/**
 * Seed data contract.
 *
 * Every scenario data module imports its row types from here, so the seeded
 * content is checked against the real schema at compile time rather than
 * failing at insert time. If a module does not typecheck, the seed is wrong.
 *
 * The authoritative content specification is docs/SCENARIO_BIBLE.md. Where a
 * data module and the bible disagree, the bible wins and the module is fixed.
 */

import { DEFAULT_RUN_ID } from "@/db/schema/core";
import type {
  auditEvents,
  legalEntities,
  roles,
  timelineEvents,
  timelineRoleMoments,
  users,
} from "@/db/schema/core";
import type {
  contractObligations,
  contracts,
  controls,
  impactTolerances,
  kriReadings,
  kris,
  processes,
  risks,
  serviceDependencies,
  services,
  subprocessors,
  suppliers,
} from "@/db/schema/domain";
import type {
  assessmentLines,
  assessments,
  controlTests,
  incidentEvents,
  incidents,
  obligations,
  policies,
  recoveryOptions,
  regulatoryPublications,
  testCases,
} from "@/db/schema/practice";
import type {
  calendarEvents,
  collaborationMessages,
  evidenceDocuments,
  inboxMessages,
  meetingMessages,
  meetings,
} from "@/db/schema/work";
import type {
  actions,
  backgroundActions,
  cachedAiOutputs,
  committeeItems,
  decisionOptions,
  decisions,
  issues,
  portfolioThemes,
} from "@/db/schema/decisions";

export { DEFAULT_RUN_ID };

/** The one scenario day. Tuesday, 06.10.2026. */
export const SCENARIO_DATE = "2026-10-06";

/** Convenience: an ISO timestamp on the scenario day at a given moment. */
export function at(moment: string): string {
  const [hours = "00", minutes = "00"] = moment.split(":");
  return `${SCENARIO_DATE}T${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}:00.000Z`;
}

/** The ten shared timeline moments, by moment identifier. */
export const MOMENTS = {
  M01: "07:45",
  M02: "08:10",
  M03: "08:45",
  M04: "09:30",
  M05: "10:30",
  M06: "11:45",
  M07: "13:30",
  M08: "14:05",
  M09: "15:00",
  M10: "16:30",
} as const;

export const ENTITY_DE = "ARC-DE";
export const ENTITY_AT = "ARC-AT";
export const ENTITY_CH = "ARC-CH";

/** Row types for every seeded table. */
export type NewLegalEntity = typeof legalEntities.$inferInsert;
export type NewUser = typeof users.$inferInsert;
export type NewRole = typeof roles.$inferInsert;
export type NewTimelineEvent = typeof timelineEvents.$inferInsert;
export type NewTimelineRoleMoment = typeof timelineRoleMoments.$inferInsert;
export type NewAuditEvent = typeof auditEvents.$inferInsert;

export type NewSupplier = typeof suppliers.$inferInsert;
export type NewSubprocessor = typeof subprocessors.$inferInsert;
export type NewService = typeof services.$inferInsert;
export type NewServiceDependency = typeof serviceDependencies.$inferInsert;
export type NewImpactTolerance = typeof impactTolerances.$inferInsert;
export type NewContract = typeof contracts.$inferInsert;
export type NewContractObligation = typeof contractObligations.$inferInsert;
export type NewProcess = typeof processes.$inferInsert;
export type NewRisk = typeof risks.$inferInsert;
export type NewControl = typeof controls.$inferInsert;
export type NewKri = typeof kris.$inferInsert;
export type NewKriReading = typeof kriReadings.$inferInsert;

export type NewAssessment = typeof assessments.$inferInsert;
export type NewAssessmentLine = typeof assessmentLines.$inferInsert;
export type NewControlTest = typeof controlTests.$inferInsert;
export type NewTestCase = typeof testCases.$inferInsert;
export type NewIncident = typeof incidents.$inferInsert;
export type NewIncidentEvent = typeof incidentEvents.$inferInsert;
export type NewRecoveryOption = typeof recoveryOptions.$inferInsert;
export type NewRegulatoryPublication = typeof regulatoryPublications.$inferInsert;
export type NewObligation = typeof obligations.$inferInsert;
export type NewPolicy = typeof policies.$inferInsert;

export type NewInboxMessage = typeof inboxMessages.$inferInsert;
export type NewCalendarEvent = typeof calendarEvents.$inferInsert;
export type NewMeeting = typeof meetings.$inferInsert;
export type NewMeetingMessage = typeof meetingMessages.$inferInsert;
export type NewCollaborationMessage = typeof collaborationMessages.$inferInsert;
export type NewEvidenceDocument = typeof evidenceDocuments.$inferInsert;

export type NewIssue = typeof issues.$inferInsert;
export type NewAction = typeof actions.$inferInsert;
export type NewDecision = typeof decisions.$inferInsert;
export type NewDecisionOption = typeof decisionOptions.$inferInsert;
export type NewCommitteeItem = typeof committeeItems.$inferInsert;
export type NewBackgroundAction = typeof backgroundActions.$inferInsert;
export type NewPortfolioTheme = typeof portfolioThemes.$inferInsert;
export type NewCachedAiOutput = typeof cachedAiOutputs.$inferInsert;
