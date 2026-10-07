/**
 * The Experience section of the console (plan 7.4).
 *
 * A filter form (a plain GET form, so a filtered view is a link) and nine
 * aggregate measures. Each measure names its source; a filter its source
 * cannot apply is said beside it; an interaction nothing records yet says
 * Not recorded rather than zero. No person appears anywhere on this page.
 *
 * Server component.
 */

import { SettingsHead, SettingsSection } from "@/components/settings/primitives";
import { Chip, Data, Item, List } from "@/components/workday-v2/primitives";
import { ROLE_IDS } from "@/db/schema/core";
import { getRoleRelease } from "@/product/release/role-release";
import { StatusBadge } from "@/product/status";
import type { Language } from "@/i18n/labels";
import type { Bilingual } from "../permissions";
import { CONSOLE_COPY } from "../shell/copy";
import { consoleInputStyle, consoleLabelStyle, consoleWrapStyle } from "../shell/styles";
import { formatDuration } from "../role-apps/performance";
import { PROCESS_OPTIONS, RECORDING, readExperienceView, type ExperienceFilters, type FilterDimension } from "./analytics";

const COPY = {
  title: { en: "Experience", de: "Nutzungserlebnis" },
  lede: {
    en: "How the working day is used, counted in aggregate. No keystroke tracking, no productivity score, and no person is named or ranked.",
    de: "Wie der Arbeitstag genutzt wird, aggregiert gezaehlt. Keine Tastaturerfassung, keine Produktivitaetsbewertung, und keine Person wird genannt oder bewertet.",
  },
  filters: { en: "Filters", de: "Filter" },
  role: { en: "Role", de: "Rolle" },
  entity: { en: "Legal entity", de: "Rechtseinheit" },
  process: { en: "Process", de: "Prozess" },
  cohort: { en: "Cohort", de: "Kohorte" },
  week: { en: "Week", de: "Woche" },
  mode: { en: "Mode", de: "Modus" },
  any: { en: "All", de: "Alle" },
  apply: { en: "Apply filters", de: "Filter anwenden" },
  reset: { en: "Clear", de: "Zuruecksetzen" },
  measures: { en: "Measures", de: "Kennzahlen" },
  notRecorded: { en: "Not recorded", de: "Nicht erfasst" },
  recorded: { en: "Recorded", de: "Erfasst" },
  notMeasured: { en: "Not measured", de: "Nicht gemessen" },
  unavailable: { en: "Unavailable", de: "Nicht verfuegbar" },
  notApplied: { en: "Filter not applicable to this source", de: "Filter fuer diese Quelle nicht anwendbar" },
  recording: { en: "What is recorded", de: "Was erfasst wird" },
} as const;

const FILTER_LABELS: Record<FilterDimension, Bilingual> = {
  roleId: COPY.role,
  legalEntityId: COPY.entity,
  processId: COPY.process,
  cohortId: COPY.cohort,
  week: COPY.week,
  mode: COPY.mode,
};

export function ExperienceConsole({ language, filters }: { language: Language; filters: ExperienceFilters }) {
  const say = (pair: Bilingual) => (language === "de" ? pair.de : pair.en);
  const view = readExperienceView(filters);
  const roles = ROLE_IDS.filter((id) => getRoleRelease(id)?.status === "available");

  return (
    <div className="app-stack-6" data-testid="console-experience">
      <SettingsHead eyebrow={say(CONSOLE_COPY.eyebrow)} title={say(COPY.title)} lede={say(COPY.lede)} />

      <SettingsSection title={say(COPY.filters)}>
        <form method="get" action="/product/experience" className="app-row app-row-wrap app-row-top" style={{ gap: "var(--app-3)" }} data-testid="experience-filters">
          <label style={consoleLabelStyle}>
            {say(COPY.role)}
            <select name="role" defaultValue={filters.roleId ?? ""} style={consoleInputStyle} data-testid="experience-filter-role">
              <option value="">{say(COPY.any)}</option>
              {roles.map((id) => (
                <option key={id} value={id}>
                  {getRoleRelease(id)?.releaseLabel ?? id}
                </option>
              ))}
            </select>
          </label>
          <label style={consoleLabelStyle}>
            {say(COPY.entity)}
            <select name="entity" defaultValue={filters.legalEntityId ?? ""} style={consoleInputStyle}>
              <option value="">{say(COPY.any)}</option>
              {view.legalEntities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name}
                </option>
              ))}
            </select>
          </label>
          <label style={consoleLabelStyle}>
            {say(COPY.process)}
            <select name="process" defaultValue={filters.processId ?? ""} style={consoleInputStyle} data-testid="experience-filter-process">
              <option value="">{say(COPY.any)}</option>
              {PROCESS_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {say(option.label)}
                </option>
              ))}
            </select>
          </label>
          <label style={consoleLabelStyle}>
            {say(COPY.cohort)}
            <select name="cohort" defaultValue={filters.cohortId ?? ""} style={consoleInputStyle}>
              <option value="">{say(COPY.any)}</option>
              {view.cohorts.map((cohort) => (
                <option key={cohort.id} value={cohort.id}>
                  {say(cohort.name)}
                </option>
              ))}
            </select>
          </label>
          <label style={consoleLabelStyle}>
            {say(COPY.week)}
            <select name="week" defaultValue={filters.week ?? ""} style={consoleInputStyle}>
              <option value="">{say(COPY.any)}</option>
              {view.weeks.map((week) => (
                <option key={week} value={week}>
                  {week}
                </option>
              ))}
            </select>
          </label>
          <label style={consoleLabelStyle}>
            {say(COPY.mode)}
            <select name="mode" defaultValue={filters.mode ?? ""} style={consoleInputStyle}>
              <option value="">{say(COPY.any)}</option>
              <option value="live">Live</option>
              <option value="safe">{language === "de" ? "Sicher" : "Safe"}</option>
              <option value="offline">Offline</option>
            </select>
          </label>
          <span className="app-row" style={{ alignSelf: "flex-end" }}>
            <button type="submit" className="app-btn app-btn-secondary app-btn-sm" data-testid="experience-apply">
              {say(COPY.apply)}
            </button>
            <a href="/product/experience" className="app-btn app-btn-quiet app-btn-sm">
              {say(COPY.reset)}
            </a>
          </span>
        </form>
      </SettingsSection>

      <SettingsSection title={say(COPY.measures)} count={view.measures.length}>
        <List label={say(COPY.measures)}>
          {view.measures.map((measure) => (
            <Item
              key={measure.key}
              title={
                <span className="app-row app-row-wrap" data-testid={`experience-measure-${measure.key}`} data-value={measure.value ?? ""}>
                  <span>{say(measure.label)}</span>
                  <span className="app-oid">{measure.source}</span>
                </span>
              }
              trailing={
                !measure.recorded ? (
                  <StatusBadge status="unavailable" language={language} detail={measure.note ? say(measure.note) : say(COPY.notRecorded)} />
                ) : measure.value === null ? (
                  <Chip>{measure.unit === "duration" ? say(COPY.notMeasured) : say(COPY.unavailable)}</Chip>
                ) : (
                  <Data size="sm">{measure.unit === "duration" ? formatDuration(measure.value, language) : String(measure.value)}</Data>
                )
              }
            >
              {measure.note || measure.notApplied.length > 0 ? (
                <span className="app-meta" style={consoleWrapStyle}>
                  {measure.note ? say(measure.note) : ""}
                  {measure.notApplied.length > 0 ? ` ${say(COPY.notApplied)}: ${measure.notApplied.map((key) => say(FILTER_LABELS[key])).join(", ")}.` : ""}
                </span>
              ) : null}
            </Item>
          ))}
        </List>
      </SettingsSection>

      <SettingsSection title={say(COPY.recording)}>
        <List label={say(COPY.recording)}>
          {Object.entries(RECORDING).map(([kind, entry]) => (
            <Item key={kind} title={<span className="app-oid">{kind}</span>} trailing={<Chip tone={entry.recorded ? "success" : "neutral"}>{entry.recorded ? say(COPY.recorded) : say(COPY.notRecorded)}</Chip>}>
              <span className="app-meta" style={consoleWrapStyle}>
                {say(entry.where)}
              </span>
            </Item>
          ))}
        </List>
      </SettingsSection>
    </div>
  );
}
