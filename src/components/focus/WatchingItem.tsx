/**
 * One watched subject.
 *
 * Deliberately thinner than a focus row. Watching is a glance, not a worklist:
 * nothing here is asking anything of the person, and the visual weight has to
 * say so. So there is no authority chip, no ask line, no status chip and no
 * leading dot of the same size, because every one of those would make a
 * monitored indicator look like an open decision.
 *
 * What remains is the subject, one clause of why it is being watched, and the
 * current value where the subject has one. The value is the reason this list
 * exists at all: "manual override rate 3.84 against a red threshold of 3.5" is
 * the fact, and "being monitored" without it is decoration.
 */

import { momentAge, SEVERITY_TONE, type FocusItemView } from "@/workday/contracts";
import type { Language } from "@/i18n/labels";
import { Data, Dot, Item, ObjectRef } from "@/components/workday-v2/primitives";

export interface WatchingItemProps {
  item: FocusItemView;
  language: Language;
  currentMoment: string;
  selected?: boolean;
  changed?: boolean;
}

export function WatchingItem({
  item,
  language,
  currentMoment,
  selected = false,
  changed = false,
}: WatchingItemProps) {
  return (
    <Item
      href={item.href}
      selected={selected}
      changed={changed}
      leading={
        <Dot
          tone={SEVERITY_TONE[item.severity]}
          label={
            item.severity === "high" || item.severity === "critical"
              ? language === "de"
                ? "Ausserhalb der Toleranz"
                : "Outside tolerance"
              : language === "de"
                ? "In Beobachtung"
                : "Under observation"
          }
        />
      }
      title={<span className="app-secondary">{item.title}</span>}
      subtitle={
        <>
          <ObjectRef id={item.objectId} label={item.objectType} />
          <span className="app-faint"> {item.reason}</span>
        </>
      }
      trailing={
        <>
          {item.sourceCount > 1 ? (
            <Data
              title={
                language === "de"
                  ? `${item.sourceCount} Messwerte oder Quellen`
                  : `${item.sourceCount} readings or sources`
              }
            >
              {item.sourceCount}
            </Data>
          ) : null}
          <Data>{momentAge(item.arrivedAtMoment, currentMoment, language)}</Data>
        </>
      }
    />
  );
}
