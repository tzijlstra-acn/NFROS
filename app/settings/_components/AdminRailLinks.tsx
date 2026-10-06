"use client";

/**
 * The operations section of the administrator rail.
 *
 * Destinations that are not configuration areas and so are not in
 * `SETTINGS_AREAS`: the Product Owner Console (`/product`), the operations
 * console and the audit integrity page. The
 * audit integrity page existed and was reachable only by typing its address,
 * which for the one screen that says whether the audit trail is intact was
 * the wrong amount of friction.
 *
 * A client component for one reason, the same as `SettingsNav`: setting
 * `aria-current` needs the current path, and a server layout cannot read it.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconActivityHeartbeat, IconLayoutDashboard, IconShieldCheck } from "@tabler/icons-react";
import type { Language } from "@/i18n/labels";

const LINKS = [
  {
    href: "/product",
    label: { en: "Product owner console", de: "Product-Owner-Konsole" },
    Glyph: IconLayoutDashboard,
  },
  {
    href: "/ops",
    label: { en: "Operations console", de: "Betriebskonsole" },
    Glyph: IconActivityHeartbeat,
  },
  {
    href: "/settings/audit-integrity",
    label: { en: "Audit integrity", de: "Audit-Integritaet" },
    Glyph: IconShieldCheck,
  },
] as const;

export function AdminRailLinks({ language }: { language: Language }) {
  const pathname = usePathname();
  return (
    <ul className="app-rail-list">
      {LINKS.map(({ href, label, Glyph }) => {
        const current = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <li key={href}>
            <Link
              href={href}
              className="app-rail-item"
              {...(current ? { "aria-current": "page" as const } : {})}
            >
              <span className="app-rail-icon">
                <Glyph size={17} stroke={1.7} aria-hidden="true" />
              </span>
              <span className="app-rail-label">{language === "de" ? label.de : label.en}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
