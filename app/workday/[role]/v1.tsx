/**
 * Today: the morning decision brief and the current moment.
 *
 * The screen opens with decisions, not with a message count. That is the
 * product's central claim rendered as a layout decision: the first thing on
 * the page is the judgment the professional owns, and the inbox is further
 * down because converting messages into work is something the system has
 * already done.
 *
 * The Today and future toggle changes this same screen rather than showing a
 * different diagram, which is the only honest way to make the comparison.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { isDatabaseReady } from "@/db/client";
import { ROLE_IDS, type RoleId } from "@/db/schema/core";
import {
  getBackgroundWork,
  getBreachedKris,
  getCalendar,
  getDecisions,
  getEntity,
  getInbox,
  getMeetings,
  getOverdueActions,
  getRole,
  getUser,
} from "@/db/repositories/workday";
import { buildIntelligenceRail, uncertaintyFromEvidence } from "@/db/repositories/rail";
import { getRoleMoments, getScenarioState, getTimeline } from "@/scenario/engine/state";
import { WorkdayShell, NotSeeded } from "@/components/shell/WorkdayShell";
import { IntelligenceRail } from "@/components/shell/IntelligenceRail";
import { DecisionBriefCard, type DecisionView } from "@/components/decisions/DecisionFlow";
import { Chip, ObjectId } from "@/components/evidence/primitives";
import { laneLabel, type LaneId, type Language } from "@/i18n/labels";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return ROLE_IDS.map((role) => ({ role }));
}

function parseRole(value: string): RoleId {
  if ((ROLE_IDS as readonly string[]).includes(value)) return value as RoleId;
  notFound();
}

export default async function WorkdayTodayPage({
  params,
}: {
  params: Promise<{ role: string }>;
}) {
  const { role: roleParam } = await params;
  const roleId = parseRole(roleParam);

  if (!isDatabaseReady()) return <NotSeeded />;
  const state = getScenarioState();
  if (!state) return <NotSeeded />;

  const language = state.language as Language;
  const role = getRole(roleId);
  if (!role) return <NotSeeded />;

  const holder = getUser(role.holderUserId);
  const entity = getEntity(role.entityId);
  const timeline = getTimeline();
  const currentEvent = timeline.find((m) => m.moment === state.currentMoment);
  const roleMoments = getRoleMoments(roleId);
  const currentRoleMoment = roleMoments.find(
    (entry) => entry.event.moment === state.currentMoment,
  )?.roleMoment;

  const decisionEntries = getDecisions(roleId, state.currentMoment);
  const openDecisions = decisionEntries.filter((entry) => entry.decision.status === "open");
  const decidedDecisions = decisionEntries.filter((entry) => entry.decision.status === "decided");

  const inbox = getInbox(roleId, state.currentMoment);
  const calendar = getCalendar(roleId);
  const meetings = getMeetings(roleId);
  const background = getBackgroundWork(roleId, state.currentMoment);
  const breachedKris = getBreachedKris();
  const overdueActions = getOverdueActions().filter((a) => a.raisedByRoleId === roleId);

  const evidenceIds = currentRoleMoment?.evidenceIds ?? [];

  const rail = buildIntelligenceRail({
    roleId,
    atMoment: state.currentMoment,
    language,
    contextLabel: currentRoleMoment
      ? `${state.currentMoment} ${currentEvent?.title ?? ""}: ${currentRoleMoment.headline}`
      : `${state.currentMoment} ${currentEvent?.title ?? "Current moment"}`,
    evidenceIds,
    whyThisMatters: openDecisions.slice(0, 3).map((entry) => entry.decision.whyThisMatters),
    uncertainty: [
      ...uncertaintyFromEvidence(evidenceIds),
      ...(currentRoleMoment?.uncertaintyNote
        ? [
            {
              topic: "Open point at this moment",
              description: currentRoleMoment.uncertaintyNote,
              kind: "judgment-required" as const,
              resolutionPath: "This is resolved by the professional's judgment, not by more data.",
              materialToDecision: true,
              sourceIds: [],
            },
          ]
        : []),
    ],
  });

  const isToday = state.worldView === "today";

  return (
    <WorkdayShell
      roleId={roleId}
      activeNav="today"
      intelligenceRail={<IntelligenceRail {...rail} />}
    >
      <div className="stack stack-8">
        {/* ---------------- Header ---------------- */}
        <header className="stack stack-3">
          <div className="row row-3 row-wrap row-between">
            <div className="stack stack-1">
              <span className="label">
                {state.currentMoment} &middot; {currentEvent?.title ?? "Current moment"}
              </span>
              <h1 className="display" style={{ fontSize: "var(--text-2xl)" }}>
                {currentRoleMoment?.headline ??
                  `${language === "de" ? role.titleDe : role.title}, ${entity?.shortName}`}
              </h1>
            </div>
            <div className="row row-2">
              {currentEvent ? (
                <Chip tone="cyan">
                  {laneLabel(currentEvent.dominantLane as LaneId, language, true)}
                </Chip>
              ) : null}
              {currentEvent?.isSharedEvent ? <Chip tone="red">shared event</Chip> : null}
            </div>
          </div>

          <p className="lede">
            {isToday
              ? (currentRoleMoment?.todayNarrative ?? "")
              : (currentRoleMoment?.futureNarrative ?? "")}
          </p>
        </header>

        {/* ---------------- Today versus future ---------------- */}
        {currentRoleMoment ? (
          <section
            className="panel"
            aria-label={isToday ? "What the day looks like today" : "What the AI already completed"}
          >
            <div className="panel-head">
              <span className="panel-title">
                {isToday ? "What this moment costs today" : "What was already done before you arrived"}
              </span>
              <span className="meta">
                {isToday
                  ? "The manual reality, from the experience map"
                  : "Completed within policy, with an audit trail"}
              </span>
            </div>
            <div className="panel-body">
              <ul className="stack stack-2">
                {(isToday ? currentRoleMoment.todaySignals : currentRoleMoment.futureSignals).map(
                  (signal, index) => (
                    <li key={index} className="row row-3 row-start">
                      <span
                        aria-hidden="true"
                        className="mono"
                        style={{ color: isToday ? "var(--amber)" : "var(--green)", flexShrink: 0 }}
                      >
                        {isToday ? "!" : "="}
                      </span>
                      <span style={{ fontSize: "var(--text-sm)" }}>{signal}</span>
                    </li>
                  ),
                )}
              </ul>
            </div>
          </section>
        ) : null}

        {/* ---------------- The decision brief ---------------- */}
        <section className="stack stack-4" aria-label="Decision brief">
          <div className="row row-3 row-between row-wrap">
            <h2 style={{ fontSize: "var(--text-lg)" }}>
              Your decisions
              <span className="muted" style={{ fontWeight: 400 }}>
                {" "}
                ({openDecisions.length} open)
              </span>
            </h2>
            <Link href={`/workday/${roleId}/decisions`} className="btn btn-sm btn-quiet">
              Open the decision list
            </Link>
          </div>

          {openDecisions.length === 0 ? (
            <div className="empty-state">
              <span className="label">No open decisions at this moment</span>
              <p>
                Move the timeline forward to reach the next point where this role's judgment is
                required.
              </p>
            </div>
          ) : (
            <div className="stack stack-3">
              {openDecisions.map((entry) => (
                <DecisionBriefCard
                  key={entry.decision.id}
                  decision={toDecisionView(entry.decision)}
                  href={`/workday/${roleId}/decisions#${entry.decision.id}`}
                  language={language}
                />
              ))}
            </div>
          )}

          {decidedDecisions.length > 0 ? (
            <details className="card">
              <summary style={{ cursor: "pointer" }}>
                <span className="label">
                  Decided today ({decidedDecisions.length})
                </span>
              </summary>
              <div className="stack stack-2" style={{ marginTop: "var(--space-3)" }}>
                {decidedDecisions.map((entry) => (
                  <DecisionBriefCard
                    key={entry.decision.id}
                    decision={toDecisionView(entry.decision)}
                    href={`/workday/${roleId}/decisions#${entry.decision.id}`}
                    language={language}
                  />
                ))}
              </div>
            </details>
          ) : null}
        </section>

        {/* ---------------- Signals ---------------- */}
        <section className="grid grid-3" aria-label="Signals and context">
          <SignalPanel
            title="Indicators outside tolerance"
            tone={breachedKris.length > 0 ? "red" : "green"}
            count={breachedKris.length}
            items={breachedKris.map((kri) => ({
              id: kri.id,
              primary: kri.reference,
              secondary: `${kri.name}: ${kri.currentValue} ${kri.unit} against a red threshold of ${kri.redThreshold}`,
              tone: kri.currentStatus === "red" ? "red" : "amber",
            }))}
            emptyMessage="Every indicator this role owns is within tolerance."
          />

          <SignalPanel
            title="Overdue actions"
            tone={overdueActions.length > 0 ? "amber" : "green"}
            count={overdueActions.length}
            items={overdueActions.map((action) => ({
              id: action.id,
              primary: action.reference,
              secondary: `${action.title}. Due ${action.dueOn ?? "not set"}.`,
              tone: "amber",
            }))}
            emptyMessage="No action raised by this role is overdue."
          />

          <SignalPanel
            title="Today's meetings"
            tone="cyan"
            count={meetings.length}
            items={meetings.slice(0, 5).map((meeting) => ({
              id: meeting.id,
              primary: meeting.momentLabel,
              secondary: meeting.title,
              tone: meeting.supportsVoice ? "accent" : "cyan",
            }))}
            emptyMessage="No meetings are scheduled for this role today."
          />
        </section>

        {/* ---------------- The work layer ---------------- */}
        <section className="grid grid-2" aria-label="Work layer">
          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">Inbox, already triaged</span>
              <Link href={`/workday/${roleId}/mail`} className="meta">
                Open mail
              </Link>
            </div>
            <div className="panel-body stack stack-3">
              {inbox.length === 0 ? (
                <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
                  Nothing has arrived for this role at this point in the day.
                </p>
              ) : (
                <>
                  <div className="row row-2 row-wrap">
                    {(["decision", "action", "evidence", "information", "delegate", "noise"] as const).map(
                      (triage) => {
                        const count = inbox.filter((m) => m.proposedTriage === triage).length;
                        if (count === 0) return null;
                        return (
                          <span
                            key={triage}
                            className="chip"
                            data-tone={
                              triage === "decision"
                                ? "amber"
                                : triage === "noise"
                                  ? "neutral"
                                  : triage === "evidence"
                                    ? "green"
                                    : "cyan"
                            }
                          >
                            {count} {triage}
                          </span>
                        );
                      },
                    )}
                  </div>
                  <ul className="stack stack-2">
                    {inbox.slice(0, 5).map((message) => (
                      <li key={message.id} className="stack stack-1">
                        <div className="row row-2 row-wrap row-between">
                          <span className="strong-text truncate" style={{ fontSize: "var(--text-sm)" }}>
                            {message.subject}
                          </span>
                          <span className="chip" data-tone="neutral">
                            {message.proposedTriage}
                          </span>
                        </div>
                        <span className="meta">
                          {message.fromLabel} &middot; {message.channel}
                          {message.isDuplicateOf ? " &middot; duplicate request" : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {inbox.length > 5 ? (
                    <span className="meta">and {inbox.length - 5} more</span>
                  ) : null}
                </>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">Calendar</span>
              <Link href={`/workday/${roleId}/calendar`} className="meta">
                Open calendar
              </Link>
            </div>
            <div className="panel-body stack stack-2">
              {calendar.length === 0 ? (
                <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
                  No calendar entries for this role today.
                </p>
              ) : (
                calendar.slice(0, 6).map((entry) => (
                  <div key={entry.id} className="row row-3 row-between row-wrap">
                    <span className="row row-2">
                      <span className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--text-4)" }}>
                        {entry.startsAt.slice(11, 16)}
                      </span>
                      <span className="truncate" style={{ fontSize: "var(--text-sm)" }}>
                        {entry.title}
                      </span>
                    </span>
                    {entry.hasConflict ? <Chip tone="red">conflict</Chip> : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* ---------------- Background work ---------------- */}
        <section className="panel" aria-label="Background work">
          <div className="panel-head">
            <span className="panel-title">Completed before you arrived</span>
            <span className="meta">
              {background.total} recorded actions, each one inspectable
            </span>
          </div>
          <div className="panel-body">
            <div className="row row-6 row-wrap">
              <BackgroundStat value={background.systemsChecked} label="systems checked" />
              <BackgroundStat value={background.recordsReconciled} label="records reconciled" />
              <BackgroundStat value={background.documentsClassified} label="documents classified" />
              <BackgroundStat value={background.itemsRequested} label="missing items requested" />
              <BackgroundStat
                value={background.contradictionsIdentified}
                label="contradictions identified"
                tone="red"
              />
              <BackgroundStat value={background.routineUpdates} label="routine updates" />
              <BackgroundStat
                value={background.escalatedToHuman}
                label="escalated to you"
                tone="amber"
              />
            </div>
          </div>
        </section>

        <footer className="row row-3 row-wrap">
          <ObjectId id={role.id} label="role" />
          <ObjectId id={role.holderUserId} label="held by" />
          <span className="meta">{holder?.name}</span>
        </footer>
      </div>
    </WorkdayShell>
  );
}

function BackgroundStat({
  value,
  label,
  tone = "cyan",
}: {
  value: number;
  label: string;
  tone?: "cyan" | "amber" | "red";
}) {
  return (
    <div className="stack stack-1">
      <span
        className="mono display"
        style={{
          fontSize: "var(--text-xl)",
          color: value === 0 ? "var(--text-4)" : `var(--${tone})`,
          fontWeight: 600,
        }}
      >
        {value}
      </span>
      <span className="meta">{label}</span>
    </div>
  );
}

function SignalPanel({
  title,
  count,
  items,
  tone,
  emptyMessage,
}: {
  title: string;
  count: number;
  tone: "red" | "amber" | "green" | "cyan";
  items: Array<{ id: string; primary: string | null; secondary: string; tone: string }>;
  emptyMessage: string;
}) {
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title" style={{ fontSize: "var(--text-sm)" }}>
          {title}
        </span>
        <Chip tone={count === 0 ? "green" : tone}>{count}</Chip>
      </div>
      <div className="panel-body stack stack-3">
        {items.length === 0 ? (
          <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
            {emptyMessage}
          </p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="stack stack-1">
              {item.primary ? (
                <span className="mono strong-text" style={{ fontSize: "var(--text-xs)" }}>
                  {item.primary}
                </span>
              ) : null}
              <span style={{ fontSize: "var(--text-sm)", color: "var(--text-2)" }}>
                {item.secondary}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/** Maps a decision row to the view model the decision components expect. */
export function toDecisionView(row: {
  id: string;
  reference: string;
  title: string;
  titleDe: string;
  question: string;
  judgmentKind: string;
  presentedAtMoment: string;
  priorityRank: number;
  whyThisMatters: string;
  preparedPosition: string;
  uncertaintyNote: string;
  confidence: number;
  requiredAuthority: string;
  status: string;
  chosenOptionId: string | null;
  recordedRationale: string;
  decidedByUserId: string | null;
  decidedAtMoment: string | null;
  fromSharedEvent: boolean;
  entityId: string;
}): DecisionView {
  const haystack = `${row.whyThisMatters} ${row.preparedPosition} ${row.question}`.toLowerCase();
  return {
    ...row,
    // The regulatory label is attached whenever the decision text touches a
    // regulatory concept, so the disclosure cannot be forgotten per screen.
    mentionsRegulation:
      haystack.includes("regulat") ||
      haystack.includes("supervis") ||
      haystack.includes("finma") ||
      haystack.includes("dora") ||
      haystack.includes("notification") ||
      haystack.includes("outsourcing"),
  };
}
