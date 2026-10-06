/**
 * Partner update: what the AI Partner actually did today, with lineage.
 *
 * This replaces Partner Pulse, and it is worth recording what Partner Pulse
 * was so the replacement is judged against it. It was a strip in the route
 * file whose entire content was two hard coded sentences, one per role: the
 * operational risk partner was told the partner had "followed up 2 overdue
 * actions on Q4 evidence refresh, and triaged 4 inbox items", the third party
 * manager that it had "drafted reminder for missing penetration test report".
 * It rendered whenever any routine row was active, whatever the routines had
 * or had not done, and in German as well as English. None of it was read from
 * the database.
 *
 * Every statement here is built by `assemblePartnerUpdate` from a row that
 * records the work, and carries the references that row created or touched.
 * The statement text links to the first of them, and the line beneath lists
 * each one, so "Requested 4 missing items" shows the four items. With nothing
 * recorded, the section says so and says what would appear here; it does not
 * disappear, because an empty update is itself information.
 */

import type { Language } from "@/i18n/labels";
import { fill, HOME_COPY as C, pick } from "@/features/home/copy";
import type { PartnerStatement, PartnerUpdate } from "@/features/home/types";
import { WorkdayDisclosure } from "../WorkdayDisclosure";

/** How many references a row lists before it says "+n". */
const REFS_SHOWN = 3;

function StatementRow({ statement }: { statement: PartnerStatement }) {
  const primary = statement.lineage[0];
  const shown = statement.lineage.slice(0, REFS_SHOWN);
  const hidden = statement.lineage.length - shown.length;

  return (
    <div className="wd-item" data-partner-statement={statement.id} data-source={statement.source}>
      <span className="wd-item-main">
        {primary ? (
          <a className="wd-item-title" href={primary.href} style={{ textDecoration: "none" }}>
            {statement.text}
          </a>
        ) : (
          <span className="wd-item-title">{statement.text}</span>
        )}
        <span className="wd-item-sub" data-lineage-count={statement.lineage.length}>
          {shown.map((ref, index) => (
            <span key={`${ref.kind}:${ref.id}`}>
              {index > 0 ? ", " : null}
              <a href={ref.href} data-lineage-kind={ref.kind} style={{ color: "inherit" }}>
                {ref.label}
              </a>
            </span>
          ))}
          {hidden > 0 ? ` +${hidden}` : null}
        </span>
      </span>
      {statement.atMoment ? (
        <span className="wd-mono wd-shrink-0 wd-muted">{statement.atMoment}</span>
      ) : null}
    </div>
  );
}

export function HomePartnerUpdate({
  language,
  partner,
}: {
  language: Language;
  partner: PartnerUpdate;
}) {
  const label = pick(C.partnerUpdate, language);

  return (
    <section
      className="wd-section"
      aria-label={label}
      data-home-region="partner-update"
      data-state={partner.state}
    >
      <div className="wd-section-head">
        <h2 className="wd-section-label">{label}</h2>
      </div>

      {partner.state === "present" ? (
        <>
          <div className="wd-list">
            {partner.statements.map((statement) => (
              <StatementRow key={statement.id} statement={statement} />
            ))}
          </div>
          {partner.more.length > 0 ? (
            <div style={{ marginTop: "var(--wd-2)" }}>
              <WorkdayDisclosure
                label={fill(pick(C.partnerMore, language), { n: partner.more.length })}
                language={language}
              >
                <div className="wd-list">
                  {partner.more.map((statement) => (
                    <StatementRow key={statement.id} statement={statement} />
                  ))}
                </div>
              </WorkdayDisclosure>
            </div>
          ) : null}
        </>
      ) : (
        <div className="wd-empty" style={{ padding: "var(--wd-3) 0" }}>
          <span className="wd-empty-title">
            {partner.state === "unavailable"
              ? pick(C.unavailable, language)
              : pick(C.partnerEmptyTitle, language)}
          </span>
          <span>
            {partner.state === "unavailable"
              ? pick(C.partnerUnavailable, language)
              : pick(C.partnerEmptyBody, language)}
          </span>
        </div>
      )}
    </section>
  );
}
