/**
 * One row in the focus queue.
 *
 * A row, not a card. Everything in the queue repeats, and the redesign's rule
 * is that anything repeating is a list row separated by a hairline rather than
 * a panel with its own border. The V1 Today route rendered each decision as a
 * bordered card with a tinted header, which meant eight equally loud
 * containers and no way to tell which one mattered.
 *
 * Eight facts fit on one row: the title, the object, why it appeared, how old
 * it is, how many sources are behind it, what the partner has done, what is
 * being asked of the person and when it is due. They are placed so the eye
 * reads down the left edge for identity and across the right edge for state,
 * which is why the state lives in the trailing slot and the ask lives under
 * the title.
 *
 * Server safe. No hooks and no handlers: the row navigates through an anchor,
 * so the queue renders on the server with the rest of the shell.
 */

import { IconClock } from "@tabler/icons-react";
import {
  momentAge,
  pick,
  SEVERITY_TONE,
  SUGGESTION_STATUS_LABELS,
  type FocusItemView,
} from "@/workday/contracts";
import type { SuggestionStatus } from "@/db/schema/live";
import type { Language } from "@/i18n/labels";
import {
  AuthorityChip,
  Chip,
  Data,
  Dot,
  Item,
  ObjectRef,
  type Tone,
} from "@/components/workday-v2/primitives";

/**
 * The tone of each suggestion status.
 *
 * `needs-user` is the only warning tone in the set, because it is the only
 * status that means the work has stopped and is waiting for a person.
 */
const STATUS_TONE: Record<SuggestionStatus, Tone> = {
  monitoring: "neutral",
  checking: "info",
  ready: "ai",
  "needs-user": "warning",
  executing: "ai",
  completed: "success",
  dismissed: "neutral",
};

const SEVERITY_LABEL: Record<FocusItemView["severity"], { en: string; de: string }> = {
  critical: { en: "Critical", de: "Kritisch" },
  high: { en: "High", de: "Hoch" },
  medium: { en: "Medium", de: "Mittel" },
  low: { en: "Low", de: "Niedrig" },
  informational: { en: "For information", de: "Zur Information" },
};

export interface FocusItemProps {
  item: FocusItemView;
  language: Language;
  /** The live scenario moment, so the age is current rather than stored. */
  currentMoment: string;
  selected?: boolean;
  changed?: boolean;
  /** Drops the leading dot and the ask line. Used by the Next list. */
  dense?: boolean;
}

export function FocusItem({
  item,
  language,
  currentMoment,
  selected = false,
  changed = false,
  dense = false,
}: FocusItemProps) {
  const age = momentAge(item.arrivedAtMoment, currentMoment, language);
  const statusLabel =
    item.aiStatus === "none" ? null : pick(SUGGESTION_STATUS_LABELS[item.aiStatus], language);

  return (
    <Item
      href={item.href}
      selected={selected}
      changed={changed}
      large={!dense}
      leading={
        dense ? undefined : (
          <Dot
            tone={SEVERITY_TONE[item.severity]}
            label={pick(SEVERITY_LABEL[item.severity], language)}
          />
        )
      }
      title={item.title}
      subtitle={
        <>
          <ObjectRef id={item.objectId} label={item.objectType} />
          <span className="app-faint"> {item.reason}</span>
        </>
      }
      trailing={
        <>
          {statusLabel ? (
            <Chip tone={STATUS_TONE[item.aiStatus as SuggestionStatus]}>{statusLabel}</Chip>
          ) : null}
          {item.authorityClass ? (
            <AuthorityChip authorityClass={item.authorityClass} language={language} />
          ) : null}
          {item.sourceCount > 0 ? (
            <Chip
              count
              title={
                language === "de"
                  ? `${item.sourceCount} Quellen hinter diesem Eintrag`
                  : `${item.sourceCount} sources behind this item`
              }
            >
              {item.sourceCount}
            </Chip>
          ) : null}
          <Data title={`${language === "de" ? "Eingetroffen" : "Arrived"} ${item.arrivedAtMoment}`}>
            {age}
          </Data>
        </>
      }
    >
      {!dense && (item.humanAction !== null || item.dueMoment !== null) ? (
        <span className="app-meta">
          {item.humanAction ?? ""}
          {item.dueMoment !== null ? (
            <>
              {item.humanAction !== null ? " " : null}
              <IconClock size={11} stroke={2} aria-hidden="true" />
              <Data>{item.dueMoment}</Data>
            </>
          ) : null}
        </span>
      ) : null}
    </Item>
  );
}
