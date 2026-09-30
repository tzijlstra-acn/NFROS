/**
 * Collaboration: the simulated outbound messages and their replies.
 *
 * This screen carries one of the product's plainest honesty obligations. The
 * assistant can compose and send an internal request for factual validation,
 * and that request never reaches a real recipient. Rather than assert that in
 * a footnote, the page reads the `simulatedOnly` flag off every row and shows
 * it, so the claim is evidenced by the same data the message is rendered from.
 *
 * The second thing the screen makes visible is the asynchronous loop. A
 * question asked at 09:30 is answered at 13:30, and the interval is the part
 * that matters: the professional did not sit and wait for it, and the answer
 * arrived into a day that had moved on.
 */

import { notFound } from "next/navigation";
import { isDatabaseReady } from "@/db/client";
import { ROLE_IDS, type RoleId } from "@/db/schema/core";
import {
  getCollaborationMessages,
  getRole,
  getUser,
  getUserNameMap,
} from "@/db/repositories/workday";
import { buildIntelligenceRail, uncertaintyFromEvidence } from "@/db/repositories/rail";
import { getScenarioState } from "@/scenario/engine/state";
import { NotSeeded, WorkdayShell } from "@/components/shell/WorkdayShell";
import { IntelligenceRail } from "@/components/shell/IntelligenceRail";
import { Chip, ObjectId, RegulatoryNote } from "@/components/evidence/primitives";
import { momentToMinutes } from "@/domain/nfr/calculators";
import type { Language } from "@/i18n/labels";

export const dynamic = "force-dynamic";

function parseRole(value: string): RoleId {
  if ((ROLE_IDS as readonly string[]).includes(value)) return value as RoleId;
  notFound();
}

type CollaborationRow = ReturnType<typeof getCollaborationMessages>[number];

/** The 24 hour clock label as seeded, read without a timezone conversion. */
function clock(iso: string): string {
  return iso.length >= 16 ? iso.slice(11, 16) : iso;
}

/** Minutes between the question and the answer, when both exist. */
function waitMinutes(row: CollaborationRow): number | null {
  if (!row.replyAtMoment) return null;
  return Math.max(0, momentToMinutes(row.replyAtMoment) - momentToMinutes(row.sentAtMoment));
}

export default async function CollaborationPage({
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
  const names = getUserNameMap();
  const messages = getCollaborationMessages(roleId);
  const nowMinutes = momentToMinutes(state.currentMoment);

  /*
   * A reply is only visible once the clock has reached it. Showing an answer
   * before it arrives would destroy the only thing this screen is about.
   */
  const withVisibleReply = messages.filter(
    (row) =>
      row.replyBody.length > 0 &&
      row.replyAtMoment !== null &&
      momentToMinutes(row.replyAtMoment) <= nowMinutes,
  );
  const awaiting = messages.filter(
    (row) =>
      row.replyBody.length === 0 ||
      row.replyAtMoment === null ||
      momentToMinutes(row.replyAtMoment) > nowMinutes,
  );

  const allSimulated = messages.every((row) => row.simulatedOnly);
  const notSimulated = messages.filter((row) => !row.simulatedOnly);

  const waits = withVisibleReply
    .map((row) => waitMinutes(row))
    .filter((value): value is number => value !== null);
  const longestWait = waits.length > 0 ? Math.max(...waits) : 0;

  const rail = buildIntelligenceRail({
    roleId,
    atMoment: state.currentMoment,
    language,
    contextLabel: `${messages.length} simulated outbound message(s) from this role, ${withVisibleReply.length} answered, ${awaiting.length} still open at ${state.currentMoment}.`,
    evidenceIds: [],
    whyThisMatters: [
      "A request for factual validation is not a decision. It is the step that turns an assumption into something that can be relied on, and it takes as long as the other person takes.",
      awaiting.length > 0
        ? `${awaiting.length} question(s) are still open. Any conclusion that depends on one of them carries that dependency.`
        : "Every question asked by this role has an answer on the record.",
    ],
    uncertainty: [
      ...uncertaintyFromEvidence([]),
      ...awaiting.map((row) => ({
        topic: `No answer yet: ${row.subject}`,
        description: `Sent at ${clock(row.sentAt)} to ${row.toUserIds
          .map((id) => names.get(id) ?? id)
          .join(", ")}. Nothing has come back at ${state.currentMoment}.`,
        kind: "missing-evidence" as const,
        resolutionPath:
          "The answer arrives when the recipient answers. It cannot be manufactured in the meantime.",
        materialToDecision: true,
        sourceIds: row.relatedObjectId ? [row.relatedObjectId] : [],
      })),
    ],
  });

  return (
    <WorkdayShell
      roleId={roleId}
      activeNav="collaboration"
      intelligenceRail={<IntelligenceRail {...rail} />}
    >
      <div className="stack stack-8">
        <header className="stack stack-3">
          <div className="row row-3 row-between row-wrap">
            <div className="stack stack-1">
              <span className="label">{state.currentMoment} &middot; Collaboration</span>
              <h1 className="display" style={{ fontSize: "var(--text-2xl)" }}>
                Questions put to people, and what came back
              </h1>
            </div>
            <div className="row row-2 row-wrap">
              <Chip tone="neutral">{messages.length} sent</Chip>
              <Chip tone="green">{withVisibleReply.length} answered</Chip>
              <Chip tone={awaiting.length > 0 ? "amber" : "green"}>{awaiting.length} open</Chip>
              {longestWait > 0 ? (
                <Chip tone="cyan">longest wait {longestWait} minutes</Chip>
              ) : null}
            </div>
          </div>
          <p className="lede">
            {holder?.name ?? role.holderUserId} asks a first line or a control owner for a fact, and
            then carries on with the day. The answer arrives later, into a day that has moved. That
            interval is the shape of the work, and the screen shows it rather than collapsing it.
          </p>
        </header>

        {/* ---------------- The simulation claim, with its evidence ---------------- */}
        <section
          className="panel"
          aria-label="Every message here is simulated"
          style={{
            borderColor: allSimulated ? "var(--green-edge)" : "var(--red-edge)",
          }}
        >
          <div className="panel-head">
            <span className="panel-title">Every message on this page is simulated</span>
            <Chip tone={allSimulated ? "green" : "red"}>
              {allSimulated ? "verified on every row" : "check the flagged rows"}
            </Chip>
          </div>
          <div className="panel-body stack stack-3">
            <p className="lede" style={{ fontSize: "var(--text-base)" }}>
              Every message on this page is simulated and never reaches a real recipient.
            </p>
            <p style={{ fontSize: "var(--text-sm)" }}>
              No message here has ever left this machine, and none of them can. There is no mail
              transport, no chat integration and no outbound network path in the send tool. The
              recipients named below are synthetic people in a synthetic institution, and the
              replies were written into the seed rather than received from anyone.
            </p>
            <p style={{ fontSize: "var(--text-sm)" }}>
              That claim is not made on trust. Each message row carries a{" "}
              <span className="mono">simulatedOnly</span> flag recorded at the moment it was created,
              and the table below reads it back from the database for every row, including the ones
              that have already been answered.
            </p>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Message</th>
                    <th scope="col">Channel</th>
                    <th scope="col">Sent</th>
                    <th scope="col">simulatedOnly</th>
                  </tr>
                </thead>
                <tbody>
                  {messages.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <a href={`#${row.id}`}>
                          <span className="mono">{row.id}</span>
                        </a>
                      </td>
                      <td>{row.channelName}</td>
                      <td className="mono">{clock(row.sentAt)}</td>
                      <td>
                        <Chip tone={row.simulatedOnly ? "green" : "red"}>
                          {row.simulatedOnly ? "true" : "false"}
                        </Chip>
                      </td>
                    </tr>
                  ))}
                  {messages.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="muted">
                        No message has been sent by this role.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {notSimulated.length > 0 ? (
              <p style={{ fontSize: "var(--text-sm)", color: "var(--red)" }}>
                {notSimulated.length} row(s) do not carry the flag. That would be a defect, and it is
                shown rather than hidden.
              </p>
            ) : null}
          </div>
        </section>

        {/* ---------------- The validation loop ---------------- */}
        <section className="stack stack-4" aria-label="The asynchronous validation loop">
          <h2 style={{ fontSize: "var(--text-lg)" }}>The validation loop</h2>

          {messages.length === 0 ? (
            <div className="empty-state">
              <span className="label">Nothing sent</span>
              <p>This role has not sent a collaboration message in this scenario.</p>
            </div>
          ) : (
            <div className="stack stack-4">
              {messages.map((row) => {
                const replyVisible =
                  row.replyBody.length > 0 &&
                  row.replyAtMoment !== null &&
                  momentToMinutes(row.replyAtMoment) <= nowMinutes;
                const replyPending =
                  row.replyBody.length > 0 &&
                  row.replyAtMoment !== null &&
                  momentToMinutes(row.replyAtMoment) > nowMinutes;
                const wait = waitMinutes(row);

                return (
                  <article
                    key={row.id}
                    id={row.id}
                    className="card card-edge"
                    data-tone={replyVisible ? "green" : "amber"}
                  >
                    <div className="stack stack-4">
                      {/* ---- Header ---- */}
                      <div className="row row-3 row-between row-wrap row-start">
                        <div className="stack stack-1" style={{ minWidth: 0 }}>
                          <span className="strong-text">{row.subject}</span>
                          <span className="meta">
                            {row.channelName} &middot; sent {clock(row.sentAt)} at moment{" "}
                            {row.sentAtMoment} &middot; to{" "}
                            {row.toUserIds.map((id) => names.get(id) ?? id).join(", ")}
                          </span>
                        </div>
                        <div className="row row-2 row-wrap">
                          <Chip tone={row.simulatedOnly ? "green" : "red"}>
                            simulatedOnly = {row.simulatedOnly ? "true" : "false"}
                          </Chip>
                          {replyVisible ? (
                            <Chip tone="green">answered</Chip>
                          ) : replyPending ? (
                            <Chip tone="cyan">answer arrives at {row.replyAtMoment}</Chip>
                          ) : (
                            <Chip tone="amber">still open</Chip>
                          )}
                        </div>
                      </div>

                      {/* ---- The outbound side ---- */}
                      <div className="grid grid-2">
                        <div
                          className="stack stack-2"
                          style={{
                            padding: "var(--space-3)",
                            background: "var(--surface-0)",
                            border: "1px solid var(--border-1)",
                            borderRadius: "var(--radius-md)",
                          }}
                        >
                          <div className="row row-2 row-between row-wrap">
                            <span className="label">
                              Asked at {row.sentAtMoment} by {holder?.name ?? role.holderUserId}
                            </span>
                            <span className="mono meta">{clock(row.sentAt)}</span>
                          </div>
                          <p
                            style={{
                              fontSize: "var(--text-sm)",
                              whiteSpace: "pre-wrap",
                              color: "var(--text-2)",
                            }}
                          >
                            {row.body}
                          </p>
                        </div>

                        {/* ---- The inbound side ---- */}
                        <div
                          className="stack stack-2"
                          style={{
                            padding: "var(--space-3)",
                            background: "var(--surface-0)",
                            border: "1px solid var(--border-1)",
                            borderRadius: "var(--radius-md)",
                          }}
                        >
                          {replyVisible ? (
                            <>
                              <div className="row row-2 row-between row-wrap">
                                <span className="label" style={{ color: "var(--green)" }}>
                                  Answered at {row.replyAtMoment} by{" "}
                                  {row.replyFromUserId
                                    ? (names.get(row.replyFromUserId) ?? row.replyFromUserId)
                                    : "the recipient"}
                                </span>
                                {wait !== null ? (
                                  <span className="mono meta">{wait} minutes later</span>
                                ) : null}
                              </div>
                              <p
                                style={{
                                  fontSize: "var(--text-sm)",
                                  whiteSpace: "pre-wrap",
                                  color: "var(--text-2)",
                                }}
                              >
                                {row.replyBody}
                              </p>
                            </>
                          ) : replyPending ? (
                            <>
                              <span className="label" style={{ color: "var(--cyan)" }}>
                                Not yet at {state.currentMoment}
                              </span>
                              <p style={{ fontSize: "var(--text-sm)" }}>
                                An answer is on the record for {row.replyAtMoment}. It is not shown
                                yet, because at this point in the day it has not arrived. Move the
                                timeline forward to read it.
                              </p>
                            </>
                          ) : (
                            <>
                              <span className="label" style={{ color: "var(--amber)" }}>
                                No answer
                              </span>
                              <p style={{ fontSize: "var(--text-sm)" }}>
                                Nothing has come back, and nothing is scheduled to. This is the
                                honest state of the question at the end of the day, and anything
                                that depends on it remains unsupported.
                              </p>
                            </>
                          )}
                        </div>
                      </div>

                      {/* ---- What it attaches to ---- */}
                      <div className="row row-3 row-wrap">
                        <ObjectId id={row.id} label="message" />
                        {row.relatedObjectId ? (
                          <span className="chip" data-tone="neutral">
                            {row.relatedObjectKind ?? "object"}{" "}
                            <span className="mono">{row.relatedObjectId}</span>
                          </span>
                        ) : null}
                        {row.decisionId ? (
                          <span className="chip" data-tone="amber">
                            decision <span className="mono">{row.decisionId}</span>
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <footer className="stack stack-2">
          <RegulatoryNote language={language} />
          <span className="meta">
            Recipients, replies and channels are synthetic. The send tool has no outbound transport,
            which is why the claim above can be made without qualification.
          </span>
        </footer>
      </div>
    </WorkdayShell>
  );
}
