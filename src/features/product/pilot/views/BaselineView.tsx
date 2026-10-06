/**
 * The pilot baseline (plan 7.7): preparation time, cycle time, handoffs,
 * systems opened, overdue actions and evidence completeness.
 *
 * Server component. Two things sit side by side for each measure and are
 * never mixed:
 *
 *   the baseline   the design partner's own figure, entered by the Pilot Lead
 *                  or imported, with its period and who recorded it; "Not
 *                  measured" until then, never a zero and never invented
 *   this           what the product can count about itself from its own
 *   environment    records, labelled "measured from synthetic data"; evidence
 *                  that the measurement works, never a baseline or a result
 */

import { SettingsSection } from "@/components/settings/primitives";
import { Chip, Data, Notice } from "@/components/workday-v2/primitives";
import { StatusBadge } from "@/product/status";
import type { Language } from "@/i18n/labels";
import { ConsoleActionForm } from "@/features/product/forms/ConsoleActionForm";
import { consoleInputStyle, consoleLabelStyle, consoleTextareaStyle } from "@/features/product/shell/styles";
import { actionImportBaseline, actionRecordBaseline, actionSetTarget } from "../actions";
import type { PilotAccess } from "../access";
import type { PilotWorkspace, WorkspaceMeasure } from "../workspace";
import { formatDateTime, say, Wrap } from "./PilotFrame";
import { HistoryList } from "./HistoryList";

const UNIT: Record<string, { en: string; de: string }> = {
  minutes: { en: "minutes", de: "Minuten" },
  hours: { en: "hours", de: "Stunden" },
  days: { en: "days", de: "Tage" },
  count: { en: "count", de: "Anzahl" },
  percent: { en: "percent", de: "Prozent" },
};

const COPY = {
  lede: {
    en: "The baseline is the design partner's own current figure. It is entered by the Pilot Lead from the partner's records, or imported, and never computed here. Beside each measure, the product shows what it can count about itself, measured from synthetic data and clearly not a baseline.",
    de: "Die Ausgangslage ist der aktuelle Wert des Designpartners. Die Pilotleitung erfasst ihn aus den Unterlagen des Partners oder importiert ihn; berechnet wird er hier nie. Neben jeder Kennzahl zeigt das Produkt, was es ueber sich selbst zaehlen kann, gemessen an synthetischen Daten und ausdruecklich keine Ausgangslage.",
  },
  baseline: { en: "Design partner baseline", de: "Ausgangslage des Designpartners" },
  notMeasured: { en: "Not measured", de: "Nicht gemessen" },
  measured: { en: "Measured", de: "Gemessen" },
  unavailable: { en: "Unavailable", de: "Nicht verfuegbar" },
  recorded: { en: "Recorded by", de: "Erfasst von" },
  thisEnvironment: { en: "This environment, measured from synthetic data", de: "Diese Umgebung, gemessen an synthetischen Daten" },
  computed: { en: "Computed", de: "Berechnet" },
  notComputed: { en: "Not computed", de: "Nicht berechnet" },
  notApplicable: { en: "Not applicable", de: "Nicht anwendbar" },
  target: { en: "Success criterion", de: "Erfolgskriterium" },
  noTarget: { en: "Not agreed", de: "Nicht vereinbart" },
  setTarget: { en: "Set criterion", de: "Kriterium festlegen" },
  targetLabel: { en: "Agreed criterion, empty to clear", de: "Vereinbartes Kriterium, leer zum Entfernen" },
  record: { en: "Record baseline", de: "Ausgangslage erfassen" },
  status: { en: "Status", de: "Status" },
  value: { en: "Value", de: "Wert" },
  period: { en: "Period", de: "Zeitraum" },
  note: { en: "Source document, or why it is unavailable", de: "Quelldokument oder Grund der Nichtverfuegbarkeit" },
  direction: { en: "Lower is better", de: "Niedriger ist besser" },
  directionUp: { en: "Higher is better", de: "Hoeher ist besser" },
  source: { en: "Readings from", de: "Werte aus" },
  import: { en: "Import a baseline", de: "Ausgangslage importieren" },
  importNote: {
    en: "One measure per line: measure key, value, period. One wrong line refuses the whole import, so a partial import cannot pass for a complete one.",
    de: "Eine Kennzahl je Zeile: Kennzahlschluessel, Wert, Zeitraum. Eine falsche Zeile weist den ganzen Import ab, damit ein Teilimport nicht als vollstaendig gilt.",
  },
  importSource: { en: "Document or system the figures come from", de: "Dokument oder System, aus dem die Werte stammen" },
  importRows: { en: "Rows", de: "Zeilen" },
  importButton: { en: "Import", de: "Importieren" },
  keys: { en: "Measure keys", de: "Kennzahlschluessel" },
  history: { en: "History", de: "Verlauf" },
} as const;

function baselineChip(entry: WorkspaceMeasure, language: Language) {
  const status = entry.measure.baselineStatus;
  const label = status === "measured" ? COPY.measured : status === "unavailable" ? COPY.unavailable : COPY.notMeasured;
  return (
    <Chip tone={status === "measured" ? "success" : status === "unavailable" ? "warning" : "neutral"}>
      <span data-testid={`baseline-status-${entry.measure.key}`} data-status={status}>
        {say(label, language)}
      </span>
    </Chip>
  );
}

function MeasureBlock({ entry, access, language }: { entry: WorkspaceMeasure; access: PilotAccess; language: Language }) {
  const t = (pair: { en: string; de: string }) => say(pair, language);
  const m = entry.measure;
  const unit = t(UNIT[m.unit] ?? { en: m.unit, de: m.unit });
  const canRecord = access.can("pilot.record-baseline") && !access.readOnly;
  const recordReason = access.reasonFor("pilot.record-baseline");
  const canTarget = access.can("pilot.set-target") && !access.readOnly;
  const synthetic = entry.synthetic;
  const kindLabel = synthetic.kind === "computed" ? COPY.computed : synthetic.kind === "not-computed" ? COPY.notComputed : COPY.notApplicable;

  return (
    <section className="app-section" data-testid={`measure-${m.key}`} style={{ borderTop: "1px solid var(--app-border)", paddingTop: "var(--app-3)" }}>
      <div className="app-row app-row-wrap" style={{ rowGap: "var(--app-1)" }}>
        <h3 className="app-strong" style={{ fontSize: "var(--app-text-base)", margin: 0 }}>
          {t(entry.label)}
        </h3>
        <span className="app-oid">{m.key}</span>
        <span className="app-meta">
          {unit}, {m.direction === "lower-is-better" ? t(COPY.direction) : t(COPY.directionUp)}, {t(COPY.source)} {m.source}
        </span>
      </div>
      <Wrap>{t(entry.method)}</Wrap>

      <div className="app-grid-2" style={{ marginTop: "var(--app-2)", gap: "var(--app-4)" }}>
        <div className="app-stack app-stack-2" style={{ minWidth: 0 }}>
          <span className="app-secondary" style={{ fontSize: "var(--app-text-xs)" }}>{t(COPY.baseline)}</span>
          <span className="app-row app-row-wrap">
            {baselineChip(entry, language)}
            {m.baselineStatus === "measured" && m.baselineValue !== null ? (
              <Data size="sm">
                <span data-testid={`baseline-value-${m.key}`}>
                  {m.baselineValue} {unit}
                </span>
              </Data>
            ) : null}
            {m.baselinePeriod ? <span className="app-meta">{m.baselinePeriod}</span> : null}
          </span>
          {m.baselineRecordedByLabel ? (
            <Wrap>
              {t(COPY.recorded)} {m.baselineRecordedByLabel}, {formatDateTime(m.baselineRecordedAt)}
            </Wrap>
          ) : null}
          <span className="app-row app-row-wrap">
            <span className="app-secondary" style={{ fontSize: "var(--app-text-xs)" }}>{t(COPY.target)}</span>
            <Data size="sm">{m.target !== null ? `${m.target} ${unit}` : t(COPY.noTarget)}</Data>
          </span>
        </div>

        <div className="app-stack app-stack-2" style={{ minWidth: 0 }} data-testid={`synthetic-${m.key}`}>
          <span className="app-secondary" style={{ fontSize: "var(--app-text-xs)" }}>{t(COPY.thisEnvironment)}</span>
          <span className="app-row app-row-wrap">
            <StatusBadge status={synthetic.reading.status} language={language} detail={t(synthetic.reading.detail)} />
            <span className="app-meta">{t(kindLabel)}</span>
            {synthetic.value !== null ? (
              <Data size="sm">
                {synthetic.value} {unit}
              </Data>
            ) : null}
          </span>
          <Wrap>{t(synthetic.reading.detail)}</Wrap>
          <Wrap>
            {t(synthetic.basis)} <span className="app-oid">{synthetic.source}</span>
          </Wrap>
        </div>
      </div>

      <details style={{ marginTop: "var(--app-2)" }} data-testid={`measure-edit-${m.key}`}>
        <summary className="app-meta" style={{ cursor: "pointer" }}>
          {t(COPY.record)}, {t(COPY.setTarget).toLowerCase()}
        </summary>
        <div className="app-grid-2" style={{ marginTop: "var(--app-2)", gap: "var(--app-4)" }}>
          <ConsoleActionForm
            action={actionRecordBaseline}
            language={language}
            label={t(COPY.record)}
            hidden={{ measureId: m.id }}
            permitted={canRecord}
            blockedReason={!canRecord && recordReason ? t(recordReason) : null}
            testId={`baseline-form-${m.key}`}
            fields={
              <div className="app-row app-row-wrap" style={{ gap: "var(--app-2)", alignItems: "flex-end" }}>
                <label style={consoleLabelStyle}>
                  {t(COPY.status)}
                  <select name="status" defaultValue={m.baselineStatus === "not-measured" ? "measured" : m.baselineStatus} style={consoleInputStyle} data-testid={`baseline-status-input-${m.key}`}>
                    <option value="measured">{t(COPY.measured)}</option>
                    <option value="unavailable">{t(COPY.unavailable)}</option>
                    <option value="not-measured">{t(COPY.notMeasured)}</option>
                  </select>
                </label>
                <label style={consoleLabelStyle}>
                  {t(COPY.value)} ({unit})
                  <input name="value" inputMode="decimal" defaultValue={m.baselineValue ?? ""} style={{ ...consoleInputStyle, width: 110 }} data-testid={`baseline-value-input-${m.key}`} />
                </label>
                <label style={consoleLabelStyle}>
                  {t(COPY.period)}
                  <input name="period" defaultValue={m.baselinePeriod ?? ""} placeholder="Q3 2026" style={{ ...consoleInputStyle, width: 130 }} data-testid={`baseline-period-input-${m.key}`} />
                </label>
                <label style={{ ...consoleLabelStyle, flex: "1 1 200px" }}>
                  {t(COPY.note)}
                  <input name="note" style={{ ...consoleInputStyle, width: "100%" }} data-testid={`baseline-note-input-${m.key}`} />
                </label>
              </div>
            }
          />
          <ConsoleActionForm
            action={actionSetTarget}
            language={language}
            label={t(COPY.setTarget)}
            hidden={{ measureId: m.id }}
            permitted={canTarget}
            blockedReason={!canTarget && access.reasonFor("pilot.set-target") ? t(access.reasonFor("pilot.set-target") ?? { en: "", de: "" }) : null}
            testId={`target-form-${m.key}`}
            fields={
              <label style={consoleLabelStyle}>
                {t(COPY.targetLabel)} ({unit})
                <input name="target" inputMode="decimal" defaultValue={m.target ?? ""} style={{ ...consoleInputStyle, width: 120 }} data-testid={`target-input-${m.key}`} />
              </label>
            }
          />
        </div>
      </details>
      {entry.history.length > 0 ? (
        <div style={{ marginTop: "var(--app-2)" }}>
          <HistoryList entries={entry.history} language={language} limit={6} />
        </div>
      ) : null}
    </section>
  );
}

export function BaselineView({ workspace, access, language }: { workspace: PilotWorkspace; access: PilotAccess; language: Language }) {
  const t = (pair: { en: string; de: string }) => say(pair, language);
  const recorded = workspace.measures.filter((entry) => entry.measure.baselineStatus !== "not-measured").length;
  const canImport = access.can("pilot.record-baseline") && !access.readOnly;
  return (
    <div className="app-stack app-stack-5">
      <Notice tone="info">{t(COPY.lede)}</Notice>
      <SettingsSection
        title={t(COPY.baseline)}
        count={workspace.measures.length}
        trailing={
          <span className="app-meta" data-testid="baseline-recorded-count">
            {language === "de" ? `${recorded} von ${workspace.measures.length} erfasst` : `${recorded} of ${workspace.measures.length} recorded`}
          </span>
        }
      >
        <div className="app-stack app-stack-3">
          {workspace.measures.map((entry) => (
            <MeasureBlock key={entry.measure.id} entry={entry} access={access} language={language} />
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title={t(COPY.import)}>
        <div className="app-stack app-stack-2">
          <Wrap>{t(COPY.importNote)}</Wrap>
          <Wrap>
            {t(COPY.keys)}: {workspace.measures.map((entry) => entry.measure.key).join(", ")}
          </Wrap>
          <ConsoleActionForm
            action={actionImportBaseline}
            language={language}
            label={t(COPY.importButton)}
            permitted={canImport}
            blockedReason={!canImport && access.reasonFor("pilot.record-baseline") ? t(access.reasonFor("pilot.record-baseline") ?? { en: "", de: "" }) : null}
            testId="baseline-import-form"
            fields={
              <div className="app-stack app-stack-2">
                <label style={consoleLabelStyle}>
                  {t(COPY.importSource)}
                  <input name="source" style={{ ...consoleInputStyle, width: "100%", maxWidth: 520 }} data-testid="baseline-import-source" />
                </label>
                <label style={consoleLabelStyle}>
                  {t(COPY.importRows)}
                  <textarea name="rows" rows={4} placeholder={"measure, value, period\ncycle-time, 21, Q3 2026"} style={{ ...consoleTextareaStyle, maxWidth: 520 }} data-testid="baseline-import-rows" />
                </label>
              </div>
            }
          />
        </div>
      </SettingsSection>
    </div>
  );
}
