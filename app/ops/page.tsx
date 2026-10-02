/**
 * /ops -- Operations Console
 *
 * Administrator-only surface for operational diagnostics. Shows component
 * health, job queue depth, failed jobs, AI provider status and release info.
 *
 * Server component: reads directly from the health service and repositories.
 * No content, secrets or user data is shown here.
 *
 * IMPORTANT: In production this page must be protected by administrator
 * authentication. In demonstration mode it is open.
 */

import type { Metadata } from "next";
import {
  getHealthSummary,
  checkAIProviderHealth,
  checkAuditChainHealth,
  type ComponentHealth,
  type ComponentStatus,
} from "@/health/service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Operations Console: NFR WorkOS",
  robots: { index: false, follow: false },
};

/* ==========================================================================
   Status badge
   ========================================================================== */

function statusColor(status: ComponentStatus): string {
  switch (status) {
    case "healthy":
      return "var(--wd-green-600, #16a34a)";
    case "degraded":
      return "var(--wd-amber-600, #d97706)";
    case "unavailable":
      return "var(--wd-red-600, #dc2626)";
    case "not-configured":
      return "var(--wd-slate-400, #94a3b8)";
    case "not-verified":
      return "var(--wd-blue-500, #3b82f6)";
  }
}

function StatusBadge({ status }: { status: ComponentStatus }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "4px",
        background: statusColor(status),
        color: "#fff",
        fontSize: "var(--wd-text-xs, 11px)",
        fontWeight: 600,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
    >
      {status}
    </span>
  );
}

/* ==========================================================================
   Section wrapper
   ========================================================================== */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        borderTop: "1px solid var(--wd-border, #e2e8f0)",
        paddingTop: "var(--wd-space-6, 1.5rem)",
        marginTop: "var(--wd-space-6, 1.5rem)",
      }}
    >
      <h2
        style={{
          fontSize: "var(--wd-text-sm, 13px)",
          fontWeight: 600,
          color: "var(--wd-text-muted, #64748b)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: "var(--wd-space-3, 0.75rem)",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

/* ==========================================================================
   Component health row
   ========================================================================== */

function ComponentRow({ component }: { component: ComponentHealth }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--wd-space-3, 0.75rem)",
        padding: "var(--wd-space-2, 0.5rem) 0",
        borderBottom: "1px solid var(--wd-border-subtle, #f1f5f9)",
      }}
    >
      <StatusBadge status={component.status} />
      <span
        style={{
          fontWeight: 500,
          color: "var(--wd-text, #0f172a)",
          fontSize: "var(--wd-text-sm, 13px)",
          minWidth: "140px",
        }}
      >
        {component.name}
      </span>
      {component.latencyMs !== undefined && (
        <span style={{ fontSize: "var(--wd-text-xs, 11px)", color: "var(--wd-text-muted, #64748b)" }}>
          {component.latencyMs} ms
        </span>
      )}
      {component.detail && (
        <span style={{ fontSize: "var(--wd-text-xs, 11px)", color: "var(--wd-text-muted, #64748b)" }}>
          {component.detail}
        </span>
      )}
    </div>
  );
}

/* ==========================================================================
   Data row
   ========================================================================== */

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        gap: "var(--wd-space-4, 1rem)",
        padding: "var(--wd-space-2, 0.5rem) 0",
        borderBottom: "1px solid var(--wd-border-subtle, #f1f5f9)",
        fontSize: "var(--wd-text-sm, 13px)",
      }}
    >
      <span
        style={{
          color: "var(--wd-text-muted, #64748b)",
          minWidth: "160px",
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span style={{ color: "var(--wd-text, #0f172a)", fontWeight: 500, fontFamily: "monospace" }}>
        {value}
      </span>
    </div>
  );
}

/* ==========================================================================
   Page
   ========================================================================== */

export default async function OpsPage() {
  const health = await getHealthSummary(true);
  const ai = await checkAIProviderHealth();
  const auditChain = await checkAuditChainHealth();

  // Job depth: gracefully degrade if the background-jobs repository is not present.
  let jobDepth: number | null = null;
  let failedJobs: Array<{ id: string; createdAt: string; status: string }> = [];
  try {
    const repo = await import("@/db/repositories/background-jobs");
    jobDepth = repo.getJobDepth();
    if (typeof repo.getFailedJobs === "function") {
      const raw = repo.getFailedJobs();
      if (Array.isArray(raw)) {
        failedJobs = raw
          .slice(-5)
          .map((r: { id: string; createdAt: string; status: string }) => ({
            id: r.id,
            createdAt: r.createdAt,
            status: r.status,
          }));
      }
    }
  } catch {
    // background-jobs repository not yet present -- expected during V4 build phase
  }

  return (
    <div
      className="workday-v2"
      style={{
        maxWidth: "720px",
        margin: "0 auto",
        padding: "var(--wd-space-8, 2rem) var(--wd-space-6, 1.5rem)",
        fontFamily: "var(--wd-font-sans, system-ui, sans-serif)",
      }}
    >
      {/* Header */}
      <h1
        style={{
          fontSize: "var(--wd-text-xl, 20px)",
          fontWeight: 700,
          color: "var(--wd-text, #0f172a)",
          marginBottom: "var(--wd-space-2, 0.5rem)",
        }}
      >
        Operations Console
      </h1>
      <p
        style={{
          fontSize: "var(--wd-text-sm, 13px)",
          color: "var(--wd-text-muted, #64748b)",
          marginBottom: "var(--wd-space-2, 0.5rem)",
        }}
      >
        Administrator access required in production. This page is open in demonstration mode.
      </p>

      {/* System health */}
      <Section title="System health">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--wd-space-3, 0.75rem)",
            marginBottom: "var(--wd-space-3, 0.75rem)",
          }}
        >
          <span
            style={{
              fontSize: "var(--wd-text-sm, 13px)",
              color: "var(--wd-text-muted, #64748b)",
            }}
          >
            Overall
          </span>
          <StatusBadge status={health.status} />
          <span style={{ fontSize: "var(--wd-text-xs, 11px)", color: "var(--wd-text-muted, #64748b)" }}>
            Checked at {health.checkedAt}
          </span>
        </div>
        {health.components.map((component) => (
          <ComponentRow key={component.name} component={component} />
        ))}
      </Section>

      {/* Jobs */}
      <Section title="Job queue">
        {jobDepth === null ? (
          <p style={{ fontSize: "var(--wd-text-sm, 13px)", color: "var(--wd-text-muted, #64748b)" }}>
            Background jobs repository not configured. Expected during V4 build phase.
          </p>
        ) : (
          <DataRow label="Pending jobs" value={jobDepth !== null ? String(jobDepth) : "0"} />
        )}
      </Section>

      {/* Failed jobs */}
      <Section title="Failed jobs (last 5)">
        {failedJobs.length === 0 ? (
          <p style={{ fontSize: "var(--wd-text-sm, 13px)", color: "var(--wd-text-muted, #64748b)" }}>
            {jobDepth === null
              ? "Background jobs repository not configured."
              : "No failed jobs recorded."}
          </p>
        ) : (
          failedJobs.map((job) => (
            <div
              key={job.id}
              style={{
                padding: "var(--wd-space-2, 0.5rem) 0",
                borderBottom: "1px solid var(--wd-border-subtle, #f1f5f9)",
                fontSize: "var(--wd-text-sm, 13px)",
              }}
            >
              <span style={{ fontFamily: "monospace", color: "var(--wd-text, #0f172a)" }}>{job.id}</span>
              <span
                style={{
                  marginLeft: "var(--wd-space-3, 0.75rem)",
                  color: "var(--wd-text-muted, #64748b)",
                }}
              >
                {job.createdAt}
              </span>
              <span
                style={{
                  marginLeft: "var(--wd-space-3, 0.75rem)",
                  color: "var(--wd-red-600, #dc2626)",
                }}
              >
                {job.status}
              </span>
            </div>
          ))
        )}
      </Section>

      {/* AI provider */}
      <Section title="AI provider">
        <ComponentRow component={ai} />
      </Section>

      {/* Audit chain */}
      <Section title="Audit chain">
        <ComponentRow component={auditChain} />
      </Section>

      {/* Release info */}
      <Section title="Release">
        <DataRow label="Version" value="4.0.0" />
        <DataRow label="Release name" value="NFROS Design Partner Release" />
        <DataRow label="Schema" value="91+ tables" />
      </Section>

      {/* Footer */}
      <p
        style={{
          marginTop: "var(--wd-space-8, 2rem)",
          fontSize: "var(--wd-text-xs, 11px)",
          color: "var(--wd-text-muted, #64748b)",
          borderTop: "1px solid var(--wd-border, #e2e8f0)",
          paddingTop: "var(--wd-space-4, 1rem)",
        }}
      >
        Synthetic institution and data. No real individuals, organisations or regulatory decisions
        are represented.
      </p>
    </div>
  );
}
