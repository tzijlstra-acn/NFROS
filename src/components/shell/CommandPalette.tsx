"use client";

/**
 * Global search and the command palette, for the V3.3 shell.
 *
 * Opened by the header's Search control and by Control K or Command K. Before
 * this existed the header button and the shortcut set chrome state that
 * nothing rendered (audit J28), because the only palette was mounted in the V2
 * shell.
 *
 * What it does, against plan section 4.12:
 *
 *   Search. The role's whole search scope is fetched once per opening from
 *   `/api/workday/search` and filtered here with `searchEntries`, so typing is
 *   instant. Results are grouped by professional object type, in the role's
 *   order, and the scope (role and legal entity) is stated above them. Each
 *   result opens on the surface where that object is worked on; the read model
 *   decides where, not this component.
 *
 *   Commands. The eight the plan lists. Each says what it will open, read from
 *   the data, or why there is nothing to open. None of them writes anything:
 *   they navigate, narrow the search, or open a panel through the chrome.
 *
 *   Recent and pinned. Kept in this browser's local storage, per role, because
 *   the product has no table for them and this release does not change the
 *   schema. The palette says so. Both lists are reconciled against the scope
 *   every time it opens, so storage can never surface an object out of scope.
 *
 *   Keyboard. The ARIA combobox pattern: focus stays in the input, the arrow
 *   keys move the active option, Home and End jump, Enter runs it, Escape
 *   steps back out of a narrowed search and then closes. Tab moves between the
 *   input and the palette's own buttons and never leaves the dialog. Focus
 *   returns to whatever opened it.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconArrowRight,
  IconClock,
  IconPin,
  IconPinnedOff,
  IconSearch,
  IconSparkles,
  IconX,
} from "@tabler/icons-react";
import type { Language } from "@/i18n/labels";
import { useWorkdayChrome } from "@/components/workday-v3/ChromeContext";
import { useBoundContext } from "@/components/work/context-store";
import {
  fill,
  isPinned,
  KIND_LABELS,
  KIND_SINGULAR,
  normaliseForSearch,
  parseStored,
  queryTerms,
  reconcileStored,
  rememberRecent,
  say,
  searchEntries,
  SEARCH_COPY,
  storageKey,
  togglePinned,
  toStored,
  type PaletteCommand,
  type SearchEntry,
  type SearchKind,
  type SearchPayload,
  type StoredSearchItem,
} from "@/features/search";
import "./shell.css";

type Option =
  | { type: "command"; key: string; command: PaletteCommand }
  | { type: "entry"; key: string; entry: SearchEntry }
  | { type: "stored"; key: string; item: StoredSearchItem; list: "recent" | "pinned" };

interface Section {
  id: string;
  label: string;
  /** Matches beyond those shown, for a search group. */
  more: number;
  options: Option[];
}

type LoadState = "idle" | "loading" | "ready" | "failed";

function readList(list: "recent" | "pinned", roleId: string): StoredSearchItem[] {
  try {
    return parseStored(window.localStorage.getItem(storageKey(list, roleId)), roleId);
  } catch {
    return [];
  }
}

function writeList(list: "recent" | "pinned", roleId: string, items: StoredSearchItem[]): void {
  try {
    window.localStorage.setItem(storageKey(list, roleId), JSON.stringify(items));
  } catch {
    // A browser refusing storage loses the list and nothing else.
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

function optionTarget(option: Option): { kind: SearchKind; id: string } | null {
  if (option.type === "entry") return { kind: option.entry.kind, id: option.entry.id };
  if (option.type === "stored") return { kind: option.item.kind, id: option.item.id };
  return null;
}

export function CommandPalette({ roleId, language }: { roleId: string; language: Language }) {
  const chrome = useWorkdayChrome();
  const router = useRouter();
  const bound = useBoundContext(roleId);

  const [payload, setPayload] = useState<SearchPayload | null>(null);
  const [load, setLoad] = useState<LoadState>("idle");
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<SearchKind | null>(null);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<StoredSearchItem[]>([]);
  const [pinned, setPinned] = useState<StoredSearchItem[]>([]);

  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const listId = useId();
  const open = chrome.commandOpen;

  const close = useCallback(() => {
    chrome.setCommandOpen(false);
    setQuery("");
    setKind(null);
    setActive(0);
    const target = returnFocus.current;
    returnFocus.current = null;
    requestAnimationFrame(() => {
      if (target && target.isConnected) target.focus();
    });
  }, [chrome]);

  /*
   * Control K and Command K. Ignored while the person is typing somewhere
   * else, so a question being written to the AI Partner is not interrupted;
   * inside the palette the same keys close it, the same way Escape does.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "k") return;
      if (!open && isTypingTarget(event.target)) return;
      event.preventDefault();
      if (open) close();
      else chrome.setCommandOpen(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [chrome, open, close]);

  /* ---- Opening: remember the trigger, read storage, fetch the scope ---- */
  useEffect(() => {
    if (!open) return;
    if (returnFocus.current === null && document.activeElement instanceof HTMLElement) {
      returnFocus.current = document.activeElement;
    }
    setRecent(readList("recent", roleId));
    setPinned(readList("pinned", roleId));
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open, roleId]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    let cancelled = false;
    setLoad((current) => (current === "ready" ? "ready" : "loading"));
    void (async () => {
      try {
        const response = await fetch(`/api/workday/search?role=${encodeURIComponent(roleId)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as SearchPayload;
        if (cancelled) return;
        setPayload(body);
        setLoad("ready");
      } catch {
        if (cancelled) return;
        setLoad((current) => (current === "ready" ? "ready" : "failed"));
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [open, roleId, attempt]);

  /* ---- Stored lists, reconciled against the scope --------------------- */
  const entries = useMemo(() => payload?.entries ?? [], [payload]);
  const shownPinned = useMemo(() => (payload ? reconcileStored(pinned, entries) : []), [payload, pinned, entries]);
  const shownRecent = useMemo(
    () =>
      payload
        ? reconcileStored(recent, entries).filter((item) => !isPinned(shownPinned, item))
        : [],
    [payload, recent, entries, shownPinned],
  );

  /* ---- The sections, which are also the keyboard order ---------------- */
  const sections = useMemo<Section[]>(() => {
    if (!payload) return [];
    const terms = queryTerms(query);
    const out: Section[] = [];

    const commands = payload.commands.filter((command) => {
      if (kind !== null) return false;
      if (terms.length === 0) return true;
      const haystack = normaliseForSearch(`${command.label} ${command.keywords} ${command.detail ?? ""}`);
      return terms.every((term) => haystack.includes(term));
    });

    if (terms.length === 0 && kind === null) {
      if (shownPinned.length > 0) {
        out.push({
          id: "pinned",
          label: say(SEARCH_COPY.pinned, language),
          more: 0,
          options: shownPinned.map((item) => ({ type: "stored", key: `pinned:${item.kind}:${item.id}`, item, list: "pinned" })),
        });
      }
      if (shownRecent.length > 0) {
        out.push({
          id: "recent",
          label: say(SEARCH_COPY.recent, language),
          more: 0,
          options: shownRecent.map((item) => ({ type: "stored", key: `recent:${item.kind}:${item.id}`, item, list: "recent" })),
        });
      }
    }

    if (commands.length > 0) {
      out.push({
        id: "commands",
        label: say(SEARCH_COPY.commands, language),
        more: 0,
        options: commands.map((command) => ({ type: "command", key: `command:${command.id}`, command })),
      });
    }

    for (const group of searchEntries(entries, query, { kindOrder: payload.kindOrder, language, kind })) {
      out.push({
        id: `kind-${group.kind}`,
        label: group.label,
        more: group.total - group.hits.length,
        options: group.hits.map((entry) => ({ type: "entry", key: `entry:${entry.kind}:${entry.id}`, entry })),
      });
    }

    return out;
  }, [payload, query, kind, entries, shownPinned, shownRecent, language]);

  const options = useMemo(() => sections.flatMap((section) => section.options), [sections]);

  useEffect(() => setActive(0), [query, kind]);
  useEffect(() => {
    setActive((current) => (current >= options.length ? 0 : current));
  }, [options.length]);

  const activeOption = options[active] ?? null;
  const activeId = activeOption ? `${listId}-${activeOption.key}` : undefined;

  useEffect(() => {
    if (!activeId) return;
    const node = document.getElementById(activeId);
    node?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  /* ---- Running an option ---------------------------------------------- */
  const go = useCallback(
    (href: string, item: StoredSearchItem | null) => {
      if (item) {
        const next = rememberRecent(readList("recent", roleId), item);
        writeList("recent", roleId, next);
        setRecent(next);
      }
      close();
      router.push(href);
    },
    [close, roleId, router],
  );

  const run = useCallback(
    (option: Option | null) => {
      if (!option) return;
      if (option.type === "entry") return go(option.entry.href, toStored(option.entry));
      if (option.type === "stored") return go(option.item.href, option.item);

      const { command } = option;
      if (!command.available) return;
      switch (command.action.kind) {
        case "navigate":
          return go(command.action.href, null);
        case "search":
          setKind(command.action.searchKind);
          setQuery("");
          inputRef.current?.focus();
          return;
        case "ask-ai": {
          const trigger = returnFocus.current;
          close();
          // The dock's own open control. Nothing about the dock is changed here.
          if (!chrome.dockOpen) chrome.toggleDock(trigger);
          return;
        }
        case "evidence": {
          if (bound && bound.evidence.length > 0) {
            const trigger = returnFocus.current;
            close();
            chrome.openDrawer("evidence", trigger);
            return;
          }
          setKind("evidence");
          setQuery("");
          inputRef.current?.focus();
          return;
        }
      }
    },
    [bound, chrome, close, go],
  );

  const pinTarget = activeOption ? optionTarget(activeOption) : null;
  const pinItem: StoredSearchItem | null =
    activeOption?.type === "entry"
      ? toStored(activeOption.entry)
      : activeOption?.type === "stored"
        ? activeOption.item
        : null;
  const pinnedNow = pinTarget ? isPinned(shownPinned, pinTarget) : false;

  const togglePin = useCallback(() => {
    if (!pinItem) return;
    const next = togglePinned(readList("pinned", roleId), pinItem);
    writeList("pinned", roleId, next);
    setPinned(next);
    inputRef.current?.focus();
  }, [pinItem, roleId]);

  /* ---- Keyboard -------------------------------------------------------- */
  const onKeyDown = (event: React.KeyboardEvent) => {
    const count = Math.max(options.length, 1);
    switch (event.key) {
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        if (kind !== null || query.length > 0) {
          setKind(null);
          setQuery("");
          inputRef.current?.focus();
        } else {
          close();
        }
        return;
      case "ArrowDown":
        event.preventDefault();
        setActive((current) => (current + 1) % count);
        return;
      case "ArrowUp":
        event.preventDefault();
        setActive((current) => (current - 1 + count) % count);
        return;
      case "Home":
        if (event.target !== inputRef.current || query.length === 0) {
          event.preventDefault();
          setActive(0);
        }
        return;
      case "End":
        if (event.target !== inputRef.current || query.length === 0) {
          event.preventDefault();
          setActive(Math.max(options.length - 1, 0));
        }
        return;
      case "Enter":
        if (event.target === inputRef.current) {
          event.preventDefault();
          run(activeOption);
        }
        return;
      case "Backspace":
        if (event.target === inputRef.current && query.length === 0 && kind !== null) {
          event.preventDefault();
          setKind(null);
        }
        return;
      case "Tab": {
        /* Focus stays inside the dialog. */
        const root = dialogRef.current;
        if (!root) return;
        const focusable = Array.from(
          root.querySelectorAll<HTMLElement>("input, button:not([disabled])"),
        ).filter((node) => node.tabIndex >= 0);
        if (focusable.length === 0) return;
        const index = focusable.indexOf(document.activeElement as HTMLElement);
        const next = event.shiftKey
          ? (index - 1 + focusable.length) % focusable.length
          : (index + 1) % focusable.length;
        event.preventDefault();
        focusable[next]?.focus();
        return;
      }
      default:
        return;
    }
  };

  if (!open) return null;

  const scopeLine = payload
    ? payload.entityLabel
      ? fill(say(SEARCH_COPY.scope, language), { role: payload.roleLabel, entity: payload.entityLabel })
      : fill(say(SEARCH_COPY.scopeNoEntity, language), { role: payload.roleLabel })
    : null;

  const placeholder =
    kind === null
      ? say(SEARCH_COPY.placeholder, language)
      : fill(say(SEARCH_COPY.placeholderKind, language), { kind: say(KIND_LABELS[kind], language) });

  const terms = queryTerms(query);
  const noResults = load === "ready" && options.length === 0;
  const resultCount = sections
    .filter((section) => section.id.startsWith("kind-"))
    .reduce((total, section) => total + section.options.length + section.more, 0);

  return (
    <div
      className="wd-cmd-scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={dialogRef}
        className="wd-cmd"
        role="dialog"
        aria-modal="true"
        aria-label={say(SEARCH_COPY.dialog, language)}
        lang={language}
        onKeyDown={onKeyDown}
        data-testid="command-palette"
      >
        <div className="wd-cmd-input-row">
          <IconSearch size={18} stroke={1.8} aria-hidden="true" className="wd-shrink-0 wd-muted" />
          {kind !== null ? (
            <button
              type="button"
              className="wd-cmd-kind-chip"
              onClick={() => {
                setKind(null);
                inputRef.current?.focus();
              }}
              aria-label={`${say(KIND_SINGULAR[kind], language)}. ${say(SEARCH_COPY.clearKind, language)}`}
              data-testid="command-palette-kind"
            >
              {say(KIND_LABELS[kind], language)}
              <IconX size={12} stroke={2} aria-hidden="true" />
            </button>
          ) : null}
          <input
            ref={inputRef}
            className="wd-cmd-input"
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            aria-label={placeholder}
            autoComplete="off"
            spellCheck={false}
            placeholder={placeholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button type="button" className="wd-icon-btn" onClick={close} aria-label={say(SEARCH_COPY.close, language)}>
            <IconX size={16} stroke={2} aria-hidden="true" />
          </button>
        </div>

        {scopeLine ? (
          <p className="wd-cmd-scope" data-testid="command-palette-scope">
            {scopeLine}
          </p>
        ) : null}

        {/* Results, announced politely as the count changes. */}
        <span className="wd-sr-only" role="status" aria-live="polite">
          {terms.length > 0 && load === "ready" ? fill(say(SEARCH_COPY.results, language), { count: resultCount }) : ""}
        </span>

        <div ref={listRef} className="wd-cmd-list" id={listId} role="listbox" aria-label={say(SEARCH_COPY.dialog, language)}>
          {load === "loading" && !payload ? (
            <div className="wd-cmd-empty" role="presentation">
              {say(SEARCH_COPY.loading, language)}
            </div>
          ) : null}

          {load === "failed" && !payload ? (
            <div className="wd-cmd-empty" role="presentation">
              <span>{say(SEARCH_COPY.unavailable, language)}</span>
            </div>
          ) : null}

          {noResults ? (
            <div className="wd-cmd-empty" role="presentation" data-testid="command-palette-empty">
              {kind !== null && terms.length === 0
                ? fill(say(SEARCH_COPY.noneOfKind, language), { kind: say(KIND_LABELS[kind], language) })
                : fill(say(SEARCH_COPY.noMatch, language), { query: query.trim() })}
            </div>
          ) : null}

          {sections.map((section) => {
            const headingId = `${listId}-${section.id}`;
            return (
              <div key={section.id} role="group" aria-labelledby={headingId} data-section={section.id}>
                <div id={headingId} className="wd-cmd-group" role="presentation">
                  <span>{section.label}</span>
                  {section.more > 0 ? (
                    <span className="wd-cmd-more">{fill(say(SEARCH_COPY.more, language), { count: section.more })}</span>
                  ) : null}
                </div>
                {section.options.map((option) => {
                  const index = options.indexOf(option);
                  return (
                    <OptionRow
                      key={option.key}
                      id={`${listId}-${option.key}`}
                      option={option}
                      active={index === active}
                      language={language}
                      pinned={(() => {
                        const target = optionTarget(option);
                        return target ? isPinned(shownPinned, target) : false;
                      })()}
                      evidenceFor={option.type === "command" && option.command.id === "open-evidence" && bound && bound.evidence.length > 0 ? bound.title : null}
                      onHover={() => setActive(index)}
                      onRun={() => run(option)}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="wd-cmd-foot">
          <span className="wd-cmd-hint">{say(SEARCH_COPY.hint, language)}</span>
          <span className="wd-grow" />
          {load === "failed" && !payload ? (
            <button type="button" className="wd-btn wd-btn-secondary wd-btn-sm" onClick={() => setAttempt((value) => value + 1)}>
              {say(SEARCH_COPY.retry, language)}
            </button>
          ) : null}
          {pinItem ? (
            <button
              type="button"
              className="wd-btn wd-btn-quiet wd-btn-sm"
              onClick={togglePin}
              aria-pressed={pinnedNow}
              data-testid="command-palette-pin"
            >
              {pinnedNow ? (
                <IconPinnedOff size={14} stroke={1.8} aria-hidden="true" />
              ) : (
                <IconPin size={14} stroke={1.8} aria-hidden="true" />
              )}
              {fill(say(pinnedNow ? SEARCH_COPY.unpin : SEARCH_COPY.pin, language), { label: pinItem.reference })}
            </button>
          ) : null}
        </div>
        <p className="wd-cmd-note">{say(SEARCH_COPY.storedNote, language)}</p>
      </div>
    </div>
  );
}

function OptionRow({
  id,
  option,
  active,
  language,
  pinned,
  evidenceFor,
  onHover,
  onRun,
}: {
  id: string;
  option: Option;
  active: boolean;
  language: Language;
  pinned: boolean;
  evidenceFor: string | null;
  onHover: () => void;
  onRun: () => void;
}) {
  if (option.type === "command") {
    const { command } = option;
    const detail = evidenceFor
      ? fill(say(SEARCH_COPY.evidenceFor, language), { title: evidenceFor })
      : command.available
        ? command.detail
        : command.unavailableReason;
    return (
      <div
        id={id}
        role="option"
        aria-selected={active}
        aria-disabled={!command.available || undefined}
        className="wd-cmd-option"
        data-active={active || undefined}
        data-command={command.id}
        onMouseMove={onHover}
        onClick={onRun}
      >
        <span className="wd-cmd-icon" aria-hidden="true">
          {command.action.kind === "ask-ai" ? (
            <IconSparkles size={16} stroke={1.8} />
          ) : (
            <IconArrowRight size={16} stroke={1.8} />
          )}
        </span>
        <span className="wd-cmd-main">
          <span className="wd-cmd-title">{command.label}</span>
          {detail ? <span className="wd-cmd-sub">{detail}</span> : null}
        </span>
      </div>
    );
  }

  const item =
    option.type === "entry"
      ? { kind: option.entry.kind, label: option.entry.label, reference: option.entry.reference, detail: option.entry.detail }
      : { kind: option.item.kind, label: option.item.label, reference: option.item.reference, detail: null };

  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      className="wd-cmd-option"
      data-active={active || undefined}
      data-kind={item.kind}
      onMouseMove={onHover}
      onClick={onRun}
    >
      <span className="wd-cmd-icon" aria-hidden="true">
        {option.type === "stored" && option.list === "recent" ? (
          <IconClock size={16} stroke={1.8} />
        ) : pinned ? (
          <IconPin size={16} stroke={1.8} />
        ) : (
          <IconArrowRight size={16} stroke={1.8} />
        )}
      </span>
      <span className="wd-cmd-main">
        <span className="wd-cmd-title">{item.label}</span>
        <span className="wd-cmd-sub">
          {[say(KIND_SINGULAR[item.kind], language), item.reference !== item.label ? item.reference : null, item.detail]
            .filter(Boolean)
            .join(", ")}
        </span>
      </span>
    </div>
  );
}
