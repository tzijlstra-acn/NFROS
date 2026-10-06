/**
 * The Meetings module's detail body.
 *
 * A meeting opens on its lifecycle (`MeetingLifecycle`): before, during and
 * after the meeting, with the phase the scenario clock is in selected. The
 * process the meeting serves, its pack and questions, the conversation and
 * its capture, and the minutes from draft to confirmed record all live
 * there. A minutes record whose meeting is not in the role's list keeps the
 * plain record view, because there is no meeting to run a lifecycle for.
 * Every value is a field of the meeting, the minutes or a row they name.
 */

import Link from "next/link";
import type { Language } from "@/i18n/labels";
import { say } from "@/features/work/copy";
import type { MeetingDetail } from "@/features/work/modules/meetings/read-model";
import { MEETINGS_COPY } from "@/features/work/modules/meetings/copy";
import { AGENDA_COPY } from "@/features/work/modules/agenda/copy";
import { MeetingLifecycle } from "./MeetingLifecycle";
import { Chip, Facts, Section } from "./primitives";

export function MeetingDetailView({ detail, language }: { detail: MeetingDetail; language: Language }) {
  const t = (pair: { en: string; de: string }) => say(pair, language);

  return (
    <div className="wd-stack-2">
      <Facts facts={detail.facts} />

      {detail.agendaEntryHref ? (
        <p className="wd-meta">
          <Link className="wd-work-link" href={detail.agendaEntryHref}>
            {t({ en: "Open the agenda entry", de: "Agendaeintrag oeffnen" })}
          </Link>
        </p>
      ) : null}

      {detail.lifecycle ? <MeetingLifecycle view={detail.lifecycle} language={language} /> : null}

      {!detail.lifecycle && detail.process ? (
        <Section label={t(AGENDA_COPY.linkedProcess)}>
          <p className="wd-work-text">
            {detail.process.link.href ? (
              <Link className="wd-work-link" href={detail.process.link.href}>
                {detail.process.link.label}
              </Link>
            ) : (
              detail.process.link.label
            )}
            {detail.process.stage ? <span className="wd-meta"> {detail.process.stage}</span> : null}
          </p>
        </Section>
      ) : null}

      {!detail.lifecycle && detail.variant === "meeting" ? (
        <Section label={t(MEETINGS_COPY.preparation)}>
          {detail.pack.summary.trim().length > 0 ? (
            <p className="wd-work-text" data-testid="meeting-pack">
              {detail.pack.summary}
            </p>
          ) : (
            <p className="wd-work-text">{t(MEETINGS_COPY.noPreparation)}</p>
          )}
        </Section>
      ) : null}

      {!detail.lifecycle && detail.questions.length > 0 ? (
        <Section label={t(MEETINGS_COPY.questions)} count={detail.questions.length}>
          <p className="wd-meta">{t(MEETINGS_COPY.questionsNote)}</p>
          <ol className="wd-work-bullets">
            {detail.questions.map((question, index) => (
              <li key={`q-${index}`}>{question}</li>
            ))}
          </ol>
        </Section>
      ) : null}

      {detail.outcome ? (
        <Section label={t(MEETINGS_COPY.outcome)}>
          <p className="wd-work-callout" data-tone="success">
            {detail.outcome}
          </p>
        </Section>
      ) : null}

      {!detail.lifecycle && detail.minutes ? (
        <Section label={detail.minutes.title}>
          <div className="wd-stack-2" data-testid="meeting-minutes">
            <Chip chip={detail.minutes.status} />
            {detail.minutes.facts.length > 0 ? (
              <>
                <span className="wd-strong" style={{ fontSize: "var(--wd-text-sm)" }}>
                  {t(MEETINGS_COPY.facts)}
                </span>
                <ul className="wd-work-bullets">
                  {detail.minutes.facts.map((fact, index) => (
                    <li key={`f-${index}`}>{fact}</li>
                  ))}
                </ul>
              </>
            ) : null}
            {detail.minutes.unresolved.length > 0 ? (
              <>
                <span className="wd-strong" style={{ fontSize: "var(--wd-text-sm)" }}>
                  {t(MEETINGS_COPY.unresolved)}
                </span>
                <ul className="wd-work-bullets">
                  {detail.minutes.unresolved.map((item, index) => (
                    <li key={`u-${index}`}>{item}</li>
                  ))}
                </ul>
              </>
            ) : null}
            {detail.variant === "minutes" ? <p className="wd-meta">{t(MEETINGS_COPY.minutesNoMeeting)}</p> : null}
          </div>
        </Section>
      ) : null}

      {detail.dependents.length > 0 ? (
        <Section label={t(AGENDA_COPY.dependsTitle)} count={detail.dependents.length}>
          <ul className="wd-work-list">
            {detail.dependents.map((action) => (
              <li key={action.id}>
                <span className="wd-mono">{action.due}</span>
                <span className="wd-work-list-main">
                  <Link className="wd-work-link" href={action.href}>
                    {action.title}
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
