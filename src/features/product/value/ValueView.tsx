/**
 * Product Owner Console: Value (plan section 12).
 *
 * Server component. The success measures in four groups, each one measured
 * (with its source), not measured, or not applicable in this environment.
 * Control measures are computed from the product's own records on this
 * request. Commercial measures stay unmeasured: a commercial outcome is never
 * calculated from synthetic data. No measure ranks or names an employee.
 */

import { SettingsHead, SettingsSection } from "@/components/settings/primitives";
import { Chip, Notice } from "@/components/workday-v2/primitives";
import { StatusBadge } from "@/product/status";
import { readAdminLanguage } from "@/product/status/sources";
import type { Language } from "@/i18n/labels";
import { CONSOLE_COPY } from "@/features/product/shell/copy";
import { countStates, readValueMeasures, type MeasureState, type ValueMeasure } from "./measures";

const COPY = {
  title: { en: "Value", de: "Nutzen" },
  lede: {
    en: "The success measures of the plan, as this environment can answer them. Each is measured with its source, not measured, or not applicable here. Control measures are computed from the product's own records on this request.",
    de: "Die Erfolgskennzahlen des Plans, soweit diese Umgebung sie beantworten kann. Jede ist mit Quelle gemessen, nicht gemessen oder hier nicht anwendbar. Kontrollkennzahlen werden bei dieser Anfrage aus den eigenen Aufzeichnungen des Produkts berechnet.",
  },
  synthetic: {
    en: "The institution and its activity are synthetic. A measured user or product-owner figure here shows that the measurement works; it is not a result. No commercial outcome or saving is calculated from synthetic data, and no measure ranks a person.",
    de: "Institution und Aktivitaet sind synthetisch. Eine hier gemessene Zahl zu Nutzern oder Product Ownern zeigt, dass die Messung funktioniert; sie ist kein Ergebnis. Aus synthetischen Daten wird kein kommerzielles Ergebnis und keine Einsparung berechnet, und keine Kennzahl bewertet eine Person.",
  },
  measure: { en: "Measure", de: "Kennzahl" },
  answer: { en: "Answer", de: "Antwort" },
  source: { en: "Source", de: "Quelle" },
  summary: {
    en: "{measured} measured, {not} not measured, {na} not applicable here",
    de: "{measured} gemessen, {not} nicht gemessen, {na} hier nicht anwendbar",
  },
} as const;

const STATE_LABEL: Record<MeasureState, { en: string; de: string }> = {
  measured: { en: "Measured", de: "Gemessen" },
  "not-measured": { en: "Not measured", de: "Nicht gemessen" },
  "not-applicable": { en: "Not applicable here", de: "Hier nicht anwendbar" },
};

function say(pair: { en: string; de: string }, language: Language): string {
  return language === "de" ? pair.de : pair.en;
}

function MeasureRow({ measure, language }: { measure: ValueMeasure; language: Language }) {
  const detail = say(measure.reading.detail, language);
  return (
    <div
      className="app-stack app-stack-1"
      style={{ borderTop: "1px solid var(--app-border)", padding: "var(--app-2) 0", minWidth: 0 }}
      data-testid={`value-${measure.id}`}
      data-state={measure.state}
      data-status={measure.reading.status}
    >
      <span className="app-row app-row-wrap" style={{ rowGap: "var(--app-1)" }}>
        <span className="app-strong">{say(measure.label, language)}</span>
        <Chip tone={measure.state === "measured" ? "info" : "neutral"}>{say(STATE_LABEL[measure.state], language)}</Chip>
        <StatusBadge status={measure.reading.status} language={language} detail={detail} />
        {measure.value ? <span className="app-data-md" style={{ whiteSpace: "normal" }}>{say(measure.value, language)}</span> : null}
      </span>
      <span className="app-meta" style={{ display: "block", whiteSpace: "normal", maxWidth: "110ch", overflowWrap: "anywhere" }}>
        {detail} {say(COPY.source, language)}: <span className="app-oid">{measure.source}</span>
      </span>
    </div>
  );
}

export function ValueView() {
  const language = readAdminLanguage();
  const groups = readValueMeasures();
  return (
    <div className="app-stack app-stack-6" data-testid="product-value">
      <SettingsHead eyebrow={say(CONSOLE_COPY.eyebrow, language)} title={say(COPY.title, language)} lede={say(COPY.lede, language)} />
      <Notice tone="info">{say(COPY.synthetic, language)}</Notice>
      {groups.map((group) => {
        const counts = countStates(group.measures);
        return (
          <SettingsSection
            key={group.id}
            title={say(group.label, language)}
            count={group.measures.length}
            trailing={
              <span className="app-meta" data-testid={`value-group-${group.id}`}>
                {say(COPY.summary, language)
                  .replace("{measured}", String(counts.measured))
                  .replace("{not}", String(counts["not-measured"]))
                  .replace("{na}", String(counts["not-applicable"]))}
              </span>
            }
          >
            <div>
              {group.measures.map((measure) => (
                <MeasureRow key={measure.id} measure={measure} language={language} />
              ))}
            </div>
          </SettingsSection>
        );
      })}
    </div>
  );
}
