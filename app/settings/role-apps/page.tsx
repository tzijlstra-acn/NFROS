/**
 * Role apps settings.
 *
 * A catalogue view of every Role App definition in the registry: what exists,
 * its release state and maturity, and where it routes. Every count here is
 * read from `src/role-apps/registry.ts` through the release registry.
 *
 * This page used to show an "Enabled" chip on each installed app, with a
 * tooltip admitting that nothing was behind it. A control that does nothing,
 * labelled as a state, is an asserted status. It is replaced by an honest Unavailable: there
 * is no enable or disable mechanism, and installed state comes from code.
 *
 * This is an administrator surface, not an app store. There is no install
 * flow and no pricing.
 */

import { ROLE_APP_REGISTRY } from "@/role-apps/registry";
import type { RoleAppDefinition, RoleAppMaturity } from "@/role-apps/contracts";
import {
  Field,
  FieldList,
  SettingsHead,
  SettingsSection,
} from "@/components/settings/primitives";
import { Chip, Data, ObjectRef } from "@/components/workday-v2/primitives";
import {
  INSTALLED_ROLE_APPS,
  PREVIEW_ROLE_APPS,
  ROLE_APP_STATUS_LABELS,
  getRoleRelease,
} from "@/product/release";
import { StatusBadge } from "@/product/status";
import { readAdminLanguage } from "@/product/status/sources";
import { pick } from "@/workday/contracts";
import type { Language } from "@/i18n/labels";

export const dynamic = "force-dynamic";

type Pair = { en: string; de: string };

const COPY = {
  eyebrow: { en: "Administrator area", de: "Administrationsbereich" },
  title: { en: "Role apps", de: "Rollen-Apps" },
  lede: {
    en: "A Role App is a structured, stage-gated process that the AI Partner guides a named role through. {installed} are installed and can be run. {preview} are previews, listed here for configuration visibility, with no routed process page.",
    de: "Eine Rollen-App ist ein strukturierter, stufenweiser Prozess, durch den der KI-Partner eine benannte Rolle fuehrt. {installed} sind installiert und lassen sich ausfuehren. {preview} sind Vorschauen, hier zur Uebersicht gelistet, ohne eigene Prozessseite.",
  },
  summary: { en: "Registry summary", de: "Verzeichnis im Ueberblick" },
  total: { en: "Apps defined", de: "Definierte Apps" },
  installed: { en: "Installed", de: "Installiert" },
  preview: { en: "Preview", de: "Vorschau" },
  previewNote: {
    en: "A preview app has no entry route. It appears in this catalogue only.",
    de: "Eine Vorschau-App hat keinen Einstiegspfad. Sie erscheint nur in diesem Katalog.",
  },
  roles: { en: "Roles with apps", de: "Rollen mit Apps" },
  enablement: { en: "Enablement control", de: "Aktivierungssteuerung" },
  enablementNote: {
    en: "No enable or disable control exists in this build. Installed state comes from the code registry, and changing it is a release.",
    de: "In diesem Build gibt es keine Steuerung zum Aktivieren oder Deaktivieren. Der installierte Zustand stammt aus dem Code-Verzeichnis, eine Aenderung ist ein Release.",
  },
  role: { en: "Role", de: "Rolle" },
  pack: { en: "Function pack", de: "Funktionspaket" },
  maturity: { en: "Maturity", de: "Reifegrad" },
  process: { en: "Process", de: "Prozess" },
  route: { en: "Entry route", de: "Einstiegspfad" },
  notRouted: { en: "Not routed", de: "Ohne Pfad" },
  stages: { en: "Covered stages", de: "Abgedeckte Stufen" },
  connectors: { en: "Required connector packs", de: "Erforderliche Konnektorpakete" },
  decisions: { en: "Human decision kinds", de: "Menschliche Entscheidungsarten" },
  version: { en: "Version", de: "Version" },
} as const;

const MATURITY_LABELS: Record<RoleAppMaturity, Pair> = {
  "production-shaped": { en: "Production-shaped", de: "Produktionsnah" },
  prototype: { en: "Prototype", de: "Prototyp" },
  concept: { en: "Concept", de: "Konzept" },
};

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

/** The role name from the release registry, never a second copy of it. */
function roleName(roleId: string): string {
  return getRoleRelease(roleId)?.releaseLabel ?? roleId;
}

export default function RoleAppsSettingsPage() {
  const language = readAdminLanguage();
  const say = (pair: Pair) => pick(pair, language);
  const roleIds = [...new Set(ROLE_APP_REGISTRY.map((app) => app.roleId))];

  return (
    <div className="app-stack app-stack-6">
      <SettingsHead
        eyebrow={say(COPY.eyebrow)}
        title={say(COPY.title)}
        lede={fill(say(COPY.lede), {
          installed: INSTALLED_ROLE_APPS.length,
          preview: PREVIEW_ROLE_APPS.length,
        })}
      />

      <SettingsSection title={say(COPY.summary)}>
        <FieldList label={say(COPY.summary)}>
          <Field label={say(COPY.total)} value={String(ROLE_APP_REGISTRY.length)} />
          <Field label={say(COPY.installed)} value={String(INSTALLED_ROLE_APPS.length)} />
          <Field
            label={say(COPY.preview)}
            value={String(PREVIEW_ROLE_APPS.length)}
            note={say(COPY.previewNote)}
          />
          <Field
            label={say(COPY.roles)}
            value={roleIds.map((roleId) => `${roleName(roleId)} (${roleId})`).join(", ")}
          />
          <Field
            label={say(COPY.enablement)}
            value={
              <StatusBadge status="unavailable" language={language} detail={say(COPY.enablementNote)} />
            }
            note={say(COPY.enablementNote)}
          />
        </FieldList>
      </SettingsSection>

      {roleIds.map((roleId) => {
        const apps = ROLE_APP_REGISTRY.filter((app) => app.roleId === roleId);
        return (
          <SettingsSection key={roleId} title={roleName(roleId)} count={apps.length}>
            <div className="app-stack app-stack-5">
              {apps.map((app) => (
                <AppRow key={app.id} app={app} language={language} />
              ))}
            </div>
          </SettingsSection>
        );
      })}
    </div>
  );
}

function AppRow({ app, language }: { app: RoleAppDefinition; language: Language }) {
  const say = (pair: Pair) => pick(pair, language);

  return (
    <section className="app-stack app-stack-3">
      <div className="app-row app-row-wrap app-between">
        <div className="app-stack app-stack-1">
          <span className="app-object-title">{language === "de" ? app.nameDe : app.name}</span>
          <span className="app-row app-row-wrap">
            <ObjectRef id={app.id} label="App" />
            <span className="app-meta">{language === "de" ? app.name : app.nameDe}</span>
          </span>
        </div>
        <div className="app-row app-row-wrap">
          <Chip title={say(COPY.version)}>
            <Data>{app.version}</Data>
          </Chip>
          <Chip tone={app.status === "installed" ? "success" : "neutral"}>
            {say(ROLE_APP_STATUS_LABELS[app.status])}
          </Chip>
        </div>
      </div>

      <p className="app-secondary" style={{ fontSize: "var(--app-text-sm)", maxWidth: "80ch" }}>
        {language === "de" ? app.summaryDe : app.summary}
      </p>

      <FieldList label={language === "de" ? app.nameDe : app.name}>
        <Field label={say(COPY.role)} value={roleName(app.roleId)} />
        <Field
          label={say(COPY.pack)}
          value={<ObjectRef id={app.functionPackId} label={say(COPY.pack)} />}
        />
        <Field label={say(COPY.maturity)} value={say(MATURITY_LABELS[app.maturity])} />
        <Field label={say(COPY.process)} value={<Data>{app.processId}</Data>} />
        <Field
          label={say(COPY.route)}
          value={
            app.entryRoute ? (
              <Data>{app.entryRoute}</Data>
            ) : (
              <span className="app-meta">
                {say(COPY.notRouted)} ({say(ROLE_APP_STATUS_LABELS[app.status])})
              </span>
            )
          }
        />
        <Field
          label={say(COPY.stages)}
          value={
            <span className="app-row app-row-wrap">
              {app.coveredStageIds.map((id) => (
                <Chip key={id}>
                  <Data>{id}</Data>
                </Chip>
              ))}
            </span>
          }
        />
        {app.requiredConnectorPackIds.length > 0 ? (
          <Field
            label={say(COPY.connectors)}
            value={
              <span className="app-row app-row-wrap">
                {app.requiredConnectorPackIds.map((id) => (
                  <Chip key={id}>
                    <Data>{id}</Data>
                  </Chip>
                ))}
              </span>
            }
          />
        ) : null}
        <Field
          label={say(COPY.decisions)}
          value={
            <span className="app-row app-row-wrap">
              {app.humanDecisionKinds.map((kind) => (
                <Chip key={kind}>
                  <Data>{kind}</Data>
                </Chip>
              ))}
            </span>
          }
        />
      </FieldList>
    </section>
  );
}
