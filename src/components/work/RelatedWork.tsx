"use client";

/**
 * RelatedWork: the selected item's links to the rest of the work.
 *
 * A client component for one reason: evidence and audit open the context
 * drawer rather than navigating, which needs the chrome context. Every other
 * link is an ordinary link to a product route. Only links that exist are
 * passed in, so there is no "none" row to render.
 */

import Link from "next/link";
import type { RelatedLink } from "@/features/work/model";
import { useWorkdayChrome } from "@/components/workday-v3/ChromeContext";

const KIND_ORDER: Record<RelatedLink["kind"], number> = {
  process: 0,
  decision: 1,
  meeting: 2,
  action: 3,
  message: 4,
  object: 5,
  evidence: 6,
  audit: 7,
};

export function RelatedWork({ links, empty }: { links: readonly RelatedLink[]; empty: string }) {
  const chrome = useWorkdayChrome();
  if (links.length === 0) return <p className="wd-work-text">{empty}</p>;
  const sorted = [...links].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);

  return (
    <ul className="wd-work-list" data-testid="related-work">
      {sorted.map((link) => (
        <li key={`${link.kind}:${link.id}`} data-related-kind={link.kind}>
          <span className="wd-work-list-main">
            {link.drawerTab ? (
              <button
                type="button"
                className="wd-work-link"
                onClick={(event) => chrome.openDrawer(link.drawerTab ?? "evidence", event.currentTarget)}
              >
                {link.label}
              </button>
            ) : link.href ? (
              <Link className="wd-work-link" href={link.href}>
                {link.label}
              </Link>
            ) : (
              <span>{link.label}</span>
            )}
          </span>
          {link.note ? <span className="wd-meta">{link.note}</span> : null}
        </li>
      ))}
    </ul>
  );
}
