"use client";

/**
 * The Updates panel, opened from the header bell and the bottom bar.
 *
 * Before this existed both controls toggled `updatesOpen` in the chrome, and
 * nothing rendered it (audit J28). It now opens a list read from the event
 * backbone through `readUpdates`, the same read the header count comes from,
 * so the number on the bell is the number of rows the panel opens on.
 *
 * What it shows, and what it deliberately does not:
 *
 *   The raised updates, in the budget's priority order, each with its kind,
 *   what needs the person, where it is, and a link to the surface where the
 *   work is done.
 *
 *   What the notification budget held back, behind a disclosure that says how
 *   many and why. Nothing is silently dropped.
 *
 *   A Mark as read control on arrivals only. Every other update is a state
 *   that clears when its work is done; offering to dismiss a decision the
 *   person has not taken would be offering to hide work.
 *
 * The list is read again every time the panel opens. When it no longer agrees
 * with the count the header was rendered with (the day moved on, or a write
 * elsewhere changed it), the route is refreshed so the header catches up,
 * rather than the two silently disagreeing.
 */

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconChevronDown, IconX } from "@tabler/icons-react";
import type { Language } from "@/i18n/labels";
import { useWorkdayChrome } from "@/components/workday-v3/ChromeContext";
import {
  CATEGORY_LABELS,
  countLabel,
  fill,
  say,
  UPDATES_COPY,
  type UpdateCategory,
  type UpdateItem,
  type UpdatesView,
} from "@/features/updates";
import { actionMarkUpdateRead } from "@/features/updates/actions";
import "./shell.css";

const CATEGORY_TONE: Record<UpdateCategory, "danger" | "warning" | "accent" | "info" | undefined> = {
  "execution-failed": "danger",
  "process-blocked": "warning",
  "human-input-required": "accent",
  "deadline-approaching": "warning",
  "material-change": "info",
  "routine-created-work": undefined,
};

type LoadState = "idle" | "loading" | "ready" | "failed";

export function UpdatesPanel({
  roleId,
  language,
  renderedCount,
}: {
  roleId: string;
  language: Language;
  /** The count the header and the bottom bar were server rendered with. */
  renderedCount: number;
}) {
  const chrome = useWorkdayChrome();
  const router = useRouter();
  const [view, setView] = useState<UpdatesView | null>(null);
  const [load, setLoad] = useState<LoadState>("idle");
  const [attempt, setAttempt] = useState(0);
  const [showHeld, setShowHeld] = useState(false);
  const [pending, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const open = chrome.updatesOpen;

  const close = useCallback(() => {
    if (chrome.updatesOpen) chrome.toggleUpdates();
    const target = returnFocus.current;
    returnFocus.current = null;
    requestAnimationFrame(() => {
      if (target && target.isConnected) target.focus();
    });
  }, [chrome]);

  useEffect(() => {
    if (!open) return;
    if (returnFocus.current === null && document.activeElement instanceof HTMLElement) {
      returnFocus.current = document.activeElement;
    }
    requestAnimationFrame(() => panelRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    let cancelled = false;
    setLoad((current) => (current === "ready" ? "ready" : "loading"));
    void (async () => {
      try {
        const response = await fetch(`/api/workday/updates?role=${encodeURIComponent(roleId)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as UpdatesView;
        if (cancelled) return;
        setView(body);
        setLoad("ready");
        if (body.raised.length !== renderedCount) router.refresh();
      } catch {
        if (cancelled) return;
        setLoad((current) => (current === "ready" ? "ready" : "failed"));
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
    /*
     * A new rendered count arrives with the refresh this triggers, which reads
     * the list once more and then agrees with it, so this settles in one step.
     */
  }, [open, roleId, attempt, renderedCount, router]);

  /* Escape closes, and a click outside the panel and its triggers closes. */
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target || panelRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest("[data-updates-trigger]")) return;
      close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, close]);

  const markRead = (item: UpdateItem) => {
    if (!item.readableEventId) return;
    const eventId = item.readableEventId;
    startTransition(async () => {
      const result = await actionMarkUpdateRead(roleId, eventId);
      if (result.ok) setAttempt((value) => value + 1);
    });
  };

  if (!open) return null;

  const raised = view?.raised ?? [];
  const held = view?.heldBack ?? [];

  return (
    <div
      ref={panelRef}
      className="wd-updates-panel"
      role="dialog"
      aria-modal="false"
      aria-label={say(UPDATES_COPY.title, language)}
      lang={language}
      tabIndex={-1}
      data-testid="updates-panel"
      data-state={view?.state ?? load}
    >
      <div className="wd-panel-head">
        <span className="wd-row wd-grow">
          <span className="wd-strong">{say(UPDATES_COPY.title, language)}</span>
          {view && view.state === "present" ? (
            <span className="wd-meta" data-testid="updates-panel-count">
              {countLabel(raised.length, language)}
            </span>
          ) : null}
        </span>
        <button type="button" className="wd-icon-btn" onClick={close} aria-label={say(UPDATES_COPY.close, language)}>
          <IconX size={18} stroke={2} aria-hidden="true" />
        </button>
      </div>

      <div className="wd-updates-body" aria-busy={pending || (load === "loading" && !view) || undefined}>
        {load === "loading" && !view ? (
          <div className="wd-empty">
            <span role="status">{say(UPDATES_COPY.loading, language)}</span>
          </div>
        ) : null}

        {(load === "failed" && !view) || view?.state === "unavailable" ? (
          <div className="wd-empty" data-testid="updates-unavailable">
            <span>{say(UPDATES_COPY.unavailable, language)}</span>
            <button
              type="button"
              className="wd-btn wd-btn-secondary wd-btn-sm"
              style={{ alignSelf: "flex-start", marginTop: "var(--wd-2)" }}
              onClick={() => setAttempt((value) => value + 1)}
            >
              {say(UPDATES_COPY.retry, language)}
            </button>
          </div>
        ) : null}

        {view && view.state === "empty" ? (
          <div className="wd-empty" data-testid="updates-empty">
            <span className="wd-empty-title">{say(UPDATES_COPY.emptyTitle, language)}</span>
            <span>{say(UPDATES_COPY.emptyBody, language)}</span>
          </div>
        ) : null}

        {raised.length > 0 ? (
          <ul className="wd-update-list" data-testid="updates-raised">
            {raised.map((item) => (
              <UpdateRow key={item.key} item={item} language={language} onOpen={close} onMarkRead={markRead} pending={pending} />
            ))}
          </ul>
        ) : null}

        {held.length > 0 ? (
          <div className="wd-update-held">
            <button
              type="button"
              className="wd-disclosure"
              aria-expanded={showHeld}
              onClick={() => setShowHeld((value) => !value)}
              data-testid="updates-held-toggle"
            >
              <IconChevronDown size={14} stroke={2} aria-hidden="true" className="wd-disclosure-chevron" />
              {fill(say(UPDATES_COPY.heldBack, language), { count: held.length })}
            </button>
            {showHeld ? (
              <ul className="wd-update-list" data-testid="updates-held">
                {held.map((item) => (
                  <UpdateRow key={item.key} item={item} language={language} onOpen={close} onMarkRead={markRead} pending={pending} />
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      {view && view.state !== "unavailable" ? (
        <div className="wd-updates-foot">
          <p className="wd-meta" style={{ margin: 0 }}>
            {fill(say(UPDATES_COPY.budgetNote, language), {
              total: view.budget.total,
              perCategory: view.budget.perCategory,
            })}{" "}
            {say(UPDATES_COPY.stateNote, language)}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function UpdateRow({
  item,
  language,
  onOpen,
  onMarkRead,
  pending,
}: {
  item: UpdateItem;
  language: Language;
  onOpen: () => void;
  onMarkRead: (item: UpdateItem) => void;
  pending: boolean;
}) {
  return (
    <li className="wd-update-row" data-category={item.category} data-origin={item.origin}>
      <span className="wd-chip" data-tone={CATEGORY_TONE[item.category]}>
        {say(CATEGORY_LABELS[item.category], language)}
      </span>
      <Link href={item.href} className="wd-update-title" onClick={onOpen}>
        {item.title}
      </Link>
      {item.detail || item.when ? (
        <span className="wd-update-sub">
          {[item.when, item.detail].filter(Boolean).join(", ")}
        </span>
      ) : null}
      {item.readableEventId ? (
        <button
          type="button"
          className="wd-btn wd-btn-link wd-btn-sm wd-update-read"
          onClick={() => onMarkRead(item)}
          disabled={pending}
        >
          {say(UPDATES_COPY.markRead, language)}
        </button>
      ) : null}
    </li>
  );
}
