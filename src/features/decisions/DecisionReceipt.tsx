"use client";

/**
 * The receipt of a recorded decision.
 *
 * Rendered from persisted rows only: the receipt lines for the changes that
 * executed, the outcome record for the ones that did not, the decision row for
 * the choice and the rationale, the approvals for who approved. So the receipt
 * a reader sees the moment they confirm is the receipt they see after a
 * refresh, and it can be reopened from "Recorded today" (J21).
 *
 * Executed and not executed are two lists with two counts. A reader who
 * approved three changes and got two is owed the third, by name, with the
 * reason, and a success mark is never shown over a partial result.
 */

import { IconAlertTriangle, IconArrowUpRight, IconCheck, IconCircleX } from "@tabler/icons-react";
import type { Language } from "@/i18n/labels";
import { COPY, fill, say } from "./copy";
import type { LinkView, RecordedDecisionView } from "./model";
import { RegulatoryLine } from "./DecisionStages";

function Link({ link }: { link: LinkView }) {
  return link.href ? (
    <a className="wd-dq-link" href={link.href}>
      <span>{link.label}</span>
      <IconArrowUpRight size={13} stroke={2} aria-hidden="true" />
    </a>
  ) : (
    <span className="wd-dq-body">{link.label}</span>
  );
}

export function DecisionReceipt({
  id,
  detail,
  language,
}: {
  id: string;
  detail: RecordedDecisionView;
  language: Language;
}) {
  const tone = detail.outcome === "complete" || detail.outcome === "no-changes" ? "success" : "warning";

  return (
    <div
      className="wd-dq-active"
      id={id}
      aria-label={detail.headline}
      data-presentation-region="decision-result"
      data-presentation-ready="true"
      data-testid="decision-receipt"
      data-outcome={detail.outcome}
    >
      <div className="wd-dq-outcome" data-tone={tone} role="status">
        {tone === "success" ? (
          <IconCheck size={15} stroke={2} aria-hidden="true" />
        ) : (
          <IconAlertTriangle size={15} stroke={2} aria-hidden="true" />
        )}
        <span className="wd-stack-1">
          <span className="wd-strong" data-testid="decision-outcome-line">
            {detail.outcomeLine}
          </span>
          <span className="wd-dq-micro">
            {fill(say(COPY.recordedAt, language), {
              moment: detail.decidedAtMoment ?? "",
              name: detail.decidedByName,
            })}
            {detail.chosenOptionLabel ? (
              <>
                <span aria-hidden="true"> · </span>
                {detail.chosenOptionLabel}
              </>
            ) : null}
          </span>
        </span>
      </div>

      <div className="wd-dq-receipt-grid">
        <section aria-label={say(COPY.executedHeading, language)} data-testid="decision-receipt-executed">
          <span className="wd-dq-label">
            {say(COPY.executedHeading, language)}
            <span className="wd-disclosure-count">{detail.executed.length}</span>
          </span>
          {detail.executed.length === 0 ? (
            <span className="wd-dq-muted-line">{say(COPY.nothingExecuted, language)}</span>
          ) : (
            <ul className="wd-dq-receipt-list">
              {detail.executed.map((line) => (
                <li key={line.id}>
                  <IconCheck size={13} stroke={2.2} aria-hidden="true" className="wd-dq-receipt-ok" />
                  <span className="wd-stack-1 wd-dq-change-main">
                    <span className="wd-dq-change-label">{line.label}</span>
                    {line.statements.map((statement, index) => (
                      <span key={`${line.id}-${index}`} className="wd-dq-receipt-statement">
                        {statement}
                      </span>
                    ))}
                    <span className="wd-dq-micro wd-dq-truncate">
                      {line.register}
                      <span aria-hidden="true"> · </span>
                      <span className="wd-mono">{line.targetId}</span>
                      {line.auditEventId ? (
                        <>
                          <span aria-hidden="true"> · </span>
                          {fill(say(COPY.auditRef, language), { id: line.auditEventId })}
                        </>
                      ) : null}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label={say(COPY.notExecutedHeading, language)} data-testid="decision-receipt-failed">
          <span className="wd-dq-label">
            {say(COPY.notExecutedHeading, language)}
            <span className="wd-disclosure-count">{detail.failed.length}</span>
          </span>
          {detail.failed.length === 0 ? (
            <span className="wd-dq-muted-line">{say(COPY.nothingFailed, language)}</span>
          ) : (
            <ul className="wd-dq-receipt-list" data-tone="warning">
              {detail.failed.map((change) => (
                <li key={change.key}>
                  <IconCircleX size={13} stroke={2.2} aria-hidden="true" className="wd-dq-receipt-fail" />
                  <span className="wd-stack-1 wd-dq-change-main">
                    <span className="wd-dq-change-label">{change.label}</span>
                    <span className="wd-dq-receipt-statement">
                      {change.outcomeLabel}: {change.reason}
                    </span>
                    <span className="wd-dq-micro wd-dq-truncate">
                      {change.register}
                      {change.targetId ? (
                        <>
                          <span aria-hidden="true"> · </span>
                          <span className="wd-mono">{change.targetId}</span>
                        </>
                      ) : null}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <dl className="wd-dq-facts wd-dq-facts-receipt">
        <div className="wd-dq-facts-wide">
          <dt>{fill(say(COPY.rationaleOwned, language), { name: detail.decidedByName })}</dt>
          <dd className="wd-dq-clamp-3" data-testid="decision-receipt-rationale">
            {detail.rationale}
          </dd>
        </div>
        <div>
          <dt>{say(COPY.approverLabelReceipt, language)}</dt>
          <dd data-testid="decision-receipt-approvals">
            {detail.approvalCount > 0
              ? fill(say(COPY.approvalsGranted, language), { count: detail.approvalCount, name: detail.approverName })
              : say(COPY.approvalsGrantedNone, language)}
          </dd>
        </div>
        {detail.process ? (
          <div>
            <dt>{say(COPY.processStage, language)}</dt>
            <dd>
              <Link link={detail.process} />
            </dd>
          </div>
        ) : null}
        {detail.meeting ? (
          <div>
            <dt>{say(COPY.meeting, language)}</dt>
            <dd>
              <Link link={detail.meeting} />
            </dd>
          </div>
        ) : null}
      </dl>

      <span className="wd-dq-micro">{say(COPY.receiptNote, language)}</span>
      <RegulatoryLine language={language} />
    </div>
  );
}
