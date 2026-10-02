"use client";

/**
 * The navigation rail. 56px collapsed.
 *
 * Five primary items, three secondary behind a disclosure, and the product and
 * trust items at the foot. The V2 rail listed nine items of equal weight,
 * which the brief identifies as part of the problem: a user scanning nine
 * equal icons has to decide which is the work and which is the product.
 *
 * Here `Home`, `My work`, `Decisions`, `Workbench` and `Meetings` are the
 * analyst's day. Mail, calendar and collaboration are real but secondary, so
 * they sit behind `More`. Trust, the control room and settings are product
 * surfaces and sit at the foot, visually separated.
 *
 * It takes counts as props and fetches nothing.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  IconCalendarMonth,
  IconChevronsLeft,
  IconChevronsRight,
  IconDots,
  IconGavel,
  IconHome,
  IconMail,
  IconMessages,
  IconSettings,
  IconShieldCheck,
  IconTopologyStar3,
  IconUsers,
  type Icon,
} from "@tabler/icons-react";
import type { Language } from "@/i18n/labels";
import { useWorkdayChrome } from "./ChromeContext";

export interface NavigationCounts {
  myWork: number;
  decisions: number;
  mail: number;
}

const LABELS = {
  home: { en: "Home", de: "Start" },
  decisions: { en: "Decisions", de: "Entscheidungen" },
  workbench: { en: "Workbench", de: "Arbeitsbereich" },
  meetings: { en: "Meetings", de: "Sitzungen" },
  more: { en: "More", de: "Mehr" },
  mail: { en: "Mail", de: "Post" },
  calendar: { en: "Calendar", de: "Kalender" },
  collaboration: { en: "Collaboration", de: "Zusammenarbeit" },
  trust: { en: "Trust", de: "Vertrauen" },
  settings: { en: "Settings", de: "Einstellungen" },
  collapse: { en: "Collapse", de: "Einklappen" },
  expand: { en: "Expand", de: "Ausklappen" },
} as const;

type LabelKey = keyof typeof LABELS;

/*
 * Four primary items, and every one of them resolves.
 *
 * There were five, and the second was `My work` pointing at
 * `/workday/<role>/my-work`, which does not exist and never did. It carried a
 * live count badge, so the most prominent unvisited item in the rail was a
 * link to a 404, on all six roles. The queue it implied is the role home,
 * which is the item directly above it.
 *
 * Five was the number in the brief and four is what the routes support. A
 * fifth primary item will be correct when there is a fifth route for it to
 * point at; a rail that lies about where it can take you is worse than a
 * short rail.
 */
const PRIMARY: Array<{
  key: LabelKey;
  icon: Icon;
  segment: string;
  count?: (counts: NavigationCounts) => number;
}> = [
  { key: "home", icon: IconHome, segment: "", count: (c) => c.myWork },
  { key: "decisions", icon: IconGavel, segment: "/decisions", count: (c) => c.decisions },
  { key: "workbench", icon: IconTopologyStar3, segment: "/workbench" },
  { key: "meetings", icon: IconUsers, segment: "/meetings" },
];

const SECONDARY: Array<{ key: LabelKey; icon: Icon; segment: string; count?: (c: NavigationCounts) => number }> = [
  { key: "mail", icon: IconMail, segment: "/mail", count: (c) => c.mail },
  { key: "calendar", icon: IconCalendarMonth, segment: "/calendar" },
  { key: "collaboration", icon: IconMessages, segment: "/collaboration" },
];

export function WorkdayNavigation({
  roleId,
  language,
  counts,
}: {
  roleId: string;
  language: Language;
  counts: NavigationCounts;
}) {
  const chrome = useWorkdayChrome();
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const base = `/workday/${roleId}`;
  const label = (key: LabelKey) => (language === "de" ? LABELS[key].de : LABELS[key].en);

  const item = (
    entry: { key: LabelKey; icon: Icon; segment: string; count?: (c: NavigationCounts) => number },
  ) => {
    const href = `${base}${entry.segment}`;
    const active = entry.segment === "" ? pathname === base : pathname.startsWith(href);
    const count = entry.count ? entry.count(counts) : 0;
    const text = label(entry.key);
    const Glyph = entry.icon;

    return (
      <li key={entry.key}>
        <Link
          href={href}
          className="wd-nav-item"
          aria-current={active ? "page" : undefined}
          /*
           * The count is in the accessible name because the visible number
           * disappears when the rail is collapsed and the dot that replaces
           * it is decorative. Without this a screen reader user on a
           * collapsed rail would never learn three decisions are waiting.
           */
          aria-label={count > 0 ? `${text}, ${count}` : text}
          title={chrome.navExpanded ? undefined : text}
        >
          <span className="wd-nav-icon" aria-hidden="true">
            <Glyph size={20} stroke={1.7} />
          </span>
          <span className="wd-nav-label">{text}</span>
          {count > 0 ? (
            chrome.navExpanded ? (
              <span className="wd-nav-count" aria-hidden="true">
                {count}
              </span>
            ) : (
              <span className="wd-nav-dot" aria-hidden="true" />
            )
          ) : null}
        </Link>
      </li>
    );
  };

  return (
    <nav className="wd-nav" aria-label={language === "de" ? "Arbeitsbereiche" : "Work areas"}>
      <ul className="wd-nav-list">{PRIMARY.map(item)}</ul>

      <ul className="wd-nav-list">
        <li>
          <button
            type="button"
            className="wd-nav-item"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((open) => !open)}
            title={chrome.navExpanded ? undefined : label("more")}
            aria-label={label("more")}
          >
            <span className="wd-nav-icon" aria-hidden="true">
              <IconDots size={20} stroke={1.7} />
            </span>
            <span className="wd-nav-label">{label("more")}</span>
          </button>
        </li>
        {moreOpen ? SECONDARY.map(item) : null}
      </ul>

      <div className="wd-nav-spacer" />

      <ul className="wd-nav-list">
        <li>
          <Link
            href="/trust"
            className="wd-nav-item"
            title={chrome.navExpanded ? undefined : label("trust")}
          >
            <span className="wd-nav-icon" aria-hidden="true">
              <IconShieldCheck size={20} stroke={1.7} />
            </span>
            <span className="wd-nav-label">{label("trust")}</span>
          </Link>
        </li>
        <li>
          <Link
            href="/settings/organisation"
            className="wd-nav-item"
            title={chrome.navExpanded ? undefined : label("settings")}
          >
            <span className="wd-nav-icon" aria-hidden="true">
              <IconSettings size={20} stroke={1.7} />
            </span>
            <span className="wd-nav-label">{label("settings")}</span>
          </Link>
        </li>
        <li>
          <button
            type="button"
            className="wd-nav-item"
            aria-expanded={chrome.navExpanded}
            onClick={chrome.toggleNav}
            aria-label={chrome.navExpanded ? label("collapse") : label("expand")}
          >
            <span className="wd-nav-icon" aria-hidden="true">
              {chrome.navExpanded ? (
                <IconChevronsLeft size={18} stroke={1.7} />
              ) : (
                <IconChevronsRight size={18} stroke={1.7} />
              )}
            </span>
            <span className="wd-nav-label">{label("collapse")}</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
