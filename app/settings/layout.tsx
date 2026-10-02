/**
 * The administrator shell.
 *
 * Not the workday shell, and deliberately so. The working interface is three
 * columns with a live day track along the bottom, because a practitioner is
 * handling events as they arrive. An administrator is reading a configuration
 * that changes once a quarter, so this is a top bar, a list of areas and a
 * content column, and nothing moves.
 *
 * It is scoped under `.workday-v2` to inherit the application typography,
 * graphite palette and focus treatment, with the row template overridden
 * because the workday scope declares three rows and this shell has two. That
 * override is an inline style rather than a new class: the V2 stylesheet is
 * shared and adding a settings variant to it would put a layout nobody else
 * uses into the file every other surface loads.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { IconArrowLeft, IconSettings } from "@tabler/icons-react";
import { SETTINGS_AREAS, getProductConfig } from "@/product";
import { SettingsNav } from "@/components/settings/primitives";
import { SyntheticDisclosure } from "@/components/workday-v2/primitives";
import type { Language } from "@/i18n/labels";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Administrator settings: NFR WorkOS",
  robots: { index: false, follow: false },
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const config = getProductConfig();
  const identity = config.identity;
  /*
   * The administrator area is English. The organisation profile carries a
   * default locale and the workday honours the scenario language, but a
   * settings area translated only in part is worse than one that is clearly
   * in a single language, so the German strings in these screens exist for the
   * terminology comparison and the labels, not for the chrome.
   */
  const language: Language = "en";

  return (
    <div
      className="workday-v2"
      style={{ gridTemplateRows: "var(--app-topbar-h) minmax(0, 1fr)" }}
    >
      <header className="app-topbar">
        <Link href="/settings" className="app-brand">
          {identity.marks.length > 0 ? (
            <span className={identity.showPair ? "app-brand-pair" : undefined}>
              {identity.marks.map((mark) => (
                /*
                 * A plain img, not next/image. These are small static SVG
                 * marks in `public/`, so there is nothing to optimise, and the
                 * image component would add a loader indirection to an asset
                 * that is already a few hundred bytes.
                 */
                <img
                  key={mark.src}
                  src={mark.src}
                  alt={mark.alt}
                  className="app-brand-logo"
                  width={20}
                  height={20}
                />
              ))}
            </span>
          ) : (
            <span className="app-brand-mark" aria-hidden="true">
              <IconSettings size={14} stroke={2} />
            </span>
          )}
          <span className="app-brand-name">{identity.productName}</span>
        </Link>

        <div className="app-context">
          <span className="app-context-sep" aria-hidden="true">
            /
          </span>
          <span className="app-strong" style={{ fontSize: "var(--app-text-sm)" }}>
            Administrator settings
          </span>
          <span className="app-context-sep" aria-hidden="true">
            /
          </span>
          <span className="app-meta app-truncate">
            Product configuration for {identity.clientName}
          </span>
        </div>

        <div className="app-topbar-right">
          <SyntheticDisclosure language={language} />
          <Link href="/workday" className="app-btn app-btn-quiet app-btn-sm">
            <IconArrowLeft size={14} stroke={1.8} aria-hidden="true" />
            Back to the workday
          </Link>
        </div>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "var(--app-rail-w-expanded) minmax(0, 1fr)",
          minHeight: 0,
        }}
      >
        <nav className="app-rail" aria-label="Settings areas">
          <span className="app-rail-section-label">Configuration</span>
          <SettingsNav areas={SETTINGS_AREAS} language={language} />
        </nav>

        <main id="main" className="app-main">
          <div className="app-main-inner">{children}</div>
        </main>
      </div>
    </div>
  );
}
