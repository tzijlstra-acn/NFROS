/**
 * Pilot readiness.
 *
 * The readiness checks, the pilot account roster, the regulatory scope of the
 * configured institution and the evidence pack.
 *
 * Every check is computed on this request by `runReadinessChecks` in
 * `src/product/status/sources.ts` and shown in the product status vocabulary.
 * Four things on this page used to be asserted rather than read, and each is
 * now sourced or honestly marked:
 *
 * - "Audit chain: initialised" passed whenever the table existed, even empty.
 *   It now verifies the chain, and coverage of the audit trail is its own
 *   check.
 * - The institution chip named a bank that is not the configured
 *   institution. It now reads the organisation profile.
 * - The jurisdiction was the literal "DE", with DORA and EBA shown for the
 *   whole institution. It now lists each configured legal entity with the
 *   regulatory context derived from its bloc, so the Swiss entity carries
 *   FINMA context and no EU reference.
 * - The evidence pack linked to an API route that does not exist. The page
 *   now says whether a pack is on disk and how to produce one.
 *
 * Security constraints:
 * - No credentials shown. Pilot accounts display name, roles and institution only.
 * - The synthetic institution and data label is rendered by the administrator frame.
 * - Every regulatory reference carries the illustrative context disclaimer.
 */

import Link from "next/link";
import { getProductConfig } from "@/product";
import { PILOT_USERS } from "@/identity/pilot-config";
import { getProductMode } from "@/identity/product-mode";
import {
  Field,
  FieldList,
  RegulatorContext,
  SettingsHead,
  SettingsSection,
} from "@/components/settings/primitives";
import { Chip, Data, Notice, RegulatoryNote } from "@/components/workday-v2/primitives";
import { StatusBadge, overallStatus } from "@/product/status";
import { getRoleRelease } from "@/product/release";
import {
  readAdminLanguage,
  readPilotEvidencePack,
  runReadinessChecks,
} from "@/product/status/sources";
import { pick } from "@/workday/contracts";
import { StatusList, StatusRow } from "../_components/StatusRows";

export const dynamic = "force-dynamic";

type Pair = { en: string; de: string };

const COPY = {
  eyebrow: { en: "Administrator area", de: "Administrationsbereich" },
  title: { en: "Pilot readiness", de: "Pilot-Bereitschaft" },
  lede: {
    en: "Readiness checks, pilot accounts and regulatory scope for a design-partner pilot. Every check runs when this page is opened, so open it before each pilot session.",
    de: "Bereitschaftspruefungen, Pilotkonten und regulatorischer Rahmen fuer einen Piloten mit einem Designpartner. Jede Pruefung laeuft beim Oeffnen dieser Seite, oeffnen Sie sie daher vor jeder Pilotsitzung.",
  },
  allVerified: {
    en: "All {total} readiness checks are verified. The environment is ready for a pilot session.",
    de: "Alle {total} Bereitschaftspruefungen sind verifiziert. Die Umgebung ist fuer eine Pilotsitzung bereit.",
  },
  someVerified: {
    en: "{verified} of {total} checks are verified. Review the others before starting a pilot session.",
    de: "{verified} von {total} Pruefungen sind verifiziert. Pruefen Sie die anderen, bevor Sie eine Pilotsitzung beginnen.",
  },
  checks: { en: "Readiness checks", de: "Bereitschaftspruefungen" },
  accounts: { en: "Pilot accounts", de: "Pilotkonten" },
  accountsNote: {
    en: "Synthetic accounts configured for a design-partner pilot. Credentials are not shown here.",
    de: "Synthetische Konten fuer einen Piloten mit einem Designpartner. Anmeldedaten werden hier nicht angezeigt.",
  },
  administrator: { en: "Administrator", de: "Administrator" },
  scope: { en: "Regulatory scope", de: "Regulatorischer Rahmen" },
  scopeNote: {
    en: "Derived from each legal entity's regulatory bloc. DORA and the EBA guidelines are shown for the EU entities in Germany and Austria only; the Swiss entity carries FINMA context, and DORA does not apply to it directly.",
    de: "Aus dem regulatorischen Block jeder Rechtseinheit abgeleitet. DORA und die EBA-Leitlinien erscheinen nur fuer die EU-Einheiten in Deutschland und Oesterreich; die Schweizer Einheit traegt FINMA-Kontext, und DORA gilt fuer sie nicht unmittelbar.",
  },
  noEntities: {
    en: "The organisation profile names no legal entities. Seed the scenario before reading this section.",
    de: "Das Organisationsprofil nennt keine Rechtseinheiten. Spielen Sie das Szenario ein, bevor Sie diesen Abschnitt lesen.",
  },
  identity: { en: "Identity configuration", de: "Identitaetskonfiguration" },
  status: { en: "Status", de: "Status" },
  evidence: { en: "Evidence pack", de: "Nachweispaket" },
  evidenceNote: {
    en: "A JSON file with the readiness state, a seeded data summary, the regulatory scope and the synthetic data disclosure, for design-partner handoff documentation. It contains no credentials, no session secrets and no personal data.",
    de: "Eine JSON-Datei mit Bereitschaftsstand, Uebersicht der eingespielten Daten, regulatorischem Rahmen und dem Hinweis auf synthetische Daten, fuer die Uebergabe an einen Designpartner. Sie enthaelt keine Anmeldedaten, keine Sitzungsgeheimnisse und keine personenbezogenen Daten.",
  },
  generate: { en: "Generate", de: "Erzeugen" },
  generatedAt: { en: "Generated", de: "Erzeugt" },
  download: { en: "Download in the interface", de: "Download in der Oberflaeche" },
  downloadNote: {
    en: "The pilot evidence pack, with setup, baseline, measures, readiness, known limitations and the exit decision, is built on the server and downloaded from the pilot workspace, by the Pilot Lead or the Platform Product Owner.",
    de: "Das Pilot-Nachweispaket mit Einrichtung, Ausgangslage, Kennzahlen, Bereitschaft, bekannten Einschraenkungen und Abschlussentscheidung wird auf dem Server erzeugt und im Pilotbereich heruntergeladen, von der Pilotleitung oder dem Platform Product Owner.",
  },
  workspace: { en: "Pilot workspace", de: "Pilotbereich" },
  workspaceNote: {
    en: "Setup, cohort, baseline, the weekly view and the exit decision are managed in the pilot workspace of the Product Owner Console, which also reads the design-partner controls: role switching, reset, identity on approvals, integrations, backup and restore, and the support bundle.",
    de: "Einrichtung, Kohorte, Ausgangslage, Wochenansicht und Abschlussentscheidung werden im Pilotbereich der Product-Owner-Konsole gefuehrt, der auch die Kontrollen fuer den Designpartner liest: Rollenwechsel, Zuruecksetzen, Identitaet bei Genehmigungen, Integrationen, Sicherung und Wiederherstellung sowie das Supportpaket.",
  },
  openWorkspace: { en: "Open the pilot workspace", de: "Pilotbereich oeffnen" },
} as const;

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

export default function PilotReadinessPage() {
  const language = readAdminLanguage();
  const say = (pair: Pair) => pick(pair, language);
  const config = getProductConfig();
  const checks = runReadinessChecks();
  const verified = checks.filter((check) => check.reading.status === "verified").length;
  const overall = overallStatus(checks.map((check) => check.reading.status));
  const identityCheck = checks.find((check) => check.id === "identity-mode");
  const pack = readPilotEvidencePack();
  const entities = config.organisation.legalEntities;

  return (
    <div className="app-stack app-stack-6">
      <SettingsHead eyebrow={say(COPY.eyebrow)} title={say(COPY.title)} lede={say(COPY.lede)} />

      <Notice tone="info">
        {say(COPY.workspaceNote)}{" "}
        <Link href="/product/pilot" className="app-source-link" data-testid="settings-pilot-workspace-link">
          {say(COPY.openWorkspace)}
        </Link>
      </Notice>

      <Notice tone={overall === "verified" ? "info" : "warning"}>
        {overall === "verified"
          ? fill(say(COPY.allVerified), { total: checks.length })
          : fill(say(COPY.someVerified), { verified, total: checks.length })}
      </Notice>

      <SettingsSection
        title={say(COPY.checks)}
        count={checks.length}
        trailing={<StatusBadge status={overall} language={language} />}
      >
        <StatusList label={say(COPY.checks)}>
          {checks.map((check) => (
            <StatusRow
              key={check.id}
              label={say(check.label)}
              status={check.reading}
              language={language}
            />
          ))}
        </StatusList>
      </SettingsSection>

      <SettingsSection title={say(COPY.accounts)} count={PILOT_USERS.length}>
        <div className="app-stack app-stack-2">
          <p className="app-secondary" style={{ fontSize: "var(--app-text-sm)", maxWidth: "76ch" }}>
            {say(COPY.accountsNote)}
          </p>
          <FieldList label={say(COPY.accounts)}>
            {PILOT_USERS.map((user) => (
              <Field
                key={user.userId}
                label={user.displayName}
                value={
                  <span className="app-row app-row-wrap">
                    <Chip tone="neutral">
                      {user.isAdministrator
                        ? say(COPY.administrator)
                        : user.roleIds
                            .map((roleId) => getRoleRelease(roleId)?.releaseLabel ?? roleId)
                            .join(", ")}
                    </Chip>
                    <Chip tone="info">{config.organisation.name}</Chip>
                    <span className="app-meta">{user.userId}</span>
                  </span>
                }
              />
            ))}
          </FieldList>
        </div>
      </SettingsSection>

      <SettingsSection title={say(COPY.scope)} count={entities.length}>
        <div className="app-stack app-stack-3">
          {entities.length === 0 ? (
            <Notice tone="warning">{say(COPY.noEntities)}</Notice>
          ) : (
            <FieldList label={say(COPY.scope)}>
              {entities.map((entity) => (
                <Field
                  key={entity.id}
                  label={`${entity.name} (${entity.country})`}
                  value={<RegulatorContext items={entity.regulatorContext} language={language} />}
                />
              ))}
            </FieldList>
          )}
          <span className="app-meta" style={{ maxWidth: "76ch" }}>
            {say(COPY.scopeNote)} <RegulatoryNote language={language} />
          </span>
        </div>
      </SettingsSection>

      <SettingsSection title={say(COPY.identity)}>
        <FieldList label={say(COPY.identity)}>
          <Field label="PRODUCT_MODE" value={getProductMode()} mono />
          {identityCheck ? (
            <Field
              label={say(COPY.status)}
              value={
                <StatusBadge
                  status={identityCheck.reading.status}
                  language={language}
                  detail={say(identityCheck.reading.detail)}
                />
              }
              note={say(identityCheck.reading.detail)}
            />
          ) : null}
        </FieldList>
      </SettingsSection>

      <SettingsSection title={say(COPY.evidence)}>
        <div className="app-stack app-stack-3">
          <p className="app-secondary" style={{ fontSize: "var(--app-text-sm)", maxWidth: "76ch" }}>
            {say(COPY.evidenceNote)}
          </p>
          <FieldList label={say(COPY.evidence)}>
            <Field
              label={say(COPY.evidence)}
              value={<StatusBadge status={pack.status} language={language} detail={say(pack.detail)} />}
              note={say(pack.detail)}
            />
            {pack.generatedAt ? (
              <Field label={say(COPY.generatedAt)} value={<Data>{pack.generatedAt}</Data>} />
            ) : null}
            <Field label={say(COPY.generate)} value={<Data>npm run pilot:evidence-pack</Data>} />
            <Field
              label={say(COPY.download)}
              value={
                <Link href="/product/pilot" className="app-source-link">
                  {say(COPY.workspace)}
                </Link>
              }
              note={say(COPY.downloadNote)}
            />
          </FieldList>
        </div>
      </SettingsSection>
    </div>
  );
}
