"use client";

/**
 * The navigation rail. 56px collapsed.
 *
 * Three primary items covering the flagship analyst day: Home, Processes and
 * Decisions. The V3.2 brief reduces the rail to what flagship roles (rcsa,
 * tprm) actually use. Deprecated routes (workbench, meetings, mail, calendar,
 * collaboration, assistant) now redirect at the Next.js config level so the
 * rail never points at them.
 *
 * Trust and Settings are product surfaces, not analyst work, so they have
 * moved out of the primary rail. The collapse/expand control stays at the
 * foot where it was.
 *
 * It takes counts as props and fetches nothing.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconBriefcase,
  IconChevronsLeft,
  IconChevronsRight,
  IconGavel,
  IconHome,
  IconSitemap,
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
  work: { en: "Work", de: "Arbeit" },
  processes: { en: "Processes", de: "Prozesse" },
  decisions: { en: "Decisions", de: "Entscheidungen" },
  collapse: { en: "Collapse", de: "Einklappen" },
  expand: { en: "Expand", de: "Ausklappen" },
} as const;

type LabelKey = keyof typeof LABELS;

/*
 * Four primary items, and every one of them resolves.
 *
 * Home is the focus queue. Work is the personal work surface: agenda,
 * meetings, actions and inbox. Processes is the landing for role-specific
 * process work (RCSA cycle, third-party onboarding). Decisions is the
 * authority queue. All four have V3 implementations; the rail does not point
 * at anything that does not exist.
 */
const PRIMARY: Array<{
  key: LabelKey;
  icon: Icon;
  segment: string;
  count?: (counts: NavigationCounts) => number;
}> = [
  { key: "home", icon: IconHome, segment: "", count: (c) => c.myWork },
  { key: "work", icon: IconBriefcase, segment: "/work" },
  { key: "processes", icon: IconSitemap, segment: "/processes" },
  { key: "decisions", icon: IconGavel, segment: "/decisions", count: (c) => c.decisions },
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

      <div className="wd-nav-spacer" />

      <ul className="wd-nav-list">
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
