/**
 * The pilot pages, one async server component each, so the route files in
 * `app/product/pilot/` stay a single line.
 *
 * Every page resolves the same three things in the same order: who is
 * acting (`readPilotAccess`), whether there is a pilot (`readPilotWorkspace`),
 * and then the page's own read model. The read models write nothing.
 */

import { readAdminLanguage } from "@/product/status/sources";
import { readPilotAccess, type PilotPage } from "../access";
import { buildExitDraft } from "../exit-draft";
import { readPilotReadiness } from "../readiness";
import { readPilotWeek } from "../weekly";
import { readPilotWorkspace, type PilotWorkspace } from "../workspace";
import type { PilotAccess } from "../access";
import { BaselineView } from "./BaselineView";
import { ExitView } from "./ExitView";
import { OverviewView } from "./OverviewView";
import { NoPilot, PilotFrame, PilotRestricted } from "./PilotFrame";
import { SetupView } from "./SetupView";
import { WeeklyView } from "./WeeklyView";

async function shell(
  page: PilotPage,
  render: (workspace: PilotWorkspace, access: PilotAccess, language: "en" | "de") => React.ReactNode,
) {
  const language = readAdminLanguage();
  const access = await readPilotAccess(page);
  const workspace = access.canOpen ? readPilotWorkspace() : null;
  return (
    <PilotFrame
      language={language}
      current={page}
      status={workspace?.status ?? null}
      name={workspace?.name ?? null}
      readOnly={access.canOpen && access.readOnly}
    >
      {!access.canOpen ? <PilotRestricted language={language} page={page} /> : !workspace ? <NoPilot language={language} /> : render(workspace, access, language)}
    </PilotFrame>
  );
}

export function PilotOverviewPage() {
  return shell("overview", (workspace, access, language) => (
    <OverviewView workspace={workspace} readiness={readPilotReadiness()} language={language} canDownload={access.can("release.generate-evidence-pack")} />
  ));
}

export function PilotSetupPage() {
  return shell("setup", (workspace, access, language) => <SetupView workspace={workspace} access={access} language={language} />);
}

export function PilotBaselinePage() {
  return shell("baseline", (workspace, access, language) => <BaselineView workspace={workspace} access={access} language={language} />);
}

export function PilotWeeklyPage({ week }: { week: string | null }) {
  return shell("weekly", (workspace, access, language) => (
    <WeeklyView workspace={workspace} week={readPilotWeek(workspace, week)} access={access} language={language} />
  ));
}

export function PilotExitPage() {
  return shell("exit", (workspace, access, language) => (
    <ExitView
      workspace={workspace}
      draft={workspace.status === "running" || workspace.status === "paused" ? buildExitDraft(workspace, language) : null}
      access={access}
      language={language}
    />
  ));
}
