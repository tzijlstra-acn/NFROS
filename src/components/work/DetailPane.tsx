/**
 * The right pane: the selected item.
 *
 * The order is the plan's action-first order. The module's own block comes
 * first, because that is where the next action is (an action's operations, an
 * agenda entry's next step). Then the item's context, the related work, the
 * evidence, the history and the audit, and a quiet footer saying where the
 * data came from and what the AI Partner is reading.
 *
 * At narrow widths the same pane is a drawer over the queue (see
 * `workday-v3-work.css`), with a close control that appears only there.
 */

import Link from "next/link";
import type { Language } from "@/i18n/labels";
import { COPY, fill, say } from "@/features/work/copy";
import type { WorkHubView } from "@/features/work/hub";
import { ClearSelection } from "./ClearSelection";
import { ModuleDetail } from "./ModuleDetail";
import { RelatedWork } from "./RelatedWork";
import { SourceFreshness } from "./SourceFreshness";
import { ActivityList, AuditList, Chip, EvidenceList, Section } from "./primitives";

export function DetailPane({ view }: { view: WorkHubView }) {
  const { detail, language } = view;

  if (!detail) {
    return (
      <aside className="wd-work-detail" data-has-item="false" aria-label={say(COPY.detailLabel, language)}>
        <div className="wd-empty" data-testid="detail-empty">
          <span className="wd-empty-title">{say(COPY.nothingSelectedTitle, language)}</span>
          <span>{say(COPY.nothingSelectedBody, language)}</span>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className="wd-work-detail"
      data-has-item="true"
      aria-label={say(COPY.detailLabel, language)}
      data-testid="work-detail"
      data-item-id={detail.id}
      data-item-kind={detail.kind}
    >
      <header className="wd-work-detail-head">
        <div className="wd-work-detail-kicker">
          <span>{detail.kindLabel}</span>
          <span className="wd-oid">{detail.reference}</span>
          <Chip chip={detail.status} />
          <span className="wd-grow" />
          <ClearSelection href={view.closeHref} label={say(COPY.clearSelection, language)} />
          <ClearSelection href={view.closeHref} label={say(COPY.close, language)} compact />
        </div>
        <h2 className="wd-work-detail-title">{detail.title}</h2>
        {view.selectedElsewhere ? (
          <p className="wd-work-elsewhere" data-testid="selected-elsewhere">
            {fill(say(COPY.selectedElsewhere, language), { tab: view.selectedElsewhere.tabLabel })}
            <Link className="wd-work-link" href={view.selectedElsewhere.href}>
              {fill(say(COPY.openInTab, language), { tab: view.selectedElsewhere.tabLabel })}
            </Link>
          </p>
        ) : null}
      </header>

      <ModuleDetail detail={detail} view={view} />

      {detail.context.trim().length > 0 ? (
        <Section label={say(COPY.context, language)}>
          <p className="wd-work-text">{detail.context}</p>
        </Section>
      ) : null}

      <Section label={say(COPY.relatedWork, language)} count={detail.related.length}>
        <RelatedWork links={detail.related} empty={say(COPY.noRelated, language)} />
      </Section>

      <Section label={say(COPY.evidence, language)} count={detail.evidence.length}>
        <EvidenceList evidence={detail.evidence} empty={say(COPY.noEvidence, language)} />
      </Section>

      {detail.kind !== "action" ? (
        <Section label={say(COPY.activity, language)} count={detail.activity.length}>
          <ActivityList entries={detail.activity} empty={say(COPY.noActivity, language)} />
        </Section>
      ) : null}

      <Section label={say(COPY.audit, language)} count={detail.audit.length}>
        <AuditList audit={detail.audit} empty={say(COPY.noAudit, language)} blockedLabel={say(COPY.refused, language)} />
      </Section>

      <DetailFooter view={view} language={language} />
    </aside>
  );
}

function DetailFooter({ view, language }: { view: WorkHubView; language: Language }) {
  const detail = view.detail;
  if (!detail) return null;
  return (
    <footer className="wd-work-foot">
      {detail.freshness ? <SourceFreshness freshness={detail.freshness} /> : null}
      <span data-testid="ai-context-note">
        <span className="wd-strong">{say(COPY.aiContext, language)}: </span>
        {detail.ai.note}
      </span>
    </footer>
  );
}
