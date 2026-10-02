/**
 * External execution receipt display.
 *
 * One editorial rule, and it is the rule the whole outbound pipeline exists to
 * support: a line is only ever shown as acknowledged when a target system
 * confirmed it. Everything else is shown as queued, failed or needing a retry,
 * with no external identifier, because there is nothing to link to until the
 * target says there is.
 *
 * The visible consequence is that a receipt can read "Assessment version
 * created in the GRC platform as GRC-000004" next to "Supplier record update
 * queued for the generic REST endpoint and not yet confirmed", and both
 * statements are true. The alternative, a single tick against the whole
 * decision, is the thing that makes an integration layer untrustworthy.
 */

import { IconArrowUpRight, IconCheck, IconClock, IconRefresh, IconX } from "@tabler/icons-react";
import { RECEIPT_STATUS_LABELS, pick, type ExecutionReceiptLineView } from "@/workday/contracts";
import { Chip, Data, Empty, Item, List } from "@/components/workday-v2/primitives";
import type { Language } from "@/i18n/labels";

function StatusChip({
  status,
  language,
}: {
  status: ExecutionReceiptLineView["status"];
  language: Language;
}) {
  const entry = RECEIPT_STATUS_LABELS[status];
  const Glyph =
    status === "acknowledged" || status === "local"
      ? IconCheck
      : status === "queued"
        ? IconClock
        : status === "dead-letter"
          ? IconRefresh
          : IconX;
  return (
    <Chip tone={entry.tone} title={status}>
      <Glyph size={11} stroke={2.2} aria-hidden="true" />
      {pick({ en: entry.en, de: entry.de }, language)}
    </Chip>
  );
}

/**
 * The receipt lines for a decision or a command.
 *
 * `ExternalReceiptList` takes the already projected view model from
 * `receiptLinesForDecision`, which merges acknowledged receipt rows with
 * commands still in flight. It does not read the database, so it renders
 * identically in a server component, a drawer and a test.
 */
export function ExternalReceiptList({
  lines,
  language,
  label,
}: {
  lines: ExecutionReceiptLineView[];
  language: Language;
  label?: string;
}) {
  if (lines.length === 0) {
    return (
      <Empty
        title={language === "de" ? "Keine externen Aenderungen" : "No external changes"}
        detail={
          language === "de"
            ? "Diese Entscheidung hat keine Aenderung an einem externen System ausgeloest."
            : "This decision produced no change to an external system."
        }
      />
    );
  }

  return (
    <List label={label ?? (language === "de" ? "Externe Belege" : "External receipts")}>
      {lines.map((line) => (
        <Item
          key={line.id}
          title={
            <span className="app-row app-row-wrap">
              <StatusChip status={line.status} language={language} />
              <span>{line.statement}</span>
            </span>
          }
          subtitle={
            <span className="app-row app-row-wrap">
              {line.targetSystem ? (
                <>
                  <span className="app-faint">{language === "de" ? "Ziel" : "Target"}</span>
                  <span>{line.targetSystem}</span>
                </>
              ) : (
                <span className="app-faint">
                  {language === "de" ? "Lokale Aenderung" : "Local change"}
                </span>
              )}
              {line.externalId ? (
                <>
                  <span className="app-context-sep" aria-hidden="true">
                    /
                  </span>
                  <span className="app-oid">
                    {line.externalType}:{line.externalId}
                  </span>
                </>
              ) : (
                <>
                  <span className="app-context-sep" aria-hidden="true">
                    /
                  </span>
                  <span className="app-faint">
                    {language === "de"
                      ? "noch keine externe Referenz"
                      : "no external reference yet"}
                  </span>
                </>
              )}
              {line.statusDetail.length > 0 ? (
                <span className="app-meta">{line.statusDetail}</span>
              ) : null}
            </span>
          }
          trailing={
            <span className="app-row">
              {line.attempts > 1 ? (
                <span className="app-row">
                  <Data>{line.attempts}</Data>
                  <span className="app-faint">
                    {language === "de" ? "Versuche" : "attempts"}
                  </span>
                </span>
              ) : null}
              {line.auditEventId ? <span className="app-oid">{line.auditEventId}</span> : null}
              {line.externalUrl ? (
                <a
                  href={line.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="app-btn app-btn-quiet app-btn-sm"
                >
                  <IconArrowUpRight size={12} stroke={2} aria-hidden="true" />
                  {language === "de" ? "Im Quellsystem" : "Open in source"}
                </a>
              ) : null}
            </span>
          }
        >
          {line.retryState.length > 0 ? (
            <span className="app-meta">{line.retryState}</span>
          ) : null}
        </Item>
      ))}
    </List>
  );
}

/**
 * A single line, for the activity stream.
 *
 * Compact on purpose: the activity stream shows what happened and when, and
 * the full external reference belongs in the receipt rather than in every row
 * of a scrolling list.
 */
export function ReceiptLine({
  line,
  language,
}: {
  line: ExecutionReceiptLineView;
  language: Language;
}) {
  return (
    <span className="app-row app-row-wrap">
      <StatusChip status={line.status} language={language} />
      <span>{line.statement}</span>
      {line.externalId ? (
        <span className="app-oid">{line.externalId}</span>
      ) : null}
    </span>
  );
}
