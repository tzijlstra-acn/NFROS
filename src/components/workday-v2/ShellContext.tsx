"use client";

/**
 * Shell chrome state.
 *
 * Four pieces of state that several parts of the interface need to read and
 * write, and that do not belong in the URL because they are about the shape of
 * the chrome rather than about what the user is looking at: whether the
 * navigation rail is expanded, whether the AI Partner is open, whether the
 * context drawer is open and on which tab, and whether the command palette is
 * showing.
 *
 * It is a context rather than props because the triggers and the surfaces are
 * far apart in the tree. The "Evidence 7" trigger sits inside a role workspace
 * in the centre column; the drawer it opens is a portal at the document root.
 * Threading a callback from one to the other through the workspace components
 * would couple every workspace to the shell for no benefit.
 *
 * Deliberately NOT in here: the scenario clock, the acting role, the autonomy
 * level, the selected object. Those are real state with consequences, they live
 * in the database, and the server is their only owner. Putting any of them in a
 * client context would create a second truth that could disagree with the gate,
 * and showing a higher autonomy level than the gate is enforcing is the worst
 * lie this product could tell.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export const DRAWER_TABS = ["evidence", "uncertainty", "policy", "approvals", "activity", "audit"] as const;
export type DrawerTab = (typeof DRAWER_TABS)[number];

export interface ShellState {
  railExpanded: boolean;
  toggleRail: () => void;

  partnerOpen: boolean;
  setPartnerOpen: (open: boolean) => void;
  togglePartner: () => void;

  drawerTab: DrawerTab | null;
  /**
   * Opens the drawer, and remembers the control that opened it.
   *
   * The element is passed in rather than read from `document.activeElement`
   * inside the drawer. Capturing it there depended on the active element
   * still being the trigger at the moment the portal mounted, and it was not
   * reliable: focus returned to `body` after Escape, which drops a keyboard
   * user at the top of the document and loses their place in the list they
   * were reading. The caller knows which control it is, so the caller says.
   */
  openDrawer: (tab: DrawerTab, trigger?: HTMLElement | null) => void;
  closeDrawer: () => void;

  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;

  /** True at the narrowest projected width, where the partner is a rail. */
  narrow: boolean;
}

/*
 * Exported so the V3.1 frame can provide a BRIDGED value rather than a second
 * provider with its own state.
 *
 * The AI Partner dock and everything it contains read this context for one
 * thing that matters outside themselves: opening a citation has to open the
 * host's context drawer. `useShell` returns an inert shape when there is no
 * provider, so the dock mounts happily inside the V3 tree, but `openDrawer`
 * would be a no op and a cited source would silently do nothing. Providing a
 * value whose `openDrawer` forwards to the V3 chrome is what makes the reuse
 * honest instead of merely compiling.
 */
export const ShellContextValue = createContext<ShellState | null>(null);

/**
 * Reads a boolean preference once, from local storage.
 *
 * Chrome shape is a per-operator preference, not product state, so it belongs
 * in the browser. Read lazily inside the initialiser so the server render and
 * the first client render agree: reading during module evaluation would throw
 * during server rendering, and reading in an effect would flash the default.
 */
function storedBoolean(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : raw === "1";
  } catch {
    return fallback;
  }
}

function storeBoolean(key: string, value: boolean): void {
  try {
    window.localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // A browser with storage disabled loses the preference and nothing else.
  }
}

const RAIL_KEY = "nfr.workday.rail-expanded";
const PARTNER_KEY = "nfr.workday.partner-open";

/** The width below which the partner becomes a presence rail. */
const NARROW_BREAKPOINT = 1366;

export function ShellProvider({ children }: { children: ReactNode }) {
  /*
   * Both start at their server-rendered default and are corrected after mount.
   * Initialising from local storage directly would produce a hydration
   * mismatch, because the server cannot know the stored value.
   */
  const [railExpanded, setRailExpanded] = useState(false);
  const [partnerOpen, setPartnerOpen] = useState(true);
  const [drawerTab, setDrawerTab] = useState<DrawerTab | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    setRailExpanded(storedBoolean(RAIL_KEY, false));

    const query = window.matchMedia(`(max-width: ${NARROW_BREAKPOINT}px)`);
    const applyWidth = () => {
      setNarrow(query.matches);
      /*
       * At the narrowest size the partner starts closed, because the
       * acceptance criterion is that the work object remains the largest
       * area and no control is clipped. The user can still open it, and that
       * choice is remembered.
       */
      setPartnerOpen(storedBoolean(PARTNER_KEY, !query.matches));
    };

    applyWidth();
    query.addEventListener("change", applyWidth);
    return () => query.removeEventListener("change", applyWidth);
  }, []);

  const toggleRail = useCallback(() => {
    setRailExpanded((value) => {
      storeBoolean(RAIL_KEY, !value);
      return !value;
    });
  }, []);

  const setPartner = useCallback((open: boolean) => {
    storeBoolean(PARTNER_KEY, open);
    setPartnerOpen(open);
  }, []);

  const togglePartner = useCallback(() => {
    setPartnerOpen((value) => {
      storeBoolean(PARTNER_KEY, !value);
      return !value;
    });
  }, []);

  const drawerTrigger = useRef<HTMLElement | null>(null);

  const openDrawer = useCallback((tab: DrawerTab, trigger?: HTMLElement | null) => {
    if (trigger !== undefined) drawerTrigger.current = trigger;
    setDrawerTab(tab);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerTab(null);
    /*
     * Deferred by a frame. The portal is removed in the same commit and the
     * browser then resets focus to the body; a synchronous call loses that
     * race. The connectivity check matters because whatever closed the drawer
     * may also have replaced the subtree the trigger lived in, and focusing a
     * detached node discards the position silently.
     */
    const trigger = drawerTrigger.current;
    if (!trigger) return;
    requestAnimationFrame(() => {
      if (trigger.isConnected) trigger.focus();
    });
  }, []);

  const value = useMemo<ShellState>(
    () => ({
      railExpanded,
      toggleRail,
      partnerOpen,
      setPartnerOpen: setPartner,
      togglePartner,
      drawerTab,
      openDrawer,
      closeDrawer,
      commandOpen,
      setCommandOpen,
      narrow,
    }),
    [
      railExpanded,
      toggleRail,
      partnerOpen,
      setPartner,
      togglePartner,
      drawerTab,
      openDrawer,
      closeDrawer,
      commandOpen,
      narrow,
    ],
  );

  return <ShellContextValue.Provider value={value}>{children}</ShellContextValue.Provider>;
}

/**
 * Reads shell state.
 *
 * Returns a usable no-op shape rather than throwing when there is no provider.
 * That matters because several of these components are also rendered by the
 * administrator settings area, which is not the workday shell, and a thrown
 * error there would be a worse outcome than a disabled control.
 */
export function useShell(): ShellState {
  const value = useContext(ShellContextValue);
  if (value) return value;
  return {
    railExpanded: false,
    toggleRail: () => {},
    partnerOpen: false,
    setPartnerOpen: () => {},
    togglePartner: () => {},
    drawerTab: null,
    openDrawer: () => {},
    closeDrawer: () => {},
    commandOpen: false,
    setCommandOpen: () => {},
    narrow: false,
  };
}
