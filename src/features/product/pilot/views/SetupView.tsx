/**
 * Pilot setup (plan 7.7): business area, legal entities, users, roles,
 * processes, source systems, authority, measures and support contacts.
 *
 * Server component. The fields post to `actionUpdatePilotSetup`, the cohort
 * changes to `actionChangeCohort` (material: each opens an approval bound to
 * the exact change), and the start to `actionStartPilot`. The choices offered
 * come from the release registry and the configuration, so a Demo or Planned
 * role, or a preview Role App, is shown and cannot be chosen, with the
 * reason.
 */

import Link from "next/link";
import { RegulatorContext, SettingsSection } from "@/components/settings/primitives";
import { Chip, Notice } from "@/components/workday-v2/primitives";
import { StatusBadge } from "@/product/status";
import { AUTONOMY_DESCRIPTIONS } from "@/server/security/authority";
import type { Language } from "@/i18n/labels";
import { ConsoleActionForm } from "@/features/product/forms/ConsoleActionForm";
import { consoleInputStyle, consoleLabelStyle, consoleTextareaStyle } from "@/features/product/shell/styles";
import { actionChangeCohort, actionStartPilot, actionUpdatePilotSetup } from "../actions";
import { cohortChange, cohortChangeLines, cohortFingerprint } from "../changes";
import { MAX_SUPPORT_CONTACTS, PILOT_AUTONOMY_LEVELS } from "../rules";
import type { PilotAccess } from "../access";
import type { PilotWorkspace } from "../workspace";
import { formatDate, say, Wrap } from "./PilotFrame";
import { HistoryList } from "./HistoryList";

const COPY = {
  scope: { en: "Scope", de: "Umfang" },
  businessArea: { en: "Business area (English)", de: "Geschaeftsbereich (Englisch)" },
  businessAreaDe: { en: "Business area (German)", de: "Geschaeftsbereich (Deutsch)" },
  window: { en: "Pilot window", de: "Pilotzeitraum" },
  start: { en: "Planned start", de: "Geplanter Beginn" },
  end: { en: "Planned end", de: "Geplantes Ende" },
  windowNote: {
    en: "Agreed with the design partner. Leave both empty until it is agreed.",
    de: "Mit dem Designpartner vereinbart. Lassen Sie beide Felder leer, bis er vereinbart ist.",
  },
  entities: { en: "Legal entities", de: "Rechtseinheiten" },
  entitiesNote: {
    en: "The regulatory context is derived from each entity's bloc: DORA and the EBA guidelines for the EU entities in Germany and Austria, FINMA for the Swiss entity. DORA does not apply to the Swiss entity directly.",
    de: "Der regulatorische Kontext ergibt sich aus dem Block jeder Einheit: DORA und die EBA-Leitlinien fuer die EU-Einheiten in Deutschland und Oesterreich, FINMA fuer die Schweizer Einheit. DORA gilt fuer die Schweizer Einheit nicht unmittelbar.",
  },
  roles: { en: "Roles", de: "Rollen" },
  notPilotable: { en: "Not in this release's pilot scope", de: "Nicht im Pilotumfang dieses Releases" },
  processes: { en: "Processes (Role Apps)", de: "Prozesse (Rollen-Apps)" },
  stages: { en: "stages", de: "Stufen" },
  sources: { en: "Source systems", de: "Quellsysteme" },
  usedBy: { en: "Used by", de: "Genutzt von" },
  notUsed: { en: "Not used by the pilot's Role Apps", de: "Von den Rollen-Apps des Piloten nicht genutzt" },
  authority: { en: "Authority", de: "Befugnis" },
  entitlement: { en: "Entitlement profile", de: "Berechtigungsprofil" },
  none: { en: "None", de: "Keines" },
  autonomy: { en: "Highest autonomy", de: "Hoechste Autonomie" },
  autonomous: {
    en: "Autonomous execution: never. Every material change needs a named person's approval, bound to the exact change. This cannot be changed for a pilot.",
    de: "Autonome Ausfuehrung: nie. Jede wesentliche Aenderung braucht die Genehmigung einer benannten Person, gebunden an genau diese Aenderung. Das laesst sich fuer einen Piloten nicht aendern.",
  },
  contacts: { en: "Support contacts", de: "Supportkontakte" },
  contactName: { en: "Name", de: "Name" },
  contactRole: { en: "Role", de: "Rolle" },
  contactChannel: { en: "Channel", de: "Kanal" },
  measures: { en: "Measures", de: "Kennzahlen" },
  measuresNote: {
    en: "The pilot tracks {n} measures. Their baselines and success criteria are on the Baseline page.",
    de: "Der Pilot verfolgt {n} Kennzahlen. Ausgangslage und Erfolgskriterien stehen auf der Seite Ausgangslage.",
  },
  openBaseline: { en: "Open the baseline", de: "Ausgangslage oeffnen" },
  save: { en: "Save setup", de: "Einrichtung speichern" },
  users: { en: "Users (cohort)", de: "Benutzer (Kohorte)" },
  usersNote: {
    en: "Identity accounts only. There is no identity provider in this build, so the design partner's named users are added when one is connected. Membership is an entitlement and is never used to measure a person.",
    de: "Nur Identitaetskonten. In diesem Build gibt es keinen Identitaetsanbieter, die benannten Benutzer des Designpartners kommen hinzu, sobald einer angebunden ist. Die Mitgliedschaft ist eine Berechtigung und wird nie zur Messung einer Person verwendet.",
  },
  inCohort: { en: "In the cohort", de: "In der Kohorte" },
  add: { en: "Add to cohort", de: "In die Kohorte aufnehmen" },
  remove: { en: "Remove from cohort", de: "Aus der Kohorte entfernen" },
  administrator: { en: "Administrator account, not a pilot user", de: "Administrationskonto, kein Pilotbenutzer" },
  startTitle: { en: "Start the pilot", de: "Pilot starten" },
  startReady: { en: "Every condition is met. The pilot can start.", de: "Alle Bedingungen sind erfuellt. Der Pilot kann starten." },
  startButton: { en: "Start pilot", de: "Pilot starten" },
  notInSetup: { en: "The pilot has started. Its setup can still be corrected; the window and cohort changes are recorded.", de: "Der Pilot ist gestartet. Die Einrichtung laesst sich weiter korrigieren; Aenderungen an Zeitraum und Kohorte werden erfasst." },
  history: { en: "Setup history", de: "Verlauf der Einrichtung" },
} as const;

function fieldset(legend: string, children: React.ReactNode) {
  return (
    <fieldset style={{ border: "1px solid var(--app-border)", borderRadius: "var(--app-radius)", padding: "var(--app-3)", margin: 0, minWidth: 0 }}>
      <legend className="app-strong" style={{ fontSize: "var(--app-text-sm)", padding: "0 var(--app-1)" }}>
        {legend}
      </legend>
      <div className="app-stack app-stack-2">{children}</div>
    </fieldset>
  );
}

const checkRow = { display: "flex", gap: "var(--app-2)", alignItems: "flex-start", fontSize: "var(--app-text-sm)", minWidth: 0 } as const;

export function SetupView({ workspace, access, language }: { workspace: PilotWorkspace; access: PilotAccess; language: Language }) {
  const t = (pair: { en: string; de: string }) => say(pair, language);
  const pilot = workspace.pilot;
  const canEdit = access.can("pilot.edit-setup") && !access.readOnly;
  const editReason = access.reasonFor("pilot.edit-setup");
  const contacts = [...workspace.supportContacts];
  while (contacts.length < Math.min(MAX_SUPPORT_CONTACTS, workspace.supportContacts.length + 2)) contacts.push({ label: "", role: "", channel: "" });

  const fields = (
    <div className="app-stack app-stack-4">
      {fieldset(
        t(COPY.scope),
        <>
          <label style={consoleLabelStyle}>
            {t(COPY.businessArea)}
            <textarea name="businessArea" rows={2} defaultValue={workspace.businessArea.en} style={consoleTextareaStyle} data-testid="setup-business-area" />
          </label>
          <label style={consoleLabelStyle}>
            {t(COPY.businessAreaDe)}
            <textarea name="businessAreaDe" rows={2} defaultValue={workspace.businessArea.de} style={consoleTextareaStyle} />
          </label>
        </>,
      )}

      {fieldset(
        t(COPY.window),
        <>
          <div className="app-row app-row-wrap" style={{ gap: "var(--app-3)" }}>
            <label style={consoleLabelStyle}>
              {t(COPY.start)}
              <input type="date" name="plannedStartOn" defaultValue={pilot.plannedStartOn ?? ""} style={consoleInputStyle} data-testid="setup-start" />
            </label>
            <label style={consoleLabelStyle}>
              {t(COPY.end)}
              <input type="date" name="plannedEndOn" defaultValue={pilot.plannedEndOn ?? ""} style={consoleInputStyle} data-testid="setup-end" />
            </label>
          </div>
          <Wrap>{t(COPY.windowNote)}</Wrap>
        </>,
      )}

      {fieldset(
        t(COPY.entities),
        <>
          {workspace.legalEntities.map((entity) => (
            <label key={entity.id} style={checkRow}>
              <input type="checkbox" name="legalEntityIds" value={entity.id} defaultChecked={entity.inPilot} style={{ marginTop: 3 }} data-testid={`setup-entity-${entity.id}`} />
              <span className="app-stack app-stack-1" style={{ minWidth: 0 }}>
                <span>
                  {entity.name} ({entity.country})
                </span>
                <RegulatorContext items={entity.regulatorContext} language={language} />
              </span>
            </label>
          ))}
          <Wrap>{t(COPY.entitiesNote)}</Wrap>
        </>,
      )}

      {fieldset(
        t(COPY.roles),
        workspace.roles.map((role) => (
          <label key={role.roleId} style={checkRow}>
            <input
              type="checkbox"
              name="roleIds"
              value={role.roleId}
              defaultChecked={role.inPilot}
              disabled={role.status !== "available"}
              style={{ marginTop: 3 }}
            />
            <span className="app-row app-row-wrap">
              <span>{role.label}</span>
              <Chip tone={role.status === "available" ? "success" : "neutral"}>{role.status === "available" ? (language === "de" ? "Verfuegbar" : "Available") : role.status === "demo" ? "Demo" : language === "de" ? "Geplant" : "Planned"}</Chip>
              {role.status !== "available" ? <span className="app-meta">{t(COPY.notPilotable)}</span> : null}
            </span>
          </label>
        )),
      )}

      {fieldset(
        t(COPY.processes),
        workspace.roleApps.map((app) => (
          <label key={app.id} style={checkRow}>
            <input type="checkbox" name="roleAppIds" value={app.id} defaultChecked={app.inPilot} disabled={app.status !== "installed"} style={{ marginTop: 3 }} />
            <span className="app-row app-row-wrap">
              <span>{say(app.name, language)}</span>
              <span className="app-meta">
                {app.version}, {app.stageCount} {t(COPY.stages)}
              </span>
              {app.status !== "installed" ? <span className="app-meta">{t(COPY.notPilotable)}</span> : null}
            </span>
          </label>
        )),
      )}

      {fieldset(
        t(COPY.sources),
        workspace.sourceSystems.map((source) => (
          <label key={source.id} style={checkRow}>
            <input type="checkbox" name="sourceSystemIds" value={source.id} defaultChecked={source.inPilot} style={{ marginTop: 3 }} />
            <span className="app-row app-row-wrap">
              <span>{source.sourceSystem}</span>
              <span className="app-oid">{source.id}</span>
              <StatusBadge status={source.status} language={language} />
              <span className="app-meta" style={{ whiteSpace: "normal" }}>
                {source.usedBy.length > 0 ? `${t(COPY.usedBy)}: ${source.usedBy.join(", ")}` : t(COPY.notUsed)}
              </span>
            </span>
          </label>
        )),
      )}

      {fieldset(
        t(COPY.authority),
        <>
          <div className="app-row app-row-wrap" style={{ gap: "var(--app-3)" }}>
            <label style={consoleLabelStyle}>
              {t(COPY.entitlement)}
              <select name="entitlementProfileId" defaultValue={workspace.authority.entitlementProfileId ?? ""} style={consoleInputStyle}>
                <option value="">{t(COPY.none)}</option>
                {workspace.entitlementProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </label>
            <label style={consoleLabelStyle}>
              {t(COPY.autonomy)}
              <select name="maxAutonomyLevel" defaultValue={workspace.authority.maxAutonomyLevel} style={consoleInputStyle} data-testid="setup-autonomy">
                {PILOT_AUTONOMY_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {language === "de" ? AUTONOMY_DESCRIPTIONS[level].labelDe : AUTONOMY_DESCRIPTIONS[level].label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Wrap>{t(COPY.autonomous)}</Wrap>
        </>,
      )}

      {fieldset(
        t(COPY.contacts),
        contacts.map((contact, index) => (
          <div key={index} className="app-row app-row-wrap" style={{ gap: "var(--app-2)" }}>
            <label style={consoleLabelStyle}>
              {t(COPY.contactName)}
              <input name={`contactLabel${index}`} defaultValue={contact.label} style={consoleInputStyle} data-testid={`setup-contact-label-${index}`} />
            </label>
            <label style={consoleLabelStyle}>
              {t(COPY.contactRole)}
              <input name={`contactRole${index}`} defaultValue={contact.role} style={consoleInputStyle} data-testid={`setup-contact-role-${index}`} />
            </label>
            <label style={{ ...consoleLabelStyle, flex: "1 1 220px" }}>
              {t(COPY.contactChannel)}
              <input name={`contactChannel${index}`} defaultValue={contact.channel} style={{ ...consoleInputStyle, width: "100%" }} />
            </label>
          </div>
        )),
      )}
    </div>
  );

  const startBlocked =
    workspace.startConditions.length > 0
      ? workspace.startConditions.map((condition) => t(condition)).join(" ")
      : access.reasonFor("pilot.edit-setup")
        ? t(access.reasonFor("pilot.edit-setup") ?? { en: "", de: "" })
        : null;

  return (
    <div className="app-stack app-stack-6">
      <SettingsSection title={t(COPY.startTitle)}>
        {pilot.status === "setup" ? (
          <div className="app-stack app-stack-2" data-testid="pilot-start">
            {workspace.startConditions.length === 0 ? (
              <Notice tone="success">{t(COPY.startReady)}</Notice>
            ) : (
              <ul className="app-stack app-stack-1" style={{ margin: 0, paddingLeft: "var(--app-4)" }} data-testid="pilot-start-conditions">
                {workspace.startConditions.map((condition) => (
                  <li key={condition.en} className="app-meta" style={{ whiteSpace: "normal" }}>
                    {t(condition)}
                  </li>
                ))}
              </ul>
            )}
            <ConsoleActionForm
              action={actionStartPilot}
              language={language}
              label={t(COPY.startButton)}
              permitted={access.can("pilot.edit-setup") && !access.readOnly}
              blockedReason={startBlocked}
              tone="primary"
              testId="pilot-start-form"
            />
          </div>
        ) : (
          <Wrap>{t(COPY.notInSetup)}</Wrap>
        )}
      </SettingsSection>

      <SettingsSection title={t(COPY.users)} count={workspace.cohort?.userIds.length ?? 0}>
        <div className="app-stack app-stack-3" data-testid="pilot-cohort">
          <Wrap>{t(COPY.usersNote)}</Wrap>
          {workspace.people.map((person) => {
            if (person.isAdministrator) {
              return (
                <div key={person.userId} className="app-row app-row-wrap">
                  <span>{person.displayName}</span>
                  <span className="app-oid">{person.userId}</span>
                  <span className="app-meta">{t(COPY.administrator)}</span>
                </div>
              );
            }
            const operation = person.inCohort ? "remove" : "add";
            const change = cohortChange(workspace, person.userId, operation);
            return (
              <div key={person.userId} className="app-row app-row-wrap" style={{ justifyContent: "space-between", gap: "var(--app-3)" }}>
                <span className="app-row app-row-wrap">
                  <span>{person.displayName}</span>
                  <span className="app-oid">{person.userId}</span>
                  <span className="app-meta">{person.roleIds.map((roleId) => workspace.roles.find((role) => role.roleId === roleId)?.label ?? roleId).join(", ")}</span>
                  {person.inCohort ? <Chip tone="success">{t(COPY.inCohort)}</Chip> : null}
                </span>
                {change ? (
                  <ConsoleActionForm
                    action={actionChangeCohort}
                    language={language}
                    label={operation === "add" ? t(COPY.add) : t(COPY.remove)}
                    hidden={{ userId: person.userId, operation }}
                    permitted={access.can("pilot.manage-cohort") && !access.readOnly}
                    blockedReason={access.reasonFor("pilot.manage-cohort") ? t(access.reasonFor("pilot.manage-cohort") ?? { en: "", de: "" }) : null}
                    approval={{ lines: cohortChangeLines(change, person.displayName, language), fingerprint: cohortFingerprint(change) }}
                    testId={`cohort-${operation}-${person.userId}`}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </SettingsSection>

      <SettingsSection title={t(COPY.measures)} count={workspace.measures.length}>
        <span className="app-row app-row-wrap">
          <Wrap>{t(COPY.measuresNote).replace("{n}", String(workspace.measures.length))}</Wrap>
          <Link href="/product/pilot/baseline" className="app-source-link">
            {t(COPY.openBaseline)}
          </Link>
        </span>
      </SettingsSection>

      <SettingsSection title={language === "de" ? "Einrichtung bearbeiten" : "Edit setup"}>
        <ConsoleActionForm
          action={actionUpdatePilotSetup}
          language={language}
          label={t(COPY.save)}
          permitted={canEdit}
          blockedReason={!canEdit && editReason ? t(editReason) : null}
          fields={fields}
          tone="primary"
          testId="pilot-setup-form"
        />
        <span className="app-meta">
          {language === "de" ? "Zeitraum" : "Window"}: {formatDate(pilot.plannedStartOn, language)} {language === "de" ? "bis" : "to"} {formatDate(pilot.plannedEndOn, language)}
        </span>
      </SettingsSection>

      <SettingsSection title={t(COPY.history)} count={workspace.history.length}>
        <HistoryList entries={workspace.history} language={language} />
      </SettingsSection>
    </div>
  );
}
