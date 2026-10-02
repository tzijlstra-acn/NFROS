"use client";

/**
 * Workday V2 interactive primitives.
 *
 * The accessible behaviour that the rest of the V2 experience composes:
 * tabs, menus, drawers and expandable rows. Written against the WAI-ARIA
 * patterns directly rather than pulled from a component library, for two
 * reasons. The product already carries a deliberate no-framework constraint
 * for styling, and these four patterns are small enough that owning them is
 * cheaper than owning a dependency plus its styling escape hatches.
 *
 * Two behaviours here are load bearing and easy to get wrong, so they are
 * implemented once and reused everywhere.
 *
 * Focus return. A drawer and a menu both remember the element that opened
 * them and restore focus to it on close. Without that, closing an evidence
 * drawer drops the user at the top of the document and a keyboard user loses
 * their place in the list they were reading.
 *
 * Typing guard. Keyboard shortcuts must not fire while the user is typing.
 * The live day player binds Space, and a presenter typing a question into the
 * chat composer must not pause the day with every word.
 */

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { IconChevronDown, IconX } from "@tabler/icons-react";

/* ==========================================================================
   Shared helpers
   ========================================================================== */

/**
 * True when the event originated inside a text entry.
 *
 * Exported because the live day player and the command palette both need it
 * and they must agree. `isContentEditable` is included because the chat
 * composer may become a rich field later and a shortcut regression there
 * would be subtle.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable ||
    target.getAttribute("role") === "textbox"
  );
}

/** Focusable descendants, in document order, for focus trapping. */
function focusableWithin(root: HTMLElement): HTMLElement[] {
  return [
    ...root.querySelectorAll<HTMLElement>(
      'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
    ),
  ].filter((element) => element.offsetParent !== null || element === document.activeElement);
}

/** Closes on Escape and on a click outside. Shared by the menu and the drawer. */
function useDismiss(
  open: boolean,
  close: () => void,
  containerRef: React.RefObject<HTMLElement | null>,
  options: { outsideClick?: boolean } = {},
): void {
  const outsideClick = options.outsideClick ?? true;

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!outsideClick) return;
      const container = containerRef.current;
      if (container && event.target instanceof Node && !container.contains(event.target)) {
        close();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open, close, containerRef, outsideClick]);
}

/* ==========================================================================
   Tabs
   ========================================================================== */

export interface TabDefinition {
  id: string;
  label: string;
  /** Rendered after the label, typically a count. */
  badge?: ReactNode;
}

/**
 * An accessible tab list.
 *
 * Controlled, because the AI Partner needs to move the user to Suggestions
 * when one arrives and to Chat when they ask a question from somewhere else.
 * Arrow keys move between tabs and activate on move, which is the expected
 * behaviour for a tab set whose panels are cheap to render.
 */
export function Tabs({
  tabs,
  active,
  onChange,
  label,
}: {
  tabs: TabDefinition[];
  active: string;
  onChange: (id: string) => void;
  label: string;
}) {
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((tab) => tab.id === active);
    if (index < 0) return;

    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;

    event.preventDefault();
    const target = tabs[next];
    if (target) {
      onChange(target.id);
      // Move focus with selection so the arrow keys keep working.
      document.getElementById(`tab-${target.id}`)?.focus();
    }
  };

  return (
    <div className="app-tabs" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            id={`tab-${tab.id}`}
            role="tab"
            className="app-tab"
            aria-selected={selected}
            aria-controls={`panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
            {tab.badge ?? null}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({
  id,
  active,
  children,
}: {
  id: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <div
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      hidden={!active}
      tabIndex={0}
      style={{ outline: "none", minHeight: 0 }}
    >
      {active ? children : null}
    </div>
  );
}

/* ==========================================================================
   Menu
   ========================================================================== */

export interface MenuItemDefinition {
  id: string;
  label: string;
  /** Omitted for a plain action. Set for a radio or checkbox style item. */
  checked?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  hint?: string;
  href?: string;
  danger?: boolean;
  onSelect?: () => void;
}

export interface MenuGroup {
  label?: string;
  items: MenuItemDefinition[];
}

/**
 * A menu anchored to a trigger.
 *
 * Collapses the controls the previous top bar showed permanently: language,
 * mode, the Today versus future toggle, reset and the presentation links. They
 * are all still one click away, but they no longer each hold a slot in the bar
 * at every moment of the working day.
 */
export function Menu({
  trigger,
  groups,
  label,
  align = "right",
  width = 240,
}: {
  trigger: (props: {
    ref: React.Ref<HTMLButtonElement>;
    onClick: () => void;
    "aria-expanded": boolean;
    "aria-haspopup": "menu";
  }) => ReactNode;
  groups: MenuGroup[];
  label: string;
  align?: "left" | "right";
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
    triggerRef.current?.focus();
  }, []);

  useDismiss(open, close, containerRef);

  const flat = groups.flatMap((group) => group.items.filter((item) => !item.disabled));

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!open) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % flat.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + flat.length) % flat.length);
    } else if (event.key === "Enter" || event.key === " ") {
      const item = flat[activeIndex];
      if (item) {
        event.preventDefault();
        item.onSelect?.();
        close();
      }
    } else if (event.key === "Tab") {
      close();
    }
  };

  let runningIndex = -1;

  return (
    <div ref={containerRef} style={{ position: "relative" }} onKeyDown={onKeyDown}>
      {trigger({
        ref: triggerRef,
        onClick: () => setOpen((value) => !value),
        "aria-expanded": open,
        "aria-haspopup": "menu",
      })}

      {open ? (
        <div
          className="app-pop"
          role="menu"
          aria-label={label}
          style={{
            top: "calc(100% + 4px)",
            width,
            ...(align === "right" ? { right: 0 } : { left: 0 }),
          }}
        >
          {groups.map((group, groupIndex) => (
            <div key={group.label ?? groupIndex}>
              {groupIndex > 0 ? <div className="app-pop-sep" /> : null}
              {group.label ? <div className="app-pop-label">{group.label}</div> : null}
              {group.items.map((item) => {
                if (!item.disabled) runningIndex += 1;
                const index = runningIndex;
                const content = (
                  <>
                    {item.icon ? (
                      <span className="app-shrink-0" aria-hidden="true">
                        {item.icon}
                      </span>
                    ) : null}
                    <span className="app-truncate">{item.label}</span>
                    {item.hint ? <span className="app-cmd-hint">{item.hint}</span> : null}
                    {item.checked ? (
                      <span className="app-cmd-hint" aria-hidden="true">
                        on
                      </span>
                    ) : null}
                  </>
                );

                const shared = {
                  className: "app-pop-item",
                  role: item.checked === undefined ? "menuitem" : "menuitemradio",
                  "data-active": !item.disabled && index === activeIndex ? true : undefined,
                  ...(item.checked === undefined ? {} : { "aria-checked": item.checked }),
                  ...(item.danger ? { style: { color: "var(--app-danger-text)" } } : {}),
                } as const;

                return item.href ? (
                  <a key={item.id} {...shared} href={item.href} onClick={close}>
                    {content}
                  </a>
                ) : (
                  <button
                    key={item.id}
                    type="button"
                    {...shared}
                    disabled={item.disabled}
                    onClick={() => {
                      item.onSelect?.();
                      close();
                    }}
                  >
                    {content}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ==========================================================================
   Drawer
   ========================================================================== */

/**
 * A right hand drawer.
 *
 * This replaces the permanently wide intelligence rail. The information is
 * unchanged: evidence, why this matters, uncertainty, applicable policy,
 * approvals, activity and audit. What changed is that it no longer consumes
 * 372px of every screen at every moment, including the moments when the user
 * is reading a message or looking at a calendar.
 *
 * Focus is trapped while open and returned to the trigger on close.
 */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useDismiss(open, onClose, panelRef, { outsideClick: false });

  // Remember what to restore focus to before the panel takes it.
  useLayoutEffect(() => {
    if (open) {
      restoreRef.current = document.activeElement as HTMLElement | null;
    }
  }, [open]);

  /*
   * Depends on `mounted` as well as `open`, and restores focus from a cleanup.
   *
   * Both halves of this were broken, and both failures were silent.
   *
   * The portal does not exist on the first render, because `mounted` is still
   * false, so `panelRef.current` was null and the effect returned early.
   * `mounted` then flipped to true and the panel rendered, but `open` had not
   * changed, so the effect never ran again: focus stayed on the trigger,
   * outside the dialog, and the Tab trap never engaged because it only acts
   * once focus is already inside.
   *
   * Focus return never ran either, because the context drawer unmounts this
   * component rather than passing `open={false}`, so the `!open` branch was
   * unreachable. A cleanup runs on unmount, which is the case that actually
   * happens.
   */
  useEffect(() => {
    if (!open || !mounted) return;

    const panel = panelRef.current;
    if (!panel) return;
    const first = focusableWithin(panel)[0];
    (first ?? panel).focus();

    return () => {
      /*
       * Deferred by one frame, and checked for still being in the document.
       *
       * Calling focus synchronously in the cleanup did not work: the portal is
       * removed in the same commit, the browser resets focus to the body
       * afterwards, and the reset won. Measured, the active element after
       * Escape was `body` rather than the trigger. A frame later the DOM has
       * settled and the focus sticks.
       *
       * The connectivity check matters because the thing that closed the
       * drawer may also have replaced the subtree the trigger lived in, and
       * focusing a detached node throws away the user's position silently.
       */
      const restore = restoreRef.current;
      if (!restore) return;
      requestAnimationFrame(() => {
        if (restore.isConnected) restore.focus();
      });
    };
  }, [open, mounted]);

  // Trap Tab inside the panel while it is open.
  useEffect(() => {
    if (!open || !mounted) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = focusableWithin(panel);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open, mounted]);

  if (!open || !mounted) return null;

  return createPortal(
    <>
      <div className="app-drawer-scrim" onClick={onClose} aria-hidden="true" />
      <div
        className="app-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={panelRef}
        tabIndex={-1}
      >
        <div className="app-drawer-head">
          <div className="app-stack-1 app-grow">
            <span id={titleId} className="app-strong" style={{ fontSize: "var(--app-text-lg)" }}>
              {title}
            </span>
            {subtitle ? <span className="app-meta">{subtitle}</span> : null}
          </div>
          <button type="button" className="app-icon-btn" onClick={onClose} aria-label="Close">
            <IconX size={16} stroke={2} aria-hidden="true" />
          </button>
        </div>
        <div className="app-drawer-body">{children}</div>
        {footer ? <div className="app-partner-foot">{footer}</div> : null}
      </div>
    </>,
    document.body,
  );
}

/* ==========================================================================
   Expandable row
   ========================================================================== */

/**
 * A row that reveals detail.
 *
 * Used by the activity stream, where the compact view shows a time and a
 * label and the expanded view shows the object, the tool, the duration, the
 * outcome, the authority class and the audit reference. Keeping the technical
 * metadata behind this is what lets the default activity view stay readable.
 */
export function ExpandRow({
  summary,
  children,
  defaultOpen = false,
  label,
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  label: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <>
      <button
        type="button"
        className="app-activity-row"
        style={{ border: 0, background: "transparent", font: "inherit", width: "100%", cursor: "pointer", textAlign: "left" }}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
      >
        {summary}
      </button>
      {open ? (
        <div id={panelId} className="app-activity-detail">
          {children}
        </div>
      ) : null}
    </>
  );
}

/** A compact disclosure for a collapsed section, for example "Handled automatically". */
export function Disclosure({
  label,
  count,
  children,
  defaultOpen = false,
}: {
  label: string;
  count?: number;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div>
      <button
        type="button"
        className="app-btn app-btn-quiet app-btn-sm"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <IconChevronDown
          size={13}
          stroke={2}
          aria-hidden="true"
          style={{
            rotate: open ? "0deg" : "-90deg",
            transition: "rotate var(--app-t-control) var(--app-ease)",
          }}
        />
        {label}
        {count === undefined ? null : <span className="app-faint">{count}</span>}
      </button>
      {open ? (
        <div id={panelId} style={{ marginTop: "var(--app-2)" }}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

/* ==========================================================================
   Live region
   ========================================================================== */

/**
 * A polite announcer.
 *
 * Event arrival is announced politely so it does not interrupt. Focus is
 * never stolen for a non-critical arrival. The one case that may use an
 * assertive announcement is a critical decision arriving, and that is passed
 * explicitly rather than inferred.
 */
export function Announcer({
  message,
  assertive = false,
}: {
  message: string;
  assertive?: boolean;
}) {
  return (
    <div
      className="app-sr-only"
      role="status"
      aria-live={assertive ? "assertive" : "polite"}
      aria-atomic="true"
    >
      {message}
    </div>
  );
}
