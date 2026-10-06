"use client";

/**
 * The interactive controls in the header.
 *
 * Split from the header so that the identity, the role and the counts are
 * plain server HTML and only these wait for hydration. The brief lists search,
 * updates, the AI trigger and the user menu as the essential analyst controls
 * and everything else as belonging in a menu, which is what this renders.
 *
 * None of these fetches anything on mount. A header button that issued a
 * request to decide what to display would reintroduce exactly the dependency
 * the header was taken out of the page to escape. Search and Updates fetch
 * when they are opened, in `src/components/shell/`.
 *
 * Every number here is the number of its destination (audit T06, T07):
 *
 *   Updates     the updates the panel opens on, after the notification budget,
 *               shown as a count on the bell and in its accessible name.
 *   AI Partner  the suggestions the dock marks as needing the person. It used
 *               to read "1 suggestion" whatever the number.
 *
 * A Demo role's header carries none of the work controls: its routes show the
 * release page, and a search, an updates list or a partner for a role the
 * release does not include would be interactive work by another route.
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

const LABELS = {
  search: { en: "Search", de: "Suchen" },
  searchName: { en: "Search and commands, Control K", de: "Suchen und Befehle, Strg K" },
  updates: { en: "Updates", de: "Aktualisierungen" },
  updatesOne: { en: "Updates, 1 needs you", de: "Aktualisierungen, 1 erfordert Sie" },
  updatesMany: { en: "Updates, {count} need you", de: "Aktualisierungen, {count} erfordern Sie" },
  partner: { en: "AI Partner", de: "KI Partner" },
  monitoring: { en: "Monitoring", de: "Beobachtet" },
  working: { en: "Working", de: "Arbeitet" },
  offline: { en: "Offline", de: "Offline" },
  suggestionOne: { en: "1 suggestion needs you", de: "1 Vorschlag erfordert Sie" },
  suggestionMany: { en: "{count} suggestions need you", de: "{count} Vorschlaege erfordern Sie" },
} as const;

function pick(pair: { en: string; de: string }, language: Language): string {
  return language === "de" ? pair.de : pair.en;
}

export function WorkdayHeaderClientActions({
  language,
  updatesCount,
  suggestionsNeedingYou,
  aiState,
  userLabel,
  gated,
}: {
  language: Language;
  updatesCount: number;
  suggestionsNeedingYou: number;
  aiState: "idle" | "working" | "ready" | "offline";
  userLabel: string | null;
  /** True for a role the release gate does not open: no work controls. */
  gated: boolean;
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
    if (effectiveAiState === "working") return pick(LABELS.working, language);
    if (effectiveAiState === "offline") return pick(LABELS.offline, language);
    if (effectiveAiState === "ready" && suggestionsNeedingYou > 0) {
      return suggestionsNeedingYou === 1
        ? pick(LABELS.suggestionOne, language)
        : pick(LABELS.suggestionMany, language).replace("{count}", String(suggestionsNeedingYou));
    }
    return pick(LABELS.monitoring, language);
  })();

  const updatesName =
    updatesCount === 0
      ? pick(LABELS.updates, language)
      : updatesCount === 1
        ? pick(LABELS.updatesOne, language)
        : pick(LABELS.updatesMany, language).replace("{count}", String(updatesCount));

  return (
    <div className="wd-header-actions">
      {gated ? null : (
        <>
          <button
            type="button"
            className="wd-btn wd-btn-quiet wd-btn-sm"
            onClick={() => chrome.setCommandOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={chrome.commandOpen}
            aria-keyshortcuts="Control+K Meta+K"
            aria-label={pick(LABELS.searchName, language)}
            data-testid="header-search"
          >
            <IconSearch size={16} stroke={1.8} aria-hidden="true" />
            <span className="wd-search-label">{pick(LABELS.search, language)}</span>
          </button>

          <button
            type="button"
            className="wd-icon-btn"
            onClick={() => chrome.toggleUpdates()}
            aria-haspopup="dialog"
            aria-expanded={chrome.updatesOpen}
            aria-label={updatesName}
            style={{ position: "relative" }}
            data-updates-trigger=""
            data-testid="header-updates"
            data-count={updatesCount}
          >
            <IconBell size={18} stroke={1.8} aria-hidden="true" />
            {updatesCount > 0 ? (
              <span className="wd-header-count" aria-hidden="true">
                {updatesCount > 9 ? "9+" : updatesCount}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            className="wd-btn wd-btn-quiet wd-btn-sm"
            onClick={() => chrome.toggleDock()}
            aria-expanded={chrome.dockOpen}
            aria-label={`${pick(LABELS.partner, language)}, ${aiLabel}`}
            data-testid="header-ai"
            data-count={suggestionsNeedingYou}
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
        </>
      )}

      {/* The display and demonstration controls, collapsed into one menu. */}
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

            {/*
              * "Previous interface" used to sit here and linked to `?ui=current`,
              * which resolves to this interface: a control that reloaded the page
              * it was on (audit R09). It is removed rather than repointed,
              * because whether the earlier interfaces stay reachable at all is a
              * release decision, not a header one.
              */}
            <Link className="wd-menu-item" href="/story">
              {language === "de" ? "Praesentation" : "Presentation"}
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
