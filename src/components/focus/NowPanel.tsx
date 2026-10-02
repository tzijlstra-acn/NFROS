/**
 * Now, Next, Watching.
 *
 * The opening of the day, in that order and in that proportion. The V1 Today
 * route opened with a 36px heading, two chips and a narrative paragraph, so
 * the first thing a professional did at 07:45 was read a description of the
 * screen they were already looking at. Here the first element is the single
 * item that needs them, and the heading is gone.
 *
 * Now holds exactly one item. Not the top three: a screen that presents three
 * equally weighted priorities has not prioritised anything, and prioritising
 * is the work the partner has already done.
 *
 * The card is capped by construction. `NowDetail` carries one reason, at most
 * two changes, at most three completed checks, one ask and one action, so the
 * panel cannot grow into a page as the scenario gets richer. That cap is what
 * makes the five second read a property of the component rather than a hope
 * about the content.
 */

import { IconCheck } from "@tabler/icons-react";
import type { NowDetail } from "@/db/repositories/focus";
import {
  FOCUS_SECTION_LABELS,
  momentAge,
  pick,
  SEVERITY_TONE,
  SUGGESTION_STATUS_LABELS,
  type FocusItemView,
} from "@/workday/contracts";
import type { Language } from "@/i18n/labels";
import {
  AuthorityChip,
  Card,
  Chip,
  Data,
  Empty,
  List,
  SectionHead,
  SourceRow,
} from "@/components/workday-v2/primitives";
import { FocusItem } from "./FocusItem";
import { WatchingItem } from "./WatchingItem";

const COPY = {
  now: { en: "Now", de: "Jetzt" },
  next: { en: "Next", de: "Als Naechstes" },
  whatChanged: { en: "What changed", de: "Was sich geaendert hat" },
  alreadyDone: { en: "Already done for you", de: "Fuer Sie bereits erledigt" },
  needsYou: { en: "Needs you", de: "Benoetigt Sie" },
  nothing: { en: "Nothing needs you right now", de: "Derzeit ist nichts erforderlich" },
  nothingDetail: {
    en: "Move the day forward to reach the next point where this role's judgment is required.",
    de: "Bewegen Sie den Tag weiter bis zum naechsten Punkt, an dem das Urteil dieser Rolle erforderlich ist.",
  },
  noNext: { en: "Nothing queued behind it", de: "Nichts dahinter in der Warteschlange" },
  noWatching: { en: "Nothing under observation", de: "Nichts in Beobachtung" },
} as const;

export interface NowPanelProps {
  now: NowDetail | null;
  /** Two or three, no more. The caller caps it. */
  next: FocusItemView[];
  watching: FocusItemView[];
  language: Language;
  currentMoment: string;
  selectedObjectId?: string | null;
  changedObjectIds?: readonly string[];
}

export function NowPanel({
  now,
  next,
  watching,
  language,
  currentMoment,
  selectedObjectId = null,
  changedObjectIds = [],
}: NowPanelProps) {
  const changed = new Set(changedObjectIds);

  return (
    <div className="app-stack-6">
      <section aria-label={pick(COPY.now, language)}>
        <span className="app-eyebrow">
          <span className="app-strong">{pick(COPY.now, language)}</span>
          {now ? <Data>{momentAge(now.item.arrivedAtMoment, currentMoment, language)}</Data> : null}
        </span>

        {now === null ? (
          <Empty title={pick(COPY.nothing, language)} detail={pick(COPY.nothingDetail, language)} />
        ) : (
          <NowCard now={now} language={language} />
        )}
      </section>

      <section aria-label={pick(COPY.next, language)}>
        <SectionHead title={pick(COPY.next, language)} count={next.length} />
        {next.length === 0 ? (
          <Empty title={pick(COPY.noNext, language)} />
        ) : (
          <List label={pick(COPY.next, language)}>
            {next.map((item) => (
              <FocusItem
                key={item.id}
                item={item}
                language={language}
                currentMoment={currentMoment}
                selected={item.objectId === selectedObjectId}
                changed={changed.has(item.objectId)}
                dense
              />
            ))}
          </List>
        )}
      </section>

      <section aria-label={pick(FOCUS_SECTION_LABELS.watching, language)}>
        <SectionHead
          title={pick(FOCUS_SECTION_LABELS.watching, language)}
          count={watching.length}
        />
        {watching.length === 0 ? (
          <Empty title={pick(COPY.noWatching, language)} />
        ) : (
          <List label={pick(FOCUS_SECTION_LABELS.watching, language)}>
            {watching.map((item) => (
              <WatchingItem
                key={item.id}
                item={item}
                language={language}
                currentMoment={currentMoment}
                selected={item.objectId === selectedObjectId}
                changed={changed.has(item.objectId)}
              />
            ))}
          </List>
        )}
      </section>
    </div>
  );
}

/**
 * The one card on the screen.
 *
 * A card is justified here and nowhere else in the queue: this is the primary
 * decision, which is the first of the four cases the primitive permits. The
 * accent edge carries the severity rather than a tinted fill, so the card
 * reads as one object with a state rather than as a coloured region.
 */
function NowCard({ now, language }: { now: NowDetail; language: Language }) {
  const { item } = now;
  const statusLabel =
    item.aiStatus === "none" ? null : pick(SUGGESTION_STATUS_LABELS[item.aiStatus], language);

  return (
    <Card
      accent={SEVERITY_TONE[item.severity]}
      raised
      label={item.title}
      head={
        <>
          <h2 className="app-object-title">{item.title}</h2>
          <span className="app-item-trail">
            {statusLabel ? <Chip tone="ai">{statusLabel}</Chip> : null}
            {item.authorityClass ? (
              <AuthorityChip authorityClass={item.authorityClass} language={language} />
            ) : null}
          </span>
        </>
      }
    >
      <div className="app-stack-3">
        <p className="app-one-line">{now.why}</p>

        {now.changed.length > 0 ? (
          <div className="app-stack-1">
            <span className="app-eyebrow">{pick(COPY.whatChanged, language)}</span>
            {now.changed.map((line) => (
              <span
                key={line}
                className="app-changed-edge app-meta"
                /*
                 * The changed marker is an absolutely positioned pseudo element,
                 * so it needs a positioning context and room to sit in. The
                 * class owns its appearance; these two declarations only give it
                 * somewhere to be drawn.
                 */
                style={{ position: "relative", paddingLeft: "var(--app-3)" }}
              >
                {line}
              </span>
            ))}
          </div>
        ) : null}

        {now.completed.length > 0 ? (
          <div className="app-stack-1">
            <span className="app-eyebrow">{pick(COPY.alreadyDone, language)}</span>
            <ul className="app-did-list">
              {now.completed.map((line) => (
                <li key={line} className="app-did-item">
                  <IconCheck size={12} stroke={2.4} aria-hidden="true" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="app-stack-1">
          <span className="app-eyebrow">{pick(COPY.needsYou, language)}</span>
          <span className="app-strong" style={{ fontSize: "var(--app-text-sm)" }}>
            {now.needs}
          </span>
        </div>

        {/*
          * One primary button, which is the whole budget for this focus area.
          * Everything else the card can lead to is a quiet link or a row.
          */}
        <div className="app-row app-row-3 app-row-wrap">
          <a className="app-btn app-btn-primary" href={now.action.href}>
            {now.action.label}
          </a>
          {item.objectType !== "background-work" ? (
            <Data title={item.objectType}>{item.objectId}</Data>
          ) : null}
        </div>

        {now.sources.length > 0 ? <SourceRow sources={now.sources} language={language} /> : null}
      </div>
    </Card>
  );
}
