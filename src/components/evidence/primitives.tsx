/**
 * Evidence and provenance primitives.
 *
 * These are the components that carry the product's central honesty claim, so
 * they are deliberately small and used everywhere rather than reimplemented.
 *
 * Every one of them attaches a non-colour cue alongside the colour, because a
 * reader who cannot distinguish amber from green must still be able to tell a
 * stakeholder statement from a verified fact.
 */

import type { ProvenanceKind } from "@/db/schema/core";
import { PROVENANCE_GLYPHS, PROVENANCE_LABELS, PRODUCT_COPY, t, type Language } from "@/i18n/labels";

export type Tone = "accent" | "cyan" | "green" | "amber" | "red" | "pink" | "neutral";

/* ==========================================================================
   Provenance
   ========================================================================== */

export function ProvenanceBadge({
  kind,
  language = "en",
  showLabel = true,
}: {
  kind: ProvenanceKind | string;
  language?: Language;
  showLabel?: boolean;
}) {
  const label = t(PROVENANCE_LABELS, kind, language);
  const glyph = PROVENANCE_GLYPHS[kind] ?? "?";
  return (
    <span className="provenance" data-kind={kind} title={label}>
      <span aria-hidden="true">{glyph}</span>
      {showLabel ? <span>{label}</span> : <span className="sr-only">{label}</span>}
    </span>
  );
}

/* ==========================================================================
   Confidence
   ========================================================================== */

function confidenceBand(value: number): "low" | "medium" | "high" {
  if (value < 0.5) return "low";
  if (value < 0.8) return "medium";
  return "high";
}

export function ConfidenceMeter({
  value,
  label = "Confidence",
}: {
  value: number | null;
  label?: string;
}) {
  if (value === null) {
    return (
      <span className="confidence">
        <span className="label">{label}</span>
        <span>not applicable</span>
      </span>
    );
  }
  const clamped = Math.max(0, Math.min(1, value));
  const band = confidenceBand(clamped);
  const percent = Math.round(clamped * 100);
  return (
    <span className="confidence">
      <span className="label">{label}</span>
      <span
        className="confidence-track"
        role="meter"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${percent} out of 100, ${band}`}
      >
        <span className="confidence-fill" data-band={band} style={{ width: `${percent}%` }} />
      </span>
      <span>
        {percent} / 100 <span className="muted">({band})</span>
      </span>
    </span>
  );
}

/* ==========================================================================
   Chips
   ========================================================================== */

const TONE_GLYPHS: Record<Tone, string> = {
  accent: "~",
  cyan: "+",
  green: "=",
  amber: "!",
  red: "x",
  pink: "*",
  neutral: "-",
};

export function Chip({
  tone = "neutral",
  children,
  glyph = true,
  title,
}: {
  tone?: Tone;
  children: React.ReactNode;
  glyph?: boolean;
  title?: string;
}) {
  return (
    <span className="chip" data-tone={tone} title={title}>
      {glyph ? (
        <span className="chip-glyph" aria-hidden="true">
          {TONE_GLYPHS[tone]}
        </span>
      ) : null}
      {children}
    </span>
  );
}

/** A monospace identifier. Used for every object reference in the interface. */
export function ObjectId({ id, label }: { id: string; label?: string }) {
  return (
    <span className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--text-4)" }}>
      {label ? `${label} ` : ""}
      {id}
    </span>
  );
}

/* ==========================================================================
   Mandatory disclosures
   ========================================================================== */

/** The permanent but discreet synthetic data label. */
export function SyntheticLabel({ language = "en" }: { language?: Language }) {
  return (
    <span className="synthetic-label">
      <span aria-hidden="true">&#9633;</span>
      {t(PRODUCT_COPY, "syntheticLabel", language)}
    </span>
  );
}

/**
 * The label that must accompany every regulatory reference in the product.
 *
 * It is a component rather than a string so that it cannot be forgotten on a
 * surface that happens to mention a regulation.
 */
export function RegulatoryNote({ language = "en" }: { language?: Language }) {
  return <span className="regulatory-note">{t(PRODUCT_COPY, "regulatoryNote", language)}</span>;
}

/* ==========================================================================
   Evidence citation
   ========================================================================== */

export interface EvidenceCitation {
  id: string;
  reference: string;
  title: string;
  sourceType: string;
  sourceSystem: string;
  documentDate: string;
  entityIds: string[];
  status: string;
  provenance: ProvenanceKind | string;
  isStale: boolean;
  excerpt?: string;
  confidence?: number | null;
}

/**
 * A clickable evidence reference.
 *
 * Every AI supported conclusion in the product links to one of these, and the
 * chip itself carries the source type and status so a reader can judge the
 * weight of the citation before opening it.
 */
export function EvidenceChip({
  citation,
  onOpenHref,
}: {
  citation: EvidenceCitation;
  onOpenHref?: string;
}) {
  const tone: Tone =
    citation.status === "requested" || citation.status === "missing"
      ? "red"
      : citation.isStale
        ? "amber"
        : "green";

  const body = (
    <>
      <span className="mono">{citation.id}</span>
      <span className="muted">{citation.sourceType}</span>
      {citation.isStale ? <span style={{ color: "var(--amber)" }}>stale</span> : null}
      {citation.status === "requested" || citation.status === "missing" ? (
        <span style={{ color: "var(--red)" }}>{citation.status}</span>
      ) : null}
    </>
  );

  if (onOpenHref) {
    return (
      <a className="chip" data-tone={tone} href={onOpenHref} title={citation.title}>
        <span className="chip-glyph" aria-hidden="true">
          {TONE_GLYPHS[tone]}
        </span>
        {body}
      </a>
    );
  }

  return (
    <span className="chip" data-tone={tone} title={citation.title}>
      <span className="chip-glyph" aria-hidden="true">
        {TONE_GLYPHS[tone]}
      </span>
      {body}
    </span>
  );
}

/** A list of evidence citations with a heading. */
export function EvidenceList({
  citations,
  heading,
  emptyMessage = "No evidence is cited here.",
  language = "en",
}: {
  citations: EvidenceCitation[];
  heading?: string;
  emptyMessage?: string;
  language?: Language;
}) {
  if (citations.length === 0) {
    return (
      <div className="stack stack-2">
        {heading ? <span className="label">{heading}</span> : null}
        <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <div className="stack stack-2">
      {heading ? (
        <span className="label">
          {heading} ({citations.length})
        </span>
      ) : null}
      <ul className="stack stack-2">
        {citations.map((citation) => (
          <li key={citation.id} className="card card-edge" data-tone={citation.isStale ? "amber" : "green"}>
            <div className="stack stack-2">
              <div className="row row-2 row-wrap row-between">
                <span className="strong-text" style={{ fontSize: "var(--text-sm)" }}>
                  {citation.title}
                </span>
                <ProvenanceBadge kind={citation.provenance} language={language} showLabel={false} />
              </div>
              <div className="row row-2 row-wrap meta">
                <span>{citation.id}</span>
                <span>&middot;</span>
                <span>{citation.sourceSystem}</span>
                <span>&middot;</span>
                <span>{citation.documentDate}</span>
                <span>&middot;</span>
                <span>{citation.status}</span>
              </div>
              {citation.excerpt ? (
                <blockquote
                  className="dim"
                  style={{
                    fontSize: "var(--text-sm)",
                    borderLeft: "2px solid var(--border-2)",
                    paddingLeft: "var(--space-3)",
                  }}
                >
                  {citation.excerpt}
                </blockquote>
              ) : null}
              {citation.isStale ? (
                <span className="chip" data-tone="amber">
                  Older than the policy freshness requirement
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ==========================================================================
   Uncertainty
   ========================================================================== */

export interface UncertaintyEntry {
  topic: string;
  description: string;
  kind: string;
  resolutionPath: string;
  materialToDecision: boolean;
  sourceIds?: string[];
}

/**
 * Stated uncertainty, always rendered before a decision rather than after it.
 *
 * Material uncertainties are separated from immaterial ones, because a list
 * that mixes them lets a reader skim past the one that should stop them.
 */
export function UncertaintyPanel({ items }: { items: UncertaintyEntry[] }) {
  if (items.length === 0) {
    return (
      <div className="empty-state">
        <span className="label">Uncertainty</span>
        <p>No open uncertainties were recorded against this work object.</p>
      </div>
    );
  }

  const material = items.filter((item) => item.materialToDecision);
  const other = items.filter((item) => !item.materialToDecision);

  return (
    <div className="stack stack-4">
      {material.length > 0 ? (
        <div className="stack stack-2">
          <span className="label" style={{ color: "var(--amber)" }}>
            Material to this decision ({material.length})
          </span>
          {material.map((item, index) => (
            <UncertaintyItemCard key={`${item.topic}-${index}`} item={item} tone="amber" />
          ))}
        </div>
      ) : null}
      {other.length > 0 ? (
        <div className="stack stack-2">
          <span className="label">Noted, not material ({other.length})</span>
          {other.map((item, index) => (
            <UncertaintyItemCard key={`${item.topic}-${index}`} item={item} tone="neutral" />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function UncertaintyItemCard({ item, tone }: { item: UncertaintyEntry; tone: Tone }) {
  return (
    <div className="card card-edge" data-tone={tone}>
      <div className="stack stack-2">
        <div className="row row-2 row-wrap row-between">
          <span className="strong-text" style={{ fontSize: "var(--text-sm)" }}>
            {item.topic}
          </span>
          <Chip tone={tone}>{item.kind.replace(/-/g, " ")}</Chip>
        </div>
        <p style={{ fontSize: "var(--text-sm)" }}>{item.description}</p>
        <div className="stack stack-1">
          <span className="label">What would resolve it</span>
          <p className="dim" style={{ fontSize: "var(--text-sm)" }}>
            {item.resolutionPath}
          </p>
        </div>
        {item.sourceIds && item.sourceIds.length > 0 ? (
          <div className="row row-2 row-wrap">
            {item.sourceIds.map((id) => (
              <span key={id} className="mono meta">
                {id}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ==========================================================================
   Contradiction
   ========================================================================== */

export interface ContradictionEntry {
  id: string;
  summary: string;
  firstClaim: { statement: string; provenance: string; sourceIds: string[] };
  secondClaim: { statement: string; provenance: string; sourceIds: string[] };
  significance: string;
  resolutionState: string;
  resolutionNote?: string;
  detectedAtMoment?: string;
}

/**
 * A detected contradiction, rendered so that both sides are visible.
 *
 * The product never resolves a contradiction on the user's behalf. It shows
 * the two claims, their provenance and why the difference matters, and leaves
 * the judgment where it belongs.
 */
export function ContradictionCard({
  contradiction,
  language = "en",
}: {
  contradiction: ContradictionEntry;
  language?: Language;
}) {
  const resolved = contradiction.resolutionState !== "unresolved";
  return (
    <div className="card card-edge" data-tone={resolved ? "cyan" : "red"}>
      <div className="stack stack-3">
        <div className="row row-2 row-wrap row-between">
          <span className="strong-text">{contradiction.summary}</span>
          <Chip tone={resolved ? "cyan" : "red"}>
            {resolved ? contradiction.resolutionState.replace(/-/g, " ") : "unresolved"}
          </Chip>
        </div>

        <div className="grid grid-2">
          <ClaimSide claim={contradiction.firstClaim} language={language} sideLabel="First claim" />
          <ClaimSide claim={contradiction.secondClaim} language={language} sideLabel="Second claim" />
        </div>

        <div className="stack stack-1">
          <span className="label">Why the difference matters</span>
          <p style={{ fontSize: "var(--text-sm)" }}>{contradiction.significance}</p>
        </div>

        {resolved && contradiction.resolutionNote ? (
          <div className="stack stack-1">
            <span className="label">How it resolved</span>
            <p className="dim" style={{ fontSize: "var(--text-sm)" }}>
              {contradiction.resolutionNote}
            </p>
          </div>
        ) : null}

        {contradiction.detectedAtMoment ? (
          <span className="meta">Detected at {contradiction.detectedAtMoment}</span>
        ) : null}
      </div>
    </div>
  );
}

function ClaimSide({
  claim,
  sideLabel,
  language,
}: {
  claim: { statement: string; provenance: string; sourceIds: string[] };
  sideLabel: string;
  language: Language;
}) {
  return (
    <div
      className="stack stack-2"
      style={{
        padding: "var(--space-3)",
        background: "var(--surface-0)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border-1)",
      }}
    >
      <div className="row row-2 row-between">
        <span className="label">{sideLabel}</span>
        <ProvenanceBadge kind={claim.provenance} language={language} showLabel={false} />
      </div>
      <p style={{ fontSize: "var(--text-sm)" }}>{claim.statement}</p>
      <div className="row row-2 row-wrap">
        {claim.sourceIds.map((id) => (
          <span key={id} className="mono meta">
            {id}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ==========================================================================
   Grounding
   ========================================================================== */

export interface GroundingSection {
  verifiedFacts: Array<{ statement: string; sourceIds: string[]; confidence: number | null }>;
  approvedRecords: Array<{ statement: string; sourceIds: string[]; confidence: number | null }>;
  stakeholderStatements: Array<{ statement: string; sourceIds: string[]; confidence: number | null }>;
  modelInference: Array<{ statement: string; sourceIds: string[]; confidence: number | null }>;
  conflictingEvidence: Array<{ statement: string; sourceIds: string[]; confidence: number | null }>;
}

const GROUNDING_ORDER: Array<{ key: keyof GroundingSection; kind: ProvenanceKind }> = [
  { key: "verifiedFacts", kind: "verified-fact" },
  { key: "approvedRecords", kind: "approved-record" },
  { key: "stakeholderStatements", kind: "stakeholder-statement" },
  { key: "conflictingEvidence", kind: "conflicting-evidence" },
  { key: "modelInference", kind: "model-inference" },
];

/**
 * Renders a grounding block with each category visually distinct.
 *
 * Model inference is rendered last and styled differently on purpose. A reader
 * skimming from the top encounters what is established before what is
 * reasoned, which is the order in which a risk professional wants it.
 */
export function GroundingBlock({
  grounding,
  language = "en",
}: {
  grounding: GroundingSection;
  language?: Language;
}) {
  const sections = GROUNDING_ORDER.filter(({ key }) => grounding[key].length > 0);

  if (sections.length === 0) {
    return (
      <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
        {t(PRODUCT_COPY, "noEvidence", language)}
      </p>
    );
  }

  return (
    <div className="stack stack-4">
      {sections.map(({ key, kind }) => (
        <div key={key} className="stack stack-2">
          <ProvenanceBadge kind={kind} language={language} />
          <ul className="stack stack-2">
            {grounding[key].map((statement, index) => (
              <li key={index} className="stack stack-1">
                <p style={{ fontSize: "var(--text-sm)" }}>{statement.statement}</p>
                <div className="row row-2 row-wrap">
                  {statement.sourceIds.length > 0 ? (
                    statement.sourceIds.map((id) => (
                      <span key={id} className="mono meta">
                        {id}
                      </span>
                    ))
                  ) : (
                    <span className="meta" style={{ color: "var(--amber)" }}>
                      no source cited
                    </span>
                  )}
                  {statement.confidence !== null ? (
                    <ConfidenceMeter value={statement.confidence} label="conf" />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
