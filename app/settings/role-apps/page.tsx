/**
 * Role apps settings.
 *
 * A catalogue view of all role-app definitions in the registry. The page
 * shows what apps exist, their status and maturity, and where they route.
 * It is a read-only registry view. There is no install flow, no pricing and
 * no enable/disable control beyond a non-functional toggle shown for the
 * installed apps to indicate where that control will live.
 *
 * This is an administrator surface, not an app store. The distinction matters:
 * an administrator here is checking configuration, not browsing for something
 * to buy.
 */

import { ROLE_APP_REGISTRY } from "@/role-apps/registry";
import type { RoleAppDefinition, RoleAppStatus, RoleAppMaturity } from "@/role-apps/contracts";
import {
  Field,
  FieldList,
  SettingsHead,
  SettingsSection,
} from "@/components/settings/primitives";
import { Chip, Data, Item, List, Notice, ObjectRef } from "@/components/workday-v2/primitives";

export const dynamic = "force-dynamic";

/* ---------------------------------------------------------------------------
   Small display helpers
   --------------------------------------------------------------------------- */

function statusTone(status: RoleAppStatus): "success" | "ai" | "neutral" | "warning" {
  switch (status) {
    case "installed":
      return "success";
    case "preview":
      return "ai";
    case "available":
      return "neutral";
    case "disabled":
      return "warning";
  }
}

function statusLabel(status: RoleAppStatus): string {
  switch (status) {
    case "installed":
      return "Installed";
    case "preview":
      return "Preview";
    case "available":
      return "Available";
    case "disabled":
      return "Disabled";
  }
}

function maturityLabel(maturity: RoleAppMaturity): string {
  switch (maturity) {
    case "production-shaped":
      return "Production-shaped";
    case "prototype":
      return "Prototype";
    case "concept":
      return "Concept";
  }
}

function roleName(roleId: "rcsa" | "tprm"): string {
  return roleId === "rcsa" ? "Operational Risk Partner" : "Third-Party Risk Manager";
}

/* ---------------------------------------------------------------------------
   Page
   --------------------------------------------------------------------------- */

const rcsaApps = ROLE_APP_REGISTRY.filter((app) => app.roleId === "rcsa");
const tprmApps = ROLE_APP_REGISTRY.filter((app) => app.roleId === "tprm");
const installedCount = ROLE_APP_REGISTRY.filter((app) => app.status === "installed").length;

export default function RoleAppsSettingsPage() {
  return (
    <div className="app-stack app-stack-6">
      <SettingsHead
        eyebrow="Administrator area"
        title="Role apps"
        lede="A role app is a structured, stage-gated process that the AI partner guides a named role through. Two flagship apps are installed and fully interactive. The remaining apps are preview or concept status and are shown here for configuration visibility."
      />

      <SettingsSection title="Registry summary">
        <FieldList label="Registry summary">
          <Field label="Total apps defined" value={String(ROLE_APP_REGISTRY.length)} />
          <Field label="Installed" value={String(installedCount)} />
          <Field
            label="Preview or concept"
            value={String(ROLE_APP_REGISTRY.length - installedCount)}
            note="Preview apps are visible in this catalogue and in the workday role selector but do not have a routed process page."
          />
          <Field label="Roles with apps" value="RCSA (Operational Risk Partner), TPRM (Third-Party Risk Manager)" />
        </FieldList>
      </SettingsSection>

      <RoleSection roleLabel="Operational Risk Partner" apps={rcsaApps} />
      <RoleSection roleLabel="Third-Party Risk Manager" apps={tprmApps} />
    </div>
  );
}

function RoleSection({
  roleLabel,
  apps,
}: {
  roleLabel: string;
  apps: readonly RoleAppDefinition[];
}) {
  return (
    <SettingsSection title={roleLabel} count={apps.length}>
      <div className="app-stack app-stack-5">
        {apps.map((app) => (
          <AppRow key={app.id} app={app} />
        ))}
      </div>
    </SettingsSection>
  );
}

function AppRow({ app }: { app: RoleAppDefinition }) {
  const isInstalled = app.status === "installed";

  return (
    <section className="app-stack app-stack-3">
      <div className="app-row app-row-wrap app-between">
        <div className="app-stack app-stack-1">
          <span className="app-object-title">{app.name}</span>
          <span className="app-row app-row-wrap">
            <ObjectRef id={app.id} label="App" />
            <span className="app-meta">{app.nameDe}</span>
          </span>
        </div>
        <div className="app-row app-row-wrap">
          <Chip title="Version">
            <Data>{app.version}</Data>
          </Chip>
          <Chip tone={statusTone(app.status)}>{statusLabel(app.status)}</Chip>
          {/*
           * A non-functional enabled toggle for installed apps. Placeholder only:
           * the enable/disable mechanic is not wired in this build.
           */}
          {isInstalled ? (
            <Chip tone="success" title="Enabled for analysts (non-functional in this build)">
              Enabled
            </Chip>
          ) : null}
        </div>
      </div>

      <p className="app-secondary" style={{ fontSize: "var(--app-text-sm)", maxWidth: "80ch" }}>
        {app.summary}
      </p>

      <FieldList label={`${app.name} configuration`}>
        <Field label="Role" value={roleName(app.roleId)} />
        <Field label="Function pack" value={<ObjectRef id={app.functionPackId} label="Function pack" />} />
        <Field label="Maturity" value={maturityLabel(app.maturity)} />
        <Field label="Process" value={<Data>{app.processId}</Data>} />
        <Field
          label="Entry route"
          value={
            app.entryRoute ? (
              <Data>{app.entryRoute}</Data>
            ) : (
              <span className="app-meta">Not routed ({app.status})</span>
            )
          }
        />
        <Field
          label="Covered stages"
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
            label="Required connector packs"
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
          label="Human decision kinds"
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
