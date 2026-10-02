"use client";

/**
 * The client half of the shell.
 *
 * It exists because three things about the chrome are genuinely client state:
 * whether the navigation rail is expanded, whether the AI Partner is open, and
 * whether the drawer or the palette is showing. Everything else about the
 * workday is server state read from the scenario database.
 *
 * The slots are React nodes rendered on the server and passed in. That is
 * deliberate and it is the reason opening the AI Partner does not remount the
 * centre workspace: the centre is a stable child of this component, so
 * toggling the partner changes a grid template and nothing else. An earlier
 * approach that rendered the centre from inside a conditional branch
 * remounted a role visualisation worth several thousand lines every time the
 * dock opened, which was visible as a flash and measurable as a stall.
 */

import type { ReactNode } from "react";
import type { AutonomyLevel, RoleId } from "@/db/schema/core";
import type { DemoMode } from "@/server/config/demo-mode";
import type { IntelligenceRailProps } from "@/components/shell/IntelligenceRail";
import type { Language } from "@/i18n/labels";
import { CommandPalette, type CommandIndexEntry, type CommandRole } from "@/components/command/CommandPalette";
import { AskAiProvider, SelectionProvider } from "./SelectionProvider";
import type { WorkdaySelection } from "@/workday/contracts";
import { NavigationRail, type NavCounts } from "./NavigationRail";
import { TopBarV2, type RoleOption } from "./TopBarV2";
import type { BrandIdentity } from "@/product";
import { ContextDrawer } from "./ContextDrawer";
import { ShellProvider, useShell } from "./ShellContext";

export interface ShellFrameProps {
  roleId: RoleId;
  activeNav: string;
  language: Language;

  brand: BrandIdentity;
  roleOptions: RoleOption[];
  roleTitle: string;
  holderName: string;
  entityName: string;
  navCounts: NavCounts;
  commandRoles: CommandRole[];
  commandIndex: CommandIndexEntry[];

  liveMoment: string;
  viewedMoment: string;
  autonomyLevel: AutonomyLevel;
  worldView: "today" | "future";
  mode: DemoMode;
  modeReason: string | null;
  liveAvailable: boolean;
  sharedEventMoment: string;
  currentObjectLabel: string | null;

  rail: IntelligenceRailProps;
  drawerSubtitle?: string;

  /** Every object identifier the current route exposes, from the view model. */
  selectableIds?: readonly string[];
  /** A selection resolved on the server, typically from `?select=`. */
  initialSelection?: WorkdaySelection | null;

  /** The centre workspace. */
  children: ReactNode;
  /** The AI Partner dock, rendered on the server. */
  partner: ReactNode;
  /** The collapsed presence rail shown at the narrowest width. */
  partnerPresence?: ReactNode;
  /** The live day bar. */
  liveDay: ReactNode;
  /** The permanent synthetic data disclosure. */
  disclosure: ReactNode;
}

export function ShellFrame(props: ShellFrameProps) {
  return (
    <ShellProvider>
      <ShellBody {...props} />
    </ShellProvider>
  );
}

/**
 * Routes an Ask AI request to the partner.
 *
 * A function cannot cross a server to client boundary, and the partner is a
 * server rendered node passed in as a slot, so the workspace cannot be handed
 * a callback that reaches into it. The bridge is a DOM event: the provider
 * opens the dock and dispatches, and the dock listens and prefills its
 * composer. That keeps the dock decoupled from the shell and avoids the
 * alternative, which was remounting the dock with a different initial tab and
 * losing the conversation in the process.
 */
export const ASK_PARTNER_EVENT = "nfr:ask-partner";

export interface AskPartnerDetail {
  prompt: string;
  selection: WorkdaySelection | null;
}

function ShellBody({
  roleId,
  activeNav,
  language,
  brand,
  roleOptions,
  roleTitle,
  holderName,
  entityName,
  navCounts,
  commandRoles,
  commandIndex,
  liveMoment,
  viewedMoment,
  autonomyLevel,
  worldView,
  mode,
  modeReason,
  liveAvailable,
  sharedEventMoment,
  currentObjectLabel,
  rail,
  drawerSubtitle,
  selectableIds = [],
  initialSelection = null,
  children,
  partner,
  partnerPresence,
  liveDay,
  disclosure,
}: ShellFrameProps) {
  const shell = useShell();

  /*
   * At the narrowest projected width the partner is a 48px presence rail and
   * opening it overlays rather than squeezing the centre, because the stated
   * acceptance criterion is that the work object remains the largest area at
   * every viewport and that no control is clipped. Above that width it is a
   * real column and opening it reflows.
   */
  const partnerColumn = shell.narrow || !shell.partnerOpen;

  const askPartner = (prompt: string, selection: WorkdaySelection | null) => {
    shell.setPartnerOpen(true);
    window.dispatchEvent(
      new CustomEvent<AskPartnerDetail>(ASK_PARTNER_EVENT, { detail: { prompt, selection } }),
    );
  };

  return (
    <div className="workday-v2">
      <TopBarV2
        brand={brand}
        roleId={roleId}
        roleOptions={roleOptions}
        language={language}
        entityName={entityName}
        holderName={holderName}
        roleTitle={roleTitle}
        currentObjectLabel={currentObjectLabel}
        liveMoment={liveMoment}
        viewedMoment={viewedMoment}
        mode={mode}
        modeReason={modeReason}
        liveAvailable={liveAvailable}
        worldView={worldView}
        unreadCount={navCounts.unread}
      />

      <div
        className="app-body"
        data-rail={shell.railExpanded ? "expanded" : "collapsed"}
        data-partner={partnerColumn ? "collapsed" : "open"}
      >
        <NavigationRail
          roleId={roleId}
          language={language}
          activeNav={activeNav}
          counts={navCounts}
        />

        <main id="main" className="app-main">
          <div className="app-main-inner">
            <SelectionProvider
              roleId={roleId}
              validObjectIds={selectableIds}
              initialSelection={initialSelection}
            >
              <AskAiProvider onAsk={askPartner}>{children}</AskAiProvider>
            </SelectionProvider>
          </div>
        </main>

        {/*
          * Three renderings, one mounted at a time, and the centre column is
          * outside all of them so none of this remounts the workspace.
          *
          * Wide and open  the dock is a column.
          * Narrow         the dock is a presence rail, and opening it puts
          *                the full dock in a floating panel over the right
          *                edge so the work object keeps its width.
          * Collapsed      the presence rail alone.
          */}
        {shell.narrow || !shell.partnerOpen ? partnerPresence : partner}

        {shell.narrow && shell.partnerOpen ? (
          <div
            style={{
              position: "fixed",
              top: "var(--app-topbar-h)",
              right: "var(--app-partner-w-collapsed)",
              bottom: "var(--app-liveday-h)",
              width: 336,
              maxWidth: "calc(100vw - 120px)",
              zIndex: 72,
              boxShadow: "var(--app-shadow-3)",
              display: "flex",
            }}
          >
            {partner}
          </div>
        ) : null}
      </div>

      {/*
        * The live day bar, with the permanent synthetic data disclosure pinned
        * to its right edge.
        *
        * The disclosure lives here rather than in the top bar. The brief
        * requires it to be permanent, and the top bar is the one place in the
        * shell where every control competes for width, so it is also the one
        * place the disclosure could be pushed out of view. The bottom bar
        * always has room.
        */}
      <div className="app-liveday">
        <div className="app-grow" style={{ minWidth: 0 }}>
          {liveDay}
        </div>
        <span className="app-divider-v" />
        {disclosure}
      </div>

      <ContextDrawer rail={rail} language={language} subtitle={drawerSubtitle} />

      <CommandPalette
        roleId={roleId}
        language={language}
        roles={commandRoles}
        index={commandIndex}
        autonomyLevel={autonomyLevel}
        worldView={worldView}
        sharedEventMoment={sharedEventMoment}
        onAskPartner={() => shell.setPartnerOpen(true)}
      />
    </div>
  );
}
