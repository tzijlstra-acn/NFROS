/**
 * Pilot readiness dashboard.
 *
 * Six readiness checks, pilot account roster, regulatory scope note and the
 * evidence pack link. Server component: reads the database synchronously and
 * renders the result. Never crashes: every DB call is wrapped in try/catch.
 *
 * Security constraints:
 * - No credentials shown -- pilot accounts display name, role and institution only.
 * - "Synthetic institution and data" label is rendered by the settings layout.
 * - Every regulatory reference carries the illustrative-context disclaimer.
 * - DORA/EBA scoped to DE/AT only; FINMA scoped to CH only.
 */

import { getSqlite } from "@/db/client";
import { PILOT_USERS } from "@/identity/pilot-config";
import { SettingsHead, SettingsSection, Field, FieldList } from "@/components/settings/primitives";
import { Notice, Chip } from "@/components/workday-v2/primitives";

export const dynamic = "force-dynamic";

/* ==========================================================================
   Readiness checks
   ========================================================================== */

type CheckStatus = "pass" | "warn" | "error";

interface ReadinessCheck {
  id: string;
  label: string;
  detail: string;
  status: CheckStatus;
}

function runReadinessChecks(): ReadinessCheck[] {
  const checks: ReadinessCheck[] = [];

  // 1. Database: accessible
  {
    let status: CheckStatus = "error";
    let detail = "Database could not be reached.";
    try {
      const row = getSqlite()
        .prepare("SELECT count(*) as n FROM sqlite_master WHERE type = 'table'")
        .get() as { n: number } | undefined;
      if ((row?.n ?? 0) > 0) {
        status = "pass";
        detail = `Schema present: ${String(row?.n ?? 0)} tables found.`;
      } else {
        status = "warn";
        detail = "Database accessible but no tables found. Run db:migrate and db:seed.";
      }
    } catch (err) {
      status = "error";
      detail = `Database not accessible: ${err instanceof Error ? err.message : "unknown error"}.`;
    }
    checks.push({ id: "database", label: "Database: accessible", detail, status });
  }

  // 2. Seed data: loaded
  {
    let status: CheckStatus = "warn";
    let detail = "role_app_runs table is empty or not yet migrated. Run db:seed.";
    try {
      const row = getSqlite()
        .prepare("SELECT count(*) as n FROM role_app_runs")
        .get() as { n: number } | undefined;
      const count = row?.n ?? 0;
      if (count > 0) {
        status = "pass";
        detail = `${String(count)} process run(s) seeded.`;
      }
    } catch {
      status = "warn";
      detail = "role_app_runs table not found. Run db:migrate and db:seed.";
    }
    checks.push({ id: "seed-data", label: "Seed data: loaded", detail, status });
  }

  // 3. Identity mode: configured
  {
    const productMode = process.env["PRODUCT_MODE"] ?? "";
    let status: CheckStatus = "warn";
    let detail = "";
    if (productMode === "design-partner") {
      status = "pass";
      detail = "PRODUCT_MODE = design-partner. Role assignment is fixed per account.";
    } else if (productMode === "offline-evaluation") {
      status = "pass";
      detail = "PRODUCT_MODE = offline-evaluation. Sessions are unattended-safe.";
    } else if (productMode === "") {
      status = "warn";
      detail = "PRODUCT_MODE is not set. Running in demonstration mode, not suitable for pilot sessions.";
    } else {
      status = "warn";
      detail = `PRODUCT_MODE = ${productMode}. Set to 'design-partner' for pilot sessions.`;
    }
    checks.push({ id: "identity-mode", label: "Identity mode: configured", detail, status });
  }

  // 4. AI routines: seeded
  {
    let status: CheckStatus = "warn";
    let detail = "ai_routines table is empty or not yet migrated.";
    try {
      const row = getSqlite()
        .prepare("SELECT count(*) as n FROM ai_routines")
        .get() as { n: number } | undefined;
      const count = row?.n ?? 0;
      if (count > 0) {
        status = "pass";
        detail = `${String(count)} AI routine(s) seeded.`;
      }
    } catch {
      status = "warn";
      detail = "ai_routines table not found. Run db:migrate and db:seed.";
    }
    checks.push({ id: "ai-routines", label: "AI routines: seeded", detail, status });
  }

  // 5. Audit chain: initialised
  {
    let status: CheckStatus = "warn";
    let detail = "audit_chain_records table not found. Run db:migrate.";
    try {
      const row = getSqlite()
        .prepare("SELECT count(*) as n FROM audit_chain_records")
        .get() as { n: number } | undefined;
      const count = row?.n ?? 0;
      status = "pass";
      detail =
        count > 0
          ? `Audit chain initialised: ${String(count)} record(s).`
          : "Audit chain table present. Records will be written when events occur.";
    } catch {
      status = "warn";
    }
    checks.push({ id: "audit-chain", label: "Audit chain: initialised", detail, status });
  }

  // 6. At least one process run active
  {
    let status: CheckStatus = "warn";
    let detail = "No active process runs found. Run db:seed.";
    try {
      const row = getSqlite()
        .prepare("SELECT count(*) as n FROM role_app_runs WHERE status != 'archived'")
        .get() as { n: number } | undefined;
      const count = row?.n ?? 0;
      if (count > 0) {
        status = "pass";
        detail = `${String(count)} active process run(s).`;
      }
    } catch {
      status = "warn";
      detail = "role_app_runs table not found. Run db:migrate and db:seed.";
    }
    checks.push({
      id: "active-run",
      label: "At least one process run active",
      detail,
      status,
    });
  }

  return checks;
}

/* ==========================================================================
   Page
   ========================================================================== */

export default function PilotReadinessPage() {
  const checks = runReadinessChecks();
  const passCount = checks.filter((c) => c.status === "pass").length;
  const allPass = passCount === checks.length;

  const productMode = process.env["PRODUCT_MODE"] ?? "demonstration";

  // Jurisdiction -- derived from the seed institution (DE).
  // Typed as string so comparisons against "CH" are valid.
  const jurisdiction: string = "DE";

  return (
    <div className="app-stack app-stack-6">
      <SettingsHead
        eyebrow="Administrator area"
        title="Pilot readiness"
        lede="Readiness checks, pilot accounts and regulatory scope for the design-partner release. Use this page before each pilot session to confirm the environment is ready."
      />

      {allPass ? (
        <Notice tone="info">
          All {checks.length} readiness checks pass. The environment is ready for a pilot session.
        </Notice>
      ) : (
        <Notice tone="warning">
          {passCount} of {checks.length} checks pass. Review the items marked as warning below
          before starting a pilot session.
        </Notice>
      )}

      {/* Readiness checks */}
      <SettingsSection title="Readiness checks" count={checks.length}>
        <div className="app-stack app-stack-3">
          {checks.map((check) => (
            <div
              key={check.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "var(--app-4)",
                padding: "var(--app-4)",
                border: "1px solid var(--app-border)",
                borderRadius: "var(--app-radius)",
                background: "var(--app-surface-1)",
              }}
            >
              <CheckMark status={check.status} />
              <div className="app-stack app-stack-1" style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    fontSize: "var(--app-text-sm)",
                    fontWeight: 500,
                    color: "var(--app-text-1)",
                  }}
                >
                  {check.label}
                </span>
                <span
                  style={{
                    fontSize: "var(--app-text-xs)",
                    color: "var(--app-text-3)",
                    lineHeight: 1.5,
                  }}
                >
                  {check.detail}
                </span>
              </div>
              <StatusBadge status={check.status} />
            </div>
          ))}
        </div>
      </SettingsSection>

      {/* Pilot accounts */}
      <SettingsSection title="Pilot accounts" count={PILOT_USERS.length}>
        <div className="app-stack app-stack-2">
          <p
            className="app-secondary"
            style={{ fontSize: "var(--app-text-sm)", maxWidth: "76ch" }}
          >
            Synthetic accounts pre-configured for the design-partner pilot. Credentials are not
            shown here. Use the identity configuration to retrieve login details.
          </p>
          <FieldList label="Pilot accounts">
            {PILOT_USERS.map((user) => (
              <Field
                key={user.userId}
                label={user.displayName}
                value={
                  <span className="app-row app-row-wrap">
                    <Chip tone="neutral">{user.isAdministrator ? "Administrator" : `Role: ${user.roleIds.join(", ")}`}</Chip>
                    <Chip tone="info">Arcadia Savings Bank</Chip>
                    <span className="app-meta">{user.userId}</span>
                  </span>
                }
              />
            ))}
          </FieldList>
        </div>
      </SettingsSection>

      {/* Regulatory scope */}
      <SettingsSection title="Regulatory scope">
        <div className="app-stack app-stack-3">
          <FieldList label="Regulatory scope">
            <Field label="Jurisdiction" value={jurisdiction} />
            <Field
              label="Applicable frameworks"
              value={
                jurisdiction === "CH" ? (
                  <span className="app-row app-row-wrap">
                    <Chip tone="info">FINMA</Chip>
                  </span>
                ) : (
                  <span className="app-row app-row-wrap">
                    <Chip tone="info">DORA</Chip>
                    <Chip tone="info">EBA ICT guidelines</Chip>
                  </span>
                )
              }
            />
            <Field
              label="Note"
              value={
                jurisdiction === "CH"
                  ? "FINMA circulars apply to this entity. DORA does not directly apply to Swiss entities."
                  : "DORA and EBA guidelines apply to DE/AT entities in scope of the EU digital resilience framework."
              }
            />
          </FieldList>
          <p className="app-meta" style={{ maxWidth: "76ch" }}>
            Illustrative regulatory context, not legal advice. Regulatory references in this
            product are for orientation only and do not constitute a compliance statement.
          </p>
        </div>
      </SettingsSection>

      {/* Identity mode */}
      <SettingsSection title="Identity configuration">
        <FieldList label="Identity mode details">
          <Field label="PRODUCT_MODE" value={productMode} mono />
          <Field
            label="Status"
            value={
              productMode === "design-partner" || productMode === "offline-evaluation" ? (
                <Chip tone="success">Configured for pilot</Chip>
              ) : (
                <Chip tone="warning">Demonstration mode: set PRODUCT_MODE for pilot use</Chip>
              )
            }
          />
        </FieldList>
      </SettingsSection>

      {/* Evidence pack */}
      <SettingsSection title="Evidence pack">
        <div className="app-stack app-stack-3">
          <p
            className="app-secondary"
            style={{ fontSize: "var(--app-text-sm)", maxWidth: "76ch" }}
          >
            The evidence pack is a JSON file that captures the current readiness state, seeded
            data summary, regulatory scope and synthetic-data disclosure. It is intended for
            design-partner handoff documentation.
          </p>
          <p
            className="app-secondary"
            style={{ fontSize: "var(--app-text-sm)", maxWidth: "76ch" }}
          >
            To generate: run{" "}
            <code
              style={{
                fontFamily: "var(--app-font-mono)",
                fontSize: "var(--app-text-xs)",
                background: "var(--app-surface-2)",
                padding: "1px 4px",
                borderRadius: "var(--app-radius-sm)",
                border: "1px solid var(--app-border)",
              }}
            >
              npm run pilot:evidence-pack
            </code>{" "}
            which writes to{" "}
            <code
              style={{
                fontFamily: "var(--app-font-mono)",
                fontSize: "var(--app-text-xs)",
                background: "var(--app-surface-2)",
                padding: "1px 4px",
                borderRadius: "var(--app-radius-sm)",
                border: "1px solid var(--app-border)",
              }}
            >
              release/pilot-evidence.json
            </code>
            .
          </p>
          <div>
            <a
              href="/api/pilot/evidence"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--app-2)",
                fontSize: "var(--app-text-sm)",
                color: "var(--app-text-2)",
                textDecoration: "none",
                padding: "var(--app-2) var(--app-4)",
                border: "1px solid var(--app-border)",
                borderRadius: "var(--app-radius)",
                background: "var(--app-surface-1)",
              }}
            >
              Download evidence pack (API)
            </a>
          </div>
          <p className="app-meta" style={{ maxWidth: "76ch" }}>
            The evidence pack contains no credentials, no session secrets and no personal data.
            It contains only operational metadata and counts.
          </p>
        </div>
      </SettingsSection>
    </div>
  );
}

/* ==========================================================================
   Local presentational helpers
   ========================================================================== */

function CheckMark({ status }: { status: CheckStatus }) {
  const color =
    status === "pass"
      ? "var(--app-success-text)"
      : status === "warn"
        ? "var(--app-warning-text)"
        : "var(--app-danger-text)";

  const symbol = status === "pass" ? "+" : status === "warn" ? "!" : "x";

  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 20,
        height: 20,
        borderRadius: "50%",
        background:
          status === "pass"
            ? "var(--app-success-surface)"
            : status === "warn"
              ? "var(--app-warning-surface)"
              : "var(--app-danger-surface)",
        border: `1px solid ${color}`,
        color,
        fontSize: "var(--app-text-xs)",
        fontWeight: 700,
        flexShrink: 0,
        marginTop: 1,
      }}
    >
      {symbol}
    </span>
  );
}

function StatusBadge({ status }: { status: CheckStatus }) {
  if (status === "pass") return <Chip tone="success">Pass</Chip>;
  if (status === "warn") return <Chip tone="warning">Warn</Chip>;
  return <Chip tone="danger">Error</Chip>;
}
