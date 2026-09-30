/**
 * Meetings: preparation packs and the scripted simulations.
 *
 * The two meetings that support voice are rendered in full, turn by turn,
 * because the signature moment of this surface is a participant making a
 * statement that the assistant can show is contradicted by a document already
 * in the corpus. That moment only works if the transcript, the provenance of
 * each turn and the contradiction flag are all on the same screen.
 *
 * The product never resolves the contradiction. It names the statement, names
 * the evidence it conflicts with, says why the difference matters, and leaves
 * the professional to put the question.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { isDatabaseReady } from "@/db/client";
import { ROLE_IDS, type RoleId } from "@/db/schema/core";
import {
  getEvidenceDocument,
  getMeeting,
  getMeetingMessages,
  getMeetings,
  getRole,
  getUser,
  getUserNameMap,
} from "@/db/repositories/workday";
import { buildIntelligenceRail, citationsFor, uncertaintyFromEvidence } from "@/db/repositories/rail";
import { getScenarioState } from "@/scenario/engine/state";
import { NotSeeded, WorkdayShell } from "@/components/shell/WorkdayShell";
import { IntelligenceRail } from "@/components/shell/IntelligenceRail";
import {
  Chip,
  EvidenceList,
  ObjectId,
  ProvenanceBadge,
  RegulatoryNote,
  type Tone,
} from "@/components/evidence/primitives";
import { getPublicHealth } from "@/server/config/runtime";
import type { Language } from "@/i18n/labels";

export const dynamic = "force-dynamic";

function parseRole(value: string): RoleId {
  if ((ROLE_IDS as readonly string[]).includes(value)) return value as RoleId;
  notFound();
}

type MeetingRow = NonNullable<ReturnType<typeof getMeeting>>;
type MeetingTurn = ReturnType<typeof getMeetingMessages>[number];

const KIND_TONE: Record<string, Tone> = {
  "rcsa-workshop": "cyan",
  "supplier-challenge": "amber",
  "crisis-call": "red",
  committee: "accent",
  meeting: "neutral",
  "one-to-one": "neutral",
};

const SPEAKER_TONE: Record<string, Tone> = {
  participant: "neutral",
  assistant: "accent",
  user: "cyan",
  system: "neutral",
};

export default async function MeetingsPage({ params }: { params: Promise<{ role: string }> }) {
  const { role: roleParam } = await params;
  const roleId = parseRole(roleParam);

  if (!isDatabaseReady()) return <NotSeeded />;
  const state = getScenarioState();
  if (!state) return <NotSeeded />;

  const language = state.language as Language;
  const role = getRole(roleId);
  if (!role) return <NotSeeded />;

  const holder = getUser(role.holderUserId);
  const names = getUserNameMap();
  const health = getPublicHealth();

  const meetingList = getMeetings(roleId);

  /*
   * Only the live simulations get a full transcript. The rest get their
   * preparation pack, which is the honest position: a meeting with no seeded
   * script has no transcript to show, and inventing one would be the wrong
   * kind of demonstration.
   */
  const simulations = meetingList
    .filter((meeting) => meeting.supportsVoice)
    .map((meeting) => {
      const loaded = getMeeting(meeting.id) ?? meeting;
      return { meeting: loaded, turns: getMeetingMessages(meeting.id) };
    });

  const otherMeetings = meetingList.filter((meeting) => !meeting.supportsVoice);

  const allTurns = simulations.flatMap((entry) => entry.turns);
  const contradictions = allTurns.filter((turn) => turn.contradictsEvidenceId !== null);

  const railEvidenceIds = Array.from(
    new Set([
      ...meetingList.flatMap((meeting) => meeting.evidenceDocumentIds),
      ...contradictions
        .map((turn) => turn.contradictsEvidenceId)
        .filter((id): id is string => id !== null),
    ]),
  );

  const rail = buildIntelligenceRail({
    roleId,
    atMoment: state.currentMoment,
    language,
    contextLabel: `${meetingList.length} meeting(s) today, ${simulations.length} of them interactive, with ${contradictions.length} statement(s) flagged against evidence.`,
    evidenceIds: railEvidenceIds,
    whyThisMatters: [
      contradictions.length > 0
        ? `${contradictions.length} statement(s) in the scripted transcripts conflict with a document already held. Each flag names the document, so the question can be put in the room rather than discovered afterwards.`
        : "No statement in the scripted transcripts currently conflicts with a held document.",
      "The prepared challenge questions are drafts. They are yours to edit, discard or replace before you use them.",
    ],
    uncertainty: uncertaintyFromEvidence(railEvidenceIds),
  });

  return (
    <WorkdayShell
      roleId={roleId}
      activeNav="meetings"
      intelligenceRail={<IntelligenceRail {...rail} />}
    >
      <div className="stack stack-8">
        <header className="stack stack-3">
          <div className="row row-3 row-between row-wrap">
            <div className="stack stack-1">
              <span className="label">{state.currentMoment} &middot; Meetings</span>
              <h1 className="display" style={{ fontSize: "var(--text-2xl)" }}>
                Discussions, with the evidence already in the room
              </h1>
            </div>
            <div className="row row-2 row-wrap">
              <Chip tone="neutral">{meetingList.length} meetings</Chip>
              <Chip tone="accent">{simulations.length} interactive</Chip>
              <Chip tone={contradictions.length > 0 ? "red" : "green"}>
                {contradictions.length} contradiction flag
                {contradictions.length === 1 ? "" : "s"}
              </Chip>
            </div>
          </div>
          <p className="lede">
            Each meeting carries the preparation pack that was assembled for it, the evidence that
            pack rests on, and the challenge questions drafted for you. In the two interactive
            meetings, every turn carries its provenance, and a statement that conflicts with a held
            document is flagged against that document by identifier.
          </p>
        </header>

        {/* ---------------- Mode and voice honesty ---------------- */}
        <section className="panel" aria-label="How the simulation runs">
          <div className="panel-head">
            <span className="panel-title">How these simulations run</span>
            <Chip
              tone={
                health.mode === "live" ? "green" : health.mode === "safe" ? "cyan" : "neutral"
              }
            >
              {health.mode} mode
            </Chip>
          </div>
          <div className="panel-body stack stack-3">
            <ul className="stack stack-2" style={{ fontSize: "var(--text-sm)" }}>
              <li className="row row-3 row-start">
                <span aria-hidden="true" className="mono shrink-0" style={{ color: "var(--cyan)" }}>
                  =
                </span>
                <span>
                  A typed fallback always works. The scripted turns below are seeded rows, so the
                  discussion can be run end to end with no model available at all.
                </span>
              </li>
              <li className="row row-3 row-start">
                <span
                  aria-hidden="true"
                  className="mono shrink-0"
                  style={{ color: health.voiceAvailable ? "var(--green)" : "var(--amber)" }}
                >
                  {health.voiceAvailable ? "=" : "!"}
                </span>
                <span>
                  Voice requires live mode and a configured realtime model.{" "}
                  {health.voiceAvailable
                    ? "Both are present in this process, so spoken interaction is available."
                    : "That is not the case in this process, so spoken interaction is unavailable and the typed path is used instead."}
                </span>
              </li>
              <li className="row row-3 row-start">
                <span
                  aria-hidden="true"
                  className="mono shrink-0"
                  style={{ color: "var(--text-4)" }}
                >
                  ~
                </span>
                <span>
                  In live mode the seeded turns remain as anchors and the model fills the
                  participants around them, so the moments that matter happen either way.
                </span>
              </li>
            </ul>
            {health.modeReason ? (
              <p className="meta">Mode note: {health.modeReason}</p>
            ) : null}
          </div>
        </section>

        {/* ---------------- Contradiction flags, gathered ---------------- */}
        {contradictions.length > 0 ? (
          <section className="stack stack-3" aria-label="Contradiction flags">
            <h2 style={{ fontSize: "var(--text-lg)", color: "var(--red)" }}>
              Statements flagged against held evidence ({contradictions.length})
            </h2>
            <div className="stack stack-3">
              {contradictions.map((turn) => {
                const document = turn.contradictsEvidenceId
                  ? getEvidenceDocument(turn.contradictsEvidenceId)
                  : undefined;
                return (
                  <div key={turn.id} className="card card-edge" data-tone="red">
                    <div className="stack stack-3">
                      <div className="row row-2 row-wrap row-between">
                        <span className="strong-text">
                          {turn.speakerLabel} at {turn.atMoment}
                        </span>
                        <div className="row row-2">
                          <ProvenanceBadge kind={turn.provenance} language={language} />
                          <Chip tone="red">contradiction flag</Chip>
                        </div>
                      </div>
                      <blockquote
                        style={{
                          fontSize: "var(--text-sm)",
                          borderLeft: "2px solid var(--red)",
                          paddingLeft: "var(--space-3)",
                        }}
                      >
                        {turn.content}
                      </blockquote>
                      <div className="stack stack-1">
                        <span className="label" style={{ color: "var(--red)" }}>
                          Conflicts with
                        </span>
                        <span className="row row-2 row-wrap">
                          <span className="mono strong-text" style={{ fontSize: "var(--text-sm)" }}>
                            {turn.contradictsEvidenceId}
                          </span>
                          {document ? (
                            <>
                              <span className="meta">{document.title}</span>
                              <span className="meta">
                                {document.sourceSystem} &middot; {document.documentDate}
                              </span>
                            </>
                          ) : (
                            <span className="meta">
                              The document is not in the corpus at this moment.
                            </span>
                          )}
                        </span>
                      </div>
                      {turn.contradictionNote.length > 0 ? (
                        <div className="stack stack-1">
                          <span className="label">Why the difference matters</span>
                          <p style={{ fontSize: "var(--text-sm)" }}>{turn.contradictionNote}</p>
                        </div>
                      ) : null}
                      <div className="row row-3 row-wrap">
                        <a href={`#${turn.meetingId}`} className="btn btn-sm btn-quiet">
                          Open the transcript at this turn
                        </a>
                        {turn.flagDismissed ? (
                          <Chip tone="neutral">flag dismissed by a person</Chip>
                        ) : (
                          <Chip tone="amber">flag standing, not yet addressed</Chip>
                        )}
                        {turn.correctionRecorded ? (
                          <Chip tone="green">factual correction recorded</Chip>
                        ) : null}
                      </div>
                      {turn.correctionRecorded && turn.correctionText.length > 0 ? (
                        <div className="stack stack-1">
                          <span className="label">The correction recorded</span>
                          <p className="dim" style={{ fontSize: "var(--text-sm)" }}>
                            {turn.correctionText}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* ---------------- The interactive meetings, in full ---------------- */}
        {simulations.length === 0 ? (
          <div className="empty-state">
            <span className="label">No interactive meeting for this role</span>
            <p>
              This role has no meeting with a scripted simulation. The preparation packs below are
              still complete.
            </p>
          </div>
        ) : null}

        {simulations.map(({ meeting, turns }) => (
          <MeetingSection
            key={meeting.id}
            meeting={meeting}
            turns={turns}
            names={names}
            language={language}
            roleId={roleId}
            interactive
            actingUserName={holder?.name ?? role.holderUserId}
            voiceAvailable={health.voiceAvailable}
          />
        ))}

        {/* ---------------- The remaining meetings ---------------- */}
        {otherMeetings.length > 0 ? (
          <section className="stack stack-4" aria-label="Other meetings">
            <h2 style={{ fontSize: "var(--text-lg)" }}>
              The rest of the day ({otherMeetings.length})
            </h2>
            {otherMeetings.map((meeting) => (
              <MeetingSection
                key={meeting.id}
                meeting={meeting}
                turns={[]}
                names={names}
                language={language}
                roleId={roleId}
                interactive={false}
                actingUserName={holder?.name ?? role.holderUserId}
                voiceAvailable={health.voiceAvailable}
              />
            ))}
          </section>
        ) : null}

        <footer className="stack stack-2">
          <RegulatoryNote language={language} />
          <span className="meta">
            Participants, statements and packs are synthetic. No recording was made and no real
            person is represented.
          </span>
        </footer>
      </div>
    </WorkdayShell>
  );
}

/* ==========================================================================
   One meeting
   ========================================================================== */

function MeetingSection({
  meeting,
  turns,
  names,
  language,
  roleId,
  interactive,
  actingUserName,
  voiceAvailable,
}: {
  meeting: MeetingRow;
  turns: MeetingTurn[];
  names: Map<string, string>;
  language: Language;
  roleId: RoleId;
  interactive: boolean;
  actingUserName: string;
  voiceAvailable: boolean;
}) {
  const citations = citationsFor(meeting.evidenceDocumentIds);
  const flaggedTurns = turns.filter((turn) => turn.contradictsEvidenceId !== null);

  return (
    <section id={meeting.id} className="panel" aria-label={meeting.title}>
      <div className="panel-head">
        <div className="stack stack-1">
          <span className="panel-title">
            {language === "de" && meeting.titleDe.length > 0 ? meeting.titleDe : meeting.title}
          </span>
          <span className="meta">
            {meeting.momentLabel} &middot; {meeting.reference} &middot; {meeting.kind}
          </span>
        </div>
        <div className="row row-2 row-wrap">
          {interactive ? <Chip tone="accent">interactive</Chip> : null}
          {flaggedTurns.length > 0 ? (
            <Chip tone="red">
              {flaggedTurns.length} flag{flaggedTurns.length === 1 ? "" : "s"}
            </Chip>
          ) : null}
          <Chip tone={KIND_TONE[meeting.kind] ?? "neutral"}>{meeting.status}</Chip>
        </div>
      </div>

      <div className="panel-body stack stack-5">
        {/* ---- Objective and participants ---- */}
        <div className="stack stack-2">
          <span className="label">Objective</span>
          <p style={{ fontSize: "var(--text-sm)" }}>{meeting.objective}</p>
          <div className="row row-2 row-wrap">
            {meeting.participantUserIds.map((userId) => (
              <span
                key={userId}
                className="chip"
                data-tone={userId === meeting.participantUserIds[0] ? "cyan" : "neutral"}
              >
                {names.get(userId) ?? userId}
              </span>
            ))}
          </div>
          {meeting.subjectId ? (
            <div className="row row-2 row-wrap">
              <span className="meta">Subject</span>
              <ObjectId id={meeting.subjectId} label={meeting.subjectKind ?? "object"} />
            </div>
          ) : null}
        </div>

        {/* ---- Preparation pack ---- */}
        <div className="stack stack-2">
          <span className="label">Preparation pack</span>
          {meeting.preparationSummary.length > 0 ? (
            <p
              style={{
                fontSize: "var(--text-sm)",
                whiteSpace: "pre-wrap",
                color: "var(--text-2)",
                borderLeft: "2px solid var(--border-2)",
                paddingLeft: "var(--space-3)",
              }}
            >
              {meeting.preparationSummary}
            </p>
          ) : (
            <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
              No preparation pack was assembled for this meeting.
            </p>
          )}
        </div>

        {/* ---- Prepared challenge questions ---- */}
        <div className="stack stack-2">
          <span className="label">
            Prepared challenge questions ({meeting.preparedQuestions.length})
          </span>
          {meeting.preparedQuestions.length === 0 ? (
            <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
              No questions were drafted for this meeting.
            </p>
          ) : (
            <ol className="stack stack-2" style={{ paddingLeft: "var(--space-5)" }}>
              {meeting.preparedQuestions.map((question, index) => (
                <li key={index} style={{ fontSize: "var(--text-sm)" }}>
                  {question}
                </li>
              ))}
            </ol>
          )}
          <p className="meta">
            Drafts for {actingUserName} to edit, discard or replace. Nothing here is asked on your
            behalf.
          </p>
        </div>

        {/* ---- Evidence behind the pack ---- */}
        <EvidenceList
          citations={citations}
          heading="Evidence the pack rests on"
          emptyMessage="No evidence document is cited by this pack."
          language={language}
        />

        {/* ---- Transcript ---- */}
        {interactive ? (
          <div className="stack stack-3">
            <div className="row row-3 row-between row-wrap">
              <span className="label">
                Scripted transcript ({turns.length} turn{turns.length === 1 ? "" : "s"})
              </span>
              <span className="meta">
                {voiceAvailable
                  ? "Voice is available in this process. Typed input works identically."
                  : "Voice is unavailable in this process. The typed path below is the full experience."}
              </span>
            </div>

            {turns.length === 0 ? (
              <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
                No turns are seeded for this meeting yet.
              </p>
            ) : (
              <ol className="stack stack-3" style={{ listStyle: "none" }}>
                {turns.map((turn) => (
                  <li key={turn.id} id={turn.id}>
                    <TranscriptTurn turn={turn} names={names} language={language} />
                  </li>
                ))}
              </ol>
            )}
          </div>
        ) : null}

        {/* ---- Outcome ---- */}
        <div className="row row-3 row-wrap row-between">
          <div className="stack stack-1">
            <span className="label">Recorded outcome</span>
            <span style={{ fontSize: "var(--text-sm)" }}>
              {meeting.outcome.length > 0 ? (
                meeting.outcome
              ) : (
                <span className="muted">
                  Nothing recorded. The outcome is written by the person who held the meeting.
                </span>
              )}
            </span>
          </div>
          <div className="row row-3 row-wrap">
            <Link href={`/workday/${roleId}/calendar#${meeting.id}`} className="meta">
              Back to the calendar
            </Link>
            <ObjectId id={meeting.id} label="meeting" />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ==========================================================================
   One turn
   ========================================================================== */

function TranscriptTurn({
  turn,
  names,
  language,
}: {
  turn: MeetingTurn;
  names: Map<string, string>;
  language: Language;
}) {
  const flagged = turn.contradictsEvidenceId !== null;
  const speaker = turn.speakerUserId ? (names.get(turn.speakerUserId) ?? turn.speakerLabel) : turn.speakerLabel;

  return (
    <div
      className="card card-edge"
      data-tone={flagged ? "red" : (SPEAKER_TONE[turn.speakerKind] ?? "neutral")}
    >
      <div className="stack stack-2">
        <div className="row row-3 row-wrap row-between">
          <span className="row row-2 row-wrap">
            <span className="strong-text" style={{ fontSize: "var(--text-sm)" }}>
              {speaker}
            </span>
            <Chip tone={SPEAKER_TONE[turn.speakerKind] ?? "neutral"}>{turn.speakerKind}</Chip>
            <span className="mono meta">{turn.atMoment}</span>
          </span>
          <span className="row row-2 row-wrap">
            <ProvenanceBadge kind={turn.provenance} language={language} />
            {turn.isScriptedAnchor ? <Chip tone="neutral">seeded anchor</Chip> : null}
          </span>
        </div>

        <p style={{ fontSize: "var(--text-sm)", whiteSpace: "pre-wrap" }}>{turn.content}</p>

        {flagged ? (
          <div
            className="stack stack-2"
            style={{
              padding: "var(--space-3)",
              background: "var(--red-tint)",
              border: "1px solid var(--red-edge)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <div className="row row-2 row-wrap row-between">
              <span className="label" style={{ color: "var(--red)" }}>
                This statement conflicts with a document already held
              </span>
              <span className="mono strong-text" style={{ fontSize: "var(--text-xs)" }}>
                {turn.contradictsEvidenceId}
              </span>
            </div>
            {turn.contradictionNote.length > 0 ? (
              <p style={{ fontSize: "var(--text-sm)" }}>{turn.contradictionNote}</p>
            ) : null}
            <p className="meta">
              The flag is raised, not resolved. Put the question, record what is offered in answer,
              and decide afterwards which account stands.
            </p>
            <div className="row row-2 row-wrap">
              {turn.flagDismissed ? (
                <Chip tone="neutral">dismissed by a person</Chip>
              ) : (
                <Chip tone="amber">standing</Chip>
              )}
              {turn.correctionRecorded ? (
                <Chip tone="green">factual correction recorded</Chip>
              ) : null}
            </div>
            {turn.correctionRecorded && turn.correctionText.length > 0 ? (
              <p className="dim" style={{ fontSize: "var(--text-sm)" }}>
                {turn.correctionText}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
