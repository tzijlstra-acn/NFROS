/**
 * The Agenda module's one write: recording a meeting as held.
 *
 * Server only, called from the hub's server actions. The dependent actions
 * are recomputed here from the database rather than taken from the browser,
 * so the person approves the follow-ups the server would write, and the
 * approval's fingerprint binds to exactly that list.
 */

import type { RoleId } from "@/db/schema/core";
import { requireScenarioState } from "@/scenario/engine/state";
import { fill, say } from "../../copy";
import { minutesOf, timeOf } from "../../model";
import { runGovernedChain } from "../../governance";
import { loadWorkShared } from "../../hub-data";
import { dependentActions } from "../meeting-facts";
import type { OperationOutcome } from "../actions/operations";

const MESSAGES = {
  notYours: {
    en: "This meeting is not on this role's agenda, so nothing was recorded.",
    de: "Diese Besprechung steht nicht auf der Agenda dieser Rolle, daher wurde nichts erfasst.",
  },
  confirm: {
    en: "Confirm that the meeting took place and that the outcome is your record of it.",
    de: "Bestaetigen Sie, dass die Besprechung stattgefunden hat und das Ergebnis Ihre Aufzeichnung ist.",
  },
  notStarted: {
    en: "The meeting starts at {time}. It can be recorded as held once it has started.",
    de: "Die Besprechung beginnt um {time}. Sie kann erfasst werden, sobald sie begonnen hat.",
  },
  done: { en: "Recorded.", de: "Erfasst." },
} as const;

export async function recordMeetingHeld(input: {
  roleId: RoleId;
  meetingId: string;
  outcome: string;
  confirmed: boolean;
}): Promise<OperationOutcome> {
  const state = requireScenarioState();
  const language = state.language;
  const shared = loadWorkShared(input.roleId);
  const meeting = shared?.meetings.find((candidate) => candidate.id === input.meetingId);
  if (!shared || !meeting) {
    const message = say(MESSAGES.notYours, language);
    return { ok: false, message, receipt: [], blocked: [message] };
  }
  if (!input.confirmed) {
    const message = say(MESSAGES.confirm, language);
    return { ok: false, message, receipt: [], blocked: [message] };
  }
  /*
   * Checked before an approval is recorded, so a premature request leaves
   * no approval behind. The handler refuses it again on its own.
   */
  if (
    meeting.scheduledFor.slice(0, 10) === state.scenarioDate &&
    minutesOf(timeOf(meeting.scheduledFor)) > minutesOf(state.currentMoment)
  ) {
    const message = fill(say(MESSAGES.notStarted, language), { time: timeOf(meeting.scheduledFor) });
    return { ok: false, message, receipt: [], blocked: [message] };
  }

  const dependentIds = dependentActions(meeting, shared).map((action) => action.id);
  const chain = await runGovernedChain(
    [
      {
        toolName: "recordMeetingHeld",
        payload: { meetingId: meeting.id, outcome: input.outcome, dependentActionIds: dependentIds },
      },
    ],
    { roleId: input.roleId, confirmed: true, rationale: input.outcome, subjectKind: "meeting", subjectId: meeting.id },
  );

  return {
    ok: chain.ok,
    message: chain.ok ? say(MESSAGES.done, language) : (chain.blocked[0] ?? ""),
    receipt: chain.receipt,
    blocked: chain.blocked,
  };
}
