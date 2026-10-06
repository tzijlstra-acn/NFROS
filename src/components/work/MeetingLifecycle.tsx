/**
 * The meeting lifecycle in the detail pane: before, during and after.
 *
 * Server rendered. The before pane is read only and composed here: what the
 * meeting is for, who is in it, the process stage it serves, the decisions
 * waiting on it, the pack, the contradictions on record, the questions the
 * AI Partner prepared with the documents behind them, the work due before
 * it and the outcomes it should leave behind, under the label of the mode
 * that prepared them. The during and after panes are client islands, because
 * they capture and confirm.
 */

import Link from "next/link";
import type { Language } from "@/i18n/labels";
import { say } from "@/features/work/copy";
import type { MeetingLifecycleView } from "@/features/work/modules/meetings/lifecycle";
import { LIFECYCLE_COPY as L, MEETINGS_COPY } from "@/features/work/modules/meetings/copy";
import { MeetingPhases } from "./MeetingPhases";
import { MeetingTranscript } from "./MeetingTranscript";
import { MinutesPanel } from "./MinutesPanel";
import { Chip, Section } from "./primitives";

function Cited({ ids }: { ids: readonly string[] }) {
  if (ids.length === 0) return null;
  return (
    <span className="wd-meet-cites">
      {ids.map((id) => (
        <span key={id} className="wd-oid">
          {id}
        </span>
      ))}
    </span>
  );
}

function Before({ view, language }: { view: MeetingLifecycleView; language: Language }) {
  const t = (pair: { en: string; de: string }) => say(pair, language);
  const before = view.before;
  return (
    <div className="wd-stack-1" data-testid="meeting-before">
      <div className="wd-meet-head" data-testid="preparation-mode">
        <Chip chip={{ label: before.preparation.label, tone: before.preparation.tone }} />
        <span>{before.preparation.note}</span>
      </div>

      <Section label={t(L.purpose)}>
        <p className="wd-work-text">{before.purpose}</p>
      </Section>

      <Section label={t(L.participants)} count={before.participants.length}>
        <ul className="wd-work-list">
          {before.participants.map((person) => (
            <li key={person.id}>
              <span className="wd-work-list-main">{person.name}</span>
              <span className="wd-meta">{person.detail}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section label={t(L.stage)}>
        {before.stage ? (
          <div className="wd-stack-1" data-testid="meeting-stage">
            <p className="wd-work-text">
              {before.stage.href ? (
                <Link className="wd-work-link" href={before.stage.href}>
                  {before.stage.label}
                </Link>
              ) : (
                before.stage.label
              )}{" "}
              <Chip chip={{ label: before.stage.state, tone: before.stage.tone }} />
            </p>
            <p className="wd-meta">{before.stage.note}</p>
          </div>
        ) : (
          <p className="wd-work-text" data-testid="meeting-stage-none">
            {before.noStage}
          </p>
        )}
      </Section>

      <Section label={t(L.openDecisions)} count={before.openDecisions.length}>
        {before.openDecisions.length > 0 ? (
          <ul className="wd-work-list">
            {before.openDecisions.map((decision) => (
              <li key={decision.id}>
                <span className="wd-oid">{decision.id}</span>
                <span className="wd-work-list-main">
                  <Link className="wd-work-link" href={decision.href}>
                    {decision.title}
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="wd-work-text">{t(L.noDecisions)}</p>
        )}
      </Section>

      {before.expectedOutcomes.length > 0 ? (
        <Section label={t(L.expected)} count={before.expectedOutcomes.length}>
          <ul className="wd-work-bullets" data-testid="expected-outcomes">
            {before.expectedOutcomes.map((outcome) => (
              <li key={outcome}>{outcome}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section label={t(L.pack)} count={before.pack.total}>
        {before.pack.summary.trim().length > 0 ? (
          <p className="wd-work-text" data-testid="meeting-pack">
            {before.pack.summary}
          </p>
        ) : (
          <p className="wd-work-text">{t(MEETINGS_COPY.noPreparation)}</p>
        )}
        {before.watch.length > 0 ? (
          <ul className="wd-work-bullets" aria-label={t(L.watch)}>
            {before.watch.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
      </Section>

      <Section label={t(L.contradictions)} count={before.contradictions.length}>
        {before.contradictions.length > 0 ? (
          <ul className="wd-meet-items" data-testid="meeting-contradictions">
            {before.contradictions.map((item) => (
              <li key={item.id}>
                <span>{item.text}</span>
                <span className="wd-meet-item-meta">
                  {item.evidence.map((doc) => (
                    <span key={doc.id} className="wd-oid" title={doc.title}>
                      {doc.id}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="wd-work-text">{t(L.noContradictions)}</p>
        )}
      </Section>

      {before.questions.length > 0 ? (
        <Section label={t(L.questions)} count={before.questions.length}>
          <p className="wd-meta">{t(MEETINGS_COPY.questionsNote)}</p>
          <ol className="wd-work-bullets" data-testid="meeting-questions">
            {before.questions.map((question, index) => (
              <li key={`q-${index}`}>
                {question.text}
                <Cited ids={question.evidence.map((doc) => doc.id)} />
              </li>
            ))}
          </ol>
        </Section>
      ) : null}

      <Section label={t(L.dueBefore)} count={before.dueBefore.length}>
        {before.dueBefore.length > 0 ? (
          <ul className="wd-work-list" data-testid="due-before">
            {before.dueBefore.map((action) => (
              <li key={action.id}>
                <span className="wd-chip" data-tone={action.tone}>
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
        ) : (
          <p className="wd-work-text">{t(L.noDueBefore)}</p>
        )}
      </Section>
    </div>
  );
}

export function MeetingLifecycle({ view, language }: { view: MeetingLifecycleView; language: Language }) {
  return (
    <Section label={say(L.lifecycleLabel, language)}>
      <p className="wd-meta" data-testid="meeting-clock">
        {view.clockNote}
      </p>
      <MeetingPhases
        label={say(L.lifecycleLabel, language)}
        current={view.phase}
        phases={view.phases}
        panes={{
          before: <Before view={view} language={language} />,
          during: <MeetingTranscript roleId={view.roleId} meetingId={view.meetingId} language={language} during={view.during} />,
          after: <MinutesPanel roleId={view.roleId} meetingId={view.meetingId} language={language} after={view.after} />,
        }}
      />
    </Section>
  );
}
