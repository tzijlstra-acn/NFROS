"use client";

/**
 * The Product Owner Console rail.
 *
 * The nine primary sections of plan 7, the feedback inbox, and the deep links
 * into the existing administrator pages. A client component for the one
 * reason `SettingsNav` is: `aria-current` needs the current path, and a server
 * layout cannot read it. The lists themselves come from `nav.ts` as props, so
 * a plain array is never imported across the boundary as a client reference.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconActivityHeartbeat,
  IconChartBar,
  IconFlag,
  IconLayoutDashboard,
  IconLayoutGrid,
  IconMessage2,
  IconPlugConnected,
  IconRocket,
  IconScale,
  IconServer2,
  IconSettings,
  IconShieldCheck,
  IconSparkles,
} from "@tabler/icons-react";
import type { Language } from "@/i18n/labels";
import { isSectionCurrent, type ConsoleSectionIcon } from "./nav";

const ICONS: Record<ConsoleSectionIcon, typeof IconLayoutDashboard> = {
  overview: IconLayoutDashboard,
  "role-apps": IconLayoutGrid,
  experience: IconChartBar,
  quality: IconSparkles,
  value: IconScale,
  integrations: IconPlugConnected,
  releases: IconRocket,
  pilot: IconFlag,
  operations: IconActivityHeartbeat,
  feedback: IconMessage2,
  settings: IconSettings,
  audit: IconShieldCheck,
  ops: IconServer2,
};

export interface ConsoleNavEntry {
  href: string;
  label: { en: string; de: string };
  icon: ConsoleSectionIcon;
}

/* The faint rail label token is below AA contrast on the light canvas. */
const sectionLabelStyle = { color: "var(--app-text-muted)" } as const;

export function ConsoleNav({
  language,
  primary,
  secondary,
  deepLinks,
  labels,
}: {
  language: Language;
  primary: readonly ConsoleNavEntry[];
  secondary: readonly ConsoleNavEntry[];
  deepLinks: readonly ConsoleNavEntry[];
  labels: { console: string; discovery: string; deepLinks: string };
}) {
  const pathname = usePathname();
  const say = (pair: { en: string; de: string }) => (language === "de" ? pair.de : pair.en);

  const list = (entries: readonly ConsoleNavEntry[], testId: string) => (
    <ul className="app-rail-list" data-testid={testId}>
      {entries.map((entry) => {
        const Glyph = ICONS[entry.icon];
        const current = isSectionCurrent(entry, pathname);
        return (
          <li key={entry.href}>
            <Link
              href={entry.href}
              className="app-rail-item"
              {...(current ? { "aria-current": "page" as const } : {})}
            >
              <span className="app-rail-icon">
                <Glyph size={17} stroke={1.7} aria-hidden="true" />
              </span>
              <span className="app-rail-label">{say(entry.label)}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      <span className="app-rail-section-label" style={sectionLabelStyle}>
        {labels.console}
      </span>
      {list(primary, "console-nav-primary")}
      <span className="app-rail-section-label" style={sectionLabelStyle}>
        {labels.discovery}
      </span>
      {list(secondary, "console-nav-secondary")}
      <span className="app-rail-section-label" style={sectionLabelStyle}>
        {labels.deepLinks}
      </span>
      {list(deepLinks, "console-nav-deep-links")}
    </>
  );
}
