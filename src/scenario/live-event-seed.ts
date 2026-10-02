/**
 * Builds the live event projection from content that already exists.
 *
 * This is the module the whole live day rests on, and the constraint it has to
 * honour is the product's central claim: one institution, one day, six
 * functions. A second, disconnected event source would quietly break that. So
 * every row written here is derived from a seeded row, and every row records
 * where it came from in `derivedFrom` and `derivedFromId`. The integration
 * test resolves all of them; a row whose source does not exist fails the suite.
 *
 * Derivation rules, one per source:
 *
 *   timeline_events        -> one "signal" visible to every role, so the ten
 *                             shared moments are stops on the track. The 14:05
 *                             row becomes the single "shared-event".
 *   timeline_role_moments  -> "evidence", the two moments per role with the
 *                             most evidence in play.
 *   background_actions     -> "agent-action", the escalation each role's agent
 *                             raised before the professional arrived.
 *   inbox_messages         -> "message", the two highest priority arrivals
 *                             after the opening moment.
 *   meetings               -> "meeting", the first and the last of the day, so
 *                             the track is not clustered in the morning.
 *   decisions              -> "decision-required", every open decision
 *                             presented after the opening moment plus each
 *                             role's top ranked morning brief item.
 *   integration_events     -> written by the integration runtime, not here.
 *                             This module never deletes rows it did not write.
 *
 * Density is capped deliberately. Projecting all 165 background actions and
 * all 78 inbox messages would produce a track of indistinguishable dots and a
 * catch-up walk nobody would finish. The caps are stated above, are
 * deterministic, and are asserted in the verification script, so the
 * projection is reproducible rather than merely plausible.
 *
 * German strings follow the pattern documented in `src/i18n/labels.ts`: the
 * frame is German, and the scenario content is used in its German form where
 * the seed has one. Decision titles, meeting titles and timeline titles all
 * carry `titleDe`; inbox subjects mostly do not, so those fall back to the
 * seeded subject inside a German frame.
 */

import { and, asc, eq } from "drizzle-orm";
import { getDb, getSqlite } from "@/db/client";
import {
  DEFAULT_RUN_ID,
  ROLE_IDS,
  scenarioRuns,
  timelineEvents,
  timelineRoleMoments,
  type RoleId,
} from "@/db/schema/core";
import { backgroundActions, decisions } from "@/db/schema/decisions";
import {
  livePlayerState,
  workdayLiveEventReads,
  workdayLiveEvents,
  type LiveEventSeverity,
  type LiveEventType,
} from "@/db/schema/live";
import { inboxMessages, meetings } from "@/db/schema/work";
import { momentToMinutes } from "@/domain/nfr/calculators";

type EventInsert = typeof workdayLiveEvents.$inferInsert;

export interface LiveEventSeedSummary {
  runId: string;
  /** Rows written to `workday_live_events`. */
  events: number;
  /** Rows written to `workday_live_event_reads`. */
  readRows: number;
  /** How many of those read rows start read, because the day has passed them. */
  readAtOpen: number;
  /** The moment the day opens at, taken from the run row. */
  openMoment: string;
  byDerivedFrom: Record<string, number>;
  byType: Record<string, number>;
}

/**
 * Ordering inside one moment.
 *
 * The moment's own signal lands first so the track marker has a frame, the
 * decision lands last so the auto-pause happens after its context has arrived.
 * Pausing before the message that explains the decision would stop the day on
 * a question with nothing behind it.
 */
const GROUP_ORDER: Record<LiveEventType, number> = {
  signal: 0,
  "shared-event": 0,
  "agent-action": 1,
  message: 2,
  meeting: 3,
  evidence: 4,
  execution: 5,
  "decision-required": 6,
};

/** Judgment kinds that are a prioritisation choice rather than a risk judgment. */
const ROUTINE_JUDGMENT_KINDS = new Set(["agenda"]);

const CHANNEL_DE: Record<string, string> = {
  mail: "Post",
  collaboration: "Zusammenarbeit",
  "grc-queue": "GRC-Warteschlange",
  "service-management": "Service-Management",
  alert: "Warnmeldung",
};

const TRIAGE_DE: Record<string, string> = {
  decision: "Entscheidung",
  action: "Massnahme",
  evidence: "Nachweis",
  information: "Information",
  delegate: "Delegieren",
  noise: "Ohne Relevanz",
};

const MEETING_KIND_DE: Record<string, string> = {
  "rcsa-workshop": "RCSA-Workshop",
  "supplier-challenge": "Kritische Wuerdigung des Lieferanten",
  "supplier-call": "Lieferantengespraech",
  "crisis-call": "Krisenschaltung",
  committee: "Gremium",
  meeting: "Besprechung",
  "one-to-one": "Einzelgespraech",
  workshop: "Workshop",
};

function germanChannel(channel: string): string {
  return CHANNEL_DE[channel] ?? channel;
}

function germanTriage(triage: string): string {
  return TRIAGE_DE[triage] ?? triage;
}

function germanMeetingKind(kind: string): string {
  return MEETING_KIND_DE[kind] ?? "Besprechung";
}

/* ==========================================================================
   The projection
   ========================================================================== */

interface ProjectionInputs {
  runId: string;
  openMoment: string;
  createdAt: string;
}

function projectTimeline(input: ProjectionInputs): EventInsert[] {
  const rows = getDb()
    .select()
    .from(timelineEvents)
    .where(eq(timelineEvents.runId, input.runId))
    .orderBy(asc(timelineEvents.sortOrder))
    .all();

  return rows.map((row) => {
    const shared = row.isSharedEvent;
    const type: LiveEventType = shared ? "shared-event" : "signal";
    return {
      id: `WLE-TL-${row.id}`,
      runId: input.runId,
      atMoment: row.moment,
      sortOrder: 0,
      type,
      // Empty means every role, which is what makes the 14:05 event propagate
      // across functions without a copy of it per role.
      roleIds: [] as RoleId[],
      severity: (shared ? "critical" : "informational") satisfies LiveEventSeverity as LiveEventSeverity,
      title: row.title,
      titleDe: row.titleDe,
      summary: shared
        ? "Every non-financial risk function sees this event at the same moment, from its own angle and with its own decision to take."
        : row.description,
      summaryDe: shared
        ? "Jede Funktion fuer nichtfinanzielle Risiken sieht dieses Ereignis zum gleichen Zeitpunkt, aus eigener Perspektive und mit eigener Entscheidung."
        : `Gemeinsamer Zeitpunkt des Tages um ${row.moment}. ${row.titleDe}.`,
      objectType: "timeline",
      objectId: row.id,
      evidenceIds: [],
      requiresDecision: false,
      // The shared event is the one moment of the day the player must not roll
      // past: it is the beat every function has to see arrive.
      autoPause: shared,
      decisionId: null,
      derivedFrom: "timeline",
      derivedFromId: row.id,
      integrationEventId: null,
      sourceConnectorIds: [],
      createdAt: input.createdAt,
    };
  });
}

function projectRoleMoments(input: ProjectionInputs): EventInsert[] {
  const timeline = getDb()
    .select()
    .from(timelineEvents)
    .where(eq(timelineEvents.runId, input.runId))
    .orderBy(asc(timelineEvents.sortOrder))
    .all();
  const byId = new Map(timeline.map((row) => [row.id, row]));
  const sharedEventIds = new Set(timeline.filter((row) => row.isSharedEvent).map((row) => row.id));

  const out: EventInsert[] = [];

  for (const roleId of ROLE_IDS) {
    const moments = getDb()
      .select()
      .from(timelineRoleMoments)
      .where(
        and(eq(timelineRoleMoments.runId, input.runId), eq(timelineRoleMoments.roleId, roleId)),
      )
      .all();

    const candidates = moments
      .filter(
        (row) =>
          row.workObjectId !== null &&
          row.uncertaintyNote.length > 0 &&
          // The shared beat is already projected once, for every role.
          !sharedEventIds.has(row.timelineEventId),
      )
      .sort(
        (a, b) =>
          b.evidenceIds.length - a.evidenceIds.length ||
          a.timelineEventId.localeCompare(b.timelineEventId),
      )
      .slice(0, 2);

    for (const row of candidates) {
      const moment = byId.get(row.timelineEventId);
      if (!moment) continue;
      out.push({
        id: `WLE-RM-${row.id}`,
        runId: input.runId,
        atMoment: moment.moment,
        sortOrder: 0,
        type: "evidence",
        roleIds: [roleId],
        severity: "informational",
        title: row.headline,
        titleDe: `${moment.titleDe}: ${row.headline}`,
        summary: `Work object ${row.workObjectId ?? row.workObjectKind} with ${row.evidenceIds.length} evidence documents in play. Uncertainty is stated before anything is concluded.`,
        summaryDe: `Arbeitsobjekt ${row.workObjectId ?? row.workObjectKind} mit ${row.evidenceIds.length} Nachweisdokumenten im Zugriff. Unsicherheit wird vor jeder Schlussfolgerung benannt.`,
        objectType: row.workObjectKind,
        objectId: row.workObjectId ?? row.timelineEventId,
        evidenceIds: row.evidenceIds,
        requiresDecision: false,
        autoPause: false,
        decisionId: row.decisionIds[0] ?? null,
        derivedFrom: "timeline",
        derivedFromId: row.id,
        integrationEventId: null,
        sourceConnectorIds: [],
        createdAt: input.createdAt,
      });
    }
  }

  return out;
}

function projectBackgroundActions(input: ProjectionInputs): EventInsert[] {
  const out: EventInsert[] = [];

  for (const roleId of ROLE_IDS) {
    const rows = getDb()
      .select()
      .from(backgroundActions)
      .where(and(eq(backgroundActions.runId, input.runId), eq(backgroundActions.roleId, roleId)))
      .all()
      .filter((row) => row.kind === "escalated-to-human")
      .sort((a, b) => a.id.localeCompare(b.id))
      .slice(0, 1);

    for (const row of rows) {
      out.push({
        id: `WLE-BG-${row.id}`,
        runId: input.runId,
        atMoment: row.performedAtMoment,
        sortOrder: 0,
        type: "agent-action",
        roleIds: [roleId],
        severity: "medium",
        title: row.targetLabel,
        titleDe: `Zur menschlichen Entscheidung eskaliert: ${row.targetLabel}`,
        summary: row.description,
        summaryDe: `Automatisch vorbereitet und zur menschlichen Entscheidung eskaliert. Betroffen: ${row.targetKind} ${row.targetId}. Befugnisklasse: ${row.authorityClass}.`,
        objectType: row.targetKind,
        objectId: row.targetId,
        evidenceIds: row.evidenceIds,
        requiresDecision: false,
        /*
         * Not an auto-pause. The escalation is performed before the
         * professional arrives, at the opening moment, so pausing on it would
         * stop the player before anyone has pressed play. The decision it
         * points at gets its own event, and that one does pause.
         */
        autoPause: false,
        decisionId: null,
        derivedFrom: "background-action",
        derivedFromId: row.id,
        integrationEventId: null,
        sourceConnectorIds: [],
        createdAt: input.createdAt,
      });
    }
  }

  return out;
}

function projectInbox(input: ProjectionInputs): EventInsert[] {
  const open = momentToMinutes(input.openMoment);
  const out: EventInsert[] = [];

  for (const roleId of ROLE_IDS) {
    const rows = getDb()
      .select()
      .from(inboxMessages)
      .where(and(eq(inboxMessages.runId, input.runId), eq(inboxMessages.roleId, roleId)))
      .all()
      // Only arrivals. A message already in the inbox at the opening moment is
      // not an event; it is the state the day starts in.
      .filter((row) => momentToMinutes(row.revealedAtMoment) > open)
      .sort(
        (a, b) =>
          a.priorityRank - b.priorityRank ||
          momentToMinutes(a.revealedAtMoment) - momentToMinutes(b.revealedAtMoment) ||
          a.id.localeCompare(b.id),
      )
      .slice(0, 2);

    for (const row of rows) {
      const severity: LiveEventSeverity = row.fromSharedEvent
        ? "high"
        : row.proposedTriage === "decision"
          ? "medium"
          : "low";
      out.push({
        id: `WLE-IN-${row.id}`,
        runId: input.runId,
        atMoment: row.revealedAtMoment,
        sortOrder: 0,
        type: "message",
        roleIds: [roleId],
        severity,
        title: row.subject,
        titleDe: `Nachricht: ${row.subjectDe.length > 0 ? row.subjectDe : row.subject}`,
        summary: `${row.channel} from ${row.fromLabel}. Proposed triage: ${row.proposedTriage}.`,
        summaryDe: `${germanChannel(row.channel)} von ${row.fromLabel}. Vorgeschlagene Zuordnung: ${germanTriage(row.proposedTriage)}.`,
        objectType: row.relatedObjectKind ?? "message",
        objectId: row.relatedObjectId ?? row.id,
        evidenceIds: [],
        requiresDecision: false,
        // A message arriving is not a decision. Pausing here would be the
        // "do not pause on routine arrivals" rule broken on the commonest case.
        autoPause: false,
        decisionId: row.linkedDecisionId,
        derivedFrom: "inbox",
        derivedFromId: row.id,
        integrationEventId: null,
        sourceConnectorIds: [],
        createdAt: input.createdAt,
      });
    }
  }

  return out;
}

function projectMeetings(input: ProjectionInputs): EventInsert[] {
  const out: EventInsert[] = [];

  for (const roleId of ROLE_IDS) {
    const rows = getDb()
      .select()
      .from(meetings)
      .where(and(eq(meetings.runId, input.runId), eq(meetings.roleId, roleId)))
      .orderBy(asc(meetings.scheduledFor))
      .all();

    /*
     * The first and the last, not the first two. Taking the first two would
     * put both markers in the morning and leave the afternoon of the track
     * empty, which reads as a day where nothing happens after lunch.
     */
    const picked: Array<typeof rows[number]> = [];
    const first = rows[0];
    const last = rows[rows.length - 1];
    if (first) picked.push(first);
    if (last && last.id !== first?.id) picked.push(last);

    for (const row of picked) {
      out.push({
        id: `WLE-MT-${row.id}`,
        runId: input.runId,
        atMoment: row.momentLabel,
        sortOrder: 0,
        type: "meeting",
        roleIds: [roleId],
        severity: "low",
        title: row.title,
        titleDe: row.titleDe.length > 0 ? row.titleDe : row.title,
        summary: `${row.kind} at ${row.momentLabel}. ${row.objective}`,
        summaryDe: `${germanMeetingKind(row.kind)} um ${row.momentLabel}. Referenz ${row.reference}.`,
        objectType: row.subjectKind ?? "meeting",
        objectId: row.subjectId ?? row.id,
        evidenceIds: row.evidenceDocumentIds,
        requiresDecision: false,
        autoPause: false,
        decisionId: null,
        derivedFrom: "meeting",
        derivedFromId: row.id,
        integrationEventId: null,
        sourceConnectorIds: [],
        createdAt: input.createdAt,
      });
    }
  }

  return out;
}

function projectDecisions(input: ProjectionInputs): EventInsert[] {
  const open = momentToMinutes(input.openMoment);
  const out: EventInsert[] = [];

  for (const roleId of ROLE_IDS) {
    const rows = getDb()
      .select()
      .from(decisions)
      .where(and(eq(decisions.runId, input.runId), eq(decisions.roleId, roleId)))
      .orderBy(asc(decisions.priorityRank))
      .all()
      .filter((row) => row.status === "open");

    const arriving = rows.filter((row) => momentToMinutes(row.presentedAtMoment) > open);
    /*
     * Plus the top ranked morning brief item. Without it the opening moment
     * carries no decision at all, and the morning brief is the first thing the
     * product shows: a track whose first marker has nothing to decide
     * misrepresents the day it is meant to describe.
     */
    const morning = rows.filter((row) => momentToMinutes(row.presentedAtMoment) <= open).slice(0, 1);

    const picked = [...morning, ...arriving];
    const seen = new Set<string>();

    for (const row of picked) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);

      const routine = ROUTINE_JUDGMENT_KINDS.has(row.judgmentKind);
      out.push({
        id: `WLE-DE-${row.id}`,
        runId: input.runId,
        atMoment: row.presentedAtMoment,
        sortOrder: 0,
        type: "decision-required",
        roleIds: [roleId],
        severity: routine ? "medium" : "high",
        title: `Decision required: ${row.title}`,
        titleDe: `Entscheidung erforderlich: ${row.titleDe.length > 0 ? row.titleDe : row.title}`,
        summary: row.question,
        summaryDe: `Zu beurteilen: ${row.titleDe.length > 0 ? row.titleDe : row.title}. Erforderliche Befugnis: ${row.requiredAuthority}. Referenz ${row.reference}.`,
        objectType: row.relatedObjectKind ?? "decision",
        objectId: row.relatedObjectId ?? row.id,
        evidenceIds: [...row.supportingEvidenceIds, ...row.opposingEvidenceIds],
        requiresDecision: true,
        /*
         * The auto-pause set. A material judgment stops the player; an agenda
         * choice does not, because "which of these do I look at first" is not
         * a beat the day has to halt for.
         */
        autoPause: !routine,
        decisionId: row.id,
        derivedFrom: "decision",
        derivedFromId: row.id,
        integrationEventId: null,
        sourceConnectorIds: [],
        createdAt: input.createdAt,
      });
    }
  }

  return out;
}

/**
 * Assigns deterministic sort orders within each moment.
 *
 * Done as a pass over the assembled rows rather than inside each projector,
 * because the ordering rule is about how sources interleave at one moment and
 * no single projector can see that.
 */
function assignSortOrders(rows: EventInsert[]): EventInsert[] {
  const ordered = [...rows].sort(
    (a, b) =>
      momentToMinutes(a.atMoment) - momentToMinutes(b.atMoment) ||
      GROUP_ORDER[a.type] - GROUP_ORDER[b.type] ||
      a.id.localeCompare(b.id),
  );

  const counters = new Map<string, number>();
  for (const row of ordered) {
    const key = `${row.atMoment}:${row.type}`;
    const index = counters.get(key) ?? 0;
    counters.set(key, index + 1);
    row.sortOrder = GROUP_ORDER[row.type] * 100 + index;
  }

  return ordered;
}

/** Builds the projection without writing it. Used by the verification script. */
export function buildLiveEventRows(
  runId: string = DEFAULT_RUN_ID,
): { rows: EventInsert[]; openMoment: string } {
  const run = getDb().select().from(scenarioRuns).where(eq(scenarioRuns.id, runId)).get();
  if (!run) {
    throw new Error(
      `No scenario run ${runId}. Run npm run db:migrate and npm run db:seed before seeding live events.`,
    );
  }

  const timeline = getDb()
    .select()
    .from(timelineEvents)
    .where(eq(timelineEvents.runId, runId))
    .orderBy(asc(timelineEvents.sortOrder))
    .all();
  const first = timeline[0];
  if (!first) throw new Error(`Run ${runId} has no timeline moments to project from.`);

  /*
   * The opening moment is the first timeline moment, not the run's current
   * moment. They are different questions: the first is "when does this day
   * start", which is fixed, and the second is "where has it got to", which
   * moves. Using the current moment here would make the projection change
   * shape every time someone pressed play before reseeding.
   */
  const input: ProjectionInputs = {
    runId,
    openMoment: first.moment,
    createdAt: run.seededAt,
  };

  const rows = assignSortOrders([
    ...projectTimeline(input),
    ...projectRoleMoments(input),
    ...projectBackgroundActions(input),
    ...projectInbox(input),
    ...projectMeetings(input),
    ...projectDecisions(input),
  ]);

  return { rows, openMoment: first.moment };
}

/* ==========================================================================
   Seeding
   ========================================================================== */

function tally(rows: readonly EventInsert[], key: "derivedFrom" | "type"): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const value = String(row[key]);
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

/**
 * Writes the projection, the per-role read state and the player singleton.
 *
 * Idempotent by delete then insert, scoped to the three live day tables and to
 * one run. It deliberately does not touch anything else: a reseed of the live
 * day must not discard the decisions a presenter has just recorded.
 *
 * The read state is the part that is easy to get wrong. Events at or before the
 * run's current moment start read; later events start unread. Seeding
 * everything unread would open the day announcing sixty new items, most of
 * which have not happened yet, and the unread count would stop meaning
 * anything on the first screen the client sees.
 */
export function seedLiveEvents(runId: string = DEFAULT_RUN_ID): LiveEventSeedSummary {
  const sqlite = getSqlite();
  const run = getDb().select().from(scenarioRuns).where(eq(scenarioRuns.id, runId)).get();
  if (!run) {
    throw new Error(
      `No scenario run ${runId}. Run npm run db:migrate and npm run db:seed before seeding live events.`,
    );
  }

  const { rows, openMoment } = buildLiveEventRows(runId);
  const now = new Date().toISOString();
  const liveMinutes = momentToMinutes(run.currentMoment);

  const readRows: Array<typeof workdayLiveEventReads.$inferInsert> = [];
  for (const row of rows) {
    const applicable = row.roleIds.length === 0 ? [...ROLE_IDS] : row.roleIds;
    const arrived = momentToMinutes(row.atMoment) <= liveMinutes;
    for (const roleId of applicable) {
      readRows.push({
        id: `WLER-${runId}-${row.id}-${roleId}`,
        runId,
        eventId: row.id,
        roleId,
        readAt: arrived ? now : null,
        acknowledgedAt: null,
        reviewedInCatchUp: false,
      });
    }
  }

  const write = sqlite.transaction(() => {
    const db = getDb();
    db.delete(workdayLiveEventReads).where(eq(workdayLiveEventReads.runId, runId)).run();
    db.delete(workdayLiveEvents).where(eq(workdayLiveEvents.runId, runId)).run();
    db.delete(livePlayerState).where(eq(livePlayerState.runId, runId)).run();

    // Batched because SQLite caps bound parameters per statement and these are
    // wide rows; a single insert of eighty of them exceeds the limit.
    const batchSize = 25;
    for (let i = 0; i < rows.length; i += batchSize) {
      db.insert(workdayLiveEvents).values(rows.slice(i, i + batchSize)).run();
    }
    for (let i = 0; i < readRows.length; i += batchSize) {
      db.insert(workdayLiveEventReads).values(readRows.slice(i, i + batchSize)).run();
    }

    db.insert(livePlayerState)
      .values({
        id: `LPS-${runId}`,
        runId,
        playing: false,
        speed: 1,
        // The user starts looking at exactly where the day is. Any other value
        // would open the interface already behind itself.
        viewedMoment: run.currentMoment,
        pausedByDecisionId: null,
        pausedReason: "",
        catchUpActive: false,
        catchUpIndex: 0,
        updatedAt: now,
      })
      .run();
  });

  write();

  return {
    runId,
    events: rows.length,
    readRows: readRows.length,
    readAtOpen: readRows.filter((row) => row.readAt !== null).length,
    openMoment,
    byDerivedFrom: tally(rows, "derivedFrom"),
    byType: tally(rows, "type"),
  };
}
