/**
 * The Integrations section of the Product Owner Console (plan 7.6).
 *
 * Connectors first, each with what an Integration Owner checks and the
 * controls that act on it; then the outbound queue with Retry, the mapping
 * issues with Resolve, incidents, and the diagnostic bundle. Planned adapters
 * are one line: they declare nothing, and the integration settings list them.
 *
 * Every connector carries its status badge from the product vocabulary, so a
 * simulated connector says Simulated. Credentials are a state word and
 * nothing else; the view model has no field that could hold one.
 *
 * Server component. Every control is a `ConsoleActionForm` whose server
 * action goes through `governConsoleAction`.
 */

import Link from "next/link";
import { Field, FieldList, SettingsHead, SettingsSection } from "@/components/settings/primitives";
import { Chip, Data, Empty, Item, List, Notice, ObjectRef } from "@/components/workday-v2/primitives";
import { StatusBadge } from "@/product/status";
import type { Language } from "@/i18n/labels";
import { checkConsolePermission, type Bilingual } from "@/features/product/permissions";
import { readActingConsoleIdentity } from "@/features/product/persona/acting";
import { ConsoleActionForm } from "@/features/product/forms/ConsoleActionForm";
import { CONSOLE_COPY } from "@/features/product/shell/copy";
import { consoleInputStyle, consoleLabelStyle, consoleWrapStyle } from "@/features/product/shell/styles";
import { actionResolveMapping, actionRetryCommand, actionRunSync, actionSetWritesPaused, actionTestConnection } from "./actions";
import { proposeResolveMapping, proposeWriteState } from "./operations";
import { readIntegrationsView, type ConnectorView } from "./model";
import {
  COMMAND_STATUS_LABELS,
  CREDENTIAL_LABELS,
  FRESHNESS_STATE_LABELS,
  INTEGRATIONS_COPY as COPY,
  SUBSCRIPTION_LABELS,
  WRITE_STATE_LABELS,
} from "./copy";

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

type Can = (actionId: Parameters<typeof checkConsolePermission>[1]) => { permitted: boolean; reason: string | null };

export async function IntegrationsConsole({ language }: { language: Language }) {
  const say = (pair: Bilingual) => (language === "de" ? pair.de : pair.en);
  const identity = await readActingConsoleIdentity();
  const can: Can = (actionId) => {
    const verdict = checkConsolePermission(identity.scopes, actionId);
    return { permitted: verdict.allowed, reason: verdict.allowed ? null : say(verdict.reason) };
  };

  let view: ReturnType<typeof readIntegrationsView>;
  try {
    view = readIntegrationsView();
  } catch {
    return (
      <div className="app-stack app-stack-6">
        <SettingsHead eyebrow={say(CONSOLE_COPY.eyebrow)} title={say(COPY.title)} lede={say(COPY.lede)} />
        <Notice tone="warning">{say(COPY.unavailable)}</Notice>
      </div>
    );
  }

  const retry = can("integration.retry-command");
  const resolve = can("integration.resolve-mapping");
  const diagnostics = can("integration.download-diagnostics");

  return (
    <div className="app-stack app-stack-6" data-testid="integrations-console">
      <SettingsHead eyebrow={say(CONSOLE_COPY.eyebrow)} title={say(COPY.title)} lede={say(COPY.lede)} />
      <Notice>{say(COPY.credentialNote)}</Notice>

      <SettingsSection title={say(COPY.connectors)} count={view.connectors.length}>
        <div className="app-stack app-stack-5">
          {view.connectors.length === 0 ? <Empty title={say(COPY.noConnectors)} /> : null}
          {view.connectors.map((connector) => (
            <ConnectorBlock key={connector.id} connector={connector} language={language} can={can} />
          ))}
          <span className="app-meta" style={consoleWrapStyle}>
            {fill(say(COPY.planned), { count: view.planned.length })}{" "}
            <Link href="/settings/integrations" className="app-source-link">
              {say(COPY.openSettings)}
            </Link>
          </span>
        </div>
      </SettingsSection>

      <SettingsSection title={say(COPY.queue)} count={view.queue.length}>
        <div className="app-stack app-stack-3" data-testid="integrations-queue">
          <span className="app-meta" style={consoleWrapStyle}>{say(COPY.queueNote)}</span>
          {view.queue.length === 0 ? (
            <Empty title={say(COPY.queueEmpty)} detail={say(COPY.queueEmptyDetail)} />
          ) : (
            <List label={say(COPY.queue)}>
              {view.queue.map((row) => (
                <Item
                  key={row.command.id}
                  title={
                    <span className="app-row app-row-wrap">
                      <Chip tone={row.command.status === "dead-letter" || row.command.status === "failed" ? "danger" : "warning"}>
                        {say(COMMAND_STATUS_LABELS[row.command.status] ?? { en: row.command.status, de: row.command.status })}
                      </Chip>
                      <ObjectRef id={row.command.id} />
                      <span style={consoleWrapStyle}>{row.command.intentStatement}</span>
                    </span>
                  }
                  subtitle={
                    <span className="app-stack app-stack-1">
                      <span className="app-row app-row-wrap">
                        <span>{row.targetSystem}</span>
                        <Data>
                          {row.command.attempts}/{row.command.maxAttempts}
                        </Data>
                        <span className="app-faint">{say(COPY.attempts)}</span>
                        {row.paused ? <Chip tone="warning">{say(COPY.pausedRow)}</Chip> : null}
                      </span>
                      {row.command.lastError.length > 0 ? <span className="app-meta" style={consoleWrapStyle}>{row.command.lastError}</span> : null}
                      {row.deadLetterReason.length > 0 ? <span className="app-meta" style={consoleWrapStyle}>{row.deadLetterReason}</span> : null}
                    </span>
                  }
                >
                  {row.retryable ? (
                    <ConsoleActionForm
                      action={actionRetryCommand}
                      language={language}
                      label={say(COPY.retry)}
                      hidden={{ commandId: row.command.id }}
                      permitted={retry.permitted}
                      blockedReason={retry.reason ?? (row.paused ? say(COPY.pausedRow) : null)}
                      testId={`integrations-retry-${row.command.id}`}
                    />
                  ) : null}
                </Item>
              ))}
            </List>
          )}
        </div>
      </SettingsSection>

      <SettingsSection title={say(COPY.mappingIssues)} count={view.mappingIssues.length}>
        <div className="app-stack app-stack-3" data-testid="integrations-mapping">
          <span className="app-meta" style={consoleWrapStyle}>{say(COPY.mappingNote)}</span>
          {view.mappingIssues.length === 0 ? (
            <Empty title={say(COPY.mappingEmpty)} detail={say(COPY.mappingEmptyDetail)} />
          ) : (
            <List label={say(COPY.mappingIssues)}>
              {view.mappingIssues.map((issue) => {
                const open = issue.status === "detected" || issue.status === "open" || issue.status === "in-review";
                const proposal = open ? proposeResolveMapping(issue) : null;
                return (
                  <Item
                    key={issue.key}
                    title={
                      <span className="app-row app-row-wrap">
                        <Chip tone={open ? "warning" : "success"}>{open ? say(COPY.detected) : issue.status}</Chip>
                        <span style={consoleWrapStyle}>{issue.title}</span>
                      </span>
                    }
                    subtitle={<span style={consoleWrapStyle}>{issue.resolution || issue.detail}</span>}
                  >
                    {proposal ? (
                      <ConsoleActionForm
                        action={actionResolveMapping}
                        language={language}
                        label={say(COPY.resolve)}
                        hidden={{ key: issue.key }}
                        permitted={resolve.permitted}
                        blockedReason={resolve.reason}
                        approval={{ lines: proposal.lines.map(say), fingerprint: proposal.fingerprint }}
                        testId={`integrations-resolve-${issue.key.replace(/[^A-Za-z0-9-]/g, "-")}`}
                        fields={
                          <label style={consoleLabelStyle}>
                            {say(COPY.outcome)}
                            <select name="outcome" defaultValue="resolved" style={consoleInputStyle}>
                              <option value="resolved">{say(COPY.outcomeResolved)}</option>
                              <option value="accepted">{say(COPY.outcomeAccepted)}</option>
                            </select>
                          </label>
                        }
                      />
                    ) : null}
                  </Item>
                );
              })}
            </List>
          )}
        </div>
      </SettingsSection>

      <SettingsSection title={say(COPY.incidents)} count={view.incidents.length}>
        {view.incidents.length === 0 ? (
          <Empty title={say(COPY.incidentsEmpty)} />
        ) : (
          <List label={say(COPY.incidents)}>
            {view.incidents.map((incident) => (
              <Item
                key={incident.id}
                title={
                  <span className="app-row app-row-wrap">
                    <Chip tone={incident.status === "resolved" ? "success" : "danger"}>{incident.status}</Chip>
                    <span style={consoleWrapStyle}>{incident.title}</span>
                  </span>
                }
                subtitle={<span style={consoleWrapStyle}>{incident.recoveryNote || incident.detail}</span>}
              />
            ))}
          </List>
        )}
      </SettingsSection>

      <SettingsSection title={say(COPY.diagnostics)}>
        <div className="app-stack app-stack-2">
          <span className="app-meta" style={consoleWrapStyle}>{say(COPY.diagnosticsNote)}</span>
          {diagnostics.permitted ? (
            <a href="/product/integrations/diagnostics" className="app-btn app-btn-secondary app-btn-sm" download data-testid="integrations-diagnostics">
              {say(COPY.download)}
            </a>
          ) : (
            <span className="app-meta" style={consoleWrapStyle} data-testid="integrations-diagnostics-blocked">
              {diagnostics.reason}
            </span>
          )}
        </div>
      </SettingsSection>
    </div>
  );
}

function ConnectorBlock({ connector, language, can }: { connector: ConnectorView; language: Language; can: Can }) {
  const say = (pair: Bilingual) => (language === "de" ? pair.de : pair.en);
  const write = WRITE_STATE_LABELS[connector.writeState];
  const test = can("integration.test-connection");
  const sync = can("integration.run-sync");
  const writes = can(connector.writeState === "paused" ? "integration.resume-writes" : "integration.pause-writes");
  const proposal =
    connector.writeState === "enabled" || connector.writeState === "paused"
      ? proposeWriteState(connector.id, connector.writeState === "enabled")
      : null;
  const testId = `integrations-connector-${connector.id}`;

  return (
    <section className="app-stack app-stack-3" data-testid={testId} data-write-state={connector.writeState}>
      <div className="app-row app-row-wrap app-between">
        <span className="app-row app-row-wrap" style={{ minWidth: 0 }}>
          <span className="app-object-title">{connector.displayName}</span>
          <ObjectRef id={connector.id} />
        </span>
        <span className="app-row app-row-wrap">
          <StatusBadge status={connector.status} language={language} />
          <Chip tone={connector.healthState === "healthy" ? "success" : "warning"}>{connector.healthState}</Chip>
        </span>
      </div>
      <FieldList label={connector.displayName}>
        <Field
          label={say(COPY.lastSync)}
          value={connector.lastSyncAt ? <Data>{connector.lastSyncAt.slice(0, 16).replace("T", " ")}</Data> : say(COPY.never)}
        />
        <Field
          label={say(COPY.freshness)}
          value={fill(say(COPY.freshnessValue), {
            state: say(FRESHNESS_STATE_LABELS[connector.freshness.state]),
            types: connector.freshness.types,
            stale: connector.freshness.stale,
            never: connector.freshness.neverSynced,
          })}
        />
        <Field label={say(COPY.subscription)} value={say(SUBSCRIPTION_LABELS[connector.subscription] ?? { en: connector.subscription, de: connector.subscription })} />
        <Field
          label={say(COPY.writeState)}
          value={
            <span data-testid={`${testId}-write-state`}>
              <Chip tone={write.tone}>{say(write)}</Chip>
            </span>
          }
          {...(connector.pause?.paused && connector.pause.changedAt
            ? {
                note: fill(say(COPY.pausedSince), {
                  by: connector.pause.changedBy ?? "",
                  at: connector.pause.changedAt.slice(0, 16).replace("T", " "),
                  reason: connector.pause.reason,
                }),
              }
            : {})}
        />
        <Field
          label={say(COPY.commands)}
          value={fill(say(COPY.commandsValue), {
            queued: connector.commands.queued,
            failed: connector.commands.failed,
            dead: connector.commands.deadLetters,
            awaiting: connector.commands.awaitingApproval,
          })}
        />
        <Field label={say(COPY.mappingIssues)} value={String(connector.mappingIssues)} />
        <Field label={say(COPY.credential)} value={say(CREDENTIAL_LABELS[connector.credential] ?? { en: connector.credential, de: connector.credential })} />
      </FieldList>
      <div className="app-row app-row-wrap" style={{ alignItems: "flex-start", gap: "var(--app-4)" }}>
        <ConsoleActionForm
          action={actionTestConnection}
          language={language}
          label={say(COPY.testConnection)}
          hidden={{ connectorInstanceId: connector.id }}
          permitted={test.permitted}
          blockedReason={test.reason}
          testId={`${testId}-test`}
        />
        {connector.canSync ? (
          <ConsoleActionForm
            action={actionRunSync}
            language={language}
            label={say(COPY.runSync)}
            hidden={{ connectorInstanceId: connector.id }}
            permitted={sync.permitted}
            blockedReason={sync.reason}
            testId={`${testId}-sync`}
          />
        ) : null}
        {proposal ? (
          <ConsoleActionForm
            action={actionSetWritesPaused}
            language={language}
            label={connector.writeState === "paused" ? say(COPY.resumeWrites) : say(COPY.pauseWrites)}
            hidden={{ connectorInstanceId: connector.id, paused: connector.writeState === "paused" ? "false" : "true" }}
            permitted={writes.permitted}
            blockedReason={writes.reason}
            approval={{ lines: proposal.lines.map(say), fingerprint: proposal.fingerprint }}
            tone={connector.writeState === "paused" ? "primary" : "danger"}
            testId={`${testId}-writes`}
          />
        ) : null}
      </div>
    </section>
  );
}
