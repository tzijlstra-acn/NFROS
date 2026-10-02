"use client";

/**
 * The compact top bar, 48px.
 *
 * It carries six things and refuses the rest: the product mark, the acting
 * role and entity, the current work object, the command trigger, live status,
 * and the user and settings menu. Everything else that used to live here
 * moved into the demo menu or the AI Partner header.
 *
 * The structural guard from V1 is kept because the failure mode was silent:
 * `overflow: hidden` on the bar, `min-width: 0` on the flexible children, and
 * a single group that yields space by truncating. An earlier version set a
 * min-content width wider than the viewport, which laid the whole shell out at
 * roughly 2068px and carried controls off stage with no scrollbar to reveal
 * them. The bar now carries far fewer elements, but a future addition would
 * reintroduce the same failure without the guard.
 *
 * Branding is resolved from the product configuration and passed in. No logo
 * is hardcoded. In client branded mode the bar carries the client identity, in
 * Accenture branded mode the operator identity, and in co-branded mode both,
 * separated by a hairline rather than stacked.
 */

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  IconCheck,
  IconChevronDown,
  IconCircleDot,
  IconSearch,
  IconUserCircle,
} from "@tabler/icons-react";
import { actionSwitchRole } from "@app/actions";
import type { RoleId } from "@/db/schema/core";
import type { DemoMode } from "@/server/config/demo-mode";
import type { BrandIdentity } from "@/product";
import { MODE_LABELS, t, type Language } from "@/i18n/labels";
import { Data } from "./primitives";
import { Menu, type MenuGroup } from "./interactive";
import { DemoMenu } from "./DemoMenu";
import { useShell } from "./ShellContext";

export interface RoleOption {
  id: RoleId;
  title: string;
  titleDe: string;
  holderName: string;
  entityShortName: string;
}

/**
 * The product mark.
 *
 * The mark and the name are both rendered, because the configured artwork is
 * deliberately abstract and wordmark free: shipping real institution or
 * consultancy artwork into a repository holding a synthetic institution would
 * misuse the trademark and imply an endorsement that does not exist. A
 * geometric mark alone therefore identifies nothing, so the name carries the
 * identity and the mark carries the recognition.
 *
 * Nothing here branches on the branding mode. `identity.marks`,
 * `identity.showPair` and `identity.attribution` have already decided, and the
 * resolver is the single place that decision lives. A surface that re-derived
 * it would drift from the other surfaces the moment a fourth mode appeared, or
 * the moment one of them was corrected and the others were not.
 *
 * When no artwork is configured at all, a small built in glyph stands in, so a
 * deployment that has not uploaded anything still looks intentional.
 */
function BrandMark({ brand, language }: { brand: BrandIdentity; language: Language }) {
  return (
    <Link
      href="/"
      className="app-brand"
      aria-label={
        language === "de"
          ? `${brand.productName}, zur Startseite`
          : `${brand.productName}, to the entry screen`
      }
    >
      <span className={brand.showPair ? "app-brand-pair" : "app-row"}>
        {brand.marks.length === 0 ? (
          <span className="app-row" style={{ gap: "var(--app-2)" }}>
            <span className="app-brand-mark" aria-hidden="true">
              <IconCircleDot size={13} stroke={2} />
            </span>
            <span className="app-brand-name">{brand.shortName}</span>
          </span>
        ) : (
          brand.marks.map((mark, index) => (
            <span key={mark.src} className="app-row" style={{ gap: "var(--app-2)" }}>
              <img src={mark.src} alt="" className="app-brand-mark-img" width={20} height={20} />
              <span className="app-brand-name">
                {index === 0 ? brand.shortName : mark.alt}
              </span>
            </span>
          ))
        )}
      </span>
    </Link>
  );
}

export function TopBarV2({
  brand,
  roleId,
  roleOptions,
  language,
  entityName,
  holderName,
  roleTitle,
  currentObjectLabel,
  liveMoment,
  viewedMoment,
  mode,
  modeReason,
  liveAvailable,
  worldView,
  unreadCount,
}: {
  brand: BrandIdentity;
  roleId: RoleId;
  roleOptions: RoleOption[];
  language: Language;
  entityName: string;
  holderName: string;
  roleTitle: string;
  /** The work object or service currently in focus. Null on a list screen. */
  currentObjectLabel: string | null;
  liveMoment: string;
  viewedMoment: string;
  mode: DemoMode;
  modeReason: string | null;
  liveAvailable: boolean;
  worldView: "today" | "future";
  unreadCount: number;
}) {
  const shell = useShell();
  const [pending, start] = useTransition();
  const router = useRouter();

  const behind = viewedMoment !== liveMoment;

  const roleGroups: MenuGroup[] = [
    {
      label: language === "de" ? "Rolle wechseln" : "Switch role",
      items: roleOptions.map((option) => ({
        id: option.id,
        label: language === "de" ? option.titleDe : option.title,
        hint: option.entityShortName,
        checked: option.id === roleId,
        icon:
          option.id === roleId ? (
            <IconCheck size={14} stroke={2.2} />
          ) : (
            <span style={{ width: 14, display: "inline-block" }} />
          ),
        onSelect: () => {
          if (option.id === roleId) return;
          /*
           * Switching role navigates as well as recording the switch, because
           * the route segment carries the role. The scenario state, earlier
           * decisions, the audit history and the unread event state are all
           * retained: role is a column on the run, not a separate database.
           */
          start(async () => {
            await actionSwitchRole(option.id);
            router.push(`/workday/${option.id}`);
          });
        },
      })),
    },
  ];

  const userGroups: MenuGroup[] = [
    {
      label: holderName,
      items: [
        {
          id: "role-title",
          label: roleTitle,
          disabled: true,
        },
        {
          id: "entity",
          label: entityName,
          disabled: true,
        },
      ],
    },
    {
      label: language === "de" ? "Verwaltung" : "Administration",
      items: [
        {
          id: "organisation",
          label: language === "de" ? "Organisation" : "Organisation",
          href: "/settings/organisation",
        },
        {
          id: "integrations",
          label: language === "de" ? "Integrationen" : "Integrations",
          href: "/settings/integrations",
        },
        {
          id: "branding",
          label: language === "de" ? "Markenauftritt" : "Branding",
          href: "/settings/branding",
        },
      ],
    },
    {
      label: language === "de" ? "Unterstuetzung" : "Support",
      items: [
        ...(brand.supportLabel
          ? [
              {
                id: "support",
                label: brand.supportLabel,
                ...(brand.supportUrl ? { href: brand.supportUrl } : {}),
              },
            ]
          : []),
        {
          id: "about",
          label: language === "de" ? "Ueber dieses Produkt" : "About this product",
          href: "/trust",
        },
      ],
    },
  ];

  return (
    <header className="app-topbar">
      <BrandMark brand={brand} language={language} />

      <span className="app-divider-v" />

      {/* Role, as a compact menu rather than a wide segmented control. */}
      <Menu
        label={language === "de" ? "Rolle" : "Role"}
        groups={roleGroups}
        align="left"
        width={300}
        trigger={(props) => (
          <button
            type="button"
            className="app-btn app-btn-quiet app-btn-sm"
            {...props}
            disabled={pending}
          >
            <span className="app-strong">{roleTitle}</span>
            <span className="app-faint">{entityName}</span>
            <IconChevronDown size={13} stroke={2} aria-hidden="true" />
          </button>
        )}
      />

      {/*
        * The context group is the one that yields space, by truncating. The
        * current work object is the most droppable element here because it is
        * always also visible as the title of the centre workspace.
        */}
      <div className="app-context">
        {currentObjectLabel ? (
          <>
            <span className="app-context-sep" aria-hidden="true">
              /
            </span>
            <span className="app-truncate app-secondary" style={{ fontSize: "var(--app-text-sm)" }}>
              {currentObjectLabel}
            </span>
          </>
        ) : null}
      </div>

      <div className="app-topbar-right">
        {/* Live status. Two times when they differ, one when they do not. */}
        <span
          className="app-liveday-clock"
          data-behind={behind || undefined}
          title={
            behind
              ? language === "de"
                ? `Angezeigt ${viewedMoment}, live um ${liveMoment}`
                : `Viewing ${viewedMoment}, live at ${liveMoment}`
              : language === "de"
                ? "Aktuelle Szenariozeit"
                : "Current scenario time"
          }
        >
          <Data size="sm">{behind ? viewedMoment : liveMoment}</Data>
          {behind ? (
            <span className="app-liveday-live">
              {language === "de" ? `live ${liveMoment}` : `live ${liveMoment}`}
            </span>
          ) : null}
        </span>

        {unreadCount > 0 ? (
          <span className="app-chip app-chip-count" data-tone="warning">
            {unreadCount}
            <span className="app-sr-only">
              {language === "de" ? " neue Ereignisse" : " new events"}
            </span>
          </span>
        ) : null}

        <span className="app-chip" title={modeReason ?? undefined}>
          {t(MODE_LABELS, mode, language)}
        </span>

        <button
          type="button"
          className="app-btn app-btn-quiet app-btn-sm"
          onClick={() => shell.setCommandOpen(true)}
          aria-label={
            language === "de"
              ? "Suche und Befehle oeffnen, Strg K"
              : "Open search and commands, Control K"
          }
        >
          <IconSearch size={14} stroke={1.9} aria-hidden="true" />
          <span className="app-kbd" aria-hidden="true">
            K
          </span>
        </button>

        <DemoMenu
          language={language}
          worldView={worldView}
          mode={mode}
          modeReason={modeReason}
          liveAvailable={liveAvailable}
          currentMoment={liveMoment}
        />

        <Menu
          label={language === "de" ? "Konto und Verwaltung" : "Account and administration"}
          groups={userGroups}
          width={248}
          trigger={(props) => (
            <button
              type="button"
              className="app-icon-btn"
              {...props}
              aria-label={`${holderName}. ${language === "de" ? "Konto und Verwaltung" : "Account and administration"}`}
            >
              <IconUserCircle size={18} stroke={1.7} aria-hidden="true" />
            </button>
          )}
        />
      </div>
    </header>
  );
}
