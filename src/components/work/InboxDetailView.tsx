/**
 * The Inbox module's detail body.
 *
 * Action first (plan section 9.4): the classification and the reason for it
 * lead, because they decide what the message needs; then what the message
 * has already become, with links both ways; then the one primary action and
 * the other ways to handle it; then the facts: source, sender, received, the
 * response deadline and the linked object. The message body is the pane's
 * Context section, and its history and audit follow below, from the shell.
 *
 * The AI's proposed classification is never shown without its rationale. A
 * message with no valid proposal says so, and the person's own
 * classification, when there is one, is shown beside the proposal rather
 * than in place of it.
 */

import Link from "next/link";
import type { Language } from "@/i18n/labels";
import { fill, say } from "@/features/work/copy";
import type { InboxDetail } from "@/features/work/modules/inbox/read-model";
import { INBOX_COPY } from "@/features/work/modules/inbox/copy";
import { InboxOperations } from "./InboxOperations";
import { Facts, Section } from "./primitives";

export function InboxDetailView({ detail, roleId, language }: { detail: InboxDetail; roleId: string; language: Language }) {
  const t = (pair: { en: string; de: string }) => say(pair, language);
  const { classification } = detail;
  const hasLineage = detail.conversions.length > 0 || detail.replies.length > 0 || detail.closureLabel !== null;

  return (
    <div className="wd-stack-2">
      <div
        className="wd-work-callout"
        data-tone="ai"
        data-testid="classification"
        data-classification={classification.proposedId ?? "none"}
        data-mode={classification.available ? classification.mode : "unavailable"}
      >
        <span className="wd-strong">{t(INBOX_COPY.classification)}: </span>
        {classification.available && classification.proposedLabel ? (
          <>
            <span className="wd-chip" data-tone={classification.tone}>
              {classification.proposedLabel}
            </span>{" "}
            <span className="wd-meta">
              {classification.confidence !== null
                ? fill(t(INBOX_COPY.confidence), { value: classification.confidence })
                : t(INBOX_COPY.confidenceNone)}
            </span>{" "}
            <span className="wd-chip" data-tone="neutral" title={classification.modeNote}>
              {classification.mode}
            </span>
            <p className="wd-work-text" style={{ marginTop: 4 }} data-testid="classification-rationale">
              <span className="wd-strong">{t(INBOX_COPY.rationale)}: </span>
              {classification.rationale}
              {classification.rationaleNote ? <span className="wd-meta"> {classification.rationaleNote}</span> : null}
            </p>
            <p className="wd-meta" style={{ marginTop: 4 }}>
              {classification.modeNote}
            </p>
          </>
        ) : (
          <>
            <span className="wd-chip" data-tone="neutral">
              {t(INBOX_COPY.notClassified)}
            </span>
            <p className="wd-work-text" style={{ marginTop: 4 }}>
              {classification.modeNote}
            </p>
          </>
        )}
      </div>

      {detail.personTriage ? (
        <div className="wd-work-callout" data-tone="success" data-testid="person-triage">
          <span className="wd-strong">{t(INBOX_COPY.yourClassification)}: </span>
          <span className="wd-chip" data-tone={classification.tone}>
            {detail.personTriage.label}
          </span>{" "}
          <span className="wd-meta">{detail.personTriage.note}</span>
          {detail.personTriage.reason ? (
            <p className="wd-work-text" style={{ marginTop: 4 }}>
              {detail.personTriage.reason}
            </p>
          ) : null}
        </div>
      ) : null}

      {hasLineage ? (
        <Section label={t(INBOX_COPY.became)} count={detail.conversions.length + detail.replies.length}>
          <ul className="wd-work-list" data-testid="inbox-lineage" data-place={detail.place}>
            {detail.conversions.map((conversion) => (
              <li key={`${conversion.kind}:${conversion.id}`} data-conversion={conversion.kind} data-target-id={conversion.id}>
                <span className="wd-chip" data-tone="success">
                  {conversion.chip}
                </span>
                <span className="wd-work-list-main">
                  {conversion.href ? (
                    <Link className="wd-work-link" href={conversion.href}>
                      {conversion.label}
                    </Link>
                  ) : (
                    conversion.label
                  )}
                  <span className="wd-meta"> {conversion.note}</span>
                </span>
                {conversion.by || conversion.at ? (
                  <span className="wd-meta">{[conversion.by, conversion.at].filter(Boolean).join(", ")}</span>
                ) : null}
              </li>
            ))}
            {detail.replies.map((reply) => (
              <li key={reply.id} data-conversion="reply">
                <span className="wd-chip" data-tone="neutral">
                  {t(INBOX_COPY.closedReplied)}
                </span>
                <span className="wd-work-list-main">
                  {reply.subject}
                  <span className="wd-meta"> {fill(t(INBOX_COPY.repliedTo), { name: reply.to })}</span>
                </span>
                <span className="wd-meta">{[reply.by, reply.at].filter(Boolean).join(", ")}</span>
              </li>
            ))}
            {detail.conversions.length === 0 && detail.replies.length === 0 && detail.closureLabel ? (
              <li data-conversion="closed">
                <span className="wd-chip" data-tone="neutral">
                  {detail.closureLabel}
                </span>
                <span className="wd-work-list-main">{detail.personTriage?.note ?? ""}</span>
              </li>
            ) : null}
          </ul>
        </Section>
      ) : null}

      <InboxOperations
        roleId={roleId}
        messageId={detail.id}
        language={language}
        operations={detail.operations}
        forms={detail.forms}
        primaryWords={detail.primaryAction}
        proposedId={classification.proposedId}
        effectiveId={classification.effectiveId}
        proposedLabel={classification.proposedLabel}
      />

      {detail.respondBy?.passed ? (
        <p className="wd-work-callout" data-tone="danger" data-testid="deadline-passed">
          {fill(t(INBOX_COPY.deadlinePassed), { when: detail.respondBy.text })}
        </p>
      ) : null}

      <Facts facts={detail.facts} />

      {detail.duplicateOf ? (
        <Section label={t(INBOX_COPY.duplicateOf)}>
          <p className="wd-work-text">
            <Link className="wd-work-link" href={detail.duplicateOf.href}>
              {detail.duplicateOf.subject}
            </Link>
          </p>
        </Section>
      ) : null}
    </div>
  );
}
