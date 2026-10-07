/**
 * When a routine is due, and for what: the scenario clock against each
 * routine's trigger.
 *
 * Pure. The runner loads the facts and this module decides, so the timing
 * rules are tested without a database. Every window has a key, and the run's
 * idempotency key is the routine, the scenario day and that window
 * (`routineRunKey`). An object already prepared by an earlier window of the
 * same routine is left out of later ones. Together that is the rule "one
 * run per routine, window and object": a sync, a worker poll and a second
 * browser tab asking at the same moment all find the same run.
 *
 *   meeting preparation   before-meeting, `offsetMinutes` (seeded -30): due
 *                         from start plus offset until the meeting starts. A
 *                         meeting that has already started is not prepared:
 *                         a brief that arrives after the meeting began helps
 *                         nobody, and the clock may have jumped past it.
 *   action follow-up      daily at `time`: once the clock reaches it, for the
 *                         actions on the desk owned by someone else that are
 *                         overdue or due within two days.
 *   inbox triage          on arrival: once per batch of messages the clock has
 *                         revealed that no person has classified and no
 *                         earlier run proposed.
 *   event monitoring      hourly: the material changes of the day so far that
 *                         no earlier run raised.
 */

import type { RoutineKind } from "@/features/partner/tasks";

export interface RoutineWindow {
  /** Unique within the routine and the day, for example "meeting:MTG-2026-0005" or "hour:14". */
  windowKey: string;
  triggerKind: "schedule" | "event" | "before-meeting";
  /** The meeting, message batch or event that fired it, when one did. */
  triggerRef: string | null;
  /** The objects the run prepares something for. Empty only for an hourly watch that finds nothing. */
  targets: string[];
}

export function minutesOf(moment: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(moment);
  return match ? Number(match[1]) * 60 + Number(match[2]) : -1;
}

/** "2026-10-06T10:30:00.000Z" to "10:30", the scenario clock form the calendar stores. */
export function clockOf(iso: string): string {
  return iso.length >= 16 && iso[10] === "T" ? iso.slice(11, 16) : iso;
}

export function routineRunKey(routineId: string, scenarioDate: string, windowKey: string): string {
  return `routine:${routineId}:${scenarioDate}:${windowKey}`;
}

/* ==========================================================================
   Meeting preparation
   ========================================================================== */

export interface CalendarFact {
  meetingId: string | null;
  kind: string;
  startsAt: string;
}

export function meetingWindows(
  calendar: readonly CalendarFact[],
  input: { now: string; scenarioDate: string; offsetMinutes: number; concluded: ReadonlySet<string>; prepared: ReadonlySet<string> },
): RoutineWindow[] {
  const now = minutesOf(input.now);
  const lead = Math.abs(input.offsetMinutes);
  const out: RoutineWindow[] = [];
  for (const entry of calendar) {
    if (!entry.meetingId || entry.kind === "focus-time") continue;
    if (entry.startsAt.slice(0, 10) !== input.scenarioDate) continue;
    if (input.concluded.has(entry.meetingId) || input.prepared.has(entry.meetingId)) continue;
    const start = minutesOf(clockOf(entry.startsAt));
    if (start < 0 || now < start - lead || now >= start) continue;
    out.push({
      windowKey: `meeting:${entry.meetingId}`,
      triggerKind: "before-meeting",
      triggerRef: entry.meetingId,
      targets: [entry.meetingId],
    });
  }
  return out;
}

/* ==========================================================================
   Action follow-up
   ========================================================================== */

export interface ActionFact {
  id: string;
  status: string;
  dueOn: string | null;
  ownerUserId: string | null;
  ownerLabel: string;
  priority: string;
}

/** Days from one ISO date to another. */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * The actions a reminder is worth drafting for: open, owned by someone other
 * than the person (a reminder to oneself is not a follow-up), and overdue or
 * due within two days. Overdue first, then the earliest due.
 */
export function followUpCandidates(
  actions: readonly ActionFact[],
  input: { holderUserId: string | null; scenarioDate: string; limit?: number },
): ActionFact[] {
  return actions
    .filter((action) => action.status !== "completed" && action.status !== "cancelled")
    .filter((action) => action.dueOn !== null && daysBetween(input.scenarioDate, action.dueOn) <= 2)
    .filter((action) => action.ownerLabel.trim().length > 0 || (action.ownerUserId !== null && action.ownerUserId !== input.holderUserId))
    .sort((a, b) => (a.dueOn ?? "").localeCompare(b.dueOn ?? "") || a.id.localeCompare(b.id))
    .slice(0, input.limit ?? 5);
}

export function followUpWindows(
  candidates: readonly ActionFact[],
  input: { now: string; time: string; drafted: ReadonlySet<string> },
): RoutineWindow[] {
  if (minutesOf(input.now) < minutesOf(input.time)) return [];
  const targets = candidates.map((action) => action.id).filter((id) => !input.drafted.has(id));
  return targets.length === 0 ? [] : [{ windowKey: "day", triggerKind: "schedule", triggerRef: null, targets }];
}

/* ==========================================================================
   Inbox triage
   ========================================================================== */

export interface MessageFact {
  id: string;
  revealedAtMoment: string;
  confirmedTriage: string | null;
  conversionKind: string | null;
  linkedActionId: string | null;
  linkedDecisionId: string | null;
}

export function triageWindows(
  messages: readonly MessageFact[],
  input: { now: string; proposed: ReadonlySet<string> },
): RoutineWindow[] {
  const now = minutesOf(input.now);
  const waiting = messages.filter(
    (message) =>
      minutesOf(message.revealedAtMoment) <= now &&
      message.confirmedTriage === null &&
      message.conversionKind === null &&
      message.linkedActionId === null &&
      message.linkedDecisionId === null &&
      !input.proposed.has(message.id),
  );
  if (waiting.length === 0) return [];
  const latest = waiting.reduce((max, message) => (minutesOf(message.revealedAtMoment) > minutesOf(max) ? message.revealedAtMoment : max), "00:00");
  return [
    {
      windowKey: `arrivals:${latest}`,
      triggerKind: "event",
      triggerRef: waiting[0]?.id ?? null,
      targets: waiting.map((message) => message.id),
    },
  ];
}

/* ==========================================================================
   Event monitoring
   ========================================================================== */

export interface EventFact {
  id: string;
  atMoment: string;
  origin: "backbone" | "live-event";
  type: string;
  /** For an arrival: its type and severity, from the projection row. */
  liveEventType: string | null;
  severity: string | null;
  derivedFrom: string | null;
}

/**
 * The material changes in a list of events.
 *
 * A source change on a running stage, and an arrival that is a shared event
 * or of high or critical severity. Decisions that arrive are input needed,
 * not a change, and Updates already raises them; messages are the inbox
 * triage routine's; prepared background work is already announced as such.
 */
export function materialChanges(events: readonly EventFact[], now: string): EventFact[] {
  const bound = minutesOf(now);
  return events.filter((event) => {
    if (minutesOf(event.atMoment) > bound) return false;
    if (event.origin === "backbone") return event.type === "source-changed";
    if (event.liveEventType === "decision-required" || event.liveEventType === "message" || event.liveEventType === "agent-action") {
      return false;
    }
    if (event.derivedFrom === "inbox" || event.derivedFrom === "background-action" || event.derivedFrom === "decision") return false;
    return event.liveEventType === "shared-event" || event.severity === "high" || event.severity === "critical";
  });
}

export function monitoringWindows(
  changes: readonly EventFact[],
  input: { now: string; raised: ReadonlySet<string> },
): RoutineWindow[] {
  /*
   * The watch runs once an hour whether or not anything changed, and a run
   * that finds nothing is recorded as such ("no change"). It is never a
   * notification and never a Home statement: it has no subject and created
   * nothing.
   */
  const targets = changes.map((change) => change.id).filter((id) => !input.raised.has(id));
  const hour = String(Math.max(0, Math.floor(minutesOf(input.now) / 60))).padStart(2, "0");
  return [{ windowKey: `hour:${hour}`, triggerKind: "schedule", triggerRef: targets[0] ?? null, targets }];
}

/** The window rule each routine kind applies, for tests and for the runner's dispatch. */
export const WINDOW_RULE: Record<RoutineKind, string> = {
  "meeting-preparation": "before-meeting",
  "action-follow-up": "daily",
  "inbox-triage": "on-arrival",
  "event-monitoring": "hourly",
};
