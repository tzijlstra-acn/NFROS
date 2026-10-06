/**
 * Presentational pieces the Work Hub panes and the drawer share.
 *
 * Hook free and directive free, so they render the same inside a server
 * component (the detail pane) and inside a client component (the drawer).
 * Every one renders what it is given and nothing else: no fallback rows, no
 * placeholder entries. An empty list renders the empty sentence it is passed.
 */

import type { ReactNode } from "react";
import type {
  ActivityEntry,
  AuditRef,
  DetailFact,
  EvidenceRef,
  WorkChip,
} from "@/features/work/model";

export function Chip({ chip }: { chip: WorkChip }) {
  return (
    <span className="wd-chip" data-tone={chip.tone} title={chip.title}>
      {chip.label}
    </span>
  );
}

export function Section({
  label,
  count,
  children,
  id,
}: {
  label: string;
  count?: number;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section className="wd-work-section" aria-label={label} id={id}>
      <h3 className="wd-work-section-label">
        {label}
        {count !== undefined ? <span className="wd-disclosure-count">{count}</span> : null}
      </h3>
      {children}
    </section>
  );
}

export function Facts({ facts }: { facts: readonly DetailFact[] }) {
  if (facts.length === 0) return null;
  return (
    <dl className="wd-work-facts">
      {facts.map((fact) => (
        <FactRow key={fact.label} fact={fact} />
      ))}
    </dl>
  );
}

function FactRow({ fact }: { fact: DetailFact }) {
  return (
    <>
      <dt>{fact.label}</dt>
      <dd data-tone={fact.tone} className={fact.mono ? "wd-mono" : undefined}>
        {fact.value}
      </dd>
    </>
  );
}

export function EvidenceList({ evidence, empty }: { evidence: readonly EvidenceRef[]; empty: string }) {
  if (evidence.length === 0) return <p className="wd-work-text">{empty}</p>;
  return (
    <ul className="wd-work-list">
      {evidence.map((doc) => (
        <li key={doc.id}>
          <span className="wd-oid">{doc.id}</span>
          <span className="wd-work-list-main">
            {doc.title}
            <span className="wd-meta"> {doc.relation}</span>
          </span>
          <span className="wd-chip" data-tone={doc.statusTone}>
            {doc.status}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ActivityList({ entries, empty }: { entries: readonly ActivityEntry[]; empty: string }) {
  if (entries.length === 0) return <p className="wd-work-text">{empty}</p>;
  return (
    <ol className="wd-work-list" data-testid="work-history">
      {entries.map((entry) => (
        <li key={entry.id} data-entry-id={entry.id}>
          <span className="wd-chip" data-tone={entry.tone}>
            {entry.label}
          </span>
          <span className="wd-work-list-main">
            {entry.text}
            {entry.evidenceIds.length > 0 ? (
              <span className="wd-meta"> {entry.evidenceIds.join(", ")}</span>
            ) : null}
          </span>
          <span className="wd-meta">
            {entry.actor}
            {entry.at ? `, ${entry.at}` : ""}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function AuditList({
  audit,
  empty,
  blockedLabel,
}: {
  audit: readonly AuditRef[];
  empty: string;
  blockedLabel: string;
}) {
  if (audit.length === 0) return <p className="wd-work-text">{empty}</p>;
  return (
    <ul className="wd-work-list">
      {audit.map((entry) => (
        <li key={entry.id}>
          <span className="wd-mono wd-muted">{entry.at}</span>
          <span className="wd-work-list-main">{entry.summary}</span>
          {/* A refusal by the gate is listed, because it is evidence the control works. */}
          {entry.blocked ? (
            <span className="wd-chip" data-tone="danger">
              {blockedLabel}
            </span>
          ) : null}
          <span className="wd-meta">{entry.actor}</span>
        </li>
      ))}
    </ul>
  );
}
