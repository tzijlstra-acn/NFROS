/**
 * The OS event backbone: one publisher, one reader.
 *
 * Plan section 8.1 asks for one event model behind Home, Work, Processes, the
 * AI Partner, Activity, Audit and product analytics, and forbids separate
 * accounts of the same event. This module is that model. Everything that
 * happens in a working day that another surface needs to know about is
 * published here exactly once, through `publishOsEvent`.
 *
 * How the existing records relate to it, because unifying does not mean
 * replacing what already works:
 *
 *   audit_events          The tamper-evident record of authority. Still
 *                         written by the governed paths (`executeTool`,
 *                         `dispatchCommand`, `grantApproval`). When a backbone
 *                         event has an audit row, the event stores its id in
 *                         `auditEventId`. When the governed path has already
 *                         written the row, the publisher links it instead of
 *                         writing a second one.
 *
 *   ai_activity_entries   The measured record of what the AI did. When an AI
 *                         event is published (a preparation started, held or
 *                         completed) the publisher writes the activity row in
 *                         the same call and stores `activityEntryId`.
 *
 *   workday_live_events   The seeded projection of what arrived during the
 *                         scenario day. It is read through `listOsEvents` as
 *                         "work-arrived" events when `includeArrivals` is set,
 *                         so a consumer sees one stream without the seed
 *                         writing a second copy of every arrival.
 *
 *   role_app_events       Retired. Its rows were migrated onto `os_events`
 *                         by migration 0004.
 *
 * The publisher is synchronous and safe inside a better-sqlite3 transaction.
 * It opens its own transaction, which becomes a savepoint when the caller
 * already has one, so the event row and its projections commit or roll back
 * together with the caller's state change.
 */

import { and, asc, desc, eq, gt, inArray } from "drizzle-orm";
import { getDb, getSqlite } from "@/db/client";
import { DEFAULT_RUN_ID, type RoleId } from "@/db/schema/core";
import { osEvents, type OsEventActorKind, type OsEventType } from "@/db/schema/os-events";
import { workdayLiveEvents } from "@/db/schema/live";
import { recordAuditEvent, type AuditCategory } from "@/server/security/audit";
import { recordActivity, type ActivityKind } from "@/agents/activity/record";
import type { AuthorityClass } from "@/db/schema/decisions";
import { momentToMinutes } from "@/domain/nfr/calculators";

export { OS_EVENT_TYPES, type OsEventType, type OsEventActorKind } from "@/db/schema/os-events";

const db = () => getDb();

export type OsEventRow = typeof osEvents.$inferSelect;

/** One string in both interface languages. */
export interface EventText {
  en: string;
  de: string;
}

/** The audit row to write alongside the event, when the event is an authority fact. */
export interface AuditProjection {
  category: AuditCategory;
  action: string;
  objectKind: string;
  objectId: string;
  /** "human", "manager-agent", "specialist-agent" or "system". Defaults from the event actor. */
  actorKind?: string;
  entityId?: string | null;
  authorityClass?: AuthorityClass | null;
  decisionId?: string | null;
  approvalId?: string | null;
  reversible?: boolean;
}

/** The AI activity row to write alongside the event, when the AI did measurable work. */
export interface ActivityProjection {
  kind: ActivityKind;
  label: EventText;
  detail?: string;
  toolName?: string;
  /** Measured, never guessed. Pass zero explicitly when nothing was timed. */
  durationMs: number;
  outcome?: string;
  authorityClass?: AuthorityClass | "";
  evidenceIds?: string[];
}

export interface PublishOsEventInput {
  runId?: string;
  type: OsEventType;
  roleId: RoleId | null;
  /** Scenario clock at which the event happened. */
  atMoment: string;
  /** Wall clock time. Defaults to now; the seed passes its own stable values. */
  occurredAt?: string;
  actorKind: OsEventActorKind;
  actorUserId?: string | null;
  subject?: { kind: string; id: string } | null;
  process?: { runId: string; stageId?: string | null } | null;
  correlationId?: string | null;
  summary: EventText;
  payload?: Record<string, unknown>;
  /**
   * The identity of the event. Publishing twice with the same key writes
   * nothing the second time. Build it from what makes the event unique, for
   * example `stage-completed:<stageRunId>`, never from a clock.
   */
  idempotencyKey: string;
  /** Write this audit row in the same call. Mutually exclusive with `auditEventId`. */
  audit?: AuditProjection | null;
  /** Link an audit row a governed path already wrote. */
  auditEventId?: string | null;
  /** Write this activity row in the same call. */
  activity?: ActivityProjection | null;
  /** Fixed identifier, used by the seed so a reseed produces identical rows. */
  id?: string;
}

export interface PublishResult {
  event: OsEventRow;
  /** False when an event with the same key already existed. Nothing was written. */
  created: boolean;
}

let idSequence = 0;

function nextEventId(): string {
  idSequence += 1;
  return `OSE-${Date.now().toString(36).toUpperCase()}-${String(idSequence).padStart(5, "0")}`;
}

function findByKey(runId: string, idempotencyKey: string): OsEventRow | undefined {
  return (
    db()
      .select()
      .from(osEvents)
      .where(and(eq(osEvents.runId, runId), eq(osEvents.idempotencyKey, idempotencyKey)))
      .get() ?? undefined
  );
}

/**
 * Publishes one event, and its audit and activity projections, exactly once.
 *
 * The existence check, the projections and the insert run in one transaction,
 * so a duplicate publish cannot write a second audit row before discovering
 * the event already exists.
 */
export function publishOsEvent(input: PublishOsEventInput): PublishResult {
  const runId = input.runId ?? DEFAULT_RUN_ID;

  const write = getSqlite().transaction((): PublishResult => {
    const existing = findByKey(runId, input.idempotencyKey);
    if (existing) return { event: existing, created: false };

    let auditEventId = input.auditEventId ?? null;
    if (input.audit) {
      auditEventId = recordAuditEvent({
        runId,
        atMoment: input.atMoment,
        category: input.audit.category,
        action: input.audit.action,
        objectKind: input.audit.objectKind,
        objectId: input.audit.objectId,
        summary: input.summary.en,
        actorUserId: input.actorUserId ?? null,
        actorKind: input.audit.actorKind ?? auditActorKind(input.actorKind),
        roleId: input.roleId,
        entityId: input.audit.entityId ?? null,
        authorityClass: input.audit.authorityClass ?? null,
        decisionId: input.audit.decisionId ?? null,
        approvalId: input.audit.approvalId ?? null,
        reversible: input.audit.reversible ?? false,
        detail: { osEventKey: input.idempotencyKey, ...(input.payload ?? {}) },
      });
    }

    let activityEntryId: string | null = null;
    if (input.activity && input.roleId) {
      activityEntryId = recordActivity({
        runId,
        roleId: input.roleId,
        atMoment: input.atMoment,
        kind: input.activity.kind,
        label: input.activity.label.en,
        labelDe: input.activity.label.de,
        detail: input.activity.detail ?? input.summary.en,
        objectType: input.subject?.kind ?? "",
        objectId: input.subject?.id ?? "",
        toolName: input.activity.toolName ?? "",
        durationMs: input.activity.durationMs,
        outcome: input.activity.outcome ?? "",
        authorityClass: input.activity.authorityClass ?? "",
        auditEventId,
        evidenceIds: input.activity.evidenceIds ?? [],
      });
    }

    const id = input.id ?? nextEventId();

    /*
     * The sequence is allocated inside the insert statement, as the current
     * maximum plus one. Two writers on the same database (the dev server and
     * the worker) are serialised by SQLite's write lock, so the read of the
     * maximum and the insert cannot interleave.
     */
    getSqlite()
      .prepare(
        `insert into os_events (
          id, run_id, sequence, type, role_id, at_moment, occurred_at, actor_kind, actor_user_id,
          subject_kind, subject_id, process_run_id, stage_id, correlation_id, summary, summary_de,
          payload, idempotency_key, audit_event_id, activity_entry_id
        ) select
          @id, @runId, coalesce(max(sequence), 0) + 1, @type, @roleId, @atMoment, @occurredAt, @actorKind, @actorUserId,
          @subjectKind, @subjectId, @processRunId, @stageId, @correlationId, @summary, @summaryDe,
          @payload, @idempotencyKey, @auditEventId, @activityEntryId
        from os_events where run_id = @runId`,
      )
      .run({
        id,
        runId,
        type: input.type,
        roleId: input.roleId,
        atMoment: input.atMoment,
        occurredAt: input.occurredAt ?? new Date().toISOString(),
        actorKind: input.actorKind,
        actorUserId: input.actorUserId ?? null,
        subjectKind: input.subject?.kind ?? null,
        subjectId: input.subject?.id ?? null,
        processRunId: input.process?.runId ?? null,
        stageId: input.process?.stageId ?? null,
        correlationId: input.correlationId ?? null,
        summary: input.summary.en,
        summaryDe: input.summary.de,
        payload: JSON.stringify(input.payload ?? {}),
        idempotencyKey: input.idempotencyKey,
        auditEventId,
        activityEntryId,
      });

    const written = findByKey(runId, input.idempotencyKey);
    if (!written) throw new Error(`The event ${input.idempotencyKey} was not written.`);
    return { event: written, created: true };
  });

  return write();
}

/**
 * Links the audit row a governed path wrote after the event was published.
 *
 * Stage completion is the case: the completion handler publishes the event
 * inside its transaction, and `executeTool` writes the audit row only after the
 * handler returns. The link is a reference column, not event content, so
 * setting it once does not make the backbone mutable in any meaningful sense.
 */
export function linkOsEventAudit(eventId: string, auditEventId: string): void {
  // Set once: a link that already exists is never replaced.
  getSqlite()
    .prepare("update os_events set audit_event_id = ? where id = ? and audit_event_id is null")
    .run(auditEventId, eventId);
}

function auditActorKind(actor: OsEventActorKind): string {
  switch (actor) {
    case "human":
      return "human";
    case "ai":
      return "specialist-agent";
    default:
      return "system";
  }
}

/* ==========================================================================
   Reading
   ========================================================================== */

/** The shape every consumer receives. Language resolved, payload parsed. */
export interface OsEventView {
  id: string;
  sequence: number;
  type: OsEventType;
  roleId: string | null;
  atMoment: string;
  occurredAt: string;
  actorKind: OsEventActorKind;
  actorUserId: string | null;
  subjectKind: string | null;
  subjectId: string | null;
  processRunId: string | null;
  stageId: string | null;
  correlationId: string | null;
  summary: string;
  payload: Record<string, unknown>;
  auditEventId: string | null;
  activityEntryId: string | null;
  /** "backbone" for published events, "live-event" for seeded arrivals read through. */
  origin: "backbone" | "live-event";
}

export interface ListOsEventsQuery {
  runId?: string;
  roleId?: string;
  types?: readonly OsEventType[];
  processRunId?: string;
  stageId?: string;
  subject?: { kind: string; id: string };
  correlationId?: string;
  /** Only events with a sequence greater than this. For incremental readers. */
  sinceSequence?: number;
  limit?: number;
  /** "asc" (default) reads the day forwards; "desc" reads the latest first. */
  order?: "asc" | "desc";
  language?: "en" | "de";
  /**
   * Also read the seeded arrivals in `workday_live_events` as "work-arrived"
   * events, up to the given scenario moment. They carry sequence zero and
   * sort before published events at the same moment.
   */
  includeArrivals?: { upToMoment: string } | null;
}

function toView(row: OsEventRow, language: "en" | "de"): OsEventView {
  return {
    id: row.id,
    sequence: row.sequence,
    type: row.type,
    roleId: row.roleId,
    atMoment: row.atMoment,
    occurredAt: row.occurredAt,
    actorKind: row.actorKind,
    actorUserId: row.actorUserId,
    subjectKind: row.subjectKind,
    subjectId: row.subjectId,
    processRunId: row.processRunId,
    stageId: row.stageId,
    correlationId: row.correlationId,
    summary: language === "de" ? row.summaryDe : row.summary,
    payload: row.payload ?? {},
    auditEventId: row.auditEventId,
    activityEntryId: row.activityEntryId,
    origin: "backbone",
  };
}

/** Reads the backbone. Every filter is optional and they combine with AND. */
export function listOsEvents(query: ListOsEventsQuery = {}): OsEventView[] {
  const runId = query.runId ?? DEFAULT_RUN_ID;
  const language = query.language ?? "en";

  const conditions = [eq(osEvents.runId, runId)];
  if (query.roleId) conditions.push(eq(osEvents.roleId, query.roleId));
  if (query.types && query.types.length > 0) conditions.push(inArray(osEvents.type, [...query.types]));
  if (query.processRunId) conditions.push(eq(osEvents.processRunId, query.processRunId));
  if (query.stageId) conditions.push(eq(osEvents.stageId, query.stageId));
  if (query.correlationId) conditions.push(eq(osEvents.correlationId, query.correlationId));
  if (query.subject) {
    conditions.push(eq(osEvents.subjectKind, query.subject.kind));
    conditions.push(eq(osEvents.subjectId, query.subject.id));
  }
  if (query.sinceSequence !== undefined) conditions.push(gt(osEvents.sequence, query.sinceSequence));

  const descending = query.order === "desc";
  const base = db()
    .select()
    .from(osEvents)
    .where(and(...conditions))
    .orderBy(descending ? desc(osEvents.sequence) : asc(osEvents.sequence));
  const rows = query.limit !== undefined && !query.includeArrivals ? base.limit(query.limit).all() : base.all();

  const views = rows.map((row) => toView(row, language));
  if (!query.includeArrivals) return views;

  const arrivals = readArrivals(runId, query, language);
  const merged = [...arrivals, ...views].sort((a, b) => {
    const byMoment = momentToMinutes(a.atMoment || "00:00") - momentToMinutes(b.atMoment || "00:00");
    if (byMoment !== 0) return byMoment;
    return a.sequence - b.sequence;
  });
  const ordered = descending ? merged.reverse() : merged;
  return query.limit !== undefined ? ordered.slice(0, query.limit) : ordered;
}

/**
 * Seeded arrivals, projected onto the event view without being copied.
 *
 * Only the filters that make sense for an arrival apply: role, subject and the
 * moment bound. A query filtered to a process run or a stage reads no
 * arrivals, because an arrival does not belong to one.
 */
function readArrivals(runId: string, query: ListOsEventsQuery, language: "en" | "de"): OsEventView[] {
  if (!query.includeArrivals) return [];
  if (query.processRunId || query.stageId || query.correlationId) return [];
  if (query.types && query.types.length > 0 && !query.types.includes("work-arrived")) return [];
  if (query.sinceSequence !== undefined && query.sinceSequence > 0) return [];

  const bound = momentToMinutes(query.includeArrivals.upToMoment);
  return db()
    .select()
    .from(workdayLiveEvents)
    .where(eq(workdayLiveEvents.runId, runId))
    .orderBy(asc(workdayLiveEvents.atMoment), asc(workdayLiveEvents.sortOrder))
    .all()
    .filter((row) => momentToMinutes(row.atMoment) <= bound)
    .filter((row) => !query.roleId || row.roleIds.length === 0 || row.roleIds.includes(query.roleId as RoleId))
    .filter((row) => !query.subject || (row.objectType === query.subject.kind && row.objectId === query.subject.id))
    .map((row) => ({
      id: row.id,
      sequence: 0,
      type: "work-arrived" as const,
      roleId: query.roleId ?? null,
      atMoment: row.atMoment,
      occurredAt: row.createdAt,
      actorKind: row.derivedFrom === "integration" ? ("connector" as const) : ("system" as const),
      actorUserId: null,
      subjectKind: row.objectType,
      subjectId: row.objectId,
      processRunId: null,
      stageId: null,
      correlationId: row.decisionId,
      summary: language === "de" ? row.titleDe : row.title,
      payload: { liveEventType: row.type, severity: row.severity, derivedFrom: row.derivedFrom },
      auditEventId: null,
      activityEntryId: null,
      origin: "live-event" as const,
    }));
}

/** The highest sequence published for a run. Zero when nothing has been published. */
export function latestOsEventSequence(runId = DEFAULT_RUN_ID): number {
  const row = getSqlite()
    .prepare("select coalesce(max(sequence), 0) as n from os_events where run_id = ?")
    .get(runId) as { n: number } | undefined;
  return row?.n ?? 0;
}

/** One event by its idempotency key, for a caller that wants to know whether it happened. */
export function findOsEvent(idempotencyKey: string, runId = DEFAULT_RUN_ID): OsEventRow | undefined {
  return findByKey(runId, idempotencyKey);
}
