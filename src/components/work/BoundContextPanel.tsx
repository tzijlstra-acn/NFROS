"use client";

/**
 * The context drawer's content for a bound work item.
 *
 * The drawer's four tabs (Evidence, Details, Activity, Audit) show the item
 * the Work Hub selected, read from the bound context. Each tab that has
 * nothing to show says what it would show, about this item, which is a
 * different sentence from "Nothing selected": the item is selected, it just
 * has no audit events yet.
 */

import Link from "next/link";
import type { Language } from "@/i18n/labels";
import { COPY, say } from "@/features/work/copy";
import type { BoundWorkContext } from "@/features/work/model";
import { ActivityList, AuditList, Chip, EvidenceList, Facts } from "./primitives";

export type BoundDrawerTab = "evidence" | "details" | "activity" | "audit";

export function BoundContextPanel({
  bound,
  tab,
  language,
}: {
  bound: BoundWorkContext;
  tab: BoundDrawerTab;
  language: Language;
}) {
  const links = bound.related.filter((link) => link.href !== null);

  return (
    <div className="wd-stack-2" data-testid="bound-context" data-item-id={bound.itemId}>
      <div className="wd-bound-head">
        <span className="wd-work-detail-kicker">
          {bound.kindLabel}
          <span className="wd-oid">{bound.reference}</span>
          <Chip chip={bound.status} />
        </span>
        <h2 className="wd-bound-title">{bound.title}</h2>
        <Link className="wd-work-link wd-meta" href={bound.href}>
          {say(COPY.openInWork, language)}
        </Link>
      </div>

      {tab === "evidence" ? <EvidenceList evidence={bound.evidence} empty={say(COPY.noEvidence, language)} /> : null}

      {tab === "details" ? (
        <div className="wd-stack-3">
          <Facts facts={bound.facts} />
          {links.length > 0 ? (
            <ul className="wd-work-list">
              {links.map((link) => (
                <li key={`${link.kind}:${link.id}`}>
                  <span className="wd-work-list-main">
                    <Link className="wd-work-link" href={link.href ?? "#"}>
                      {link.label}
                    </Link>
                    {link.note ? <span className="wd-meta"> {link.note}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="wd-work-text">{say(COPY.noRelated, language)}</p>
          )}
          <p className="wd-work-callout" data-tone="ai">
            <span className="wd-strong">{say(COPY.aiContext, language)}: </span>
            {bound.ai.note}
          </p>
        </div>
      ) : null}

      {tab === "activity" ? <ActivityList entries={bound.activity} empty={say(COPY.noActivity, language)} /> : null}

      {tab === "audit" ? (
        <AuditList audit={bound.audit} empty={say(COPY.noAudit, language)} blockedLabel={say(COPY.refused, language)} />
      ) : null}
    </div>
  );
}
