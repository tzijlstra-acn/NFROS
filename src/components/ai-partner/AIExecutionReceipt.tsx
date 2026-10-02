"use client";

/**
 * The execution receipt.
 *
 * One line per change, and the line says where the change landed. This is the
 * component that has to resist the most tempting shortcut in the product:
 * rendering every line the same confident way once an approval has been
 * given. A queued command and an acknowledged write look alike in the data
 * model and could not look more different in consequence, because a queued
 * line means the external platform still knows nothing about it.
 *
 * So the status is never only a tone. Every line not acknowledged by its
 * target system carries a sentence saying so, the group carries a notice when
 * any line is outstanding, and the external reference is shown rather than
 * summarised, so the user can check the claim in the other system.
 */

import { IconArrowUpRight, IconFileSearch } from "@tabler/icons-react";
import {
  RECEIPT_STATUS_LABELS,
  pick,
  type ExecutionReceiptLineView,
} from "@/workday/contracts";
import type { Language } from "@/i18n/labels";
import { Card, Chip, Data, Item, List, Notice, SectionHead } from "@/components/workday-v2/primitives";
import { RECEIPT_OUTSTANDING_NOTE_KEYS, partnerLabel } from "./labels";

/** Statuses where the target system has not confirmed the change. */
const OUTSTANDING: Array<ExecutionReceiptLineView["status"]> = [
  "queued",
  "failed",
  "dead-letter",
  "partial",
];

export function isOutstandingReceiptLine(line: ExecutionReceiptLineView): boolean {
  return OUTSTANDING.includes(line.status);
}

/**
 * The plain sentence for a line the target system has not confirmed.
 *
 * `statusDetail` from the server wins when it is present, because it can name
 * the specific reason. The dictionary sentence is the floor, so a line is
 * never left with only a chip to explain itself.
 */
function outstandingSentence(line: ExecutionReceiptLineView, language: Language): string {
  if (line.statusDetail.trim().length > 0) return line.statusDetail;
  const key = RECEIPT_OUTSTANDING_NOTE_KEYS[line.status];
  return key ? partnerLabel(key, language) : "";
}

export interface AIExecutionReceiptProps {
  lines: ExecutionReceiptLineView[];
  language: Language;
  /** Opens the audit entry in place. Without it the reference is shown as text. */
  onOpenAudit?: (auditEventId: string) => void;
  /**
   * "card" for the standalone receipt in the dock, "plain" when the receipt
   * is already inside a typed chat part that provides its own container.
   */
  variant?: "card" | "plain";
  title?: string;
}

export function AIExecutionReceipt({
  lines,
  language,
  onOpenAudit,
  variant = "card",
  title,
}: AIExecutionReceiptProps) {
  if (lines.length === 0) {
    return variant === "plain" ? (
      <span className="app-meta">{partnerLabel("receiptEmpty", language)}</span>
    ) : null;
  }

  const ordered = [...lines].sort((a, b) => a.sequence - b.sequence);
  const outstanding = ordered.filter(isOutstandingReceiptLine).length;

  const body = (
    <>
      {outstanding > 0 ? (
        <Notice tone="warning">{partnerLabel("receiptNotConfirmed", language)}</Notice>
      ) : null}
      <List label={partnerLabel("receiptLabel", language)}>
        {ordered.map((line) => {
          const status = RECEIPT_STATUS_LABELS[line.status];
          const pending = isOutstandingReceiptLine(line);

          return (
            <Item
              key={line.id}
              title={line.statement}
              subtitle={
                <span className="app-row-wrap" style={{ gap: "var(--app-2)" }}>
                  {line.targetSystem ? (
                    <span>
                      <span className="app-faint">
                        {partnerLabel("receiptTarget", language)}{" "}
                      </span>
                      {line.targetSystem}
                    </span>
                  ) : (
                    <span className="app-faint">{partnerLabel("receiptLocal", language)}</span>
                  )}
                  {line.externalId ? (
                    <span>
                      <span className="app-faint">
                        {partnerLabel("receiptExternalRef", language)}{" "}
                      </span>
                      <Data>{line.externalId}</Data>
                    </span>
                  ) : null}
                  {line.completedAt ? (
                    <span>
                      <span className="app-faint">
                        {partnerLabel("receiptCompleted", language)}{" "}
                      </span>
                      <Data>{line.completedAt}</Data>
                    </span>
                  ) : null}
                </span>
              }
              trailing={<Chip tone={status.tone}>{pick(status, language)}</Chip>}
            >
              <span className="app-stack-1" style={{ marginTop: "var(--app-1)" }}>
                {/*
                 * The explicit sentence. A warning tinted chip alone is read
                 * as decoration at a glance, and this line is the difference
                 * between a change that happened and one that has not.
                 */}
                {pending ? (
                  <span className="app-meta app-tone-warning">
                    {outstandingSentence(line, language)}
                  </span>
                ) : null}
                {line.retryState || line.attempts > 1 ? (
                  <span className="app-meta">
                    <span className="app-faint">{partnerLabel("receiptRetry", language)} </span>
                    {line.retryState || partnerLabel("receiptAttempts", language)}
                    {line.attempts > 1 ? <Data> {line.attempts}</Data> : null}
                  </span>
                ) : null}
                <span className="app-row" style={{ gap: "var(--app-3)" }}>
                  {line.externalUrl ? (
                    <a
                      className="app-btn app-btn-quiet app-btn-sm"
                      href={line.externalUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <IconArrowUpRight size={12} stroke={2} aria-hidden="true" />
                      {partnerLabel("receiptOpenExternal", language)}
                    </a>
                  ) : null}
                  {line.auditEventId ? (
                    onOpenAudit ? (
                      <button
                        type="button"
                        className="app-btn app-btn-quiet app-btn-sm"
                        onClick={() => onOpenAudit(line.auditEventId ?? "")}
                      >
                        <IconFileSearch size={12} stroke={2} aria-hidden="true" />
                        {partnerLabel("receiptOpenAudit", language)}
                      </button>
                    ) : (
                      <span className="app-meta">
                        <span className="app-faint">
                          {partnerLabel("detailAudit", language)}{" "}
                        </span>
                        <Data>{line.auditEventId}</Data>
                      </span>
                    )
                  ) : null}
                </span>
              </span>
            </Item>
          );
        })}
      </List>
    </>
  );

  if (variant === "plain") return <div className="app-stack">{body}</div>;

  return (
    <Card accent={outstanding > 0 ? "warning" : "success"} label={partnerLabel("receiptTitle", language)}>
      <SectionHead title={title ?? partnerLabel("receiptTitle", language)} count={ordered.length} />
      <div className="app-stack">{body}</div>
    </Card>
  );
}
