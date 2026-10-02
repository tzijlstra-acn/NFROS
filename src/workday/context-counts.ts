/**
 * The counts behind the compact context triggers.
 *
 * Split out of `ContextDrawer.tsx` for the same reason the selection URL
 * format was split out of `SelectionProvider.tsx`: that module carries the
 * client directive, and a server component calling a function out of a client
 * module fails at runtime with "Attempted to call triggerCounts() from the
 * server". The counts have to be derived on the server, because the server is
 * where the rail is assembled.
 *
 * It is one pure function over the rail props. The reason it must be the ONLY
 * derivation is that there used to be two: a trigger read "Evidence 9" from
 * one evidence set and the drawer it opened showed 7 from another. A count the
 * user cannot rely on is worse than no count, because the count is the thing
 * they use to decide whether opening the drawer is worth the interruption.
 */

import type { IntelligenceRailProps } from "@/components/shell/IntelligenceRail";

export const DRAWER_TABS = [
  "evidence",
  "uncertainty",
  "policy",
  "approvals",
  "activity",
  "audit",
] as const;

export type DrawerTab = (typeof DRAWER_TABS)[number];

export type ContextCounts = Record<DrawerTab, number>;

/**
 * Builds the trigger counts from the rail the drawer will render.
 *
 * Uncertainty and contradictions are summed because the drawer presents them
 * on one tab: a contradiction IS an uncertainty, and counting them separately
 * would make the tab's own contents disagree with the number on its trigger.
 */
export function triggerCounts(rail: IntelligenceRailProps): ContextCounts {
  return {
    evidence: rail.evidence.length,
    uncertainty: rail.uncertainty.length + rail.contradictions.length,
    policy: rail.policies.length,
    approvals: rail.approvals.length,
    activity: rail.agentActivity.length,
    audit: rail.auditTrail.length,
  };
}
