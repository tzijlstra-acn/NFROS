/**
 * The common assembly for every V2 workday route.
 *
 * Eight routes need the same five things: the scenario state, the context
 * drawer content, the AI Partner, the live day bar and the shell. Only the
 * centre content differs. Putting the common part here means a route file is
 * three lines and cannot forget the disclosure, the drawer or the partner.
 *
 * It also means the partner and the live day bar are mounted identically on
 * all eight routes, which is what the acceptance criteria require: the partner
 * is available on every workday route, and the live day state is shared rather
 * than per screen.
 */

import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { isDatabaseReady } from "@/db/client";
import { ROLE_IDS, type AutonomyLevel, type RoleId } from "@/db/schema/core";
import { getDecisions, getRole } from "@/db/repositories/workday";
import { buildIntelligenceRail, uncertaintyFromEvidence } from "@/db/repositories/rail";
import { getRoleMoments, getScenarioState, getTimeline } from "@/scenario/engine/state";
import { NotSeeded } from "@/components/shell/WorkdayShell";
import { bootstrapServer } from "@/server/bootstrap";
import type { Language } from "@/i18n/labels";
import type { WorkdaySelection } from "@/workday/contracts";
import { triggerCounts } from "@/workday/context-counts";
import { AppShellV2 } from "./AppShellV2";
import { PartnerPresenceSlot, PartnerSlot } from "./PartnerSlot";
import { LiveDaySlot } from "./LiveDaySlot";

/** Validates the dynamic segment, which comes from the URL. */
export function parseRole(value: string): RoleId {
  if ((ROLE_IDS as readonly string[]).includes(value)) return value as RoleId;
  notFound();
}

export interface WorkdayV2RouteProps {
  roleId: RoleId;
  activeNav: string;
  /** Renders the centre workspace once the scenario is known. */
  children: (context: {
    roleId: RoleId;
    language: Language;
    currentMoment: string;
    viewedMoment: string;
    holderUserId: string;
    /** Short role and entity label for a route eyebrow. */
    roleTitleHint: string;
    /**
     * Counts for the compact context triggers, derived from the SAME rail the
     * drawer renders.
     *
     * Two assemblers produced two answers: the trigger read "Evidence 9" from
     * one evidence set and the drawer it opened showed 7 from another. A count
     * the user cannot rely on is worse than no count, because it is the thing
     * they use to decide whether opening the drawer is worth it.
     */
    contextCounts: Record<
      "evidence" | "uncertainty" | "policy" | "approvals" | "activity" | "audit",
      number
    >;
    autonomyLevel: AutonomyLevel;
    worldView: "today" | "future";
  }) => ReactNode;
  /** Shown in the top bar, when the route has one object in focus. */
  currentObjectLabel?: string | null;
  /** Every object identifier this route exposes, for the selection guard. */
  selectableIds?: readonly string[];
  /** A selection resolved on the server from the query string. */
  initialSelection?: WorkdaySelection | null;
}

export async function WorkdayV2Route({
  roleId,
  activeNav,
  children,
  currentObjectLabel = null,
  selectableIds = [],
  initialSelection = null,
}: WorkdayV2RouteProps) {
  /*
   * Wire the cross layer seams before reading anything.
   *
   * Idempotent, so the cost after the first call is a boolean check. It is
   * here rather than in a layout because this is the one module every
   * interactive route passes through, and a seam that is only wired on some
   * routes is worse than one that is not wired at all.
   */
  bootstrapServer();

  if (!isDatabaseReady()) return <NotSeeded />;
  const state = getScenarioState();
  if (!state) return <NotSeeded />;
  const role = getRole(roleId);
  if (!role) return <NotSeeded />;

  const language = state.language as Language;
  const timeline = getTimeline();
  const currentEvent = timeline.find((moment) => moment.moment === state.currentMoment);
  const roleMoments = getRoleMoments(roleId);
  const currentRoleMoment = roleMoments.find(
    (entry) => entry.event.moment === state.currentMoment,
  )?.roleMoment;

  const evidenceIds = currentRoleMoment?.evidenceIds ?? [];
  const openDecisions = getDecisions(roleId, state.currentMoment).filter(
    (entry) => entry.decision.status === "open",
  );

  /*
   * The drawer content is assembled by the same single mapper the V1
   * intelligence rail used. That is deliberate: two assemblers would show
   * subtly different evidence on different screens and the user could not
   * rely on either.
   */
  const rail = buildIntelligenceRail({
    roleId,
    atMoment: state.currentMoment,
    language,
    contextLabel: currentRoleMoment
      ? `${state.currentMoment} ${currentEvent?.title ?? ""}: ${currentRoleMoment.headline}`
      : `${state.currentMoment} ${currentEvent?.title ?? "Current moment"}`,
    evidenceIds,
    whyThisMatters: openDecisions.slice(0, 3).map((entry) => entry.decision.whyThisMatters),
    uncertainty: [
      ...uncertaintyFromEvidence(evidenceIds),
      ...(currentRoleMoment?.uncertaintyNote
        ? [
            {
              topic: language === "de" ? "Offener Punkt" : "Open point at this moment",
              description: currentRoleMoment.uncertaintyNote,
              kind: "judgment-required" as const,
              resolutionPath:
                language === "de"
                  ? "Das loest das Urteil der Fachperson, nicht mehr Daten."
                  : "This is resolved by the professional's judgment, not by more data.",
              materialToDecision: true,
              sourceIds: [],
            },
          ]
        : []),
    ],
  });

  return (
    <AppShellV2
      roleId={roleId}
      activeNav={activeNav}
      rail={rail}
      currentObjectLabel={currentObjectLabel}
      selectableIds={selectableIds}
      initialSelection={initialSelection}
      partner={<PartnerSlot roleId={roleId} language={language} state={state} />}
      partnerPresence={<PartnerPresenceSlot roleId={roleId} language={language} state={state} />}
      liveDay={<LiveDaySlot />}
    >
      {children({
        roleId,
        language,
        currentMoment: state.currentMoment,
        viewedMoment: state.currentMoment,
        holderUserId: role.holderUserId,
        roleTitleHint: `${language === "de" ? role.titleDe : role.title}`,
        contextCounts: triggerCounts(rail),
        autonomyLevel: state.autonomyLevel,
        worldView: state.worldView,
      })}
    </AppShellV2>
  );
}
