/**
 * Calendar: the day view for 06.10.2026.
 *
 * A day view rather than a week view, because the product is about one day and
 * a week grid would give a professional less information per pixel about it.
 *
 * Two things are made structural rather than decorative. A conflict is shown
 * from both sides, with the overlap stated in minutes, because the decision a
 * conflict forces is which of the two entries you attend. And preparation
 * status sits on every entry, because in the Today view preparation is manual
 * work that someone has to find the time for.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { isDatabaseReady } from "@/db/client";
import { ROLE_IDS, type RoleId } from "@/db/schema/core";
import { getCalendar, getMeetings, getRole, getUserNameMap } from "@/db/repositories/workday";
import { buildIntelligenceRail, uncertaintyFromEvidence } from "@/db/repositories/rail";
import { getScenarioState } from "@/scenario/engine/state";
import { NotSeeded, WorkdayShell } from "@/components/shell/WorkdayShell";
import { IntelligenceRail } from "@/components/shell/IntelligenceRail";
import { Chip, ObjectId, RegulatoryNote, type Tone } from "@/components/evidence/primitives";
import { formatDateDach, momentToMinutes } from "@/domain/nfr/calculators";
import type { Language } from "@/i18n/labels";

export const dynamic = "force-dynamic";

function parseRole(value: string): RoleId {
  if ((ROLE_IDS as readonly string[]).includes(value)) return value as RoleId;
  notFound();
}

type CalendarRow = ReturnType<typeof getCalendar>[number];

const KIND_TONE: Record<string, Tone> = {
  workshop: "cyan",
  meeting: "cyan",
  committee: "accent",
  "focus-time": "neutral",
  "crisis-call": "red",
  "one-to-one": "cyan",
};

const PREPARATION_TONE: Record<string, Tone> = {
  "not-started": "red",
  "in-progress": "amber",
  prepared: "green",
  complete: "green",
  "not-required": "neutral",
};

const PREPARATION_MEANING: Record<string, string> = {
  "not-started":
    "No preparation has been done. In the Today view this is time that has to come from somewhere else in the day.",
  "in-progress": "Partly prepared. The gap is what has not been read yet, not what has not been booked.",
  prepared: "A preparation pack exists and cites the evidence it rests on.",
  complete: "Preparation is complete and the pack is on the record.",
  "not-required": "Nothing to prepare. This entry is time, not a discussion.",
};

/** The 24 hour clock label as seeded, read without a timezone conversion. */
function clock(iso: string): string {
  return iso.length >= 16 ? iso.slice(11, 16) : iso;
}

/** Overlap between two entries, in minutes. Zero when they do not overlap. */
function overlapMinutes(a: CalendarRow, b: CalendarRow): number {
  const startA = momentToMinutes(clock(a.startsAt));
  const endA = momentToMinutes(clock(a.endsAt));
  const startB = momentToMinutes(clock(b.startsAt));
  const endB = momentToMinutes(clock(b.endsAt));
  return Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));
}

function durationMinutes(row: CalendarRow): number {
  return Math.max(0, momentToMinutes(clock(row.endsAt)) - momentToMinutes(clock(row.startsAt)));
}

export default async function CalendarPage({ params }: { params: Promise<{ role: string }> }) {
  const { role: roleParam } = await params;
  const roleId = parseRole(roleParam);

  if (!isDatabaseReady()) return <NotSeeded />;
  const state = getScenarioState();
  if (!state) return <NotSeeded />;

  const language = state.language as Language;
  const role = getRole(roleId);
  if (!role) return <NotSeeded />;

  const names = getUserNameMap();
  const entries = getCalendar(roleId);
  const meetings = getMeetings(roleId);
  const meetingById = new Map(meetings.map((meeting) => [meeting.id, meeting]));
  const byId = new Map<string, CalendarRow>(entries.map((row) => [row.id, row]));

  const nowMinutes = momentToMinutes(state.currentMoment);

  /* Conflict pairs, reported once each rather than twice. */
  const conflictPairs: Array<{ key: string; a: CalendarRow; b: CalendarRow; minutes: number }> = [];
  const seenPairs = new Set<string>();
  for (const row of entries) {
    if (!row.hasConflict || !row.conflictWithId) continue;
    const other = byId.get(row.conflictWithId);
    if (!other) continue;
    const key = [row.id, other.id].sort().join("|");
    if (seenPairs.has(key)) continue;
    seenPairs.add(key);
    conflictPairs.push({ key, a: row, b: other, minutes: overlapMinutes(row, other) });
  }

  const unprepared = entries.filter(
    (row) => row.preparationStatus === "not-started" && row.kind !== "focus-time",
  );
  const bookedMinutes = entries.reduce((total, row) => total + durationMinutes(row), 0);
  const conflictedMinutes = conflictPairs.reduce((total, pair) => total + pair.minutes, 0);

  const rail = buildIntelligenceRail({
    roleId,
    atMoment: state.currentMoment,
    language,
    contextLabel: `Calendar for ${formatDateDach(state.scenarioDate)}: ${entries.length} entries, ${conflictPairs.length} conflict(s), ${unprepared.length} entries with no preparation done.`,
    evidenceIds: [],
    whyThisMatters: [
      conflictPairs.length > 0
        ? `${conflictPairs.length} conflict(s) overlap by ${conflictedMinutes} minutes in total. Each one forces a choice about which discussion to be in.`
        : "No two entries overlap today.",
      `${bookedMinutes} minutes of the day are already committed, before any preparation time.`,
    ],
    uncertainty: uncertaintyFromEvidence([]),
  });

  return (
    <WorkdayShell
      roleId={roleId}
      activeNav="calendar"
      intelligenceRail={<IntelligenceRail {...rail} />}
    >
      <div className="stack stack-8">
        <header className="stack stack-3">
          <div className="row row-3 row-between row-wrap">
            <div className="stack stack-1">
              <span className="label">
                Day view &middot; {formatDateDach(state.scenarioDate)} &middot; 24 hour clock
              </span>
              <h1 className="display" style={{ fontSize: "var(--text-2xl)" }}>
                The day as it is actually booked
              </h1>
            </div>
            <div className="row row-2 row-wrap">
              <Chip tone="neutral">{entries.length} entries</Chip>
              <Chip tone={conflictPairs.length > 0 ? "red" : "green"}>
                {conflictPairs.length} conflict{conflictPairs.length === 1 ? "" : "s"}
              </Chip>
              <Chip tone={unprepared.length > 0 ? "amber" : "green"}>
                {unprepared.length} unprepared
              </Chip>
              <Chip tone="cyan">{bookedMinutes} minutes committed</Chip>
            </div>
          </div>
          <p className="lede">
            All times are the 24 hour local clock of the entry as recorded. Conflicts are shown from
            both sides with the overlap in minutes, because the question a conflict asks is which of
            the two you attend and what happens to the other.
          </p>
        </header>

        {/* ---------------- Conflicts, both sides ---------------- */}
        <section className="stack stack-3" aria-label="Calendar conflicts">
          <h2 style={{ fontSize: "var(--text-lg)" }}>
            Conflicts
            <span className="muted" style={{ fontWeight: 400 }}>
              {" "}
              ({conflictPairs.length})
            </span>
          </h2>
          {conflictPairs.length === 0 ? (
            <div className="empty-state">
              <span className="label">No conflict today</span>
              <p>No two entries in this role's calendar overlap.</p>
            </div>
          ) : (
            conflictPairs.map((pair) => (
              <div key={pair.key} className="card card-edge" data-tone="red">
                <div className="stack stack-3">
                  <div className="row row-2 row-wrap row-between">
                    <span className="strong-text">
                      {clock(pair.a.startsAt)} and {clock(pair.b.startsAt)} overlap by{" "}
                      {pair.minutes} minutes
                    </span>
                    <Chip tone="red">double booked</Chip>
                  </div>
                  <div className="grid grid-2">
                    <ConflictSide
                      row={pair.a}
                      sideLabel="Side one"
                      names={names}
                      roleId={roleId}
                      hasSimulation={pair.a.meetingId !== null && meetingById.has(pair.a.meetingId)}
                    />
                    <ConflictSide
                      row={pair.b}
                      sideLabel="Side two"
                      names={names}
                      roleId={roleId}
                      hasSimulation={pair.b.meetingId !== null && meetingById.has(pair.b.meetingId)}
                    />
                  </div>
                  <p className="dim" style={{ fontSize: "var(--text-sm)" }}>
                    Neither entry is cancelled on your behalf. The product states the overlap, shows
                    what each entry is for and what preparation each one needs, and leaves the choice
                    where it belongs.
                  </p>
                </div>
              </div>
            ))
          )}
        </section>

        {/* ---------------- The day, in order ---------------- */}
        <section className="stack stack-4" aria-label="Day view">
          <h2 style={{ fontSize: "var(--text-lg)" }}>The day in order</h2>

          {entries.length === 0 ? (
            <div className="empty-state">
              <span className="label">No calendar entries</span>
              <p>This role has no entries on {formatDateDach(state.scenarioDate)}.</p>
            </div>
          ) : (
            <div className="stack stack-3">
              {entries.map((row) => {
                const meeting = row.meetingId ? meetingById.get(row.meetingId) : undefined;
                const startMinutes = momentToMinutes(clock(row.startsAt));
                const isPast = startMinutes < nowMinutes;
                const isNow =
                  startMinutes <= nowMinutes &&
                  nowMinutes < momentToMinutes(clock(row.endsAt));
                const conflictWith = row.conflictWithId ? byId.get(row.conflictWithId) : undefined;

                return (
                  <article
                    key={row.id}
                    id={row.id}
                    className="card card-edge"
                    data-tone={
                      row.hasConflict ? "red" : isNow ? "accent" : (KIND_TONE[row.kind] ?? "neutral")
                    }
                    style={isPast && !isNow ? { opacity: 0.72 } : undefined}
                  >
                    <div className="row row-4 row-start row-wrap">
                      {/* ---- Time column ---- */}
                      <div
                        className="stack stack-1 shrink-0"
                        style={{ width: 92, textAlign: "right" }}
                      >
                        <span
                          className="mono strong-text"
                          style={{ fontSize: "var(--text-base)" }}
                        >
                          {clock(row.startsAt)}
                        </span>
                        <span className="mono meta">{clock(row.endsAt)}</span>
                        <span className="meta">{durationMinutes(row)} min</span>
                      </div>

                      {/* ---- Detail ---- */}
                      <div className="stack stack-2 grow" style={{ minWidth: 0 }}>
                        <div className="row row-2 row-wrap row-between row-start">
                          <span className="strong-text">
                            {language === "de" && row.titleDe.length > 0 ? row.titleDe : row.title}
                          </span>
                          <div className="row row-2 row-wrap">
                            {isNow ? <Chip tone="accent">now</Chip> : null}
                            {row.hasConflict ? <Chip tone="red">conflict</Chip> : null}
                            <Chip tone={KIND_TONE[row.kind] ?? "neutral"}>{row.kind}</Chip>
                            <Chip tone={PREPARATION_TONE[row.preparationStatus] ?? "neutral"}>
                              preparation: {row.preparationStatus.replace(/-/g, " ")}
                            </Chip>
                          </div>
                        </div>

                        <div className="row row-3 row-wrap meta">
                          {row.momentLabel ? <span>moment {row.momentLabel}</span> : null}
                          {row.location.length > 0 ? <span>{row.location}</span> : null}
                          <span>
                            {row.attendeeUserIds.length} attendee
                            {row.attendeeUserIds.length === 1 ? "" : "s"}
                          </span>
                        </div>

                        {row.attendeeUserIds.length > 0 ? (
                          <div className="row row-2 row-wrap">
                            {row.attendeeUserIds.map((userId) => (
                              <span key={userId} className="chip" data-tone="neutral">
                                {names.get(userId) ?? userId}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        {row.agenda.length > 0 ? (
                          <div className="stack stack-1">
                            <span className="label">Agenda</span>
                            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-2)" }}>
                              {row.agenda}
                            </p>
                          </div>
                        ) : null}

                        <div className="stack stack-1">
                          <span className="label">Preparation</span>
                          <p className="dim" style={{ fontSize: "var(--text-sm)" }}>
                            {PREPARATION_MEANING[row.preparationStatus] ??
                              "Preparation status is recorded but not described."}
                          </p>
                        </div>

                        {conflictWith ? (
                          <div className="stack stack-1">
                            <span className="label" style={{ color: "var(--red)" }}>
                              Conflicts with
                            </span>
                            <a href={`#${conflictWith.id}`} style={{ fontSize: "var(--text-sm)" }}>
                              {clock(conflictWith.startsAt)} {conflictWith.title}
                            </a>
                            <span className="meta">
                              Overlap {overlapMinutes(row, conflictWith)} minutes &middot;{" "}
                              <span className="mono">{conflictWith.id}</span>
                            </span>
                          </div>
                        ) : null}

                        <div className="row row-3 row-wrap">
                          {meeting ? (
                            <Link
                              href={`/workday/${roleId}/meetings#${meeting.id}`}
                              className="btn btn-sm btn-quiet"
                            >
                              {meeting.supportsVoice
                                ? "Open the meeting simulation"
                                : "Open the preparation pack"}
                            </Link>
                          ) : null}
                          {meeting?.supportsVoice ? (
                            <Chip tone="accent">live simulation available</Chip>
                          ) : null}
                          <ObjectId id={row.id} label="entry" />
                          {row.meetingId ? <ObjectId id={row.meetingId} label="meeting" /> : null}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* ---------------- Preparation position ---------------- */}
        <section className="panel" aria-label="Preparation position">
          <div className="panel-head">
            <span className="panel-title">Preparation across the day</span>
            <span className="meta">
              {unprepared.length} discussion{unprepared.length === 1 ? "" : "s"} with nothing
              prepared
            </span>
          </div>
          <div className="panel-body">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Time</th>
                    <th scope="col">Entry</th>
                    <th scope="col">Preparation</th>
                    <th scope="col">Simulation</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((row) => {
                    const meeting = row.meetingId ? meetingById.get(row.meetingId) : undefined;
                    return (
                      <tr key={row.id}>
                        <td className="mono">{clock(row.startsAt)}</td>
                        <td>
                          <a href={`#${row.id}`}>{row.title}</a>
                        </td>
                        <td>
                          <Chip tone={PREPARATION_TONE[row.preparationStatus] ?? "neutral"}>
                            {row.preparationStatus.replace(/-/g, " ")}
                          </Chip>
                        </td>
                        <td>
                          {meeting ? (
                            <Link href={`/workday/${roleId}/meetings#${meeting.id}`}>
                              {meeting.reference}
                            </Link>
                          ) : (
                            <span className="muted">none</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <footer className="stack stack-2">
          <RegulatoryNote language={language} />
          <span className="meta">
            Calendar entries, attendees and agendas are synthetic. No invitation was ever sent and no
            external calendar was read.
          </span>
        </footer>
      </div>
    </WorkdayShell>
  );
}

function ConflictSide({
  row,
  sideLabel,
  names,
  roleId,
  hasSimulation,
}: {
  row: CalendarRow;
  sideLabel: string;
  names: Map<string, string>;
  roleId: RoleId;
  hasSimulation: boolean;
}) {
  return (
    <div
      className="stack stack-2"
      style={{
        padding: "var(--space-3)",
        background: "var(--surface-0)",
        border: "1px solid var(--border-1)",
        borderRadius: "var(--radius-md)",
      }}
    >
      <div className="row row-2 row-between">
        <span className="label">{sideLabel}</span>
        <Chip tone={PREPARATION_TONE[row.preparationStatus] ?? "neutral"}>
          {row.preparationStatus.replace(/-/g, " ")}
        </Chip>
      </div>
      <span className="mono strong-text" style={{ fontSize: "var(--text-sm)" }}>
        {clock(row.startsAt)} to {clock(row.endsAt)}
      </span>
      <a href={`#${row.id}`} className="strong-text" style={{ fontSize: "var(--text-sm)" }}>
        {row.title}
      </a>
      {row.agenda.length > 0 ? (
        <p className="dim" style={{ fontSize: "var(--text-sm)" }}>
          {row.agenda}
        </p>
      ) : null}
      <div className="row row-2 row-wrap">
        {row.attendeeUserIds.map((userId) => (
          <span key={userId} className="mono meta">
            {names.get(userId) ?? userId}
          </span>
        ))}
      </div>
      {hasSimulation && row.meetingId ? (
        <Link href={`/workday/${roleId}/meetings#${row.meetingId}`} className="btn btn-sm btn-quiet">
          Open this meeting
        </Link>
      ) : null}
      <ObjectId id={row.id} label="entry" />
    </div>
  );
}
