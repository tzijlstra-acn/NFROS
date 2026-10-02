/**
 * The V2 workday shell.
 *
 * Server component. It reads the scenario, resolves the product configuration,
 * assembles the chrome and hands the whole thing to the client frame. The route
 * supplies three slots: the centre workspace, the AI Partner dock and the live
 * day bar.
 *
 * The shell stays stable when the role changes; only the centre work object,
 * the queue and the partner context change. That is the product's structural
 * argument about orchestration being common across non-financial risk
 * functions, and it is worth making literally true in the component tree
 * rather than merely asserting it in the copy. V1 made the same choice and it
 * is carried forward deliberately.
 */

import type { ReactNode } from "react";
import type { RoleId } from "@/db/schema/core";
import { getResolvedDemoMode, getRuntimeStatus } from "@/server/config/runtime";
import { requireScenarioState, SHARED_EVENT_MOMENT } from "@/scenario/engine/state";
import { buildShellChrome } from "@/db/repositories/shell";
import type { IntelligenceRailProps } from "@/components/shell/IntelligenceRail";
import type { Language } from "@/i18n/labels";
import type { WorkdaySelection } from "@/workday/contracts";
import { SyntheticDisclosure } from "./primitives";
import { ShellFrame } from "./ShellFrame";
import { getViewedMoment } from "./viewed-moment";

export interface AppShellV2Props {
  roleId: RoleId;
  activeNav: string;
  /** The centre workspace. */
  children: ReactNode;
  /** The AI Partner dock. */
  partner: ReactNode;
  /** The collapsed presence rail, shown at the narrowest width. */
  partnerPresence?: ReactNode;
  /** The live day bar. */
  liveDay: ReactNode;
  /** Context drawer content, assembled by the route with buildIntelligenceRail. */
  rail: IntelligenceRailProps;
  drawerSubtitle?: string;
  /** The work object or service in focus, shown in the top bar. */
  currentObjectLabel?: string | null;
  /** Every object identifier this route exposes, from the view model. */
  selectableIds?: readonly string[];
  /** A selection resolved on the server, typically from the query string. */
  initialSelection?: WorkdaySelection | null;
}

export function AppShellV2({
  roleId,
  activeNav,
  children,
  partner,
  partnerPresence,
  liveDay,
  rail,
  drawerSubtitle,
  currentObjectLabel = null,
  selectableIds = [],
  initialSelection = null,
}: AppShellV2Props) {
  const state = requireScenarioState();
  const language = state.language as Language;
  const demoMode = getResolvedDemoMode();
  const runtime = getRuntimeStatus();

  const chrome = buildShellChrome(roleId, {
    atMoment: state.currentMoment,
    language,
    autonomyLevel: state.autonomyLevel,
  });

  return (
    <ShellFrame
      roleId={roleId}
      activeNav={activeNav}
      language={language}
      brand={chrome.brand}
      roleOptions={chrome.roleOptions}
      roleTitle={chrome.roleTitle}
      holderName={chrome.holderName}
      entityName={chrome.entityName}
      navCounts={chrome.navCounts}
      commandRoles={chrome.commandRoles}
      commandIndex={chrome.commandIndex}
      liveMoment={state.currentMoment}
      viewedMoment={getViewedMoment(state.runId, state.currentMoment)}
      autonomyLevel={state.autonomyLevel}
      worldView={state.worldView}
      mode={demoMode.mode}
      modeReason={demoMode.reason ?? null}
      /*
       * Live mode is offered only when a key actually resolved AND the process
       * is permitted to call out. Offering it otherwise produces a silent
       * downgrade that a presenter discovers mid sentence.
       */
      liveAvailable={runtime.openai.liveModeAvailable}
      sharedEventMoment={SHARED_EVENT_MOMENT}
      currentObjectLabel={currentObjectLabel}
      rail={rail}
      selectableIds={selectableIds}
      initialSelection={initialSelection}
      {...(drawerSubtitle ? { drawerSubtitle } : {})}
      partner={partner}
      {...(partnerPresence ? { partnerPresence } : {})}
      liveDay={liveDay}
      disclosure={<SyntheticDisclosure language={language} />}
    >
      {children}
    </ShellFrame>
  );
}
