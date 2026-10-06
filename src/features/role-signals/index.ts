/**
 * Role signals: one line of real work per Available role.
 *
 * `read.ts` is the read model the landing page and the role selector call.
 * `assemble.ts` holds the pure rules it applies, exported for tests.
 */

export type {
  FocusSignal,
  MeetingSignal,
  ProcessSignal,
  ProcessStageMark,
  RoleSignals,
  SignalState,
} from "./types";
export {
  focusSignalFrom,
  meetingSignalFrom,
  NON_MEETING_KINDS,
  processSignalFrom,
  selectNextMeeting,
  startTimeOf,
  unavailableSignals,
} from "./assemble";
export {
  formatScenarioDate,
  installedRoleAppFor,
  processDefinitionFor,
  readRoleSignalOverview,
  readRoleSignals,
  signalRowLabels,
  type AvailableRoleView,
  type RoleSignalOverview,
} from "./read";
export { pick, ROLE_SIGNAL_LABELS, STAGE_STATUS_LABELS } from "./labels";
