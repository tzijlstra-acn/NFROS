/**
 * Role selector for V3.3.
 *
 * Light canvas, no navigation rail, no dark panels. This is the first screen
 * a user sees when they enter the interactive workday. The page is scoped
 * under `.workday-v3` so all V3 tokens resolve; it does not use the frame
 * layout because no role has been chosen yet.
 *
 * Two sources, and only two:
 *
 * - Role status, names and summaries come from the release registry. Which
 *   roles are Available, Demo or Planned is never decided here, and the
 *   selector states no product claim of its own.
 * - Each Available role carries one live professional signal, read from the
 *   database through `src/features/role-signals`: the current focus (the top
 *   Now item), the active process and its stage, and the next meeting with its
 *   time. A signal with no data says so in words; nothing is substituted.
 *
 * Demo roles stay labelled Demo and open their explanatory page. Planned
 * roles are listed without a link, because there is nothing to enter.
 *
 * Server component. No client-side state needed.
 */

import Link from "next/link";
import type { Language } from "@/i18n/labels";
import {
  PRODUCT_IDENTITY,
  ROLE_RELEASE_STATUS_LABELS,
  type RoleReleaseDefinition,
} from "@/product/release";
import {
  formatScenarioDate,
  signalRowLabels,
  type AvailableRoleView,
  type RoleSignalOverview,
  type SignalState,
} from "@/features/role-signals";

/*
 * Interface words only. The product name and the release status words
 * (Available, Demo, Planned) come from the release registry.
 */
const LABELS = {
  synthetic: { en: "Synthetic institution and data", de: "Synthetische Institution und Daten" },
  title: { en: "Choose your role", de: "Waehlen Sie Ihre Rolle" },
  scenario: { en: "Synthetic scenario, {date}, {moment}", de: "Synthetisches Szenario, {date}, {moment}" },
  scenarioUnavailable: {
    en: "Unavailable: the scenario has not been seeded",
    de: "Nicht verfuegbar: das Szenario wurde nicht geladen",
  },
  available: { en: "Available now", de: "Jetzt verfuegbar" },
  openWorkday: { en: "Open workday", de: "Arbeitstag oeffnen" },
  viewDemo: { en: "View demo", de: "Demo ansehen" },
  noneAvailable: {
    en: "No role is marked Available in the release registry.",
    de: "Im Release-Verzeichnis ist keine Rolle als verfuegbar markiert.",
  },
  refused: {
    en: "{role} is Planned. It is not part of this release, so it cannot be opened. Choose an available role below.",
    de: "{role} ist geplant. Die Rolle gehoert nicht zu diesem Release und kann nicht geoeffnet werden. Waehlen Sie unten eine verfuegbare Rolle.",
  },
} as const;

function pick(pair: { en: string; de: string }, language: Language): string {
  return language === "de" ? pair.de : pair.en;
}

const sectionLabelStyle: React.CSSProperties = {
  fontSize: "var(--wd-text-xs)",
  fontWeight: "var(--wd-weight-medium)",
  color: "var(--wd-text-muted)",
  letterSpacing: "0.01em",
  margin: "0 0 var(--wd-3)",
};

const listFrameStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  background: "var(--wd-surface)",
  border: "1px solid var(--wd-border)",
  borderRadius: "var(--wd-radius-lg)",
  overflow: "hidden",
};

export function RoleSelector({
  overview,
  refusedRole = null,
}: {
  overview: RoleSignalOverview;
  /** A Planned role the release gate refused, named by the redirect. */
  refusedRole?: RoleReleaseDefinition | null;
}) {
  const { language } = overview;
  const scenarioLine = overview.scenario
    ? pick(LABELS.scenario, language)
        .replace("{date}", formatScenarioDate(overview.scenario.date))
        .replace("{moment}", overview.scenario.moment)
    : pick(LABELS.scenarioUnavailable, language);

  return (
    <div
      className="workday-v3"
      lang={language}
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
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: "var(--wd-text-base)",
            fontWeight: "var(--wd-weight-strong)",
            letterSpacing: "0.02em",
            color: "var(--wd-text)",
            textDecoration: "none",
          }}
        >
          {/* The same square mark as the entry page, so the two read as one product. */}
          <span aria-hidden="true" style={{ width: 10, height: 10, background: "var(--wd-accent)" }} />
          {PRODUCT_IDENTITY.name}
        </Link>
        <span
          style={{
            fontSize: "var(--wd-text-xs)",
            color: "var(--wd-text-muted)",
          }}
        >
          {pick(LABELS.synthetic, language)}
        </span>
      </header>

      {/* Main content */}
      <main
        id="main"
        style={{
          flex: 1,
          padding: "var(--wd-6) var(--wd-6) var(--wd-8)",
        }}
      >
        <div
          style={{
            maxWidth: 1080,
            marginInline: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "var(--wd-6)",
          }}
        >
          {/* Page title and the clock the signals were read at */}
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "var(--wd-2) var(--wd-6)",
            }}
          >
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
              {pick(LABELS.title, language)}
            </h1>
            <span
              data-testid="selector-scenario"
              style={{
                fontSize: "var(--wd-text-xs)",
                color: "var(--wd-text-muted)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {scenarioLine}
            </span>
          </div>

          {/* Why a Planned role's link brought the reader here, when it did. */}
          {refusedRole ? (
            <p className="wd-notice" role="status" data-testid="role-refused-notice" style={{ margin: 0 }}>
              {pick(LABELS.refused, language).replace("{role}", refusedRole.releaseLabel)}
            </p>
          ) : null}

          {/* Available roles */}
          <section aria-labelledby="selector-available">
            <h2 id="selector-available" style={sectionLabelStyle}>
              {pick(LABELS.available, language)}
            </h2>
            {overview.available.length === 0 ? (
              <p style={{ fontSize: "var(--wd-text-sm)", color: "var(--wd-text-muted)", margin: 0 }}>
                {pick(LABELS.noneAvailable, language)}
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--wd-3)" }}>
                {overview.available.map((role) => (
                  <FlagshipRow key={role.release.roleId} role={role} language={language} />
                ))}
              </div>
            )}
          </section>

          {/* Demo and Planned side by side: both are short lists, and stacking
              them pushed the second below the fold at 1366x768. */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))",
              gap: "var(--wd-6)",
              alignItems: "start",
            }}
          >
            {overview.demo.length > 0 ? (
              <section aria-labelledby="selector-demo">
                <h2 id="selector-demo" style={sectionLabelStyle}>
                  {pick(ROLE_RELEASE_STATUS_LABELS.demo, language)}
                </h2>
                <div style={listFrameStyle}>
                  {overview.demo.map((role, index) => (
                    <DemoRow key={role.roleId} role={role} isFirst={index === 0} language={language} />
                  ))}
                </div>
              </section>
            ) : null}

            {overview.planned.length > 0 ? (
              <section aria-labelledby="selector-planned">
                <h2 id="selector-planned" style={sectionLabelStyle}>
                  {pick(ROLE_RELEASE_STATUS_LABELS.planned, language)}
                </h2>
                <div style={listFrameStyle}>
                  {overview.planned.map((role, index) => (
                    <PlannedRow key={role.roleId} role={role} isFirst={index === 0} language={language} />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}

function summaryOf(role: RoleReleaseDefinition, language: Language): string {
  return language === "de" && role.summaryDe.length > 0 ? role.summaryDe : role.summary;
}

function FlagshipRow({ role, language }: { role: AvailableRoleView; language: Language }) {
  const { release, signals } = role;
  const rows = signalRowLabels(language);
  const processDetail = [signals.process.stageName, signals.process.stageStatus]
    .filter(Boolean)
    .join(", ");

  return (
    <article
      aria-labelledby={`role-${release.roleId}`}
      data-testid={`flagship-${release.roleId}`}
      style={{
        background: "var(--wd-surface)",
        border: "1px solid var(--wd-border)",
        borderRadius: "var(--wd-radius-lg)",
        padding: "var(--wd-5) var(--wd-6)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--wd-4)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "var(--wd-6)",
        }}
      >
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--wd-1)" }}>
          <h3
            id={`role-${release.roleId}`}
            style={{
              fontSize: "var(--wd-text-md)",
              fontWeight: "var(--wd-weight-strong)",
              color: "var(--wd-text)",
              lineHeight: "var(--wd-leading-tight)",
              margin: 0,
            }}
          >
            {release.releaseLabel}
          </h3>
          <p
            style={{
              fontSize: "var(--wd-text-sm)",
              color: "var(--wd-text-secondary)",
              lineHeight: "var(--wd-leading-snug)",
              margin: 0,
            }}
          >
            {summaryOf(release, language)}
          </p>
        </div>
        <Link
          href={release.defaultRoute ?? `/workday/${release.roleId}`}
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
          {pick(LABELS.openWorkday, language)}
        </Link>
      </div>

      {/* The live signal, three facts read from the database */}
      <dl
        data-testid={`signals-${release.roleId}`}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "var(--wd-5)",
          margin: 0,
          paddingTop: "var(--wd-4)",
          borderTop: "1px solid var(--wd-border)",
        }}
      >
        <Signal label={rows.focus} state={signals.focus.state} testId="signal-focus">
          {signals.focus.value}
        </Signal>
        <Signal
          label={rows.process}
          state={signals.process.state}
          testId="signal-process"
          detail={processDetail.length > 0 ? processDetail : null}
        >
          {signals.process.value}
        </Signal>
        <Signal label={rows.meeting} state={signals.meeting.state} testId="signal-meeting">
          {signals.meeting.time !== null ? (
            <>
              <span
                style={{
                  fontFamily: "var(--wd-font-mono)",
                  fontVariantNumeric: "tabular-nums",
                  color: "var(--wd-text)",
                  marginRight: "var(--wd-2)",
                }}
              >
                {signals.meeting.time}
              </span>
              {signals.meeting.value}
            </>
          ) : (
            signals.meeting.value
          )}
        </Signal>
      </dl>
    </article>
  );
}

/** One labelled signal. Empty and Unavailable read muted, never as data. */
function Signal({
  label,
  state,
  testId,
  detail = null,
  children,
}: {
  label: string;
  state: SignalState;
  testId: string;
  detail?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div data-testid={testId} data-state={state} style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
      <dt
        style={{
          fontSize: "var(--wd-text-xs)",
          fontWeight: "var(--wd-weight-medium)",
          color: "var(--wd-text-muted)",
        }}
      >
        {label}
      </dt>
      <dd
        style={{
          margin: 0,
          fontSize: "var(--wd-text-sm)",
          lineHeight: "var(--wd-leading-snug)",
          color: state === "present" ? "var(--wd-text)" : "var(--wd-text-muted)",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {children}
      </dd>
      {detail !== null ? (
        <dd
          style={{
            margin: 0,
            fontSize: "var(--wd-text-xs)",
            color: "var(--wd-text-secondary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {detail}
        </dd>
      ) : null}
    </div>
  );
}

function DemoRow({
  role,
  isFirst,
  language,
}: {
  role: RoleReleaseDefinition;
  isFirst: boolean;
  language: Language;
}) {
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
          {summaryOf(role, language)}
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
        {pick(ROLE_RELEASE_STATUS_LABELS[role.status], language)}
      </span>
      <Link
        href={role.defaultRoute ?? `/workday/${role.roleId}`}
        aria-label={`${pick(LABELS.viewDemo, language)}: ${role.releaseLabel}`}
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
        {pick(LABELS.viewDemo, language)}
      </Link>
    </div>
  );
}

function PlannedRow({
  role,
  isFirst,
  language,
}: {
  role: RoleReleaseDefinition;
  isFirst: boolean;
  language: Language;
}) {
  return (
    <div
      data-testid={`planned-${role.roleId}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--wd-4)",
        padding: "var(--wd-3) var(--wd-4)",
        borderTop: isFirst ? undefined : "1px solid var(--wd-border)",
        /*
         * No opacity. Muted text at 60 percent opacity measured 2.59:1 and
         * failed WCAG AA; the row reads as not enterable from its muted text,
         * its Planned label and the absence of a link.
         */
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
          {summaryOf(role, language)}
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
        {pick(ROLE_RELEASE_STATUS_LABELS[role.status], language)}
      </span>
    </div>
  );
}
