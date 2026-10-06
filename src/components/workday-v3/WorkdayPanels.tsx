"use client";

/**
 * The two right hand panels: the context drawer and the AI dock.
 *
 * Both are closed by default and only one can be open, which is enforced by
 * the chrome state holding a single `panel` value rather than two booleans. A
 * union of one cannot hold two, so the rule cannot be broken by a later
 * caller forgetting it.
 *
 * They overlay rather than taking a column. That is what lets the main
 * workspace keep its full width when nothing is open, and it means opening one
 * does not reflow the queue the user was reading.
 *
 * The drawer's four tabs replace the seven of the permanent intelligence rail.
 * Nothing was dropped: evidence, details, activity and audit each gather what
 * used to be separate top level tabs, which is the difference between four
 * groups and seven peers.
 */

import { IconX } from "@tabler/icons-react";
import type { Language } from "@/i18n/labels";
import { useWorkdayChrome, WD_DRAWER_TABS, type WdDrawerTab } from "./ChromeContext";
import { WorkdayPartnerDock } from "./WorkdayPartnerDock";
import { BoundContextPanel } from "@/components/work/BoundContextPanel";
import { useBoundContext } from "@/components/work/context-store";

const TAB_LABELS: Record<WdDrawerTab, { en: string; de: string }> = {
  evidence: { en: "Evidence", de: "Nachweise" },
  details: { en: "Details", de: "Details" },
  activity: { en: "Activity", de: "Aktivitaet" },
  audit: { en: "Audit", de: "Revision" },
};

export function WorkdayPanels({ language, roleId }: { language: Language; roleId: string }) {
  const chrome = useWorkdayChrome();
  const bound = useBoundContext(roleId);

  /*
   * The dock is rendered unconditionally and decides for itself.
   *
   * Returning null here when no panel is open was wrong once the dock became
   * the real AI Partner rather than an empty state: it unmounted the dock on
   * every close, so closing the panel to read the queue behind it discarded
   * the conversation and the event subscription. The dock renders nothing
   * until it has been opened once, and hides itself after that, so the cost
   * of a reader who never asks for it is still nothing.
   */
  return (
    <>
      {chrome.panel !== null ? (
        <div className="wd-panel-scrim" onClick={chrome.closePanel} aria-hidden="true" />
      ) : null}

      {chrome.panel === "drawer" ? (
        <aside
          className="wd-panel"
          role="dialog"
          aria-modal="false"
          aria-label={language === "de" ? "Kontext" : "Context"}
        >
          <div className="wd-panel-head">
            <div className="wd-row wd-grow" role="tablist" aria-label={language === "de" ? "Kontextbereiche" : "Context areas"}>
              {WD_DRAWER_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={chrome.drawerTab === tab}
                  className="wd-btn wd-btn-quiet wd-btn-sm"
                  onClick={() => chrome.openDrawer(tab)}
                  style={
                    chrome.drawerTab === tab
                      ? { background: "var(--wd-accent-soft)", color: "var(--wd-accent)" }
                      : undefined
                  }
                >
                  {language === "de" ? TAB_LABELS[tab].de : TAB_LABELS[tab].en}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="wd-icon-btn"
              onClick={chrome.closePanel}
              aria-label={language === "de" ? "Schliessen" : "Close"}
            >
              <IconX size={18} stroke={2} aria-hidden="true" />
            </button>
          </div>

          <div className="wd-panel-body">
            {/*
              * The content is the bound work context: the item the Work Hub
              * selected, published to `src/components/work/context-store.ts`.
              * It stays bound after the reader leaves the hub, so once an item
              * has been selected the drawer shows that item rather than
              * reverting to the empty state. Until anything is bound, the
              * panel says what it is for rather than showing an empty box.
              */}
            {bound ? (
              <BoundContextPanel bound={bound} tab={chrome.drawerTab} language={language} />
            ) : (
            <div className="wd-empty">
              <span className="wd-empty-title">
                {language === "de" ? "Nichts ausgewaehlt" : "Nothing selected"}
              </span>
              <span>
                {language === "de"
                  ? "Waehlen Sie eine Zeile in der Liste, um die zugehoerigen Nachweise und Details zu sehen."
                  : "Select a row in the list to see the evidence and details behind it."}
              </span>
            </div>
            )}
          </div>
        </aside>
      ) : (
        /*
          * The real dock, not a placeholder.
          *
          * This slot used to render an empty state saying the partner was
          * ready and offering a link to a larger view, which is a promise
          * rather than a product. It is now the same `AIPartnerDock` V2 uses,
          * with its three tabs, its streaming and its citation handling, and
          * it opens on the conversation.
          */
        <WorkdayPartnerDock language={language} roleId={roleId} />
      )}
    </>
  );
}
