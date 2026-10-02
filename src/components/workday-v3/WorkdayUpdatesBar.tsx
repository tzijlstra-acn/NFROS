"use client";

/**
 * The bottom bar. 40px, and quiet in analyst mode.
 *
 * In analyst mode it says how many updates are waiting and carries the
 * permanent synthetic data disclosure. That is all. The V2 layer reserved 84px
 * for a full event track with play controls on every screen, which the brief
 * identifies as a presentation capability occupying permanent analyst space.
 *
 * In demo mode the day controls appear here, because a presenter genuinely
 * needs them and they belong with the clock. The same product UI, with one
 * more group of controls, rather than a separate demonstration experience.
 *
 * The disclosure is in this row rather than the header for the same reason it
 * was in V2: the header is where every control competes for width, so it is
 * the one place a permanent disclosure could be pushed out of view.
 */

import Link from "next/link";
import { IconPlayerPlay, IconChevronUp } from "@tabler/icons-react";
import type { Language } from "@/i18n/labels";
import { useWorkdayChrome } from "./ChromeContext";

export function WorkdayUpdatesBar({
  language,
  updatesCount,
  roleId,
}: {
  language: Language;
  updatesCount: number;
  roleId: string;
}) {
  const chrome = useWorkdayChrome();

  return (
    <div className="wd-updates">
      {updatesCount > 0 ? (
        <button
          type="button"
          className="wd-btn wd-btn-quiet wd-btn-sm"
          onClick={chrome.toggleUpdates}
          aria-expanded={chrome.updatesOpen}
          aria-label={
            language === "de"
              ? `${updatesCount} Aktualisierungen pruefen`
              : `Review ${updatesCount} updates`
          }
        >
          <span className="wd-dot" data-tone="warning" aria-hidden="true" />
          {language === "de" ? `${updatesCount} Aktualisierungen` : `${updatesCount} updates`}
          <IconChevronUp
            size={14}
            stroke={2}
            aria-hidden="true"
            className="wd-disclosure-chevron"
          />
        </button>
      ) : (
        <span className="wd-meta">
          {language === "de" ? "Keine neuen Aktualisierungen" : "No new updates"}
        </span>
      )}

      {/*
        * Demo controls, only in demo mode. The full event track lives behind
        * the play control rather than being permanently reserved space.
        */}
      {chrome.demoMode ? (
        <Link
          href={`/workday/${roleId}?ui=current`}
          className="wd-btn wd-btn-quiet wd-btn-sm"
          aria-label={language === "de" ? "Tagessteuerung" : "Day controls"}
        >
          <IconPlayerPlay size={14} stroke={2} aria-hidden="true" />
          {language === "de" ? "Tag abspielen" : "Play the day"}
        </Link>
      ) : null}

      <span className="wd-grow" />

      <span className="wd-synthetic">
        {language === "de" ? "Synthetische Institution und Daten" : "Synthetic institution and data"}
      </span>
    </div>
  );
}
