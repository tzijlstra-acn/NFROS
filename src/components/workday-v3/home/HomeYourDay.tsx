/**
 * Your day: the next meeting, the open actions and the inbox, as real counts.
 *
 * This replaces the strip that used to live in the route file, and the reason
 * is the strip's own comment: "Static fallbacks are role-appropriate counts
 * used when the DB has no rows for the role yet." With the actions table empty
 * it showed four open actions for the operational risk partner and three for
 * the third party manager, and with the inbox empty it showed two messages
 * needing attention. A professional was shown work that did not exist.
 *
 * Every value now comes from the read model, which states an empty cell in
 * words ("No open actions") and an unreadable one as Unavailable. Nothing here
 * decides what the numbers are; it only lays them out.
 *
 * It sits below the collapsed Done on purpose. The opening viewport budget at
 * 1366x768 does not include it, and above Done it pushed Done past the fold.
 */

import type { Language } from "@/i18n/labels";
import { HOME_COPY as C, pick } from "@/features/home/copy";
import type { HomeState, YourDay } from "@/features/home/types";

/** Overdue or blocked actions take the warning tone; nothing else on the strip does. */
function tone(kind: "meeting" | "actions" | "inbox", state: HomeState, attention: number): string {
  if (state !== "present") return "var(--wd-text-secondary)";
  if (kind === "actions") return attention > 0 ? "var(--wd-warning)" : "var(--wd-text)";
  if (kind === "inbox") return "var(--wd-info)";
  return "var(--wd-text)";
}

export function HomeYourDay({
  roleId,
  language,
  yourDay,
}: {
  roleId: string;
  language: Language;
  yourDay: YourDay;
}) {
  const cells = [
    {
      id: "next-meeting",
      heading: pick(C.nextMeeting, language),
      value: yourDay.meeting.value,
      href: yourDay.meeting.href,
      state: yourDay.meeting.state,
      color: tone("meeting", yourDay.meeting.state, 0),
    },
    {
      id: "actions",
      heading: pick(C.openActions, language),
      value: yourDay.actions.value,
      href: yourDay.actions.href,
      state: yourDay.actions.state,
      color: tone("actions", yourDay.actions.state, yourDay.actions.overdue + yourDay.actions.blocked),
    },
    {
      id: "inbox",
      heading: pick(C.inbox, language),
      value: yourDay.inbox.value,
      href: yourDay.inbox.href,
      state: yourDay.inbox.state,
      color: tone("inbox", yourDay.inbox.state, 0),
    },
  ];

  return (
    <section className="wd-section" aria-label={pick(C.yourDay, language)} data-home-region="your-day">
      <div className="wd-section-head">
        <h2 className="wd-section-label">{pick(C.yourDay, language)}</h2>
        <a className="wd-btn wd-btn-link wd-btn-sm" href={`/workday/${roleId}/work`}>
          {pick(C.openWorkHub, language)}
        </a>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "var(--wd-3)",
        }}
      >
        {cells.map((cell) => (
          <a
            key={cell.id}
            href={cell.href}
            data-home-cell={cell.id}
            data-state={cell.state}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--wd-1)",
              minWidth: 0,
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
              }}
            >
              {cell.heading}
            </span>
            <span
              title={cell.value}
              style={{
                fontSize: "var(--wd-text-sm)",
                fontWeight: cell.state === "present" ? 600 : 500,
                color: cell.color,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {cell.value}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
