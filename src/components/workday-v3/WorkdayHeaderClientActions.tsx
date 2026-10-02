"use client";

/**
 * The four interactive controls in the header.
 *
 * Split from the header so that the identity, the role and the counts are
 * plain server HTML and only these wait for hydration. The brief lists search,
 * updates, the AI trigger and the user menu as the essential analyst controls
 * and everything else as belonging in a menu, which is what this renders.
 *
 * None of these fetches anything on mount. A header button that issued a
 * request to decide what to display would reintroduce exactly the dependency
 * the header was taken out of the page to escape.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  IconAdjustmentsHorizontal,
  IconBell,
  IconMoon,
  IconSearch,
  IconSettings,
  IconShieldCheck,
  IconSparkles,
  IconSun,
  IconUserCircle,
} from "@tabler/icons-react";
import type { Language } from "@/i18n/labels";
import { useWorkdayChrome } from "./ChromeContext";

export function WorkdayHeaderClientActions({
  language,
  updatesCount,
  aiState,
  userLabel,
  roleId,
}: {
  language: Language;
  updatesCount: number;
  aiState: "idle" | "working" | "ready" | "offline";
  userLabel: string | null;
  roleId: string | null;
}) {
  const chrome = useWorkdayChrome();
  const [userOpen, setUserOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);

  /* Escape closes whichever menu is open. */
  useEffect(() => {
    if (!userOpen && !demoOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setUserOpen(false);
      setDemoOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [userOpen, demoOpen]);

  /*
   * The client raises the AI state to `working` while a run is in flight. The
   * server cannot know that, and a server rendered `working` would be the
   * header asserting activity it has no way to observe.
   */
  const effectiveAiState = chrome.aiRunning ? "working" : aiState;

  const aiLabel = (() => {
    const labels = {
      idle: { en: "Monitoring", de: "Beobachtet" },
      working: { en: "Working", de: "Arbeitet" },
      ready: { en: "1 suggestion", de: "1 Vorschlag" },
      offline: { en: "Offline", de: "Offline" },
    } as const;
    const pair = labels[effectiveAiState];
    return language === "de" ? pair.de : pair.en;
  })();

  return (
    <div className="wd-header-actions">
      <button
        type="button"
        className="wd-btn wd-btn-quiet wd-btn-sm"
        onClick={() => chrome.setCommandOpen(true)}
        aria-label={
          language === "de" ? "Suchen und Befehle, Strg K" : "Search and commands, Control K"
        }
      >
        <IconSearch size={16} stroke={1.8} aria-hidden="true" />
        <span className="wd-search-label">{language === "de" ? "Suchen" : "Search"}</span>
      </button>

      <button
        type="button"
        className="wd-icon-btn"
        onClick={() => chrome.toggleUpdates()}
        aria-label={
          updatesCount > 0
            ? language === "de"
              ? `${updatesCount} Aktualisierungen`
              : `${updatesCount} updates`
            : language === "de"
              ? "Aktualisierungen"
              : "Updates"
        }
        style={{ position: "relative" }}
      >
        <IconBell size={18} stroke={1.8} aria-hidden="true" />
        {updatesCount > 0 ? <span className="wd-nav-dot" aria-hidden="true" /> : null}
      </button>

      <button
        type="button"
        className="wd-btn wd-btn-quiet wd-btn-sm"
        onClick={() => chrome.toggleDock()}
        aria-expanded={chrome.dockOpen}
        aria-label={`${language === "de" ? "KI Partner" : "AI Partner"}, ${aiLabel}`}
      >
        <IconSparkles size={16} stroke={1.8} aria-hidden="true" />
        <span
          className="wd-dot"
          data-tone={
            effectiveAiState === "ready"
              ? "warning"
              : effectiveAiState === "working"
                ? "accent"
                : effectiveAiState === "offline"
                  ? undefined
                  : "success"
          }
          aria-hidden="true"
        />
      </button>

      {/* The demonstration controls, collapsed into one menu. */}
      <div style={{ position: "relative" }}>
        <button
          type="button"
          className="wd-icon-btn"
          aria-expanded={demoOpen}
          aria-haspopup="menu"
          onClick={() => {
            setDemoOpen((open) => !open);
            setUserOpen(false);
          }}
          aria-label={language === "de" ? "Darstellung und Demo" : "Display and demo"}
        >
          <IconAdjustmentsHorizontal size={18} stroke={1.8} aria-hidden="true" />
        </button>

        {demoOpen ? (
          <Menu label={language === "de" ? "Darstellung und Demo" : "Display and demo"}>
            <button
              type="button"
              className="wd-menu-item"
              onClick={() => {
                chrome.toggleTheme();
                setDemoOpen(false);
              }}
            >
              {chrome.theme === "dark" ? (
                <IconSun size={16} stroke={1.8} aria-hidden="true" />
              ) : (
                <IconMoon size={16} stroke={1.8} aria-hidden="true" />
              )}
              {chrome.theme === "dark"
                ? language === "de"
                  ? "Helles Design"
                  : "Light theme"
                : language === "de"
                  ? "Dunkles Design"
                  : "Dark theme"}
            </button>

            <button
              type="button"
              className="wd-menu-item"
              onClick={() => {
                chrome.setDemoMode(!chrome.demoMode);
                setDemoOpen(false);
              }}
            >
              <IconAdjustmentsHorizontal size={16} stroke={1.8} aria-hidden="true" />
              {chrome.demoMode
                ? language === "de"
                  ? "Demo-Modus verlassen"
                  : "Leave demo mode"
                : language === "de"
                  ? "Demo-Modus"
                  : "Demo mode"}
            </button>

            <div className="wd-menu-sep" />

            <Link className="wd-menu-item" href="/story">
              {language === "de" ? "Praesentation" : "Presentation"}
            </Link>
            <Link className="wd-menu-item" href={`/workday/${roleId ?? "rcsa"}?ui=current`}>
              {language === "de" ? "Vorherige Oberflaeche" : "Previous interface"}
            </Link>
          </Menu>
        ) : null}
      </div>

      <div style={{ position: "relative" }}>
        <button
          type="button"
          className="wd-icon-btn"
          aria-expanded={userOpen}
          aria-haspopup="menu"
          onClick={() => {
            setUserOpen((open) => !open);
            setDemoOpen(false);
          }}
          aria-label={
            userLabel
              ? `${userLabel}. ${language === "de" ? "Konto" : "Account"}`
              : language === "de"
                ? "Konto"
                : "Account"
          }
        >
          <IconUserCircle size={18} stroke={1.8} aria-hidden="true" />
        </button>

        {userOpen ? (
          <Menu label={language === "de" ? "Konto" : "Account"}>
            {userLabel ? <div className="wd-menu-label">{userLabel}</div> : null}
            <Link className="wd-menu-item" href="/trust">
              <IconShieldCheck size={16} stroke={1.8} aria-hidden="true" />
              {language === "de" ? "Vertrauen" : "Trust"}
            </Link>
            <Link className="wd-menu-item" href="/control-room">
              <IconAdjustmentsHorizontal size={16} stroke={1.8} aria-hidden="true" />
              {language === "de" ? "Kontrollraum" : "Control room"}
            </Link>
            <Link className="wd-menu-item" href="/settings/organisation">
              <IconSettings size={16} stroke={1.8} aria-hidden="true" />
              {language === "de" ? "Einstellungen" : "Settings"}
            </Link>
          </Menu>
        ) : null}
      </div>
    </div>
  );
}

/** A small anchored menu. Dismissed by Escape or a click outside. */
function Menu({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="wd-menu" role="menu" aria-label={label}>
      {children}
    </div>
  );
}
