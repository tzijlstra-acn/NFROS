/**
 * Page chrome for the four accountability surfaces.
 *
 * The control room, the trust page, the value model and the roadmap are read
 * by people who are not driving the demonstration: a Chief Risk Officer, a
 * Chief Operating Officer, internal audit, a model risk reviewer. They arrive
 * by link, they read in one pass, and they need to know at a glance what they
 * are looking at, that it is synthetic, and how to get to the adjacent view.
 *
 * The shell is therefore deliberately plain: a header that states the surface,
 * a navigation row, the synthetic label on every page without exception, and a
 * footer that repeats where the reader can go next.
 */

import Link from "next/link";
import { SyntheticLabel } from "@/components/evidence/primitives";
import { PRODUCT_COPY, t, type Language } from "@/i18n/labels";

export interface ReportShellProps {
  /** Short surface name, for example "Control room". */
  title: string;
  /** One sentence stating what this surface answers. */
  lede: string;
  /** Which navigation entry is current. */
  active: "control-room" | "trust" | "value" | "roadmap";
  language?: Language;
  /** Status chips rendered next to the title. */
  status?: React.ReactNode;
  children: React.ReactNode;
}

const NAV: Array<{ key: string; href: string; label: string }> = [
  { key: "entry", href: "/", label: "Entry" },
  { key: "story", href: "/story", label: "Presentation" },
  { key: "workday", href: "/workday", label: "Workday" },
  { key: "control-room", href: "/control-room", label: "Control room" },
  { key: "trust", href: "/trust", label: "Trust" },
  { key: "value", href: "/value", label: "Value" },
  { key: "roadmap", href: "/roadmap", label: "Roadmap" },
];

export function ReportShell({
  title,
  lede,
  active,
  language = "en",
  status,
  children,
}: ReportShellProps) {
  return (
    <main
      id="main"
      style={{
        maxWidth: 1480,
        margin: "0 auto",
        padding: "var(--space-6) var(--space-8) var(--space-12)",
      }}
    >
      <header className="stack stack-4" style={{ paddingBottom: "var(--space-6)" }}>
        <div className="row row-between row-wrap row-4">
          <div className="row row-3 row-wrap">
            <Link href="/" style={{ textDecoration: "none" }}>
              <span
                className="display strong-text"
                style={{ fontSize: "var(--text-md)", fontWeight: 600 }}
              >
                {t(PRODUCT_COPY, "productName", language)}
              </span>
            </Link>
            <span className="meta">{title}</span>
          </div>
          <SyntheticLabel language={language} />
        </div>

        <nav className="row row-3 row-wrap" aria-label="Product surfaces">
          {NAV.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="chip"
              data-tone={item.key === active ? "accent" : "neutral"}
              aria-current={item.key === active ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <hr className="divider" />

        <div className="row row-between row-wrap row-4" style={{ alignItems: "flex-start" }}>
          <div className="stack stack-2">
            <h1 className="display" style={{ fontSize: "var(--text-xl)" }}>
              {title}
            </h1>
            <p className="lede" style={{ fontSize: "var(--text-base)" }}>
              {lede}
            </p>
          </div>
          {status ? <div className="row row-2 row-wrap shrink-0">{status}</div> : null}
        </div>
      </header>

      <div className="stack stack-6">{children}</div>

      <footer
        className="row row-between row-wrap row-4"
        style={{ paddingTop: "var(--space-10)", marginTop: "var(--space-8)", borderTop: "1px solid var(--border-1)" }}
      >
        <nav className="row row-4 row-wrap" aria-label="Product surfaces">
          {NAV.map((item) => (
            <Link key={item.key} href={item.href} className="meta">
              {item.label}
            </Link>
          ))}
        </nav>
        <SyntheticLabel language={language} />
      </footer>
    </main>
  );
}

/**
 * A titled section inside a report page.
 *
 * `answer` exists because the trust page is structured as answers to
 * questions, and an answer that is separated from its question by three
 * paragraphs of context stops being an answer.
 */
export function ReportSection({
  title,
  question,
  answer,
  children,
  tone,
}: {
  title: string;
  /** The question this section answers, rendered as the heading eyebrow. */
  question?: string;
  /** The direct answer, rendered before any supporting detail. */
  answer?: React.ReactNode;
  children?: React.ReactNode;
  tone?: "accent" | "cyan" | "green" | "amber" | "red" | "neutral";
}) {
  return (
    <section className="panel" id={slug(title)}>
      <div className="panel-head">
        <div className="stack stack-1">
          {question ? <span className="label">{question}</span> : null}
          <span className="panel-title">{title}</span>
        </div>
      </div>
      <div className="panel-body stack stack-4">
        {answer ? (
          <div className="card card-edge" data-tone={tone ?? "cyan"}>
            <div className="stack stack-2">
              <span className="label">Answer</span>
              <div style={{ fontSize: "var(--text-base)", color: "var(--text-1)" }}>{answer}</div>
            </div>
          </div>
        ) : null}
        {children}
      </div>
    </section>
  );
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** A compact label and value row, used for dense configuration listings. */
export function KeyValue({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="row row-3 row-between row-wrap" style={{ alignItems: "flex-start" }}>
      <span className="label" style={{ paddingTop: 2 }}>
        {label}
      </span>
      <span className="row row-2 row-wrap" style={{ justifyContent: "flex-end" }}>
        {children}
      </span>
    </div>
  );
}

/**
 * The notice shown when the database carries no scenario.
 *
 * `NotSeeded` replaces the whole screen, which is right for the workday but
 * wrong here: parts of these pages (the authority matrix, the resolved model
 * configuration, the roadmap) are defined in code and remain true with an
 * empty database. This notice therefore sits inside the page and states
 * exactly which sections are unavailable, rather than hiding everything.
 */
export function SeedNotice({ unavailable }: { unavailable: string }) {
  return (
    <section className="panel" style={{ borderColor: "var(--amber-edge)", background: "var(--amber-tint)" }}>
      <div className="panel-head">
        <span className="panel-title">The scenario has not been seeded</span>
        <span className="chip" data-tone="amber">
          data sections unavailable
        </span>
      </div>
      <div className="panel-body stack stack-3">
        <p style={{ fontSize: "var(--text-sm)", maxWidth: "88ch" }}>
          No scenario run was found in the local database, so nothing on this page can be counted
          from real rows. {unavailable} Nothing is substituted, estimated or invented in place of
          the missing data. Run the two commands below and reload this page.
        </p>
        <pre
          className="mono"
          style={{
            background: "var(--surface-0)",
            border: "1px solid var(--border-1)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-4)",
            fontSize: "var(--text-sm)",
          }}
        >
          {"npm run db:migrate\nnpm run db:seed"}
        </pre>
        <Link href="/" className="btn" style={{ alignSelf: "flex-start" }}>
          Back to the entry screen
        </Link>
      </div>
    </section>
  );
}

/** An explanatory note that is not a figure. Used for honest caveats. */
export function Caveat({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="dim"
      style={{
        fontSize: "var(--text-sm)",
        borderLeft: "2px solid var(--border-2)",
        paddingLeft: "var(--space-3)",
        maxWidth: "92ch",
      }}
    >
      {children}
    </p>
  );
}
