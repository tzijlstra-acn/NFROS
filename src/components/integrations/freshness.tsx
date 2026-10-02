/**
 * Freshness and required source display.
 *
 * The shared primitive `SourceRow` already renders the quiet source line under
 * a work object, and this file does not duplicate it. What it adds is the two
 * things that line cannot carry: the per source detail an administrator needs
 * when diagnosing a stale projection, and the notice the AI Partner shows when
 * a required source has not answered.
 *
 * `RequiredSourceNotice` is the one component here that changes what a user
 * does. It is rendered above a suggestion when `checkRequiredSources` returns
 * unsatisfied, and it names the missing source rather than apologising
 * generically, because "the GRC platform has not answered" tells a
 * professional whether to wait or to proceed on their own judgment and "some
 * information is unavailable" tells them nothing.
 */

import { IconAlertTriangle, IconClock, IconDatabaseOff } from "@tabler/icons-react";
import type { FreshnessState } from "@/db/schema/integration";
import {
  CONNECTOR_MODE_LABELS,
  DATA_LOAD_LABELS,
  FRESHNESS_LABELS,
  pick,
  type SourceAttribution,
} from "@/workday/contracts";
import { Chip, Data, Empty, Item, List, Notice, type Tone } from "@/components/workday-v2/primitives";
import type { MissingSource, RequiredSourceCheck } from "@/integrations/runtime/SyncCoordinator";
import type { Language } from "@/i18n/labels";

const FRESHNESS_TONE: Record<FreshnessState, Tone> = {
  live: "success",
  fresh: "success",
  stale: "warning",
  unknown: "neutral",
};

export function FreshnessChip({
  freshness,
  language,
}: {
  freshness: FreshnessState;
  language: Language;
}) {
  return (
    <Chip tone={FRESHNESS_TONE[freshness]} title={freshness}>
      {freshness === "stale" ? <IconClock size={11} stroke={2} aria-hidden="true" /> : null}
      {pick(FRESHNESS_LABELS[freshness], language)}
    </Chip>
  );
}

const NECESSITY_LABELS = {
  required: { en: "Required", de: "Erforderlich" },
  helpful: { en: "Helpful", de: "Hilfreich" },
  optional: { en: "Optional", de: "Optional" },
} as const;

export function NecessityChip({
  necessity,
  language,
}: {
  necessity: "required" | "helpful" | "optional";
  language: Language;
}) {
  return (
    <Chip tone={necessity === "required" ? "warning" : "neutral"}>
      {pick(NECESSITY_LABELS[necessity], language)}
    </Chip>
  );
}

/**
 * Per source detail, for the integration centre and the evidence drawer.
 *
 * Shows the record count, the freshness, the necessity, the load state and
 * whether two sources disagree. The deep link, where there is one, is rendered
 * by the shared `SourceRow`; repeating it here would mean two different
 * components deciding when a link is safe to show.
 */
export function SourceDetailList({
  sources,
  language,
}: {
  sources: SourceAttribution[];
  language: Language;
}) {
  if (sources.length === 0) {
    return (
      <Empty
        title={language === "de" ? "Keine Quelle zugeordnet" : "No source attributed"}
        detail={
          language === "de"
            ? "Dieses Objekt ist noch von keinem Konnektor projiziert worden. Ein Abgleich wuerde das aendern."
            : "No connector has projected this object yet. Running a sync would change that."
        }
      />
    );
  }

  return (
    <List label={language === "de" ? "Quellen" : "Sources"}>
      {sources.map((source) => (
        <Item
          key={source.connectorInstanceId}
          title={
            <span className="app-row app-row-wrap">
              <span className="app-strong">{source.sourceSystem}</span>
              <FreshnessChip freshness={source.freshness} language={language} />
              <NecessityChip necessity={source.necessity} language={language} />
              {source.conflicted ? (
                <Chip tone="danger">
                  <IconAlertTriangle size={11} stroke={2} aria-hidden="true" />
                  {language === "de" ? "Quellen widersprechen" : "Sources disagree"}
                </Chip>
              ) : null}
            </span>
          }
          subtitle={
            <span className="app-row app-row-wrap">
              <span className="app-faint">{language === "de" ? "Modus" : "Mode"}</span>
              <span>{pick(CONNECTOR_MODE_LABELS[source.mode], language)}</span>
              <span className="app-context-sep" aria-hidden="true">
                /
              </span>
              <span className="app-faint">{language === "de" ? "Zustand" : "State"}</span>
              <span>{pick(DATA_LOAD_LABELS[source.loadState], language)}</span>
            </span>
          }
          trailing={
            <span className="app-row">
              <Data>{source.recordCount}</Data>
              <span className="app-faint">
                {language === "de" ? "Datensaetze" : "records"}
              </span>
              {source.lastUpdated ? (
                <Data title={source.lastUpdated}>{source.lastUpdated.slice(11, 19)}</Data>
              ) : (
                <span className="app-faint">{language === "de" ? "nie" : "never"}</span>
              )}
            </span>
          }
        />
      ))}
    </List>
  );
}

/**
 * The notice shown when a required source has not answered.
 *
 * Returns null when every required source is present and current, so the
 * caller can render it unconditionally. A notice that appeared permanently
 * saying "all sources available" would be noise, and noise is how a genuine
 * warning gets ignored.
 */
export function RequiredSourceNotice({
  check,
  language,
}: {
  check: RequiredSourceCheck;
  language: Language;
}) {
  if (check.satisfied && check.stale.length === 0) return null;

  const tone = check.satisfied ? "warning" : "danger";
  const missing: MissingSource[] = check.satisfied ? check.stale : check.missing;

  return (
    <Notice tone={tone}>
      <span className="app-stack app-stack-1">
        <span className="app-strong">
          {check.satisfied
            ? language === "de"
              ? "Eine erforderliche Quelle ist nicht aktuell. Die Empfehlung ist eingeschraenkt."
              : "A required source is not current. The recommendation is constrained."
            : language === "de"
              ? "Eine endgueltige Empfehlung wird zurueckgehalten, weil eine erforderliche Quelle nicht geantwortet hat."
              : "A final recommendation is withheld because a required source did not answer."}
        </span>
        <ul className="app-stack app-stack-1" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {missing.map((entry) => (
            <li key={`${entry.connectorInstanceId}:${entry.objectType}`} className="app-row app-row-wrap">
              <IconDatabaseOff size={12} stroke={1.8} aria-hidden="true" />
              <span className="app-strong">{entry.sourceSystem}</span>
              <span className="app-oid">{entry.objectType}</span>
              <span className="app-meta">{entry.reason}</span>
            </li>
          ))}
        </ul>
      </span>
    </Notice>
  );
}

/** A compact one line version for a focus queue row. */
export function RequiredSourceLine({
  check,
  language,
}: {
  check: RequiredSourceCheck;
  language: Language;
}) {
  if (check.satisfied && check.stale.length === 0) return null;
  const count = check.satisfied ? check.stale.length : check.missing.length;
  return (
    <span className="app-row">
      <IconDatabaseOff size={12} stroke={1.8} aria-hidden="true" />
      <span className="app-faint">
        {check.satisfied
          ? language === "de"
            ? `${count} Quelle(n) nicht aktuell`
            : `${count} source(s) not current`
          : language === "de"
            ? `${count} erforderliche Quelle(n) fehlen`
            : `${count} required source(s) missing`}
      </span>
    </span>
  );
}
