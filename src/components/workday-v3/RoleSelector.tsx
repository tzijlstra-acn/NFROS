/**
 * Role selector for V3.3.
 *
 * Light canvas, no navigation rail, no dark panels. This is the first screen
 * a user sees when they enter the interactive workday. The page is scoped
 * under `.workday-v3` so all V3 tokens resolve; it does not use the frame
 * layout because no role has been chosen yet.
 *
 * Data comes from the static release definitions, not the database. The
 * selector is therefore usable before the scenario is seeded and renders
 * identically on every request.
 *
 * Server component. No client-side state needed.
 */

import Link from "next/link";
import {
  ROLE_RELEASE_DEFINITIONS,
  type RoleReleaseDefinition,
} from "@/product/release/role-release";

const available = ROLE_RELEASE_DEFINITIONS.filter((r) => r.status === "available");
const demo = ROLE_RELEASE_DEFINITIONS.filter((r) => r.status === "demo");
const planned = ROLE_RELEASE_DEFINITIONS.filter((r) => r.status === "planned");

export function RoleSelector() {
  return (
    <div
      className="workday-v3"
      style={{
        minHeight: "100dvh",
        background: "var(--wd-canvas)",
        color: "var(--wd-text)",
        fontFamily: "var(--wd-font)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <header
        style={{
          height: "var(--wd-header-h)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 var(--wd-6)",
          background: "var(--wd-surface)",
          borderBottom: "1px solid var(--wd-border)",
          flexShrink: 0,
        }}
      >
        <Link
          href="/"
          style={{
            fontSize: "var(--wd-text-base)",
            fontWeight: "var(--wd-weight-strong)",
            letterSpacing: "-0.01em",
            color: "var(--wd-text)",
            textDecoration: "none",
          }}
        >
          NFR WorkOS
        </Link>
        <span
          style={{
            fontSize: "var(--wd-text-xs)",
            color: "var(--wd-text-muted)",
          }}
        >
          Synthetic institution and data
        </span>
      </header>

      {/* Main content */}
      <main
        id="main"
        style={{
          flex: 1,
          padding: "var(--wd-10) var(--wd-6)",
        }}
      >
        <div
          style={{
            maxWidth: 1040,
            marginInline: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "var(--wd-8)",
          }}
        >
          {/* Page title */}
          <div>
            <h1
              style={{
                fontSize: "var(--wd-text-2xl)",
                fontWeight: "var(--wd-weight-strong)",
                letterSpacing: "-0.012em",
                lineHeight: "var(--wd-leading-tight)",
                margin: 0,
                color: "var(--wd-text)",
              }}
            >
              Choose your role
            </h1>
          </div>

          {/* Available roles */}
          <section>
            <p
              style={{
                fontSize: "var(--wd-text-xs)",
                fontWeight: "var(--wd-weight-medium)",
                color: "var(--wd-text-muted)",
                letterSpacing: "0.01em",
                marginBottom: "var(--wd-3)",
              }}
            >
              Available now
            </p>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--wd-3)",
              }}
            >
              {available.map((role) => (
                <FlagshipRow key={role.roleId} role={role} />
              ))}
            </div>
          </section>

          {/* Demo roles */}
          <section>
            <p
              style={{
                fontSize: "var(--wd-text-xs)",
                fontWeight: "var(--wd-weight-medium)",
                color: "var(--wd-text-muted)",
                letterSpacing: "0.01em",
                marginBottom: "var(--wd-3)",
              }}
            >
              Demo
            </p>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                background: "var(--wd-surface)",
                border: "1px solid var(--wd-border)",
                borderRadius: "var(--wd-radius-lg)",
                overflow: "hidden",
              }}
            >
              {demo.map((role, index) => (
                <DemoRow key={role.roleId} role={role} isFirst={index === 0} />
              ))}
            </div>
          </section>

          {/* Planned roles */}
          <section>
            <p
              style={{
                fontSize: "var(--wd-text-xs)",
                fontWeight: "var(--wd-weight-medium)",
                color: "var(--wd-text-muted)",
                letterSpacing: "0.01em",
                marginBottom: "var(--wd-3)",
              }}
            >
              Planned
            </p>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                background: "var(--wd-surface)",
                border: "1px solid var(--wd-border)",
                borderRadius: "var(--wd-radius-lg)",
                overflow: "hidden",
              }}
            >
              {planned.map((role, index) => (
                <PlannedRow key={role.roleId} role={role} isFirst={index === 0} />
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function FlagshipRow({ role }: { role: RoleReleaseDefinition }) {
  return (
    <div
      style={{
        background: "var(--wd-surface)",
        border: "1px solid var(--wd-border)",
        borderRadius: "var(--wd-radius-lg)",
        padding: "var(--wd-5) var(--wd-6)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "var(--wd-6)",
      }}
    >
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: "var(--wd-2)",
        }}
      >
        <span
          style={{
            fontSize: "var(--wd-text-md)",
            fontWeight: "var(--wd-weight-strong)",
            color: "var(--wd-text)",
            lineHeight: "var(--wd-leading-tight)",
          }}
        >
          {role.releaseLabel}
        </span>
        <p
          style={{
            fontSize: "var(--wd-text-sm)",
            color: "var(--wd-text-secondary)",
            lineHeight: "var(--wd-leading-snug)",
            margin: 0,
          }}
        >
          {role.summary}
        </p>
        {role.primaryProcesses.length > 0 ? (
          <div
            style={{
              display: "flex",
              gap: "var(--wd-2)",
              flexWrap: "wrap",
              marginTop: "var(--wd-1)",
            }}
          >
            {role.primaryProcesses.map((process) => (
              <span
                key={process}
                style={{
                  fontSize: "var(--wd-text-xs)",
                  color: "var(--wd-text-muted)",
                  background: "var(--wd-surface-hover)",
                  borderRadius: "var(--wd-radius-sm)",
                  padding: "2px var(--wd-2)",
                  lineHeight: 1.4,
                }}
              >
                {process}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <Link
        href={`/workday/${role.roleId}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          height: 32,
          padding: "0 var(--wd-4)",
          borderRadius: "var(--wd-radius)",
          background: "var(--wd-accent)",
          color: "#ffffff",
          fontSize: "var(--wd-text-sm)",
          fontWeight: "var(--wd-weight-medium)",
          textDecoration: "none",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        Open workday
      </Link>
    </div>
  );
}

function DemoRow({ role, isFirst }: { role: RoleReleaseDefinition; isFirst: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--wd-4)",
        padding: "var(--wd-3) var(--wd-4)",
        borderTop: isFirst ? undefined : "1px solid var(--wd-border)",
      }}
    >
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <span
          style={{
            fontSize: "var(--wd-text-sm)",
            fontWeight: "var(--wd-weight-medium)",
            color: "var(--wd-text)",
          }}
        >
          {role.releaseLabel}
        </span>
        <span
          style={{
            fontSize: "var(--wd-text-xs)",
            color: "var(--wd-text-muted)",
          }}
        >
          {role.summary}
        </span>
      </div>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          height: 20,
          padding: "0 var(--wd-2)",
          borderRadius: "var(--wd-radius-sm)",
          background: "var(--wd-surface-hover)",
          color: "var(--wd-text-muted)",
          fontSize: "var(--wd-text-xs)",
          fontWeight: "var(--wd-weight-medium)",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        Demo
      </span>
      <Link
        href={`/workday/${role.roleId}`}
        style={{
          fontSize: "var(--wd-text-xs)",
          color: "var(--wd-text-muted)",
          textDecoration: "underline",
          textDecorationColor: "var(--wd-border-strong)",
          textUnderlineOffset: "2px",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        View demo
      </Link>
    </div>
  );
}

function PlannedRow({ role, isFirst }: { role: RoleReleaseDefinition; isFirst: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--wd-4)",
        padding: "var(--wd-3) var(--wd-4)",
        borderTop: isFirst ? undefined : "1px solid var(--wd-border)",
        opacity: 0.6,
      }}
    >
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <span
          style={{
            fontSize: "var(--wd-text-sm)",
            fontWeight: "var(--wd-weight-medium)",
            color: "var(--wd-text-muted)",
          }}
        >
          {role.releaseLabel}
        </span>
        <span
          style={{
            fontSize: "var(--wd-text-xs)",
            color: "var(--wd-text-muted)",
          }}
        >
          {role.summary}
        </span>
      </div>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          height: 20,
          padding: "0 var(--wd-2)",
          borderRadius: "var(--wd-radius-sm)",
          background: "var(--wd-surface-hover)",
          color: "var(--wd-text-muted)",
          fontSize: "var(--wd-text-xs)",
          fontWeight: "var(--wd-weight-medium)",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        Planned
      </span>
    </div>
  );
}
