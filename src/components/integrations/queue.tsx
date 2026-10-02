"use client";

/**
 * The retry queue, with a working manual retry.
 *
 * A client component because the retry button has to do something. It calls
 * the server action, which hands the existing command back to the dispatcher,
 * which calls the authority gate again. The button is not a shortcut past
 * anything.
 *
 * The behaviour worth describing is what the component does while waiting.
 * It disables only the row being retried, keeps the rest of the queue usable,
 * and announces the result politely rather than replacing the row with a
 * spinner. An administrator retrying a dead letter during an incident needs
 * the other rows to stay readable, and a full table refresh that moved the
 * rows under the cursor would be worse than a slow one.
 *
 * It also states the duplicate guarantee next to the button, because that is
 * the question an operator actually has before pressing it.
 */

import { useState, useTransition } from "react";
import { IconAlertTriangle, IconClock, IconRefresh } from "@tabler/icons-react";
import type { CommandStatus } from "@/db/schema/integration";
import { Chip, Data, Empty, Item, List, Notice, type Tone } from "@/components/workday-v2/primitives";
import { Announcer } from "@/components/workday-v2/interactive";
import {
  actionRetryIntegrationCommand,
  type IntegrationActionResult,
} from "@/integrations/actions";
import type { Language } from "@/i18n/labels";

export interface QueueRowModel {
  commandId: string;
  status: CommandStatus;
  targetSystem: string;
  connectorInstanceId: string;
  commandKind: string;
  intentStatement: string;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string | null;
  lastError: string;
  atMoment: string;
  decisionId: string | null;
  approvalId: string | null;
  authorityClass: string;
  /** True while an operator may retry it. */
  retryable: boolean;
  /** The dead letter reason, when the command is dead lettered. */
  deadLetterReason: string;
}

const STATUS_LABELS: Record<CommandStatus, { en: string; de: string; tone: Tone }> = {
  proposed: { en: "Proposed", de: "Vorgeschlagen", tone: "neutral" },
  "awaiting-approval": { en: "Awaiting approval", de: "Wartet auf Genehmigung", tone: "warning" },
  approved: { en: "Approved", de: "Genehmigt", tone: "info" },
  queued: { en: "Queued", de: "In Warteschlange", tone: "warning" },
  executing: { en: "Sending", de: "Wird gesendet", tone: "info" },
  acknowledged: { en: "Acknowledged", de: "Bestaetigt", tone: "success" },
  failed: { en: "Failed", de: "Fehlgeschlagen", tone: "danger" },
  "dead-letter": { en: "Needs retry", de: "Wiederholung erforderlich", tone: "danger" },
  cancelled: { en: "Cancelled", de: "Abgebrochen", tone: "neutral" },
};

export function RetryQueue({
  rows,
  language,
}: {
  rows: QueueRowModel[];
  language: Language;
}) {
  const [pending, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [result, setResult] = useState<IntegrationActionResult | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const retry = (commandId: string): void => {
    setActiveId(commandId);
    setResult(null);
    startTransition(async () => {
      const outcome = await actionRetryIntegrationCommand(commandId);
      setResult(outcome);
      setAnnouncement(outcome.message);
      setActiveId(null);
    });
  };

  if (rows.length === 0) {
    return (
      <Empty
        title={language === "de" ? "Keine offenen Befehle" : "No commands in the queue"}
        detail={
          language === "de"
            ? "Jede externe Aenderung wurde bestaetigt. Ein Befehl erscheint hier, sobald ein Zielsystem nicht antwortet."
            : "Every external change has been acknowledged. A command appears here as soon as a target system does not answer."
        }
      />
    );
  }

  return (
    <div className="app-stack app-stack-3">
      <Announcer message={announcement} />

      <Notice tone="neutral">
        {language === "de"
          ? "Eine Wiederholung verwendet denselben Idempotenzschluessel und erzeugt daher kein zweites externes Objekt. Die Genehmigung der Person gilt weiterhin fuer genau diese Aenderung, eine erneute Genehmigung ist nicht erforderlich."
          : "A retry uses the same idempotency key, so it cannot create a second external object. The approval already granted still covers this exact change and no second approval is asked for."}
      </Notice>

      <List label={language === "de" ? "Warteschlange" : "Command queue"}>
        {rows.map((row) => {
          const label = STATUS_LABELS[row.status];
          const busy = pending && activeId === row.commandId;
          return (
            <Item
              key={row.commandId}
              title={
                <span className="app-row app-row-wrap">
                  <Chip tone={label.tone} title={row.status}>
                    {row.status === "dead-letter" ? (
                      <IconAlertTriangle size={11} stroke={2} aria-hidden="true" />
                    ) : null}
                    {language === "de" ? label.de : label.en}
                  </Chip>
                  <span>{row.intentStatement}</span>
                </span>
              }
              subtitle={
                <span className="app-stack app-stack-1">
                  <span className="app-row app-row-wrap">
                    <span className="app-faint">{language === "de" ? "Ziel" : "Target"}</span>
                    <span>{row.targetSystem}</span>
                    <span className="app-context-sep" aria-hidden="true">
                      /
                    </span>
                    <span className="app-oid">{row.commandKind}</span>
                    <span className="app-oid">{row.authorityClass}</span>
                    {row.decisionId ? <span className="app-oid">{row.decisionId}</span> : null}
                    {row.approvalId ? <span className="app-oid">{row.approvalId}</span> : null}
                  </span>
                  {row.lastError.length > 0 ? (
                    <span className="app-meta">{row.lastError}</span>
                  ) : null}
                  {row.deadLetterReason.length > 0 ? (
                    <span className="app-meta">{row.deadLetterReason}</span>
                  ) : null}
                </span>
              }
              trailing={
                <span className="app-row">
                  <span className="app-row">
                    <Data>
                      {row.attempts}/{row.maxAttempts}
                    </Data>
                    <span className="app-faint">
                      {language === "de" ? "Versuche" : "attempts"}
                    </span>
                  </span>
                  {row.nextAttemptAt ? (
                    <span className="app-row">
                      <IconClock size={12} stroke={1.8} aria-hidden="true" />
                      <Data title={row.nextAttemptAt}>{row.nextAttemptAt.slice(11, 19)}</Data>
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className="app-btn app-btn-secondary app-btn-sm"
                    onClick={() => retry(row.commandId)}
                    disabled={busy || !row.retryable}
                    aria-busy={busy}
                  >
                    <IconRefresh size={13} stroke={2} aria-hidden="true" />
                    {busy
                      ? language === "de"
                        ? "Wiederholt"
                        : "Retrying"
                      : language === "de"
                        ? "Wiederholen"
                        : "Retry"}
                  </button>
                </span>
              }
            />
          );
        })}
      </List>

      {result ? (
        <Notice tone={result.ok ? "success" : "warning"}>
          <span className="app-stack app-stack-1">
            <span>{result.message}</span>
            {result.detail.length > 0 ? (
              <ul
                className="app-stack app-stack-1"
                style={{ listStyle: "none", margin: 0, padding: 0 }}
              >
                {result.detail.map((line) => (
                  <li key={line} className="app-meta">
                    {line}
                  </li>
                ))}
              </ul>
            ) : null}
          </span>
        </Notice>
      ) : null}
    </div>
  );
}

/**
 * Connector availability and simulated event controls.
 *
 * Grouped with the queue rather than with the connector rows, because these
 * are the two operations that change what the queue contains and an
 * administrator demonstrating the failure path uses them together.
 */
export function ConnectorControls({
  instances,
  language,
}: {
  instances: Array<{
    id: string;
    displayName: string;
    available: boolean;
    canSimulateEvent: boolean;
    canSync: boolean;
  }>;
  language: Language;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<IntegrationActionResult | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const run = (operation: () => Promise<IntegrationActionResult>): void => {
    setResult(null);
    startTransition(async () => {
      const outcome = await operation();
      setResult(outcome);
      setAnnouncement(outcome.message);
    });
  };

  return (
    <div className="app-stack app-stack-3">
      <Announcer message={announcement} />

      <List label={language === "de" ? "Konnektorsteuerung" : "Connector controls"}>
        {instances.map((instance) => (
          <Item
            key={instance.id}
            title={instance.displayName}
            subtitle={
              instance.available
                ? language === "de"
                  ? "Verfuegbar."
                  : "Available."
                : language === "de"
                  ? "Nicht verfuegbar. Genehmigte Aenderungen werden eingereiht und bleiben erhalten."
                  : "Unavailable. Approved changes are queued and preserved."
            }
            trailing={
              <span className="app-row">
                {instance.canSimulateEvent ? (
                  <button
                    type="button"
                    className="app-btn app-btn-quiet app-btn-sm"
                    disabled={pending}
                    onClick={() =>
                      run(async () => {
                        const { actionTriggerSimulatedInboundEvent } = await import(
                          "@/integrations/actions"
                        );
                        return actionTriggerSimulatedInboundEvent(instance.id);
                      })
                    }
                  >
                    {language === "de" ? "Ereignis senden" : "Send an event"}
                  </button>
                ) : null}
                {instance.canSync ? (
                  <button
                    type="button"
                    className="app-btn app-btn-quiet app-btn-sm"
                    disabled={pending}
                    onClick={() =>
                      run(async () => {
                        const { actionRunConnectorSync } = await import("@/integrations/actions");
                        return actionRunConnectorSync(instance.id);
                      })
                    }
                  >
                    {language === "de" ? "Abgleich starten" : "Run a sync"}
                  </button>
                ) : null}
                <button
                  type="button"
                  className={
                    instance.available
                      ? "app-btn app-btn-secondary app-btn-sm"
                      : "app-btn app-btn-primary app-btn-sm"
                  }
                  disabled={pending}
                  onClick={() =>
                    run(async () => {
                      const { actionSetConnectorAvailability } = await import(
                        "@/integrations/actions"
                      );
                      return actionSetConnectorAvailability(instance.id, !instance.available);
                    })
                  }
                >
                  {instance.available
                    ? language === "de"
                      ? "Nicht verfuegbar setzen"
                      : "Set unavailable"
                    : language === "de"
                      ? "Wiederherstellen"
                      : "Recover"}
                </button>
              </span>
            }
          />
        ))}
      </List>

      {result ? (
        <Notice tone={result.ok ? "success" : "warning"}>
          <span className="app-stack app-stack-1">
            <span>{result.message}</span>
            {result.detail.length > 0 ? (
              <ul
                className="app-stack app-stack-1"
                style={{ listStyle: "none", margin: 0, padding: 0 }}
              >
                {result.detail.map((line) => (
                  <li key={line} className="app-meta">
                    {line}
                  </li>
                ))}
              </ul>
            ) : null}
          </span>
        </Notice>
      ) : null}
    </div>
  );
}
