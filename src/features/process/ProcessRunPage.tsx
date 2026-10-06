/**
 * The process page for one installed Role App.
 *
 * Shared by both process routes, so the routes stay thin: they resolve the
 * role and the selected stage from the URL and hand both here. Everything the
 * page shows comes from the engine's view of the persisted run. With no run,
 * the page says so; there is no static stand-in run, stage text or artifact.
 *
 * Server component.
 */

import type { ReactNode } from "react";
import { isDatabaseReady } from "@/db/client";
import type { RoleId } from "@/db/schema/core";
import { getScenarioState } from "@/scenario/engine/state";
import type { Language } from "@/i18n/labels";
import { ProcessMap } from "@/components/workday-v3/ProcessMap";
import { StageWorkspace } from "@/components/workday-v3/StageWorkspace";
import { PROCESS_COPY as C, say } from "./copy";
import { buildProcessPageView } from "./view";

export interface ProcessRunPageProps {
  roleId: RoleId;
  roleAppId: string;
  title: { en: string; de: string };
  basePath: string;
  stageParam: string | undefined;
  /** `?run=`: another run of the same app, when it has several. */
  runParam?: string | undefined;
  /**
   * An app's own view above the stage map, for example the list of its runs.
   * Given the run on screen, so it can mark it. Optional and app owned; the
   * engine renders whatever it returns and decides nothing from it.
   */
  renderHeader?: (processRunId: string, language: Language) => ReactNode;
}

function Synthetic({ language }: { language: Language }) {
  return (
    <span style={{ display: "block", marginTop: "var(--wd-10)", fontSize: 12, color: "var(--wd-text-muted)" }}>
      {say(C.synthetic, language)}
    </span>
  );
}

export function ProcessRunPage({ roleId, roleAppId, title, basePath, stageParam, runParam, renderHeader }: ProcessRunPageProps) {
  const state = isDatabaseReady() ? getScenarioState() : null;
  const language: Language = state?.language === "de" ? "de" : "en";
  const view = state ? buildProcessPageView({ roleId, roleAppId, stageParam, language, basePath, ...(runParam ? { runParam } : {}) }) : null;

  if (!view) {
    return (
      <div className="wd-main-inner">
        <h1 className="wd-page-title">{say(title, language)}</h1>
        <p style={{ marginTop: "var(--wd-4)", fontSize: "var(--wd-text-sm)", color: "var(--wd-text-muted)" }}>{say(C.noRun, language)}</p>
        <Synthetic language={language} />
      </div>
    );
  }

  return (
    <div className="wd-main-inner" data-process-run={view.processRunId}>
      <h1 className="wd-page-title">{view.appName}</h1>
      <p className="wd-context-line" style={{ marginTop: "var(--wd-1)" }}>
        {view.subtitle}
      </p>
      <p data-testid="process-status-line" style={{ fontSize: "var(--wd-text-sm)", color: "var(--wd-text-muted)", marginTop: "var(--wd-1)" }}>
        {view.statusLine}
      </p>

      {renderHeader ? renderHeader(view.processRunId, language) : null}

      <div style={{ marginTop: "var(--wd-6)" }}>
        <ProcessMap
          stages={view.stages}
          currentStageId={view.currentStageId}
          completedStageIds={view.completedStageIds}
          language={language}
          basePath={view.basePath}
          selectedStageId={view.selectedStageId}
        />
      </div>

      <StageWorkspace view={view.stage} language={language} />

      <p style={{ marginTop: "var(--wd-6)", fontSize: 11, color: "var(--wd-text-muted)" }}>{say(C.regulatoryNote, language)}</p>
      <Synthetic language={language} />
    </div>
  );
}
