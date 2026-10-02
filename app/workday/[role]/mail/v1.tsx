/**
 * Mail: inbox triage.
 *
 * The screen is organised by the triage outcome rather than by arrival time,
 * because arrival time is the one ordering that carries no professional
 * information. Every message shows the proposed outcome, the rationale behind
 * it and the confidence in it, so the proposal can be disagreed with rather
 * than merely accepted.
 *
 * Duplicated evidence requests are rendered as an explicit relationship
 * between two messages. Removing duplicated work is one of the product's
 * specific claims, so the duplicate has to be visible as a duplicate, with the
 * message it duplicates named and linked, rather than silently suppressed.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { isDatabaseReady } from "@/db/client";
import { ROLE_IDS, type RoleId } from "@/db/schema/core";
import { getInbox, getRole, getUserNameMap } from "@/db/repositories/workday";
import { buildIntelligenceRail, uncertaintyFromEvidence } from "@/db/repositories/rail";
import { getScenarioState, SHARED_EVENT_MOMENT } from "@/scenario/engine/state";
import { NotSeeded, WorkdayShell } from "@/components/shell/WorkdayShell";
import { IntelligenceRail } from "@/components/shell/IntelligenceRail";
import {
  Chip,
  ConfidenceMeter,
  ObjectId,
  RegulatoryNote,
  type Tone,
} from "@/components/evidence/primitives";
import type { Language } from "@/i18n/labels";

export const dynamic = "force-dynamic";

function parseRole(value: string): RoleId {
  if ((ROLE_IDS as readonly string[]).includes(value)) return value as RoleId;
  notFound();
}

/** The triage outcomes, in the order a professional would work through them. */
const TRIAGE_ORDER = [
  "decision",
  "action",
  "evidence",
  "delegate",
  "information",
  "noise",
] as const;

const TRIAGE_TONE: Record<string, Tone> = {
  decision: "amber",
  action: "cyan",
  evidence: "green",
  delegate: "accent",
  information: "neutral",
  noise: "neutral",
};

const TRIAGE_MEANING: Record<string, string> = {
  decision: "This becomes a decision you own. It is already on the decision list.",
  action: "This becomes a tracked action with an owner and a date.",
  evidence: "This is evidence. It is filed against the object it evidences.",
  delegate: "This belongs to someone else and can be passed on with context.",
  information: "This is read and retained. No work follows from it.",
  noise: "Nothing follows from this. It is kept, not surfaced.",
};

type InboxRow = ReturnType<typeof getInbox>[number];

export default async function MailPage({ params }: { params: Promise<{ role: string }> }) {
  const { role: roleParam } = await params;
  const roleId = parseRole(roleParam);

  if (!isDatabaseReady()) return <NotSeeded />;
  const state = getScenarioState();
  if (!state) return <NotSeeded />;

  const language = state.language as Language;
  const role = getRole(roleId);
  if (!role) return <NotSeeded />;

  const names = getUserNameMap();
  const inbox = getInbox(roleId, state.currentMoment);

  const byId = new Map<string, InboxRow>(inbox.map((row) => [row.id, row]));

  /*
   * Duplicates are indexed in both directions. The duplicate needs to name
   * what it duplicates, and the original needs to say how many requests are
   * pointing at it, because that count is the size of the removed rework.
   */
  const duplicatesOf = new Map<string, InboxRow[]>();
  for (const row of inbox) {
    if (!row.isDuplicateOf) continue;
    const list = duplicatesOf.get(row.isDuplicateOf) ?? [];
    list.push(row);
    duplicatesOf.set(row.isDuplicateOf, list);
  }

  const duplicateCount = inbox.filter((row) => row.isDuplicateOf !== null).length;
  const fromEvent = inbox.filter((row) => row.fromSharedEvent);
  const unread = inbox.filter((row) => !row.isRead);
  const awaitingResponse = inbox.filter((row) => row.requiresResponseBy !== null);

  const grouped = TRIAGE_ORDER.map((triage) => ({
    triage,
    rows: inbox.filter((row) => row.proposedTriage === triage),
  }));

  /* Any triage value the seed carries that is not in the canonical order. */
  const otherRows = inbox.filter(
    (row) => !(TRIAGE_ORDER as readonly string[]).includes(row.proposedTriage),
  );

  const rail = buildIntelligenceRail({
    roleId,
    atMoment: state.currentMoment,
    language,
    contextLabel: `Inbox at ${state.currentMoment}: ${inbox.length} message(s) visible, ${duplicateCount} of them duplicate an earlier evidence request.`,
    evidenceIds: [],
    whyThisMatters: [
      `Every message here already carries a proposed outcome, so the question is whether the outcome is right, not what the message is about.`,
      duplicateCount > 0
        ? `${duplicateCount} message(s) ask again for something already requested. Answering each one separately is the rework this screen exists to remove.`
        : `No duplicated evidence request is present in the inbox at this moment.`,
    ],
    uncertainty: uncertaintyFromEvidence([]),
  });

  return (
    <WorkdayShell
      roleId={roleId}
      activeNav="mail"
      intelligenceRail={<IntelligenceRail {...rail} />}
    >
      <div className="stack stack-8">
        <header className="stack stack-3">
          <div className="row row-3 row-between row-wrap">
            <div className="stack stack-1">
              <span className="label">{state.currentMoment} &middot; Mail and queues</span>
              <h1 className="display" style={{ fontSize: "var(--text-2xl)" }}>
                Messages already converted into work
              </h1>
            </div>
            <div className="row row-2 row-wrap">
              <Chip tone="neutral">{inbox.length} visible</Chip>
              <Chip tone={unread.length > 0 ? "cyan" : "green"}>{unread.length} unread</Chip>
              <Chip tone={duplicateCount > 0 ? "amber" : "green"}>
                {duplicateCount} duplicate request{duplicateCount === 1 ? "" : "s"}
              </Chip>
              <Chip tone={fromEvent.length > 0 ? "red" : "neutral"}>
                {fromEvent.length} from the {SHARED_EVENT_MOMENT} event
              </Chip>
            </div>
          </div>
          <p className="lede">
            The inbox is grouped by the proposed triage outcome, not by arrival time. Each message
            carries the rationale for its proposed outcome and the confidence in that proposal.
            Nothing here has been deleted or hidden: a message triaged as noise is still present and
            still readable.
          </p>
        </header>

        {/* ---------------- Triage distribution ---------------- */}
        <section className="panel" aria-label="Triage distribution">
          <div className="panel-head">
            <span className="panel-title">What the triage proposes</span>
            <span className="meta">
              {awaitingResponse.length} message(s) carry a response deadline
            </span>
          </div>
          <div className="panel-body">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Proposed outcome</th>
                    <th scope="col" className="num">
                      Messages
                    </th>
                    <th scope="col">What that means</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped
                    .filter((group) => group.rows.length > 0)
                    .map((group) => (
                      <tr key={group.triage}>
                        <td>
                          <Chip tone={TRIAGE_TONE[group.triage] ?? "neutral"}>{group.triage}</Chip>
                        </td>
                        <td className="num">{group.rows.length}</td>
                        <td>{TRIAGE_MEANING[group.triage] ?? ""}</td>
                      </tr>
                    ))}
                  {otherRows.length > 0 ? (
                    <tr>
                      <td>
                        <Chip tone="neutral">other</Chip>
                      </td>
                      <td className="num">{otherRows.length}</td>
                      <td>
                        A triage value the interface does not have a canonical group for. Shown in
                        full below rather than dropped.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ---------------- Duplicated evidence requests ---------------- */}
        <section className="stack stack-3" aria-label="Duplicated evidence requests">
          <h2 style={{ fontSize: "var(--text-lg)" }}>
            Duplicated requests
            <span className="muted" style={{ fontWeight: 400 }}>
              {" "}
              ({duplicateCount})
            </span>
          </h2>
          {duplicateCount === 0 ? (
            <div className="empty-state">
              <span className="label">No duplicate request at this moment</span>
              <p>
                No message visible at {state.currentMoment} repeats a request that another message
                already makes.
              </p>
            </div>
          ) : (
            <div className="stack stack-3">
              {Array.from(duplicatesOf.entries()).map(([originalId, duplicates]) => {
                const original = byId.get(originalId);
                return (
                  <div key={originalId} className="card card-edge" data-tone="amber">
                    <div className="stack stack-3">
                      <div className="row row-2 row-wrap row-between">
                        <span className="strong-text">
                          {duplicates.length} message
                          {duplicates.length === 1 ? "" : "s"} ask again for the same thing
                        </span>
                        <Chip tone="amber">rework removed</Chip>
                      </div>

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
                          <span className="label">The request of record</span>
                          {original ? (
                            <>
                              <a
                                href={`#${original.id}`}
                                className="strong-text"
                                style={{ fontSize: "var(--text-sm)" }}
                              >
                                {original.subject}
                              </a>
                              <span className="meta">
                                {original.fromLabel} &middot; {original.receivedAt.slice(11, 16)}{" "}
                                &middot; {original.channel}
                              </span>
                              <ObjectId id={original.id} label="message" />
                            </>
                          ) : (
                            <>
                              <span style={{ fontSize: "var(--text-sm)" }}>
                                The original request is not visible at this moment on the timeline.
                              </span>
                              <ObjectId id={originalId} label="message" />
                            </>
                          )}
                        </div>

                        <div
                          className="stack stack-2"
                          style={{
                            padding: "var(--space-3)",
                            background: "var(--surface-0)",
                            border: "1px solid var(--border-1)",
                            borderRadius: "var(--radius-md)",
                          }}
                        >
                          <span className="label">Duplicates pointing at it</span>
                          {duplicates.map((duplicate) => (
                            <div key={duplicate.id} className="stack stack-1">
                              <a
                                href={`#${duplicate.id}`}
                                style={{ fontSize: "var(--text-sm)" }}
                              >
                                {duplicate.subject}
                              </a>
                              <span className="meta">
                                {duplicate.fromLabel} &middot;{" "}
                                {duplicate.receivedAt.slice(11, 16)} &middot;{" "}
                                <span className="mono">{duplicate.id}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <p className="dim" style={{ fontSize: "var(--text-sm)" }}>
                        These are answered once. The answer is filed against the object the request
                        concerns, and each duplicate is linked to that answer rather than worked
                        again. The duplicate is not deleted, because the person who sent it is
                        entitled to a reply.
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ---------------- Messages from the shared event ---------------- */}
        {fromEvent.length > 0 ? (
          <section className="panel" aria-label="Messages from the shared event">
            <div className="panel-head">
              <span className="panel-title">
                Arrived with the {SHARED_EVENT_MOMENT} event
              </span>
              <Chip tone="red">{fromEvent.length}</Chip>
            </div>
            <div className="panel-body stack stack-2">
              <p className="dim" style={{ fontSize: "var(--text-sm)" }}>
                These messages exist only because of the shared event. They arrived in a burst, and
                three of the questions they raise are the same question asked by three different
                functions.
              </p>
              <ul className="stack stack-2">
                {fromEvent.map((row) => (
                  <li key={row.id} className="row row-3 row-between row-wrap">
                    <a href={`#${row.id}`} style={{ fontSize: "var(--text-sm)" }}>
                      {row.subject}
                    </a>
                    <span className="row row-2">
                      <span className="mono meta">{row.receivedAt.slice(11, 16)}</span>
                      <Chip tone={TRIAGE_TONE[row.proposedTriage] ?? "neutral"}>
                        {row.proposedTriage}
                      </Chip>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        {/* ---------------- The inbox itself ---------------- */}
        {inbox.length === 0 ? (
          <div className="empty-state">
            <span className="label">Nothing has arrived yet</span>
            <p>
              No message is visible for this role at {state.currentMoment}. Move the timeline
              forward.
            </p>
          </div>
        ) : null}

        {grouped
          .filter((group) => group.rows.length > 0)
          .map((group) => (
            <section
              key={group.triage}
              className="stack stack-3"
              aria-label={`Messages triaged as ${group.triage}`}
            >
              <div className="row row-3 row-between row-wrap">
                <h2 style={{ fontSize: "var(--text-lg)" }}>
                  <Chip tone={TRIAGE_TONE[group.triage] ?? "neutral"}>{group.triage}</Chip>{" "}
                  <span className="muted" style={{ fontWeight: 400 }}>
                    {group.rows.length} message{group.rows.length === 1 ? "" : "s"}
                  </span>
                </h2>
                <span className="meta">{TRIAGE_MEANING[group.triage] ?? ""}</span>
              </div>
              <div className="stack stack-3">
                {group.rows.map((row) => (
                  <MessageCard
                    key={row.id}
                    row={row}
                    roleId={roleId}
                    original={row.isDuplicateOf ? (byId.get(row.isDuplicateOf) ?? null) : null}
                    duplicates={duplicatesOf.get(row.id) ?? []}
                    senderName={row.fromUserId ? (names.get(row.fromUserId) ?? null) : null}
                    language={language}
                  />
                ))}
              </div>
            </section>
          ))}

        {otherRows.length > 0 ? (
          <section className="stack stack-3" aria-label="Other messages">
            <h2 style={{ fontSize: "var(--text-lg)" }}>Other</h2>
            {otherRows.map((row) => (
              <MessageCard
                key={row.id}
                row={row}
                roleId={roleId}
                original={row.isDuplicateOf ? (byId.get(row.isDuplicateOf) ?? null) : null}
                duplicates={duplicatesOf.get(row.id) ?? []}
                senderName={row.fromUserId ? (names.get(row.fromUserId) ?? null) : null}
                language={language}
              />
            ))}
          </section>
        ) : null}

        <footer className="stack stack-2">
          <RegulatoryNote language={language} />
          <span className="meta">
            Messages are synthetic and internal to this machine. Nothing in this inbox was received
            from, or can be replied to, a real correspondent.
          </span>
        </footer>
      </div>
    </WorkdayShell>
  );
}

/* ==========================================================================
   One message
   ========================================================================== */

function MessageCard({
  row,
  roleId,
  original,
  duplicates,
  senderName,
  language,
}: {
  row: InboxRow;
  roleId: RoleId;
  original: InboxRow | null;
  duplicates: InboxRow[];
  senderName: string | null;
  language: Language;
}) {
  const isDuplicate = row.isDuplicateOf !== null;
  const tone: Tone = isDuplicate
    ? "amber"
    : row.fromSharedEvent
      ? "red"
      : (TRIAGE_TONE[row.proposedTriage] ?? "neutral");

  return (
    <article id={row.id} className="card card-edge" data-tone={tone}>
      <div className="stack stack-3">
        {/* ---- Header ---- */}
        <div className="row row-3 row-between row-wrap row-start">
          <div className="stack stack-1" style={{ minWidth: 0 }}>
            <span className="strong-text">{row.subject}</span>
            <span className="meta">
              {senderName ?? row.fromLabel}
              {senderName && senderName !== row.fromLabel ? ` (${row.fromLabel})` : ""} &middot;{" "}
              {row.channel} &middot; received {row.receivedAt.slice(11, 16)} &middot; visible from{" "}
              {row.revealedAtMoment}
            </span>
          </div>
          <div className="row row-2 row-wrap">
            {row.fromSharedEvent ? <Chip tone="red">from the event</Chip> : null}
            {isDuplicate ? <Chip tone="amber">duplicate request</Chip> : null}
            {!row.isRead ? <Chip tone="cyan">unread</Chip> : null}
            <Chip tone={TRIAGE_TONE[row.proposedTriage] ?? "neutral"}>{row.proposedTriage}</Chip>
          </div>
        </div>

        {/* ---- The duplicate relationship, stated on both sides ---- */}
        {isDuplicate ? (
          <div
            className="stack stack-1"
            style={{
              padding: "var(--space-3)",
              background: "var(--amber-tint)",
              border: "1px solid var(--amber-edge)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <span className="label" style={{ color: "var(--amber)" }}>
              This repeats an earlier request
            </span>
            {original ? (
              <p style={{ fontSize: "var(--text-sm)" }}>
                The same thing is already asked for in{" "}
                <a href={`#${original.id}`} className="strong-text">
                  {original.subject}
                </a>{" "}
                from {original.fromLabel} at {original.receivedAt.slice(11, 16)} (
                <span className="mono">{original.id}</span>
                ). It is answered there once, and this message is linked to that answer rather than
                worked again.
              </p>
            ) : (
              <p style={{ fontSize: "var(--text-sm)" }}>
                It duplicates <span className="mono">{row.isDuplicateOf}</span>, which is not
                visible at this point on the timeline.
              </p>
            )}
          </div>
        ) : null}

        {duplicates.length > 0 ? (
          <div className="stack stack-1">
            <span className="label" style={{ color: "var(--amber)" }}>
              {duplicates.length} duplicate request
              {duplicates.length === 1 ? "" : "s"} point at this message
            </span>
            <div className="row row-2 row-wrap">
              {duplicates.map((duplicate) => (
                <a key={duplicate.id} href={`#${duplicate.id}`} className="chip" data-tone="amber">
                  <span className="mono">{duplicate.id}</span>
                  <span className="muted">{duplicate.fromLabel}</span>
                </a>
              ))}
            </div>
          </div>
        ) : null}

        {/* ---- Triage rationale and confidence ---- */}
        <div className="stack stack-2">
          <span className="label">Why it was triaged this way</span>
          <p style={{ fontSize: "var(--text-sm)" }}>
            {row.triageRationale.length > 0
              ? row.triageRationale
              : "No rationale was recorded for this proposal, which is itself a reason to check it."}
          </p>
          <div className="row row-3 row-wrap">
            <ConfidenceMeter value={row.triageConfidence} label="Triage confidence" />
            {row.confirmedTriage ? (
              <Chip tone="green">confirmed as {row.confirmedTriage}</Chip>
            ) : (
              <Chip tone="neutral">not yet confirmed by a person</Chip>
            )}
          </div>
        </div>

        {/* ---- Where it went ---- */}
        {row.linkedDecisionId || row.linkedActionId || row.relatedObjectId ? (
          <div className="row row-3 row-wrap">
            {row.linkedDecisionId ? (
              <Link
                href={`/workday/${roleId}/decisions#${row.linkedDecisionId}`}
                className="chip"
                data-tone="amber"
              >
                decision <span className="mono">{row.linkedDecisionId}</span>
              </Link>
            ) : null}
            {row.linkedActionId ? (
              <span className="chip" data-tone="cyan">
                action <span className="mono">{row.linkedActionId}</span>
              </span>
            ) : null}
            {row.relatedObjectId ? (
              <span className="chip" data-tone="neutral">
                {row.relatedObjectKind ?? "object"}{" "}
                <span className="mono">{row.relatedObjectId}</span>
              </span>
            ) : null}
            {row.requiresResponseBy ? (
              <span className="chip" data-tone="amber">
                response due {row.requiresResponseBy}
              </span>
            ) : null}
          </div>
        ) : null}

        {/* ---- The body, expandable and complete ---- */}
        <details>
          <summary style={{ cursor: "pointer" }}>
            <span className="label">Read the message</span>
          </summary>
          <div className="stack stack-2" style={{ marginTop: "var(--space-3)" }}>
            <p
              style={{
                fontSize: "var(--text-sm)",
                whiteSpace: "pre-wrap",
                borderLeft: "2px solid var(--border-2)",
                paddingLeft: "var(--space-3)",
                color: "var(--text-2)",
              }}
            >
              {row.body}
            </p>
            <div className="row row-3 row-wrap">
              <ObjectId id={row.id} label="message" />
              <span className="meta">priority rank {row.priorityRank}</span>
              <RegulatoryNote language={language} />
            </div>
          </div>
        </details>
      </div>
    </article>
  );
}
