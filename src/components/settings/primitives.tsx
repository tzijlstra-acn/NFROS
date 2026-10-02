"use client";

/**
 * Settings only presentational pieces.
 *
 * Small on purpose. The workday V2 primitives already provide rows, chips,
 * notices, the regulatory disclosure and the synthetic data label, and
 * rebuilding any of them here would produce a second visual language inside
 * one product. What is here is the handful of shapes a settings screen needs
 * and the workday does not: a labelled field, the settings navigation, and the
 * implemented or defined mark the deployment screen depends on.
 *
 * Why this module carries "use client" when almost nothing in it is
 * interactive: the settings navigation has to know the current path to set
 * `aria-current`, and a server layout cannot read the path. Marking the whole
 * module keeps the navigation and the presentational pieces it sits beside in
 * one file, at the cost of a few kilobytes of presentational markup in the
 * client bundle. The settings pages themselves stay server components and keep
 * reading the database directly, because `children` crosses the boundary as a
 * rendered payload rather than as code.
 */

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconArrowsShuffle,
  IconBuildingBank,
  IconCheck,
  IconCircleOff,
  IconLayoutGrid,
  IconPackages,
  IconPalette,
  IconPlugConnected,
  IconServer2,
  IconShieldLock,
} from "@tabler/icons-react";
import { Chip, Data, RegulatoryNote, SectionHead } from "@/components/workday-v2/primitives";
import type { AdminArea } from "@/product";
import type { Language } from "@/i18n/labels";

/* ==========================================================================
   Navigation
   ========================================================================== */

/*
 * The area list is a prop, not an import.
 *
 * It lives in `src/product/entitlements/entitlements.ts` because this module
 * carries "use client", and a plain array exported from a client module
 * arrives in a server component as a client reference rather than as an array.
 * The settings index page needs the same list, so the list has to come from a
 * server safe module and be handed in here.
 *
 * Three of the seven areas, integrations, mappings and authority, are owned by
 * another part of the build. They are still listed and linked: an
 * administrator looking for the connector settings should find them from here,
 * and a navigation that hid an area because this module did not create it
 * would be misleading about what the product contains.
 */

/*
 * Icons are resolved from a key rather than passed in as elements. A component
 * type cannot cross the server to client boundary as a prop, and passing one
 * is the kind of mistake that fails at request time rather than at compile
 * time.
 */
const AREA_ICONS: Record<AdminArea["icon"], typeof IconBuildingBank> = {
  organisation: IconBuildingBank,
  branding: IconPalette,
  integrations: IconPlugConnected,
  mappings: IconArrowsShuffle,
  "role-packs": IconPackages,
  "role-apps": IconLayoutGrid,
  authority: IconShieldLock,
  deployment: IconServer2,
};

export function SettingsNav({
  areas,
  language,
}: {
  areas: readonly AdminArea[];
  language: Language;
}) {
  const pathname = usePathname();

  return (
    <ul className="app-rail-list">
      {areas.map((area) => {
        const Glyph = AREA_ICONS[area.icon];
        /*
         * Prefix matching, not equality. A future nested route such as
         * /settings/integrations/grc-irm is still the integrations area, and an
         * exact match would leave the whole navigation looking inactive.
         */
        const current = pathname === area.href || pathname.startsWith(`${area.href}/`);
        return (
          <li key={area.href}>
            <Link
              href={area.href}
              className="app-rail-item"
              {...(current ? { "aria-current": "page" as const } : {})}
            >
              <span className="app-rail-icon">
                <Glyph size={17} stroke={1.7} aria-hidden="true" />
              </span>
              <span className="app-rail-label">
                {language === "de" ? area.label.de : area.label.en}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/* ==========================================================================
   Page scaffolding
   ========================================================================== */

/** The settings page header: one line of context and one title. */
export function SettingsHead({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string;
  title: string;
  lede?: string;
}) {
  return (
    <div className="app-workspace-head">
      <span className="app-eyebrow">{eyebrow}</span>
      <h1 className="app-title">{title}</h1>
      {lede ? (
        <p className="app-secondary" style={{ maxWidth: "76ch" }}>
          {lede}
        </p>
      ) : null}
    </div>
  );
}

export function SettingsSection({
  title,
  count,
  trailing,
  children,
}: {
  title: string;
  count?: number;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="app-section">
      <SectionHead title={title} {...(count !== undefined ? { count } : {})} trailing={trailing} />
      {children}
    </section>
  );
}

/* ==========================================================================
   Fields
   ========================================================================== */

/**
 * A labelled configuration value.
 *
 * Two columns rather than a row with a chip, because a settings screen is read
 * by scanning down the label column for the setting you came to check, and a
 * row layout puts the label in a different horizontal position on every line.
 */
export function Field({
  label,
  value,
  note,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  note?: string;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(140px, 220px) minmax(0, 1fr)",
        gap: "var(--app-4)",
        padding: "var(--app-2) 0",
        borderBottom: "1px solid var(--app-border)",
        alignItems: "baseline",
      }}
    >
      <span className="app-secondary" style={{ fontSize: "var(--app-text-sm)" }}>
        {label}
      </span>
      <span className="app-stack app-stack-1">
        {mono ? <Data size="sm">{value}</Data> : <span>{value}</span>}
        {note ? <span className="app-meta">{note}</span> : null}
      </span>
    </div>
  );
}

/** A group of fields. Wraps them so the last hairline is not a dangling edge. */
export function FieldList({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div
      {...(label ? { role: "group", "aria-label": label } : {})}
      style={{ borderTop: "1px solid var(--app-border)" }}
    >
      {children}
    </div>
  );
}

/* ==========================================================================
   Regulatory context
   ========================================================================== */

/**
 * Regulator context for one entity, with the disclosure attached.
 *
 * The disclosure is rendered by the shared `RegulatoryNote` primitive and is
 * not a parameter here, so it cannot drift between the entity list and the
 * deployment screen. Every place in this product that names a regulation shows
 * the same sentence.
 */
export function RegulatorContext({
  items,
  language,
  emptyDetail,
}: {
  items: readonly string[];
  language: Language;
  emptyDetail?: string;
}) {
  if (items.length === 0) {
    return (
      <span className="app-meta">
        {emptyDetail ??
          (language === "de"
            ? "Kein regulatorischer Kontext konfiguriert."
            : "No regulatory context configured.")}
      </span>
    );
  }

  return (
    <span className="app-stack app-stack-1">
      <span className="app-row app-row-wrap">
        {items.map((item) => (
          <Chip key={item} tone="info" title={item}>
            {item}
          </Chip>
        ))}
      </span>
      <RegulatoryNote language={language} />
    </span>
  );
}

/* ==========================================================================
   Honesty marks
   ========================================================================== */

/**
 * Implemented here, or defined only.
 *
 * Two states, and the label says which. A tick on its own would be read as a
 * feature check mark, which is the opposite of what the deployment screen is
 * for.
 */
export function ImplementedMark({
  implemented,
  language,
}: {
  implemented: boolean;
  language: Language;
}) {
  if (implemented) {
    return (
      <Chip tone="success">
        <IconCheck size={11} stroke={2.2} aria-hidden="true" />
        {language === "de" ? "Hier umgesetzt" : "Implemented here"}
      </Chip>
    );
  }
  return (
    <Chip tone="neutral">
      <IconCircleOff size={11} stroke={2} aria-hidden="true" />
      {language === "de" ? "Nur definiert" : "Defined only"}
    </Chip>
  );
}

/** Whether an entitlement profile grants something, stated in words. */
export function GrantMark({ granted, language }: { granted: boolean; language: Language }) {
  return granted ? (
    <Chip tone="success">{language === "de" ? "Freigeschaltet" : "Granted"}</Chip>
  ) : (
    <Chip tone="neutral">{language === "de" ? "Nicht freigeschaltet" : "Not granted"}</Chip>
  );
}

/** The outstanding work for a profile that is not implemented here. */
export function OutstandingWork({
  items,
  language,
}: {
  items: readonly string[];
  language: Language;
}) {
  if (items.length === 0) return null;
  return (
    <div className="app-stack app-stack-1">
      <span className="app-eyebrow">
        {language === "de"
          ? "In einem Projekt noch zu leisten"
          : "Outstanding work for an engagement"}
      </span>
      <ul className="app-stack app-stack-1" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {items.map((item) => (
          <li
            key={item}
            className="app-secondary"
            style={{
              fontSize: "var(--app-text-sm)",
              paddingLeft: "var(--app-4)",
              position: "relative",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                left: 0,
                top: "0.55em",
                width: 4,
                height: 4,
                borderRadius: "50%",
                background: "var(--app-text-faint)",
              }}
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * A list of identifiers, for example tool names or route paths.
 *
 * Rendered as data text, because these are identifiers that an engineer copies
 * into another system rather than prose that somebody reads.
 */
export function IdentifierList({ items, label }: { items: readonly string[]; label: string }) {
  return (
    <span className="app-row app-row-wrap" role="list" aria-label={label}>
      {items.map((item) => (
        <span key={item} role="listitem" className="app-oid">
          {item}
        </span>
      ))}
    </span>
  );
}
