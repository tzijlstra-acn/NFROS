/**
 * The workday application shell.
 *
 * The shell stays stable when the role changes; only the centre work object
 * and the rail contents change. That is the product's structural argument
 * about orchestration being common across non-financial risk functions, so it
 * is worth making it literally true in the component tree rather than merely
 * asserting it in the copy.
 */

import Link from "next/link";
import type { RoleId } from "@/db/schema/core";
import { getBackgroundWork, getRole, getRoles, getUser, getEntity } from "@/db/repositories/workday";
import { getScenarioState, getTimeline } from "@/scenario/engine/state";
import { getResolvedDemoMode } from "@/server/config/runtime";
import { toolsAvailableAt } from "@/server/security/authority";
import { NAV_LABELS, MODE_LABELS, laneLabel, t, type Language, type LaneId } from "@/i18n/labels";
import { SyntheticLabel } from "@/components/evidence/primitives";
import {
  AutonomySelector,
  BackgroundWorkReveal,
  LanguageToggle,
  ResetButton,
  RoleSwitcher,
  TimelineScrubber,
  WorldViewToggle,
} from "./controls";

export interface WorkdayShellProps {
  roleId: RoleId;
  /** The centre workspace. */
  children: React.ReactNode;
  /** The right intelligence rail. */
  intelligenceRail: React.ReactNode;
  /** Which left rail item is active. */
  activeNav?: string;
}

const NAV_ITEMS: Array<{ key: string; href: (roleId: RoleId) => string; glyph: string }> = [
  { key: "today", href: (r) => `/workday/${r}`, glyph: "#" },
  { key: "collaboration", href: (r) => `/workday/${r}/collaboration`, glyph: "@" },
  { key: "mail", href: (r) => `/workday/${r}/mail`, glyph: "~" },
  { key: "calendar", href: (r) => `/workday/${r}/calendar`, glyph: "=" },
  { key: "decisions", href: (r) => `/workday/${r}/decisions`, glyph: "!" },
  { key: "workbench", href: (r) => `/workday/${r}/workbench`, glyph: "*" },
  { key: "meetings", href: (r) => `/workday/${r}/meetings`, glyph: "+" },
  { key: "assistant", href: (r) => `/workday/${r}/assistant`, glyph: "?" },
  { key: "trustAndAudit", href: () => `/trust`, glyph: "&" },
];

export function WorkdayShell({ roleId, children, intelligenceRail, activeNav = "today" }: WorkdayShellProps) {
  const state = getScenarioState();

  if (!state) {
    return <NotSeeded />;
  }

  const language = state.language as Language;
  const role = getRole(roleId);
  const allRoles = getRoles();
  const holder = role ? getUser(role.holderUserId) : undefined;
  const entity = role ? getEntity(role.entityId) : undefined;
  const timeline = getTimeline();
  const background = getBackgroundWork(roleId, state.currentMoment);
  const demoMode = getResolvedDemoMode();
  const { withheld } = toolsAvailableAt(state.autonomyLevel, roleId);

  const currentMomentRow = timeline.find((m) => m.moment === state.currentMoment);
  const dominantLane = (currentMomentRow?.dominantLane ?? "organise") as LaneId;

  return (
    /*
     * The shell is taken out of document flow with `position: fixed`.
     *
     * A viewport sized grid with `overflow: hidden` was not sufficient. The
     * document still reported over two thousand pixels of scrollable content
     * and `window.scrollTo` genuinely moved it, which carried the entire top
     * bar and the permanent synthetic data disclosure off screen. Note that
     * `overflow: hidden` suppresses the scrollbar and user scrolling but does
     * not prevent programmatic scrolling, so it was never going to be enough
     * on its own.
     *
     * Fixing the shell to the viewport removes it from flow altogether, so
     * there is no in-flow content left to overflow and the document cannot
     * scroll by any means. Content is reached through the three inner
     * scrollers: the left rail, the centre workspace and the intelligence
     * rail.
     */
    <div
      className="workday-shell-root"
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        gridTemplateRows: "var(--topbar-height) minmax(0, 1fr) var(--timeline-height)",
        overflow: "hidden",
      }}
    >
      {/* ---------------- Top bar ---------------- */}
      {/*
        * The top bar must never set a min-content width wider than the
        * viewport. An earlier version put a non-shrinking group on the right
        * that measured over a thousand pixels, which laid the whole shell out
        * at roughly 2068px and pushed the controls and the mandatory synthetic
        * data disclosure off stage at every projected size, with no scrollbar
        * to reveal them. `overflow: hidden` here plus `min-width: 0` on the
        * flexible children, and `topbar-optional` on the items that can be
        * dropped when there is not room, keeps every control reachable.
        */}
      <header
        className="workday-topbar"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
          padding: "0 var(--space-4)",
          borderBottom: "1px solid var(--border-1)",
          background: "var(--surface-0)",
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        <Link href="/" className="row row-2 shrink-0" style={{ textDecoration: "none" }}>
          <span
            className="display strong-text"
            style={{ fontSize: "var(--text-base)", letterSpacing: "var(--tracking-tight)" }}
          >
            NFR WorkOS
          </span>
        </Link>

        <span className="divider-v" style={{ height: 24 }} />

        <RoleSwitcher
          current={roleId}
          language={language}
          options={allRoles.map((r) => {
            const rHolder = getUser(r.holderUserId);
            const rEntity = getEntity(r.entityId);
            return {
              id: r.id,
              title: r.title,
              titleDe: r.titleDe,
              holderName: rHolder?.name ?? r.holderUserId,
              entityShortName: rEntity?.shortName ?? r.entityId,
              deeplyInteractive: r.deeplyInteractive,
            };
          })}
        />

        {/* The context group is the one that yields space, by truncating. */}
        <div className="row row-3 grow" style={{ minWidth: 0, overflow: "hidden" }}>
          <span className="mono strong-text shrink-0">{state.currentMoment}</span>
          <span className="meta truncate">{entity?.name ?? role?.entityId}</span>
          <span className="muted topbar-optional">&middot;</span>
          <span className="meta truncate topbar-optional">{state.label}</span>
        </div>

        {/*
          * Controls, in ascending order of how droppable they are. The lane
          * chip and the mode chip are informational and are available in the
          * control room, so they are the first to go. The autonomy selector,
          * the world view toggle and the language toggle are never dropped,
          * because the product's argument depends on a presenter being able
          * to reach them.
          */}
        <div className="row row-2" style={{ minWidth: 0, flexShrink: 1 }}>
          <span
            className="chip shrink-0 topbar-optional"
            data-tone="cyan"
            title="Dominant work lane at this moment"
          >
            {laneLabel(dominantLane, language)}
          </span>

          <AutonomySelector
            current={state.autonomyLevel}
            language={language}
            withheldCount={withheld.length}
          />

          <span
            className="chip shrink-0 topbar-optional"
            data-tone={demoMode.mode === "live" ? "green" : demoMode.mode === "safe" ? "cyan" : "neutral"}
            title={demoMode.reason ?? "The AI mode in force."}
          >
            {t(MODE_LABELS, demoMode.mode, language)}
          </span>

          <WorldViewToggle current={state.worldView} language={language} />
          <LanguageToggle current={language} />
        </div>
      </header>

      {/* ---------------- Body ---------------- */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "var(--left-rail-width) minmax(0, 1fr) var(--right-rail-width)",
          minHeight: 0,
        }}
      >
        {/* Left rail */}
        <nav
          aria-label="Work areas"
          className="scroll-y"
          style={{
            borderRight: "1px solid var(--border-1)",
            background: "var(--surface-0)",
            padding: "var(--space-3) var(--space-2)",
          }}
        >
          <ul className="stack stack-1">
            {NAV_ITEMS.map((item) => {
              const active = item.key === activeNav;
              return (
                <li key={item.key}>
                  <Link
                    href={item.href(roleId)}
                    aria-current={active ? "page" : undefined}
                    className="row row-3"
                    style={{
                      padding: "var(--space-2) var(--space-3)",
                      borderRadius: "var(--radius-md)",
                      textDecoration: "none",
                      color: active ? "var(--text-1)" : "var(--text-3)",
                      background: active ? "var(--accent-tint)" : "transparent",
                      boxShadow: active ? "inset 0 0 0 1px var(--accent-edge)" : "none",
                      fontSize: "var(--text-sm)",
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className="mono"
                      style={{ width: 14, color: active ? "var(--accent)" : "var(--text-4)" }}
                    >
                      {item.glyph}
                    </span>
                    <span className="truncate">{t(NAV_LABELS, item.key, language)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="divider" style={{ margin: "var(--space-4) var(--space-2)" }} />

          <div className="stack stack-2" style={{ padding: "0 var(--space-3)" }}>
            <span className="label">Acting as</span>
            <span className="strong-text" style={{ fontSize: "var(--text-sm)" }}>
              {holder?.name ?? role?.holderUserId}
            </span>
            <span className="meta">{holder?.jobTitle ?? ""}</span>
            <span className="meta">{holder?.department ?? ""}</span>
          </div>

          <div className="divider" style={{ margin: "var(--space-4) var(--space-2)" }} />

          <div className="stack stack-2" style={{ padding: "0 var(--space-3)" }}>
            <BackgroundWorkReveal
              language={language}
              counts={{
                systemsChecked: background.systemsChecked,
                recordsReconciled: background.recordsReconciled,
                documentsClassified: background.documentsClassified,
                itemsRequested: background.itemsRequested,
                contradictionsIdentified: background.contradictionsIdentified,
                routineUpdates: background.routineUpdates,
                escalatedToHuman: background.escalatedToHuman,
                actions: background.actions.map((a) => ({
                  id: a.id,
                  kind: a.kind,
                  targetLabel: a.targetLabel,
                  description: a.description,
                  performedAtMoment: a.performedAtMoment,
                })),
              }}
            />
            <Link href="/control-room" className="btn btn-sm btn-ghost btn-block">
              Control room
            </Link>
            <Link href="/story" className="btn btn-sm btn-ghost btn-block">
              Presentation
            </Link>
            <ResetButton language={language} />
          </div>
        </nav>

        {/* Centre workspace */}
        <main id="main" className="scroll-y" style={{ padding: "var(--space-6)" }}>
          {children}
        </main>

        {/* Right intelligence rail */}
        <aside
          aria-label="Intelligence rail"
          className="scroll-y"
          style={{
            borderLeft: "1px solid var(--border-1)",
            background: "var(--surface-0)",
            padding: "var(--space-4)",
          }}
        >
          {intelligenceRail}
        </aside>
      </div>

      {/* ---------------- Bottom timeline ---------------- */}
      {/*
        * The synthetic data disclosure lives here rather than in the top bar.
        * The brief requires it to be permanent, and the top bar is where every
        * control competes for width, so that is the one place in the shell
        * where it can be pushed out of view. The bottom bar always has room.
        */}
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          borderTop: "1px solid var(--border-1)",
          background: "var(--surface-0)",
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        <div className="grow" style={{ minWidth: 0 }}>
          <TimelineScrubber
            moments={timeline.map((m) => ({
              id: m.id,
              moment: m.moment,
              title: m.title,
              titleDe: m.titleDe,
              dominantLane: m.dominantLane,
              isSharedEvent: m.isSharedEvent,
            }))}
            current={state.currentMoment}
            language={language}
            decidedMoments={[]}
          />
        </div>
        <div
          className="row shrink-0"
          style={{
            padding: "0 var(--space-4)",
            borderLeft: "1px solid var(--border-1)",
          }}
        >
          <SyntheticLabel language={language} />
        </div>
      </div>
    </div>
  );
}

/**
 * Shown when the database has no scenario.
 *
 * A blank screen with a stack trace would be the wrong answer here, because
 * the most likely reader is someone who has just cloned the repository.
 */
export function NotSeeded() {
  return (
    <main
      id="main"
      style={{
        display: "grid",
        placeItems: "center",
        minHeight: "100vh",
        padding: "var(--space-8)",
      }}
    >
      <div className="panel" style={{ maxWidth: 620 }}>
        <div className="panel-head">
          <span className="panel-title">The scenario has not been seeded</span>
        </div>
        <div className="panel-body stack stack-4">
          <p className="lede">
            The database schema or the seeded day is missing, so there is nothing to show. Run these
            two commands and reload.
          </p>
          <pre
            className="mono"
            style={{
              background: "var(--surface-0)",
              border: "1px solid var(--border-1)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-4)",
              fontSize: "var(--text-sm)",
            }}
          >
            {"npm run db:migrate\nnpm run db:seed"}
          </pre>
          <Link href="/" className="btn">
            Back to the entry screen
          </Link>
        </div>
      </div>
    </main>
  );
}
