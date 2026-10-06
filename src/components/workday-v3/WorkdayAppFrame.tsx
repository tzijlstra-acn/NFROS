/**
 * The persistent workday frame.
 *
 * Rendered by `app/workday/[role]/layout.tsx`, so it survives navigation
 * between the child routes and it streams before the page's own data. That is
 * the whole fix for the header defect, stated as an architecture rather than
 * as a workaround: the header is no longer inside the thing it was waiting
 * for.
 *
 * The frame is a three row grid on the normal document, not a fixed viewport
 * root. `height: 100dvh` plus `overflow: hidden` gives the same containment
 * the V2 shell used `position: fixed` for, without taking the header out of
 * flow and without any JavaScript measuring anything.
 *
 * It builds its own header model, which is a handful of lookups and two
 * counts, and it cannot reach evidence retrieval, a connector, an AI call or a
 * workspace view: `buildHeaderModel` does not import them.
 *
 * There is exactly ONE chrome provider, wrapping everything. Two would give
 * the header and the body separate state, so the AI trigger in the header
 * could not open the dock in the body, which is the kind of bug that looks
 * like a wiring mistake and is actually a tree mistake. The shell overlays,
 * search with the command palette and the Updates panel, sit inside it for
 * the same reason.
 *
 * The rail's counts come from the header model, so each is the count of the
 * page it links to. Home carries no count: the only number Home shows is how
 * many items need the person's judgment, which the focus queue decides, and
 * the frame does not build the focus queue. It used to show the unread
 * arrival count there, which no part of Home displayed.
 */

import type { ReactNode } from "react";
import { buildHeaderModel } from "@/db/repositories/header";
import type { Language } from "@/i18n/labels";
import { ShellOverlays } from "@/components/shell/ShellOverlays";
import { WorkdayChromeProvider, type WdTheme } from "./ChromeContext";
import { WorkdayHeader } from "./WorkdayHeader";
import { WorkdayBody } from "./WorkdayBody";
import { WorkdayHeaderFallback } from "./WorkdayHeaderFallback";
import { WorkdayNavigation, type NavigationCounts } from "./WorkdayNavigation";
import { WorkdayPanels } from "./WorkdayPanels";
import { WorkdayUpdatesBar } from "./WorkdayUpdatesBar";

export function WorkdayAppFrame({
  roleParam,
  theme,
  demoMode,
  navExpanded,
  children,
}: {
  roleParam: string;
  theme: WdTheme;
  demoMode: boolean;
  navExpanded: boolean;
  children: ReactNode;
}) {
  /*
   * The model is built here and never throws. A role that does not resolve
   * yields the `Workday` label, which the brief accepts, rather than an error
   * that would take the header with it.
   */
  const model = buildHeaderModel(roleParam);
  const language = model.language as Language;

  /* A role the release gate does not open shows its release page and counts nothing. */
  const gated = model.releaseStatus !== null && model.releaseStatus !== "available";

  const counts: NavigationCounts =
    model.degraded || gated
      ? { myWork: 0, decisions: 0, mail: 0 }
      : { myWork: 0, decisions: model.decisionsOpen, mail: 0 };

  return (
    <div className="workday-v3" data-wd-theme={theme}>
      <WorkdayChromeProvider
        initialTheme={theme}
        initialDemoMode={demoMode}
        initialNavExpanded={navExpanded}
      >
        {/*
          * No skip link here. The root layout (`app/layout.tsx`) already puts
          * one first in every document, pointing at the same `#main`, and a
          * second identical link made the keyboard's first stop ambiguous.
          */}
        <div className="wd-frame">
          {/*
            * The fallback is used only when the scenario itself is missing,
            * which is a different case from the page being slow. The page
            * being slow is handled by `loading.tsx`, which keeps this real
            * header rendered.
            */}
          {model.degraded ? (
            <WorkdayHeaderFallback language={language} />
          ) : (
            <WorkdayHeader model={model} />
          )}

          <WorkdayBody
            nav={<WorkdayNavigation roleId={roleParam} language={language} counts={counts} />}
          >
            {children}
          </WorkdayBody>

          <WorkdayUpdatesBar
            language={language}
            updatesCount={model.updatesCount}
            roleId={roleParam}
            gated={gated}
          />
        </div>

        <WorkdayPanels language={language} roleId={roleParam} />
        <ShellOverlays
          roleId={roleParam}
          language={language}
          enabled={!model.degraded && !gated}
          updatesCount={model.updatesCount}
        />
      </WorkdayChromeProvider>
    </div>
  );
}
