"use client";

/**
 * The demo menu.
 *
 * The interactive workday is two things at once: a simulation of a product and
 * a demonstration of it. The V1 top bar did not separate those concerns, so a
 * lane chip, a mode chip, an autonomy selector, a Today versus future toggle
 * and a language toggle all competed for width in the bar at every moment of
 * the working day, and at 1366 some of them were pushed off stage entirely.
 *
 * Here the demonstration controls collapse into one menu. They are all still
 * one click away, which is what a presenter needs, but they no longer occupy
 * the chrome of a working application. The autonomy state moved to the AI
 * Partner header instead, where it is contextually relevant to the thing it
 * actually governs.
 *
 * Reset is in here too, and it is marked as destructive. A permanent, visible
 * Reset button in the navigation rail invites an accidental click during a
 * live demonstration, which would discard the decisions the audience just
 * watched someone take.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  IconAdjustments,
  IconArrowBackUp,
  IconClockPlay,
  IconDeviceDesktopAnalytics,
  IconLanguage,
  IconPresentation,
  IconRefresh,
} from "@tabler/icons-react";
import {
  actionResetScenario,
  actionSetLanguage,
  actionSetMoment,
  actionSetWorldView,
} from "@app/actions";
import { actionSetDemoMode } from "@app/mode-actions";
import type { DemoMode } from "@/server/config/demo-mode";
import { MODE_LABELS, PRODUCT_COPY, t, type Language } from "@/i18n/labels";
import { Menu, type MenuGroup } from "./interactive";

/** The shared event moment, which a presenter jumps to constantly. */
const SHARED_EVENT_MOMENT = "14:05";

export function DemoMenu({
  language,
  worldView,
  mode,
  modeReason,
  liveAvailable,
  currentMoment,
}: {
  language: Language;
  worldView: "today" | "future";
  mode: DemoMode;
  modeReason: string | null;
  liveAvailable: boolean;
  currentMoment: string;
}) {
  const [pending, start] = useTransition();
  const [confirmReset, setConfirmReset] = useState(false);
  const router = useRouter();

  const run = (work: () => Promise<unknown>) => {
    start(async () => {
      await work();
      router.refresh();
    });
  };

  const groups: MenuGroup[] = [
    {
      label: language === "de" ? "Vergleich" : "Comparison",
      items: [
        {
          id: "today",
          label: t(PRODUCT_COPY, "todayView", language),
          checked: worldView === "today",
          onSelect: () => run(() => actionSetWorldView("today")),
        },
        {
          id: "future",
          label: t(PRODUCT_COPY, "futureView", language),
          checked: worldView === "future",
          onSelect: () => run(() => actionSetWorldView("future")),
        },
      ],
    },
    {
      label: language === "de" ? "KI-Modus" : "AI mode",
      items: (["live", "safe", "offline"] as DemoMode[]).map((candidate) => ({
        id: candidate,
        label: t(MODE_LABELS, candidate, language),
        checked: mode === candidate,
        /*
         * Live mode is offered only when a key actually resolved. Offering it
         * otherwise would produce a silent downgrade a presenter discovers
         * mid sentence. The reason for the unavailability is on the trigger
         * tooltip rather than buried in the control room.
         */
        disabled: candidate === "live" && !liveAvailable,
        onSelect: () => run(() => actionSetDemoMode(candidate)),
      })),
    },
    {
      label: language === "de" ? "Sprache" : "Language",
      items: [
        {
          id: "en",
          label: "English",
          icon: <IconLanguage size={14} stroke={1.8} />,
          checked: language === "en",
          onSelect: () => run(() => actionSetLanguage("en")),
        },
        {
          id: "de",
          label: "Deutsch",
          icon: <IconLanguage size={14} stroke={1.8} />,
          checked: language === "de",
          onSelect: () => run(() => actionSetLanguage("de")),
        },
      ],
    },
    {
      label: language === "de" ? "Sprung" : "Jump",
      items: [
        {
          id: "shared-event",
          label:
            language === "de"
              ? `Zum gemeinsamen Ereignis ${SHARED_EVENT_MOMENT}`
              : `To the shared event at ${SHARED_EVENT_MOMENT}`,
          icon: <IconClockPlay size={14} stroke={1.8} />,
          disabled: currentMoment === SHARED_EVENT_MOMENT,
          onSelect: () => run(() => actionSetMoment(SHARED_EVENT_MOMENT)),
        },
      ],
    },
    {
      label: language === "de" ? "Oberflaechen" : "Surfaces",
      items: [
        {
          id: "presentation",
          label: language === "de" ? "Praesentation" : "Presentation",
          icon: <IconPresentation size={14} stroke={1.8} />,
          href: "/story",
        },
        {
          id: "control-room",
          label: language === "de" ? "Kontrollraum" : "Control room",
          icon: <IconDeviceDesktopAnalytics size={14} stroke={1.8} />,
          href: "/control-room",
        },
        {
          id: "v1",
          label: language === "de" ? "Vorherige Oberflaeche" : "Previous interface",
          icon: <IconArrowBackUp size={14} stroke={1.8} />,
          hint: "ui=v1",
          href: "?ui=v1",
        },
      ],
    },
    {
      items: [
        {
          id: "reset",
          label: confirmReset
            ? language === "de"
              ? "Wirklich zuruecksetzen"
              : "Confirm reset"
            : language === "de"
              ? "Tag zuruecksetzen"
              : "Reset the day",
          icon: <IconRefresh size={14} stroke={1.8} />,
          danger: true,
          /*
           * Two step, in the menu, not in the rail. The first selection arms
           * it and the menu stays open; the second performs it. A single
           * click that silently discards every decision taken during a
           * demonstration is not a recoverable mistake.
           */
          onSelect: () => {
            if (!confirmReset) {
              setConfirmReset(true);
              return;
            }
            setConfirmReset(false);
            run(() => actionResetScenario());
          },
        },
      ],
    },
  ];

  return (
    <Menu
      label={language === "de" ? "Demonstrationseinstellungen" : "Demonstration settings"}
      groups={groups}
      width={268}
      trigger={(props) => (
        <button
          type="button"
          className="app-btn app-btn-quiet app-btn-sm"
          {...props}
          disabled={pending}
          title={
            modeReason ??
            (language === "de"
              ? "Einstellungen fuer die Demonstration"
              : "Settings for the demonstration")
          }
        >
          <IconAdjustments size={14} stroke={1.8} aria-hidden="true" />
          {/*
            * Labelled "Demo", deliberately quiet. The brief asks for a subtle
            * label rather than a prominent one: the audience should be aware
            * this is a demonstration without the interface insisting on it.
            */}
          <span>Demo</span>
        </button>
      )}
    />
  );
}
