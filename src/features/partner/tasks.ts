/**
 * The AI Partner's task kinds and the prompt version each one runs.
 *
 * Pure. A task kind is what the Product Owner Console groups AI quality by
 * (plan 7.5), so every output the Partner produces carries one: the chat
 * answer, the prepared suggestion, and the four routines. The prompt version
 * names the instructions and composition rules in this build; it rises when
 * either changes, so feedback given on an output can be traced to what
 * produced it after a release.
 */

export const ROUTINE_KINDS = ["meeting-preparation", "action-follow-up", "inbox-triage", "event-monitoring"] as const;
export type RoutineKind = (typeof ROUTINE_KINDS)[number];

export type PartnerTaskKind = "suggestion" | "chat-answer" | RoutineKind;

export const PARTNER_PROMPT_VERSIONS: Record<PartnerTaskKind, string> = {
  suggestion: "partner-suggestion-v1",
  "chat-answer": "partner-chat-v1",
  "meeting-preparation": "routine-meeting-preparation-v1",
  "action-follow-up": "routine-action-follow-up-v1",
  "inbox-triage": "routine-inbox-triage-v1",
  "event-monitoring": "routine-event-monitoring-v1",
};

/**
 * The routine kind behind each `ai_routines.output_kind`.
 *
 * Output kinds with no entry (the morning brief, the calendar digest, the
 * freshness report) have no runner in this release and never run.
 */
export const ROUTINE_KIND_BY_OUTPUT: Readonly<Record<string, RoutineKind>> = {
  "meeting-preparation": "meeting-preparation",
  "follow-up-digest": "action-follow-up",
  "inbox-triage": "inbox-triage",
  "alert-digest": "event-monitoring",
  "supplier-alert-digest": "event-monitoring",
};

export function isRoutineKind(value: unknown): value is RoutineKind {
  return typeof value === "string" && (ROUTINE_KINDS as readonly string[]).includes(value);
}
