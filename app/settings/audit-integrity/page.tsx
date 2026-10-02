/**
 * Audit integrity settings page.
 *
 * An administrator surface that shows the current status of the tamper-evident
 * audit hash chain. The page is a server component: it calls verifyChain()
 * directly on render so the status is always current, not cached from a build.
 *
 * This is a read-only view. The chain is managed entirely by the audit service;
 * no interactive controls are exposed here.
 */

import {
  Field,
  FieldList,
  SettingsHead,
  SettingsSection,
} from "@/components/settings/primitives";
import { Chip, Data, Notice } from "@/components/workday-v2/primitives";
import { verifyChain, CHAIN_SCOPE } from "@/audit/verify-chain";
import { AUDIT_PROTECTION_STATEMENT } from "@/audit/db-protection";
import { HASH_ALGORITHM, GENESIS_HASH } from "@/audit/chain";

export const dynamic = "force-dynamic";

/* --------------------------------------------------------------------------
   Status display helpers
   -------------------------------------------------------------------------- */

function statusTone(status: "valid" | "broken" | "empty"): "success" | "warning" | "neutral" {
  switch (status) {
    case "valid":
      return "success";
    case "broken":
      return "warning";
    case "empty":
      return "neutral";
  }
}

function statusLabel(status: "valid" | "broken" | "empty"): string {
  switch (status) {
    case "valid":
      return "Valid";
    case "broken":
      return "Broken";
    case "empty":
      return "Empty";
  }
}

/* --------------------------------------------------------------------------
   Page
   -------------------------------------------------------------------------- */

export default function AuditIntegrityPage() {
  const result = verifyChain(CHAIN_SCOPE);

  return (
    <div className="app-stack app-stack-6">
      <SettingsHead
        eyebrow="Administrator area"
        title="Audit integrity"
        lede="The audit log is protected by a tamper-evident hash chain. Each event is hashed together with the hash of the preceding event, so any modification to a historical record breaks all subsequent hashes. This page shows the current verification status."
      />

      <SettingsSection title="Chain status">
        <FieldList label="Chain status">
          <Field label="Chain scope" value={<Data>{CHAIN_SCOPE}</Data>} />
          <Field
            label="Status"
            value={
              <Chip tone={statusTone(result.status)}>{statusLabel(result.status)}</Chip>
            }
          />
          <Field label="Total records" value={String(result.totalRecords)} />
          <Field label="Verified through sequence" value={String(result.verifiedThrough)} />
          <Field
            label="First failure sequence"
            value={
              result.firstFailureSequence != null
                ? String(result.firstFailureSequence)
                : <span className="app-meta">None</span>
            }
          />
          <Field label="Verified at" value={<Data>{result.verifiedAt}</Data>} />
        </FieldList>
      </SettingsSection>

      {result.status === "broken" ? (
        <SettingsSection title="Integrity failure">
          <Notice tone="warning">
            The chain is broken at sequence {result.firstFailureSequence}. The record at
            that position has a hash that does not match the recomputed value. Either that
            record or a preceding record was modified after it was written. Run{" "}
            <Data size="sm">npm run audit:verify-chain</Data> from the server for the full
            output, and compare the database file modification timestamp against your
            deployment log.
          </Notice>
        </SettingsSection>
      ) : null}

      {result.status === "empty" ? (
        <SettingsSection title="Chain not seeded">
          <Notice tone="neutral">
            No chain records have been written yet. Run{" "}
            <Data size="sm">npm run db:seed</Data> to populate the chain, or call{" "}
            <Data size="sm">appendChainRecord()</Data> from your audit write path to
            start the chain.
          </Notice>
        </SettingsSection>
      ) : null}

      <SettingsSection title="Technical details">
        <FieldList label="Technical details">
          <Field label="Hash algorithm" value={<Data>{HASH_ALGORITHM}</Data>} />
          <Field
            label="Genesis hash prefix"
            value={<Data size="sm">{GENESIS_HASH.slice(0, 24)}...</Data>}
          />
          <Field
            label="Verification command"
            value={<Data>npm run audit:verify-chain</Data>}
          />
          <Field
            label="Export audit evidence"
            value={
              <span className="app-meta">
                Planned - will be available at /api/audit/export in a future release.
              </span>
            }
          />
        </FieldList>
      </SettingsSection>

      <SettingsSection title="Protection boundary">
        <FieldList label="Protection boundary">
          <Field
            label="Protection statement"
            value={AUDIT_PROTECTION_STATEMENT}
            note="A machine administrator with direct database file access can replace or modify the database outside the application boundary. This is tamper-evident, not tamper-proof, and is not equivalent to cryptographic non-repudiation."
          />
        </FieldList>
      </SettingsSection>
    </div>
  );
}
