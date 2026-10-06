/**
 * First-run setup wizard.
 *
 * A five-step display-only wizard for first-time configuration orientation.
 * Reached via direct URL (/setup). No form submission or database writes.
 * Step is tracked via the URL query parameter ?step=N.
 *
 * Every step carries:
 * - The "Synthetic institution and data" disclosure in the footer.
 * - The "Illustrative regulatory context, not legal advice" notice where
 *   regulatory frameworks are mentioned.
 *
 * This is a demonstration wizard, not a configuration surface. An operator
 * reading this screen is orienting themselves, not making changes.
 */

import Link from "next/link";
import type { Metadata } from "next";
import { PRODUCT_IDENTITY } from "@/product/release/identity";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Setup: ${PRODUCT_IDENTITY.name}`,
  robots: { index: false, follow: false },
};

const TOTAL_STEPS = 5;

const STEP_LABELS = [
  "Welcome",
  "Organisation",
  "Roles",
  "Identity mode",
  "Done",
] as const;

interface SetupPageProps {
  searchParams: Promise<{ step?: string }>;
}

export default async function SetupPage({ searchParams }: SetupPageProps) {
  const params = await searchParams;
  const raw = parseInt(params.step ?? "1", 10);
  const step = Number.isFinite(raw) && raw >= 1 && raw <= TOTAL_STEPS ? raw : 1;

  const productMode = process.env["PRODUCT_MODE"] ?? "demonstration";

  return (
    <main
      id="main"
      style={{
        minHeight: "100dvh",
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
        background: "var(--app-surface-0)",
        fontFamily: "var(--app-font)",
      }}
    >
      {/* Header */}
      <header
        style={{
          borderBottom: "1px solid var(--app-border)",
          padding: "var(--app-4) var(--app-8)",
          display: "flex",
          alignItems: "center",
          gap: "var(--app-3)",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--app-3)" }}>
          <span
            style={{
              fontSize: "var(--app-text-sm)",
              fontWeight: 600,
              color: "var(--app-text-1)",
            }}
          >
            {PRODUCT_IDENTITY.name}
          </span>
          <span
            style={{
              fontSize: "var(--app-text-sm)",
              color: "var(--app-text-3)",
            }}
          >
            /
          </span>
          <span
            style={{
              fontSize: "var(--app-text-sm)",
              color: "var(--app-text-2)",
            }}
          >
            Setup wizard
          </span>
        </div>
        <StepIndicator current={step} total={TOTAL_STEPS} />
      </header>

      {/* Step content */}
      <div
        style={{
          maxWidth: 680,
          margin: "0 auto",
          padding: "var(--app-10) var(--app-8)",
          width: "100%",
        }}
      >
        {step === 1 && <StepWelcome />}
        {step === 2 && <StepOrganisation />}
        {step === 3 && <StepRoles />}
        {step === 4 && <StepIdentityMode productMode={productMode} />}
        {step === 5 && <StepDone />}

        {/* Navigation */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: "var(--app-8)",
            paddingTop: "var(--app-6)",
            borderTop: "1px solid var(--app-border)",
          }}
        >
          <div>
            {step > 1 && (
              <Link
                href={`/setup?step=${step - 1}`}
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
                Back
              </Link>
            )}
          </div>
          <div>
            {step < TOTAL_STEPS ? (
              <Link
                href={`/setup?step=${step + 1}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "var(--app-2)",
                  fontSize: "var(--app-text-sm)",
                  fontWeight: 500,
                  color: "var(--app-text-inverse)",
                  textDecoration: "none",
                  padding: "var(--app-2) var(--app-5)",
                  border: "1px solid transparent",
                  borderRadius: "var(--app-radius)",
                  background: "var(--app-accent)",
                }}
              >
                {STEP_LABELS[step] ?? "Next"}
              </Link>
            ) : (
              <Link
                href="/workday"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "var(--app-2)",
                  fontSize: "var(--app-text-sm)",
                  fontWeight: 500,
                  color: "var(--app-text-inverse)",
                  textDecoration: "none",
                  padding: "var(--app-2) var(--app-5)",
                  border: "1px solid transparent",
                  borderRadius: "var(--app-radius)",
                  background: "var(--app-accent)",
                }}
              >
                Enter the workday
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid var(--app-border)",
          padding: "var(--app-3) var(--app-8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--app-4)",
        }}
      >
        <span
          style={{
            fontSize: "var(--app-text-xs)",
            color: "var(--app-text-4)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          Step {step} of {TOTAL_STEPS}
        </span>
        <span
          style={{
            fontSize: "var(--app-text-xs)",
            color: "var(--app-text-4)",
            background: "var(--app-surface-1)",
            border: "1px solid var(--app-border)",
            borderRadius: "var(--app-radius)",
            padding: "2px var(--app-2)",
          }}
        >
          Synthetic institution and data
        </span>
      </footer>
    </main>
  );
}

/* ==========================================================================
   Step indicator
   ========================================================================== */

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--app-2)",
      }}
    >
      {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
        <Link
          key={n}
          href={`/setup?step=${n}`}
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: n === current ? "var(--app-accent)" : "var(--app-border)",
            display: "block",
            textDecoration: "none",
          }}
          aria-label={`Step ${n}: ${STEP_LABELS[n - 1] ?? ""}`}
          aria-current={n === current ? "step" : undefined}
        />
      ))}
    </div>
  );
}

/* ==========================================================================
   Shared notice primitives
   ========================================================================== */

function WizardNotice({
  tone,
  children,
}: {
  tone: "info" | "warning";
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: "var(--app-3) var(--app-4)",
        borderRadius: "var(--app-radius)",
        background: tone === "warning" ? "var(--app-warning-surface)" : "var(--app-info-surface)",
        border: `1px solid ${tone === "warning" ? "var(--app-warning-border)" : "var(--app-info-border)"}`,
        fontSize: "var(--app-text-sm)",
        color: "var(--app-text-2)",
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}

function WizardField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "180px 1fr",
        gap: "var(--app-4)",
        padding: "var(--app-3) 0",
        borderBottom: "1px solid var(--app-border)",
        alignItems: "baseline",
      }}
    >
      <span
        style={{
          fontSize: "var(--app-text-sm)",
          color: "var(--app-text-3)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: "var(--app-text-sm)",
          color: "var(--app-text-1)",
          fontFamily: mono ? "var(--app-font-mono)" : undefined,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function StatusChip({
  tone,
  children,
}: {
  tone: "available" | "demo" | "pass" | "warn";
  children: React.ReactNode;
}) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    available: {
      bg: "var(--app-success-surface)",
      text: "var(--app-success-text)",
      border: "var(--app-success-border)",
    },
    demo: {
      bg: "var(--app-surface-1)",
      text: "var(--app-text-3)",
      border: "var(--app-border)",
    },
    pass: {
      bg: "var(--app-success-surface)",
      text: "var(--app-success-text)",
      border: "var(--app-success-border)",
    },
    warn: {
      bg: "var(--app-warning-surface)",
      text: "var(--app-warning-text)",
      border: "var(--app-warning-border)",
    },
  };
  const c = colors[tone] ?? colors["demo"]!;
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: "var(--app-text-xs)",
        fontWeight: 500,
        padding: "2px var(--app-2)",
        borderRadius: "var(--app-radius)",
        background: c.bg,
        color: c.text,
        border: `1px solid ${c.border}`,
      }}
    >
      {children}
    </span>
  );
}

/* ==========================================================================
   Step 1: Welcome
   ========================================================================== */

function StepWelcome() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--app-6)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--app-2)" }}>
        <span
          style={{
            fontSize: "var(--app-text-xs)",
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--app-text-3)",
          }}
        >
          Step 1 of 5
        </span>
        <h1
          style={{
            fontSize: "var(--app-text-xl)",
            fontWeight: 700,
            color: "var(--app-text-1)",
            margin: 0,
          }}
        >
          Welcome to {PRODUCT_IDENTITY.name}
        </h1>
        <p
          style={{
            fontSize: "var(--app-text-md)",
            color: "var(--app-text-2)",
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          This wizard orients you to the pilot environment. It makes no changes to the database.
          Use it to confirm the configuration before your first design-partner session.
        </p>
      </div>

      <WizardNotice tone="info">
        <strong>Synthetic institution and data.</strong> Arcadia Savings Bank is a fictional
        institution created for this pilot. Every person, supplier, control, risk and regulatory
        reference in this environment is invented. Nothing here represents a real organisation or
        real regulatory state.
      </WizardNotice>

      <WizardNotice tone="warning">
        <strong>Illustrative regulatory context, not legal advice.</strong> References to DORA, EBA
        guidelines and FINMA circulars in this product are illustrative only. They are intended to
        help orientation, not to constitute legal advice or a compliance statement.
      </WizardNotice>

      <div
        style={{
          padding: "var(--app-5)",
          border: "1px solid var(--app-border)",
          borderRadius: "var(--app-radius)",
          background: "var(--app-surface-1)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--app-3)",
        }}
      >
        <span
          style={{
            fontSize: "var(--app-text-sm)",
            fontWeight: 600,
            color: "var(--app-text-2)",
          }}
        >
          What this wizard covers
        </span>
        <ul
          style={{
            margin: 0,
            padding: "0 0 0 var(--app-4)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--app-2)",
          }}
        >
          {[
            "Organisation: confirm institution name and jurisdiction",
            "Roles: which function roles are active vs. demo",
            "Identity mode: the current product deployment mode",
            "Done: links to the workday and the pilot readiness settings",
          ].map((item) => (
            <li
              key={item}
              style={{
                fontSize: "var(--app-text-sm)",
                color: "var(--app-text-2)",
                lineHeight: 1.5,
              }}
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ==========================================================================
   Step 2: Organisation
   ========================================================================== */

function StepOrganisation() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--app-6)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--app-2)" }}>
        <span
          style={{
            fontSize: "var(--app-text-xs)",
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--app-text-3)",
          }}
        >
          Step 2 of 5
        </span>
        <h1
          style={{
            fontSize: "var(--app-text-xl)",
            fontWeight: 700,
            color: "var(--app-text-1)",
            margin: 0,
          }}
        >
          Organisation
        </h1>
        <p
          style={{
            fontSize: "var(--app-text-md)",
            color: "var(--app-text-2)",
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          The synthetic institution used throughout this pilot. These values are pre-configured in
          the seed data and do not require editing.
        </p>
      </div>

      <div style={{ borderTop: "1px solid var(--app-border)" }}>
        <WizardField label="Institution name" value="Arcadia Savings Bank" />
        <WizardField label="Primary jurisdiction" value="DE (Germany)" />
        <WizardField label="Entity type" value="Savings bank (Sparkasse)" />
        <WizardField label="Regulatory bloc" value="EU" />
        <WizardField
          label="Applicable frameworks"
          value={
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--app-2)" }}>
              <span>DORA (Digital Operational Resilience Act)</span>
              <span>EBA guidelines on ICT and security risk</span>
            </div>
          }
        />
      </div>

      <WizardNotice tone="info">
        Illustrative regulatory context, not legal advice. DORA and EBA guidelines are referenced
        here because the entity is declared as a DE-jurisdiction institution. They represent
        example regulatory framing only.
      </WizardNotice>

      <WizardNotice tone="warning">
        This institution is entirely synthetic. No real bank is described here.
      </WizardNotice>
    </div>
  );
}

/* ==========================================================================
   Step 3: Roles
   ========================================================================== */

const ROLES = [
  {
    id: "rcsa",
    name: "RCSA",
    label: "Risk and Control Self-Assessment",
    status: "available" as const,
  },
  {
    id: "tprm",
    name: "TPRM",
    label: "Third-Party Risk Management",
    status: "available" as const,
  },
  {
    id: "control-assurance",
    name: "Control Assurance",
    label: "Independent control testing and evidence",
    status: "demo" as const,
  },
  {
    id: "incident-resilience",
    name: "Incident Resilience",
    label: "Incident response and operational continuity",
    status: "demo" as const,
  },
] as const;

function StepRoles() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--app-6)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--app-2)" }}>
        <span
          style={{
            fontSize: "var(--app-text-xs)",
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--app-text-3)",
          }}
        >
          Step 3 of 5
        </span>
        <h1
          style={{
            fontSize: "var(--app-text-xl)",
            fontWeight: 700,
            color: "var(--app-text-1)",
            margin: 0,
          }}
        >
          Roles
        </h1>
        <p
          style={{
            fontSize: "var(--app-text-md)",
            color: "var(--app-text-2)",
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          Which function roles are active in this pilot. Available roles have full process tooling.
          Demo roles have scripted scenarios for orientation purposes.
        </p>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--app-3)",
        }}
      >
        {ROLES.map((role) => (
          <div
            key={role.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "var(--app-4)",
              border: "1px solid var(--app-border)",
              borderRadius: "var(--app-radius)",
              background: "var(--app-surface-1)",
              gap: "var(--app-4)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--app-1)" }}>
              <span
                style={{
                  fontSize: "var(--app-text-sm)",
                  fontWeight: 600,
                  color: "var(--app-text-1)",
                }}
              >
                {role.name}
              </span>
              <span
                style={{
                  fontSize: "var(--app-text-xs)",
                  color: "var(--app-text-3)",
                }}
              >
                {role.label}
              </span>
            </div>
            <StatusChip tone={role.status}>
              {role.status === "available" ? "Available" : "Demo"}
            </StatusChip>
          </div>
        ))}
      </div>

      <WizardNotice tone="info">
        Pilot accounts PILOT-001 (RCSA) and PILOT-002 (TPRM) are active. The administrator
        account PILOT-ADM has access to all areas. See Settings / Pilot readiness for account
        details.
      </WizardNotice>
    </div>
  );
}

/* ==========================================================================
   Step 4: Identity mode
   ========================================================================== */

function StepIdentityMode({ productMode }: { productMode: string }) {
  const modeDisplay =
    productMode === "design-partner"
      ? "design-partner (pilot)"
      : productMode === "offline-evaluation"
        ? "offline-evaluation"
        : "demonstration";

  const modeNote =
    productMode === "design-partner"
      ? "Design-partner mode is active. Role assignment is fixed per account. Scenario reset requires administrator privileges."
      : productMode === "offline-evaluation"
        ? "Offline-evaluation mode is active. Sessions are typically unattended. Scenario reset requires administrator privileges."
        : "Demonstration mode is active. Role switching is unrestricted. This mode is for internal demonstrations, not for design-partner sessions.";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--app-6)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--app-2)" }}>
        <span
          style={{
            fontSize: "var(--app-text-xs)",
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--app-text-3)",
          }}
        >
          Step 4 of 5
        </span>
        <h1
          style={{
            fontSize: "var(--app-text-xl)",
            fontWeight: 700,
            color: "var(--app-text-1)",
            margin: 0,
          }}
        >
          Identity mode
        </h1>
        <p
          style={{
            fontSize: "var(--app-text-md)",
            color: "var(--app-text-2)",
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          The PRODUCT_MODE environment variable controls how identity and sessions work. This is
          display-only; change it in your environment configuration, not here.
        </p>
      </div>

      <div style={{ borderTop: "1px solid var(--app-border)" }}>
        <WizardField label="PRODUCT_MODE" value={modeDisplay} mono />
        <WizardField
          label="Role switching"
          value={
            productMode === "design-partner" || productMode === "offline-evaluation"
              ? "Restricted to assigned roles"
              : "Unrestricted (demonstration control)"
          }
        />
        <WizardField
          label="Scenario reset"
          value={
            productMode === "design-partner" || productMode === "offline-evaluation"
              ? "Administrator only"
              : "Any user"
          }
        />
      </div>

      <WizardNotice tone={productMode === "design-partner" ? "info" : "warning"}>
        {modeNote}
      </WizardNotice>
    </div>
  );
}

/* ==========================================================================
   Step 5: Done
   ========================================================================== */

function StepDone() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--app-6)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--app-2)" }}>
        <span
          style={{
            fontSize: "var(--app-text-xs)",
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--app-text-3)",
          }}
        >
          Step 5 of 5
        </span>
        <h1
          style={{
            fontSize: "var(--app-text-xl)",
            fontWeight: 700,
            color: "var(--app-text-1)",
            margin: 0,
          }}
        >
          Ready to begin
        </h1>
        <p
          style={{
            fontSize: "var(--app-text-md)",
            color: "var(--app-text-2)",
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          The pilot environment is oriented. Use the links below to enter the workday or to review
          the full readiness checklist in settings.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--app-3)" }}>
        <Link
          href="/workday"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "var(--app-5)",
            border: "1px solid var(--app-accent)",
            borderRadius: "var(--app-radius)",
            background: "var(--app-surface-1)",
            textDecoration: "none",
            gap: "var(--app-4)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--app-1)" }}>
            <span
              style={{
                fontSize: "var(--app-text-sm)",
                fontWeight: 600,
                color: "var(--app-text-1)",
              }}
            >
              Enter the workday
            </span>
            <span
              style={{
                fontSize: "var(--app-text-xs)",
                color: "var(--app-text-3)",
              }}
            >
              The live NFR day for your assigned role
            </span>
          </div>
          <span
            style={{
              fontSize: "var(--app-text-xs)",
              color: "var(--app-text-3)",
            }}
          >
            /workday
          </span>
        </Link>

        <Link
          href="/settings/pilot"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "var(--app-5)",
            border: "1px solid var(--app-border)",
            borderRadius: "var(--app-radius)",
            background: "var(--app-surface-1)",
            textDecoration: "none",
            gap: "var(--app-4)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--app-1)" }}>
            <span
              style={{
                fontSize: "var(--app-text-sm)",
                fontWeight: 600,
                color: "var(--app-text-1)",
              }}
            >
              Pilot readiness settings
            </span>
            <span
              style={{
                fontSize: "var(--app-text-xs)",
                color: "var(--app-text-3)",
              }}
            >
              Database checks, pilot accounts, regulatory scope, evidence pack
            </span>
          </div>
          <span
            style={{
              fontSize: "var(--app-text-xs)",
              color: "var(--app-text-3)",
            }}
          >
            /settings/pilot
          </span>
        </Link>
      </div>

      <div
        style={{
          padding: "var(--app-4)",
          border: "1px solid var(--app-border)",
          borderRadius: "var(--app-radius)",
          background: "var(--app-surface-1)",
        }}
      >
        <p
          style={{
            fontSize: "var(--app-text-xs)",
            color: "var(--app-text-3)",
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          Arcadia Savings Bank is a synthetic institution. All people, suppliers, controls, risks
          and regulatory references in this environment are invented for the purpose of this pilot.
          Illustrative regulatory context, not legal advice.
        </p>
      </div>
    </div>
  );
}
