/**
 * The administrator frame, shared by the settings area and the operations
 * console.
 *
 * Not the workday shell, and deliberately so. The working interface is built
 * for a practitioner handling events as they arrive. An administrator is
 * reading a configuration that changes once a quarter, so this is a top bar, a
 * list of areas and a content column, and nothing moves.
 *
 * Two scopes on one root. `.workday-v2` supplies the frame (fixed to the
 * viewport, rows, inner scroller) and the `app-` component styles every
 * settings screen is written in. `.workday-v3` is declared after it and remaps
 * every `--app-` token onto the V3.3 light palette, which is the same bridge
 * the workday uses to host V2 components. So the administrator area now reads
 * as the same product as the workday rather than as a dark technical annex,
 * and the status badge, which is a V3.3 `wd-chip`, resolves its tokens here.
 *
 * The operations console used to render without this frame, inside a bare
 * `.workday-v2` root whose three grid rows laid its sections over each other.
 * Sharing the frame is what fixes that.
 *
 * Server component. The two navigation lists are client components because
 * they need the current path for `aria-current`.
 */

import type { ReactNode } from "react";
import Link from "next/link";
import { IconArrowLeft, IconSettings } from "@tabler/icons-react";
import { SETTINGS_AREAS, getProductConfig } from "@/product";
import { PRODUCT_RELEASE, RELEASE_STAGE_LABELS } from "@/product/release";
import { SettingsNav } from "@/components/settings/primitives";
import { Data, SyntheticDisclosure } from "@/components/workday-v2/primitives";
import type { Language } from "@/i18n/labels";
import { AdminRailLinks } from "./AdminRailLinks";

const COPY = {
  settings: { en: "Administrator settings", de: "Administration" },
  operations: { en: "Operations console", de: "Betriebskonsole" },
  product: { en: "Product owner console", de: "Product-Owner-Konsole" },
  configurationFor: { en: "Product configuration for", de: "Produktkonfiguration fuer" },
  back: { en: "Back to the workday", de: "Zurueck zum Arbeitstag" },
  areas: { en: "Administrator areas", de: "Administrationsbereiche" },
  configuration: { en: "Configuration", de: "Konfiguration" },
  operationsSection: { en: "Operations", de: "Betrieb" },
  release: { en: "Product release", de: "Produkt-Release" },
} as const;

function say(pair: { en: string; de: string }, language: Language): string {
  return language === "de" ? pair.de : pair.en;
}

/* The faint rail label token is below AA contrast on the light canvas. */
const sectionLabelStyle = { color: "var(--app-text-muted)" } as const;

export function AdminFrame({
  language,
  context,
  rail,
  children,
}: {
  language: Language;
  context: "settings" | "operations" | "product";
  /**
   * Replaces the configuration and operations lists in the rail. The Product
   * Owner Console passes its own navigation here; the release entry at the
   * foot of the rail stays, so every administrator screen still shows it.
   */
  rail?: ReactNode;
  children: ReactNode;
}) {
  const config = getProductConfig();
  const identity = config.identity;
  const contextLabel =
    context === "settings" ? COPY.settings : context === "operations" ? COPY.operations : COPY.product;

  return (
    <div
      className="workday-v2 workday-v3"
      lang={language}
      style={{ gridTemplateRows: "var(--app-topbar-h) minmax(0, 1fr)" }}
    >
      <header className="app-topbar">
        <Link href={context === "product" ? "/product" : "/settings"} className="app-brand">
          {identity.marks.length > 0 ? (
            <span className={identity.showPair ? "app-brand-pair" : undefined}>
              {identity.marks.map((mark) => (
                /*
                 * A plain img, not next/image. These are small static SVG
                 * marks in `public/`, so there is nothing to optimise.
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
            {say(contextLabel, language)}
          </span>
          <span className="app-context-sep" aria-hidden="true">
            /
          </span>
          <span className="app-meta app-truncate">
            {say(COPY.configurationFor, language)} {identity.clientName}
          </span>
        </div>

        <div className="app-topbar-right">
          <SyntheticDisclosure language={language} />
          <Link href="/workday" className="app-btn app-btn-quiet app-btn-sm">
            <IconArrowLeft size={14} stroke={1.8} aria-hidden="true" />
            {say(COPY.back, language)}
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
        <nav className="app-rail" aria-label={say(COPY.areas, language)}>
          {rail ?? (
            <>
              <span className="app-rail-section-label" style={sectionLabelStyle}>
                {say(COPY.configuration, language)}
              </span>
              <SettingsNav areas={SETTINGS_AREAS} language={language} />
              <span className="app-rail-section-label" style={sectionLabelStyle}>
                {say(COPY.operationsSection, language)}
              </span>
              <AdminRailLinks language={language} />
            </>
          )}
          <span className="app-rail-spacer" />
          {/*
           * The release, quietly, on every administrator screen. Read from the
           * release registry, so it cannot disagree with the operations
           * console or with package.json.
           */}
          <Link
            href="/ops#release"
            className="app-rail-item"
            title={`${say(COPY.release, language)} ${PRODUCT_RELEASE.version}, ${say(RELEASE_STAGE_LABELS[PRODUCT_RELEASE.stage], language)}`}
            style={{ height: "auto", padding: "var(--app-2)", margin: "0 var(--app-2)" }}
          >
            <span className="app-stack app-stack-1" style={{ minWidth: 0 }}>
              <span className="app-meta">{say(COPY.release, language)}</span>
              <span className="app-row">
                <Data>{PRODUCT_RELEASE.version}</Data>
                <span className="app-meta app-truncate">
                  {say(RELEASE_STAGE_LABELS[PRODUCT_RELEASE.stage], language)}
                </span>
              </span>
            </span>
          </Link>
        </nav>

        <main id="main" className="app-main">
          <div className="app-main-inner">{children}</div>
        </main>
      </div>
    </div>
  );
}
