/**
 * Workday V2 presentational primitives.
 *
 * Server safe: no hooks, no event handlers, no client directive. These render
 * in a server component, which matters because most of the interactive workday
 * is server rendered against the scenario database and only the genuinely
 * interactive parts cross into the browser.
 *
 * The set is deliberately small. A larger component library would invite the
 * problem the redesign exists to fix, which is that every piece of content
 * ends up inside a container. The default here is `Item`, a row. `Card` exists
 * but its use is restricted to the four cases listed in its own comment.
 */

import type { ReactNode } from "react";
import {
  IconAlertTriangle,
  IconArrowUpRight,
  IconCheck,
  IconCircle,
  IconCircleDot,
  IconInfoCircle,
  IconLock,
} from "@tabler/icons-react";
import type { AuthorityClass } from "@/db/schema/decisions";
import {
  CONNECTOR_MODE_LABELS,
  FRESHNESS_LABELS,
  pick,
  type SourceAttribution,
} from "@/workday/contracts";
import type { Language } from "@/i18n/labels";

export type Tone = "ai" | "info" | "success" | "warning" | "danger" | "neutral";

/* ==========================================================================
   Text
   ========================================================================== */

/**
 * Data text.
 *
 * Reserved for time, identifiers, indicator values, percentages, counts,
 * timestamps and audit references. Explanatory prose is never monospaced: the
 * old interactive layer set labels, metadata and controls in JetBrains Mono,
 * which made ordinary sentences read as output from a tool.
 */
export function Data({
  children,
  size = "xs",
  className = "",
  title,
}: {
  children: ReactNode;
  size?: "xs" | "sm";
  className?: string;
  title?: string;
}) {
  return (
    <span
      className={`${size === "sm" ? "app-data-md" : "app-data"} ${className}`.trim()}
      {...(title ? { title } : {})}
    >
      {children}
    </span>
  );
}

/** An object identifier, selectable so it can be copied into another system. */
export function ObjectRef({ id, label }: { id: string; label?: string }) {
  return (
    <span className="app-oid" {...(label ? { title: `${label}: ${id}` } : {})}>
      {id}
    </span>
  );
}

/** A section heading at 16px with an optional trailing control. */
export function SectionHead({
  title,
  count,
  trailing,
  id,
}: {
  title: string;
  count?: number;
  trailing?: ReactNode;
  id?: string;
}) {
  return (
    <div className="app-section-head">
      <h2 className="app-section-title" {...(id ? { id } : {})}>
        {title}
        {count !== undefined ? (
          <span className="app-muted" style={{ fontWeight: 400 }}>
            {" "}
            {count}
          </span>
        ) : null}
      </h2>
      {trailing ?? null}
    </div>
  );
}

/* ==========================================================================
   Chips
   ========================================================================== */

/**
 * A chip.
 *
 * Permitted for status, source type, severity, authority and count. Not for a
 * sentence: a chip containing a clause is a badge pretending to be prose, and
 * the previous layer had several.
 */
export function Chip({
  children,
  tone = "neutral",
  title,
  count = false,
}: {
  children: ReactNode;
  tone?: Tone;
  title?: string;
  count?: boolean;
}) {
  return (
    <span
      className={`app-chip${count ? " app-chip-count" : ""}`}
      {...(tone !== "neutral" ? { "data-tone": tone } : {})}
      {...(title ? { title } : {})}
    >
      {children}
    </span>
  );
}

/**
 * A state dot with an accessible name.
 *
 * Colour is never the only signal: the dot always carries a label, either
 * visibly beside it or through the screen reader text it renders.
 */
export function Dot({
  tone = "neutral",
  live = false,
  label,
}: {
  tone?: Tone;
  live?: boolean;
  label: string;
}) {
  return (
    <>
      <span className="app-dot" data-tone={tone} data-live={live} aria-hidden="true" />
      <span className="app-sr-only">{label}</span>
    </>
  );
}

/**
 * The authority class of an action.
 *
 * Shown wherever an action is proposed, because the difference between a
 * change the product may make within policy and one that requires a named
 * person to approve it is the most important distinction in the product.
 */
const AUTHORITY_TONE: Record<AuthorityClass, Tone> = {
  READ: "neutral",
  DRAFT: "neutral",
  PROPOSE: "info",
  APPROVAL_REQUIRED: "warning",
  POLICY_BOUND_AUTONOMOUS: "ai",
  PROHIBITED: "danger",
};

const AUTHORITY_LABEL: Record<AuthorityClass, { en: string; de: string }> = {
  READ: { en: "Read", de: "Lesen" },
  DRAFT: { en: "Draft", de: "Entwurf" },
  PROPOSE: { en: "Proposal", de: "Vorschlag" },
  APPROVAL_REQUIRED: { en: "Approval required", de: "Genehmigung erforderlich" },
  POLICY_BOUND_AUTONOMOUS: { en: "Within policy", de: "Innerhalb der Richtlinie" },
  PROHIBITED: { en: "Not permitted", de: "Nicht zulaessig" },
};

export function AuthorityChip({
  authorityClass,
  language,
}: {
  authorityClass: AuthorityClass;
  language: Language;
}) {
  return (
    <Chip tone={AUTHORITY_TONE[authorityClass]} title={authorityClass}>
      {authorityClass === "APPROVAL_REQUIRED" ? (
        <IconLock size={11} stroke={2} aria-hidden="true" />
      ) : null}
      {pick(AUTHORITY_LABEL[authorityClass], language)}
    </Chip>
  );
}

/* ==========================================================================
   Rows
   ========================================================================== */

/**
 * A list row: the default way to present anything repeating.
 *
 * Tasks, signals, activity, evidence, messages, timeline events and reviewed
 * suggestions are all rows. The row carries its own interactive and selected
 * state through data attributes so the styling stays in CSS and the component
 * stays server renderable.
 */
export function Item({
  leading,
  title,
  subtitle,
  trailing,
  selected = false,
  changed = false,
  large = false,
  href,
  children,
}: {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  selected?: boolean;
  changed?: boolean;
  large?: boolean;
  href?: string;
  children?: ReactNode;
}) {
  const inner = (
    <>
      {leading ? <span className="app-shrink-0">{leading}</span> : null}
      <span className="app-item-main">
        <span className="app-item-title">{title}</span>
        {subtitle ? <span className="app-item-sub">{subtitle}</span> : null}
        {children}
      </span>
      {trailing ? <span className="app-item-trail">{trailing}</span> : null}
    </>
  );

  const className = `app-item${large ? " app-item-lg" : ""}`;
  const attrs = {
    "data-selected": selected || undefined,
    "data-changed": changed || undefined,
    "data-interactive": href ? true : undefined,
  } as const;

  if (href) {
    return (
      <a href={href} className={className} {...attrs}>
        {inner}
      </a>
    );
  }

  return (
    <div className={className} {...attrs}>
      {inner}
    </div>
  );
}

/** A list of rows, separated by hairlines rather than bordered individually. */
export function List({
  children,
  label,
  busy = false,
}: {
  children: ReactNode;
  label?: string;
  busy?: boolean;
}) {
  return (
    <div
      className="app-list"
      {...(label ? { role: "list", "aria-label": label } : {})}
      {...(busy ? { "aria-busy": true } : {})}
    >
      {children}
    </div>
  );
}

/* ==========================================================================
   Cards
   ========================================================================== */

/**
 * A card.
 *
 * Permitted for exactly four things: a primary decision, a new AI suggestion,
 * an execution receipt and a critical event. A fifth case needs a reason
 * written down, because the failure mode this redesign corrects is that
 * everything was in a panel and therefore nothing stood out.
 */
export function Card({
  children,
  accent,
  raised = false,
  label,
  head,
}: {
  children: ReactNode;
  accent?: Tone;
  raised?: boolean;
  label?: string;
  head?: ReactNode;
}) {
  return (
    <section
      className={`app-card${raised ? " app-card-raised" : ""}`}
      {...(accent && accent !== "neutral" ? { "data-accent": accent } : {})}
      {...(label ? { "aria-label": label } : {})}
    >
      {head ? <div className="app-card-head">{head}</div> : null}
      {children}
    </section>
  );
}

/* ==========================================================================
   Notices
   ========================================================================== */

export function Notice({
  children,
  tone = "neutral",
  icon = true,
}: {
  children: ReactNode;
  tone?: Tone;
  icon?: boolean;
}) {
  const Glyph =
    tone === "danger" || tone === "warning" ? IconAlertTriangle : IconInfoCircle;
  return (
    <div className="app-notice" {...(tone !== "neutral" ? { "data-tone": tone } : {})}>
      {icon ? (
        <Glyph size={13} stroke={2} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
      ) : null}
      <span>{children}</span>
    </div>
  );
}

/**
 * The regulatory disclosure.
 *
 * Attached to every regulatory reference in the product. The wording is fixed
 * and is not a parameter, because the whole point is that it cannot drift from
 * screen to screen.
 */
export function RegulatoryNote({ language }: { language: Language }) {
  return (
    <span className="app-regulatory-note">
      {language === "de"
        ? "Illustrativer regulatorischer Kontext, keine Rechtsberatung."
        : "Illustrative regulatory context, not legal advice."}
    </span>
  );
}

/** The permanent synthetic data disclosure. */
export function SyntheticDisclosure({ language }: { language: Language }) {
  return (
    <span className="app-synthetic">
      {language === "de" ? "Synthetische Institution und Daten" : "Synthetic institution and data"}
    </span>
  );
}

/* ==========================================================================
   Source attribution
   ========================================================================== */

/**
 * The quiet source row under a work object.
 *
 * Shows which systems the data came from, how fresh each one is, whether any
 * two of them disagree, and a deep link where the connector supports one. It
 * never shows an endpoint carrying a token, a credential or a raw payload:
 * there is nothing in this component that could leak one, because the view
 * model it receives does not carry any.
 */
export function SourceRow({
  sources,
  language,
  showNecessity = false,
}: {
  sources: SourceAttribution[];
  language: Language;
  showNecessity?: boolean;
}) {
  if (sources.length === 0) return null;

  return (
    <div className="app-sources">
      <span className="app-faint">{language === "de" ? "Quellen" : "Sources"}</span>
      {sources.map((source) => {
        const loading = source.loadState === "loading" || source.loadState === "connecting";
        const body = (
          <>
            <Dot
              tone={
                source.conflicted
                  ? "danger"
                  : source.freshness === "stale"
                    ? "warning"
                    : loading
                      ? "info"
                      : "success"
              }
              live={loading}
              label={
                source.conflicted
                  ? language === "de"
                    ? "Widerspruch zwischen Quellen"
                    : "Sources disagree"
                  : pick(FRESHNESS_LABELS[source.freshness], language)
              }
            />
            <span>{source.sourceSystem}</span>
            {source.recordCount > 0 ? <Data>{source.recordCount}</Data> : null}
            {source.mode !== "live" ? (
              <span className="app-faint">
                {pick(CONNECTOR_MODE_LABELS[source.mode], language)}
              </span>
            ) : null}
            {showNecessity && source.necessity === "required" ? (
              <span className="app-faint">{language === "de" ? "erforderlich" : "required"}</span>
            ) : null}
            {source.deepLink ? <IconArrowUpRight size={11} stroke={2} aria-hidden="true" /> : null}
          </>
        );

        const attrs = {
          className: "app-source",
          "data-freshness": source.freshness,
          "data-conflicted": source.conflicted || undefined,
          "data-loading": loading || undefined,
          title: source.lastUpdated
            ? `${source.sourceSystem}. ${language === "de" ? "Letzte Aktualisierung" : "Last updated"} ${source.lastUpdated}.`
            : source.sourceSystem,
        } as const;

        return source.deepLink ? (
          <a
            key={source.connectorInstanceId}
            {...attrs}
            className="app-source app-source-link"
            href={source.deepLink}
            target="_blank"
            rel="noreferrer"
          >
            {body}
          </a>
        ) : (
          <span key={source.connectorInstanceId} {...attrs}>
            {body}
          </span>
        );
      })}
    </div>
  );
}

/* ==========================================================================
   Loading
   ========================================================================== */

/** A skeleton block that reserves the dimensions of real content. */
export function Skeleton({
  width = "100%",
  height = 12,
  radius,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number;
}) {
  return (
    <span
      className="app-skeleton"
      aria-hidden="true"
      style={{
        display: "block",
        width,
        height,
        ...(radius === undefined ? {} : { borderRadius: radius }),
      }}
    />
  );
}

/**
 * Skeleton rows for a list.
 *
 * Hidden from assistive technology, because announcing six empty rows is
 * noise. The readiness of the region is communicated through `aria-busy` on
 * the container and a text status elsewhere.
 */
export function SkeletonRows({ rows = 4, large = false }: { rows?: number; large?: boolean }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="app-skeleton-row"
          style={{ minHeight: large ? 48 : undefined }}
        >
          <Skeleton width={16} height={16} radius={4} />
          <div className="app-stack-1 app-grow">
            <Skeleton width={`${74 - index * 7}%`} height={11} />
            <Skeleton width={`${46 - index * 4}%`} height={9} />
          </div>
          <Skeleton width={38} height={16} radius={4} />
        </div>
      ))}
    </div>
  );
}

/**
 * The stage list shown while the partner is working.
 *
 * Three glyph states: completed, running and pending. The running stage is
 * the only one that is tinted, so the eye lands on the current step.
 */
export function StageList({
  stages,
  activeIndex,
  label,
}: {
  stages: string[];
  activeIndex: number;
  label?: string;
}) {
  return (
    <ul className="app-stages" {...(label ? { "aria-label": label } : {})}>
      {stages.map((stage, index) => {
        const state = index < activeIndex ? "done" : index === activeIndex ? "active" : "pending";
        return (
          <li key={stage} className="app-stage" data-state={state}>
            <span className="app-stage-glyph" aria-hidden="true">
              {state === "done" ? (
                <IconCheck size={12} stroke={2.4} />
              ) : state === "active" ? (
                <IconCircleDot size={12} stroke={2.2} />
              ) : (
                <IconCircle size={11} stroke={1.8} />
              )}
            </span>
            <span>{stage}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** An empty state. Short, and it says what would make it non-empty. */
export function Empty({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="app-empty">
      <span className="app-strong" style={{ fontSize: "var(--app-text-sm)" }}>
        {title}
      </span>
      {detail ? <span>{detail}</span> : null}
    </div>
  );
}
