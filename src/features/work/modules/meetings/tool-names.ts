/**
 * The registry tools of the meeting lifecycle.
 *
 * A constant module of its own, with no imports, so the governance module,
 * the hub's gate evaluation and the read model can all name the tools
 * without importing one another.
 */

export const MEETING_LIFECYCLE_TOOLS = [
  "captureMeetingItem",
  "prepareMeetingMinutes",
  "editMeetingMinutes",
  "confirmMeetingMinutes",
  "distributeMeetingMinutes",
] as const;

export type MeetingLifecycleTool = (typeof MEETING_LIFECYCLE_TOOLS)[number];

/** Every tool the Meetings module asks the gate about, for the hub's one evaluation each. */
export const MEETING_TOOLS: readonly string[] = [...MEETING_LIFECYCLE_TOOLS];
