/**
 * The calendar, as a single day column.
 *
 * Entries are rows ordered by start time, with the conflict and the
 * preparation state on the row rather than in a separate panel. The thing this
 * surface has to make visible is the difference between an entry someone
 * prepared for and an entry nobody has looked at, because in the current
 * reality the preparation is manual and it is the first thing to slip.
 */

import { getCalendar, getMeetings, getUserNameMap } from "@/db/repositories/workday";
import type { RoleId } from "@/db/schema/core";
import type { Language } from "@/i18n/labels";
import { Chip, Data, Empty, Item, List, SectionHead, type Tone } from "../primitives";

const PREPARATION_LABELS: Record<string, { en: string; de: string; tone: Tone }> = {
  "not-started": { en: "not prepared", de: "nicht vorbereitet", tone: "warning" },
  "in-progress": { en: "preparing", de: "in Vorbereitung", tone: "info" },
  prepared: { en: "prepared", de: "vorbereitet", tone: "success" },
  complete: { en: "prepared", de: "vorbereitet", tone: "success" },
};

const KIND_LABELS: Record<string, { en: string; de: string }> = {
  workshop: { en: "Workshop", de: "Workshop" },
  meeting: { en: "Meeting", de: "Besprechung" },
  committee: { en: "Committee", de: "Gremium" },
  "focus-time": { en: "Focus time", de: "Fokuszeit" },
  "crisis-call": { en: "Crisis call", de: "Krisenschaltung" },
};

export function CalendarSection({
  roleId,
  language,
}: {
  roleId: RoleId;
  language: Language;
}) {
  const entries = getCalendar(roleId);
  const meetings = getMeetings(roleId);
  const names = getUserNameMap();
  const meetingById = new Map(meetings.map((meeting) => [meeting.id, meeting]));

  if (entries.length === 0) {
    return <Empty title={language === "de" ? "Keine Eintraege heute" : "Nothing in the calendar today"} />;
  }

  const conflicts = entries.filter((entry) => entry.hasConflict).length;
  const unprepared = entries.filter(
    (entry) => entry.preparationStatus === "not-started" && entry.kind !== "focus-time",
  ).length;

  return (
    <div className="app-stack-5">
      <p className="app-one-line">
        {language === "de"
          ? `${entries.length} Eintraege. ${conflicts} Ueberschneidungen, ${unprepared} ohne Vorbereitung.`
          : `${entries.length} entries. ${conflicts} overlap, ${unprepared} have no preparation.`}
      </p>

      <section className="app-section">
        <SectionHead title={language === "de" ? "Der Tag" : "The day"} count={entries.length} />
        <List label={language === "de" ? "Kalender" : "Calendar"}>
          {entries.map((entry) => {
            const preparation =
              PREPARATION_LABELS[entry.preparationStatus] ?? PREPARATION_LABELS["not-started"];
            const meeting = entry.meetingId ? meetingById.get(entry.meetingId) : undefined;
            const kind = KIND_LABELS[entry.kind];

            return (
              <Item
                key={entry.id}
                large
                /*
                 * Start and end on two lines in tabular figures, so the eye
                 * reads the column of times as a column rather than having to
                 * parse each cell.
                 */
                leading={
                  <span className="app-stack-1" style={{ width: 44 }}>
                    <Data size="sm">{entry.startsAt.slice(11, 16)}</Data>
                    <Data>{entry.endsAt.slice(11, 16)}</Data>
                  </span>
                }
                title={language === "de" && entry.titleDe ? entry.titleDe : entry.title}
                subtitle={
                  <>
                    {kind ? (language === "de" ? kind.de : kind.en) : entry.kind}
                    {entry.location ? ` · ${entry.location}` : ""}
                    {entry.attendeeUserIds.length > 0
                      ? ` · ${entry.attendeeUserIds
                          .map((id) => names.get(id) ?? id)
                          .slice(0, 2)
                          .join(", ")}${entry.attendeeUserIds.length > 2 ? ` +${entry.attendeeUserIds.length - 2}` : ""}`
                      : ""}
                  </>
                }
                trailing={
                  <>
                    {entry.hasConflict ? (
                      <Chip tone="danger">
                        {language === "de" ? "Ueberschneidung" : "overlap"}
                      </Chip>
                    ) : null}
                    {entry.kind === "focus-time" ? null : (
                      <Chip tone={preparation?.tone ?? "neutral"}>
                        {language === "de" ? preparation?.de : preparation?.en}
                      </Chip>
                    )}
                  </>
                }
                {...(meeting ? { href: `/workday/${roleId}/meetings#${meeting.id}` } : {})}
              >
                {entry.agenda ? (
                  <span className="app-meta app-clamp-2" style={{ marginTop: 2 }}>
                    {entry.agenda}
                  </span>
                ) : null}
              </Item>
            );
          })}
        </List>
      </section>
    </div>
  );
}
