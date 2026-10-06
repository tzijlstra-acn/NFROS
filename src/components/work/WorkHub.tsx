/**
 * WorkHub: the page body of the Work Hub.
 *
 * The shell and nothing else: the title and its counted context line, the
 * four tabs, the master and detail panes, the binding that hands the
 * selection to the drawer and the AI Partner, and the synthetic data label.
 * It renders a `WorkHubView` and decides nothing about the work in it.
 */

import { COPY, say } from "@/features/work/copy";
import type { WorkHubView } from "@/features/work/hub";
import { ContextBinding } from "./ContextBinding";
import { DetailPane } from "./DetailPane";
import { QueuePane } from "./QueuePane";
import { WorkTabs } from "./WorkTabs";

export function WorkHub({ view }: { view: WorkHubView }) {
  const { language } = view;
  return (
    <div
      className="wd-work"
      data-presentation-region={view.roleId === "rcsa" ? "rcsa-work-hub" : "tprm-work-hub"}
      data-presentation-ready="true"
      data-testid="work-hub"
      data-tab={view.query.tab}
      data-selected-item={view.detail?.id ?? ""}
    >
      <div className="wd-work-head">
        <div>
          <h1 className="wd-page-title">{view.pageTitle}</h1>
          <p className="wd-context-line" data-testid="work-context-line">
            {view.contextLine}
          </p>
        </div>
        <span className="wd-synthetic">{say(COPY.synthetic, language)}</span>
      </div>

      <WorkTabs tabs={view.tabs} label={say(COPY.tabsLabel, language)} />

      <div className="wd-work-md">
        <QueuePane queue={view.queue} language={language} />
        <DetailPane view={view} />
      </div>

      <ContextBinding bound={view.bound} />
    </div>
  );
}
