/**
 * Loads what the Agenda module needs beyond the shared hub data: the
 * documents in every meeting pack, so preparation is read from each
 * document's current status, and the audit trail of the selected entry's
 * meeting.
 */

import { getAuditForObject, getEvidenceByIds } from "@/db/repositories/work-hub";
import type { WorkSharedData } from "../../shared";
import type { WorkQuery } from "../../url";
import { packEvidenceIds } from "../meeting-facts";
import type { AgendaExtras } from "./read-model";

export function loadAgendaExtras(shared: WorkSharedData, query: WorkQuery): AgendaExtras {
  const selectedEvent = query.item ? shared.calendar.find((row) => row.id === query.item) : undefined;
  const meetingId = selectedEvent?.meetingId ?? null;
  return {
    packEvidence: getEvidenceByIds(packEvidenceIds(shared.meetings)),
    audit: meetingId ? new Map([[meetingId, getAuditForObject("meeting", meetingId)]]) : new Map(),
  };
}
