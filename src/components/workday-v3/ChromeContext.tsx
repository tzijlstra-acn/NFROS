"use client";

/**
 * Chrome state for the V3.1 workday.
 *
 * Only the shape of the chrome lives here: which panel is open, whether the
 * navigation is expanded, the theme, whether the reviewer is in demo mode, and
 * whether an AI run is in flight. None of it has consequences in the domain.
 *
 * What is deliberately NOT here, and the reason, because it is the same reason
 * as in the V2 shell: the scenario clock, the acting role, the autonomy level
 * and the selected object are real state with consequences, they live in the
 * database, and the server is their only owner. A client copy of any of them
 * could disagree with the authority gate, and showing a higher autonomy level
 * than the gate enforces is the worst lie this product could tell.
 *
 * The theme arrives from the server. It is stored in a cookie rather than in
 * local storage so the layout can render the correct theme in its first
 * response: reading local storage after mount would paint light and then
 * repaint dark, and a flash of the wrong theme on every navigation is worse
 * than not offering the choice.
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

export const WD_PANELS = ["drawer", "dock"] as const;
export type WdPanel = (typeof WD_PANELS)[number];

export const WD_DRAWER_TABS = ["evidence", "details", "activity", "audit"] as const;
export type WdDrawerTab = (typeof WD_DRAWER_TABS)[number];

export type WdTheme = "light" | "dark";

export const THEME_COOKIE = "nfr-wd-theme";
export const DEMO_COOKIE = "nfr-wd-demo";
export const NAV_COOKIE = "nfr-wd-nav";

export interface WorkdayChromeState {
  theme: WdTheme;
  toggleTheme: () => void;

  navExpanded: boolean;
  toggleNav: () => void;

  /**
   * The open right panel, or null.
   *
   * One at a time, by construction rather than by discipline: the brief
   * requires it, and a union of one value cannot hold two.
   */
  panel: WdPanel | null;
  drawerTab: WdDrawerTab;
  openDrawer: (tab: WdDrawerTab, trigger?: HTMLElement | null) => void;
  /** Opens or closes the AI Partner dock. The trigger receives focus when it closes. */
  toggleDock: (trigger?: HTMLElement | null) => void;
  closePanel: () => void;
  dockOpen: boolean;
  drawerOpen: boolean;

  updatesOpen: boolean;
  toggleUpdates: () => void;

  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;

  demoMode: boolean;
  setDemoMode: (on: boolean) => void;

  /** True while a generation is in flight, so the header can say `working`. */
  aiRunning: boolean;
  setAiRunning: (running: boolean) => void;
}

const ChromeContextValue = createContext<WorkdayChromeState | null>(null);

function writeCookie(name: string, value: string): void {
  try {
    document.cookie = `${name}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  } catch {
    // A browser refusing cookies loses the preference and nothing else.
  }
}

export function WorkdayChromeProvider({
  initialTheme,
  initialDemoMode = false,
  initialNavExpanded = true,
  children,
}: {
  initialTheme: WdTheme;
  initialDemoMode?: boolean;
  /**
   * Whether the rail shows its labels.
   *
   * Expanded is the default, and that is a deliberate reversal. A collapsed
   * rail of seven unlabelled glyphs asks the reader to already know what the
   * product calls things, which is exactly the training the brief says the
   * default screen must not require. The width it costs is 140px, which the
   * density measurement can afford.
   */
  initialNavExpanded?: boolean;
  children: ReactNode;
}) {
  const [theme, setTheme] = useState<WdTheme>(initialTheme);
  const [navExpanded, setNavExpanded] = useState(initialNavExpanded);
  const [panel, setPanel] = useState<WdPanel | null>(null);
  const [drawerTab, setDrawerTab] = useState<WdDrawerTab>("evidence");
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [demoMode, setDemoModeState] = useState(initialDemoMode);
  const [aiRunning, setAiRunning] = useState(false);
  const drawerTrigger = useRef<HTMLElement | null>(null);

  /*
   * The theme attribute is written to the frame element directly as well as
   * being state. The layout rendered it server side from the cookie, and
   * setting it here keeps the two in step without a round trip.
   */
  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next: WdTheme = current === "dark" ? "light" : "dark";
      writeCookie(THEME_COOKIE, next);
      const frame = document.querySelector(".workday-v3");
      if (frame instanceof HTMLElement) frame.dataset["wdTheme"] = next;
      return next;
    });
  }, []);

  const setDemoMode = useCallback((on: boolean) => {
    writeCookie(DEMO_COOKIE, on ? "1" : "0");
    setDemoModeState(on);
  }, []);

  const toggleNav = useCallback(() => {
    setNavExpanded((value) => {
      const next = !value;
      writeCookie(NAV_COOKIE, next ? "1" : "0");
      return next;
    });
  }, []);

  const openDrawer = useCallback((tab: WdDrawerTab, trigger?: HTMLElement | null) => {
    if (trigger !== undefined) drawerTrigger.current = trigger;
    setDrawerTab(tab);
    setPanel("drawer");
  }, []);

  /*
   * Opening the dock remembers what opened it, as the drawer does, so closing
   * it returns focus there. Without this a keyboard user who closed the dock
   * was dropped at the top of the document (`workday-v3-a11y.spec.ts`). A
   * caller whose control is about to disappear, the command palette, passes
   * the control that opened the palette instead.
   */
  const toggleDock = useCallback((trigger?: HTMLElement | null) => {
    setPanel((current) => {
      if (current === "dock") return null;
      /* Checked, because the bridged V2 controls may pass a click event here. */
      const opener =
        trigger instanceof HTMLElement
          ? trigger
          : document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
      drawerTrigger.current = opener;
      return "dock";
    });
  }, []);

  /*
   * Focus returns to whatever opened the drawer, deferred by a frame.
   *
   * The same fix as the V2 drawer needed: the panel is removed in the same
   * commit, the browser then resets focus to the body, and a synchronous call
   * loses that race. The connectivity check matters because the thing that
   * closed the panel may also have replaced the subtree the trigger was in.
   */
  const closePanel = useCallback(() => {
    setPanel(null);
    const trigger = drawerTrigger.current;
    if (!trigger) return;
    requestAnimationFrame(() => {
      if (trigger.isConnected) trigger.focus();
    });
  }, []);

  const toggleUpdates = useCallback(() => setUpdatesOpen((value) => !value), []);

  /* Escape closes the open panel. */
  useEffect(() => {
    if (panel === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePanel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [panel, closePanel]);

  const value = useMemo<WorkdayChromeState>(
    () => ({
      theme,
      toggleTheme,
      navExpanded,
      toggleNav,
      panel,
      drawerTab,
      openDrawer,
      toggleDock,
      closePanel,
      dockOpen: panel === "dock",
      drawerOpen: panel === "drawer",
      updatesOpen,
      toggleUpdates,
      commandOpen,
      setCommandOpen,
      demoMode,
      setDemoMode,
      aiRunning,
      setAiRunning,
    }),
    [
      theme,
      toggleTheme,
      navExpanded,
      toggleNav,
      panel,
      drawerTab,
      openDrawer,
      toggleDock,
      closePanel,
      updatesOpen,
      toggleUpdates,
      commandOpen,
      demoMode,
      setDemoMode,
      aiRunning,
    ],
  );

  return <ChromeContextValue.Provider value={value}>{children}</ChromeContextValue.Provider>;
}

/**
 * Reads chrome state.
 *
 * Returns an inert shape rather than throwing when there is no provider, the
 * same choice as the V2 shell made. Several of these components are also
 * rendered by surfaces that are not the workday frame, and a thrown error
 * there would be a worse outcome than a disabled control.
 */
export function useWorkdayChrome(): WorkdayChromeState {
  const value = useContext(ChromeContextValue);
  if (value) return value;
  return {
    theme: "light",
    toggleTheme: () => {},
    navExpanded: false,
    toggleNav: () => {},
    panel: null,
    drawerTab: "evidence",
    openDrawer: () => {},
    toggleDock: () => {},
    closePanel: () => {},
    dockOpen: false,
    drawerOpen: false,
    updatesOpen: false,
    toggleUpdates: () => {},
    commandOpen: false,
    setCommandOpen: () => {},
    demoMode: false,
    setDemoMode: () => {},
    aiRunning: false,
    setAiRunning: () => {},
  };
}
