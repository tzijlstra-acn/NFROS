/**
 * Picks the detail body for the selected item's module.
 *
 * The only place the shell names the four modules. A module that grows (the
 * meeting lifecycle, the inbox conversion) changes its own detail component;
 * this switch only changes if a fifth kind of item is added.
 */

import type { WorkHubView } from "@/features/work/hub";
import type { WorkDetail } from "@/features/work/modules";
import { ActionDetailView } from "./ActionDetailView";
import { AgendaDetailView } from "./AgendaDetailView";
import { InboxDetailView } from "./InboxDetailView";
import { MeetingDetailView } from "./MeetingDetailView";

export function ModuleDetail({ detail, view }: { detail: WorkDetail; view: WorkHubView }) {
  switch (detail.kind) {
    case "event":
      return <AgendaDetailView detail={detail} roleId={view.roleId} language={view.language} />;
    case "meeting":
      return <MeetingDetailView detail={detail} language={view.language} />;
    case "action":
      return (
        <ActionDetailView detail={detail} roleId={view.roleId} language={view.language} scenarioDate={view.scenarioDate} />
      );
    case "message":
      return <InboxDetailView detail={detail} roleId={view.roleId} language={view.language} />;
  }
}
