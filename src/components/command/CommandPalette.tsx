"use client";

/**
 * The command palette.
 *
 * Written against the ARIA combobox pattern rather than pulled from a library,
 * for the same reason the rest of this layer avoids a component framework: the
 * palette has to search real scenario objects, run real server actions and
 * respect the authority gate, and a generic example palette would need to be
 * taken apart to do any of that. The brief also asks for it to feel integrated
 * rather than like a stock example, and the quickest route to that is to write
 * the twenty lines of keyboard handling it actually needs.
 *
 * The object index is passed in from the server. The palette does not query:
 * it filters a prepared list of identifiers and labels. That keeps it instant,
 * keeps the database out of the browser, and means a role that cannot see an
 * object never receives it in the first place.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  IconActivityHeartbeat,
  IconBuildingBank,
  IconFileText,
  IconGavel,
  IconHistory,
  IconPresentation,
  IconRefresh,
  IconScale,
  IconShieldCheck,
  IconSparkles,
  IconTopologyStar3,
  IconTruck,
  IconUsers,
} from "@tabler/icons-react";
import {
  actionSetAutonomy,
  actionSetMoment,
  actionSetWorldView,
  actionSwitchRole,
} from "@app/actions";
import { AUTONOMY_LEVELS, type AutonomyLevel, type RoleId } from "@/db/schema/core";
import { AUTONOMY_LABELS, t, type Language } from "@/i18n/labels";
import { isTypingTarget } from "@/components/workday-v2/interactive";
import { useShell, type DrawerTab } from "@/components/workday-v2/ShellContext";

/**
 * One searchable scenario object.
 *
 * Deliberately narrow. The palette needs a label to match on, a kind to group
 * by and a route to go to; it does not need the object.
 */
export interface CommandIndexEntry {
  id: string;
  kind: "risk" | "control" | "supplier" | "service" | "incident" | "decision" | "obligation" | "test-case";
  label: string;
  reference: string;
  href: string;
}

export interface CommandRole {
  id: RoleId;
  title: string;
  titleDe: string;
}

interface Command {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  /** Extra words that should match this command without being displayed. */
  keywords?: string;
  run: () => void;
}

const KIND_ICON: Record<CommandIndexEntry["kind"], React.ReactNode> = {
  risk: <IconActivityHeartbeat size={14} stroke={1.8} />,
  control: <IconShieldCheck size={14} stroke={1.8} />,
  supplier: <IconTruck size={14} stroke={1.8} />,
  service: <IconTopologyStar3 size={14} stroke={1.8} />,
  incident: <IconActivityHeartbeat size={14} stroke={1.8} />,
  decision: <IconGavel size={14} stroke={1.8} />,
  obligation: <IconScale size={14} stroke={1.8} />,
  "test-case": <IconFileText size={14} stroke={1.8} />,
};

const KIND_GROUP: Record<CommandIndexEntry["kind"], { en: string; de: string }> = {
  risk: { en: "Risks", de: "Risiken" },
  control: { en: "Controls", de: "Kontrollen" },
  supplier: { en: "Suppliers", de: "Dienstleister" },
  service: { en: "Services", de: "Dienste" },
  incident: { en: "Incidents", de: "Vorfaelle" },
  decision: { en: "Decisions", de: "Entscheidungen" },
  obligation: { en: "Obligations", de: "Anforderungen" },
  "test-case": { en: "Test cases", de: "Testfaelle" },
};

export function CommandPalette({
  roleId,
  language,
  roles,
  index,
  autonomyLevel,
  worldView,
  sharedEventMoment,
  onAskPartner,
  onOpenDemoMenu,
}: {
  roleId: RoleId;
  language: Language;
  roles: CommandRole[];
  index: CommandIndexEntry[];
  autonomyLevel: AutonomyLevel;
  worldView: "today" | "future";
  sharedEventMoment: string;
  /** Opens the partner on the Chat tab. Supplied by the shell. */
  onAskPartner?: () => void;
  /**
   * Focuses the demo menu trigger. Supplied by the shell.
   *
   * The palette never performs a destructive action itself; it takes the
   * presenter to the control that does, which is two step.
   */
  onOpenDemoMenu?: () => void;
}) {
  const shell = useShell();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => setMounted(true), []);

  const close = useCallback(() => {
    shell.setCommandOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, [shell]);

  const go = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router],
  );

  /*
   * Control K and Command K. Guarded against firing while the user is typing
   * somewhere else, which matters because the chat composer is always present
   * and a presenter typing a question should not have the palette appear.
   * The guard is skipped when the palette itself is open, so Escape and the
   * arrow keys keep working inside its own input.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isPaletteKey = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
      if (!isPaletteKey) return;
      if (!shell.commandOpen && isTypingTarget(event.target)) return;
      event.preventDefault();
      shell.setCommandOpen(!shell.commandOpen);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shell]);

  const commands = useMemo<Command[]>(() => {
    const askLabel = language === "de" ? "KI Partner fragen" : "Ask the AI Partner";
    const navGroup = language === "de" ? "Navigation" : "Navigation";
    const contextGroup = language === "de" ? "Kontext" : "Context";
    const scenarioGroup = language === "de" ? "Szenario" : "Scenario";
    const surfaceGroup = language === "de" ? "Oberflaechen" : "Surfaces";
    const roleGroup = language === "de" ? "Rolle wechseln" : "Switch role";

    const list: Command[] = [
      {
        id: "ask",
        group: navGroup,
        label: askLabel,
        icon: <IconSparkles size={14} stroke={1.8} />,
        keywords: "chat question partner frage",
        run: () => {
          close();
          onAskPartner?.();
        },
      },
      {
        id: "jump-event",
        group: scenarioGroup,
        label:
          language === "de"
            ? `Zum aktuellen Ereignis ${sharedEventMoment}`
            : `Jump to the current event at ${sharedEventMoment}`,
        icon: <IconActivityHeartbeat size={14} stroke={1.8} />,
        keywords: "14:05 shared event ereignis",
        run: () => {
          close();
          void actionSetMoment(sharedEventMoment).then(() => router.refresh());
        },
      },
      {
        id: "world-view",
        group: scenarioGroup,
        label:
          worldView === "today"
            ? language === "de"
              ? "Zur KI-gestuetzten Zukunft wechseln"
              : "Switch to the AI enabled future"
            : language === "de"
              ? "Zur heutigen Realitaet wechseln"
              : "Switch to the current reality",
        icon: <IconBuildingBank size={14} stroke={1.8} />,
        keywords: "today future heute zukunft vergleich comparison",
        run: () => {
          close();
          void actionSetWorldView(worldView === "today" ? "future" : "today").then(() =>
            router.refresh(),
          );
        },
      },
      ...AUTONOMY_LEVELS.map((level) => ({
        id: `autonomy-${level}`,
        group: scenarioGroup,
        label: `${language === "de" ? "Autonomie" : "Autonomy"}: ${t(AUTONOMY_LABELS, level, language)}`,
        hint: level === autonomyLevel ? (language === "de" ? "aktiv" : "current") : undefined,
        icon: <IconSparkles size={14} stroke={1.8} />,
        keywords: `autonomy autonomie ${level}`,
        run: () => {
          close();
          void actionSetAutonomy(level).then(() => router.refresh());
        },
      })),
      ...(
        [
          ["evidence", language === "de" ? "Nachweise anzeigen" : "Show evidence", <IconFileText key="e" size={14} stroke={1.8} />],
          ["audit", language === "de" ? "Revisionsprotokoll anzeigen" : "Show audit history", <IconHistory key="a" size={14} stroke={1.8} />],
          ["uncertainty", language === "de" ? "Unsicherheit anzeigen" : "Show uncertainty", <IconScale key="u" size={14} stroke={1.8} />],
        ] as Array<[DrawerTab, string, React.ReactNode]>
      ).map(([tab, label, icon]) => ({
        id: `drawer-${tab}`,
        group: contextGroup,
        label,
        icon,
        run: () => {
          close();
          shell.openDrawer(tab);
        },
      })),
      ...roles
        .filter((role) => role.id !== roleId)
        .map((role) => ({
          id: `role-${role.id}`,
          group: roleGroup,
          label: language === "de" ? role.titleDe : role.title,
          icon: <IconUsers size={14} stroke={1.8} />,
          run: () => {
            close();
            void actionSwitchRole(role.id).then(() => router.push(`/workday/${role.id}`));
          },
        })),
      {
        id: "presentation",
        group: surfaceGroup,
        label: language === "de" ? "Praesentation oeffnen" : "Open the presentation",
        icon: <IconPresentation size={14} stroke={1.8} />,
        keywords: "story deck",
        run: () => go("/story"),
      },
      {
        id: "control-room",
        group: surfaceGroup,
        label: language === "de" ? "Kontrollraum oeffnen" : "Open the control room",
        icon: <IconTopologyStar3 size={14} stroke={1.8} />,
        run: () => go("/control-room"),
      },
      {
        id: "integrations",
        group: surfaceGroup,
        label: language === "de" ? "Integrationen oeffnen" : "Open integrations",
        icon: <IconTopologyStar3 size={14} stroke={1.8} />,
        keywords: "connector konnektor settings",
        run: () => go("/settings/integrations"),
      },
      {
        id: "reset",
        group: scenarioGroup,
        /*
         * This opens the demo menu. It does not reset.
         *
         * It used to call `actionResetScenario` directly while a comment above
         * it claimed the opposite, so selecting a row labelled "confirm in the
         * demo menu" discarded every decision, rationale, approval and audit
         * event of the session on one keystroke. The subsequence matcher below
         * returns this row for almost any query, which made it reachable by
         * accident rather than only on purpose.
         *
         * A destructive action belongs behind a deliberate two step
         * confirmation, which `DemoMenu` already implements. The palette's job
         * here is to take the presenter to that control quickly, and nothing
         * more.
         */
        label:
          language === "de"
            ? "Tag zuruecksetzen, im Demo-Menue bestaetigen"
            : "Reset the day, confirm in the demo menu",
        icon: <IconRefresh size={14} stroke={1.8} />,
        keywords: "reset zuruecksetzen",
        run: () => {
          close();
          onOpenDemoMenu?.();
        },
      },
    ];

    return list;
  }, [
    language,
    roles,
    roleId,
    autonomyLevel,
    worldView,
    sharedEventMoment,
    close,
    go,
    router,
    shell,
    onAskPartner,
    onOpenDemoMenu,
  ]);

  /** Matching: a case-insensitive subsequence over label, reference and keywords. */
  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const objectCommands: Command[] = index.map((entry) => ({
      id: `object-${entry.kind}-${entry.id}`,
      group: language === "de" ? KIND_GROUP[entry.kind].de : KIND_GROUP[entry.kind].en,
      label: entry.label,
      hint: entry.reference,
      icon: KIND_ICON[entry.kind],
      keywords: `${entry.reference} ${entry.id} ${entry.kind}`,
      run: () => go(entry.href),
    }));

    const all = [...commands, ...objectCommands];
    if (needle.length === 0) {
      // With no query, show the commands and hold back the object index,
      // which would otherwise bury them under several hundred rows.
      return commands.slice(0, 12);
    }

    const scored = all
      .map((command) => {
        const haystack = `${command.label} ${command.hint ?? ""} ${command.keywords ?? ""}`.toLowerCase();
        const position = haystack.indexOf(needle);
        if (position >= 0) return { command, score: position };
        // Fall back to a subsequence match so "crcl" finds "Critical Control".
        let cursor = 0;
        for (const character of needle) {
          cursor = haystack.indexOf(character, cursor);
          if (cursor < 0) return null;
          cursor += 1;
        }
        return { command, score: 400 };
      })
      .filter((entry): entry is { command: Command; score: number } => entry !== null)
      .sort((a, b) => a.score - b.score)
      .slice(0, 40);

    return scored.map((entry) => entry.command);
  }, [query, commands, index, language, go]);

  // Clamp the active row whenever the result set changes under it.
  useEffect(() => {
    setActiveIndex((current) => (current >= results.length ? 0 : current));
  }, [results.length]);

  useEffect(() => {
    if (shell.commandOpen) inputRef.current?.focus();
  }, [shell.commandOpen]);

  if (!shell.commandOpen || !mounted) return null;

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % Math.max(results.length, 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + results.length) % Math.max(results.length, 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      results[activeIndex]?.run();
    }
  };

  let lastGroup = "";

  return createPortal(
    <div
      className="app-cmd-scrim"
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        className="app-cmd"
        role="dialog"
        aria-modal="true"
        aria-label={language === "de" ? "Befehle und Suche" : "Commands and search"}
        onKeyDown={onKeyDown}
      >
        <input
          ref={inputRef}
          className="app-cmd-input"
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={results[activeIndex] ? `cmd-${results[activeIndex].id}` : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          placeholder={
            language === "de"
              ? "Suchen oder einen Befehl ausfuehren"
              : "Search or run a command"
          }
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        <ul className="app-cmd-list" id={listId} role="listbox" ref={listRef}>
          {results.length === 0 ? (
            <li className="app-cmd-group">
              {language === "de" ? "Keine Treffer" : "No matches"}
            </li>
          ) : null}

          {results.map((command, position) => {
            const showGroup = command.group !== lastGroup;
            lastGroup = command.group;
            return (
              <li key={command.id}>
                {showGroup ? <div className="app-cmd-group">{command.group}</div> : null}
                <button
                  type="button"
                  id={`cmd-${command.id}`}
                  role="option"
                  aria-selected={position === activeIndex}
                  className="app-cmd-item"
                  data-active={position === activeIndex || undefined}
                  onMouseEnter={() => setActiveIndex(position)}
                  onClick={() => command.run()}
                >
                  <span className="app-shrink-0" aria-hidden="true">
                    {command.icon}
                  </span>
                  <span className="app-truncate">{command.label}</span>
                  {command.hint ? <span className="app-cmd-hint">{command.hint}</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
