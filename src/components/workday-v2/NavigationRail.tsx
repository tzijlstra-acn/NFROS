"use client";

/**
 * The left navigation rail.
 *
 * 58px collapsed, 208px expanded. The V1 rail was permanently 232px wide and
 * carried, below the navigation, the acting person, a background work reveal
 * and three buttons including a prominent Reset. At 1366 that left the centre
 * work object with less than half the viewport. Here the rail carries
 * navigation and nothing else, the person moved to the top bar where identity
 * belongs, and Reset moved into the demo menu where a destructive control
 * belongs.
 *
 * Navigation uses the Tabler icon set that the repository already depends on.
 * The V1 rail used single ASCII characters, hash, at, tilde, equals, bang,
 * star, plus, question mark and ampersand, which read as a developer tool
 * rather than as an application and carried no meaning a user could learn.
 */

import Link from "next/link";
import {
  IconCalendarMonth,
  IconChevronsLeft,
  IconChevronsRight,
  IconGavel,
  IconHome,
  IconMail,
  IconMessageChatbot,
  IconMessages,
  IconSettings,
  IconShieldCheck,
  IconSparkles,
  IconTopologyStar3,
  IconUsers,
  type Icon,
} from "@tabler/icons-react";
import type { RoleId } from "@/db/schema/core";
import { NAV_LABELS, t, type Language } from "@/i18n/labels";
import { useShell } from "./ShellContext";

export interface NavCounts {
  /** Open decisions for this role at the current moment. */
  decisions: number;
  /** Messages the role has not dealt with. */
  mail: number;
  /** Unread live events, which drive the dot on the Today item. */
  unread: number;
  /** Suggestions waiting for the user. */
  needsUser: number;
}

const NAV_ITEMS: Array<{
  key: string;
  icon: Icon;
  href: (role: RoleId) => string;
  count?: (counts: NavCounts) => number;
}> = [
  { key: "today", icon: IconHome, href: (r) => `/workday/${r}`, count: (c) => c.unread },
  { key: "collaboration", icon: IconMessages, href: (r) => `/workday/${r}/collaboration` },
  { key: "mail", icon: IconMail, href: (r) => `/workday/${r}/mail`, count: (c) => c.mail },
  { key: "calendar", icon: IconCalendarMonth, href: (r) => `/workday/${r}/calendar` },
  {
    key: "decisions",
    icon: IconGavel,
    href: (r) => `/workday/${r}/decisions`,
    count: (c) => c.decisions,
  },
  { key: "workbench", icon: IconTopologyStar3, href: (r) => `/workday/${r}/workbench` },
  { key: "meetings", icon: IconUsers, href: (r) => `/workday/${r}/meetings` },
  /*
   * The assistant route is listed.
   *
   * It was omitted on the argument that the partner is a presence rather than
   * a destination, which is right about the PARTNER and wrong about this
   * ROUTE. The route exists, it is one of the eight, it has its own page and
   * its own heading, and nothing anywhere in the shell linked to it: the rail
   * listed seven of eight and no palette command navigated there, so it was
   * reachable only by typing the URL.
   *
   * The dock remains the primary conversational surface. This is the larger
   * view of it, which is what the rail label says.
   */
  { key: "assistant", icon: IconMessageChatbot, href: (r) => `/workday/${r}/assistant` },
];

export function NavigationRail({
  roleId,
  language,
  activeNav,
  counts,
}: {
  roleId: RoleId;
  language: Language;
  activeNav: string;
  counts: NavCounts;
}) {
  const shell = useShell();
  const expanded = shell.railExpanded;

  return (
    <nav className="app-rail" aria-label={language === "de" ? "Arbeitsbereiche" : "Work areas"}>
      <ul className="app-rail-list">
        {NAV_ITEMS.map((item) => {
          const active = item.key === activeNav;
          const count = item.count ? item.count(counts) : 0;
          const label = t(NAV_LABELS, item.key, language);
          const Glyph = item.icon;

          return (
            <li key={item.key}>
              <Link
                href={item.href(roleId)}
                className="app-rail-item"
                aria-current={active ? "page" : undefined}
                /*
                 * The accessible name carries the count, because the visible
                 * badge disappears when the rail is collapsed and the dot
                 * that replaces it is decorative. Without this a screen
                 * reader user on a collapsed rail would never learn that
                 * three decisions are waiting.
                 */
                aria-label={count > 0 ? `${label}, ${count}` : label}
                title={expanded ? undefined : label}
              >
                <span className="app-rail-icon" aria-hidden="true">
                  <Glyph size={18} stroke={1.7} />
                </span>
                <span className="app-rail-label">{label}</span>
                {count > 0 ? (
                  expanded ? (
                    <span className="app-chip app-chip-count app-rail-badge" aria-hidden="true">
                      {count}
                    </span>
                  ) : (
                    <span className="app-rail-dot" aria-hidden="true" />
                  )
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="app-rail-spacer" />

      <ul className="app-rail-list">
        {/*
          * The AI Partner item toggles the dock rather than navigating.
          *
          * The brief lists it in the rail, and a user reasonably looks there
          * for it, but routing to a separate page is exactly the mistake the
          * redesign corrects: the partner is a presence, not a destination.
          * The deeper assistant conversation is still reachable from inside
          * the dock for anyone who wants a full page view of it.
          */}
        <li>
          <button
            type="button"
            className="app-rail-item"
            style={{ cursor: "pointer" }}
            aria-pressed={shell.partnerOpen}
            aria-label={
              language === "de"
                ? shell.partnerOpen
                  ? "KI Partner schliessen"
                  : "KI Partner oeffnen"
                : shell.partnerOpen
                  ? "Close the AI Partner"
                  : "Open the AI Partner"
            }
            title={expanded ? undefined : language === "de" ? "KI Partner" : "AI Partner"}
            onClick={shell.togglePartner}
          >
            <span className="app-rail-icon" aria-hidden="true">
              <IconSparkles size={18} stroke={1.7} />
            </span>
            <span className="app-rail-label">{language === "de" ? "KI Partner" : "AI Partner"}</span>
            {counts.needsUser > 0 ? (
              expanded ? (
                <span
                  className="app-chip app-chip-count app-rail-badge"
                  data-tone="warning"
                  aria-hidden="true"
                >
                  {counts.needsUser}
                </span>
              ) : (
                <span className="app-rail-dot" aria-hidden="true" />
              )
            ) : null}
          </button>
        </li>

        <li>
          <Link
            href="/trust"
            className="app-rail-item"
            aria-current={activeNav === "trustAndAudit" ? "page" : undefined}
            title={expanded ? undefined : t(NAV_LABELS, "trustAndAudit", language)}
          >
            <span className="app-rail-icon" aria-hidden="true">
              <IconShieldCheck size={18} stroke={1.7} />
            </span>
            <span className="app-rail-label">{t(NAV_LABELS, "trustAndAudit", language)}</span>
          </Link>
        </li>

        <li>
          <Link
            href="/settings/organisation"
            className="app-rail-item"
            aria-current={activeNav === "settings" ? "page" : undefined}
            title={expanded ? undefined : language === "de" ? "Verwaltung" : "Administration"}
          >
            <span className="app-rail-icon" aria-hidden="true">
              <IconSettings size={18} stroke={1.7} />
            </span>
            <span className="app-rail-label">
              {language === "de" ? "Verwaltung" : "Administration"}
            </span>
          </Link>
        </li>

        <li>
          <button
            type="button"
            className="app-rail-item"
            style={{ cursor: "pointer" }}
            aria-expanded={expanded}
            aria-label={
              language === "de"
                ? expanded
                  ? "Navigation einklappen"
                  : "Navigation ausklappen"
                : expanded
                  ? "Collapse the navigation"
                  : "Expand the navigation"
            }
            onClick={shell.toggleRail}
          >
            <span className="app-rail-icon" aria-hidden="true">
              {expanded ? (
                <IconChevronsLeft size={17} stroke={1.7} />
              ) : (
                <IconChevronsRight size={17} stroke={1.7} />
              )}
            </span>
            <span className="app-rail-label">{language === "de" ? "Einklappen" : "Collapse"}</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
