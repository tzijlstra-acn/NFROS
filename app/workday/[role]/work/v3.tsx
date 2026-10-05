/**
 * Work Hub, V3.
 *
 * The personal work surface for flagship roles. Four tabs navigate between
 * the day's agenda, meetings, actions, and inbox. Tab selection is driven by
 * searchParams.view so the component is a pure server component with no
 * client state.
 *
 * Data is read from the existing DB repositories where the relevant query
 * functions exist. Each tab notes its current data source and any
 * limitations.
 *
 * Synthetic institution and data.
 */

import { notFound } from "next/navigation";
import { ROLE_IDS, type RoleId } from "@/db/schema/core";
import { isDatabaseReady } from "@/db/client";
import { getScenarioState } from "@/scenario/engine/state";
import {
  getCalendar,
  getMeetings,
  getInbox,
  getActions,
} from "@/db/repositories/workday";
import type { Language } from "@/i18n/labels";
import type { RouteQuery } from "@/workday/dispatch";

/* ==========================================================================
   Types
   ========================================================================== */

type ViewTab = "agenda" | "meetings" | "actions" | "inbox";
const VALID_VIEWS: readonly ViewTab[] = ["agenda", "meetings", "actions", "inbox"];

function isValidView(v: unknown): v is ViewTab {
  return typeof v === "string" && (VALID_VIEWS as readonly string[]).includes(v);
}

/* ==========================================================================
   Labels
   ========================================================================== */

const LABELS = {
  title: { en: "Work", de: "Arbeit" },
  contextRcsa: {
    en: "RCSA-ARC-DE-PAYOPS-2026-Q4: Q4 cycle in progress",
    de: "RCSA-ARC-DE-PAYOPS-2026-Q4: Q4-Zyklus laeuft",
  },
  contextTprm: {
    en: "Third-party onboarding: Veridian Document Systems GmbH",
    de: "Drittanbieter-Onboarding: Veridian Document Systems GmbH",
  },
  tabs: {
    agenda: { en: "Agenda", de: "Agenda" },
    meetings: { en: "Meetings", de: "Besprechungen" },
    actions: { en: "Actions", de: "Massnahmen" },
    inbox: { en: "Inbox", de: "Posteingang" },
  },
  synthetic: { en: "Synthetic institution and data", de: "Synthetische Institution und Daten" },
  open: { en: "Open preparation", de: "Vorbereitung oeffnen" },
  join: { en: "Join", de: "Beitreten" },
  noCalendar: { en: "No calendar events for today.", de: "Keine Kalendereintraege fuer heute." },
  upcoming: { en: "Upcoming", de: "Anstehend" },
  archive: { en: "Minutes archive", de: "Protokollarchiv" },
  noMeetings: { en: "No upcoming meetings.", de: "Keine anstehenden Besprechungen." },
  noArchive: { en: "No minutes in the archive.", de: "Keine Protokolle im Archiv." },
  openMeeting: { en: "Open", de: "Oeffnen" },
  needsMe: { en: "Needs me", de: "Benoetigt mich" },
  waitingOthers: { en: "Waiting on others", de: "Warte auf andere" },
  overdue: { en: "Overdue", de: "Ueberfaellig" },
  completed: { en: "Completed", de: "Abgeschlossen" },
  noActions: { en: "No actions in this filter.", de: "Keine Massnahmen in diesem Filter." },
  review: { en: "Review", de: "Ueberpruefen" },
  noInbox: { en: "No inbox items.", de: "Keine Posteingangselemente." },
  due: { en: "Due", de: "Faellig" },
} as const;

function pick(pair: { en: string; de: string }, language: Language): string {
  return language === "de" ? pair.de : pair.en;
}

function parseRole(value: string): RoleId {
  if ((ROLE_IDS as readonly string[]).includes(value)) return value as RoleId;
  notFound();
}

/* ==========================================================================
   Shared primitive components
   ========================================================================== */

function Badge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info" | "ai";
}) {
  const styles: Record<typeof tone, { bg: string; color: string; border: string }> = {
    neutral: {
      bg: "var(--wd-surface-subtle)",
      color: "var(--wd-text-secondary)",
      border: "var(--wd-border)",
    },
    success: {
      bg: "var(--wd-success-soft)",
      color: "var(--wd-success)",
      border: "var(--wd-success)",
    },
    warning: {
      bg: "var(--wd-warning-soft)",
      color: "var(--wd-warning)",
      border: "var(--wd-warning)",
    },
    danger: {
      bg: "var(--wd-danger-soft)",
      color: "var(--wd-danger)",
      border: "var(--wd-danger)",
    },
    info: {
      bg: "var(--wd-info-soft)",
      color: "var(--wd-info)",
      border: "var(--wd-info)",
    },
    ai: {
      bg: "var(--wd-accent-soft)",
      color: "var(--wd-accent)",
      border: "var(--wd-accent-border)",
    },
  };

  const s = styles[tone] ?? styles.neutral;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "1px var(--wd-2)",
        fontSize: "var(--wd-text-xs)",
        fontWeight: 500,
        borderRadius: "var(--wd-radius-sm)",
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  );
}

/* ==========================================================================
   Tab navigation
   ========================================================================== */

function TabNav({
  activeView,
  roleId,
  language,
}: {
  activeView: ViewTab;
  roleId: string;
  language: Language;
}) {
  const tabs: Array<{ view: ViewTab; label: string }> = [
    { view: "agenda", label: pick(LABELS.tabs.agenda, language) },
    { view: "meetings", label: pick(LABELS.tabs.meetings, language) },
    { view: "actions", label: pick(LABELS.tabs.actions, language) },
    { view: "inbox", label: pick(LABELS.tabs.inbox, language) },
  ];

  return (
    <nav
      aria-label={language === "de" ? "Arbeitsbereiche" : "Work views"}
      style={{
        display: "flex",
        borderBottom: "1px solid var(--wd-border)",
        marginBottom: "var(--wd-6)",
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.view === activeView;
        return (
          <a
            key={tab.view}
            href={`/workday/${roleId}/work?view=${tab.view}`}
            aria-current={isActive ? "page" : undefined}
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "var(--wd-2) var(--wd-4)",
              fontSize: "var(--wd-text-sm)",
              fontWeight: isActive ? 600 : 400,
              color: isActive ? "var(--wd-accent)" : "var(--wd-text-secondary)",
              borderBottom: isActive
                ? "2px solid var(--wd-accent)"
                : "2px solid transparent",
              textDecoration: "none",
              marginBottom: "-1px",
            }}
          >
            {tab.label}
          </a>
        );
      })}
    </nav>
  );
}

/* ==========================================================================
   Agenda tab
   ========================================================================== */

interface AgendaEvent {
  id: string;
  time: string;
  title: string;
  kind: string;
  prepStatus: string;
  meetingId: string | null;
}

function agendaKindLabel(kind: string): string {
  const map: Record<string, string> = {
    workshop: "Workshop",
    meeting: "Meeting",
    committee: "Committee",
    "focus-time": "Focus",
    "crisis-call": "Crisis call",
    review: "Review",
  };
  return map[kind] ?? kind;
}

function agendaPrepLabel(status: string): string {
  const map: Record<string, string> = {
    "not-started": "Not prepared",
    "in-progress": "AI preparing",
    ready: "Ready",
    completed: "Completed",
  };
  return map[status] ?? status;
}

function agendaPrepTone(status: string): "neutral" | "ai" | "success" {
  if (status === "ready") return "success";
  if (status === "in-progress") return "ai";
  return "neutral";
}

function AgendaView({
  events,
  language,
  roleId,
}: {
  events: AgendaEvent[];
  language: Language;
  roleId: string;
}) {
  if (events.length === 0) {
    return (
      <p style={{ fontSize: "var(--wd-text-sm)", color: "var(--wd-text-muted)" }}>
        {pick(LABELS.noCalendar, language)}
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--wd-2)" }}>
      {events.map((event) => (
        <div
          key={event.id}
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
          {/* Time */}
          <span
            style={{
              fontFamily: "var(--wd-font-mono)",
              fontSize: "var(--wd-text-sm)",
              color: "var(--wd-text-secondary)",
              flexShrink: 0,
              minWidth: "3rem",
            }}
          >
            {event.time}
          </span>

          {/* Title */}
          <span
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: "var(--wd-text-base)",
              fontWeight: 500,
              color: "var(--wd-text)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {event.title}
          </span>

          {/* Kind badge */}
          <Badge label={agendaKindLabel(event.kind)} tone="neutral" />

          {/* Prep status badge */}
          <Badge
            label={agendaPrepLabel(event.prepStatus)}
            tone={agendaPrepTone(event.prepStatus)}
          />

          {/* Action link */}
          <a
            href={
              event.meetingId
                ? `/workday/${roleId}/work?view=meetings`
                : `/workday/${roleId}/work?view=agenda`
            }
            style={{
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              padding: "var(--wd-1) var(--wd-3)",
              fontSize: "var(--wd-text-sm)",
              fontWeight: 500,
              color: "var(--wd-accent)",
              border: "1px solid var(--wd-accent-border)",
              borderRadius: "var(--wd-radius)",
              textDecoration: "none",
              background: "var(--wd-accent-soft)",
              whiteSpace: "nowrap",
            }}
          >
            {event.prepStatus === "ready" || event.prepStatus === "in-progress"
              ? pick(LABELS.open, language)
              : pick(LABELS.join, language)}
          </a>
        </div>
      ))}
    </div>
  );
}

/* Static fallback events per role */

const RCSA_STATIC_EVENTS: AgendaEvent[] = [
  {
    id: "rcsa-ev-1",
    time: "09:00",
    title: "RCSA Evidence Review Focus Block",
    kind: "focus-time",
    prepStatus: "ready",
    meetingId: null,
  },
  {
    id: "rcsa-ev-2",
    time: "10:30",
    title: "RCSA Challenge Workshop",
    kind: "workshop",
    prepStatus: "ready",
    meetingId: "rcsa-mtg-1",
  },
  {
    id: "rcsa-ev-3",
    time: "14:00",
    title: "First-Line Validation Follow-up",
    kind: "meeting",
    prepStatus: "not-started",
    meetingId: null,
  },
  {
    id: "rcsa-ev-4",
    time: "15:30",
    title: "Risk Committee Preparation",
    kind: "committee",
    prepStatus: "in-progress",
    meetingId: null,
  },
];

const TPRM_STATIC_EVENTS: AgendaEvent[] = [
  {
    id: "tprm-ev-1",
    time: "09:00",
    title: "Onboarding Review: Veridian Document Systems GmbH",
    kind: "review",
    prepStatus: "ready",
    meetingId: "tprm-mtg-1",
  },
  {
    id: "tprm-ev-2",
    time: "10:30",
    title: "Supplier Challenge Call",
    kind: "meeting",
    prepStatus: "ready",
    meetingId: null,
  },
  {
    id: "tprm-ev-3",
    time: "14:00",
    title: "Specialist Review Huddle",
    kind: "meeting",
    prepStatus: "not-started",
    meetingId: null,
  },
  {
    id: "tprm-ev-4",
    time: "16:00",
    title: "Procurement Checkpoint",
    kind: "meeting",
    prepStatus: "not-started",
    meetingId: null,
  },
];

/* ==========================================================================
   Meetings tab
   ========================================================================== */

interface MeetingRow {
  id: string;
  title: string;
  scheduledFor: string;
  participantCount: number;
  status: string;
  prepStatus: string;
  kind: string;
}

interface ArchiveRow {
  id: string;
  title: string;
  date: string;
  archiveStatus: string;
}

function meetingArchiveStatusLabel(status: string): string {
  if (status === "concluded") return "Confirmed";
  if (status === "in-progress") return "In Progress";
  return "Draft";
}

function meetingArchiveStatusTone(status: string): "success" | "info" | "neutral" {
  if (status === "concluded") return "success";
  if (status === "in-progress") return "info";
  return "neutral";
}

function meetingPrepLabel(prepSummary: string): string {
  if (!prepSummary) return "Not prepared";
  return "Ready";
}

function MeetingsView({
  upcoming,
  archive,
  language,
  roleId,
}: {
  upcoming: MeetingRow[];
  archive: ArchiveRow[];
  language: Language;
  roleId: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--wd-8)" }}>
      {/* Upcoming */}
      <section aria-label={pick(LABELS.upcoming, language)}>
        <h2
          style={{
            fontSize: "var(--wd-text-sm)",
            fontWeight: 600,
            color: "var(--wd-text)",
            marginBottom: "var(--wd-3)",
          }}
        >
          {pick(LABELS.upcoming, language)}
        </h2>

        {upcoming.length === 0 ? (
          <p style={{ fontSize: "var(--wd-text-sm)", color: "var(--wd-text-muted)" }}>
            {pick(LABELS.noMeetings, language)}
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--wd-2)" }}>
            {upcoming.map((mtg) => (
              <div
                key={mtg.id}
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
                  <p
                    style={{
                      fontSize: "var(--wd-text-base)",
                      fontWeight: 500,
                      color: "var(--wd-text)",
                      margin: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {mtg.title}
                  </p>
                  <p
                    style={{
                      fontSize: "var(--wd-text-xs)",
                      color: "var(--wd-text-muted)",
                      margin: "var(--wd-1) 0 0",
                    }}
                  >
                    {mtg.scheduledFor}
                    {mtg.participantCount > 0 ? `, ${mtg.participantCount} participants` : ""}
                  </p>
                </div>
                <Badge
                  label={meetingPrepLabel(mtg.prepStatus)}
                  tone={mtg.prepStatus ? "success" : "neutral"}
                />
                <a
                  href={`/workday/${roleId}/work?view=meetings`}
                  style={{
                    flexShrink: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "var(--wd-1) var(--wd-3)",
                    background: "var(--wd-accent)",
                    color: "#fff",
                    fontSize: "var(--wd-text-sm)",
                    fontWeight: 500,
                    borderRadius: "var(--wd-radius)",
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  {pick(LABELS.openMeeting, language)}
                </a>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Minutes archive */}
      <section aria-label={pick(LABELS.archive, language)}>
        <h2
          style={{
            fontSize: "var(--wd-text-sm)",
            fontWeight: 600,
            color: "var(--wd-text)",
            marginBottom: "var(--wd-3)",
          }}
        >
          {pick(LABELS.archive, language)}
        </h2>

        {archive.length === 0 ? (
          <p style={{ fontSize: "var(--wd-text-sm)", color: "var(--wd-text-muted)" }}>
            {pick(LABELS.noArchive, language)}
          </p>
        ) : (
          <div
            style={{
              border: "1px solid var(--wd-border)",
              borderRadius: "var(--wd-radius-lg)",
              overflow: "hidden",
            }}
          >
            {/* Table header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "8rem 1fr 8rem",
                padding: "var(--wd-2) var(--wd-4)",
                background: "var(--wd-surface-subtle)",
                borderBottom: "1px solid var(--wd-border)",
              }}
            >
              <span
                style={{
                  fontSize: "var(--wd-text-xs)",
                  fontWeight: 600,
                  color: "var(--wd-text-muted)",
                }}
              >
                Date
              </span>
              <span
                style={{
                  fontSize: "var(--wd-text-xs)",
                  fontWeight: 600,
                  color: "var(--wd-text-muted)",
                }}
              >
                Meeting
              </span>
              <span
                style={{
                  fontSize: "var(--wd-text-xs)",
                  fontWeight: 600,
                  color: "var(--wd-text-muted)",
                  textAlign: "right",
                }}
              >
                Status
              </span>
            </div>

            {archive.map((row, idx) => (
              <div
                key={row.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "8rem 1fr 8rem",
                  alignItems: "center",
                  padding: "var(--wd-3) var(--wd-4)",
                  background: "var(--wd-surface)",
                  borderBottom:
                    idx < archive.length - 1 ? "1px solid var(--wd-border)" : "none",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--wd-font-mono)",
                    fontSize: "var(--wd-text-xs)",
                    color: "var(--wd-text-muted)",
                  }}
                >
                  {row.date}
                </span>
                <span
                  style={{
                    fontSize: "var(--wd-text-sm)",
                    color: "var(--wd-text)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.title}
                </span>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <Badge
                    label={meetingArchiveStatusLabel(row.archiveStatus)}
                    tone={meetingArchiveStatusTone(row.archiveStatus)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* Static meeting fallbacks */

const RCSA_STATIC_UPCOMING: MeetingRow[] = [
  {
    id: "rcsa-mtg-1",
    title: "RCSA Challenge Workshop: Payments Operations",
    scheduledFor: "Today 10:30",
    participantCount: 4,
    status: "not-started",
    prepStatus: "ready",
    kind: "rcsa-workshop",
  },
  {
    id: "rcsa-mtg-2",
    title: "Risk Committee Preparation Session",
    scheduledFor: "Today 15:30",
    participantCount: 3,
    status: "not-started",
    prepStatus: "",
    kind: "committee",
  },
];

const RCSA_STATIC_ARCHIVE: ArchiveRow[] = [
  {
    id: "rcsa-arc-1",
    title: "RCSA Scoping Workshop: Q4 2026",
    date: "2026-09-25",
    archiveStatus: "concluded",
  },
  {
    id: "rcsa-arc-2",
    title: "First-Line Self-Assessment Review",
    date: "2026-09-18",
    archiveStatus: "concluded",
  },
  {
    id: "rcsa-arc-3",
    title: "Risk Committee Alignment: Q3 Close",
    date: "2026-09-10",
    archiveStatus: "concluded",
  },
];

const TPRM_STATIC_UPCOMING: MeetingRow[] = [
  {
    id: "tprm-mtg-1",
    title: "Onboarding Review: Veridian Document Systems GmbH",
    scheduledFor: "Today 09:00",
    participantCount: 5,
    status: "not-started",
    prepStatus: "ready",
    kind: "supplier-challenge",
  },
  {
    id: "tprm-mtg-2",
    title: "Supplier Challenge Call: Security Controls",
    scheduledFor: "Today 10:30",
    participantCount: 4,
    status: "not-started",
    prepStatus: "ready",
    kind: "supplier-challenge",
  },
];

const TPRM_STATIC_ARCHIVE: ArchiveRow[] = [
  {
    id: "tprm-arc-1",
    title: "Preliminary Due Diligence: Veridian",
    date: "2026-09-28",
    archiveStatus: "concluded",
  },
  {
    id: "tprm-arc-2",
    title: "IT Security Assessment Briefing",
    date: "2026-09-15",
    archiveStatus: "concluded",
  },
  {
    id: "tprm-arc-3",
    title: "Procurement Kickoff: PRQ-2026-0087",
    date: "2026-09-08",
    archiveStatus: "concluded",
  },
];

/* ==========================================================================
   Actions tab
   ========================================================================== */

type ActionFilter = "needs-me" | "waiting-others" | "overdue" | "completed";
const VALID_FILTERS: readonly ActionFilter[] = [
  "needs-me",
  "waiting-others",
  "overdue",
  "completed",
];

function isValidFilter(v: unknown): v is ActionFilter {
  return typeof v === "string" && (VALID_FILTERS as readonly string[]).includes(v);
}

interface ActionRow {
  id: string;
  title: string;
  ownerLabel: string;
  dueOn: string | null;
  status: string;
  kind: string;
  relatedObjectId: string | null;
  origin: string;
}

function actionKindLabel(kind: string): string {
  const map: Record<string, string> = {
    remediation: "Remediation",
    "evidence-request": "Evidence request",
    "validation-request": "Validation request",
    monitoring: "Monitoring",
    reassessment: "Reassessment",
    "exercise-action": "Exercise",
    communication: "Communication",
  };
  return map[kind] ?? kind;
}

function actionStatusTone(status: string): "neutral" | "danger" | "success" | "info" {
  if (status === "overdue") return "danger";
  if (status === "completed") return "success";
  if (status === "in-progress") return "info";
  return "neutral";
}

function ActionFilterNav({
  activeFilter,
  roleId,
  language,
}: {
  activeFilter: ActionFilter;
  roleId: string;
  language: Language;
}) {
  const filters: Array<{ filter: ActionFilter; label: string }> = [
    { filter: "needs-me", label: pick(LABELS.needsMe, language) },
    { filter: "waiting-others", label: pick(LABELS.waitingOthers, language) },
    { filter: "overdue", label: pick(LABELS.overdue, language) },
    { filter: "completed", label: pick(LABELS.completed, language) },
  ];

  return (
    <div
      style={{
        display: "flex",
        gap: "var(--wd-2)",
        marginBottom: "var(--wd-4)",
        flexWrap: "wrap",
      }}
    >
      {filters.map(({ filter, label }) => {
        const isActive = filter === activeFilter;
        return (
          <a
            key={filter}
            href={`/workday/${roleId}/work?view=actions&filter=${filter}`}
            aria-current={isActive ? "page" : undefined}
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "var(--wd-1) var(--wd-3)",
              fontSize: "var(--wd-text-sm)",
              fontWeight: isActive ? 600 : 400,
              color: isActive ? "var(--wd-accent)" : "var(--wd-text-secondary)",
              background: isActive ? "var(--wd-accent-soft)" : "var(--wd-surface-subtle)",
              border: `1px solid ${isActive ? "var(--wd-accent-border)" : "var(--wd-border)"}`,
              borderRadius: "var(--wd-radius-pill)",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </a>
        );
      })}
    </div>
  );
}

function ActionsView({
  rows,
  language,
}: {
  rows: ActionRow[];
  language: Language;
  roleId: string;
}) {
  if (rows.length === 0) {
    return (
      <p style={{ fontSize: "var(--wd-text-sm)", color: "var(--wd-text-muted)" }}>
        {pick(LABELS.noActions, language)}
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--wd-2)" }}>
      {rows.map((action) => (
        <div
          key={action.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--wd-4)",
            padding: "var(--wd-3) var(--wd-4)",
            background: "var(--wd-surface)",
            border: `1px solid ${action.status === "overdue" ? "var(--wd-danger)" : "var(--wd-border)"}`,
            borderRadius: "var(--wd-radius-lg)",
            boxShadow: "var(--wd-shadow-sm)",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontSize: "var(--wd-text-base)",
                fontWeight: 500,
                color: "var(--wd-text)",
                margin: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {action.title}
            </p>
            <p
              style={{
                fontSize: "var(--wd-text-xs)",
                color: "var(--wd-text-muted)",
                margin: "var(--wd-1) 0 0",
              }}
            >
              {action.ownerLabel ? `${action.ownerLabel}: ` : ""}
              {action.relatedObjectId ?? action.origin}
            </p>
          </div>

          <Badge label={actionKindLabel(action.kind)} tone="neutral" />

          {action.dueOn ? (
            <span
              style={{
                fontSize: "var(--wd-text-xs)",
                fontFamily: "var(--wd-font-mono)",
                color:
                  action.status === "overdue"
                    ? "var(--wd-danger)"
                    : "var(--wd-text-muted)",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {pick(LABELS.due, language)} {action.dueOn}
            </span>
          ) : null}

          <Badge
            label={action.status.charAt(0).toUpperCase() + action.status.slice(1).replace("-", " ")}
            tone={actionStatusTone(action.status)}
          />
        </div>
      ))}
    </div>
  );
}

/* Static action fallbacks */

const RCSA_STATIC_ACTIONS: ActionRow[] = [
  {
    id: "rcsa-act-1",
    title: "Collect Q3 KRI data from Risk Operations",
    ownerLabel: "Risk Operations",
    dueOn: "2026-10-10",
    status: "open",
    kind: "evidence-request",
    relatedObjectId: "RCSA-ARC-DE-PAYOPS-2026-Q4",
    origin: "RCSA cycle stage 2",
  },
  {
    id: "rcsa-act-2",
    title: "First-line sign-off on scope confirmation",
    ownerLabel: "First Line",
    dueOn: "2026-10-08",
    status: "overdue",
    kind: "validation-request",
    relatedObjectId: "RCSA-ARC-DE-PAYOPS-2026-Q4",
    origin: "RCSA cycle stage 1",
  },
  {
    id: "rcsa-act-3",
    title: "Confirm rating committee slot",
    ownerLabel: "Committee Secretariat",
    dueOn: "2026-10-15",
    status: "open",
    kind: "communication",
    relatedObjectId: null,
    origin: "Risk committee preparation",
  },
];

const TPRM_STATIC_ACTIONS: ActionRow[] = [
  {
    id: "tprm-act-1",
    title: "Obtain penetration test report from Veridian",
    ownerLabel: "Veridian Contact",
    dueOn: "2026-10-09",
    status: "open",
    kind: "evidence-request",
    relatedObjectId: "TP-VERIDIAN-2026",
    origin: "Onboarding stage 3",
  },
  {
    id: "tprm-act-2",
    title: "Request BCM plan from Veridian",
    ownerLabel: "Veridian Contact",
    dueOn: "2026-10-07",
    status: "overdue",
    kind: "evidence-request",
    relatedObjectId: "TP-VERIDIAN-2026",
    origin: "Onboarding stage 3",
  },
  {
    id: "tprm-act-3",
    title: "Legal review of subprocessor clause",
    ownerLabel: "Legal",
    dueOn: "2026-10-12",
    status: "open",
    kind: "validation-request",
    relatedObjectId: null,
    origin: "Contract review",
  },
];

function filterActions(rows: ActionRow[], filter: ActionFilter): ActionRow[] {
  switch (filter) {
    case "needs-me":
      return rows.filter((r) => r.status === "open" || r.status === "in-progress");
    case "waiting-others":
      return rows.filter((r) => !!r.ownerLabel && r.status !== "completed" && r.status !== "overdue");
    case "overdue":
      return rows.filter((r) => r.status === "overdue");
    case "completed":
      return rows.filter((r) => r.status === "completed");
    default:
      return rows;
  }
}

/* ==========================================================================
   Inbox tab
   ========================================================================== */

interface InboxItem {
  id: string;
  channel: string;
  fromLabel: string;
  subject: string;
  receivedAt: string;
  triage: string;
}

function channelLabel(channel: string): string {
  const map: Record<string, string> = {
    "grc-queue": "GRC Queue",
    mail: "Mail",
    collaboration: "Collaboration",
    "service-management": "Service Mgmt",
    alert: "Alert",
  };
  return map[channel] ?? channel;
}

function triageTone(triage: string): "danger" | "warning" | "success" | "ai" | "neutral" {
  if (triage === "decision") return "danger";
  if (triage === "action") return "warning";
  if (triage === "evidence") return "success";
  if (triage === "information") return "ai";
  return "neutral";
}

function triageLabel(triage: string): string {
  const map: Record<string, string> = {
    decision: "Decision",
    action: "Action",
    evidence: "Evidence",
    information: "Information",
    delegate: "Delegate",
    noise: "Noise",
  };
  return map[triage] ?? triage;
}

function InboxView({
  items,
  language,
  roleId,
}: {
  items: InboxItem[];
  language: Language;
  roleId: string;
}) {
  if (items.length === 0) {
    return (
      <p style={{ fontSize: "var(--wd-text-sm)", color: "var(--wd-text-muted)" }}>
        {pick(LABELS.noInbox, language)}
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--wd-2)" }}>
      {items.map((item) => (
        <div
          key={item.id}
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
          {/* Source badge */}
          <Badge label={channelLabel(item.channel)} tone="neutral" />

          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontSize: "var(--wd-text-base)",
                fontWeight: 500,
                color: "var(--wd-text)",
                margin: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {item.subject}
            </p>
            <p
              style={{
                fontSize: "var(--wd-text-xs)",
                color: "var(--wd-text-muted)",
                margin: "var(--wd-1) 0 0",
              }}
            >
              {item.fromLabel}
            </p>
          </div>

          {/* Received time */}
          <span
            style={{
              fontSize: "var(--wd-text-xs)",
              fontFamily: "var(--wd-font-mono)",
              color: "var(--wd-text-muted)",
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}
          >
            {item.receivedAt}
          </span>

          {/* AI triage badge */}
          <Badge label={`AI: ${triageLabel(item.triage)}`} tone={triageTone(item.triage)} />

          {/* Review link */}
          <a
            href={`/workday/${roleId}/work?view=inbox`}
            style={{
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              padding: "var(--wd-1) var(--wd-3)",
              fontSize: "var(--wd-text-sm)",
              fontWeight: 500,
              color: "var(--wd-accent)",
              border: "1px solid var(--wd-accent-border)",
              borderRadius: "var(--wd-radius)",
              textDecoration: "none",
              background: "var(--wd-accent-soft)",
              whiteSpace: "nowrap",
            }}
          >
            {pick(LABELS.review, language)}
          </a>
        </div>
      ))}
    </div>
  );
}

/* Static inbox fallbacks */

const RCSA_STATIC_INBOX: InboxItem[] = [
  {
    id: "rcsa-msg-1",
    channel: "grc-queue",
    fromLabel: "Risk Operations",
    subject: "Q3 KRI Data Submission",
    receivedAt: "Today 08:15",
    triage: "evidence",
  },
  {
    id: "rcsa-msg-2",
    channel: "mail",
    fromLabel: "Compliance",
    subject: "RCSA Cycle Start Notification",
    receivedAt: "Yesterday",
    triage: "action",
  },
  {
    id: "rcsa-msg-3",
    channel: "collaboration",
    fromLabel: "Finance",
    subject: "Evidence gap: please review",
    receivedAt: "Today 09:30",
    triage: "decision",
  },
];

const TPRM_STATIC_INBOX: InboxItem[] = [
  {
    id: "tprm-msg-1",
    channel: "grc-queue",
    fromLabel: "Veridian",
    subject: "Penetration Test Report Update",
    receivedAt: "Today 09:00",
    triage: "evidence",
  },
  {
    id: "tprm-msg-2",
    channel: "mail",
    fromLabel: "Procurement",
    subject: "PRQ-2026-0087 Approval Required",
    receivedAt: "Today 08:45",
    triage: "decision",
  },
  {
    id: "tprm-msg-3",
    channel: "collaboration",
    fromLabel: "IT Security",
    subject: "Security assessment complete",
    receivedAt: "Yesterday",
    triage: "information",
  },
];

/* ==========================================================================
   Main component
   ========================================================================== */

export default async function WorkV3({
  params,
  searchParams,
}: {
  params: Promise<{ role: string }>;
  searchParams?: RouteQuery;
}) {
  const { role } = await params;
  const roleId = parseRole(role);

  const state = getScenarioState();
  const language = ((state?.language ?? "en") as Language);

  /* Resolve active tab */
  const viewParam = searchParams?.view;
  const activeView: ViewTab = isValidView(viewParam) ? viewParam : "agenda";

  /* Resolve action filter */
  const filterParam = searchParams?.filter;
  const activeFilter: ActionFilter = isValidFilter(filterParam) ? filterParam : "needs-me";

  /* Context line per role */
  const contextLine =
    roleId === "rcsa"
      ? pick(LABELS.contextRcsa, language)
      : pick(LABELS.contextTprm, language);

  /* DB availability check */
  const dbReady = isDatabaseReady() && !!state;

  /* -----------------------------------------------------------------------
     Build agenda data
  ----------------------------------------------------------------------- */
  let agendaEvents: AgendaEvent[] = [];

  if (dbReady) {
    const calRows = getCalendar(roleId);
    if (calRows.length > 0) {
      agendaEvents = calRows.map((row) => ({
        id: row.id,
        /* startsAt is ISO datetime; slice(11,16) gives "HH:MM" */
        time: row.startsAt.length >= 16 ? row.startsAt.slice(11, 16) : row.startsAt,
        title: language === "de" && row.titleDe ? row.titleDe : row.title,
        kind: row.kind,
        prepStatus: row.preparationStatus,
        meetingId: row.meetingId ?? null,
      }));
    }
  }

  if (agendaEvents.length === 0) {
    agendaEvents = roleId === "rcsa" ? RCSA_STATIC_EVENTS : TPRM_STATIC_EVENTS;
  }

  /* -----------------------------------------------------------------------
     Build meetings data
  ----------------------------------------------------------------------- */
  let upcomingMeetings: MeetingRow[] = [];
  let archiveMeetings: ArchiveRow[] = [];

  if (dbReady) {
    const mtgRows = getMeetings(roleId);
    if (mtgRows.length > 0) {
      upcomingMeetings = mtgRows
        .filter((m) => m.status !== "concluded")
        .map((m) => ({
          id: m.id,
          title: language === "de" && m.titleDe ? m.titleDe : m.title,
          scheduledFor: m.scheduledFor,
          participantCount: m.participantUserIds.length,
          status: m.status,
          prepStatus: m.preparationSummary,
          kind: m.kind,
        }));
      archiveMeetings = mtgRows
        .filter((m) => m.status === "concluded")
        .slice(0, 5)
        .map((m) => ({
          id: m.id,
          title: language === "de" && m.titleDe ? m.titleDe : m.title,
          date: m.scheduledFor.slice(0, 10),
          archiveStatus: m.status,
        }));
    }
  }

  if (upcomingMeetings.length === 0 && archiveMeetings.length === 0) {
    upcomingMeetings = roleId === "rcsa" ? RCSA_STATIC_UPCOMING : TPRM_STATIC_UPCOMING;
    archiveMeetings = roleId === "rcsa" ? RCSA_STATIC_ARCHIVE : TPRM_STATIC_ARCHIVE;
  }

  /* -----------------------------------------------------------------------
     Build actions data
  ----------------------------------------------------------------------- */
  let allActions: ActionRow[] = [];

  if (dbReady) {
    const actRows = getActions({ roleId });
    if (actRows.length > 0) {
      allActions = actRows.map((a) => ({
        id: a.id,
        title: language === "de" && a.titleDe ? a.titleDe : a.title,
        ownerLabel: a.ownerLabel ?? "",
        dueOn: a.dueOn ?? null,
        status: a.status,
        kind: a.kind,
        relatedObjectId: a.relatedObjectId ?? null,
        origin: a.reference,
      }));
    }
  }

  if (allActions.length === 0) {
    allActions = roleId === "rcsa" ? RCSA_STATIC_ACTIONS : TPRM_STATIC_ACTIONS;
  }

  const filteredActions = filterActions(allActions, activeFilter);

  /* -----------------------------------------------------------------------
     Build inbox data
  ----------------------------------------------------------------------- */
  let inboxItems: InboxItem[] = [];

  if (dbReady && state) {
    const msgRows = getInbox(roleId, state.currentMoment);
    if (msgRows.length > 0) {
      inboxItems = msgRows
        .filter((m) => m.proposedTriage !== "noise")
        .slice(0, 10)
        .map((m) => ({
          id: m.id,
          channel: m.channel,
          fromLabel: m.fromLabel,
          subject: language === "de" && m.subjectDe ? m.subjectDe : m.subject,
          receivedAt: m.receivedAt,
          triage: m.proposedTriage,
        }));
    }
  }

  if (inboxItems.length === 0) {
    inboxItems = roleId === "rcsa" ? RCSA_STATIC_INBOX : TPRM_STATIC_INBOX;
  }

  /* -----------------------------------------------------------------------
     Render
  ----------------------------------------------------------------------- */
  return (
    <div
      className="wd-main-inner"
      data-presentation-region={roleId === "rcsa" ? "rcsa-work-hub" : "tprm-work-hub"}
      data-presentation-ready="true"
    >
      <h1 className="wd-page-title">{pick(LABELS.title, language)}</h1>
      <p className="wd-context-line" style={{ marginTop: "var(--wd-1)" }}>
        {contextLine}
      </p>

      <div style={{ marginTop: "var(--wd-6)" }}>
        <TabNav activeView={activeView} roleId={roleId} language={language} />

        {activeView === "agenda" && (
          <section aria-label={pick(LABELS.tabs.agenda, language)}>
            <AgendaView events={agendaEvents} language={language} roleId={roleId} />
          </section>
        )}

        {activeView === "meetings" && (
          <section aria-label={pick(LABELS.tabs.meetings, language)}>
            <MeetingsView
              upcoming={upcomingMeetings}
              archive={archiveMeetings}
              language={language}
              roleId={roleId}
            />
          </section>
        )}

        {activeView === "actions" && (
          <section aria-label={pick(LABELS.tabs.actions, language)}>
            <ActionFilterNav
              activeFilter={activeFilter}
              roleId={roleId}
              language={language}
            />
            <ActionsView
              rows={filteredActions}
              language={language}
              roleId={roleId}
            />
          </section>
        )}

        {activeView === "inbox" && (
          <section aria-label={pick(LABELS.tabs.inbox, language)}>
            <InboxView items={inboxItems} language={language} roleId={roleId} />
          </section>
        )}
      </div>

      <span
        style={{
          display: "block",
          marginTop: "var(--wd-8)",
          fontSize: 12,
          color: "var(--wd-text-muted)",
        }}
      >
        {pick(LABELS.synthetic, language)}
      </span>
    </div>
  );
}
