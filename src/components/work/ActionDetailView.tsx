/**
 * The Actions module's detail body.
 *
 * Action first: the completion condition and the operations lead, then who
 * owns it and by when, where it came from, the blocker and the latest
 * follow-up, the AI checks, and the append-only history. Role copy arrives
 * through the detail model; nothing here names a role's vocabulary.
 */

import Link from "next/link";
import type { Language } from "@/i18n/labels";
import { COPY, fill, say } from "@/features/work/copy";
import type { ActionDetail } from "@/features/work/modules/actions/read-model";
import { ACTIONS_COPY } from "@/features/work/modules/actions/copy";
import { ActionOperations } from "./ActionOperations";
import { ActivityList, Facts, Section } from "./primitives";

export function ActionDetailView({
  detail,
  roleId,
  language,
  scenarioDate,
}: {
  detail: ActionDetail;
  roleId: string;
  language: Language;
  scenarioDate: string;
}) {
  const t = (pair: { en: string; de: string }) => say(pair, language);
  const sources = [detail.sources.decision, detail.sources.meeting, detail.sources.message, detail.sources.process].filter(
    (link): link is NonNullable<typeof link> => link !== null,
  );

  return (
    <div className="wd-stack-2">
      <ActionOperations
        roleId={roleId}
        actionId={detail.id}
        language={language}
        operations={detail.operations}
        assignable={detail.assignable}
        evidenceChoices={detail.evidenceChoices}
        suggestedDate={detail.suggestedDate}
        minDate={scenarioDate}
        agreedCondition={detail.completion.agreed}
        agreedNote={detail.completion.agreedNote}
        proposedCondition={detail.completion.proposal}
        conditionOpen={detail.state.open}
        material={detail.materiality.material}
        blocked={detail.state.blocked}
        reminderRecipient={detail.reminderRecipient}
        escalationLabel={detail.escalationLabel}
        requestEvidenceHint={detail.requestEvidenceHint}
      />

      <p className="wd-meta" data-testid="materiality">
        {detail.materiality.material
          ? fill(t(ACTIONS_COPY.materialBecause), { reasons: detail.materiality.reasons.join(", ") })
          : t(ACTIONS_COPY.notMaterial)}{" "}
        {detail.evidenceRequired ? t(ACTIONS_COPY.evidenceRequired) : t(ACTIONS_COPY.evidenceNotRequired)}
      </p>

      <Section label={t(ACTIONS_COPY.owner)}>
        {detail.owner.unowned ? (
          <p className="wd-work-callout" data-tone="danger" style={{ marginBottom: "var(--wd-2)" }}>
            {t(ACTIONS_COPY.noOwner)}
          </p>
        ) : null}
        <Facts facts={detail.facts} />
      </Section>

      <Section label={t(ACTIONS_COPY.sources)}>
        {sources.length > 0 ? (
          <ul className="wd-work-list">
            {sources.map((link) => (
              <li key={`${link.kind}:${link.id}`}>
                <span className="wd-meta">{link.note}</span>
                <span className="wd-work-list-main">
                  {link.href ? (
                    <Link className="wd-work-link" href={link.href}>
                      {link.label}
                    </Link>
                  ) : (
                    link.label
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="wd-work-text">{t(ACTIONS_COPY.sourceNoneRecorded)}</p>
        )}
        {detail.sources.process && detail.sources.processNote ? (
          <p className="wd-meta">
            {t(ACTIONS_COPY.sourceProcess)}: {detail.sources.processNote}
          </p>
        ) : null}
      </Section>

      <Section label={t(ACTIONS_COPY.blocker)}>
        {detail.blocker ? (
          <p className="wd-work-callout" data-tone="warning" data-testid="blocker">
            {detail.blocker}
          </p>
        ) : (
          <p className="wd-work-text">{t(ACTIONS_COPY.noBlocker)}</p>
        )}
      </Section>

      <Section label={t(ACTIONS_COPY.latestFollowUp)}>
        {detail.latestFollowUp ? (
          <div className="wd-work-callout" data-testid="latest-follow-up">
            <span className="wd-strong">{detail.latestFollowUp.subject}</span>
            <span className="wd-meta">
              {" "}
              {detail.latestFollowUp.at}, {detail.latestFollowUp.recipients}. {t(ACTIONS_COPY.simulatedSent)}
            </span>
          </div>
        ) : (
          <p className="wd-work-text">{t(ACTIONS_COPY.noFollowUp)}</p>
        )}
      </Section>

      <Section label={t(ACTIONS_COPY.aiChecks)}>
        <div className="wd-stack-2" data-testid="ai-checks">
          <p className="wd-meta">{t(ACTIONS_COPY.aiChecksNote)}</p>
          <div>
            <span className="wd-strong" style={{ fontSize: "var(--wd-text-sm)" }}>
              {t(ACTIONS_COPY.vagueWording)}
            </span>
            {detail.checks.vague.length > 0 ? (
              <ul className="wd-work-bullets" data-testid="vague-wording">
                {detail.checks.vague.map((finding) => (
                  <li key={finding.term}>
                    &quot;{finding.term}&quot; {finding.why}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="wd-work-text">{t(ACTIONS_COPY.noVagueWording)}</p>
            )}
          </div>
          <div>
            <span className="wd-strong" style={{ fontSize: "var(--wd-text-sm)" }}>
              {t(ACTIONS_COPY.duplicates)}
            </span>
            {detail.checks.duplicates.length > 0 ? (
              <ul className="wd-work-bullets" data-testid="duplicates">
                {detail.checks.duplicates.map((candidate) => (
                  <li key={candidate.id}>
                    <Link className="wd-work-link" href={candidate.href}>
                      {candidate.id}
                    </Link>{" "}
                    {candidate.title} <span className="wd-meta">({candidate.reasonLabel})</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="wd-work-text">{t(ACTIONS_COPY.noDuplicates)}</p>
            )}
          </div>
        </div>
      </Section>

      <Section label={t(ACTIONS_COPY.history)} count={detail.activity.length}>
        <p className="wd-meta">{t(ACTIONS_COPY.historyNote)}</p>
        <ActivityList entries={detail.activity} empty={t(COPY.noActivity)} />
      </Section>
    </div>
  );
}
