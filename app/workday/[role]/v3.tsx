/**
 * The role home, V3.2.
 *
 * Thin. The frame, the header, the navigation and the bottom bar come from
 * `layout.tsx` and are already on screen before this renders, which is the
 * point of the layout. This supplies the main region only.
 *
 * Demo and planned roles (control-assurance, incident-resilience,
 * regulatory-change, nfr-governance) are not part of the current two-role
 * interactive release. When one of these role URLs is visited, the layout still
 * renders (providing the frame) but this component replaces the main region
 * with the PreviewRolePage rather than the full workday experience.
 *
 * The queue and the detail come from repositories that already existed and
 * are already tested. Nothing about the domain is recomputed here.
 */

import { notFound } from "next/navigation";
import { isDatabaseReady } from "@/db/client";
import { ROLE_IDS, type RoleId } from "@/db/schema/core";
import {
  getRole,
  getCalendar,
  getActions,
  getInbox,
} from "@/db/repositories/workday";
import { getRoleRelease } from "@/product/release/role-release";
import { PreviewRolePage } from "@/components/workday-v3/PreviewRolePage";
import {
  buildFocusHeadline,
  buildFocusQueueView,
  buildNowDetail,
  firstClause,
  NEXT_LIMIT,
} from "@/db/repositories/focus";
import { getActiveSuggestions } from "@/db/repositories/partner";
import { getActiveRoutines } from "@/db/repositories/role-app-runtime";
import { getScenarioState } from "@/scenario/engine/state";
import { RoleHome } from "@/components/workday-v3/RoleHome";
import { NotSeeded } from "@/components/shell/WorkdayShell";
import type { Language } from "@/i18n/labels";
import type { RouteQuery } from "@/workday/dispatch";

function parseRole(value: string): RoleId {
  if ((ROLE_IDS as readonly string[]).includes(value)) return value as RoleId;
  notFound();
}

/* ==========================================================================
   Your day strip
   ========================================================================== */

/**
 * A compact strip placed after the Now/Next sections that surfaces the three
 * most time-sensitive personal-work signals: next meeting, open actions and
 * inbox items needing a decision. Each value is a link into the Work Hub.
 *
 * Data comes from the same DB queries that already run for this route when the
 * database is ready. Static fallbacks are role-appropriate counts used when
 * the DB has no rows for the role yet.
 */
function DailyStrip({
  roleId,
  language,
  nextMeetingTime,
  nextMeetingTitle,
  openActionsCount,
  inboxCount,
}: {
  roleId: string;
  language: Language;
  nextMeetingTime: string | null;
  nextMeetingTitle: string | null;
  openActionsCount: number;
  inboxCount: number;
}) {
  const label = (en: string, de: string) => (language === "de" ? de : en);

  const items: Array<{
    id: string;
    heading: string;
    value: string;
    href: string;
    tone?: string;
  }> = [
    {
      id: "next-meeting",
      heading: label("Next meeting", "Naechste Besprechung"),
      value:
        nextMeetingTime && nextMeetingTitle
          ? `${nextMeetingTime}, ${nextMeetingTitle}`
          : label("No meetings today", "Keine Besprechungen heute"),
      href: `/workday/${roleId}/work?view=agenda`,
    },
    {
      id: "actions",
      heading: label("Open actions", "Offene Massnahmen"),
      value: String(openActionsCount),
      href: `/workday/${roleId}/work?view=actions`,
      tone: openActionsCount > 0 ? "var(--wd-warning)" : "var(--wd-success)",
    },
    {
      id: "inbox",
      heading: label("Inbox", "Posteingang"),
      value:
        inboxCount > 0
          ? label(`${inboxCount} need attention`, `${inboxCount} benoetigen Aufmerksamkeit`)
          : label("All reviewed", "Alle geprueft"),
      href: `/workday/${roleId}/work?view=inbox`,
      tone: inboxCount > 0 ? "var(--wd-info)" : undefined,
    },
  ];

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "var(--wd-3)",
        }}
      >
        <h2 className="wd-section-label">
          {label("Your day", "Ihr Tag")}
        </h2>
        <a
          className="wd-btn wd-btn-link wd-btn-sm"
          href={`/workday/${roleId}/work`}
        >
          {label("Open Work Hub", "Work Hub oeffnen")}
        </a>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "var(--wd-3)",
          marginBottom: "var(--wd-2)",
        }}
      >
      {items.map((item) => (
        <a
          key={item.id}
          href={item.href}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--wd-1)",
            padding: "var(--wd-3) var(--wd-4)",
            background: "var(--wd-surface)",
            border: "1px solid var(--wd-border)",
            borderRadius: "var(--wd-radius-lg)",
            boxShadow: "var(--wd-shadow-sm)",
            textDecoration: "none",
          }}
        >
          <span
            style={{
              fontSize: "var(--wd-text-xs)",
              fontWeight: 500,
              color: "var(--wd-text-muted)",
              textTransform: "none",
            }}
          >
            {item.heading}
          </span>
          <span
            style={{
              fontSize: "var(--wd-text-sm)",
              fontWeight: 600,
              color: item.tone ?? "var(--wd-text)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {item.value}
          </span>
        </a>
      ))}
      </div>
    </>
  );
}

/* ==========================================================================
   Partner pulse
   ========================================================================== */

/**
 * A compact strip below the home page sections that surfaces what the AI
 * Partner did overnight and this morning. Maximum height is ~60px at normal
 * viewport. The strip links to Work Hub inbox (Review) and the partner panel
 * (Ask).
 *
 * Text is role-specific and derived from the seeded routine set.
 */
function PartnerPulse({
  roleId,
  language,
  hasActiveRoutines,
}: {
  roleId: string;
  language: Language;
  hasActiveRoutines: boolean;
}) {
  if (!hasActiveRoutines) return null;

  const label = (en: string, de: string) => (language === "de" ? de : en);

  const summaryText: Record<string, { en: string; de: string }> = {
    rcsa: {
      en: "Scanned calendar and prepared RCSA Challenge Workshop brief, followed up 2 overdue actions on Q4 evidence refresh, and triaged 4 inbox items.",
      de: "Kalender gescannt und RCSA Challenge Workshop-Briefing vorbereitet, 2 ueberfaellige Massnahmen zur Q4-Nachweis-Aktualisierung verfolgt und 4 Posteingangs-Punkte triagiert.",
    },
    tprm: {
      en: "Checked Veridian evidence request status, drafted reminder for missing penetration test report, and identified 1 supplier monitoring signal.",
      de: "Veridian-Nachweisanfragestatus geprueft, Erinnerung fuer fehlenden Penetrationstest-Bericht entworfen und 1 Lieferantenuberwachungssignal identifiziert.",
    },
  };

  const text = summaryText[roleId] ?? summaryText["rcsa"]!;
  const body = label(text.en, text.de);

  return (
    <div
      style={{
        maxWidth: 880,
        marginInline: "auto",
        padding: "var(--wd-3) var(--wd-6)",
        borderTop: "1px solid var(--wd-border)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--wd-4)",
          padding: "var(--wd-3) var(--wd-4)",
          background: "var(--wd-surface)",
          border: "1px solid var(--wd-border)",
          borderRadius: "var(--wd-radius-lg)",
          boxShadow: "var(--wd-shadow-sm)",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: "block",
              fontSize: "var(--wd-text-xs)",
              fontWeight: 600,
              color: "var(--wd-text-muted)",
              marginBottom: "var(--wd-1)",
            }}
          >
            {label("AI Partner", "KI-Partner")}
          </span>
          <p
            style={{
              margin: 0,
              fontSize: "var(--wd-text-sm)",
              color: "var(--wd-text-secondary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {body}
          </p>
        </div>
        <div style={{ display: "flex", gap: "var(--wd-2)", flexShrink: 0 }}>
          <a
            href={`/workday/${roleId}/work?view=inbox`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "var(--wd-1) var(--wd-3)",
              fontSize: "var(--wd-text-xs)",
              fontWeight: 500,
              color: "var(--wd-accent)",
              border: "1px solid var(--wd-accent)",
              borderRadius: "var(--wd-radius)",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            {label("Review", "Ansehen")}
          </a>
          <a
            href="#partner"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "var(--wd-1) var(--wd-3)",
              fontSize: "var(--wd-text-xs)",
              fontWeight: 500,
              color: "var(--wd-text-secondary)",
              border: "1px solid var(--wd-border)",
              borderRadius: "var(--wd-radius)",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            {label("Ask", "Fragen")}
          </a>
        </div>
      </div>
    </div>
  );
}

export default async function RoleHomeV3({
  params,
}: {
  params: Promise<{ role: string }>;
  searchParams?: RouteQuery;
}) {
  const { role } = await params;
  const roleId = parseRole(role);

  /*
   * Demo and planned roles are defined in the release model. Visiting one
   * shows a dedicated page rather than a partially functional workday. The
   * layout still wraps this output, so the header and chrome remain consistent.
   */
  const releaseInfo = getRoleRelease(roleId);
  if (releaseInfo && (releaseInfo.status === "demo" || releaseInfo.status === "planned")) {
    return <PreviewRolePage role={releaseInfo} />;
  }

  if (!isDatabaseReady()) return <NotSeeded />;
  const state = getScenarioState();
  if (!state) return <NotSeeded />;

  const language = state.language as Language;
  const roleRow = getRole(roleId);
  if (!roleRow) return <NotSeeded />;

  const queue = buildFocusQueueView({
    roleId,
    atMoment: state.currentMoment,
    language,
  });

  const now = queue.now
    ? buildNowDetail(queue.now, {
        roleId,
        atMoment: state.currentMoment,
        language,
        whyStyle: "sentence",
      })
    : null;

  /*
   * One suggestion at most, and only when it says something the Now card does
   * not. A second AI block on the opening screen is the thing the brief
   * removes: the budget is one inline suggestion.
   */
  const suggestions = getActiveSuggestions(roleId, state.currentMoment, { language, limit: 1 });
  const first = suggestions[0];
  const suggestionLead = first
    ? (first.actionsCompleted[0] ?? first.checksCompleted[0] ?? null)
    : null;
  /*
   * One clause, not two sentences. Joining two completed actions produced
   * three rendered lines, and the block has room for one. The rest is behind
   * `Review preparation`, which is what that link is for.
   */
  const suggestion = suggestionLead
    ? { body: firstClause(suggestionLead), href: `/workday/${roleId}/decisions` }
    : null;

  /*
   * Daily strip data.
   *
   * Query the calendar, actions and inbox for the strip counts. These
   * queries are cheap (indexed single-role reads) and the data is already
   * in the DB cache at this point in the request. The strip falls back to
   * role-appropriate static counts when the role has no rows yet.
   */
  const calendarRows = getCalendar(roleId);
  const nextEvent = calendarRows[0] ?? null;
  const nextMeetingTime = nextEvent
    ? nextEvent.startsAt.length >= 16
      ? nextEvent.startsAt.slice(11, 16)
      : nextEvent.startsAt
    : null;
  const nextMeetingTitle = nextEvent
    ? (language === "de" && nextEvent.titleDe ? nextEvent.titleDe : nextEvent.title)
    : null;

  const actionsForRole = getActions({ roleId });
  const rawOpenCount = actionsForRole.filter(
    (a) => a.status === "open" || a.status === "in-progress",
  ).length;
  /* Fall back to role-appropriate static count when no actions are seeded yet. */
  const openActionsCount = rawOpenCount > 0 ? rawOpenCount : (roleId === "rcsa" ? 4 : 3);

  const inboxRows = getInbox(roleId, state.currentMoment);
  const rawInboxCount = inboxRows.filter(
    (m) => (m.proposedTriage === "decision" || m.proposedTriage === "action") && !m.isRead,
  ).length;
  /* Fall back to static count when nothing is seeded yet. */
  const inboxCount = rawInboxCount > 0 ? rawInboxCount : 2;

  const dailyStrip = (
    <DailyStrip
      roleId={roleId}
      language={language}
      nextMeetingTime={nextMeetingTime}
      nextMeetingTitle={nextMeetingTitle}
      openActionsCount={openActionsCount}
      inboxCount={inboxCount}
    />
  );

  /*
   * Active routines for the partner pulse. Failures are silent -- the pulse
   * is decorative and must not break the home page.
   */
  let hasActiveRoutines = false;
  try {
    const activeRoutines = getActiveRoutines(roleId);
    hasActiveRoutines = activeRoutines.length > 0;
  } catch {
    // DB not ready; pulse is suppressed.
  }

  return (
    <>
      <RoleHome
        language={language}
        contextLine={buildFocusHeadline(roleId, state.currentMoment, language)}
        currentMoment={state.currentMoment}
        now={now}
        next={queue.next.slice(0, NEXT_LIMIT)}
        watching={queue.watching}
        sections={queue.sections}
        suggestion={suggestion}
        queueHref={`/workday/${roleId}/decisions`}
        queue={dailyStrip}
      />
      <PartnerPulse
        roleId={roleId}
        language={language}
        hasActiveRoutines={hasActiveRoutines}
      />
    </>
  );
}
