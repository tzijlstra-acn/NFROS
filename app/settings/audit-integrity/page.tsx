/**
 * Audit integrity settings page.
 *
 * Two readings, both computed on this request by
 * `src/product/status/sources.ts`:
 *
 *   the chain     every chain record's hash recomputed by `verifyChain`
 *   coverage      how many audit events are in the chain at all
 *
 * The page used to show only the first, with a lede saying the audit log is
 * protected by the chain. In this build the audit service writes events
 * without appending chain records, so only the seeded events are chained and
 * "Valid" was describing five records out of the whole trail. Coverage now
 * sits beside the chain status, and an event outside the chain is Not
 * verified rather than implied to be protected.
 *
 * Read only. No control here changes the chain.
 */

import {
  Field,
  FieldList,
  SettingsHead,
  SettingsSection,
} from "@/components/settings/primitives";
import { Data, Notice } from "@/components/workday-v2/primitives";
import { CHAIN_SCOPE } from "@/audit/verify-chain";
import { AUDIT_PROTECTION_STATEMENT } from "@/audit/db-protection";
import { HASH_ALGORITHM, GENESIS_HASH } from "@/audit/chain";
import { StatusBadge } from "@/product/status";
import { readAdminLanguage, readAuditIntegrity } from "@/product/status/sources";
import { pick } from "@/workday/contracts";
import { StatusList, StatusRow } from "../_components/StatusRows";

export const dynamic = "force-dynamic";

const COPY = {
  eyebrow: { en: "Administrator area", de: "Administrationsbereich" },
  title: { en: "Audit integrity", de: "Audit-Integritaet" },
  lede: {
    en: "A tamper-evident hash chain: each chain record is hashed together with the hash of the record before it, so a change to a chained record breaks every hash after it. This page verifies the chain on every visit and states how much of the audit trail the chain covers.",
    de: "Eine manipulationserkennende Hash-Kette: jedes Kettenelement wird zusammen mit dem Hash des vorherigen Elements gehasht, eine Aenderung an einem verketteten Element bricht daher jeden folgenden Hash. Diese Seite prueft die Kette bei jedem Aufruf und gibt an, wie viel des Audit-Trails die Kette abdeckt.",
  },
  status: { en: "Chain status", de: "Zustand der Kette" },
  chain: { en: "Chain records", de: "Kettenelemente" },
  coverage: { en: "Audit trail coverage", de: "Abdeckung des Audit-Trails" },
  scope: { en: "Chain scope", de: "Bereich der Kette" },
  total: { en: "Chain records", de: "Kettenelemente" },
  through: { en: "Verified through sequence", de: "Verifiziert bis Sequenz" },
  firstFailure: { en: "First failure sequence", de: "Erste fehlerhafte Sequenz" },
  none: { en: "None", de: "Keine" },
  verifiedAt: { en: "Verified at", de: "Verifiziert um" },
  events: { en: "Audit events recorded", de: "Erfasste Audit-Ereignisse" },
  chained: { en: "Audit events in the chain", de: "Audit-Ereignisse in der Kette" },
  unknown: { en: "Unknown", de: "Unbekannt" },
  broken: { en: "Integrity failure", de: "Integritaetsfehler" },
  brokenNote: {
    en: "The record at the failing sequence has a hash that does not match the recomputed value, so either that record or one before it was modified after it was written. Run npm run audit:verify-chain on the server for the full output, and compare the database file modification time with your deployment log.",
    de: "Das Element an der fehlerhaften Sequenz hat einen Hash, der nicht mit dem neu berechneten Wert uebereinstimmt; dieses oder ein vorheriges Element wurde also nachtraeglich veraendert. Fuehren Sie npm run audit:verify-chain auf dem Server aus und vergleichen Sie die Aenderungszeit der Datenbankdatei mit Ihrem Bereitstellungsprotokoll.",
  },
  empty: { en: "Chain not seeded", de: "Kette nicht eingespielt" },
  emptyNote: {
    en: "No chain records have been written yet. Run npm run db:seed to write the chain for the seeded audit events.",
    de: "Es wurden noch keine Kettenelemente geschrieben. Mit npm run db:seed wird die Kette fuer die eingespielten Audit-Ereignisse geschrieben.",
  },
  technical: { en: "Technical details", de: "Technische Angaben" },
  algorithm: { en: "Hash algorithm", de: "Hash-Verfahren" },
  genesis: { en: "Genesis hash prefix", de: "Praefix des Anfangshashes" },
  command: { en: "Verification command", de: "Pruefbefehl" },
  export: { en: "Export audit evidence", de: "Audit-Nachweis exportieren" },
  exportNote: {
    en: "No export route exists in this build. The verification command prints the full result on the server.",
    de: "In diesem Build gibt es keinen Exportweg. Der Pruefbefehl gibt das vollstaendige Ergebnis auf dem Server aus.",
  },
  boundary: { en: "Protection boundary", de: "Schutzgrenze" },
  statement: { en: "Protection statement", de: "Schutzaussage" },
  statementNote: {
    en: "It applies to chained records only. A machine administrator with direct database file access can replace or modify the database outside the application boundary. This is tamper-evident, not tamper-proof, and is not equivalent to cryptographic non-repudiation.",
    de: "Sie gilt nur fuer verkettete Elemente. Wer als Administrator direkten Zugriff auf die Datenbankdatei hat, kann die Datenbank ausserhalb der Anwendung ersetzen oder veraendern. Das ist manipulationserkennend, nicht manipulationssicher, und keine kryptografische Nichtabstreitbarkeit.",
  },
} as const;

export default function AuditIntegrityPage() {
  const language = readAdminLanguage();
  const say = (pair: { en: string; de: string }) => pick(pair, language);
  const integrity = readAuditIntegrity();
  const result = integrity.result;

  return (
    <div className="app-stack app-stack-6">
      <SettingsHead eyebrow={say(COPY.eyebrow)} title={say(COPY.title)} lede={say(COPY.lede)} />

      <SettingsSection title={say(COPY.status)}>
        <div className="app-stack app-stack-3">
          <StatusList label={say(COPY.status)}>
            <StatusRow label={say(COPY.chain)} status={integrity.chain} language={language} />
            <StatusRow label={say(COPY.coverage)} status={integrity.coverage} language={language} />
          </StatusList>
          <FieldList label={say(COPY.status)}>
            <Field label={say(COPY.scope)} value={<Data>{CHAIN_SCOPE}</Data>} />
            <Field
              label={say(COPY.total)}
              value={result ? String(result.totalRecords) : say(COPY.unknown)}
            />
            <Field
              label={say(COPY.through)}
              value={result ? String(result.verifiedThrough) : say(COPY.unknown)}
            />
            <Field
              label={say(COPY.firstFailure)}
              value={
                result?.firstFailureSequence != null ? (
                  String(result.firstFailureSequence)
                ) : (
                  <span className="app-meta">{say(COPY.none)}</span>
                )
              }
            />
            <Field
              label={say(COPY.verifiedAt)}
              value={result ? <Data>{result.verifiedAt}</Data> : say(COPY.unknown)}
            />
            <Field
              label={say(COPY.events)}
              value={
                integrity.auditEventCount === null ? say(COPY.unknown) : String(integrity.auditEventCount)
              }
            />
            <Field
              label={say(COPY.chained)}
              value={
                integrity.chainedEventCount === null
                  ? say(COPY.unknown)
                  : String(integrity.chainedEventCount)
              }
            />
          </FieldList>
        </div>
      </SettingsSection>

      {result?.status === "broken" ? (
        <SettingsSection title={say(COPY.broken)}>
          <Notice tone="warning">{say(COPY.brokenNote)}</Notice>
        </SettingsSection>
      ) : null}

      {result?.status === "empty" ? (
        <SettingsSection title={say(COPY.empty)}>
          <Notice>{say(COPY.emptyNote)}</Notice>
        </SettingsSection>
      ) : null}

      <SettingsSection title={say(COPY.technical)}>
        <FieldList label={say(COPY.technical)}>
          <Field label={say(COPY.algorithm)} value={<Data>{HASH_ALGORITHM}</Data>} />
          <Field
            label={say(COPY.genesis)}
            value={<Data size="sm">{GENESIS_HASH.slice(0, 24)}...</Data>}
          />
          <Field label={say(COPY.command)} value={<Data>npm run audit:verify-chain</Data>} />
          <Field
            label={say(COPY.export)}
            value={<StatusBadge status="unavailable" language={language} detail={say(COPY.exportNote)} />}
            note={say(COPY.exportNote)}
          />
        </FieldList>
      </SettingsSection>

      <SettingsSection title={say(COPY.boundary)}>
        <FieldList label={say(COPY.boundary)}>
          <Field
            label={say(COPY.statement)}
            value={AUDIT_PROTECTION_STATEMENT}
            note={say(COPY.statementNote)}
          />
        </FieldList>
      </SettingsSection>
    </div>
  );
}
