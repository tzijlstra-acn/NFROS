/**
 * WorkTabs: the four tabs, each a link that keeps the selection.
 *
 * Links rather than client state, so a tab is an address and switching tabs
 * renders the next tab on the server with the same `item` in the query. The
 * count on each tab is the module's own count of the rows that tab shows.
 */

import Link from "next/link";
import type { WorkTabView } from "@/features/work/hub";

export function WorkTabs({ tabs, label }: { tabs: readonly WorkTabView[]; label: string }) {
  return (
    <nav className="wd-work-tabs" aria-label={label}>
      {tabs.map((tab) => (
        <Link
          key={tab.tab}
          href={tab.href}
          className="wd-work-tab"
          aria-current={tab.active ? "page" : undefined}
          data-tab={tab.tab}
        >
          {tab.label}
          <span className="wd-work-count">{tab.count}</span>
        </Link>
      ))}
    </nav>
  );
}
