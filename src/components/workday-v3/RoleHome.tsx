/**
 * The role home. Now, Next, Done.
 *
 * One mental model for every role, with role native objects inside it. The
 * structure is fixed so that a person who learns one role's home can read any
 * of them; the queue columns and the vocabulary are what differ.
 *
 * The information budget is the design constraint rather than a review note.
 * At 1366x768 the opening viewport carries one page title, one line of
 * context, one active item, up to three next rows, one inline suggestion, and
 * a collapsed Done. Everything else is a click away. That budget is what makes
 * the five second test possible: there is only one thing with the strongest
 * treatment, so there is only one place to look.
 *
 * Nothing here computes domain state. The queue comes from
 * `src/db/repositories/focus.ts` and the detail from `buildNowDetail`, both of
 * which already existed and are already tested. This is presentation.
 */

import { IconArrowRight, IconCheck, IconChevronDown, IconSparkles } from "@tabler/icons-react";
import type { NowDetail } from "@/db/repositories/focus";
import type { FocusItemView, FocusSection } from "@/workday/contracts";
import { momentAge } from "@/workday/contracts";
import type { Language } from "@/i18n/labels";
import { WorkdayDisclosure } from "./WorkdayDisclosure";
import { WorkdayEvidenceTrigger } from "./WorkdayEvidenceTrigger";

const COPY = {
  today: { en: "Today", de: "Heute" },
  now: { en: "Needs you now", de: "Benoetigt Sie jetzt" },
  next: { en: "Next", de: "Danach" },
  done: { en: "Done today", de: "Heute erledigt" },
  handled: { en: "Handled automatically", de: "Automatisch bearbeitet" },
  watching: { en: "Watching", de: "Beobachtung" },
  viewAll: { en: "View all", de: "Alle anzeigen" },
  nothing: { en: "Nothing needs your attention.", de: "Nichts benoetigt Ihre Aufmerksamkeit." },
  prepared: { en: "AI prepared", de: "KI hat vorbereitet" },
  review: { en: "Review preparation", de: "Vorbereitung ansehen" },
  due: { en: "Due", de: "Faellig" },
  ago: { en: "ago", de: "her" },
} as const;

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
 * The fallback, for a queue entry that is its own subject.
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

const pick = (pair: { en: string; de: string }, language: Language) =>
  language === "de" ? pair.de : pair.en;

export interface RoleHomeProps {
  language: Language;
  /** One sentence of counted fact. Never a paragraph. */
  contextLine: string;
  currentMoment: string;
  now: NowDetail | null;
  /** Capped at three by the caller, and asserted by the density test. */
  next: FocusItemView[];
  watching: FocusItemView[];
  sections: Record<FocusSection, FocusItemView[]>;
  /** The role native queue, rendered by the role's own feature module. */
  queue?: React.ReactNode;
  /** One concise AI line, or nothing. Never more than one. */
  suggestion?: { body: string; href: string } | null;
  /** Where View all goes. */
  queueHref: string;
}

export function RoleHome({
  language,
  contextLine,
  currentMoment,
  now,
  next,
  watching,
  sections,
  queue,
  suggestion,
  queueHref,
}: RoleHomeProps) {
  const doneCount = sections.handled.length;

  return (
    <div className="wd-main-inner" data-presentation-region="role-home">
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
        * screen. It was 20px semibold against the active work item's 18px,
        * so the strongest element was a static label and the one thing that
        * needed a person was second. The work item is now the largest thing
        * in the main region, which is the rule the brief sets.
        */}
      <h1 className="wd-page-title">{pick(COPY.today, language)}</h1>
      <p className="wd-context-line" style={{ marginTop: "var(--wd-1)" }}>
        {contextLine}
      </p>

      {/* ---------------- Now ---------------- */}
      <section className="wd-section" aria-label={pick(COPY.now, language)}>
        {/*
          * The label is VISIBLE, not only an accessible name.
          *
          * `Now` and `Done` existed as copy and were used as `aria-label`
          * only, so two thirds of the mental model the brief is built on
          * appeared nowhere on the screen. A reader told the product works in
          * terms of now, next and done could find exactly one of those words.
          */}
        <h2 className="wd-section-label wd-section-label-now">
          {pick(COPY.now, language)}
        </h2>
        {now ? (
          <div className="wd-now" data-severity={now.item.severity}>
            <div className="wd-stack-3">
              {/*
                * The verb is the lead-in and the subject is the heading, and
                * that order was arrived at by looking at the rendered screen
                * rather than by reasoning about it.
                *
                * The first attempt made the action the heading, on the theory
                * that a first week analyst should read one line and know what
                * to do. In practice `humanAction` is an action CLASS, one of
                * five phrases shared by every item of that kind, so the Now
                * card and all three Next rows rendered the identical sentence
                * `Record the decision`. Four things that need four different
                * judgments looked like one thing repeated, which is worse for
                * a new analyst than a verb they have to read twice.
                *
                * So: the verb still appears, small and above, and the heading
                * carries what distinguishes this item from the next one. The
                * primary button repeats the verb at full size, which is where
                * a reader looks for what to do anyway.
                */}
              {subjectLine(now.item, language) ? (
                <span className="wd-now-verb">{subjectLine(now.item, language)}</span>
              ) : null}
              <h2 className="wd-now-action">{now.item.title}</h2>

              <p className="wd-now-reason">{now.why}</p>

              {/*
                * The qualifier, on its own line.
                *
                * It is here because truncating the reason to one sentence
                * removed it: the seeded regulatory text ends with the note,
                * so cutting at the first sentence boundary left a regulatory
                * assertion on screen with nothing limiting it. Verified
                * against the delivered HTML at the time, `current` carried
                * the note once on the regulatory change role and `v3.1`
                * carried it zero times. The brief requires every regulatory
                * reference to carry it, so it is split off upstream and
                * rendered separately rather than being at the mercy of a
                * character count.
                */}
              {now.whyQualifier ? (
                <span className="wd-now-qualifier">{now.whyQualifier}</span>
              ) : null}

              <span className="wd-now-when">
                {now.item.dueMoment ? (
                  <>
                    {pick(COPY.due, language)} <strong>{now.item.dueMoment}</strong>
                  </>
                ) : (
                  <>
                    {momentAge(now.item.arrivedAtMoment, currentMoment, language)}{" "}
                    {pick(COPY.ago, language)}
                  </>
                )}
              </span>

              <div className="wd-row wd-row-wrap" style={{ marginTop: "var(--wd-1)" }}>
                <a className="wd-btn wd-btn-primary wd-btn-lg" href={now.action.href}>
                  {now.action.label}
                  <IconArrowRight size={16} stroke={2} aria-hidden="true" />
                </a>
                <WorkdayEvidenceTrigger
                  language={language}
                  count={now.sources.length}
                  objectLabel={now.item.title}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="wd-empty">
            <span className="wd-empty-title">{pick(COPY.nothing, language)}</span>
            <span>{contextLine}</span>
          </div>
        )}
      </section>

      {/* ---------------- One inline AI line, at most ---------------- */}
      {suggestion ? (
        <section className="wd-section" aria-label={pick(COPY.prepared, language)}>
          <div className="wd-suggestion">
            {/*
              * The attribution and the way in share a row, and the substance
              * gets the row below it. Stacked in three rows this block was
              * 141px tall, which made the AI commentary the second strongest
              * thing on a screen that is meant to have one.
              */}
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
        <section className="wd-section" aria-label={pick(COPY.next, language)}>
          <div className="wd-section-head">
            <h2 className="wd-section-label">{pick(COPY.next, language)}</h2>
            <a className="wd-btn wd-btn-link wd-btn-sm" href={queueHref}>
              {pick(COPY.viewAll, language)}
            </a>
          </div>
          <div className="wd-list">
            {next.slice(0, 3).map((item) => (
              <a key={item.id} href={item.href} className="wd-item">
                <span className="wd-item-main">
                  {/*
                    * The row leads with the subject for the same reason the
                    * Now card does: three rows whose first line is the shared
                    * action class are three rows a reader cannot tell apart.
                    */}
                  <span className="wd-item-title">{item.title}</span>
                  {/*
                    * The second line names the subject, falling back to the
                    * reason. `humanAction` here rendered `Record the
                    * decision` under all three rows AND in the card above
                    * them, so the words appeared five times on one screen
                    * while telling the reader nothing about any single row.
                    */}
                  <span className="wd-item-sub">
                    {subjectLine(item, language) ?? item.reason}
                  </span>
                </span>
                <span className="wd-mono wd-shrink-0 wd-muted">
                  {item.dueMoment ?? item.arrivedAtMoment}
                </span>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {/* ---------------- The role native queue ---------------- */}
      {queue ? <section className="wd-section">{queue}</section> : null}

      {/* ---------------- Watching and Done, one row of two disclosures ------- */}
      {/*
        * Both collapsed, and both on the SAME row, which is a budget decision
        * rather than a layout preference.
        *
        * The brief's opening viewport budget is one page title, one line of
        * context, one active item, up to three `Next` rows, one inline AI
        * line and a collapsed `Done`. `Watching` is not in that list. Stacked
        * as two sections they came to 74px with their gaps, which pushed
        * `Done` to a top edge of 728px at 1366x768: inside the viewport, but
        * behind the updates bar, so a reader could not see what the day had
        * already handled without scrolling. That is the one thing the
        * Now, Next, Done model exists to show.
        *
        * Side by side they cost 29px, both stay one click away, and `Done`
        * lands at 683px with room to spare.
        */}
      {watching.length > 0 || doneCount > 0 ? (
        <section className="wd-section wd-disclosure-row">
          {watching.length > 0 ? (
            <WorkdayDisclosure
              label={pick(COPY.watching, language)}
              count={watching.length}
              language={language}
            >
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

          {doneCount > 0 ? (
            <WorkdayDisclosure
              label={pick(COPY.handled, language)}
              count={doneCount}
              language={language}
            >
              <div className="wd-list">
                {sections.handled.map((item) => (
                  <span key={item.id} className="wd-item">
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
            </WorkdayDisclosure>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

export { IconChevronDown };
