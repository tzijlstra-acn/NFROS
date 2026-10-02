/**
 * The four sections of the focus queue.
 *
 * "Needs you" is open, "Prepared for review" is present but quieter, "Handled
 * automatically" is collapsed behind a disclosure, and "Watching" is compact.
 * That ordering is not decoration: it is the product's claim about who owns
 * what, rendered as visual weight. Work the partner finished within policy is
 * genuinely less interesting than work waiting on a person, so it is one line
 * and a count until somebody asks.
 *
 * Handled is collapsed rather than omitted. Omitting it would make the product
 * look like it did nothing; showing it open would make a morning of fifty-two
 * reconciliations look like fifty-two things to read. A disclosure with a count
 * is the honest middle: the number is visible, the detail is one click away.
 *
 * Server safe, except for the disclosure itself, which is a client primitive
 * rendered from here. That is the only interactive element in the queue; every
 * row navigates through an anchor.
 */

import {
  FOCUS_SECTION_LABELS,
  pick,
  type FocusItemView,
  type FocusSection,
} from "@/workday/contracts";
import type { Language } from "@/i18n/labels";
import { Empty, List, SectionHead } from "@/components/workday-v2/primitives";
import { Disclosure } from "@/components/workday-v2/interactive";
import { FocusItem } from "./FocusItem";
import { WatchingItem } from "./WatchingItem";

const COPY = {
  emptyNeedsYou: {
    en: "Nothing needs your judgment at this moment",
    de: "Derzeit ist kein Urteil von Ihnen erforderlich",
  },
  emptyPrepared: {
    en: "Nothing is prepared and waiting",
    de: "Es liegt nichts vorbereitet zur Pruefung",
  },
  emptyWatching: { en: "Nothing under observation", de: "Nichts in Beobachtung" },
  queue: { en: "Focus queue", de: "Fokusliste" },
} as const;

export interface FocusQueueProps {
  sections: Record<FocusSection, FocusItemView[]>;
  language: Language;
  currentMoment: string;
  selectedObjectId?: string | null;
  changedObjectIds?: readonly string[];
  /**
   * Hides "Needs you", for the Today route where the Now panel above has
   * already presented it. The section is still counted, so the number the
   * context line states and the number here cannot drift apart.
   */
  omitNeedsYou?: boolean;
}

export function FocusQueue({
  sections,
  language,
  currentMoment,
  selectedObjectId = null,
  changedObjectIds = [],
  omitNeedsYou = false,
}: FocusQueueProps) {
  const changed = new Set(changedObjectIds);

  const rows = (items: FocusItemView[], dense = false) => (
    <List label={pick(COPY.queue, language)}>
      {items.map((item) => (
        <FocusItem
          key={item.id}
          item={item}
          language={language}
          currentMoment={currentMoment}
          selected={item.objectId === selectedObjectId}
          changed={changed.has(item.objectId)}
          dense={dense}
        />
      ))}
    </List>
  );

  return (
    <div className="app-stack-6">
      {omitNeedsYou ? null : (
        <section className="app-section" aria-label={pick(FOCUS_SECTION_LABELS["needs-you"], language)}>
          <SectionHead
            title={pick(FOCUS_SECTION_LABELS["needs-you"], language)}
            count={sections["needs-you"].length}
          />
          {sections["needs-you"].length === 0 ? (
            <Empty title={pick(COPY.emptyNeedsYou, language)} />
          ) : (
            rows(sections["needs-you"])
          )}
        </section>
      )}

      <section className="app-section" aria-label={pick(FOCUS_SECTION_LABELS.prepared, language)}>
        <SectionHead
          title={pick(FOCUS_SECTION_LABELS.prepared, language)}
          count={sections.prepared.length}
        />
        {sections.prepared.length === 0 ? (
          <Empty title={pick(COPY.emptyPrepared, language)} />
        ) : (
          rows(sections.prepared)
        )}
      </section>

      {/*
        * Collapsed by default. The count in the trigger is the whole point:
        * it is the visible evidence that work happened without anybody being
        * interrupted, and it costs one line to say so.
        */}
      {sections.handled.length > 0 ? (
        <section className="app-section" aria-label={pick(FOCUS_SECTION_LABELS.handled, language)}>
          <Disclosure
            label={pick(FOCUS_SECTION_LABELS.handled, language)}
            count={sections.handled.length}
            defaultOpen={false}
          >
            {rows(sections.handled, true)}
          </Disclosure>
        </section>
      ) : null}

      <section className="app-section" aria-label={pick(FOCUS_SECTION_LABELS.watching, language)}>
        <SectionHead
          title={pick(FOCUS_SECTION_LABELS.watching, language)}
          count={sections.watching.length}
        />
        {sections.watching.length === 0 ? (
          <Empty title={pick(COPY.emptyWatching, language)} />
        ) : (
          <List label={pick(FOCUS_SECTION_LABELS.watching, language)}>
            {sections.watching.map((item) => (
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
