/**
 * The role home. Now, Next, Done.
 *
 * One mental model for every role, with role native objects inside it. The
 * structure is fixed so that a person who learns one role's home can read any
 * of them; the queue columns and the vocabulary are what differ.
 *
 * THE INFORMATION BUDGET is the design constraint rather than a review note.
 * At 1366x768 the opening viewport carries:
 *
 *   one page title and one line of context;
 *   one active item (Now);
 *   up to three Next rows;
 *   one inline AI suggestion;
 *   a collapsed Done, beside a collapsed Watching.
 *
 * Everything else is below the fold or a click away: Your day and the Partner
 * update come after Done, in that order. That budget is what makes the five
 * second test possible: there is only one thing with the strongest treatment,
 * so there is only one place to look. `tests/e2e/workday-v3-density.spec.ts`
 * measures it.
 *
 * TRUTH. Nothing here computes domain state and nothing here supplies a
 * value. Every region renders what `readHomeView` in `src/features/home`
 * returned, and that read model states an empty region in words rather than
 * filling it. There used to be three places a fabricated value could enter
 * this screen: fallback counts for actions and inbox, a first-calendar-row
 * "next meeting" that ignored the clock, and a hard coded Partner Pulse. All
 * three are gone, and the unit test for the read model asserts that an empty
 * database produces an empty Home.
 */

import { IconArrowRight, IconCheck, IconSparkles } from "@tabler/icons-react";
import type { FocusItemView } from "@/workday/contracts";
import { momentAge } from "@/workday/contracts";
import type { Language } from "@/i18n/labels";
import { HOME_COPY as HC, fill } from "@/features/home/copy";
import { doneKindLabel, doneSummaryLine } from "@/features/home/assemble";
import type { HomeNow, HomeView } from "@/features/home/types";
import { WorkdayDisclosure } from "./WorkdayDisclosure";
import { WorkdayEvidenceTrigger } from "./WorkdayEvidenceTrigger";
import { HomeYourDay } from "./home/HomeYourDay";
import { HomePartnerUpdate } from "./home/HomePartnerUpdate";

const COPY = {
  today: { en: "Today", de: "Heute" },
  now: { en: "Needs you now", de: "Benoetigt Sie jetzt" },
  next: { en: "Next", de: "Danach" },
  watching: { en: "Watching", de: "Beobachtung" },
  viewAll: { en: "View all", de: "Alle anzeigen" },
  nothing: { en: "Nothing needs your attention.", de: "Nichts benoetigt Ihre Aufmerksamkeit." },
  nothingBody: {
    en: "A decision, an escalation or prepared work that needs you appears here as it arrives.",
    de: "Eine Entscheidung, eine Eskalation oder vorbereitete Arbeit, die Sie benoetigt, erscheint hier, sobald sie eingeht.",
  },
  prepared: { en: "AI prepared", de: "KI hat vorbereitet" },
  review: { en: "Review preparation", de: "Vorbereitung ansehen" },
} as const;

const pick = (pair: { en: string; de: string }, language: Language) =>
  language === "de" ? pair.de : pair.en;

/**
 * By when, in the words the data supports.
 *
 * A due time is shown when the item carries one. When it does not, the card
 * says that no due time is recorded and how long the item has waited, rather
 * than leaving the question unanswered or implying a deadline.
 */
function byWhen(now: HomeNow, current: string, language: Language): React.ReactNode {
  const due = now.detail.item.dueMoment;
  if (due) {
    return (
      <>
        {pick(HC.due, language)} <strong>{due}</strong>
      </>
    );
  }
  const arrived = now.detail.item.arrivedAtMoment;
  const age = momentAge(arrived, current, language);
  const waited =
    age === momentAge(current, current, language)
      ? pick(HC.arrivedJustNow, language)
      : fill(pick(HC.arrived, language), { age });
  return `${pick(HC.noDueRecorded, language)}, ${waited}`;
}

/**
 * The subject of the item, named in the reader's own professional language.
 *
 * The lead-in above the heading has now been wrong twice, and the second time
 * is the instructive one.
 *
 * It started as `humanAction`, so the card said `Record the decision`
 * directly above a primary button saying `Record the decision`. Replacing it
 * with the item's `objectType` fixed the stutter and introduced a quieter
 * version of the same fault: `objectType` for a decision is the literal
 * string `decision`, so all six professions were given the word `Decision`
 * and told nothing.
 *
 * `relatedObjectKind` is the subject. A control tester sees `Test case`, a
 * resilience lead sees `Impact tolerance`, a third party manager sees
 * `Supplier`, and the identifier beside it is the record they will open. The
 * keys are the seventeen values `decisions.related_object_kind` actually
 * holds, read from the database rather than guessed.
 */
const SUBJECT_LABEL: Record<string, { en: string; de: string }> = {
  action: { en: "Action", de: "Massnahme" },
  assessment: { en: "Assessment", de: "Bewertung" },
  committee: { en: "Committee", de: "Ausschuss" },
  contract: { en: "Contract", de: "Vertrag" },
  control: { en: "Control", de: "Kontrolle" },
  "control-test": { en: "Control test", de: "Kontrolltest" },
  "impact-tolerance": { en: "Impact tolerance", de: "Auswirkungstoleranz" },
  incident: { en: "Incident", de: "Vorfall" },
  kri: { en: "Indicator", de: "Indikator" },
  obligation: { en: "Obligation", de: "Pflicht" },
  "portfolio-theme": { en: "Portfolio theme", de: "Portfoliothema" },
  risk: { en: "Risk", de: "Risiko" },
  runbook: { en: "Runbook", de: "Ablaufplan" },
  service: { en: "Service", de: "Dienstleistung" },
  subprocessor: { en: "Subprocessor", de: "Unterauftragsverarbeiter" },
  supplier: { en: "Supplier", de: "Lieferant" },
  "test-case": { en: "Test case", de: "Testfall" },
};

/**
 * The lead-in for a queue entry that is its own subject.
 *
 * A background work row or a live event has no separate related object, so
 * there is nothing to name but the entry itself.
 */
const KIND_LABEL: Record<string, { en: string; de: string }> = {
  suggestion: { en: "Prepared by AI", de: "Von KI vorbereitet" },
  incident: { en: "Incident", de: "Vorfall" },
  kri: { en: "Indicator breach", de: "Indikatorverletzung" },
  supplier: { en: "Supplier", de: "Lieferant" },
  service: { en: "Service", de: "Dienstleistung" },
  action: { en: "Action", de: "Massnahme" },
  obligation: { en: "Obligation", de: "Pflicht" },
  "committee-item": { en: "Committee item", de: "Ausschusspunkt" },
  evidence: { en: "Evidence", de: "Nachweis" },
  "background-work": { en: "Background work", de: "Hintergrundarbeit" },
};

/** The lead-in text: the subject and its identifier, or the entry's own kind. */
function subjectLine(item: FocusItemView, language: Language): string | null {
  const kind = item.relatedObjectKind;
  const id = item.relatedObjectId;
  if (kind && SUBJECT_LABEL[kind]) {
    const label = language === "de" ? SUBJECT_LABEL[kind]!.de : SUBJECT_LABEL[kind]!.en;
    return id ? `${label} ${id}` : label;
  }
  const own = KIND_LABEL[item.objectType];
  if (own) return language === "de" ? own.de : own.en;
  return item.humanAction;
}

/** A short label in front of a line of the Now card. Quiet, so the content leads. */
function LineLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontWeight: "var(--wd-weight-medium)", color: "var(--wd-text)", marginRight: "var(--wd-2)" }}>
      {children}
    </span>
  );
}

export interface RoleHomeProps {
  view: HomeView;
}

export function RoleHome({ view }: RoleHomeProps) {
  const { language, now, next, watching, suggestion, done } = view;
  const current = view.atMoment;

  return (
    <div className="wd-main-inner" data-presentation-region="role-home" data-presentation-ready="true">
      {/*
        * The page says what day it is, and nothing the header already said.
        *
        * There were three lines here and two of them were duplication. The
        * breadcrumb read `Operational risk / Arcadia Bank AG` and the title
        * read `Operational Risk Partner`, directly under a header that
        * already carried `Operational Risk Partner` and `Arcadia Bank AG`
        * verbatim. A first-week analyst was given the entity twice and their
        * own job title twice before reaching anything they could act on.
        *
        * The title is also deliberately no longer the largest text on the
        * screen. The work item is the largest thing in the main region, which
        * is the rule the brief sets.
        */}
      <h1 className="wd-page-title">{pick(COPY.today, language)}</h1>
      <p className="wd-context-line" style={{ marginTop: "var(--wd-1)" }}>
        {view.contextLine}
      </p>

      {/* ---------------- Now ---------------- */}
      <section className="wd-section" aria-label={pick(COPY.now, language)} data-home-region="now">
        {/*
          * The label is VISIBLE, not only an accessible name, so all three
          * words of the Now, Next, Done model are on the screen.
          */}
        <h2 className="wd-section-label wd-section-label-now">{pick(COPY.now, language)}</h2>
        {now ? (
          <div className="wd-now" data-severity={now.detail.item.severity}>
            <div className="wd-stack-3">
              {/*
                * The subject is the lead-in and the item title the heading.
                * `humanAction` is an action CLASS shared by every item of
                * its kind, so as a heading it made four different judgments
                * look like one thing repeated. The primary button carries the
                * verb, which is where a reader looks for what to do.
                */}
              {subjectLine(now.detail.item, language) ? (
                <span className="wd-now-verb">{subjectLine(now.detail.item, language)}</span>
              ) : null}
              <h2 className="wd-now-action">{now.detail.item.title}</h2>

              {/*
                * The card answers four questions in order: what changed, why
                * it matters, what to do (the primary button) and by when. A
                * line whose answer no row records is left out rather than
                * filled, which is why `whatChanged` is optional and the
                * timing line can say that no due time is recorded.
                *
                * What changed is clamped to one line. The full sentence is in
                * the title attribute and in the item itself; the card's job is
                * to say that something moved and roughly what.
                */}
              {now.whatChanged ? (
                <p
                  className="wd-now-reason"
                  data-now-line="what-changed"
                  title={now.whatChanged}
                  style={{
                    display: "-webkit-box",
                    WebkitBoxOrient: "vertical",
                    WebkitLineClamp: 1,
                    overflow: "hidden",
                  }}
                >
                  <LineLabel>{pick(HC.whatChanged, language)}</LineLabel>
                  {now.whatChanged}
                </p>
              ) : null}

              <p className="wd-now-reason" data-now-line="why">
                <LineLabel>{pick(HC.whyItMatters, language)}</LineLabel>
                {now.detail.why}
              </p>

              {/*
                * The qualifier, on its own line. It is split off upstream so
                * a regulatory reference cannot lose "Illustrative regulatory
                * context, not legal advice" to a character count.
                */}
              {now.detail.whyQualifier ? (
                <span className="wd-now-qualifier">{now.detail.whyQualifier}</span>
              ) : null}

              <span className="wd-now-when" data-now-line="when">
                {byWhen(now, current, language)}
              </span>

              <div className="wd-row wd-row-wrap" style={{ marginTop: "var(--wd-1)" }}>
                <a className="wd-btn wd-btn-primary wd-btn-lg" href={now.detail.action.href}>
                  {now.detail.action.label}
                  <IconArrowRight size={16} stroke={2} aria-hidden="true" />
                </a>
                <WorkdayEvidenceTrigger
                  language={language}
                  count={now.detail.sources.length}
                  objectLabel={now.detail.item.title}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="wd-empty">
            <span className="wd-empty-title">{pick(COPY.nothing, language)}</span>
            {/* Not the context line again: it is directly above, and it said the same thing. */}
            <span>{pick(COPY.nothingBody, language)}</span>
          </div>
        )}
      </section>

      {/* ---------------- One inline AI line, at most ---------------- */}
      {suggestion ? (
        <section className="wd-section" aria-label={pick(COPY.prepared, language)}>
          <div className="wd-suggestion">
            <div className="wd-suggestion-head">
              <span className="wd-suggestion-label">
                <IconSparkles size={14} stroke={2} aria-hidden="true" />
                {pick(COPY.prepared, language)}
              </span>
              <a className="wd-btn wd-btn-link wd-btn-sm" href={suggestion.href}>
                {pick(COPY.review, language)}
              </a>
            </div>
            <p className="wd-suggestion-body">{suggestion.body}</p>
          </div>
        </section>
      ) : null}

      {/* ---------------- Next ---------------- */}
      {next.length > 0 ? (
        <section className="wd-section" aria-label={pick(COPY.next, language)} data-home-region="next">
          <div className="wd-section-head">
            <h2 className="wd-section-label">{pick(COPY.next, language)}</h2>
            <a className="wd-btn wd-btn-link wd-btn-sm" href={view.queueHref}>
              {pick(COPY.viewAll, language)}
            </a>
          </div>
          <div className="wd-list">
            {/*
              * In the attention order from `orderForAttention` in
              * `src/db/repositories/focus.ts`: materiality, deadline,
              * dependency, readiness. Capped at three by the read model.
              */}
            {next.slice(0, 3).map((item) => (
              <a key={item.id} href={item.href} className="wd-item">
                <span className="wd-item-main">
                  <span className="wd-item-title">{item.title}</span>
                  <span className="wd-item-sub">{subjectLine(item, language) ?? item.reason}</span>
                </span>
                <span className="wd-mono wd-shrink-0 wd-muted">
                  {item.dueMoment ?? item.arrivedAtMoment}
                </span>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {/* ---------------- Watching and Done, one row of two disclosures ------- */}
      {/*
        * Both collapsed, and both on the SAME row, which is a budget decision
        * rather than a layout preference: side by side they cost one row and
        * keep Done inside the opening viewport at 1366x768.
        *
        * Done is always present. With nothing completed it says so in a line
        * rather than vanishing, so a reader can tell "nothing done yet" from
        * "the screen did not load that part".
        */}
      <section className="wd-section wd-disclosure-row" data-home-region="done" data-state={done.state}>
        {watching.length > 0 ? (
          <WorkdayDisclosure label={pick(COPY.watching, language)} count={watching.length} language={language}>
            <div className="wd-list">
              {watching.slice(0, 3).map((item) => (
                <a key={item.id} href={item.href} className="wd-item">
                  <span className="wd-item-main">
                    <span className="wd-item-title">{item.title}</span>
                    <span className="wd-item-sub">{item.reason}</span>
                  </span>
                </a>
              ))}
            </div>
          </WorkdayDisclosure>
        ) : null}

        {done.total > 0 ? (
          <WorkdayDisclosure
            label={pick(HC.doneToday, language)}
            count={done.total}
            summary={doneSummaryLine(done, language)}
            language={language}
          >
            <div className="wd-stack-3">
              {done.byYouRows.length > 0 ? (
                <div>
                  <h3 className="wd-section-label" style={{ fontSize: "var(--wd-text-sm)" }}>
                    {pick(HC.doneByYouHeading, language)}
                  </h3>
                  <div className="wd-list">
                    {done.byYouRows.map((row) => (
                      <a key={row.id} href={row.lineage.href} className="wd-item" data-done-row={row.kind}>
                        <IconCheck
                          size={14}
                          stroke={2.2}
                          aria-hidden="true"
                          style={{ color: "var(--wd-success)", flexShrink: 0 }}
                        />
                        <span className="wd-item-main">
                          <span className="wd-item-title">{row.title}</span>
                          <span className="wd-item-sub">
                            {doneKindLabel(row.kind, language)}, {row.lineage.label}
                          </span>
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
              {done.automaticRows.length > 0 ? (
                <div>
                  <h3 className="wd-section-label" style={{ fontSize: "var(--wd-text-sm)" }}>
                    {pick(HC.doneHandledHeading, language)}
                  </h3>
                  <div className="wd-list">
                    {done.automaticRows.map((item) => (
                      <span key={item.id} className="wd-item" data-done-row="automatic">
                        <IconCheck
                          size={14}
                          stroke={2.2}
                          aria-hidden="true"
                          style={{ color: "var(--wd-success)", flexShrink: 0 }}
                        />
                        <span className="wd-item-main">
                          <span className="wd-item-title">{item.title}</span>
                          <span className="wd-item-sub">{item.reason}</span>
                        </span>
                        <span className="wd-mono wd-muted wd-shrink-0">{item.arrivedAtMoment}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </WorkdayDisclosure>
        ) : (
          <span className="wd-disclosure-count" style={{ fontSize: "var(--wd-text-sm)", lineHeight: "28px" }}>
            {pick(HC.doneNothingYet, language)}
          </span>
        )}
      </section>

      {/* ---------------- Below the fold: Your day, then the Partner update ---- */}
      <HomeYourDay roleId={view.roleId} language={language} yourDay={view.yourDay} />
      <HomePartnerUpdate language={language} partner={view.partner} />
    </div>
  );
}
