/**
 * Which events are material, and whether they still are.
 *
 * Pure. The read model (`read.ts`) reads the backbone, the arrivals, the open
 * decisions and the action register; this file decides what each of them
 * means for Updates. Kept apart so the rules can be tested without a database
 * and so there is exactly one place that says what "material" means.
 *
 * The six categories and what raises each:
 *
 *   Execution failed      a stage preparation failed, or a governed change in a
 *                         stage was not executed.
 *   Process blocked       a stage preparation is waiting for a required source,
 *                         or a stage opened that this release cannot complete.
 *   Your input is needed  a stage task, a stage decision, an approval or a
 *                         preparation that waits for a person to start it; and
 *                         a decision the scenario put in front of the role.
 *   Deadline              an action on the role's desk due today or tomorrow,
 *                         or already overdue.
 *   Material change       a stage source changed, or a high or critical arrival
 *                         the person has not read.
 *   New work from a       a routine finished and recorded the work it created,
 *   routine               or a prepared item from background work arrived.
 *
 * States versus messages. Most of these are states: an input is needed until
 * it is given, a preparation is blocked until it runs. Each is therefore
 * settled by the later event that ends it (the task completed, the decision
 * recorded, the approval granted, the preparation started again, the stage
 * completed), never by being looked at. Only arrivals are messages, and only
 * arrivals can be marked read. A list that let the person dismiss a decision
 * they have not taken would be a list that hides work.
 *
 * Changes are scoped to the working day; states are not. A task created on a
 * previous day and still open is still open.
 */

import type { OsEventView } from "@/features/events/backbone";
import type { Language } from "@/i18n/labels";
import { fill, say, UPDATE_TITLES } from "./copy";
import type { UpdateItem } from "./types";

export interface ClassifyContext {
  language: Language;
  /** Decisions the role can see at the current moment that are still open. */
  openDecisionIds: ReadonlySet<string>;
  /** Their titles, in the interface language. */
  decisionTitles: ReadonlyMap<string, string>;
  /** Arrivals this role has already read. */
  readEventIds: ReadonlySet<string>;
  /** "Stage 2: Evidence Refresh", or null when the stage is not known. */
  stageLabel(processRunId: string | null, stageId: string | null): string | null;
  /** The seeded decision a stage decision is bound to, or null for a decision owned by the stage. */
  seededDecisionId(processRunId: string | null, stageId: string | null, decisionKey: string): string | null;
  /** True for a stage completion approval tool, as opposed to a stage tool. */
  isStageCompletionTool(toolName: string): boolean;
  stageHref(processRunId: string | null, stageId: string | null): string;
  decisionHref(decisionId: string): string;
  /** Where a routine's recorded work opens. */
  subjectHref(subjectKind: string | null, subjectId: string | null): string;
  /** Where an arrival opens: the message, meeting or decision it projects, else Home. */
  arrivalHref(arrival: OsEventView): string;
  /** True when an event happened in this working day and not after the clock. */
  happenedToday(event: OsEventView): boolean;
}

function text(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** The work a routine recorded creating, if its payload says so. */
export function routineCreatedWork(payload: Record<string, unknown>): number {
  const count = payload["createdCount"];
  if (typeof count === "number" && Number.isFinite(count)) return Math.max(0, count);
  for (const key of ["createdWork", "createdIds", "created"]) {
    const list = payload[key];
    if (Array.isArray(list)) return list.length;
  }
  return 0;
}

const FAILED_TOOL_OUTCOMES: readonly string[] = ["failed", "blocked", "refused"];

function minutesOf(moment: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(moment);
  return match ? Number(match[1]) * 60 + Number(match[2]) : 0;
}

/**
 * One recency scale for backbone events and arrivals, higher is newer.
 *
 * The scenario clock of today's events leads, so a decision that arrived at
 * 16:30 ranks above a task opened at 07:45 whichever table it came from; an
 * event from an earlier day has no clock today and ranks below all of them.
 * The backbone sequence breaks ties between events at the same moment.
 */
export function recency(todayMoment: string | null, sequence: number): number {
  return (todayMoment ? minutesOf(todayMoment) + 1 : 0) * 100_000 + Math.max(0, sequence);
}

/* ==========================================================================
   Backbone events
   ========================================================================== */

export function classifyBackbone(events: readonly OsEventView[], ctx: ClassifyContext): UpdateItem[] {
  const ordered = [...events].filter((event) => event.origin === "backbone").sort((a, b) => a.sequence - b.sequence);
  const { language } = ctx;

  /* ---- Pass one: the facts that settle a state -------------------------- */
  const completedStages = new Set<string>();
  const notExecutable = new Set<string>();
  const completedTasks = new Map<string, number>();
  const recordedDecisions = new Map<string, number>();
  const grants: Array<{ correlationId: string; toolName: string; sequence: number }> = [];
  const preparationProgress = new Map<string, number>();
  const preparationCompleted = new Map<string, number>();

  for (const event of ordered) {
    const corr = event.correlationId ?? "";
    switch (event.type) {
      case "stage-completed":
        completedStages.add(corr);
        break;
      case "stage-opened":
        if (event.payload["executable"] === false) notExecutable.add(corr);
        break;
      case "human-task-completed": {
        const key = text(event.payload, "taskKey");
        if (key) completedTasks.set(`${corr}:${key}`, event.sequence);
        break;
      }
      case "decision-recorded": {
        const key = text(event.payload, "decisionKey");
        if (key) recordedDecisions.set(`${corr}:${key}`, event.sequence);
        break;
      }
      case "approval-granted": {
        const toolName = text(event.payload, "toolName");
        if (toolName) grants.push({ correlationId: corr, toolName, sequence: event.sequence });
        break;
      }
      case "ai-preparation-started":
        preparationProgress.set(corr, event.sequence);
        break;
      case "ai-preparation-completed":
        preparationProgress.set(corr, event.sequence);
        preparationCompleted.set(corr, event.sequence);
        break;
      default:
        break;
    }
  }

  const after = (map: ReadonlyMap<string, number>, key: string, sequence: number): boolean =>
    (map.get(key) ?? -1) > sequence;

  /* ---- Pass two: what is still material --------------------------------- */
  const items: UpdateItem[] = [];

  for (const event of ordered) {
    const corr = event.correlationId ?? "";
    if (corr && completedStages.has(corr)) continue;

    const stage = ctx.stageLabel(event.processRunId, event.stageId) ?? event.stageId ?? "";
    const stageHref = ctx.stageHref(event.processRunId, event.stageId);
    const today = ctx.happenedToday(event);
    const base = {
      atMoment: event.atMoment || null,
      when: today ? event.atMoment || null : displayDate(event.occurredAt),
      origin: "backbone" as const,
      sourceId: event.id,
      readableEventId: null,
      rank: recency(today ? event.atMoment : null, event.sequence),
    };

    switch (event.type) {
      case "stage-opened": {
        if (event.payload["executable"] !== false) break;
        items.push({
          ...base,
          key: `stage:${corr}`,
          category: "process-blocked",
          title: fill(say(UPDATE_TITLES.stageNotExecutable, language), { stage }),
          detail: null,
          href: stageHref,
        });
        break;
      }

      case "human-task-created": {
        if (notExecutable.has(corr)) break;
        const key = text(event.payload, "taskKey");
        if (!key || after(completedTasks, `${corr}:${key}`, event.sequence)) break;
        items.push({
          ...base,
          key: `task:${corr}:${key}`,
          category: "human-input-required",
          title: fill(say(UPDATE_TITLES.taskNeeded, language), { stage }),
          detail: event.summary,
          href: stageHref,
        });
        break;
      }

      case "decision-requested": {
        const key = text(event.payload, "decisionKey");
        if (!key) break;
        const seeded = ctx.seededDecisionId(event.processRunId, event.stageId, key);
        if (seeded) {
          if (!ctx.openDecisionIds.has(seeded)) break;
          items.push({
            ...base,
            key: `decision:${seeded}`,
            category: "human-input-required",
            title: fill(say(UPDATE_TITLES.decisionNeeded, language), { title: ctx.decisionTitles.get(seeded) ?? seeded }),
            detail: stage || null,
            href: ctx.decisionHref(seeded),
          });
          break;
        }
        if (after(recordedDecisions, `${corr}:${key}`, event.sequence)) break;
        items.push({
          ...base,
          key: `stage-decision:${corr}:${key}`,
          category: "human-input-required",
          title: fill(say(UPDATE_TITLES.stageDecisionNeeded, language), { stage }),
          detail: event.summary,
          href: stageHref,
        });
        break;
      }

      case "approval-requested": {
        /*
         * A tool approval is settled by a later grant for that tool; the stage
         * completion approval by a later grant for the app's completion tool.
         */
        const toolName = text(event.payload, "toolName");
        const subject = toolName ?? text(event.payload, "subject") ?? "approval";
        const granted = grants.some(
          (grant) =>
            grant.correlationId === corr &&
            grant.sequence > event.sequence &&
            (toolName ? grant.toolName === toolName : ctx.isStageCompletionTool(grant.toolName)),
        );
        if (granted) break;
        items.push({
          ...base,
          key: `approval:${corr}:${subject}`,
          category: "human-input-required",
          title: fill(say(UPDATE_TITLES.approvalNeeded, language), { stage }),
          detail: event.summary,
          href: stageHref,
        });
        break;
      }

      case "ai-preparation-held": {
        if (after(preparationProgress, corr, event.sequence)) break;
        const waitsForPerson = event.payload["state"] === "waiting-for-approval";
        items.push({
          ...base,
          key: `preparation:${corr}`,
          category: waitsForPerson ? "human-input-required" : "process-blocked",
          title: fill(
            say(waitsForPerson ? UPDATE_TITLES.preparationWaitsForYou : UPDATE_TITLES.preparationWaitsForSource, language),
            { stage },
          ),
          detail: event.summary,
          href: stageHref,
        });
        break;
      }

      case "ai-preparation-failed": {
        if (after(preparationProgress, corr, event.sequence)) break;
        items.push({
          ...base,
          key: `preparation:${corr}`,
          category: "execution-failed",
          title: fill(say(UPDATE_TITLES.preparationFailed, language), { stage }),
          detail: event.summary,
          href: stageHref,
        });
        break;
      }

      case "tool-executed": {
        const outcome = text(event.payload, "outcome");
        if (!outcome || !FAILED_TOOL_OUTCOMES.includes(outcome)) break;
        items.push({
          ...base,
          key: `tool:${corr}:${text(event.payload, "toolKey") ?? event.id}`,
          category: "execution-failed",
          title: fill(say(UPDATE_TITLES.toolFailed, language), { stage }),
          detail: event.summary,
          href: stageHref,
        });
        break;
      }

      case "source-changed": {
        if (!ctx.happenedToday(event)) break;
        if (after(preparationCompleted, corr, event.sequence)) break;
        items.push({
          ...base,
          key: `source:${corr}`,
          category: "material-change",
          title: fill(say(UPDATE_TITLES.sourceChanged, language), { stage }),
          detail: event.summary,
          href: stageHref,
        });
        break;
      }

      case "routine-completed": {
        if (!ctx.happenedToday(event) || routineCreatedWork(event.payload) === 0) break;
        items.push({
          ...base,
          key: `routine:${event.id}`,
          category: "routine-created-work",
          title: fill(say(UPDATE_TITLES.routineWork, language), { title: event.summary }),
          detail: null,
          href: ctx.subjectHref(event.subjectKind, event.subjectId),
        });
        break;
      }

      default:
        break;
    }
  }

  return items;
}

/* ==========================================================================
   Arrivals
   ========================================================================== */

const MATERIAL_SEVERITIES: readonly string[] = ["high", "critical"];

/**
 * Seeded arrivals, read through the backbone.
 *
 * A decision the scenario put in front of the role is a state: listed while
 * the decision is open, whether or not the arrival was read. A high or
 * critical arrival is a message: listed until it is read. Prepared work from
 * background routines is a message too. Everything else that arrives is not
 * material, and stays in the day's activity.
 */
export function classifyArrivals(arrivals: readonly OsEventView[], ctx: ClassifyContext): UpdateItem[] {
  const items: UpdateItem[] = [];
  const { language } = ctx;

  for (const arrival of arrivals) {
    if (arrival.origin !== "live-event") continue;
    const liveType = text(arrival.payload, "liveEventType");
    const severity = text(arrival.payload, "severity") ?? "";
    const derivedFrom = text(arrival.payload, "derivedFrom");
    const read = ctx.readEventIds.has(arrival.id);
    const base = {
      atMoment: arrival.atMoment || null,
      when: arrival.atMoment || null,
      origin: "live-event" as const,
      sourceId: arrival.id,
      rank: recency(arrival.atMoment, 0),
    };

    if (liveType === "decision-required") {
      const decisionId = arrival.correlationId;
      if (!decisionId || !ctx.openDecisionIds.has(decisionId)) continue;
      items.push({
        ...base,
        key: `decision:${decisionId}`,
        category: "human-input-required",
        title: fill(say(UPDATE_TITLES.decisionNeeded, language), {
          title: ctx.decisionTitles.get(decisionId) ?? arrival.summary,
        }),
        detail: null,
        href: ctx.decisionHref(decisionId),
        readableEventId: null,
      });
      continue;
    }

    if (read) continue;

    if (MATERIAL_SEVERITIES.includes(severity)) {
      items.push({
        ...base,
        key: `arrival:${arrival.id}`,
        category: "material-change",
        title: arrival.summary,
        detail: null,
        href: ctx.arrivalHref(arrival),
        readableEventId: arrival.id,
      });
      continue;
    }

    if (derivedFrom === "background-action") {
      items.push({
        ...base,
        key: `arrival:${arrival.id}`,
        category: "routine-created-work",
        title: fill(say(UPDATE_TITLES.routineWork, language), { title: arrival.summary }),
        detail: null,
        href: ctx.arrivalHref(arrival),
        readableEventId: arrival.id,
      });
    }
  }

  return items;
}

/* ==========================================================================
   Deadlines
   ========================================================================== */

export interface DeadlineInput {
  id: string;
  title: string;
  status: string;
  /** ISO date, for example 2026-10-07. */
  dueOn: string | null;
  href: string;
}

function dayNumber(isoDate: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return null;
  return Math.round(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86_400_000);
}

function display(isoDate: string): string {
  const [year, month, day] = isoDate.slice(0, 10).split("-");
  return `${day}.${month}.${year}`;
}

/** 01.10.2026 from an ISO timestamp, or null when it is not one. */
function displayDate(value: string | null | undefined): string | null {
  return value && /^\d{4}-\d{2}-\d{2}/.test(value) ? display(value) : null;
}

/**
 * Actions due today or tomorrow, or already overdue, on the scenario date.
 *
 * The backbone has no deadline event: nothing publishes one, and inventing one
 * would be a second account of a date the action register already holds. So
 * this one category is read from the register directly, on the scenario
 * calendar rather than the wall clock.
 */
export function deadlineUpdates(
  actions: readonly DeadlineInput[],
  scenarioDate: string,
  language: Language,
): UpdateItem[] {
  const today = dayNumber(scenarioDate);
  if (today === null) return [];
  const items: UpdateItem[] = [];

  for (const action of actions) {
    if (action.status === "completed" || action.status === "cancelled") continue;
    if (!action.dueOn) continue;
    const due = dayNumber(action.dueOn);
    if (due === null) continue;
    const days = due - today;
    const overdue = days < 0 || action.status === "overdue";
    if (!overdue && days > 1) continue;

    const template = overdue ? UPDATE_TITLES.overdue : days === 0 ? UPDATE_TITLES.dueToday : UPDATE_TITLES.dueTomorrow;
    items.push({
      key: `action-due:${action.id}`,
      category: "deadline-approaching",
      title: fill(say(template, language), { title: action.title, date: display(action.dueOn) }),
      detail: null,
      atMoment: null,
      when: null,
      href: action.href,
      origin: "action-register",
      sourceId: action.id,
      readableEventId: null,
      rank: 10 - days,
    });
  }

  return items;
}
