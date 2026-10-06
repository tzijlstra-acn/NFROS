/**
 * The Agenda module's detail body.
 *
 * The next action leads, then the facts, the preparation (what is recorded
 * and what the pack's sources say now), any conflict, the process the entry
 * serves and the work whose deadlines depend on it. Recording the meeting as
 * held is offered once the meeting has started and not before.
 */

import Link from "next/link";
import type { Language } from "@/i18n/labels";
import { fill, say } from "@/features/work/copy";
import type { AgendaDetail } from "@/features/work/modules/agenda/read-model";
import { AGENDA_COPY } from "@/features/work/modules/agenda/copy";
import { RecordHeldForm } from "./RecordHeldForm";
import { Chip, Facts, Section } from "./primitives";

export function AgendaDetailView({
  detail,
  roleId,
  language,
}: {
  detail: AgendaDetail;
  roleId: string;
  language: Language;
}) {
  const t = (pair: { en: string; de: string }) => say(pair, language);

  return (
    <div className="wd-stack-2">
      <div className="wd-work-callout" data-tone="ai" data-testid="next-action">
        <span className="wd-strong">{t(AGENDA_COPY.nextAction)}: </span>
        {detail.nextAction.href ? (
          <Link className="wd-work-link" href={detail.nextAction.href}>
            {detail.nextAction.label}
          </Link>
        ) : (
          detail.nextAction.label
        )}
      </div>

      <Facts facts={detail.facts} />

      <Section label={t(AGENDA_COPY.requiredPreparation)}>
        <div className="wd-row wd-row-wrap" style={{ marginBottom: "var(--wd-2)" }} data-testid="preparation">
          <span className="wd-meta">{t(AGENDA_COPY.recordedPrep)}</span>
          <Chip chip={detail.prep.recorded} />
          <span className="wd-meta">{t(AGENDA_COPY.pack)}</span>
          <Chip
            chip={{
              label: detail.prep.packLabel,
              tone: detail.prep.pack.state === "issues" ? "warning" : detail.prep.pack.state === "ready" ? "success" : "neutral",
            }}
          />
        </div>
        <ul className="wd-work-bullets">
          {detail.required.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </Section>

      <Section label={t(AGENDA_COPY.conflict)}>
        {detail.conflicts.length > 0 ? (
          <div className="wd-stack-1" data-testid="conflicts">
            {detail.conflicts.map((conflict) => (
              <p key={conflict.id} className="wd-work-callout" data-tone="danger">
                <Link className="wd-work-link" href={conflict.href}>
                  {conflict.text}
                </Link>
              </p>
            ))}
          </div>
        ) : (
          <p className="wd-work-text">{t(AGENDA_COPY.noConflict)}</p>
        )}
      </Section>

      <Section label={t(AGENDA_COPY.linkedProcess)}>
        {detail.process ? (
          <p className="wd-work-text" data-testid="linked-process">
            {detail.process.link.href ? (
              <Link className="wd-work-link" href={detail.process.link.href}>
                {detail.process.link.label}
              </Link>
            ) : (
              detail.process.link.label
            )}
            {detail.process.stage ? `, ${fill(t(AGENDA_COPY.servesStage), { stage: detail.process.stage })}` : ""}
            <span className="wd-meta"> {detail.process.note}</span>
          </p>
        ) : (
          <p className="wd-work-text">{t(AGENDA_COPY.noProcess)}</p>
        )}
      </Section>

      <Section label={t(AGENDA_COPY.dependsTitle)} count={detail.dependents.length}>
        <p className="wd-meta">{detail.dependencyNote}</p>
        {detail.dependents.length > 0 ? (
          <ul className="wd-work-list" data-testid="dependent-work">
            {detail.dependents.map((action) => (
              <li key={action.id}>
                <span className="wd-mono" style={{ color: action.overdue ? "var(--wd-danger)" : undefined }}>
                  {action.due}
                </span>
                <span className="wd-work-list-main">
                  <Link className="wd-work-link" href={action.href}>
                    {action.title}
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </Section>

      {detail.outcome ? (
        <Section label={t(AGENDA_COPY.outcome)}>
          <p className="wd-work-callout" data-tone="success">
            {detail.outcome}
          </p>
        </Section>
      ) : null}

      {detail.meeting && !detail.outcome ? (
        <Section label={t(AGENDA_COPY.recordHeld)}>
          <RecordHeldForm
            roleId={roleId}
            language={language}
            meetingId={detail.meeting.id}
            enabled={detail.recordHeld.enabled}
            reason={detail.recordHeld.reason}
            dependentIds={detail.recordHeld.dependentIds}
            approval={detail.recordHeld.approval}
          />
        </Section>
      ) : null}
    </div>
  );
}
