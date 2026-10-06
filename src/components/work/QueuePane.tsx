/**
 * The left pane: saved views, filters, any proposals, and the queue.
 *
 * Renders a `ModuleQueueView` and knows nothing about which module built it.
 * Every row is a link that selects the item and keeps the rest of the query,
 * so a reader can select, change view and come back without losing anything.
 */

import Link from "next/link";
import { IconSparkles } from "@tabler/icons-react";
import type { Language } from "@/i18n/labels";
import { COPY, fill, say } from "@/features/work/copy";
import type { ModuleQueueView, ProposalView, QueueRowView } from "@/features/work/model";
import { Chip } from "./primitives";

export function QueuePane({ queue, language }: { queue: ModuleQueueView; language: Language }) {
  return (
    <div className="wd-work-pane" data-testid="work-queue" data-tab={queue.tab}>
      {queue.savedViews.length > 0 ? (
        <nav className="wd-work-views" aria-label={say(COPY.savedViews, language)}>
          {queue.savedViews.map((view) => (
            <Link
              key={view.id}
              href={view.href}
              className="wd-work-pill"
              aria-current={view.active ? "true" : undefined}
              data-view={view.id}
            >
              {view.label}
              {view.count !== null ? <span className="wd-disclosure-count">{view.count}</span> : null}
            </Link>
          ))}
        </nav>
      ) : null}

      {queue.filters.length > 0 ? (
        <nav className="wd-work-filters" aria-label={say(COPY.filters, language)}>
          {queue.filters.map((filter) => (
            <Link
              key={filter.id}
              href={filter.href}
              className="wd-work-filter"
              aria-current={filter.active ? "true" : undefined}
            >
              {filter.label}
              <span className="wd-disclosure-count">{filter.count}</span>
            </Link>
          ))}
        </nav>
      ) : null}

      {queue.objectFilter ? (
        <p className="wd-notice" data-tone="info" style={{ marginBottom: "var(--wd-2)" }}>
          <span className="wd-grow">
            {fill(say(COPY.objectFilter, language), {
              object:
                queue.objectFilter.label === queue.objectFilter.id
                  ? queue.objectFilter.id
                  : `${queue.objectFilter.id} ${queue.objectFilter.label}`,
            })}
          </span>
          <Link className="wd-work-link" href={queue.objectFilter.clearHref}>
            {say(COPY.clearFilter, language)}
          </Link>
        </p>
      ) : null}

      <p className="wd-work-summary">{queue.summary}</p>

      {queue.empty ? (
        <div className="wd-queue">
          <div className="wd-empty" data-testid="work-empty">
            <span className="wd-empty-title">{queue.empty.title}</span>
            <span>{queue.empty.body}</span>
          </div>
        </div>
      ) : (
        queue.groups.map((group) => (
          <section key={group.id} className="wd-work-group" aria-label={group.label}>
            <h2 className="wd-work-group-label">{group.label}</h2>
            <div className="wd-queue">
              {group.rows.map((row) => (
                <Row key={row.id} row={row} />
              ))}
              {group.rows.length === 0 && group.emptyText ? (
                <div className="wd-work-group-empty">{group.emptyText}</div>
              ) : null}
              {(group.notes ?? []).map((note) =>
                note.href ? (
                  <Link key={note.id} href={note.href} className="wd-work-note" data-tone={note.tone}>
                    {note.text}
                  </Link>
                ) : (
                  <span key={note.id} className="wd-work-note" data-tone={note.tone}>
                    {note.text}
                  </span>
                ),
              )}
            </div>
          </section>
        ))
      )}

      {/*
        * Proposals sit under the queue, not above it. The queue is the work;
        * a proposal is the AI's suggestion about it, and quiet by default
        * means it does not push the first row below the fold at 1366x768.
        */}
      {queue.proposals.length > 0 ? (
        <div className="wd-work-proposals" style={{ marginTop: "var(--wd-3)" }}>
          {queue.proposals.map((proposal) => (
            <Proposal key={proposal.id} proposal={proposal} language={language} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Row({ row }: { row: QueueRowView }) {
  return (
    <Link
      href={row.href}
      className="wd-work-row"
      data-selected={row.selected ? "true" : undefined}
      data-flag={row.flag ?? undefined}
      data-item-id={row.id}
      aria-current={row.selected ? "true" : undefined}
      scroll={false}
    >
      <span className="wd-work-row-lead">{row.lead}</span>
      <span className="wd-work-row-title" title={row.title}>
        {row.title}
      </span>
      <span className="wd-work-row-trailing" data-tone={row.trailingTone}>
        {row.trailing}
      </span>
      <span className="wd-work-row-meta">
        {row.sub ? <span className="wd-work-row-sub">{row.sub}</span> : null}
        {row.chips.map((chip, index) => (
          <Chip key={`${chip.label}-${index}`} chip={chip} />
        ))}
      </span>
    </Link>
  );
}

function Proposal({ proposal, language }: { proposal: ProposalView; language: Language }) {
  return (
    <div className="wd-work-proposal" data-testid="agenda-proposal" data-proposal-id={proposal.id}>
      <div className="wd-work-proposal-head">
        <span className="wd-work-proposal-label">
          <IconSparkles size={13} stroke={1.8} aria-hidden="true" />
          {say(COPY.aiProposal, language)}
          {proposal.authorityLabel ? <span className="wd-chip">{proposal.authorityLabel}</span> : null}
        </span>
        {proposal.href && proposal.available ? (
          <Link className="wd-btn wd-btn-secondary wd-btn-sm" href={proposal.href}>
            {proposal.hrefLabel}
          </Link>
        ) : (
          <span className="wd-chip" title={proposal.unavailableReason}>
            {proposal.hrefLabel}
          </span>
        )}
      </div>
      <span className="wd-strong">{proposal.title}</span>
      <p>
        {proposal.body}{" "}
        <span className="wd-strong">{say(COPY.personDecides, language)}: </span>
        {proposal.decide} {proposal.available ? say(COPY.proposalOnly, language) : proposal.unavailableReason}
      </p>
    </div>
  );
}
