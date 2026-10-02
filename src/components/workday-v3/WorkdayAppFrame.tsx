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
 * like a wiring mistake and is actually a tree mistake.
 */

import type { ReactNode } from "react";
import { buildHeaderModel, countOpenDecisions } from "@/db/repositories/header";
import type { RoleId } from "@/db/schema/core";
import type { Language } from "@/i18n/labels";
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

  const counts: NavigationCounts = model.degraded
    ? { myWork: 0, decisions: 0, mail: 0 }
    : {
        myWork: model.updatesCount,
        decisions: countOpenDecisions(roleParam as RoleId),
        mail: 0,
      };

  return (
    <div className="workday-v3" data-wd-theme={theme}>
      <WorkdayChromeProvider
        initialTheme={theme}
        initialDemoMode={demoMode}
        initialNavExpanded={navExpanded}
      >
        {/* Skip-to-main link: visible on keyboard focus, hidden otherwise. */}
        <a href="#main" className="skip-link">
          Skip to main content
        </a>

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
            <WorkdayHeader model={model} roleId={roleParam} />
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
          />
        </div>

        <WorkdayPanels language={language} roleId={roleParam} />
      </WorkdayChromeProvider>
    </div>
  );
}
