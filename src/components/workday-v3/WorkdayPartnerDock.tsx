"use client";

/**
 * The AI Partner inside the V3.1 frame.
 *
 * It is the SAME dock V2 uses. `AIPartnerDock` already has exactly the three
 * tabs the brief asks for, suggestions, activity and chat, and `PartnerClient`
 * already carries the streaming, the citation handling and the rule that
 * `Approve` navigates to the decision flow rather than executing in place.
 * Rebuilding any of that for a lighter theme would have produced a second
 * implementation of the most safety relevant component in the product. The
 * token bridge in `workday-v3-tokens.css` is what lets the existing one
 * render light, by remapping the `app-*` token names inside this scope.
 *
 * Three things are V3 specific, and they are the whole reason this file
 * exists:
 *
 * ONE. The data arrives on open, not on page load. The dock is collapsed by
 * default here, so its data is fetched the first time it is wanted and then
 * kept. That is what keeps the role home a small document.
 *
 * TWO. The shell context is BRIDGED rather than provided fresh. The dock
 * reads the V2 shell context to open a citation in the host's context drawer.
 * With no provider `useShell` returns an inert shape, so a cited source would
 * compile and then do nothing. Here `openDrawer` forwards into the V3 chrome,
 * and the V2 drawer tabs are mapped onto the four V3 ones.
 *
 * THREE. It opens on the conversation. The brief requires that asking the
 * partner something lands in the conversation, not on a mode table or an
 * authority explanation. Those belong on the Trust surface, and the dock does
 * not carry them.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { IconSparkles, IconX } from "@tabler/icons-react";
import { focusFromLocation, focusKey } from "@/features/partner/focus";
import { PartnerClient, type PartnerClientProps } from "@/components/workday-v2/PartnerClient";
import {
  ShellContextValue,
  type DrawerTab,
  type ShellState,
} from "@/components/workday-v2/ShellContext";
import type { AIPartnerTabId } from "@/components/ai-partner/AIPartnerDock";
import type { Language } from "@/i18n/labels";
import { useWorkdayChrome, type WdDrawerTab } from "./ChromeContext";
import { useBoundContext } from "@/components/work/context-store";
import { formatSelectionParam, isSelectionType } from "@/workday/selection-url";

/**
 * The V2 drawer's six tabs onto the V3 drawer's four.
 *
 * Nothing is dropped. Uncertainty, policy and approvals were three top level
 * peers in the V2 rail and are three parts of one question, which is what the
 * item in front of the reader actually says, so they land on `details`.
 */
const DRAWER_TAB_MAP: Record<DrawerTab, WdDrawerTab> = {
  evidence: "evidence",
  uncertainty: "details",
  policy: "details",
  approvals: "details",
  activity: "activity",
  audit: "audit",
};

type PartnerPayload = Omit<PartnerClientProps, "presence" | "initialTab" | "onPartnerChanged">;

const COPY = {
  title: { en: "AI Partner", de: "KI Partner" },
  close: { en: "Close", de: "Schliessen" },
  loading: { en: "Opening the partner", de: "Partner wird geoeffnet" },
  failedTitle: { en: "The partner is not available", de: "Der Partner ist nicht verfuegbar" },
  failedBody: {
    en: "The rest of the workspace is unaffected. Close this and carry on, or try again.",
    de: "Der uebrige Arbeitsbereich ist nicht betroffen. Schliessen Sie dies und arbeiten Sie weiter, oder versuchen Sie es erneut.",
  },
  retry: { en: "Try again", de: "Erneut versuchen" },
} as const;

const pick = (pair: { en: string; de: string }, language: Language) =>
  language === "de" ? pair.de : pair.en;

export function WorkdayPartnerDock({
  language,
  roleId,
  initialTab = "chat",
}: {
  language: Language;
  roleId: string;
  /**
   * Where the dock lands.
   *
   * `chat` by default, because the brief requires that asking the partner
   * something opens the conversation directly. The header's prepared work
   * affordance passes `suggestions` instead.
   */
  initialTab?: AIPartnerTabId;
}) {
  const chrome = useWorkdayChrome();
  const [payload, setPayload] = useState<PartnerPayload | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  /* The Work Hub's bound selection, and the selection the payload was read for. */
  const bound = useBoundContext(roleId);
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const router = useRouter();
  const [hash, setHash] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  /*
   * What the person is looking at, from the workday's own addresses (plan
   * 4.11: selection updates context). The Work Hub binds its item; Home,
   * Processes and Decisions name theirs in the address, Decisions in the
   * hash, which it rewrites without a navigation, so the hash is re-read
   * after every click and hash change.
   */
  useEffect(() => {
    const read = () => setHash(window.location.hash);
    read();
    const onClick = () => window.setTimeout(read, 0);
    window.addEventListener("hashchange", read);
    window.addEventListener("popstate", read);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("hashchange", read);
      window.removeEventListener("popstate", read);
      document.removeEventListener("click", onClick, true);
    };
  }, [pathname]);

  const search = searchParams?.toString() ?? "";
  const focus = useMemo(
    () =>
      focusFromLocation(
        roleId,
        { pathname, search: search ? `?${search}` : "", hash },
        bound ? { kind: bound.kind, itemId: bound.itemId, selection: bound.ai.selection ? { objectType: bound.ai.selection.objectType, objectId: bound.ai.selection.objectId } : null } : null,
        null,
      ),
    [roleId, pathname, search, hash, bound],
  );

  /*
   * The selection the dock reads with. The Work Hub's bound selection, else a
   * Home or Decisions selection, so the conversation and the suggestion
   * follow the object on screen everywhere, not only in Work.
   */
  const selectionParam = bound?.ai.selection
    ? formatSelectionParam(bound.ai.selection)
    : focus.surface !== "work" && focus.selection && isSelectionType(focus.selection.objectType)
      ? `${focus.selection.objectType}:${focus.selection.objectId}`
      : "";
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const loadKey = `${selectionParam}|${reloadToken}`;

  /*
   * Keep the durable context, settle answered suggestions and run what the
   * scenario clock has made due (`/api/workday/partner/sync`). On every focus
   * change, and once a minute while the page is visible, because the clock
   * can move without a navigation. Runs whether or not the dock was ever
   * opened: routines are the product's work, not the panel's.
   */
  const focusSignature = focusKey(focus);
  const lastSync = useRef<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const sync = async (force: boolean) => {
      if (!force && lastSync.current === focusSignature) return;
      lastSync.current = focusSignature;
      try {
        const response = await fetch("/api/workday/partner/sync", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ roleId, focus }),
          cache: "no-store",
        });
        if (!response.ok || cancelled) return;
        const body = (await response.json()) as { changed?: boolean };
        if (body.changed && !cancelled) {
          setReloadToken((value) => value + 1);
          router.refresh();
        }
      } catch {
        // The frame keeps working without the Partner's sync; the next one catches up.
      }
    };
    void sync(false);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void sync(true);
    }, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
    // The focus object is rebuilt on render; its signature is what changes.
  }, [roleId, focusSignature, router]);

  /*
   * Fetched once and kept. Closing the dock and opening it again must not
   * discard a conversation the user is in the middle of, so the payload is
   * held here rather than in the panel, and the panel's open state only
   * controls what is on screen. `PartnerClient` stays mounted for the same
   * reason: unmounting it would drop its transcript and its subscription.
   */
  const open = chrome.panel === "dock";

  /*
   * Whether the dock has EVER been open, which is what decides if it is in
   * the tree at all.
   *
   * Three states, not two. Never opened means render nothing, so a reader who
   * does not ask for the partner never pays for it. Open means on screen.
   * Opened and then closed means still mounted and hidden, because the
   * transcript and the event subscription live inside `PartnerClient` and
   * unmounting it would throw away a conversation the user is in the middle
   * of, every time they closed the panel to look at the queue behind it.
   */
  const [everOpened, setEverOpened] = useState(false);
  useEffect(() => {
    if (open) setEverOpened(true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    /*
     * The guard is the payload itself, not a ref that records having started.
     *
     * A ref was the first attempt and it failed in a way worth recording:
     * `reactStrictMode` is on, so React invokes an effect twice on mount and
     * runs the cleanup in between. The first pass set the ref and started the
     * fetch, the cleanup aborted it, and the second pass saw the ref already
     * set and returned without fetching anything. The dock sat on `Opening
     * the partner` forever, with a route handler that answered correctly in
     * 425ms. Keying on state means both passes attempt it, the first is
     * aborted, the second completes, and once there is a payload the effect
     * re-runs and does nothing.
     */
    /*
     * The payload is also re-read when the bound work selection changes, so
     * the partner's context follows what the reader selected in the Work Hub.
     * The new payload replaces the old one in place: `PartnerClient` is not
     * remounted, so the conversation and the subscription survive, and its
     * chat reads the selection at send time. The selection travels in the
     * `selection` parameter the partner route already parses.
     */
    if (payload !== null && loadedFor === loadKey) return;
    if (failed) return;

    const controller = new AbortController();
    let cancelled = false;
    const hadPayload = payload !== null;

    void (async () => {
      try {
        const response = await fetch(
          `/api/workday/partner?role=${encodeURIComponent(roleId)}${
            selectionParam ? `&selection=${encodeURIComponent(selectionParam)}` : ""
          }`,
          { signal: controller.signal, cache: "no-store" },
        );
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as PartnerPayload;
        if (cancelled) return;
        setPayload(body);
        setLoadedFor(loadKey);
        setFailed(false);
      } catch {
        /*
         * A dock that cannot load is a dock that cannot load. It must not
         * take the workspace with it, and it must not report a reason it
         * cannot stand behind, so the user is told plainly that this one
         * panel is unavailable. A failed refresh for a new selection keeps
         * the conversation on screen rather than replacing it with an error.
         */
        if (cancelled) return;
        if (hadPayload) setLoadedFor(loadKey);
        else setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [open, roleId, attempt, payload, failed, selectionParam, loadedFor, loadKey]);

  /* After an answer or feedback, the dock re-reads its data in place; the conversation stays. */
  const onPartnerChanged = useCallback(() => setReloadToken((value) => value + 1), []);

  /*
   * The bridge. `openDrawer` is the only member the dock uses that has to
   * reach outside itself; the rest describe chrome the V3 frame does not have
   * and are inert on purpose rather than by omission.
   */
  const bridged = useMemo<ShellState>(
    () => ({
      railExpanded: chrome.navExpanded,
      toggleRail: chrome.toggleNav,
      partnerOpen: chrome.dockOpen,
      setPartnerOpen: (open: boolean) => {
        if (!open) chrome.closePanel();
      },
      togglePartner: chrome.toggleDock,
      drawerTab: null,
      openDrawer: (tab: DrawerTab, trigger?: HTMLElement | null) => {
        chrome.openDrawer(DRAWER_TAB_MAP[tab], trigger ?? null);
      },
      closeDrawer: chrome.closePanel,
      commandOpen: chrome.commandOpen,
      setCommandOpen: chrome.setCommandOpen,
      narrow: false,
    }),
    [chrome],
  );

  const retry = useCallback(() => {
    setFailed(false);
    setAttempt((value) => value + 1);
  }, []);

  if (!everOpened) return null;

  return (
    <aside
      className="wd-panel wd-panel-dock"
      role="dialog"
      aria-modal="false"
      aria-label={pick(COPY.title, language)}
      data-presentation-region="ai-partner-dock"
      data-presentation-ready={payload ? "true" : undefined}
      /*
       * Hidden rather than removed when closed. `hidden` takes it out of the
       * accessibility tree and out of the tab order, which is what a closed
       * panel owes a keyboard and screen reader user, while the component
       * tree underneath it survives with the conversation in it.
       */
      hidden={!open}
      style={{ width: "var(--wd-dock-w)" }}
    >
      <div className="wd-panel-head">
        <span className="wd-row wd-grow">
          <IconSparkles size={16} stroke={1.8} aria-hidden="true" />
          <span className="wd-strong">{pick(COPY.title, language)}</span>
        </span>
        <button
          type="button"
          className="wd-icon-btn"
          onClick={chrome.closePanel}
          aria-label={pick(COPY.close, language)}
        >
          <IconX size={18} stroke={2} aria-hidden="true" />
        </button>
      </div>

      <div className="wd-panel-body wd-panel-body-flush">
        {failed ? (
          <div className="wd-empty">
            <span className="wd-empty-title">{pick(COPY.failedTitle, language)}</span>
            <span>{pick(COPY.failedBody, language)}</span>
            <button
              type="button"
              className="wd-btn wd-btn-secondary wd-btn-sm"
              onClick={retry}
              style={{ marginTop: "var(--wd-3)", alignSelf: "flex-start" }}
            >
              {pick(COPY.retry, language)}
            </button>
          </div>
        ) : payload ? (
          <ShellContextValue.Provider value={bridged}>
            <PartnerClient {...payload} initialTab={initialTab} showPosture={false} onPartnerChanged={onPartnerChanged} />
          </ShellContextValue.Provider>
        ) : (
          <div className="wd-empty" aria-busy="true">
            <span role="status">{pick(COPY.loading, language)}</span>
          </div>
        )}
      </div>
    </aside>
  );
}
