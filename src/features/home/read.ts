/**
 * The Home read model: one call, every region, read from rows.
 *
 * The route calls `readHomeView` once and renders what it returns. Nothing in
 * the route or the component decides what the day contains, which is the
 * structural form of the rule that Home shows no fallback: there is no place
 * left to put one.
 *
 * Every source is read through `guarded`. A source that throws (a table a
 * fresh clone has not migrated yet, for example) becomes `null`, and the
 * assembler reports that region or statement source as Unavailable instead of
 * breaking the page or pretending the source was empty. The focus queue is the
 * exception: it is the page, and if it cannot be built the route's error
 * boundary is the honest response.
 */

import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import type { RoleId } from "@/db/schema/core";
import { backgroundActions } from "@/db/schema/decisions";
import { aiActivityEntries, workdayLiveEvents } from "@/db/schema/live";
import { roleAppRuns, roleAppStageRuns } from "@/db/schema/role-app-runtime";
import {
  buildFocusHeadline,
  buildFocusQueueView,
  buildNowDetail,
  firstClause,
  HANDLED_BACKGROUND_KINDS,
  NEXT_LIMIT,
} from "@/db/repositories/focus";
import { getActiveSuggestions } from "@/db/repositories/partner";
import { getOutputsForRoutineRuns } from "@/db/repositories/ai-routine-runs";
import {
  getBackgroundWork,
  getCalendar,
  getDecisions,
  getExecutionReceipt,
  getInbox,
  getMeetings,
  getRole,
  getUserNameMap,
} from "@/db/repositories/workday";
import { getActionUpdatesFor, getWorkActions } from "@/db/repositories/work-hub";
import { listOsEvents, type OsEventView } from "@/features/events/backbone";
import { classifyAction } from "@/features/work/modules/actions/policy";
import { getProcessDefinition, getRoleApp } from "@/role-apps/registry";
import type { ScenarioState } from "@/scenario/engine/state";
import { createLogger } from "@/server/logging/redact";
import { momentToMinutes } from "@/domain/nfr/calculators";
import type { Language } from "@/i18n/labels";
import type { AISuggestionView, FocusItemView } from "@/workday/contracts";
import {
  assembleDone,
  assemblePartnerUpdate,
  assembleYourDay,
  happenedToday,
  whatChangedFrom,
  type ActivityInput,
  type DayWindow,
  type ReceiptInput,
  type StageDecisionDoneInput,
  type StageDoneInput,
} from "./assemble";
import type { HomeNow, HomeView } from "./types";

const log = createLogger("home");
const db = () => getDb();

/** Reads one source, or reports that it could not be read. */
function guarded<T>(source: string, read: () => T): T | null {
  try {
    return read();
  } catch (error) {
    log.warn("A Home source could not be read.", { source, error });
    return null;
  }
}

function isClock(value: string): boolean {
  return /^\d{1,2}:\d{2}$/.test(value);
}

/** Backbone events that belong to this working day and not to its future. */
function inDay(event: OsEventView, day: DayWindow): boolean {
  if (!happenedToday(event.occurredAt, day)) return false;
  if (event.atMoment && isClock(event.atMoment)) {
    return momentToMinutes(event.atMoment) <= momentToMinutes(day.atMoment);
  }
  return true;
}

function localised(language: Language, en: string, de: string | null | undefined): string {
  return language === "de" && de && de.length > 0 ? de : en;
}

/* ==========================================================================
   Now
   ========================================================================== */

function readWhatChanged(
  item: FocusItemView,
  suggestions: AISuggestionView[] | null,
  runId: string,
  language: Language,
): Pick<HomeNow, "whatChanged" | "whatChangedSource"> {
  const suggestion =
    (item.suggestionId ? suggestions?.find((row) => row.id === item.suggestionId) : undefined) ??
    (item.decisionId ? suggestions?.find((row) => row.decisionId === item.decisionId) : undefined) ??
    null;

  const event = item.eventId
    ? guarded("live event", () =>
        db()
          .select({ id: workdayLiveEvents.id, summary: workdayLiveEvents.summary, summaryDe: workdayLiveEvents.summaryDe })
          .from(workdayLiveEvents)
          .where(and(eq(workdayLiveEvents.runId, runId), eq(workdayLiveEvents.id, item.eventId as string)))
          .get(),
      )
    : null;

  const backgroundId = item.id.startsWith("focus-background-") ? item.id.slice("focus-background-".length) : null;
  const background = backgroundId
    ? guarded("background action", () =>
        db()
          .select({ id: backgroundActions.id, description: backgroundActions.description })
          .from(backgroundActions)
          .where(and(eq(backgroundActions.runId, runId), eq(backgroundActions.id, backgroundId)))
          .get(),
      )
    : null;

  const found = whatChangedFrom(item, {
    suggestion: suggestion ? { id: suggestion.id, changeSummary: suggestion.changeSummary } : null,
    event: event ? { id: event.id, summary: localised(language, event.summary, event.summaryDe) } : null,
    background: background ?? null,
  });
  return { whatChanged: found?.text ?? null, whatChangedSource: found?.source ?? null };
}

/* ==========================================================================
   Process runtime, read narrowly
   ========================================================================== */

/**
 * The role's process runs and their completed stages.
 *
 * Columns are selected explicitly rather than with `select()`, so Home keeps
 * working on a database whose process tables have gained columns this module
 * does not read.
 */
function readStages(roleId: RoleId, runId: string, language: Language): {
  runs: Map<string, string>;
  stages: StageDoneInput[];
} {
  const runs = db()
    .select({ id: roleAppRuns.id, roleAppId: roleAppRuns.roleAppId })
    .from(roleAppRuns)
    .where(and(eq(roleAppRuns.runId, runId), eq(roleAppRuns.roleId, roleId)))
    .all();
  const byRun = new Map(runs.map((run) => [run.id, run.roleAppId]));

  const stages: StageDoneInput[] = [];
  for (const run of runs) {
    const app = getRoleApp(run.roleAppId);
    const definition = app ? getProcessDefinition(app.processId) : undefined;
    const rows = db()
      .select({
        id: roleAppStageRuns.id,
        stageId: roleAppStageRuns.stageId,
        status: roleAppStageRuns.status,
        completedAt: roleAppStageRuns.completedAt,
      })
      .from(roleAppStageRuns)
      .where(and(eq(roleAppStageRuns.runId, runId), eq(roleAppStageRuns.roleAppRunId, run.id)))
      .all();
    for (const row of rows) {
      const stage = definition?.stages.find((candidate) => candidate.id === row.stageId);
      stages.push({
        id: row.id,
        roleAppId: run.roleAppId,
        stageId: row.stageId,
        stageName: stage ? localised(language, stage.name, stage.nameDe) : row.stageId,
        status: row.status,
        completedAt: row.completedAt,
      });
    }
  }
  return { runs: byRun, stages };
}

/* ==========================================================================
   The whole Home
   ========================================================================== */

export function readHomeView(roleId: RoleId, state: ScenarioState): HomeView {
  const runId = state.runId;
  const atMoment = state.currentMoment;
  const language: Language = state.language;
  const day: DayWindow = { scenarioDate: state.scenarioDate, seededAt: state.seededAt, atMoment };
  const now = momentToMinutes(atMoment);

  /* ---- The queue: Now, Next, Watching and the handled rows ------------- */
  const queue = buildFocusQueueView({ roleId, atMoment, language, runId });
  const suggestions = guarded("suggestions", () =>
    getActiveSuggestions(roleId, atMoment, { language, limit: 50, runId }),
  );

  let homeNow: HomeNow | null = null;
  if (queue.now) {
    const detail = buildNowDetail(queue.now, { roleId, atMoment, language, runId, whyStyle: "sentence" });
    homeNow = { detail, ...readWhatChanged(queue.now, suggestions, runId, language) };
  }

  /*
   * One inline AI line at most, and only when it says something the Now card
   * does not. The budget is one inline suggestion, and one clause rather than
   * two sentences, because the block has room for one line.
   */
  const decisions = guarded("decisions", () => getDecisions(roleId, atMoment, runId));
  const settled = new Set(
    (decisions ?? []).filter((entry) => entry.decision.status !== "open").map((entry) => entry.decision.id),
  );
  // A suggestion whose decision has been made is history, stated in the Partner update, not a prompt.
  // A routine's suggestion (`SUG-RTN-`) is stated by its run in the Partner update, not as the inline line.
  const first = suggestions?.find(
    (row) => !row.id.startsWith("SUG-RTN-") && (row.decisionId === null || !settled.has(row.decisionId)),
  );
  const lead = first ? (first.actionsCompleted[0] ?? first.checksCompleted[0] ?? null) : null;
  const suggestion =
    first && lead ? { id: first.id, body: firstClause(lead), href: `/workday/${roleId}/decisions` } : null;

  /* ---- Rows shared by several regions --------------------------------- */
  const calendar = guarded("calendar", () => getCalendar(roleId, runId));
  /*
   * The actions are the role's desk exactly as the Work Hub reads it (raised
   * by the role, or owned by the person who holds it), classified by the Work
   * Hub's own rule with each action's history. Blocked lives in that history,
   * not in a status column, so this is the only way the two screens agree.
   */
  const actions = guarded("actions", () => {
    const holderUserId = getRole(roleId, runId)?.holderUserId ?? null;
    const rows = getWorkActions(roleId, holderUserId, runId);
    const updates = getActionUpdatesFor(rows.map((row) => row.id), runId);
    return rows.map((row) => ({
      row,
      state: classifyAction(row, updates.get(row.id) ?? [], holderUserId, state.scenarioDate, null),
    }));
  });
  const inbox = guarded("inbox", () => getInbox(roleId, atMoment, runId));
  /* Who converted a message is stored on it (migration 0008); the statement names them, or says "you". */
  const roleHolderUserId = guarded("role", () => getRole(roleId, runId)?.holderUserId ?? null) ?? null;
  const people = guarded("people", () => getUserNameMap(runId));
  const background = guarded("background work", () => getBackgroundWork(roleId, atMoment, runId));
  const meetings = guarded("meetings", () => getMeetings(roleId, runId));
  const process = guarded("process runtime", () => readStages(roleId, runId, language));
  const backbone = guarded("event backbone", () =>
    listOsEvents({
      runId,
      roleId,
      types: ["ai-preparation-completed", "routine-completed", "decision-recorded"],
      language,
    }).filter((event) => inDay(event, day)),
  );
  const activity = guarded("activity", () =>
    db()
      .select({
        id: aiActivityEntries.id,
        kind: aiActivityEntries.kind,
        label: aiActivityEntries.label,
        labelDe: aiActivityEntries.labelDe,
        atMoment: aiActivityEntries.atMoment,
        objectType: aiActivityEntries.objectType,
        objectId: aiActivityEntries.objectId,
        suggestionId: aiActivityEntries.suggestionId,
      })
      .from(aiActivityEntries)
      .where(and(eq(aiActivityEntries.runId, runId), eq(aiActivityEntries.roleId, roleId)))
      .orderBy(asc(aiActivityEntries.sequence))
      .all()
      .filter((row) => isClock(row.atMoment) && momentToMinutes(row.atMoment) <= now),
  );

  /* ---- Your day -------------------------------------------------------- */
  const yourDay = assembleYourDay({
    roleId,
    language,
    day,
    calendar: calendar?.map((row) => ({
      id: row.id,
      title: row.title,
      titleDe: row.titleDe,
      startsAt: row.startsAt,
      kind: row.kind,
      meetingId: row.meetingId,
    })) ?? null,
    actions:
      actions?.map(({ row, state: classified }) => ({
        id: row.id,
        open: classified.open,
        overdue: classified.overdue,
        blocked: classified.blocked,
      })) ?? null,
    inbox: inbox?.map((row) => ({
      id: row.id,
      isRead: row.isRead,
      proposedTriage: row.proposedTriage,
      confirmedTriage: row.confirmedTriage,
      conversionKind: row.conversionKind,
    })) ?? null,
  });

  /* ---- Partner update -------------------------------------------------- */
  const runs = process?.runs ?? new Map<string, string>();
  const receipts: ReceiptInput[] | null = decisions
    ? decisions
        .filter((entry) => entry.decision.status === "decided")
        .map((entry) => ({
          decisionId: entry.decision.id,
          decisionTitle: localised(language, entry.decision.title, entry.decision.titleDe),
          decidedAtMoment: entry.decision.decidedAtMoment,
          lines: (guarded("receipt", () => getExecutionReceipt(entry.decision.id, runId)) ?? [])
            .filter((line) => !isClock(line.executedAtMoment) || momentToMinutes(line.executedAtMoment) <= now)
            .map((line) => ({
              id: line.id,
              objectKind: line.objectKind,
              objectId: line.objectId,
              statement: localised(language, line.statement, line.statementDe),
            })),
        }))
    : null;

  /*
   * Routine lineage (AI Partner, Wave 3). A routine run states what it
   * prepared, each output linked; the suggestions it prepared are stated by
   * that run, not a second time as prepared suggestions.
   */
  const routineEvents = backbone?.filter((event) => event.type === "routine-completed") ?? null;
  const routineOutputs =
    guarded("routine runs", () =>
      getOutputsForRoutineRuns(
        (routineEvents ?? [])
          .map((event) => event.payload["routineRunId"])
          .filter((value): value is string => typeof value === "string"),
      ),
    ) ?? new Map<string, Array<{ objectKind: string; objectId: string }>>();
  const routineSuggestions = new Set<string>();
  for (const list of routineOutputs.values()) for (const output of list) if (output.objectKind === "suggestion") routineSuggestions.add(output.objectId);

  const partner = assemblePartnerUpdate({
    roleId,
    language,
    suggestions:
      suggestions?.filter((row) => !routineSuggestions.has(row.id)).map((row) => ({
        id: row.id,
        headline: row.headline,
        status: row.status,
        atMoment: row.atMoment,
        decisionId: row.decisionId,
        objectType: row.objectType,
        objectId: row.objectId,
      })) ?? null,
    preparations:
      backbone
        ?.filter((event) => event.type === "ai-preparation-completed")
        .map((event) => ({
          id: event.id,
          summary: event.summary,
          atMoment: event.atMoment,
          processId: event.processRunId ? (runs.get(event.processRunId) ?? null) : null,
          stageId: event.stageId,
          activityEntryId: event.activityEntryId,
        })) ?? null,
    routines:
      routineEvents?.map((event) => ({
        id: event.id,
        summary: event.summary,
        atMoment: event.atMoment,
        subjectKind: event.subjectKind,
        subjectId: event.subjectId,
        activityEntryId: event.activityEntryId,
        outputs: (typeof event.payload["routineRunId"] === "string" ? (routineOutputs.get(event.payload["routineRunId"]) ?? []) : []).map(
          (output) => ({ kind: output.objectKind, id: output.objectId }),
        ),
      })) ?? null,
    receipts,
    conversions:
      inbox?.map((row) => ({
        messageId: row.id,
        subject: localised(language, row.subject, row.subjectDe),
        atMoment: row.revealedAtMoment,
        conversionKind: row.conversionKind,
        convertedBy: row.convertedByUserId ? (people?.get(row.convertedByUserId) ?? null) : null,
        convertedByYou: row.convertedByUserId !== null && row.convertedByUserId === roleHolderUserId,
        linkedActionId: row.linkedActionId,
        linkedDecisionId: row.linkedDecisionId,
      })) ?? null,
    background:
      background?.actions.map((row) => ({
        id: row.id,
        kind: row.kind,
        targetKind: row.targetKind,
        targetId: row.targetId,
        targetLabel: row.targetLabel,
        performedAtMoment: row.performedAtMoment,
      })) ?? null,
    activity:
      activity?.map<ActivityInput>((row) => ({
        id: row.id,
        kind: row.kind,
        label: localised(language, row.label, row.labelDe),
        atMoment: row.atMoment,
        objectType: row.objectType,
        objectId: row.objectId,
        suggestionId: row.suggestionId,
      })) ?? null,
    shownSuggestionId: suggestion?.id ?? null,
  });

  /* ---- Done ------------------------------------------------------------ */
  const backgroundCounts: Record<string, number> = {};
  for (const kind of HANDLED_BACKGROUND_KINDS) {
    backgroundCounts[kind] = background?.actions.filter((row) => row.kind === kind).length ?? 0;
  }

  const stageDecisions: StageDecisionDoneInput[] | null =
    backbone
      ?.filter((event) => event.type === "decision-recorded" && event.actorKind === "human")
      .map((event) => ({
        id: event.id,
        summary: event.summary,
        occurredAt: event.occurredAt,
        atMoment: event.atMoment,
        decisionId: typeof event.payload["decisionId"] === "string" ? (event.payload["decisionId"] as string) : null,
        decisionKey: typeof event.payload["decisionKey"] === "string" ? (event.payload["decisionKey"] as string) : null,
        correlationId: event.correlationId,
        processId: event.processRunId ? (runs.get(event.processRunId) ?? null) : null,
        stageId: event.stageId,
      })) ?? null;

  const done = assembleDone({
    roleId,
    day,
    handledRows: queue.sections.handled,
    backgroundCounts,
    decisions:
      decisions?.map((entry) => ({
        id: entry.decision.id,
        title: localised(language, entry.decision.title, entry.decision.titleDe),
        status: entry.decision.status,
        decidedAtMoment: entry.decision.decidedAtMoment,
      })) ?? null,
    stageDecisions,
    stages: process?.stages ?? null,
    actions:
      actions?.map(({ row, state: classified }) => ({
        id: row.id,
        title: localised(language, row.title, row.titleDe),
        status: classified.completed ? "completed" : row.status,
        completedOn: row.completedOn,
      })) ?? null,
    meetings:
      meetings?.map((row) => ({
        id: row.id,
        title: localised(language, row.title, row.titleDe),
        status: row.status,
        concludedAt: row.concludedAt,
      })) ?? null,
  });

  return {
    roleId,
    language,
    atMoment,
    contextLine: buildFocusHeadline(roleId, atMoment, language, runId),
    now: homeNow,
    next: queue.next.slice(0, NEXT_LIMIT),
    watching: queue.watching,
    suggestion,
    queueHref: `/workday/${roleId}/decisions`,
    yourDay,
    partner,
    done,
    counts: queue.counts,
  };
}
